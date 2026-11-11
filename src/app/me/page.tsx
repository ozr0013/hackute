import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getContact, getProfile, getTagOptions } from "@/lib/data";
import { acceptRequest, declineRequest } from "@/app/actions/teams";
import { ProfileForm } from "@/components/profile-form";
import { Flash } from "@/components/flash";
import { Badge, Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import type { Hackathon, JoinRequest, Participation, Team } from "@/lib/types";

type TeamWithH = Team & { hackathons: Pick<Hackathon, "slug" | "name"> };

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const [profile, contact, tags, { data: memberRows }, { data: partRows }, { data: reqRows }] = await Promise.all([
    getProfile(supabase, user.id),
    getContact(supabase, user.id),
    getTagOptions(supabase),
    supabase.from("team_members").select("teams(*, hackathons(slug, name))").eq("user_id", user.id),
    supabase.from("participations").select("*, hackathons(slug, name)").eq("user_id", user.id),
    supabase
      .from("join_requests")
      .select("*, teams(*, hackathons(slug, name))")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  if (!profile) redirect("/onboarding");

  const myTeams = ((memberRows ?? []) as unknown as { teams: TeamWithH }[]).map((r) => r.teams).filter(Boolean);
  const parts = (partRows ?? []) as unknown as (Participation & { hackathons: Pick<Hackathon, "slug" | "name"> })[];
  const mine = (reqRows ?? []) as unknown as (JoinRequest & { teams: TeamWithH })[];
  const invites = mine.filter((r) => r.direction === "invite");
  const sent = mine.filter((r) => r.direction === "request");

  // Pending requests to teams I own
  const ownedIds = myTeams.filter((t) => t.owner_id === user.id).map((t) => t.id);
  const incomingCount = new Map<string, number>();
  if (ownedIds.length) {
    const { data } = await supabase
      .from("join_requests")
      .select("team_id")
      .in("team_id", ownedIds)
      .eq("direction", "request")
      .eq("status", "pending");
    for (const r of (data ?? []) as { team_id: string }[]) {
      incomingCount.set(r.team_id, (incomingCount.get(r.team_id) ?? 0) + 1);
    }
  }

  // The other side of a pending invite (team owner) can be contacted
  const ownerContacts = new Map(
    await Promise.all(invites.map(async (r) => [r.id, await getContact(supabase, r.teams.owner_id)] as const)),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hi, {profile.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-zinc-600">{user.email}</p>
      </div>
      <Flash error={sp.error} notice={sp.notice} />

      {invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Invites for you</h2>
          {invites.map((r) => {
            const c = ownerContacts.get(r.id);
            return (
              <Card key={r.id} className="space-y-2">
                <p className="text-sm">
                  <Link href={`/teams/${r.team_id}`} className="font-semibold hover:underline">
                    {r.teams.name}
                  </Link>{" "}
                  invited you for {r.teams.hackathons.name}.
                </p>
                {r.message && <p className="text-sm text-zinc-600">“{r.message}”</p>}
                {c && (
                  <p className="text-xs text-zinc-500">
                    Owner contact: {c.email}
                    {c.discord ? ` · Discord ${c.discord}` : ""}
                  </p>
                )}
                <div className="flex gap-2">
                  <form action={acceptRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/me" />
                    <Button size="sm">Accept</Button>
                  </form>
                  <form action={declineRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/me" />
                    <Button size="sm" variant="outline">
                      Decline
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My teams</h2>
        {myTeams.length === 0 && <p className="text-sm text-zinc-500">You&apos;re not on a team yet.</p>}
        {myTeams.map((t) => (
          <Card key={t.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/teams/${t.id}`} className="font-semibold hover:underline">
                {t.name}
              </Link>
              <p className="text-sm text-zinc-600">{t.hackathons.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {t.owner_id === user.id && <Badge tone="utah">Owner</Badge>}
              {(incomingCount.get(t.id) ?? 0) > 0 && (
                <Badge tone="green">{incomingCount.get(t.id)} requests</Badge>
              )}
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My pending requests</h2>
        {sent.length === 0 && <p className="text-sm text-zinc-500">No pending requests.</p>}
        {sent.map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/teams/${r.team_id}`} className="font-semibold hover:underline">
                {r.teams.name}
              </Link>
              <p className="text-sm text-zinc-600">{r.teams.hackathons.name}</p>
            </div>
            <form action={declineRequest}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="back" value="/me" />
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </form>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My hackathons</h2>
        {parts.length === 0 && (
          <p className="text-sm text-zinc-500">
            You haven&apos;t joined any hackathons. <Link href="/" className="text-utah hover:underline">Browse</Link>
          </p>
        )}
        {parts.map((p) => (
          <Card key={p.hackathon_id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{p.hackathons.name}</p>
              <p className="text-sm text-zinc-600">
                {p.mode === "recruiting" ? "Recruiting" : "Looking for a team"}
                {p.track ? ` · ${p.track}` : ""}
              </p>
            </div>
            <ButtonLink href={`/h/${p.hackathons.slug}`} size="sm" variant="outline">
              Open hub
            </ButtonLink>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <Card>
          <ProfileForm
            mode="edit"
            profile={profile}
            discord={contact?.discord}
            skillOptions={tags.skills}
            interestOptions={tags.interests}
          />
        </Card>
      </section>
    </div>
  );
}
