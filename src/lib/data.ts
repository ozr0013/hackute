import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact, PublicProfile } from "./types";
import { PUBLIC_PROFILE_COLUMNS } from "./types";

export async function getTagOptions(supabase: SupabaseClient) {
  const { data } = await supabase.from("tag_options").select("kind, name").order("name");
  const rows = (data ?? []) as { kind: "skill" | "interest"; name: string }[];
  return {
    skills: rows.filter((r) => r.kind === "skill").map((r) => r.name),
    interests: rows.filter((r) => r.kind === "interest").map((r) => r.name),
  };
}

export async function getProfile(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", id).maybeSingle();
  return data as PublicProfile | null;
}

/** Returns contact info only when the DB says the viewer is allowed to see it. */
export async function getContact(supabase: SupabaseClient, userId: string): Promise<Contact | null> {
  const { data } = await supabase.rpc("get_contact", { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : null;
  return (row as Contact | undefined) ?? null;
}
