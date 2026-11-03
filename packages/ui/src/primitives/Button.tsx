import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors select-none rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

    const variants = {
      primary:
        "bg-[#6366f1] text-white hover:bg-[#4f46e5] dark:bg-[#818cf8] dark:hover:bg-[#6366f1] dark:text-[#090d16] shadow-sm",
      secondary:
        "bg-[var(--bg-subtle)] text-[var(--fg-primary)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)]",
      outline:
        "border border-[var(--border-strong)] text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]",
      ghost:
        "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-subtle)]",
      danger:
        "bg-[var(--danger)] text-white hover:opacity-90 shadow-sm",
    };

    const sizes = {
      xs: "text-xs h-6 px-2 gap-1",
      sm: "text-xs h-7 px-2.5 gap-1.5",
      md: "text-sm h-8 px-3.5 gap-2",
      lg: "text-base h-10 px-4 gap-2.5",
    };

    return (
      <Comp
        ref={ref}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";