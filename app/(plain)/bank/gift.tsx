"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { giftHours } from "@/app/actions/wallet";
import { Button } from "@/ui/button";
import { signAction } from "@/ui/device";
import { Field, FormError, Input, Select } from "@/ui/field";

/** Gifting moves hours, so it's signed by this device: {action: gift_hours, to, amountMin, ts}. */
export function GiftForm({ max, community: c0 = false }: { max: number; community?: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [community, setCommunity] = useState(c0);
  const [amount, setAmount] = useState(30);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          setMsg(null);
          const target = community ? "community" : to.trim().replace(/^@/, "");
          const { payload, signature } = await signAction("gift_hours", { to: target, amountMin: amount });
          const res = await giftHours({ to: target, amountMin: amount, payload, signature });
          if (!res.ok) return setError(res.error);
          setMsg("Sent. It's on the ledger.");
          setTo("");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="To" htmlFor="gift-to">
          {community ? (
            <Input id="gift-to" value="Community pool" disabled />
          ) : (
            <Input
              id="gift-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="@handle"
              required
            />
          )}
        </Field>
        <Field label="Amount" htmlFor="gift-amount">
          <Select id="gift-amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
            {[15, 30, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? " 30 min" : ""}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-body text-ink-soft">
        <input
          type="checkbox"
          className="size-4 accent-[var(--ink)]"
          checked={community}
          onChange={(e) => setCommunity(e.target.checked)}
        />
        Donate to the community pool for new members
      </label>
      <FormError message={error} />
      {msg ? <p className="text-meta text-ok">{msg}</p> : null}
      {/* Gold only once there is someone (or the pond) to give to. */}
      <Button
        type="submit"
        variant={community || to.trim() ? "primary" : "secondary"}
        className="justify-self-start"
        disabled={pending || amount > max + 120 || (!community && !to.trim())}
      >
        {pending ? "Signing…" : community ? "Give to the pond" : "Gift hours"}
      </Button>
    </form>
  );
}
