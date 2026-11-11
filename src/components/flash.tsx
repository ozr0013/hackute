import { Alert } from "@/components/ui/card";

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return <div className="mb-4">{error ? <Alert kind="error">{error}</Alert> : <Alert kind="notice">{notice}</Alert>}</div>;
}

export type FlashParams = { error?: string; notice?: string };
