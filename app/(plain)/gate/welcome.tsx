"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setOnboardingStep, setPlainMode } from "@/app/actions/village";
import { Dots } from "../board/parts";

export function GateWelcome({ firstVisit }: { firstVisit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-5">
      {firstVisit ? <Dots step={1} /> : null}
      <p className="text-body">Welcome to the village. Teach an hour, learn an hour.</p>
      <div className="flex flex-wrap gap-2">
        {firstVisit ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setOnboardingStep({ step: 2 });
                router.replace("/gate/villager");
              })
            }
          >
            Enter
          </button>
        ) : (
          <Link href="/gate/villager" className="btn btn-secondary">
            Change your villager
          </Link>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setPlainMode({ on: true });
              if (firstVisit) await setOnboardingStep({ step: 99 });
              window.location.href = "/board";
            })
          }
        >
          Plain mode
        </button>
      </div>
      <dl className="divider grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-4 text-body">
        <dt className="font-pixel text-label">Walk</dt>
        <dd>WASD or arrows, or click the ground. Shift to run.</dd>
        <dt className="font-pixel text-label">E</dt>
        <dd>Talk, read or enter whatever is in front of you</dd>
        <dt className="font-pixel text-label">M</dt>
        <dd>The map: jump to any place</dd>
        <dt className="font-pixel text-label">/</dt>
        <dd>Search skills, members and places</dd>
        <dt className="font-pixel text-label">T</dt>
        <dd>Say something to people nearby</dd>
      </dl>
      <p className="text-meta text-ink-soft">
        Walking is optional. Plain mode has every place as an ordinary page.
      </p>
    </div>
  );
}
