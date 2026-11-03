import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={twMerge(
          clsx(
            "z-50 w-72 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[var(--fg-primary)] shadow-md outline-none animate-in fade-in-0 zoom-in-95",
            className,
          ),
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}