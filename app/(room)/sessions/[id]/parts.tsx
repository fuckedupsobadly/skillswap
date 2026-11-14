"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { confirm, sendMessage } from "@/app/actions/booking";
import { formatMinutes } from "@/modules/platform/format";
import { Button } from "@/ui/button";
import { signAction } from "@/ui/device";
import { FormError, Input, Textarea } from "@/ui/field";

export function Timer({ startedAt, lengthMin }: { startedAt: string | null; lengthMin: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt || now === null) return <span />;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="tabular-nums" aria-live="off">
      {mm}:{ss} of {formatMinutes(lengthMin)}
    </span>
  );
}

/** The confirm screen: summary, rating, short review → one signed confirmation. */
export function ConfirmForm({
  bookingId,
  otherName,
  role,
  lengthMin,
}: {
  bookingId: string;
  otherName: string;
  role: "teacher" | "learner";
  lengthMin: number;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const { payload, signature } = await signAction("confirm_session", { bookingId });
          const res = await confirm({ bookingId, rating, review, payload, signature });
          if (!res.ok) return setError(res.error);
          router.refresh();
        });
      }}
    >
      <p className="text-body text-ink-soft">
        {role === "learner"
          ? `Confirm that ${otherName} taught you for ${formatMinutes(lengthMin)}.`
          : `Confirm that you taught ${otherName} for ${formatMinutes(lengthMin)}.`}{" "}
        Hours move only when you both confirm.
      </p>
      <fieldset className="grid gap-1.5">
        <legend className="text-meta font-semibold text-ink-soft">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={n <= rating}
              onClick={() => setRating(n)}
              className={`h-10 w-10 border text-body ${n <= rating ? "border-ink text-ink" : "border-paper-shade text-ink-soft"}`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor="review" className="text-meta font-semibold text-ink-soft">
        Short review (optional)
      </label>
      <Textarea
        id="review"
        value={review}
        maxLength={500}
        onChange={(e) => setReview(e.target.value)}
        placeholder="What went well?"
      />
      <FormError message={error} />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Signing…" : "Confirm session"}
      </Button>
      <p className="text-meta text-ink-soft">
        Your device signs this confirmation. The signature is stored as evidence and shown on the receipt.
      </p>
    </form>
  );
}

export function Chat({
  bookingId,
  me,
  messages,
  names,
}: {
  bookingId: string;
  me: string;
  messages: { id: string; body: string; senderId: string; createdAt: string }[];
  names: Record<string, string>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      {messages.length ? (
        <ul className="grid max-h-64 gap-2 overflow-y-auto border-2 border-paper-shade p-3">
          {messages.map((m) => (
            <li key={m.id} className={`grid gap-0.5 ${m.senderId === me ? "justify-items-end" : ""}`}>
              <span className="text-meta text-ink-soft">{names[m.senderId] ?? "Member"}</span>
              <span
                className={`max-w-[85%] px-3 py-2 text-body ${m.senderId === me ? "bg-paper-shade" : "border-2 border-paper-shade"}`}
              >
                {m.body}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta text-ink-soft">
          Agree on what to cover. Messages are kept as evidence if a dispute is opened.
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          start(async () => {
            const res = await sendMessage({ bookingId, body });
            if (!res.ok) return setError(res.error);
            setBody("");
            setError(null);
            router.refresh();
          });
        }}
      >
        <label htmlFor="msg" className="sr-only">
          Message
        </label>
        <Input
          id="msg"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          maxLength={2000}
        />
        <Button type="submit" disabled={pending || !body.trim()}>
          Send
        </Button>
      </form>
      <FormError message={error} />
    </div>
  );
}
