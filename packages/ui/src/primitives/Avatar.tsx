import React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface AvatarProps extends AvatarPrimitive.AvatarProps {
  src?: string | null | undefined;
  name?: string | undefined;
  size?: ("xs" | "sm" | "md" | "lg" | "xl") | undefined;
  presence?: ("online" | "idle" | "dnd" | "offline") | undefined;
}

export function Avatar({ src, name, size = "md", presence, className, ...props }: AvatarProps) {
  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
    xl: "h-12 w-12 text-lg",
  };

  const presenceDotSize = {
    xs: "h-1.5 w-1.5 ring-1",
    sm: "h-2 w-2 ring-1",
    md: "h-2.5 w-2.5 ring-2",
    lg: "h-3 w-3 ring-2",
    xl: "h-3.5 w-3.5 ring-2",
  };

  const presenceColors = {
    online: "bg-emerald-500",
    idle: "bg-amber-500",
    dnd: "bg-rose-500",
    offline: "bg-slate-400 dark:bg-slate-600",
  };

  const initials = (name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative inline-block shrink-0">
      <AvatarPrimitive.Root
        className={twMerge(
          clsx(
            "relative flex shrink-0 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-muted)] items-center justify-center font-medium text-[var(--fg-secondary)] select-none",
            sizeClasses[size],
            className,
          ),
        )}
        {...props}
      >
        {src ? (
          <AvatarPrimitive.Image src={src} alt={name ?? "Avatar"} className="h-full w-full object-cover" />
        ) : null}
        <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center bg-[var(--bg-subtle)] font-semibold text-[var(--fg-secondary)]">
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {presence ? (
        <span
          className={twMerge(
            clsx(
              "absolute bottom-0 right-0 rounded-full ring-[var(--bg-surface)]",
              presenceDotSize[size],
              presenceColors[presence],
            ),
          )}
        />
      ) : null}
    </div>
  );
}