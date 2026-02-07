import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(
      <EmptyState
        description="Your spending reflections will appear here"
        icon={<Clock data-testid="empty-icon" />}
        title="No reflections yet"
      />
    );

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(screen.getByText("No reflections yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your spending reflections will appear here")
    ).toBeInTheDocument();
  });

  it("renders CTA when action is provided", () => {
    const onClick = () => {
      /* noop */
    };
    render(
      <EmptyState
        action={{ label: "Try it out", onClick }}
        description="No history"
        icon={<Clock />}
        title="Empty"
      />
    );

    const button = screen.getByRole("button", { name: "Try it out" });
    expect(button).toBeInTheDocument();
  });

  it("renders without CTA when no action is provided", () => {
    render(<EmptyState description="No data" icon={<Clock />} title="Empty" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    render(
      <EmptyState
        description="Description text"
        icon={<Clock />}
        title="Title text"
      />
    );

    const description = screen.getByText("Description text");
    expect(description.className).toContain("text-muted-foreground");

    const title = screen.getByText("Title text");
    expect(title.className).toContain("text-foreground");
  });
});
