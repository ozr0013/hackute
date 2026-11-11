import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { joinHackathon } from "@/app/actions/teams";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { Flash, type FlashParams } from "@/components/flash";
import { formatRange } from "@/lib/utils";
import type { Hackathon, Participation } from "@/lib/types";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const { slug } = await params;
  const flash = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: h } = await supabase.from("hackathons").select("*").eq("slug", slug).maybeSingle();
  if (!h) notFound();
  const hackathon = h as Hackathon;

  const { data: p } = await supabase
    .from("participations")
    .select("*")
    .eq("user_id", user.id)
    .eq("hackathon_id", hackathon.id)
    .maybeSingle();
  const part = p as Participation | null;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/h/${slug}`} className="text-sm text-zinc-500 hover:underline">
          ← {hackathon.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{part ? "Update your participation" : `Join ${hackathon.name}`}</h1>
        <p className="text-sm text-zinc-600">{formatRange(hackathon.starts_at, hackathon.ends_at)}</p>
      </div>
      <Flash {...flash} />
      <Card>
        <form action={joinHackathon} className="space-y-5">
          <input type="hidden" name="hackathon_id" value={hackathon.id} />
          <input type="hidden" name="slug" value={slug} />

          <Field label="Track" htmlFor="track">
            <Select id="track" name="track" defaultValue={part?.track ?? ""}>
              <option value="">Undecided</option>
              {hackathon.tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-800">What are you doing?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { v: "looking_for_team", t: "Looking for a team", d: "Show me in the People tab so teams can invite me." },
                { v: "recruiting", t: "Recruiting teammates", d: "I'll create a team and invite people." },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex cursor-pointer gap-3 rounded-lg border border-zinc-300 p-3 has-[:checked]:border-utah has-[:checked]:bg-utah/5"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={o.v}
                    required
                    defaultChecked={(part?.mode ?? "looking_for_team") === o.v}
                    className="mt-1 accent-utah"
                  />
                  <span>
                    <span className="block font-medium">{o.t}</span>
                    <span className="block text-sm text-zinc-600">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" className="w-full sm:w-auto">
            {part ? "Save" : "Join hackathon"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
