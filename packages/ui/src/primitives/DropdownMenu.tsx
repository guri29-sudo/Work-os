import React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={twMerge(
          clsx(
            "z-50 min-w-44 overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 text-[var(--fg-primary)] shadow-md animate-in fade-in-0 zoom-in-95",
            className,
          ),
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: DropdownMenuPrimitive.DropdownMenuItemProps & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={twMerge(
        clsx(
          "relative flex cursor-pointer select-none items-center rounded-xs px-2.5 py-1.5 text-xs outline-none transition-colors hover:bg-[var(--bg-subtle)] focus:bg-[var(--bg-subtle)] disabled:pointer-events-none disabled:opacity-50",
          inset && "pl-8",
          className,
        ),
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: DropdownMenuPrimitive.DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      className={twMerge(clsx("-mx-1 my-1 h-px bg-[var(--border-subtle)]", className))}
      {...props}
    />
  );
}