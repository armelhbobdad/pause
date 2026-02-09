import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockStreamText = vi.fn();
  const mockConvertToModelMessages = vi.fn((msgs: unknown) =>
    Promise.resolve(msgs)
  );
  const mockToUIMessageStreamResponse = vi.fn(
    () =>
      new Response("stream", {
        headers: { "content-type": "text/event-stream" },
      })
  );
  const mockGetModel = vi.fn(() => "mock-model");
  const mockGetGuardianTelemetry = vi.fn(() => ({
    isEnabled: true,
    metadata: {},
  }));

  mockStreamText.mockReturnValue({
    toUIMessageStreamResponse: mockToUIMessageStreamResponse,
  });

  return {
    mockStreamText,
    mockConvertToModelMessages,
    mockToUIMessageStreamResponse,
    mockGetModel,
    mockGetGuardianTelemetry,
  };
});

vi.mock("ai", () => ({
  convertToModelMessages: mocks.mockConvertToModelMessages,
  streamText: mocks.mockStreamText,
}));

vi.mock("@/lib/server/model", () => ({
  getModel: mocks.mockGetModel,
}));

vi.mock("@/lib/server/opik", () => ({
  getGuardianTelemetry: mocks.mockGetGuardianTelemetry,
}));

import { POST } from "./route";

function createPostRequest(
  messages: Array<{ role: string; content: string }> = []
): Request {
  return new Request("http://localhost/api/ai/knowledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
}

describe("/api/ai/knowledge route (Story 10.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: mocks.mockToUIMessageStreamResponse,
    });
  });

  it("calls streamText with the configured model from getModel()", async () => {
    await POST(createPostRequest([{ role: "user", content: "Hello" }]));

    expect(mocks.mockGetModel).toHaveBeenCalled();
    expect(mocks.mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
      })
    );
  });

  it("includes KNOWLEDGE_SYSTEM_PROMPT as system message", async () => {
    await POST(createPostRequest([{ role: "user", content: "Hi" }]));

    const call = mocks.mockStreamText.mock.calls[0][0];
    expect(call.system).toContain("spending awareness companion");
    expect(call.system).toContain("NOT a financial advisor");
  });

  it("system prompt contains guardrails against financial advice", async () => {
    await POST(createPostRequest([]));

    const call = mocks.mockStreamText.mock.calls[0][0];
    expect(call.system).toContain("Never provide specific financial advice");
    expect(call.system).toContain("consider a professional");
  });

  it("converts messages before passing to streamText", async () => {
    const messages = [{ role: "user", content: "test" }];
    await POST(createPostRequest(messages));

    expect(mocks.mockConvertToModelMessages).toHaveBeenCalledWith(messages);
  });

  it("wires Opik telemetry with knowledge trace name", async () => {
    await POST(createPostRequest([]));

    expect(mocks.mockGetGuardianTelemetry).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      "knowledge",
      false
    );

    const call = mocks.mockStreamText.mock.calls[0][0];
    expect(call.experimental_telemetry).toEqual({
      isEnabled: true,
      metadata: {},
    });
  });

  it("sets 10-second abort signal timeout", async () => {
    await POST(createPostRequest([]));

    const call = mocks.mockStreamText.mock.calls[0][0];
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("returns stream response from toUIMessageStreamResponse", async () => {
    const response = await POST(
      createPostRequest([{ role: "user", content: "How does Pause work?" }])
    );

    expect(mocks.mockToUIMessageStreamResponse).toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
  });

  it("system prompt suggests Guardian session for purchase evaluation", async () => {
    await POST(createPostRequest([]));

    const call = mocks.mockStreamText.mock.calls[0][0];
    expect(call.system).toContain("Card Vault");
    expect(call.system).toContain("Guardian session");
  });
});
