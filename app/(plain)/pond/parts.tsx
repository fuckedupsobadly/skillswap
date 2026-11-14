"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askPool } from "@/app/actions/village";
import { FormError } from "@/ui/field";
import { village } from "@/ui/village/store";

export function AskPool({ eligible, reason }: { eligible: boolean; reason: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="text-ok">1 h is in your balance. Pass it on when you can.</p>;
  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        className={eligible ? "btn btn-primary" : "btn btn-secondary"}
        disabled={!eligible || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await askPool();
            if (!r.ok) return setError(r.error);
            setDone(true);
            village.command({ c: "reload" });
            router.refresh();
          })
        }
      >
        Ask the pool for 1 h
      </button>
      {!eligible ? <p className="text-meta text-ink-soft">{reason}</p> : null}
      <FormError message={error} />
    </div>
  );
}
