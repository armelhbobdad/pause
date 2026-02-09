"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

export interface NativeButtonProps extends ButtonProps {
  children: ReactNode;
  loading?: boolean;
  glow?: boolean;
}

const NativeButton = ({
  className,
  variant = "default",
  size = "lg",
  children,
  loading = false,
  glow = false,
  disabled,
  ...props
}: NativeButtonProps) => {
  const shouldReduceMotion = useReducedMotion();

  const buttonContent = (
    <>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <motion.span
        animate={
          loading
            ? { opacity: shouldReduceMotion ? 1 : [1, 0.5, 1] }
            : { opacity: 1 }
        }
        className={cn("flex items-center gap-2")}
        transition={
          loading && !shouldReduceMotion
            ? {
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
      >
        {children}
      </motion.span>
    </>
  );

  const glassmorphismClassName = cn(
    "relative h-12 cursor-pointer overflow-hidden rounded-md px-7 text-sm",
    !glow && "shadow-md hover:shadow-lg",
    glow &&
      "shadow-lg shadow-primary/20 transition-[box-shadow,background-color,color,opacity] duration-200 hover:shadow-primary/40",
    variant === "outline" && "text-foreground/80 hover:bg-foreground/5",
    (disabled || loading) && "cursor-not-allowed opacity-50 grayscale",
    className
  );

  return (
    <motion.div
      className={cn(
        "relative block",
        typeof className === "string" && className.includes("w-full")
          ? "w-full"
          : "w-fit"
      )}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      whileHover={
        disabled || loading || shouldReduceMotion ? {} : { scale: 1.02 }
      }
      whileTap={
        disabled || loading || shouldReduceMotion ? {} : { scale: 0.98 }
      }
    >
      {glow && !disabled && !loading && (
        <div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 blur-xl transition-opacity duration-500 hover:opacity-100" />
      )}
      <Button
        aria-busy={loading}
        className={glassmorphismClassName}
        disabled={disabled || loading}
        size={size}
        variant={variant}
        {...props}
      >
        {buttonContent}
      </Button>
    </motion.div>
  );
};

NativeButton.displayName = "NativeButton";

export { NativeButton };
