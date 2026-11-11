import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { formatRange } from "@/lib/utils";
import type { Hackathon } from "@/lib/types";

export default async function Home() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("hackathons")
    .select("*")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");
  const hackathons = (data ?? []) as Hackathon[];

  let joined = new Set<string>();
  if (user) {
    const { data: parts } = await supabase.from("participations").select("hackathon_id").eq("user_id", user.id);
    joined = new Set((parts ?? []).map((p: { hackathon_id: string }) => p.hackathon_id));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 pt-2">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Find your hackathon team at <span className="text-utah">the U</span>.
        </h1>
        <p className="text-zinc-600">
          Make a profile once, join a hackathon, then match with students whose skills complement yours or recruit
          the teammates you need.
        </p>
        {!user && (
          <ButtonLink href="/login" size="lg">
            Sign in with your utah.edu email
          </ButtonLink>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming hackathons</h2>
        {hackathons.length === 0 && <p className="text-sm text-zinc-500">No upcoming hackathons yet.</p>}
        {hackathons.map((h) => {
          const isIn = joined.has(h.id);
          return (
            <Card key={h.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/h/${h.slug}`} className="text-lg font-semibold hover:underline">
                    {h.name}
                  </Link>
                  <p className="text-sm text-zinc-600">
                    {formatRange(h.starts_at, h.ends_at)}
                    {h.location ? ` · ${h.location}` : ""}
                  </p>
                </div>
                {isIn && <Badge tone="green">Joined</Badge>}
              </div>
              {h.tracks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {h.tracks.map((t) => (
                    <Badge key={t} tone="muted">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <ButtonLink href={`/h/${h.slug}`} variant={isIn ? "default" : "outline"} size="sm">
                  {isIn ? "Open hub" : "Browse"}
                </ButtonLink>
                {!isIn && (
                  <ButtonLink href={`/h/${h.slug}/join`} size="sm">
                    Join
                  </ButtonLink>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
