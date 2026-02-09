"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// NativeDialog — Glassmorphism-styled dialog
// Adapted from uitripled NativeDialog for Base UI dialog primitives
// Features: backdrop blur, frosted glass surface, smooth CSS animations
// ============================================================================

function NativeDialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

function NativeDialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger {...props} />;
}

function NativeDialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close {...props} />;
}

function NativeDialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & { children?: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0",
          "data-open:fade-in-0 data-open:animate-in",
          "data-closed:fade-out-0 data-closed:animate-out",
          "duration-200"
        )}
        style={{
          zIndex: "var(--z-overlay, 200)",
          background: "oklch(0 0 0 / 50%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <DialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 outline-none",
          "max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overflow-x-hidden",
          "rounded-2xl border p-6",
          "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in",
          "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out",
          "duration-300",
          className
        )}
        style={{
          zIndex: "var(--z-overlay, 200)",
          background: "oklch(0.14 0.01 250 / 85%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor: "var(--pause-border-modal, oklch(1 0 0 / 20%))",
          boxShadow:
            "0 8px 40px oklch(0 0 0 / 0.5), 0 0 80px oklch(0.75 0.15 250 / 0.06)",
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute top-4 right-4 rounded-full p-1.5",
            "opacity-70 transition-all hover:opacity-100",
            "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function NativeDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />
  );
}

function NativeDialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("font-semibold text-base", className)}
      {...props}
    />
  );
}

function NativeDialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function NativeDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export {
  NativeDialog,
  NativeDialogClose,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogFooter,
  NativeDialogHeader,
  NativeDialogTitle,
  NativeDialogTrigger,
};
