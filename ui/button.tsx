import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * §10.3 buttons. Primary: lantern fill, stepped corners, a 2 px bottom edge that disappears on press — and it is
 * the only lantern-gold control, used only when the action is really available. Secondary: paper with an ink
 * border. Tertiary: text only, underline on hover. All 44 px tall (§9 touch targets).
 */
const variants = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-tertiary",
  danger: "btn btn-secondary text-danger",
} as const;
const sizes = { md: "", sm: "", lg: "w-full" } as const;

export type ButtonVariant = keyof typeof variants;
export const buttonClass = (
  variant: ButtonVariant = "secondary",
  size: keyof typeof sizes = "md",
  className?: string,
) => cn(variants[variant], sizes[size], className);

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: keyof typeof sizes }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
