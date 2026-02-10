"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { NativeButton } from "@/components/uitripled/native-button-shadcnui";
import { cn } from "@/lib/utils";

const chatTransport = new DefaultChatTransport({
  api: "/api/ai/knowledge",
});

interface FloatingChatWidgetProps {
  isAvailable?: boolean;
}

export function FloatingChatWidget({
  isAvailable = true,
}: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const widgetId = useId();
  const panelId = `${widgetId}-panel`;
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: chatTransport,
  });

  const isStreaming = status === "streaming";

  // Auto-scroll on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must trigger when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow animation to start
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Return focus to bubble trigger
    setTimeout(() => {
      bubbleRef.current?.focus();
    }, 200);
  }, []);

  const toggleOpen = useCallback(() => {
    if (isOpen) {
      closePanel();
    } else {
      setIsOpen(true);
    }
  }, [isOpen, closePanel]);

  // Escape key closes panel
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  // Focus trap: Tab cycles input → send → close → input
  const handleKeyDownInPanel = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") {
      return;
    }

    const sendButton =
      sendRef.current?.querySelector("button") ?? sendRef.current;
    const focusableElements = [
      inputRef.current,
      sendButton,
      closeRef.current,
    ].filter(Boolean) as HTMLElement[];

    if (focusableElements.length === 0) {
      return;
    }

    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement
    );

    if (e.shiftKey) {
      e.preventDefault();
      const prevIndex =
        currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
      focusableElements[prevIndex].focus();
    } else {
      e.preventDefault();
      const nextIndex =
        currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
      focusableElements[nextIndex].focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }
    sendMessage({ text });
    setInput("");
  };

  if (!isAvailable) {
    return null;
  }

  const panelAnimation = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }
    : {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: "spring" as const, damping: 25, stiffness: 300 },
        },
        exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } },
      };

  return (
    <div
      className="fixed right-6 bottom-6 z-[var(--z-float)] flex flex-col items-end gap-4 max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:items-stretch"
      style={{ zIndex: "var(--z-float)" }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate="visible"
            aria-label="Chat with Pause"
            className={cn(
              "overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl",
              "w-[360px] max-sm:h-[calc(100dvh-env(safe-area-inset-top))] max-sm:w-full max-sm:rounded-none max-sm:rounded-t-2xl"
            )}
            exit="exit"
            id={panelId}
            initial="hidden"
            key="chat-panel"
            onKeyDown={handleKeyDownInPanel}
            role="dialog"
            style={{
              borderColor: "var(--pause-border-elevated)",
              backgroundColor: "var(--background)",
            }}
            variants={panelAnimation}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b p-4"
              style={{ borderColor: "var(--pause-border-base)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Pause</h3>
                  <span className="text-muted-foreground text-xs">
                    Spending awareness companion
                  </span>
                </div>
              </div>
              <button
                aria-label="Close chat"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
                onClick={closePanel}
                ref={closeRef}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages area */}
            <div
              className="flex flex-col gap-3 overflow-y-auto p-4"
              style={{ height: "min(320px, 60dvh)" }}
            >
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    Ask me about spending patterns, how Pause works, or anything
                    about mindful purchasing.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "ml-8 self-end rounded-tr-none bg-primary text-primary-foreground"
                        : "mr-8 self-start rounded-tl-none bg-muted/50"
                    )}
                    key={message.id}
                  >
                    {message.parts?.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <Streamdown
                            isAnimating={
                              isStreaming && message.role === "assistant"
                            }
                            key={`${message.id}-${i}`}
                          >
                            {part.text}
                          </Streamdown>
                        );
                      }
                      return null;
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              className="border-t p-3"
              style={{ borderColor: "var(--pause-border-base)" }}
            >
              <form className="flex items-center gap-2" onSubmit={handleSubmit}>
                <input
                  aria-label="Message input"
                  autoComplete="off"
                  className="flex-1 rounded-full border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Pause anything..."
                  ref={inputRef}
                  style={{ borderColor: "var(--pause-border-base)" }}
                  type="text"
                  value={input}
                />
                <div ref={sendRef}>
                  <NativeButton
                    aria-label="Send message"
                    className="h-10 w-10 rounded-full p-0"
                    disabled={!input.trim() || isStreaming}
                    loading={isStreaming}
                    size="icon"
                    type="submit"
                  >
                    <Send className="h-4 w-4" />
                  </NativeButton>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat bubble trigger */}
      <motion.button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className={cn(
          "group relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-2xl transition-all",
          "max-sm:mb-[env(safe-area-inset-bottom)]",
          isOpen
            ? "bg-destructive text-destructive-foreground max-sm:hidden"
            : "text-primary-foreground hover:shadow-primary/25"
        )}
        id="tour-chat-bubble"
        onClick={toggleOpen}
        ref={bubbleRef}
        style={
          isOpen
            ? { transitionDuration: "var(--pause-transition-normal)" }
            : {
                transitionDuration: "var(--pause-transition-normal)",
                background:
                  "linear-gradient(135deg, var(--hero-gradient-start), var(--hero-gradient-end))",
              }
        }
        type="button"
        whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
        whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-20 blur-xl transition-opacity group-hover:opacity-40" />
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </motion.button>
    </div>
  );
}
