"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getChallenge, signIn } from "@/app/actions/identity";
import { publicKeyB64, signText } from "./device";

/**
 * No sign-up wall: on first visit the browser makes a device key, signs a server challenge with it, and gets a
 * session cookie. A new key becomes a guest member with 2 starter hours already on the ledger.
 */
export function GuestBootstrap({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasSession || started.current) return;
    started.current = true;
    setState("working");
    (async () => {
      try {
        const [publicKey, issued] = await Promise.all([publicKeyB64(), getChallenge()]);
        if (!issued.ok) throw new Error(issued.error);
        const challenge = issued.data;
        const res = await signIn({
          publicKey,
          challenge,
          signature: await signText(challenge),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Couldn't create a device key in this browser.");
      }
    })();
  }, [hasSession, router]);

  if (hasSession || state === "idle") return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-3"
    >
      <p className="panel px-3 py-2 text-meta text-ink-soft">
        {state === "working" ? "Creating your guest identity on this device…" : `Couldn't sign in: ${error}`}
      </p>
    </div>
  );
}
