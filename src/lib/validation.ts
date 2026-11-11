import { z } from "zod";
import { YEARS } from "./types";

// utah.edu or any subdomain (umail.utah.edu, cs.utah.edu, ...)
export const UTAH_EMAIL_RE = /^[^@\s]+@([a-z0-9-]+\.)*utah\.edu$/i;
export const isUtahEmail = (email: string) => UTAH_EMAIL_RE.test(email.trim());

const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((xs) => Array.from(new Set(xs)));

const optionalUrl = (host: string) =>
  z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^https?:\/\//i.test(v), "Must start with https://")
    .refine((v) => v === null || v.toLowerCase().includes(host), `Must be a ${host} link`)
    .nullable();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  major: optionalText(100),
  year: z.enum(YEARS),
  skills: tagList,
  interests: tagList,
  bio: optionalText(300),
  github_url: optionalUrl("github.com"),
  linkedin_url: optionalUrl("linkedin.com"),
  discord: optionalText(64),
});

export const participationSchema = z.object({
  hackathon_id: z.uuid(),
  track: optionalText(80),
  mode: z.enum(["looking_for_team", "recruiting"]),
});

export const teamSchema = z.object({
  hackathon_id: z.uuid(),
  name: z.string().trim().min(1, "Team name is required").max(60),
  track: optionalText(80),
  description: optionalText(500),
  roles_needed: tagList,
  max_size: z.coerce.number().int().min(2).max(6),
});

export const messageSchema = optionalText(300);

export function firstError(err: z.ZodError) {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".");
  return field ? `${field.replace(/_/g, " ")}: ${issue.message}` : issue.message;
}
