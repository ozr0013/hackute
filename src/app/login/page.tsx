import { Card, Alert } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          HackMatch is for University of Utah students. We&apos;ll email you a magic link, no password needed.
        </p>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <Card>
        <LoginForm next={safeNext} />
      </Card>
    </div>
  );
}
