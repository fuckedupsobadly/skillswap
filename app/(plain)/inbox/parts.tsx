"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { readInbox, sendNote } from "@/app/actions/village";
import { FormError } from "@/ui/field";
import { village } from "@/ui/village/store";

/** Opening the mailbox clears the flag (after this visit has shown which notes were new). */
export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (!unread) return;
    const t = window.setTimeout(() => {
      void readInbox().then(() => village.command({ c: "reload" }));
    }, 800);
    return () => clearTimeout(t);
  }, [unread]);
  return null;
}

/** A note is 500 characters, delivered to a mailbox; it waits there until they're back. */
export function NoteForm({
  to: to0 = "",
  compact = false,
  onSent,
}: {
  to?: string;
  compact?: boolean;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [to, setTo] = useState(to0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const id = compact ? `reply-${to0}` : "note";
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await sendNote({ to: to.trim().replace(/^@/, ""), body });
          if (!r.ok) return setError(r.error);
          setBody("");
          setSent(true);
          onSent?.();
          router.refresh();
        });
      }}
    >
      {compact ? null : (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-to`} className="field-label">
            To
          </label>
          <input
            id={`${id}-to`}
            className="field"
            value={to}
            placeholder="@handle"
            required
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-body`} className={compact ? "sr-only" : "field-label"}>
          {compact ? `Reply to ${to0}` : "Note"}
        </label>
        <textarea
          id={`${id}-body`}
          className="field min-h-20 py-2.5"
          maxLength={500}
          value={body}
          required
          placeholder={compact ? "Write back" : "Hi! Could you show me three chords this week?"}
          onChange={(e) => {
            setSent(false);
            setBody(e.target.value);
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-secondary" disabled={pending || !body.trim() || !to.trim()}>
          {pending ? "Sending…" : compact ? "Send reply" : "Leave the note"}
        </button>
        <span className="tnum text-meta text-ink-soft">{500 - body.length}</span>
        {sent ? <span className="text-meta text-ok">Delivered to their mailbox.</span> : null}
      </div>
      <FormError message={error} />
    </form>
  );
}

export function Reply({ handle, name }: { handle: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn btn-tertiary -ml-2" onClick={() => setOpen(true)}>
        Reply to {name}
      </button>
    );
  return <NoteForm to={handle} compact onSent={() => setOpen(false)} />;
}
