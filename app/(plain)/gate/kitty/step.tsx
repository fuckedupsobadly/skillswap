"use client";
import { setOnboardingStep } from "@/app/actions/village";
import { AdoptForm } from "@/ui/kitty/adopt-form";
import { useToWorld } from "@/ui/to-world";
import { Dots } from "../../board/parts";

export function KittyStep({ candidates, hasKitty }: { candidates: string[]; hasKitty: boolean }) {
  const toWorld = useToWorld();
  const next = async () => {
    await setOnboardingStep({ step: 4 });
    // back to the world: the walk to the Well is step 4
    toWorld();
  };
  return (
    <div className="grid gap-5">
      <Dots step={3} />
      {hasKitty ? (
        <button type="button" className="btn btn-primary justify-self-start" onClick={next}>
          Continue
        </button>
      ) : (
        <AdoptForm candidates={candidates} onDone={next} />
      )}
      {!hasKitty ? (
        <button type="button" className="btn btn-tertiary justify-self-start" onClick={next}>
          Adopt later
        </button>
      ) : null}
    </div>
  );
}
