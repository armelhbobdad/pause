import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuardianConversation } from "./guardian-conversation";

/**
 * Dispatch a transitionend event with a specific propertyName.
 * fireEvent.transitionEnd doesn't reliably set propertyName in happy-dom,
 * so we construct the event manually.
 */
function fireTransitionEnd(element: HTMLElement, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  act(() => {
    element.dispatchEvent(event);
  });
}

describe("GuardianConversation", () => {
  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe("rendering", () => {
    it("renders children", () => {
      render(
        <GuardianConversation isActive={false} tier="negotiator">
          <p>Guardian message</p>
        </GuardianConversation>
      );
      expect(screen.getByText("Guardian message")).toBeInTheDocument();
    });

    it("sets data-tier attribute", () => {
      const { container } = render(
        <GuardianConversation isActive={false} tier="therapist" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.dataset.tier).toBe("therapist");
    });

    it("applies className", () => {
      const { container } = render(
        <GuardianConversation
          className="custom-class"
          isActive={false}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.classList.contains("custom-class")).toBe(true);
    });
  });

  // ==========================================================================
  // Grid expansion state
  // ==========================================================================

  describe("grid expansion", () => {
    it("sets gridTemplateRows to 0fr when inactive", () => {
      const { container } = render(
        <GuardianConversation isActive={false} tier="negotiator" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.style.gridTemplateRows).toBe("0fr");
    });

    it("sets gridTemplateRows to 1fr when active", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="negotiator" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.style.gridTemplateRows).toBe("1fr");
    });

    it("sets data-active when active", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="negotiator" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.dataset.active).toBeDefined();
    });

    it("does not set data-active when inactive", () => {
      const { container } = render(
        <GuardianConversation isActive={false} tier="negotiator" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.dataset.active).toBeUndefined();
    });
  });

  // ==========================================================================
  // Tier-aware max-height
  // ==========================================================================

  describe("tier-aware max-height (UX-55)", () => {
    it("uses negotiator max-height CSS variable", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="negotiator" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.style.maxHeight).toBe(
        "var(--guardian-max-height-negotiator)"
      );
    });

    it("uses therapist max-height CSS variable", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="therapist" />
      );
      const outer = container.firstElementChild as HTMLElement;
      expect(outer.style.maxHeight).toBe(
        "var(--guardian-max-height-therapist)"
      );
    });
  });

  // ==========================================================================
  // Inner overflow behavior
  // ==========================================================================

  describe("inner overflow", () => {
    it("inner div has overflow hidden when inactive", () => {
      const { container } = render(
        <GuardianConversation isActive={false} tier="negotiator">
          content
        </GuardianConversation>
      );
      const inner = container.firstElementChild
        ?.firstElementChild as HTMLElement;
      expect(inner.style.overflow).toBe("hidden");
    });

    it("inner div has overflow hidden during expansion (before transitionend)", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="negotiator">
          content
        </GuardianConversation>
      );
      const inner = container.firstElementChild
        ?.firstElementChild as HTMLElement;
      // Before transitionend fires, overflow should still be hidden
      expect(inner.style.overflow).toBe("hidden");
    });

    it("inner div switches to overflow auto after expansion transitionend", () => {
      const { container } = render(
        <GuardianConversation isActive={true} tier="negotiator">
          content
        </GuardianConversation>
      );
      const outer = container.firstElementChild as HTMLElement;
      const inner = outer.firstElementChild as HTMLElement;

      // Simulate transitionend for grid-template-rows
      fireTransitionEnd(outer, "grid-template-rows");

      expect(inner.style.overflow).toBe("auto");
    });

    it("ignores transitionend for non-grid properties", () => {
      const onExpansionComplete = vi.fn();
      const { container } = render(
        <GuardianConversation
          isActive={true}
          onExpansionComplete={onExpansionComplete}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;

      // Simulate transitionend for a different property
      fireTransitionEnd(outer, "opacity");

      expect(onExpansionComplete).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  describe("transitionend callbacks", () => {
    it("fires onExpansionComplete when transitioning while active", () => {
      const onExpansionComplete = vi.fn();
      const { container } = render(
        <GuardianConversation
          isActive={true}
          onExpansionComplete={onExpansionComplete}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;

      fireTransitionEnd(outer, "grid-template-rows");
      expect(onExpansionComplete).toHaveBeenCalledOnce();
    });

    it("does not fire onCollapseComplete on mount without prior expansion", () => {
      const onCollapseComplete = vi.fn();
      const { container } = render(
        <GuardianConversation
          isActive={false}
          onCollapseComplete={onCollapseComplete}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;

      fireTransitionEnd(outer, "grid-template-rows");
      expect(onCollapseComplete).not.toHaveBeenCalled();
    });

    it("fires onCollapseComplete after a real expansion-collapse cycle", () => {
      const onCollapseComplete = vi.fn();
      const onExpansionComplete = vi.fn();
      const { container, rerender } = render(
        <GuardianConversation
          isActive={true}
          onCollapseComplete={onCollapseComplete}
          onExpansionComplete={onExpansionComplete}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;

      // Complete expansion
      fireTransitionEnd(outer, "grid-template-rows");
      expect(onExpansionComplete).toHaveBeenCalledOnce();

      // Collapse
      rerender(
        <GuardianConversation
          isActive={false}
          onCollapseComplete={onCollapseComplete}
          onExpansionComplete={onExpansionComplete}
          tier="negotiator"
        />
      );

      fireTransitionEnd(outer, "grid-template-rows");
      expect(onCollapseComplete).toHaveBeenCalledOnce();
    });

    it("does not fire callbacks when propertyName is not grid-template-rows", () => {
      const onExpansionComplete = vi.fn();
      const onCollapseComplete = vi.fn();
      const { container } = render(
        <GuardianConversation
          isActive={true}
          onCollapseComplete={onCollapseComplete}
          onExpansionComplete={onExpansionComplete}
          tier="negotiator"
        />
      );
      const outer = container.firstElementChild as HTMLElement;

      fireTransitionEnd(outer, "max-height");
      expect(onExpansionComplete).not.toHaveBeenCalled();
      expect(onCollapseComplete).not.toHaveBeenCalled();
    });
  });
});
