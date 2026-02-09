"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface NativeFlipTextProps {
  /**
   * Array of words to flip through.
   */
  words: string[];
  /**
   * Duration of each word display in ms.
   * Default: 2000
   */
  duration?: number;
  className?: string;
}

export function NativeFlipText({
  words,
  duration = 2000,
  className,
}: NativeFlipTextProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words.length, duration]);

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ rotateX: 0, opacity: 1, filter: "blur(0px)" }}
          className="text-center"
          exit={{ rotateX: 90, opacity: 0, filter: "blur(6px)" }}
          initial={{ rotateX: -90, opacity: 0, filter: "blur(6px)" }}
          key={words[index]}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 20,
            opacity: { duration: 0.3 },
            filter: { duration: 0.3 },
            rotateX: { duration: 0.4 },
          }}
        >
          {words[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
