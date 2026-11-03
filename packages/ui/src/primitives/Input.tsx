import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={twMerge(
          clsx(
            "w-full h-8 px-3 rounded-[6px] text-sm bg-[var(--bg-surface)] text-[var(--fg-primary)] placeholder-[var(--fg-subtle)] border transition-colors outline-none",
            error
              ? "border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/30"
              : "border-[var(--border-subtle)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          ),
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";