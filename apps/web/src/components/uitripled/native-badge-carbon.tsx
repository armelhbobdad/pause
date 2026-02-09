"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLMotionProps, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 font-medium text-xs transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-primary/10 text-primary hover:border-primary/40 hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(var(--primary),0.1)]",
        neutral:
          "border border-border/40 bg-card/50 text-muted-foreground backdrop-blur-sm hover:border-border/80 hover:bg-card/80 hover:text-foreground",
        outline:
          "border border-input bg-background/50 text-foreground backdrop-blur-sm hover:bg-accent hover:text-accent-foreground",
        glass:
          "border border-white/20 bg-white/10 text-foreground shadow-sm backdrop-blur-md hover:bg-white/20 dark:border-white/10 dark:bg-black/10 dark:hover:bg-black/20",
        glow: "border border-primary/20 bg-primary/10 text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)] hover:scale-[1.02] hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(var(--primary),0.4)]",
        animated:
          "group gap-2 border border-border/60 bg-card/70 text-muted-foreground uppercase tracking-widest backdrop-blur transition-colors duration-300 hover:border-primary/60 hover:bg-primary/15 hover:text-primary",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface NativeBadgeProps
  extends Omit<HTMLMotionProps<"div">, "ref" | "children">,
    VariantProps<typeof badgeVariants> {
  /**
   * Whether to animate the badge on mount.
   * Default: true
   */
  animate?: boolean;
  /**
   * Optional label for the animated variant's secondary tag (e.g., "new", "beta").
   * Only applies when variant="animated".
   */
  tag?: string;
  /**
   * Optional icon for the animated variant. Defaults to Sparkles.
   * Only applies when variant="animated".
   */
  icon?: React.ReactNode;
  /**
   * Badge content.
   */
  children?: React.ReactNode;
}

function NativeBadge({
  className,
  variant,
  size,
  animate = true,
  tag = "new",
  icon,
  children,
  ...props
}: NativeBadgeProps) {
  const isAnimated = variant === "animated";
  const IconElement = icon ?? <Sparkles className="h-3 w-3 text-primary" />;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn(badgeVariants({ variant, size }), className)}
      initial={animate ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {isAnimated && (
        <motion.span
          animate={{ rotate: [0, 15, -15, 0], opacity: [0.6, 1, 0.6] }}
          aria-hidden
          className="inline-block"
          transition={{
            duration: 2.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          {IconElement}
        </motion.span>
      )}
      {children}
      {isAnimated && tag && (
        <span className="rounded-full border border-border/40 bg-white/5 px-2 py-0.5 text-[0.6rem] text-muted-foreground transition-colors duration-300 group-hover:border-primary/60 group-hover:bg-primary/25 group-hover:text-primary">
          {tag}
        </span>
      )}
    </motion.div>
  );
}

export { badgeVariants, NativeBadge };
