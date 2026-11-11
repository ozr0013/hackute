// Pure match scoring. Score is 0 to 100.

export const MATCH_WEIGHTS = {
  sameTrack: 30,
  skillComplement: 40,
  sharedInterests: 20,
  differentYear: 10,
} as const;

export type MatchSide = {
  track?: string | null;
  skills: string[];
  interests: string[];
  /** a single year, or the set of years on a team */
  years?: (string | null | undefined)[];
};

const norm = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase()).filter(Boolean));

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * How well `candidate` fits with `other` (a person or an aggregated team).
 *
 * Skill complement: if `needs` is given (a team's roles_needed), it's the share of those
 * needs the candidate covers. Otherwise it's the share of the candidate's skills that the
 * other side is missing.
 */
export function matchScore(candidate: MatchSide, other: MatchSide, needs: string[] = []): number {
  const w = MATCH_WEIGHTS;
  let score = 0;

  if (candidate.track && other.track && candidate.track === other.track) {
    score += w.sameTrack;
  }

  const candSkills = norm(candidate.skills);
  const needSet = norm(needs);
  let complement = 0;
  if (needSet.size > 0) {
    let covered = 0;
    for (const n of needSet) if (candSkills.has(n)) covered++;
    complement = covered / needSet.size;
  } else if (candSkills.size > 0) {
    const otherSkills = norm(other.skills);
    let fresh = 0;
    for (const s of candSkills) if (!otherSkills.has(s)) fresh++;
    complement = fresh / candSkills.size;
  }
  score += w.skillComplement * complement;

  score += w.sharedInterests * jaccard(norm(candidate.interests), norm(other.interests));

  const candYears = (candidate.years ?? []).filter(Boolean);
  const otherYears = (other.years ?? []).filter(Boolean);
  if (candYears.length && otherYears.length && candYears.some((y) => !otherYears.includes(y))) {
    score += w.differentYear;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
