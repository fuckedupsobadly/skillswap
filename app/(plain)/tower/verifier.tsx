"use client";
import { useEffect, useRef, useState } from "react";
import {
  type ChainResult,
  GENESIS_HASH,
  type LedgerEntry,
  replay,
  sumBalances,
  verifyChain,
} from "@/modules/ledger/core";
import { Mono } from "@/ui/bits";
import { Button } from "@/ui/button";
import { Gear } from "@/ui/pixel/gears";

type Head = { seq: number; hash: string };
type Done = ChainResult & { headMatches: boolean; sumZero: boolean };

const CHUNK = 50;
const short = (h: string) => `${h.slice(0, 4)}…${h.slice(-4)}`;
const n = (x: number) => x.toLocaleString("en-US");

/**
 * Climbing the tower runs the audit (§8.6): the gears step once per verified chunk, and the final state is
 * plain text — "Ledger verified · 18,204 entries · head 9f3c…a71e". Nothing is taken on trust: this page
 * fetches the public ledger and recomputes every hash itself.
 */
export function Verifier({ serverHead }: { serverHead: Head }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [checked, setChecked] = useState(0);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Done | null>(null);
  const [tampered, setTampered] = useState<{ seq: number; result: ChainResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  async function climb() {
    setBusy(true);
    setResult(null);
    setTampered(null);
    setChecked(0);
    const all: LedgerEntry[] = [];
    let after = 0;
    let last: Head = { seq: 0, hash: GENESIS_HASH };
    let res: ChainResult = { ok: true, count: 0, head: GENESIS_HASH };
    for (;;) {
      const started = performance.now();
      const page = (await (await fetch(`/api/v1/ledger?after=${after}&limit=${CHUNK}`)).json()) as {
        entries: LedgerEntry[];
      };
      if (page.entries.length === 0) break;
      res = await verifyChain(page.entries, last);
      all.push(...page.entries);
      setChecked(all.length);
      if (!reduced.current) setTick((t) => t + 1);
      if (!res.ok) break;
      const tail = page.entries[page.entries.length - 1];
      last = { seq: tail.seq, hash: tail.hash };
      after = tail.seq;
      // one gear step is at least one 8 fps frame, so you can see each chunk land
      const spent = performance.now() - started;
      if (!reduced.current && spent < 120) await new Promise((r) => setTimeout(r, 120 - spent));
    }
    const head = (await (await fetch("/api/v1/ledger/head")).json()) as Head;
    setEntries(all);
    setResult({
      ...(res.ok ? { ...res, count: all.length } : res),
      headMatches: res.ok && last.hash === head.hash,
      sumZero: sumBalances(replay(all)) === 0,
    });
    setBusy(false);
  }

  async function tamper() {
    if (!entries?.length) return;
    const i = Math.floor(entries.length / 2);
    const copy = entries.map((e, j) => (j === i ? { ...e, amountMin: e.amountMin + 60 } : e));
    setTampered({ seq: entries[i].seq, result: await verifyChain(copy) });
  }

  const total = Math.max(serverHead.seq, checked);
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-6">
        <div className="relative h-[84px] w-[110px] shrink-0" aria-hidden>
          <Gear frame={tick} scale={4} className="absolute top-0 left-0" />
          <Gear frame={tick + 1} scale={2} className="absolute right-0 bottom-0" />
        </div>
        <div className="grid min-w-0 flex-1 gap-1" aria-live="polite">
          {busy ? (
            <>
              <p className="font-pixel text-label">Checking the gears</p>
              <p className="tnum text-body">
                {n(checked)} of {n(total)} entries
              </p>
              <div className="h-2 bg-paper-shade" aria-hidden>
                <div
                  className="h-full bg-ink"
                  style={{ width: `${total ? Math.min(100, (checked / total) * 100) : 0}%` }}
                />
              </div>
            </>
          ) : result ? (
            result.ok && result.headMatches && result.sumZero ? (
              <p className="tnum text-body font-medium text-ok">
                Ledger verified · {n(result.count)} entries · head {short(result.head)}
              </p>
            ) : result.ok ? (
              <p className="tnum text-body font-medium text-danger">
                Chain links hold, but{" "}
                {result.headMatches ? "balances don't sum to zero" : "the head differs from the server's"}.
              </p>
            ) : (
              <p className="tnum text-body font-medium text-danger">
                Ledger broken at entry #{result.brokenAt} · {result.reason}
              </p>
            )
          ) : (
            <p className="text-body">
              <span className="tnum">{n(serverHead.seq)}</span> entries, head{" "}
              <Mono className="text-body">{short(serverHead.hash)}</Mono>
            </p>
          )}
        </div>
      </div>

      {!busy ? (
        <div className="flex flex-wrap gap-3">
          <Button variant={result ? "secondary" : "primary"} onClick={climb}>
            {result ? "Check again" : "Climb the tower"}
          </Button>
          {result?.ok ? <Button onClick={tamper}>Tamper with a copy</Button> : null}
        </div>
      ) : null}

      {result?.ok ? (
        <ul className="grid gap-1 text-meta text-ink-soft">
          <li>
            {result.headMatches
              ? "Recomputed head matches the server's head."
              : "Recomputed head differs from the server's head."}
          </li>
          <li>
            {result.sumZero
              ? "Every account balances: all hours sum to exactly zero."
              : "Accounts do not sum to zero."}
          </li>
          <li>Every entry carries the hash of the one before it.</li>
        </ul>
      ) : null}

      {tampered ? (
        <div className="divider grid gap-1 pt-4" role="status">
          <p>Added 1 h to entry #{tampered.seq} in a copy held only by this page, then checked again:</p>
          <p className="font-medium text-danger">
            {tampered.result.ok
              ? "It still verified, which should never happen."
              : `Broken at entry #${tampered.result.brokenAt} · ${tampered.result.reason}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
