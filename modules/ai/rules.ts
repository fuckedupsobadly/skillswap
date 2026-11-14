/**
 * Rule-based request parser — the concierge's offline engine. It is used whenever no AI model is configured,
 * and the UI says so. It never guesses a skill: the catalog search does that, with a confidence score.
 */
export type ParsedHints = {
  level: number;
  format: "live" | "group" | "in_person" | "async";
  lengthMin: 30 | 60 | 90 | 120;
  excluded: string | null;
};

/** Excluded everywhere: licensed professional advice, minors, driving, adults-only or illegal. */
const EXCLUSIONS: [RegExp, string][] = [
  [
    /\b(legal advice|lawyer|sue|lawsuit|immigration case|visa case)\b/i,
    "Legal advice is excluded. Try a skill like public speaking or writing instead.",
  ],
  [
    /\b(diagnos\w*|prescri\w*|medical advice|treat my|symptom\w*|medication)\b/i,
    "Medical advice is excluded on SkillSwap.",
  ],
  [
    /\b(therap(y|ist)|counsel+ing|depress\w*|anxiety treatment|trauma)\b/i,
    "Therapy isn't offered here. Mind and wellness covers yoga, meditation and breathing.",
  ],
  [
    /\b(invest(ing|ment)? advice|which stocks?|crypto picks?|financial advice|portfolio advice)\b/i,
    "Personal investment advice is excluded. Money basics covers budgeting and how credit works.",
  ],
  [
    /\b(child(ren)?care|babysit\w*|my (kid|son|daughter|child)|for kids|minor|under 18|teen(ager)?s?)\b/i,
    "Sessions involving minors are excluded. SkillSwap is for adults only.",
  ],
  [/\b(driving lessons?|learn to drive|give me a ride|rides?)\b/i, "Rides and driving lessons are excluded."],
  [
    /\b(gambl\w*|betting|casino|poker for money)\b/i,
    "Gambling is excluded. Games and hobbies covers chess, cards and puzzles.",
  ],
  [
    /\b(electrical wiring|gas line|gas leak|structural|rewire)\b/i,
    "Work that needs a license (electrical, gas, structural) is excluded.",
  ],
];

export function parseHints(text: string): ParsedHints {
  const t = text.toLowerCase();
  const excluded = EXCLUSIONS.find(([re]) => re.test(text))?.[1] ?? null;

  let level = 1;
  if (/\b(intermediate|improve|get better|level up|already know|some experience)\b/.test(t)) level = 3;
  if (/\b(advanced|expert|master|polish|fluent)\b/.test(t)) level = 4;
  if (/\b(a1|a2)\b/.test(t)) level = 1;
  if (/\b(b1|b2)\b/.test(t)) level = 3;
  if (/\b(c1|c2)\b/.test(t)) level = 4;
  if (/\b(beginner|basics|from scratch|never|first time|new to|absolute)\b/.test(t)) level = 1;

  let format: ParsedHints["format"] = "live";
  if (/\b(in person|in-person|face to face|meet up|nearby|at my place)\b/.test(t)) format = "in_person";
  else if (/\b(group|class with others|workshop)\b/.test(t)) format = "group";
  else if (/\b(review my|feedback on my|look at my|critique)\b/.test(t)) format = "async";

  let lengthMin: ParsedHints["lengthMin"] = 60;
  if (/\b(30 ?min|half an? hour|quick|short)\b/.test(t)) lengthMin = 30;
  if (/\b(90 ?min|hour and a half|1\.5 ?h)\b/.test(t)) lengthMin = 90;
  if (/\b(2 ?h(ours?)?|two hours)\b/.test(t)) lengthMin = 120;

  return { level, format, lengthMin, excluded };
}
