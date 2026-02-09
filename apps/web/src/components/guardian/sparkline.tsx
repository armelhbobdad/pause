"use client";

interface SparklineDataPoint {
  amountCents: number;
}

interface SparklineProps {
  dataPoints: SparklineDataPoint[];
}

function getTrend(points: number[]): "increasing" | "flat" | "decreasing" {
  if (points.length < 2) {
    return "flat";
  }
  const first = points[0];
  const last = points.at(-1) ?? first;
  const diff = last - first;
  // Consider flat if change is less than 1% of first value or zero
  if (first === 0 || Math.abs(diff / first) < 0.01) {
    return "flat";
  }
  return diff > 0 ? "increasing" : "decreasing";
}

function buildPolylinePoints(
  values: number[],
  width: number,
  height: number,
  padding: number
): string {
  if (values.length === 0) {
    return "";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * usableWidth;
      const y = padding + usableHeight - ((v - min) / range) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

export function Sparkline({ dataPoints }: SparklineProps) {
  const values = dataPoints.map((d) => d.amountCents / 100);

  if (dataPoints.length < 3) {
    return (
      <p
        className="text-sm"
        data-testid="sparkline-placeholder"
        style={{ color: "var(--muted-foreground)" }}
      >
        Complete your first flow
      </p>
    );
  }

  const trend = getTrend(values);

  if (trend === "flat") {
    return (
      <p
        className="text-sm"
        data-testid="sparkline-placeholder"
        style={{ color: "var(--muted-foreground)" }}
      >
        Steady pace
      </p>
    );
  }

  const width = 200;
  const height = 40;
  const padding = 4;
  const points = buildPolylinePoints(values, width, height, padding);

  return (
    <svg
      aria-label={`30-day savings trend: ${trend}`}
      data-testid="sparkline-svg"
      height={height}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
    >
      <polyline
        fill="none"
        points={points}
        stroke="var(--pause-success)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}
