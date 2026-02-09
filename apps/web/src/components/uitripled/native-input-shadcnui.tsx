"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type InputProps = ComponentProps<"input">;

export interface NativeInputProps extends InputProps {
  /** Enable animated glow on focus */
  glow?: boolean;
}

const NativeInput = ({
  className,
  glow = true,
  onFocus,
  onBlur,
  type,
  ...props
}: NativeInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isPassword = type === "password";

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <motion.div
      animate={
        shouldReduceMotion
          ? {}
          : {
              boxShadow: isFocused
                ? "0 0 20px oklch(0.75 0.15 250 / 0.15), 0 0 6px oklch(0.75 0.15 250 / 0.1)"
                : "0 0 0px oklch(0.75 0.15 250 / 0)",
            }
      }
      className="relative rounded-lg"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <input
        className={cn(
          "flex h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground",
          "border-[oklch(1_0_0/0.15)]",
          "focus:border-[oklch(0.75_0.15_250/0.5)] focus:ring-1 focus:ring-[oklch(0.75_0.15_250/0.3)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isPassword && "pr-10",
          className
        )}
        onBlur={handleBlur}
        onFocus={handleFocus}
        type={isPassword && showPassword ? "text" : type}
        {...props}
      />
      {isPassword && (
        <motion.button
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence initial={false} mode="wait">
            {showPassword ? (
              <motion.span
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                initial={{ opacity: 0, rotate: -90 }}
                key="eye-off"
                transition={{ duration: 0.15 }}
              >
                <EyeOff className="h-4 w-4" />
              </motion.span>
            ) : (
              <motion.span
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                initial={{ opacity: 0, rotate: -90 }}
                key="eye"
                transition={{ duration: 0.15 }}
              >
                <Eye className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </motion.div>
  );
};

NativeInput.displayName = "NativeInput";

export { NativeInput };
