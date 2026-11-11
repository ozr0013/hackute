"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { firstError, profileSchema } from "@/lib/validation";
import { getAll, str } from "@/lib/utils";

export type FormState = { error?: string; ok?: boolean };

export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    full_name: str(fd, "full_name"),
    major: str(fd, "major"),
    year: str(fd, "year"),
    skills: getAll(fd, "skills"),
    interests: getAll(fd, "interests"),
    bio: str(fd, "bio"),
    github_url: str(fd, "github_url"),
    linkedin_url: str(fd, "linkedin_url"),
    discord: str(fd, "discord"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const isNew = str(fd, "mode") === "create";
  // No .select() after writes: email/discord aren't selectable by design.
  const { error } = isNew
    ? await supabase.from("profiles").insert({ id: user.id, ...parsed.data })
    : await supabase.from("profiles").update(parsed.data).eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  if (isNew) {
    const next = str(fd, "next");
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }
  return { ok: true };
}
