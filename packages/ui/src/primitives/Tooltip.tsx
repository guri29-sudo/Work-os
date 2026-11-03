import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={twMerge(
          clsx(
            "z-50 overflow-hidden rounded-[4px] bg-[var(--fg-primary)] px-2.5 py-1 text-xs text-[var(--bg-surface)] shadow-sm animate-in fade-in-0 zoom-in-95",
            className,
          ),
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}