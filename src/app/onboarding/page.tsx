import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getTagOptions } from "@/lib/data";
import { ProfileForm } from "@/components/profile-form";
import { Card } from "@/components/ui/card";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { next } = await searchParams;
  const { skills, interests } = await getTagOptions(supabase);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="mt-1 text-sm text-zinc-600">
          You only do this once. Teams use it to find you. Signed in as {user.email}.
        </p>
      </div>
      <Card>
        <ProfileForm mode="create" skillOptions={skills} interestOptions={interests} next={next} />
      </Card>
    </div>
  );
}
