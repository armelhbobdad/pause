import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getModel } from "@/lib/server/model";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getModel(),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
