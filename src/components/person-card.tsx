import { Badge, Card, MatchBadge, Tags } from "@/components/ui/card";
import type { Contact, PublicProfile } from "@/lib/types";

export function PersonCard({
  person,
  score,
  track,
  contact,
  children,
}: {
  person: PublicProfile;
  score?: number;
  track?: string | null;
  contact?: Contact | null;
  children?: React.ReactNode;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{person.full_name}</p>
          <p className="text-sm text-zinc-600">
            {[person.year, person.major].filter(Boolean).join(" · ")}
          </p>
        </div>
        {score !== undefined && <MatchBadge score={score} />}
      </div>
      {track && (
        <p className="text-xs text-zinc-500">
          Track: <span className="font-medium text-zinc-700">{track}</span>
        </p>
      )}
      {person.bio && <p className="text-sm text-zinc-700">{person.bio}</p>}
      <Tags items={person.skills} tone="utah" />
      <Tags items={person.interests} tone="muted" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {person.github_url && (
          <a href={person.github_url} target="_blank" rel="noreferrer" className="text-utah hover:underline">
            GitHub
          </a>
        )}
        {person.linkedin_url && (
          <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="text-utah hover:underline">
            LinkedIn
          </a>
        )}
      </div>
      {contact && (
        <div className="rounded-lg bg-zinc-50 p-2 text-sm">
          <Badge tone="green" className="mb-1">
            Contact
          </Badge>
          <p className="break-all">
            <a href={`mailto:${contact.email}`} className="text-utah hover:underline">
              {contact.email}
            </a>
          </p>
          {contact.discord && <p>Discord: {contact.discord}</p>}
        </div>
      )}
      {children}
    </Card>
  );
}
