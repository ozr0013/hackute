"use client";

import { useActionState } from "react";
import { saveProfile, type FormState } from "@/app/actions/profile";
import { TagPicker } from "@/components/tag-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { YEARS, type PublicProfile } from "@/lib/types";

export function ProfileForm({
  mode,
  profile,
  discord,
  skillOptions,
  interestOptions,
  next,
}: {
  mode: "create" | "edit";
  profile?: PublicProfile | null;
  discord?: string | null;
  skillOptions: string[];
  interestOptions: string[];
  next?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Full name" htmlFor="full_name">
        <Input id="full_name" name="full_name" required maxLength={100} defaultValue={profile?.full_name ?? ""} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Major" htmlFor="major">
          <Input id="major" name="major" maxLength={100} placeholder="Computer Science" defaultValue={profile?.major ?? ""} />
        </Field>
        <Field label="Year" htmlFor="year">
          <Select id="year" name="year" required defaultValue={profile?.year ?? ""}>
            <option value="" disabled>
              Select year
            </option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Skills">
        <TagPicker name="skills" options={skillOptions} defaultValue={profile?.skills ?? []} placeholder="Add a skill" />
      </Field>

      <Field label="Interests">
        <TagPicker
          name="interests"
          options={interestOptions}
          defaultValue={profile?.interests ?? []}
          placeholder="Add an interest"
        />
      </Field>

      <Field label="Bio" htmlFor="bio" hint="Max 300 characters">
        <Textarea id="bio" name="bio" maxLength={300} defaultValue={profile?.bio ?? ""} placeholder="What do you like to build?" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="GitHub URL" htmlFor="github_url">
          <Input id="github_url" name="github_url" type="url" inputMode="url" placeholder="https://github.com/you" defaultValue={profile?.github_url ?? ""} />
        </Field>
        <Field label="LinkedIn URL" htmlFor="linkedin_url">
          <Input id="linkedin_url" name="linkedin_url" type="url" inputMode="url" placeholder="https://linkedin.com/in/you" defaultValue={profile?.linkedin_url ?? ""} />
        </Field>
      </div>

      <Field label="Discord" htmlFor="discord" hint="Only shown to teammates and teams you have a pending request with">
        <Input id="discord" name="discord" maxLength={64} placeholder="username" defaultValue={discord ?? ""} />
      </Field>

      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="notice">Profile saved.</Alert>}

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving..." : mode === "create" ? "Create profile" : "Save profile"}
      </Button>
    </form>
  );
}
