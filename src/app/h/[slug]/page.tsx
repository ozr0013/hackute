import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getProfile, getTagOptions } from "@/lib/data";
import { matchScore, type MatchSide } from "@/lib/match";
import { inviteUser, setAvailability } from "@/app/actions/teams";
import { PersonCard } from "@/components/person-card";
import { Flash } from "@/components/flash";
import { Badge, Card, MatchBadge, Tags } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn, formatRange } from "@/lib/utils";
import {
  PUBLIC_PROFILE_COLUMNS,
  YEARS,
  type Hackathon,
  type JoinRequest,
  type OpenTeam,
  type Participation,
  type PublicProfile,
} from "@/lib/types";

type SP = {
  tab?: string;
  track?: string;
  skill?: string;
  year?: string;
  role?: string;
  error?: string;
  notice?: string;
};

const lc = (xs: string[]) => xs.map((x) => x.toLowerCase());

export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "teams" ? "teams" : "people";
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: h } = await supabase.from("hackathons").select("*").eq("slug", slug).maybeSingle();
  if (!h) notFound();
  const hackathon = h as Hackathon;
  const back = `/h/${slug}?tab=${tab}`;

  const [me, { data: partRow }, { data: myMemberships }, tagOptions] = await Promise.all([
    getProfile(supabase, user.id),
    supabase.from("participations").select("*").eq("user_id", user.id).eq("hackathon_id", hackathon.id).maybeSingle(),
    supabase.from("team_members").select("team_id, teams!inner(*)").eq("user_id", user.id).eq("teams.hackathon_id", hackathon.id),
    getTagOptions(supabase),
  ]);
  if (!me) redirect("/onboarding");
  const myPart = partRow as Participation | null;
  const myTeam = ((myMemberships ?? []) as unknown as { teams: OpenTeam }[])[0]?.teams ?? null;
  const iOwnTeam = myTeam?.owner_id === user.id;

  // My team's aggregate side (for scoring people when I'm on a team)
  let myTeamSide: MatchSide | null = null;
  let myTeamCount = 0;
  if (myTeam) {
    const { data } = await supabase
      .from("team_members")
      .select(`profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq("team_id", myTeam.id);
    const ms = ((data ?? []) as unknown as { profiles: PublicProfile }[]).map((r) => r.profiles);
    myTeamCount = ms.length;
    myTeamSide = {
      track: myTeam.track,
      skills: ms.flatMap((m) => m.skills),
      interests: ms.flatMap((m) => m.interests),
      years: ms.map((m) => m.year),
    };
  }
  const mySide: MatchSide = {
    track: myPart?.track,
    skills: me.skills,
    interests: me.interests,
    years: [me.year],
  };

  // Requests I've sent / invites my team has sent, to show state on cards
  const { data: reqRows } = await supabase
    .from("join_requests")
    .select("*")
    .eq("status", "pending")
    .or(myTeam && iOwnTeam ? `user_id.eq.${user.id},team_id.eq.${myTeam.id}` : `user_id.eq.${user.id}`);
  const pending = (reqRows ?? []) as JoinRequest[];
  const requestedTeams = new Set(pending.filter((r) => r.user_id === user.id).map((r) => r.team_id));
  const invitedUsers = new Set(pending.filter((r) => myTeam && r.team_id === myTeam.id).map((r) => r.user_id));

  // ---------------------------------------------------------------- People
  let people: { person: PublicProfile; part: Participation; score: number }[] = [];
  let teams: { team: OpenTeam; score: number; members: PublicProfile[] }[] = [];

  if (tab === "people") {
    const { data } = await supabase
      .from("participations")
      .select(`*, profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq("hackathon_id", hackathon.id)
      .eq("available", true)
      .neq("user_id", user.id);
    const rows = (data ?? []) as unknown as (Participation & { profiles: PublicProfile })[];
    people = rows
      .filter((r) => r.profiles)
      .filter((r) => !sp.track || r.track === sp.track)
      .filter((r) => !sp.year || r.profiles.year === sp.year)
      .filter((r) => !sp.skill || lc(r.profiles.skills).includes(sp.skill.toLowerCase()))
      .filter((r) => !sp.role || lc(r.profiles.skills).includes(sp.role.toLowerCase()))
      .map((r) => {
        const candidate: MatchSide = {
          track: r.track,
          skills: r.profiles.skills,
          interests: r.profiles.interests,
          years: [r.profiles.year],
        };
        const score = myTeamSide
          ? matchScore(candidate, myTeamSide, myTeam?.roles_needed ?? [])
          : matchScore(candidate, mySide);
        const { profiles, ...part } = r;
        return { person: profiles, part, score };
      })
      .sort((a, b) => b.score - a.score);
  } else {
    // -------------------------------------------------------------- Teams
    const { data } = await supabase.from("open_teams").select("*").eq("hackathon_id", hackathon.id);
    const open = ((data ?? []) as OpenTeam[]).filter((t) => t.id !== myTeam?.id);
    const ids = open.map((t) => t.id);
    const membersByTeam = new Map<string, PublicProfile[]>();
    if (ids.length) {
      const { data: mrows } = await supabase
        .from("team_members")
        .select(`team_id, profiles(${PUBLIC_PROFILE_COLUMNS})`)
        .in("team_id", ids);
      for (const r of (mrows ?? []) as unknown as { team_id: string; profiles: PublicProfile }[]) {
        if (!r.profiles) continue;
        membersByTeam.set(r.team_id, [...(membersByTeam.get(r.team_id) ?? []), r.profiles]);
      }
    }
    teams = open
      .map((team) => ({ team, members: membersByTeam.get(team.id) ?? [] }))
      .filter(({ team }) => !sp.track || team.track === sp.track)
      .filter(({ team }) => !sp.role || lc(team.roles_needed).includes(sp.role.toLowerCase()))
      .filter(
        ({ team, members }) =>
          !sp.skill ||
          lc([...team.roles_needed, ...members.flatMap((m) => m.skills)]).includes(sp.skill.toLowerCase()),
      )
      .filter(({ members }) => !sp.year || members.some((m) => m.year === sp.year))
      .map(({ team, members }) => ({
        team,
        members,
        score: matchScore(
          mySide,
          {
            track: team.track,
            skills: members.flatMap((m) => m.skills),
            interests: members.flatMap((m) => m.interests),
            years: members.map((m) => m.year),
          },
          team.roles_needed,
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }

  const canInvite = iOwnTeam && myTeam && myTeamCount < myTeam.max_size;
  const roleOptions = Array.from(new Set([...tagOptions.skills])).sort();
  const filterCount = [sp.track, sp.skill, sp.year, sp.role].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← All hackathons
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{hackathon.name}</h1>
        <p className="text-sm text-zinc-600">
          {formatRange(hackathon.starts_at, hackathon.ends_at)}
          {hackathon.location ? ` · ${hackathon.location}` : ""}
        </p>
      </div>

      <Flash error={sp.error} notice={sp.notice} />

      {/* Status bar */}
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!myPart ? (
          <>
            <p className="text-sm">You haven&apos;t joined this hackathon yet.</p>
            <ButtonLink href={`/h/${slug}/join`} size="sm">
              Join hackathon
            </ButtonLink>
          </>
        ) : myTeam ? (
          <>
            <p className="text-sm">
              You&apos;re on <span className="font-semibold">{myTeam.name}</span>
              {iOwnTeam ? " (owner)" : ""}.
            </p>
            <ButtonLink href={`/teams/${myTeam.id}`} size="sm" variant="outline">
              View team
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="text-sm">
              {myPart.mode === "recruiting" ? "Recruiting" : "Looking for a team"}
              {myPart.track ? ` · ${myPart.track}` : ""} ·{" "}
              {myPart.available ? (
                <Badge tone="green">Visible</Badge>
              ) : (
                <Badge tone="muted">Hidden</Badge>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/teams/new?h=${slug}`} size="sm">
                Create team
              </ButtonLink>
              <ButtonLink href={`/h/${slug}/join`} size="sm" variant="outline">
                Edit
              </ButtonLink>
              <form action={setAvailability}>
                <input type="hidden" name="hackathon_id" value={hackathon.id} />
                <input type="hidden" name="available" value={String(!myPart.available)} />
                <input type="hidden" name="back" value={back} />
                <Button size="sm" variant="ghost">
                  {myPart.available ? "Hide me" : "Show me"}
                </Button>
              </form>
            </div>
          </>
        )}
      </Card>

      {/* Tabs */}
      <div className="grid grid-cols-2 rounded-lg bg-zinc-200/60 p-1 text-sm font-medium">
        {(["people", "teams"] as const).map((t) => (
          <Link
            key={t}
            href={`/h/${slug}?tab=${t}`}
            className={cn(
              "rounded-md py-2 text-center",
              tab === t ? "bg-white shadow-sm" : "text-zinc-600",
            )}
          >
            {t === "people" ? "People" : "Teams"}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <details className="rounded-xl border border-zinc-200 bg-white p-3" open={filterCount > 0}>
        <summary className="cursor-pointer text-sm font-medium">
          Filters{filterCount ? ` (${filterCount})` : ""}
        </summary>
        <form className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="hidden" name="tab" value={tab} />
          <Select name="track" defaultValue={sp.track ?? ""} aria-label="Track">
            <option value="">Any track</option>
            {hackathon.tracks.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select name="skill" defaultValue={sp.skill ?? ""} aria-label="Skill">
            <option value="">Any skill</option>
            {tagOptions.skills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select name="year" defaultValue={sp.year ?? ""} aria-label="Year">
            <option value="">Any year</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
          <Select name="role" defaultValue={sp.role ?? ""} aria-label="Role needed">
            <option value="">Any role needed</option>
            {roleOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <div className="col-span-2 flex gap-2 sm:col-span-4">
            <Button size="sm" type="submit">
              Apply
            </Button>
            <ButtonLink href={`/h/${slug}?tab=${tab}`} size="sm" variant="ghost">
              Clear
            </ButtonLink>
          </div>
        </form>
      </details>

      {/* Results */}
      {tab === "people" ? (
        <section className="space-y-3">
          {people.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No available students match these filters yet.</p>
          )}
          {people.map(({ person, part, score }) => (
            <PersonCard key={person.id} person={person} score={score} track={part.track}>
              {canInvite &&
                (invitedUsers.has(person.id) ? (
                  <Badge tone="muted">Invite pending</Badge>
                ) : (
                  <form action={inviteUser}>
                    <input type="hidden" name="team_id" value={myTeam!.id} />
                    <input type="hidden" name="user_id" value={person.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button size="sm" className="w-full sm:w-auto">
                      Invite to {myTeam!.name}
                    </Button>
                  </form>
                ))}
            </PersonCard>
          ))}
        </section>
      ) : (
        <section className="space-y-3">
          {teams.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No open teams match these filters yet.</p>
          )}
          {teams.map(({ team, score, members }) => (
            <Card key={team.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/teams/${team.id}`} className="font-semibold hover:underline">
                    {team.name}
                  </Link>
                  <p className="text-sm text-zinc-600">
                    {team.track ?? "Any track"} · {team.member_count}/{team.max_size} members
                  </p>
                </div>
                <MatchBadge score={score} />
              </div>
              {team.description && <p className="text-sm text-zinc-700">{team.description}</p>}
              {team.roles_needed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Looking for</p>
                  <Tags items={team.roles_needed} tone="utah" />
                </div>
              )}
              <p className="text-xs text-zinc-500">{members.map((m) => m.full_name).join(", ")}</p>
              <div>
                {requestedTeams.has(team.id) ? (
                  <Badge tone="muted">Request pending</Badge>
                ) : (
                  <ButtonLink
                    href={`/teams/${team.id}`}
                    size="sm"
                    variant={myTeam ? "outline" : "default"}
                    className="w-full sm:w-auto"
                  >
                    {myTeam ? "View" : "View and request to join"}
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
