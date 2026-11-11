export const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad"] as const;
export type Year = (typeof YEARS)[number];

export type Mode = "looking_for_team" | "recruiting";

export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, major, year, skills, interests, bio, github_url, linkedin_url";

export type PublicProfile = {
  id: string;
  full_name: string;
  major: string | null;
  year: Year;
  skills: string[];
  interests: string[];
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
};

export type Hackathon = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  tracks: string[];
};

export type Participation = {
  user_id: string;
  hackathon_id: string;
  track: string | null;
  mode: Mode;
  available: boolean;
};

export type Team = {
  id: string;
  hackathon_id: string;
  owner_id: string;
  name: string;
  track: string | null;
  description: string | null;
  roles_needed: string[];
  max_size: number;
  created_at: string;
};

export type OpenTeam = Team & { member_count: number };

export type JoinRequest = {
  id: string;
  team_id: string;
  user_id: string;
  direction: "request" | "invite";
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type Contact = { email: string; discord: string | null };
