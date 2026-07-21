const COMBINING_MARKS = /[̀-ͯ]/g;

/** Slugify an organization name for the public onboarding URL (RF17). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Short random suffix to disambiguate a taken slug. */
export function randomSuffix(len = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}
