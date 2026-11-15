/**
 * First steps in the village (§11): seven short steps, every one skippable. One list feeds the progress row
 * on each sheet, the "First steps" card in the world and the guide, so the wording never drifts.
 */
export const FIRST_STEPS = [
  { n: 1, title: "Arrive at the Gate", short: "Arrive", how: "Read the welcome and step through the Gate." },
  {
    n: 2,
    title: "Make your villager",
    short: "Villager",
    how: "Pick a look and a name. You can change both later.",
  },
  { n: 3, title: "Pick a kitten", short: "Kitten", how: "Choose one of three kittens, or adopt one later." },
  {
    n: 4,
    title: "Walk to the Wishing Well",
    short: "Walk",
    how: "Follow the footprints up the path to the square, or open the map.",
  },
  {
    n: 5,
    title: "Make a wish",
    short: "Wish",
    how: "Tell the Well what you want to learn. It costs nothing.",
  },
  {
    n: 6,
    title: "Pick what you teach",
    short: "Teach",
    how: "Three taps on the Notice Board. Teaching is how you earn hours.",
  },
  {
    n: 7,
    title: "Light your lantern",
    short: "Lantern",
    how: "Your hut is in the lanes. A lit lantern tells people you're free now.",
  },
] as const;

export const FIRST_STEP_COUNT = FIRST_STEPS.length;
export const stepInfo = (n: number) => FIRST_STEPS.find((s) => s.n === n) ?? null;
