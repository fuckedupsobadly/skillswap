"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptProposal } from "@/app/actions/matching";
import { signAction } from "@/ui/device";
import { FormError } from "@/ui/field";

/** Accepting a seat holds hours, so this device signs {action: accept_cycle, cycleId, ts} first. */
export function AcceptSeat({ cycleId, accepted }: { cycleId: string; accepted: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (accepted)
    return <p className="text-ok">You've accepted your seat. Sessions are booked when everyone has.</p>;
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const { payload, signature } = await signAction("accept_cycle", { cycleId });
              const res = await acceptProposal({ cycleId, payload, signature });
              if (!res.ok) return setError(res.error);
              if (res.data.booked) router.push("/sessions");
              else router.refresh();
            })
          }
        >
          {pending ? "Signing…" : "Accept my seat"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          Not now
        </button>
      </div>
      <FormError message={error} />
    </div>
  );
}
