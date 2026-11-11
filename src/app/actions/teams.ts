"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { firstError, messageSchema, participationSchema, teamSchema } from "@/lib/validation";
import { getAll, str, withMessage } from "@/lib/utils";

function backPath(fd: FormData, fallback = "/me") {
  const b = str(fd, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

function friendly(err: { code?: string; message: string }) {
  if (err.code === "23505") return "You already have a request or invite with this team.";
  if (err.code === "42501") return "You don't have permission to do that.";
  return err.message;
}

async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function done(path: string, notice: string): never {
  revalidatePath("/", "layout");
  redirect(withMessage(path, "notice", notice));
}

export async function joinHackathon(fd: FormData) {
  const { supabase, user } = await requireUser();
  const slug = str(fd, "slug");
  const back = `/h/${slug}/join`;

  const parsed = participationSchema.safeParse({
    hackathon_id: str(fd, "hackathon_id"),
    track: str(fd, "track"),
    mode: str(fd, "mode"),
  });
  if (!parsed.success) redirect(withMessage(back, "error", firstError(parsed.error)));

  const { data: existing } = await supabase
    .from("participations")
    .select("available")
    .eq("user_id", user.id)
    .eq("hackathon_id", parsed.data.hackathon_id)
    .maybeSingle();

  // Already on a team stays unavailable
  const available = existing ? existing.available : true;

  const { error } = await supabase
    .from("participations")
    .upsert({ user_id: user.id, ...parsed.data, available }, { onConflict: "user_id,hackathon_id" });
  if (error) redirect(withMessage(back, "error", friendly(error)));

  revalidatePath("/", "layout");
  if (parsed.data.mode === "recruiting" && available) {
    redirect(`/teams/new?h=${encodeURIComponent(slug)}`);
  }
  redirect(withMessage(`/h/${slug}`, "notice", "You're in! Start matching."));
}

export async function setAvailability(fd: FormData) {
  const { supabase, user } = await requireUser();
  const back = backPath(fd);
  const available = str(fd, "available") === "true";
  const { error } = await supabase
    .from("participations")
    .update({ available })
    .eq("user_id", user.id)
    .eq("hackathon_id", str(fd, "hackathon_id"));
  if (error) redirect(withMessage(back, "error", friendly(error)));
  done(back, available ? "You're visible in the People tab." : "You're hidden from the People tab.");
}

export async function createTeam(fd: FormData) {
  const { supabase } = await requireUser();
  const back = `/teams/new?h=${encodeURIComponent(str(fd, "slug"))}`;

  const parsed = teamSchema.safeParse({
    hackathon_id: str(fd, "hackathon_id"),
    name: str(fd, "name"),
    track: str(fd, "track"),
    description: str(fd, "description"),
    roles_needed: getAll(fd, "roles_needed"),
    max_size: str(fd, "max_size") || 4,
  });
  if (!parsed.success) redirect(withMessage(back, "error", firstError(parsed.error)));

  const { data, error } = await supabase.from("teams").insert(parsed.data).select("id").single();
  if (error) {
    const msg =
      error.code === "42501" ? "You're already on a team for this hackathon." : friendly(error);
    redirect(withMessage(back, "error", msg));
  }
  done(`/teams/${data.id}`, "Team created. It now shows in the Teams tab.");
}

export async function requestToJoin(fd: FormData) {
  const { supabase, user } = await requireUser();
  const back = backPath(fd);
  const teamId = z.uuid().safeParse(str(fd, "team_id"));
  const message = messageSchema.safeParse(str(fd, "message"));
  if (!teamId.success || !message.success) redirect(withMessage(back, "error", "Invalid request"));

  const { error } = await supabase.from("join_requests").insert({
    team_id: teamId.data,
    user_id: user.id,
    direction: "request",
    message: message.data,
  });
  if (error) redirect(withMessage(back, "error", friendly(error)));
  done(back, "Request sent. The team owner can now see your contact info.");
}

export async function inviteUser(fd: FormData) {
  const { supabase } = await requireUser();
  const back = backPath(fd);
  const ids = z.object({ team_id: z.uuid(), user_id: z.uuid() }).safeParse({
    team_id: str(fd, "team_id"),
    user_id: str(fd, "user_id"),
  });
  const message = messageSchema.safeParse(str(fd, "message"));
  if (!ids.success || !message.success) redirect(withMessage(back, "error", "Invalid invite"));

  const { error } = await supabase.from("join_requests").insert({
    ...ids.data,
    direction: "invite",
    message: message.data,
  });
  if (error) redirect(withMessage(back, "error", friendly(error)));
  done(back, "Invite sent.");
}

export async function acceptRequest(fd: FormData) {
  const { supabase } = await requireUser();
  const back = backPath(fd);
  const { error } = await supabase.rpc("accept_join_request", { p_request_id: str(fd, "id") });
  if (error) redirect(withMessage(back, "error", friendly(error)));
  done(back, "Accepted. Welcome to the team!");
}

export async function declineRequest(fd: FormData) {
  const { supabase } = await requireUser();
  const back = backPath(fd);
  const { error } = await supabase.rpc("decline_join_request", { p_request_id: str(fd, "id") });
  if (error) redirect(withMessage(back, "error", friendly(error)));
  done(back, "Declined.");
}
