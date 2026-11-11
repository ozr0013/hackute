import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getContact } from "@/lib/data";
import { acceptRequest, declineRequest, inviteUser, requestToJoin } from "@/app/actions/teams";
import { PersonCard } from "@/components/person-card";
import { Flash } from "@/components/flash";
import { Badge, Card, Tags } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import {
  PUBLIC_PROFILE_COLUMNS,
  type Hackathon,
  type JoinRequest,
  type Participation,
  type PublicProfile,
  type Team,
} from "@/lib/types";

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: t } = await supabase.from("teams").select("*, hackathons(*)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { hackathons: hackathon, ...team } = t as Team & { hackathons: Hackathon };
  const back = `/teams/${team.id}`;
  const isOwner = team.owner_id === user.id;

  const { data: mrows } = await supabase
    .from("team_members")
    .select(`user_id, profiles(${PUBLIC_PROFILE_COLUMNS})`)
    .eq("team_id", team.id)
    .order("joined_at");
  const members = ((mrows ?? []) as unknown as { profiles: PublicProfile }[])
    .map((r) => r.profiles)
    .filter(Boolean);
  const isMember = members.some((m) => m.id === user.id);
  const full = members.length >= team.max_size;

  // RLS returns: all of this team's requests if I'm the owner, otherwise only mine
  const { data: rrows } = await supabase
    .from("join_requests")
    .select(`*, profiles(${PUBLIC_PROFILE_COLUMNS})`)
    .eq("team_id", team.id)
    .eq("status", "pending")
    .order("created_at");
  const requests = (rrows ?? []) as unknown as (JoinRequest & { profiles: PublicProfile })[];
  const myRequest = requests.find((r) => r.user_id === user.id) ?? null;
  const incoming = isOwner ? requests.filter((r) => r.direction === "request") : [];
  const sentInvites = isOwner ? requests.filter((r) => r.direction === "invite") : [];

  // Contact info: get_contact enforces visibility in the database
  const contactIds = Array.from(new Set([...members.map((m) => m.id), ...incoming.map((r) => r.user_id)]));
  const contacts = new Map(
    await Promise.all(contactIds.map(async (uid) => [uid, await getContact(supabase, uid)] as const)),
  );

  // Am I already on a team in this hackathon?
  const { data: onTeam } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(hackathon_id)")
    .eq("user_id", user.id)
    .eq("teams.hackathon_id", hackathon.id);
  const alreadyOnTeam = (onTeam ?? []).length > 0;

  // Owner invite list: available participants in this hackathon without a pending invite
  let invitable: PublicProfile[] = [];
  if (isOwner && !full) {
    const { data } = await supabase
      .from("participations")
      .select(`*, profiles(${PUBLIC_PROFILE_COLUMNS})`)
      .eq("hackathon_id", hackathon.id)
      .eq("available", true);
    const pendingIds = new Set(requests.map((r) => r.user_id));
    invitable = ((data ?? []) as unknown as (Participation & { profiles: PublicProfile })[])
      .map((r) => r.profiles)
      .filter((p) => p && !pendingIds.has(p.id) && !members.some((m) => m.id === p.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/h/${hackathon.slug}?tab=teams`} className="text-sm text-zinc-500 hover:underline">
          ← {hackathon.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {full ? <Badge>Full</Badge> : <Badge tone="green">Open</Badge>}
        </div>
        <p className="text-sm text-zinc-600">
          {team.track ?? "Any track"} · {members.length}/{team.max_size} members
        </p>
      </div>

      <Flash error={sp.error} notice={sp.notice} />

      <Card className="space-y-3">
        {team.description ? (
          <p className="text-sm text-zinc-700">{team.description}</p>
        ) : (
          <p className="text-sm text-zinc-500">No description yet.</p>
        )}
        {team.roles_needed.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Looking for</p>
            <Tags items={team.roles_needed} tone="utah" />
          </div>
        )}
      </Card>

      {/* Join / invite status for non-members */}
      {!isMember && (
        <Card className="space-y-3">
          {myRequest ? (
            myRequest.direction === "invite" ? (
              <>
                <p className="text-sm font-medium">You&apos;ve been invited to join this team.</p>
                {myRequest.message && <p className="text-sm text-zinc-600">“{myRequest.message}”</p>}
                <div className="flex gap-2">
                  <form action={acceptRequest}>
                    <input type="hidden" name="id" value={myRequest.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button size="sm">Accept invite</Button>
                  </form>
                  <form action={declineRequest}>
                    <input type="hidden" name="id" value={myRequest.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button size="sm" variant="outline">
                      Decline
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">Your request is pending.</p>
                <form action={declineRequest}>
                  <input type="hidden" name="id" value={myRequest.id} />
                  <input type="hidden" name="back" value={back} />
                  <Button size="sm" variant="ghost">
                    Cancel request
                  </Button>
                </form>
              </div>
            )
          ) : full ? (
            <p className="text-sm text-zinc-600">This team is full.</p>
          ) : alreadyOnTeam ? (
            <p className="text-sm text-zinc-600">You&apos;re already on a team for this hackathon.</p>
          ) : (
            <form action={requestToJoin} className="space-y-3">
              <input type="hidden" name="team_id" value={team.id} />
              <input type="hidden" name="back" value={back} />
              <Textarea name="message" maxLength={300} placeholder="Say hi and what you'd bring (optional)" />
              <Button className="w-full sm:w-auto">Request to join</Button>
            </form>
          )}
        </Card>
      )}

      {/* Owner: incoming requests */}
      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Requests to join ({incoming.length})</h2>
          {incoming.length === 0 && <p className="text-sm text-zinc-500">No pending requests.</p>}
          {incoming.map((r) => (
            <PersonCard key={r.id} person={r.profiles} contact={contacts.get(r.user_id)}>
              {r.message && <p className="text-sm text-zinc-600">“{r.message}”</p>}
              <div className="flex gap-2">
                <form action={acceptRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="back" value={back} />
                  <Button size="sm" disabled={full}>
                    Accept
                  </Button>
                </form>
                <form action={declineRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="back" value={back} />
                  <Button size="sm" variant="outline">
                    Decline
                  </Button>
                </form>
              </div>
            </PersonCard>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        {members.map((m) => (
          <PersonCard key={m.id} person={m} contact={contacts.get(m.id)}>
            {m.id === team.owner_id && <Badge tone="utah">Owner</Badge>}
          </PersonCard>
        ))}
      </section>

      {/* Owner: invite people */}
      {isOwner && !full && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Invite people</h2>
          <Card className="space-y-3">
            {invitable.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No available students to invite right now. Check the{" "}
                <Link href={`/h/${hackathon.slug}`} className="text-utah hover:underline">
                  People tab
                </Link>{" "}
                later.
              </p>
            ) : (
              <form action={inviteUser} className="space-y-3">
                <input type="hidden" name="team_id" value={team.id} />
                <input type="hidden" name="back" value={back} />
                <Select name="user_id" required defaultValue="" aria-label="Student to invite">
                  <option value="" disabled>
                    Choose a student
                  </option>
                  {invitable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.year}
                      {p.skills.length ? `, ${p.skills.slice(0, 3).join(", ")}` : ""})
                    </option>
                  ))}
                </Select>
                <Textarea name="message" maxLength={300} placeholder="Optional message" />
                <Button>Send invite</Button>
              </form>
            )}
            <p className="text-xs text-zinc-500">
              Tip: the{" "}
              <Link href={`/h/${hackathon.slug}?tab=people`} className="text-utah hover:underline">
                People tab
              </Link>{" "}
              sorts students by match score for your team.
            </p>
          </Card>
          {sentInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pending invites</p>
              {sentInvites.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  <span className="text-sm">{r.profiles?.full_name}</span>
                  <form action={declineRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    <Button size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
