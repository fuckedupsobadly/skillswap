"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postRequest } from "@/app/actions/market";
import type { ParsedRequest } from "@/modules/ai/concierge";
import { levelName } from "@/modules/platform/format";
import { Card } from "@/ui/bits";
import { Button } from "@/ui/button";
import { FormError, Input } from "@/ui/field";

type DraftOutput = { draft: ParsedRequest; text: string; requiresApproval: true };

export function ConciergeChat() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/v1/ai/chat" }),
  });
  const [input, setInput] = useState("");
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3" aria-live="polite">
        {messages.length === 0 ? (
          <li className="text-body text-ink-soft">
            Try: “I'm nervous presenting at work — who could help?” or “Draft a request for beginner Spanish.”
          </li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className={`grid gap-2 ${m.role === "user" ? "justify-items-end" : ""}`}>
            <span className="text-meta text-ink-soft">{m.role === "user" ? "You" : "Concierge (AI)"}</span>
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p
                    key={i}
                    className={`max-w-[90%] px-3 py-2 text-body whitespace-pre-wrap ${m.role === "user" ? "bg-paper-shade" : "border-2 border-paper-shade"}`}
                  >
                    {part.text}
                  </p>
                );
              }
              if (part.type === "tool-draft_request" && part.state === "output-available") {
                return <DraftCard key={i} output={part.output as DraftOutput} />;
              }
              if (part.type.startsWith("tool-") && "state" in part && part.state !== "output-available") {
                return (
                  <p key={i} className="text-meta text-ink-soft">
                    {part.type === "tool-search_skills"
                      ? "Searching skills…"
                      : part.type === "tool-find_matches"
                        ? "Finding matches…"
                        : "Drafting…"}
                  </p>
                );
              }
              return null;
            })}
          </li>
        ))}
      </ul>
      {error ? (
        <FormError
          message={error.message.includes("{") ? "The concierge couldn't answer. Try again." : error.message}
        />
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <label htmlFor="concierge-input" className="sr-only">
          Message the concierge
        </label>
        <Input
          id="concierge-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the concierge"
          disabled={status !== "ready"}
        />
        <Button type="submit" variant="primary" disabled={status !== "ready" || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

/** A proposal from the AI. It becomes real only when the member taps Approve. */
function DraftCard({ output }: { output: DraftOutput }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = output.draft;
  if (d.excluded) return <Card className="text-body text-ink-soft">{d.excluded}</Card>;
  if (!d.skill) return <Card className="text-body text-ink-soft">No matching skill in the catalog.</Card>;
  return (
    <Card className="grid w-full gap-3">
      <span className="text-meta text-ink-soft">Draft request · proposed by AI</span>
      <span className="text-body font-semibold">{d.skill.name}</span>
      <span className="text-meta text-ink-soft">
        {levelName(d.level)} · {d.lengthMin} min · live 1:1
      </span>
      <FormError message={error} />
      <Button
        variant="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await postRequest({
            skillId: d.skill!.id,
            level: d.level,
            format: "live",
            lengthMin: d.lengthMin,
            text: output.text,
            confidence: d.confidence,
            parsedBy: d.engine,
          });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          router.push(res.data.swaps ? "/tavern" : `/board?q=${encodeURIComponent(d.skill!.name)}`);
        }}
      >
        {busy ? "Posting…" : "Approve proposal"}
      </Button>
    </Card>
  );
}
