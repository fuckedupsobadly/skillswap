"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adopt } from "@/app/actions/game";
import { decode, describe as describeGenome, rareGenes } from "@/modules/game/genome";
import { Button } from "../button";
import { cn } from "../cn";
import { FormError, Input } from "../field";
import { KittyPreview } from "./preview";
import { pokeKitty } from "./store";

const SUGGESTIONS = ["Miso", "Pip", "Mochi", "Nori", "Biscuit", "Clover", "Juniper", "Tofu"];

/** Pick one of three one-of-a-kind kittens and name it. Choosing is what builds the attachment. */
export function AdoptForm({
  candidates,
  next = "/kitty",
  onDone,
}: {
  candidates: string[];
  next?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const picked = choice !== null;

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice === null) return;
        start(async () => {
          setError(null);
          const res = await adopt({ choice, name });
          if (!res.ok) return setError(res.error);
          pokeKitty();
          if (onDone) onDone();
          else router.push(next);
        });
      }}
    >
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Choose a kitten</legend>
        {candidates.map((code, i) => {
          const g = decode(code);
          const rare = rareGenes(g);
          const on = choice === i;
          return (
            <label
              key={code}
              data-perch=""
              // A kitten is a clickable choice, so it gets a card frame; the chosen one is pressed paper-shade.
              className={cn(
                "card grid cursor-pointer content-start justify-items-center gap-2 px-3 py-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                on && "btn-pressed",
              )}
            >
              <input
                type="radio"
                name="kitten"
                className="sr-only"
                checked={on}
                onChange={() => setChoice(i)}
              />
              <KittyPreview code={code} label={describeGenome(g)} scale={3} />
              <span className="text-center text-meta">{describeGenome(g)}</span>
              {rare.length ? (
                <span className="bg-paper-shade px-2 text-meta font-semibold">{rare.join(", ")}</span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <div className={cn("grid gap-3", picked ? "" : "pointer-events-none")} aria-disabled={!picked}>
        <label htmlFor="kitty-name" className="field-label">
          {picked ? "Name your kitten" : "Pick a kitten first, then name it"}
        </label>
        <Input
          id="kitty-name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          placeholder="Up to 16 characters"
          disabled={!picked}
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!picked}
              onClick={() => setName(s)}
              className="btn btn-tertiary px-2 font-sans text-body disabled:opacity-45"
            >
              {s}
            </button>
          ))}
        </div>
        <FormError message={error} />
        {/* Gold only once it can really happen: a kitten chosen and named. */}
        <Button
          type="submit"
          variant={picked && name.trim() ? "primary" : "secondary"}
          className="justify-self-start"
          disabled={pending || !picked || !name.trim()}
        >
          {pending ? "Adopting…" : name.trim() ? `Adopt ${name.trim()}` : "Adopt"}
        </Button>
        <p className="text-meta text-ink-soft">
          Every kitty is one of a kind. The other two kittens go back to the litter.
        </p>
      </div>
    </form>
  );
}
