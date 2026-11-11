import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getTagOptions } from "@/lib/data";
import { createTeam } from "@/app/actions/teams";
import { TagPicker } from "@/components/tag-picker";
import { Flash } from "@/components/flash";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { Hackathon } from "@/lib/types";

export default async function NewTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string; error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: hs } = await supabase
    .from("hackathons")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  const hackathons = (hs ?? []) as Hackathon[];

  // Pick a hackathon first if none was given
  const hackathon = hackathons.find((h) => h.slug === sp.h);
  if (!hackathon) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Create a team</h1>
        <p className="text-sm text-zinc-600">Which hackathon is this team for?</p>
        {hackathons.map((h) => (
          <ButtonLink key={h.id} href={`/teams/new?h=${h.slug}`} variant="outline" className="w-full justify-start">
            {h.name}
          </ButtonLink>
        ))}
      </div>
    );
  }

  const { data: existing } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(hackathon_id, name)")
    .eq("user_id", user.id)
    .eq("teams.hackathon_id", hackathon.id)
    .maybeSingle();

  const { data: part } = await supabase
    .from("participations")
    .select("track")
    .eq("user_id", user.id)
    .eq("hackathon_id", hackathon.id)
    .maybeSingle();

  const { skills } = await getTagOptions(supabase);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/h/${hackathon.slug}`} className="text-sm text-zinc-500 hover:underline">
          ← {hackathon.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Create a team</h1>
      </div>
      <Flash error={sp.error} notice={sp.notice} />

      {existing ? (
        <Card className="space-y-3">
          <p className="text-sm">You&apos;re already on a team for {hackathon.name}.</p>
          <ButtonLink href={`/teams/${existing.team_id}`} size="sm">
            Go to your team
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <form action={createTeam} className="space-y-5">
            <input type="hidden" name="hackathon_id" value={hackathon.id} />
            <input type="hidden" name="slug" value={hackathon.slug} />

            <Field label="Team name" htmlFor="name">
              <Input id="name" name="name" required maxLength={60} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Track" htmlFor="track">
                <Select id="track" name="track" defaultValue={(part?.track as string | null) ?? ""}>
                  <option value="">Undecided</option>
                  {hackathon.tracks.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Max team size" htmlFor="max_size">
                <Select id="max_size" name="max_size" defaultValue="4">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="description" hint="Max 500 characters">
              <Textarea id="description" name="description" maxLength={500} placeholder="What are you building?" />
            </Field>

            <Field label="Roles needed">
              <TagPicker name="roles_needed" options={skills} max={10} placeholder="Add a role" />
            </Field>

            <Button type="submit" className="w-full sm:w-auto">
              Create team
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
