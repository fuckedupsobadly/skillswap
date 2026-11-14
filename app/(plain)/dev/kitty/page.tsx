import type { Metadata } from "next";
import { ITEMS } from "@/modules/game/catalog";
import { BODIES, COATS, EARS, EYES, encode, MARKINGS, PATTERNS, SHADES, TAILS } from "@/modules/game/genome";
import { ANIM_NAMES, ANIMS, FRAMES_PER_STAGE } from "@/modules/game/rig/anim";
import { Page, Section } from "@/ui/bits";
import { KittyPreview } from "@/ui/kitty/preview";

export const metadata: Metadata = { title: "Kitty art sheet", robots: { index: false } };

/** Internal art sheet: every gene, animation and item side by side, so art problems show before release. */
const base = { coat: 0, pattern: 1, layout: 0, markings: 5, eyes: 0, ears: 0, tail: 0, body: 1, shade: 1 };
const code = (patch: Partial<typeof base>) => encode({ ...base, ...patch });

function Row({
  title,
  cells,
}: {
  title: string;
  cells: {
    label: string;
    code: string;
    anim?: (typeof ANIM_NAMES)[number];
    stage?: "kitten" | "young" | "adult";
    equipped?: Record<string, string>;
    still?: boolean;
  }[];
}) {
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-3">
        {cells.map((c) => (
          <figure
            key={c.label + c.code}
            className="grid justify-items-center gap-1 border-2 border-paper-shade p-2"
          >
            <KittyPreview
              code={c.code}
              stage={c.stage}
              anim={c.anim}
              equipped={c.equipped}
              still={c.still ?? !c.anim}
              scale={2}
              label={c.label}
            />
            <figcaption className="max-w-24 text-center text-meta text-ink-soft">{c.label}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

export default function KittySheet() {
  return (
    <Page
      title="Kitty art sheet"
      sub={`One parametric rig: ${ANIM_NAMES.length} animations, ${FRAMES_PER_STAGE} frames per growth stage, ${ITEMS.length} items.`}
    >
      <Row title="Coats" cells={COATS.map((n, coat) => ({ label: n, code: code({ coat }) }))} />
      <Row
        title="Patterns"
        cells={PATTERNS.map((n, pattern) => ({
          label: n,
          code: code({ pattern, markings: pattern === 3 ? 5 : 0, coat: pattern >= 5 ? 4 : 0 }),
        }))}
      />
      <Row
        title="White markings"
        cells={MARKINGS.map((n, markings) => ({ label: n, code: code({ markings, pattern: 0, coat: 5 }) }))}
      />
      <Row title="Eyes" cells={EYES.map((n, eyes) => ({ label: n, code: code({ eyes }) }))} />
      <Row
        title="Ears, tail, body, shade"
        cells={[
          ...EARS.map((n, ears) => ({ label: `${n} ears`, code: code({ ears }) })),
          ...TAILS.map((n, tail) => ({ label: `${n} tail`, code: code({ tail }), anim: "walk" as const })),
          ...BODIES.map((n, body) => ({ label: n, code: code({ body }) })),
          ...SHADES.map((n, shade) => ({ label: `${n} shade`, code: code({ shade, coat: 1 }) })),
        ]}
      />
      <Row
        title="Growth stages"
        cells={(["kitten", "young", "adult"] as const).flatMap((stage) => [
          { label: `${stage} sitting`, code: code({}), stage, anim: "idle" as const },
          { label: `${stage} walking`, code: code({}), stage, anim: "walk" as const },
        ])}
      />
      <Row
        title="Animations"
        cells={ANIM_NAMES.map((anim) => ({
          label: `${anim} (${ANIMS[anim].frames.length})`,
          code: code({}),
          anim,
        }))}
      />
      <Row
        title="Items"
        cells={ITEMS.filter((i) => !["room", "bed", "toy"].includes(i.slot)).flatMap((i) => [
          {
            label: i.name,
            code: code({}),
            equipped: { [i.slot]: i.id },
            anim: i.slot === "tail" ? ("tailFlick" as const) : ("idle" as const),
          },
          {
            label: `${i.name}, walking`,
            code: code({}),
            equipped: { [i.slot]: i.id },
            anim: "walk" as const,
          },
        ])}
      />
    </Page>
  );
}
