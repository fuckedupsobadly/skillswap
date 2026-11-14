"use client";
import { useState, useTransition } from "react";
import { blockMember, reportMember } from "@/app/actions/trust";
import { Button } from "@/ui/button";
import { FormError, Textarea } from "@/ui/field";

export function ReportBlock({ subjectId }: { subjectId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <p className="text-meta text-ink-soft">{msg}</p>;
  return (
    <div className="grid gap-2">
      {open ? (
        <>
          <label htmlFor="report-reason" className="text-meta font-semibold text-ink-soft">
            What happened?
          </label>
          <Textarea id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <FormError message={error} />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await reportMember({ subjectId, reason });
                  if (!r.ok) return setError(r.error);
                  setMsg("Thanks. A moderator will review this report.");
                })
              }
            >
              Send report
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await blockMember({ subjectId });
                setMsg(r.ok ? "Blocked. You won't be matched or booked with this member." : r.error);
              })
            }
          >
            Block
          </Button>
        </div>
      )}
    </div>
  );
}
