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
    <div>
      {assistantMessages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, partIndex) => {
            if (part.type === "text") {
              return (
                <Streamdown
                  isAnimating={isStreaming}
                  key={`${message.id}-text-${partIndex}`}
                >
                  {part.text}
                </Streamdown>
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
