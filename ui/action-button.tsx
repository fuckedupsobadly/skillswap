"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import type { Result } from "@/app/_lib/run";
import { Button, type ButtonVariant } from "./button";
import { FormError } from "./field";

/** A button that runs one server action, shows it is working, and says what went wrong in plain words. */
export function ActionButton<I, T>({
  action,
  input,
  children,
  variant = "secondary",
  size = "md",
  pendingLabel,
  then,
  className,
}: {
  action: (input: I) => Promise<Result<T>>;
  input: I;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  pendingLabel?: string;
  then?: string | ((data: T) => string | undefined);
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className ? `grid gap-2 ${className}` : "grid gap-2"}>
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await action(input);
            if (!res.ok) return setError(res.error);
            const next = typeof then === "function" ? then(res.data) : then;
            if (next) router.push(next);
            else router.refresh();
          })
        }
      >
        {pending ? (pendingLabel ?? "Working…") : children}
      </Button>
      <FormError message={error} />
    </div>
  );
}
