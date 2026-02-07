import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BANNED_TERMS_MAP,
  createBannedTermFilter,
  filterBannedTerms,
} from "./filters";

describe("BANNED_TERMS_MAP", () => {
  it("contains all required clinical terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty("addiction", "pattern");
    expect(BANNED_TERMS_MAP).toHaveProperty("compulsive", "frequent");
    expect(BANNED_TERMS_MAP).toHaveProperty("disorder", null);
    expect(BANNED_TERMS_MAP).toHaveProperty("therapy", "support");
    expect(BANNED_TERMS_MAP).toHaveProperty("treatment", null);
    expect(BANNED_TERMS_MAP).toHaveProperty("diagnosis", null);
  });

  it("contains all required judgmental terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty("problem", "situation");
    expect(BANNED_TERMS_MAP).toHaveProperty("issue", "concern");
    expect(BANNED_TERMS_MAP).toHaveProperty("unhealthy", null);
  });

  it("contains all required medical terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty("symptoms", null);
    expect(BANNED_TERMS_MAP).toHaveProperty("condition", "situation");
    expect(BANNED_TERMS_MAP).toHaveProperty("intervention", null);
  });

  it("contains all required directive terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty(
      "you should",
      "have you considered"
    );
    expect(BANNED_TERMS_MAP).toHaveProperty("you need to", "what if");
  });

  it("contains PRD-specific terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty("anxiety", "impulse");
    expect(BANNED_TERMS_MAP).toHaveProperty("compulsion", "urge");
  });

  it("contains multi-word null-removal terms", () => {
    expect(BANNED_TERMS_MAP).toHaveProperty("bad habit", null);
    expect(BANNED_TERMS_MAP).toHaveProperty("impulse control", null);
  });
});

describe("filterBannedTerms", () => {
  // --- AC8: Each clinical term replaced correctly ---
  describe("clinical term replacements", () => {
    it('replaces "addiction" with "pattern"', () => {
      const { filtered, replacements } = filterBannedTerms(
        "This is an addiction to shopping"
      );
      expect(filtered).toBe("This is an pattern to shopping");
      expect(replacements).toEqual([
        { original: "addiction", replacement: "pattern" },
      ]);
    });

    it('replaces "compulsive" with "frequent"', () => {
      const { filtered } = filterBannedTerms("compulsive spending behavior");
      expect(filtered).toBe("frequent spending behavior");
    });

    it('replaces "therapy" with "support"', () => {
      const { filtered } = filterBannedTerms("Consider therapy for this");
      expect(filtered).toBe("Consider support for this");
    });
  });

  // --- AC8: Null-replacement terms removed ---
  describe("null-replacement term removal", () => {
    it('removes "disorder" with whitespace normalization', () => {
      const { filtered, replacements } = filterBannedTerms(
        "a spending disorder here"
      );
      expect(filtered).toBe("a spending here");
      expect(replacements).toEqual([
        { original: "disorder", replacement: null },
      ]);
    });

    it('removes "treatment"', () => {
      const { filtered } = filterBannedTerms("seek treatment immediately");
      expect(filtered).toBe("seek immediately");
    });

    it('removes "diagnosis"', () => {
      const { filtered } = filterBannedTerms("your diagnosis indicates");
      expect(filtered).toBe("your indicates");
    });

    it('removes "unhealthy"', () => {
      const { filtered } = filterBannedTerms("this is unhealthy behavior");
      expect(filtered).toBe("this is behavior");
    });

    it('removes "symptoms"', () => {
      const { filtered } = filterBannedTerms("showing symptoms of");
      expect(filtered).toBe("showing of");
    });

    it('removes "intervention"', () => {
      const { filtered } = filterBannedTerms("requires intervention now");
      expect(filtered).toBe("requires now");
    });
  });

  // --- AC8: Neutral-replacement terms ---
  describe("neutral-replacement terms", () => {
    it('replaces "problem" with "situation"', () => {
      const { filtered } = filterBannedTerms("No problem at all");
      expect(filtered).toBe("No situation at all");
    });

    it('replaces "issue" with "concern"', () => {
      const { filtered } = filterBannedTerms("This issue is important");
      expect(filtered).toBe("This concern is important");
    });

    it('replaces "condition" with "situation"', () => {
      const { filtered } = filterBannedTerms("This condition applies");
      expect(filtered).toBe("This situation applies");
    });
  });

  // --- AC8: Multi-word phrase matching ---
  describe("multi-word phrase matching", () => {
    it('removes "bad habit"', () => {
      const { filtered, replacements } = filterBannedTerms(
        "This is a bad habit you have"
      );
      expect(filtered).toBe("This is a you have");
      expect(replacements).toEqual([
        { original: "bad habit", replacement: null },
      ]);
    });

    it('removes "impulse control"', () => {
      const { filtered } = filterBannedTerms(
        "lacking impulse control in spending"
      );
      expect(filtered).toBe("lacking in spending");
    });

    it('replaces "you should" with "have you considered"', () => {
      const { filtered } = filterBannedTerms("you should save more money");
      expect(filtered).toBe("have you considered save more money");
    });

    it('replaces "you need to" with "what if"', () => {
      const { filtered } = filterBannedTerms(
        "you need to stop spending so much"
      );
      expect(filtered).toBe("what if stop spending so much");
    });

    it("matches multi-word phrases before single words", () => {
      // "bad habit" should match as a whole phrase, not just "bad" separately
      const { filtered, replacements } = filterBannedTerms(
        "That bad habit is concerning"
      );
      expect(filtered).toBe("That is concerning");
      // Only one replacement for the whole phrase, not separate matches
      expect(replacements).toHaveLength(1);
      expect(replacements[0]).toEqual({
        original: "bad habit",
        replacement: null,
      });
    });
  });

  // --- AC8: Word boundary matching ---
  describe("word boundary matching", () => {
    it('"therapy" matches but "therapist" does NOT', () => {
      const { filtered: filtered1 } = filterBannedTerms("try therapy for this");
      expect(filtered1).toBe("try support for this");

      const { filtered: filtered2, replacements } = filterBannedTerms(
        "ask your therapist about it"
      );
      expect(filtered2).toBe("ask your therapist about it");
      expect(replacements).toHaveLength(0);
    });

    it('"condition" matches but "conditional" does NOT', () => {
      const { filtered: filtered1 } = filterBannedTerms(
        "this condition is serious"
      );
      expect(filtered1).toBe("this situation is serious");

      const { filtered: filtered2, replacements } = filterBannedTerms(
        "conditional logic applies"
      );
      expect(filtered2).toBe("conditional logic applies");
      expect(replacements).toHaveLength(0);
    });

    it('"problem" matches but "problematic" does NOT', () => {
      const { filtered: filtered1 } = filterBannedTerms("no problem here");
      expect(filtered1).toBe("no situation here");

      const { filtered: filtered2, replacements } = filterBannedTerms(
        "that is problematic"
      );
      expect(filtered2).toBe("that is problematic");
      expect(replacements).toHaveLength(0);
    });

    it('"addiction" matches but "addictive" does NOT', () => {
      const { filtered, replacements } = filterBannedTerms(
        "the addictive game is fun"
      );
      expect(filtered).toBe("the addictive game is fun");
      expect(replacements).toHaveLength(0);
    });
  });

  // --- AC8: Case insensitive matching ---
  describe("case insensitive matching", () => {
    it('"Addiction" becomes "Pattern"', () => {
      const { filtered } = filterBannedTerms("Addiction is a strong word");
      expect(filtered).toBe("Pattern is a strong word");
    });

    it('"THERAPY" becomes "SUPPORT"', () => {
      const { filtered } = filterBannedTerms("THERAPY is not needed");
      expect(filtered).toBe("SUPPORT is not needed");
    });

    it('"Disorder" (capitalized null-removal) is removed', () => {
      const { filtered } = filterBannedTerms("Disorder is a label");
      expect(filtered).toBe(" is a label");
    });

    it('"You Should" preserves case in replacement', () => {
      const { filtered } = filterBannedTerms("You Should save money for later");
      expect(filtered).toBe("Have you considered save money for later");
    });

    it('"YOU NEED TO" becomes "WHAT IF"', () => {
      const { filtered } = filterBannedTerms(
        "YOU NEED TO reconsider this purchase"
      );
      expect(filtered).toBe("WHAT IF reconsider this purchase");
    });
  });

  // --- AC8: Multiple replacements in one string ---
  it("handles multiple replacements in one string", () => {
    const { filtered, replacements } = filterBannedTerms(
      "Your addiction and anxiety are symptoms of a disorder"
    );
    expect(filtered).toBe("Your pattern and impulse are of a ");
    expect(replacements.length).toBeGreaterThanOrEqual(3);
  });

  // --- AC8: Clean text passes through unchanged ---
  it("passes clean text through unchanged with empty replacements array", () => {
    const { filtered, replacements } = filterBannedTerms(
      "This is a perfectly fine sentence about saving money"
    );
    expect(filtered).toBe(
      "This is a perfectly fine sentence about saving money"
    );
    expect(replacements).toEqual([]);
  });

  // --- AC8: Whitespace normalization after null removal ---
  describe("whitespace normalization", () => {
    it("collapses double spaces after null removal", () => {
      const { filtered } = filterBannedTerms("a disorder b");
      expect(filtered).toBe("a b");
      expect(filtered).not.toContain("  ");
    });

    it("preserves leading space after null removal at start (streaming-safe)", () => {
      const { filtered } = filterBannedTerms("disorder in the house");
      expect(filtered).toBe(" in the house");
      expect(filtered).not.toContain("  ");
    });

    it("handles multiple null removals without double spaces", () => {
      const { filtered } = filterBannedTerms(
        "some diagnosis and treatment here"
      );
      expect(filtered).toBe("some and here");
      expect(filtered).not.toContain("  ");
    });
  });

  // --- AC8: Performance test ---
  it("filters 1000-char string in <10ms (AC5)", () => {
    // Build a 1000-char string with some banned terms
    const base = "This is a test string with therapy and addiction mixed in. ";
    const input = base.repeat(Math.ceil(1000 / base.length)).slice(0, 1000);

    const start = performance.now();
    filterBannedTerms(input);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});

describe("createBannedTermFilter", () => {
  async function pipeThrough(
    parts: Record<string, unknown>[],
    transformStream: TransformStream
  ): Promise<Record<string, unknown>[]> {
    const readable = new ReadableStream({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(part);
        }
        controller.close();
      },
    });
    const reader = readable.pipeThrough(transformStream).getReader();
    const result: Record<string, unknown>[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      result.push(value as Record<string, unknown>);
    }
    return result;
  }

  it("filters text-delta parts and passes through other parts", async () => {
    const collectedReplacements: {
      original: string;
      replacement: string | null;
    }[] = [];

    const factory = createBannedTermFilter((r) => {
      collectedReplacements.push(...r);
    });
    const transformStream = factory();

    const parts = [
      { type: "text-delta", id: "1", text: "Your addiction is clear" },
      { type: "step-start", step: 1 },
      { type: "text-delta", id: "2", text: "no banned terms here" },
    ];

    const result = await pipeThrough(parts, transformStream);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(
      expect.objectContaining({
        type: "text-delta",
        text: "Your pattern is clear",
      })
    );
    expect(result[1]).toEqual({ type: "step-start", step: 1 });
    expect(result[2]).toEqual(
      expect.objectContaining({
        type: "text-delta",
        text: "no banned terms here",
      })
    );
    expect(collectedReplacements).toHaveLength(1);
    expect(collectedReplacements[0]).toEqual({
      original: "addiction",
      replacement: "pattern",
    });
  });

  it("does not call onReplacements when no terms are replaced", async () => {
    const onReplacements = vi.fn();
    const factory = createBannedTermFilter(onReplacements);
    const transformStream = factory();

    const parts = [{ type: "text-delta", id: "1", text: "all clean text" }];

    await pipeThrough(parts, transformStream);

    expect(onReplacements).not.toHaveBeenCalled();
  });
});
