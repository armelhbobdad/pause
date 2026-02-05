#!/usr/bin/env bun
/**
 * Smoke test to verify Opik instrumentation is working end-to-end.
 *
 * Run: bun test:smoke-trace
 *
 * Prerequisites:
 * - OPIK_API_KEY set in environment
 * - OPIK_PROJECT_NAME set (optional, defaults to "pause")
 *
 * Success: Outputs verification message with project name
 * Failure: Outputs error with troubleshooting guidance
 */

import { Opik } from "opik";

const OPIK_DOCS_URL = "https://www.comet.com/docs/opik/";
const TRACE_NAME_PREFIX = "smoke-test:verification";
const TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  // Step 1: Validate configuration
  const apiKey = process.env.OPIK_API_KEY;
  if (!apiKey) {
    console.error("❌ Opik configuration invalid. Check OPIK_API_KEY.");
    console.error(`📚 Setup guide: ${OPIK_DOCS_URL}`);
    process.exit(1);
  }

  const projectName = process.env.OPIK_PROJECT_NAME ?? "pause";
  const workspaceName = process.env.OPIK_WORKSPACE ?? "default";

  try {
    const client = new Opik({ apiKey, projectName, workspaceName });

    // Step 2: Create test trace with unique name to avoid false positives from stale traces
    const traceTimestamp = Date.now();
    const traceName = `${TRACE_NAME_PREFIX}:${traceTimestamp}`;
    console.log(`📤 Creating test trace in project: ${projectName}`);
    const trace = client.trace({
      name: traceName,
      input: { timestamp: new Date().toISOString(), test: "smoke-test" },
    });

    // Add a span to demonstrate span functionality with both input and output
    const span = trace.span({
      name: "verification-span",
      type: "general",
      input: { action: "verify-instrumentation", timestamp: traceTimestamp },
    });
    span.update({
      output: { verified: true, duration_ms: Date.now() - traceTimestamp },
    });
    span.end();

    // End trace with output
    trace.update({ output: { smoke: "test", success: true } });
    trace.end();

    // Step 3: Flush to Opik
    console.log("⏳ Flushing trace to Opik...");
    await client.flush();

    // Step 4: Verify the specific trace appeared (using unique name prevents false positives)
    console.log("🔍 Waiting for trace to appear in Opik...");
    const traces = await client.searchTraces({
      projectName,
      filterString: `name = "${traceName}"`,
      maxResults: 1,
      waitForAtLeast: 1,
      waitForTimeout: TIMEOUT_MS,
    });

    if (traces.length > 0) {
      console.log(`✅ Trace verified in Opik project: ${projectName}`);
      console.log(`🔗 Trace ID: ${traces[0].id}`);
      process.exit(0);
    } else {
      console.error("❌ Trace not found within timeout. Check Opik dashboard.");
      console.error(`📚 Setup guide: ${OPIK_DOCS_URL}`);
      process.exit(1);
    }
  } catch (error) {
    // Detect 401 errors for invalid API key
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("401") ||
      errorMessage.toLowerCase().includes("unauthorized")
    ) {
      console.error("❌ Opik API key is invalid. Check OPIK_API_KEY value.");
    } else {
      console.error("❌ Opik smoke test failed:", errorMessage);
    }
    console.error(`📚 Setup guide: ${OPIK_DOCS_URL}`);
    process.exit(1);
  }
}

// Allow running directly via bun
if (import.meta.main) {
  main();
}
