import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import type { ReactNode } from "react";
import { Streamdown } from "streamdown";
import { ToolPartsRenderer } from "@/components/guardian/tool-parts-renderer";

// ============================================================================
// MessageRenderer
// ============================================================================

export interface MessageRendererProps {
  messages: UIMessage[];
  isStreaming: boolean;
  guardianContent?: ReactNode;
  interactionId?: string | null;
  onRevealApproved?: () => void;
  onWait?: () => void;
}

export function MessageRenderer({
  messages,
  isStreaming,
  guardianContent,
  interactionId,
  onRevealApproved,
  onWait,
}: MessageRendererProps) {
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  if (assistantMessages.length === 0) {
    return <>{guardianContent}</>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {assistantMessages.map((message) => (
        <div
          key={message.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          {message.parts.map((part, partIndex) => {
            if (part.type === "text") {
              return (
                <div
                  key={`${message.id}-text-${partIndex}`}
                  style={{
                    fontFamily: "var(--font-conversation)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: "oklch(0.88 0.01 250)",
                  }}
                >
                  <Streamdown isAnimating={isStreaming}>{part.text}</Streamdown>
                </div>
              );
            }

            if (isToolUIPart(part)) {
              // SDK ensures dynamic tools have toolName; cast is safe here.
              const dynamicPart = part as import("ai").DynamicToolUIPart;
              return (
                <div
                  data-breath-beat
                  key={`${message.id}-tool-${dynamicPart.toolCallId}`}
                  style={{
                    minHeight: "3rem",
                    animation: "breath-beat-enter 300ms ease-out 200ms both",
                  }}
                >
                  <ToolPartsRenderer
                    interactionId={interactionId}
                    onRevealApproved={onRevealApproved}
                    onWait={onWait}
                    part={dynamicPart}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      ))}
    </div>
  );
}
