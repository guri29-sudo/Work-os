import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "accent" | "danger" | "success";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-[var(--bg-muted)] text-[var(--fg-secondary)] border-transparent",
    secondary: "bg-[var(--bg-subtle)] text-[var(--fg-muted)] border-[var(--border-subtle)]",
    outline: "border-[var(--border-strong)] text-[var(--fg-secondary)]",
    accent: "bg-[var(--accent-subtle)] text-[var(--accent)] border-transparent font-medium",
    danger: "bg-[var(--danger-subtle)] text-[var(--danger)] border-transparent",
    success: "bg-[var(--success-subtle)] text-[var(--success)] border-transparent",
  };

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors select-none",
          variants[variant],
          className,
        ),
      )}
      {...props}
    />
  );
}