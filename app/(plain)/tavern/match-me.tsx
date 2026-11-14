"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { matchMe } from "@/app/actions/matching";

export function MatchMeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-tertiary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await matchMe();
          router.refresh();
        })
      }
    >
      {pending ? "Looking…" : "Find tables"}
    </button>
  );
}
