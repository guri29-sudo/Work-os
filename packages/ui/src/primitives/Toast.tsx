import React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({ className, ...props }: ToastPrimitive.ToastViewportProps) {
  return (
    <ToastPrimitive.Viewport
      className={twMerge(
        clsx(
          "fixed bottom-0 right-0 z-100 flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[380px]",
          className,
        ),
      )}
      {...props}
    />
  );
}

export function Toast({
  className,
  variant = "default",
  ...props
}: ToastPrimitive.ToastProps & { variant?: "default" | "danger" | "success" }) {
  const variants = {
    default: "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)]",
    danger: "border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--danger)]",
    success: "border-[var(--success)] bg-[var(--success-subtle)] text-[var(--success)]",
  };

  return (
    <ToastPrimitive.Root
      className={twMerge(
        clsx(
          "pointer-events-auto relative flex w-full items-center justify-between space-x-3 overflow-hidden rounded-[8px] border p-3.5 shadow-md transition-all animate-in slide-in-from-bottom-5",
          variants[variant],
          className,
        ),
      )}
      {...props}
    />
  );
}

export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
export const ToastClose = ToastPrimitive.Close;