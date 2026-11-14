"use client";
import { useState } from "react";
import { computeHash, type LedgerEntry } from "@/modules/ledger/core";
import { Button } from "@/ui/button";

export function VerifyEntry({ entry }: { entry: LedgerEntry }) {
  const [state, setState] = useState<null | boolean>(null);
  return (
    <div className="grid gap-2">
      <Button
        onClick={async () => {
          const { hash, prevHash, ...body } = entry;
          setState((await computeHash(prevHash, body)) === hash);
        }}
      >
        Recompute this hash in my browser
      </Button>
      {state === null ? null : state ? (
        <p className="text-meta text-ok">Matches. This entry hasn't been changed since it was written.</p>
      ) : (
        <p className="text-meta text-danger">Does not match. This entry was altered.</p>
      )}
    </div>
  );
}
