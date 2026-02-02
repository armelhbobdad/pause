# opik-ts-vercel-ai-ace

> **PROVENANCE NOTICE:** Every fact in this skill is tagged with a confidence tier.
> - **T1** — AST-verified: Extracted from source code structure. Highest confidence.
> - **T2** — Heuristic: Inferred from naming conventions, comments, file structure. Medium confidence.
> - **T3** — Social/Docs: Sourced from issues, PRs, or documentation. Lower confidence.
>
> **DO NOT** invent, assume, or extend facts beyond what is cited here.
> If information is missing, state that it is not covered by this skill rather than guessing.
> Every claim should be traceable to a provenance tag in this document.

---

## Metadata

- **Source:** comet-ml/opik @ main, kayba-ai/ace-ts @ main
- **Language:** typescript
- **Compiled:** 2026-01-31
- **Spec Version:** 1.0
- **Confidence:** 313 T1 | 6 T2 | 4 T3

---

## Package Names [T1]

| npm Package | Version | Source |
|-------------|---------|--------|
| `opik` | 1.10.1 | comet-ml/opik — core SDK (`sdks/typescript/package.json`) |
| `opik-vercel` | 1.10.1 | comet-ml/opik — Vercel AI integration (peer dep: `opik ^1.8.75`, `@opentelemetry/api ^1.0.0`, `@opentelemetry/core ^2.0.0`, `@opentelemetry/sdk-node >=0.56.0`) |
| `@kayba/ace-framework` | 0.7.0 | kayba-ai/ace-ts — ACE framework (pre-release) |

**Required peer dependency:** `zod ^3.25.55 || ^4.0.0` (for `opik`)
**Node.js:** `>=18` (both packages)

## Quick Reference

**Install:**
```bash
npm install opik zod                    # Core SDK
npm install opik-vercel @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node  # Vercel AI
npm install @kayba/ace-framework        # ACE framework
```

**10 most common operations:**

| # | Operation | Code |
|---|-----------|------|
| 1 | Create client | `const client = new Opik({ apiKey, projectName })` [T1] |
| 2 | Create trace | `const trace = client.trace({ name: "op", input: {...} })` [T1] |
| 3 | Create span | `const span = trace.span({ name: "llm", type: "llm" })` [T1] |
| 4 | Flush data | `await client.flush()` [T1] |
| 5 | Track function | `const fn = track({ name: "fn" }, myFunction)` [T1] |
| 6 | Setup Vercel AI tracing | `new OpikExporter({ tags: [...] })` + `OpikExporter.getSettings({ name })` [T1] |
| 7 | Evaluate dataset | `await evaluate({ dataset, task, scoringMetrics })` [T1] |
| 8 | Create ACE agent | `new ACEAgent({ model: openai("gpt-4o") })` [T1] |
| 9 | Ask + auto-learn | `await agent.ask("question")` [T1] |
| 10 | Inject skillbook | `wrapSkillbookContext(skillbook)` → append to prompt [T1] |

## Source 1: Opik TypeScript SDK (comet-ml/opik)

### Client & Configuration

#### `class OpikClient` [T1]

**File:** `sdks/typescript/src/opik/client/Client.ts:51`
**Source:** AST/sg scan

The primary SDK entry point. Exported as `Opik` from the package root.

```typescript
constructor(explicitConfig?: Partial<ConstructorOpikConfig>)
```

**Public properties:** [T1]
- `api: OpikApiClientTemp` — internal API client
- `config: OpikConfig` — resolved configuration
- `spanBatchQueue`, `traceBatchQueue`, `datasetBatchQueue` — batch queues
- `spanFeedbackScoresBatchQueue`, `traceFeedbackScoresBatchQueue`

**Public methods:** [T1]
- `trace(traceData: TraceData): Trace` — create a new trace
- `flush(): Promise<void>` — flush all pending batches
- `getDataset<T>(name: string): Promise<Dataset<T>>`
- `createDataset<T>(name: string, description?: string): Promise<Dataset<T>>`
- `getOrCreateDataset<T>(name: string, description?: string): Promise<Dataset<T>>`
- `getDatasets<T>(maxResults?: number): Promise<Dataset<T>[]>`
- `deleteDataset(name: string): Promise<void>`
- `createExperiment(opts: { datasetName, name?, experimentConfig?, prompts?, type?, optimizationId? }): Promise<Experiment>`
- `updateExperiment(id: string, update: { name?, experimentConfig? }): Promise<void>`
- `getExperimentById(id: string): Promise<Experiment>`
- `getExperimentsByName(name: string): Promise<Experiment[]>`
- `getExperiment(name: string): Promise<Experiment>`
- `getDatasetExperiments(datasetName: string, maxResults?: number): Promise<Experiment[]>`
- `deleteExperiment(id: string): Promise<void>`
- `createPrompt(options: CreatePromptOptions): Promise<Prompt>`
- `createChatPrompt(options: CreateChatPromptOptions): Promise<ChatPrompt>`
- `getPrompt(options: GetPromptOptions): Promise<Prompt | null>`
- `getChatPrompt(options: GetPromptOptions): Promise<ChatPrompt | null>`
- `searchPrompts(filterString?: string): Promise<(Prompt | ChatPrompt)[]>`
- `deletePrompts(ids: string[]): Promise<void>`
- `searchTraces(options?: { projectName?, filterString?, maxResults?, truncate?, waitForAtLeast?, waitForTimeout? }): Promise<TracePublic[]>`
- `updatePromptVersionTags(versionIds: string[], options?: { tags?, mergeTags? }): Promise<void>`

#### `interface OpikConfig` [T1]

**File:** `sdks/typescript/src/opik/config/Config.ts:7`

```typescript
interface OpikConfig {
  apiKey: string;
  apiUrl?: string;
  projectName: string;
  workspaceName: string;
  requestOptions?: RequestOptions;
  batchDelayMs?: number;
  holdUntilFlush?: boolean;
}
```

**Configuration resolution order** [T1]: explicit constructor args → env vars → config file (`~/.opik.config`) → defaults

**Environment variables** [T1+T3]:
- `OPIK_API_KEY`, `OPIK_URL_OVERRIDE`, `OPIK_PROJECT_NAME`, `OPIK_WORKSPACE`
- `OPIK_BATCH_DELAY_MS`, `OPIK_HOLD_UNTIL_FLUSH`, `OPIK_CONFIG_PATH`

**Defaults** [T1]: `apiUrl: "https://www.comet.com/opik/api"`, `projectName: "Default Project"`, `workspaceName: "default"`, `batchDelayMs: 300`, `holdUntilFlush: false`

### Tracing

#### `class Trace` [T1]

**File:** `sdks/typescript/src/opik/tracer/Trace.ts:15`

Created via `client.trace()`. Represents a top-level trace in the Opik system.

**Key methods:** [T1]
- `span(data): Span` — create a child span
- `update(data): void` — update trace data
- `end(): void` — mark trace as complete

#### `class Span` [T1]

**File:** `sdks/typescript/src/opik/tracer/Span.ts:10`

Created via `trace.span()`. Represents a sub-operation within a trace.

**Key methods:** [T1]
- `update(data): void` — update span data (input, output, metadata, usage, errorInfo)
- `end(): void` — mark span as complete

### Decorators

#### `function track` [T1]

**File:** `sdks/typescript/src/opik/decorators/track.ts:277`

Decorator for automatic tracing of functions/methods. Supports both legacy and TC39 decorator syntax.

```typescript
function track(optionsOrOriginalFunction: TrackOptions | OriginalFunction, originalFunction?: OriginalFunction)
```

**TrackOptions** [T1]:
```typescript
type TrackOptions = {
  name?: string;
  projectName?: string;
  type?: SpanType;
  enrichSpan?: (result: any) => Record<string, unknown>;
}
```

**`SpanType`** [T1] — valid values: `"general" | "tool" | "llm" | "guardrail"`

**File:** `sdks/typescript/src/opik/rest_api/api/types/SpanType.ts`
```typescript
const SpanType = { General: "general", Tool: "tool", Llm: "llm", Guardrail: "guardrail" } as const;
type SpanType = (typeof SpanType)[keyof typeof SpanType];
```

**`getTrackContext(): Required<TrackContext> | undefined`** [T1] — retrieve current span/trace from `AsyncLocalStorage` context.

**TrackContext** [T1]:
**File:** `sdks/typescript/src/opik/decorators/track.ts:9`
```typescript
type TrackContext =
  | { span?: Span; trace?: Trace }
  | { span: Span; trace: Trace };
```

### Vercel AI Integration (opik-vercel)

#### `class OpikExporter` [T1]

**File:** `sdks/typescript/src/opik/integrations/opik-vercel/src/exporter.ts:32`

OpenTelemetry `SpanExporter` implementation that bridges Vercel AI SDK telemetry to Opik tracing.

```typescript
constructor(options?: OpikExporterOptions)
```

**OpikExporterOptions** [T1]:
```typescript
type OpikExporterOptions = {
  client?: Opik;
  tags?: string[];
  metadata?: Record<string, AttributeValue>;
  threadId?: string;
}
```

**`AttributeValue`** [T1] — imported from `@opentelemetry/api`. Valid types: `string | number | boolean | null | string[] | number[] | boolean[]`

**Static method** [T1]:
```typescript
static getSettings(settings: OpikExporterSettings): TelemetrySettings
```

Returns telemetry settings for use with Vercel AI's `experimental_telemetry` option. Accepts `name` to set custom trace names.

**Key behavior** [T1]: Filters for AI SDK spans (`instrumentationScope.name === "ai"`), groups by OTel trace ID, creates Opik traces from root spans, creates Opik spans from child spans. Extracts input from `ai.prompt.*`/`gen_ai.request.*` attributes, output from `ai.response.text`/`ai.toolCall.result`, usage from `ai.usage.promptTokens`/`gen_ai.usage.*` attributes.

**Next.js setup** [T3]:
```typescript
// instrumentation.ts
import { registerOTel } from "@vercel/otel";
import { OpikExporter } from "opik-vercel";

export function register() {
  registerOTel({
    serviceName: "my-app",
    traceExporter: new OpikExporter(),
  });
}
```

**Node.js setup** [T3]:
```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OpikExporter } from "opik-vercel";

const sdk = new NodeSDK({
  traceExporter: new OpikExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

**Vercel AI call with telemetry** [T3]:
```typescript
const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell a joke",
  experimental_telemetry: OpikExporter.getSettings({ name: "my-trace" }),
});
```

### Evaluation System

#### `function evaluate<T>(options: EvaluateOptions<T>): Promise<EvaluationResult>` [T1]

**File:** `sdks/typescript/src/opik/evaluation/evaluate.ts:52`

Top-level evaluation entry point. Creates an experiment, runs a task function against each dataset item, scores results with metrics.

**EvaluateOptions<T>** [T1]:
```typescript
interface EvaluateOptions<T = Record<string, unknown>> {
  dataset: Dataset<T>;                         // required
  task: EvaluationTask<T>;                     // required — (item: T) => Record<string, unknown>
  scoringMetrics?: BaseMetric[];               // optional array of metrics
  experimentName?: string;
  projectName?: string;
  experimentConfig?: Record<string, unknown>;
  prompts?: Prompt[];
  nbSamples?: number;                          // limit items evaluated
  client?: OpikClient;                         // defaults to singleton
  scoringKeyMapping?: Record<string, string>;  // remap keys for metrics
}
```

**EvaluationResult** [T1]:
```typescript
type EvaluationResult = {
  experimentId: string;
  experimentName?: string;
  testResults: EvaluationTestResult[];
  resultUrl?: string;
}
```

#### `function evaluatePrompt(options: EvaluatePromptOptions): Promise<EvaluationResult>` [T1]

**File:** `sdks/typescript/src/opik/evaluation/evaluatePrompt.ts:80`

Convenience wrapper for prompt template evaluation. Formats `{{placeholders}}` in messages with dataset item fields, generates LLM responses, scores results.

**EvaluatePromptOptions** [T1] (extends EvaluateOptions minus `task`):
```typescript
interface EvaluatePromptOptions extends Omit<EvaluateOptions, "task"> {
  messages: OpikMessage[];                          // required — templates with {{placeholders}}
  model?: SupportedModelId | LanguageModel | OpikBaseModel;  // defaults to gpt-4o
  templateType?: PromptType;                        // "mustache" (default) or "jinja2"
  temperature?: number;
  seed?: number;
}
```

**`OpikMessage`** [T1] — type alias for `ModelMessage` from the Vercel AI SDK (`"ai"` package). Discriminated union by `role`:

**File:** `sdks/typescript/src/opik/evaluation/models/OpikBaseModel.ts`

| Role | Type Alias | Content |
|------|-----------|---------|
| `"system"` | `OpikSystemMessage` | `string` |
| `"user"` | `OpikUserMessage` | `string \| UserContent` (text, image, file parts) |
| `"assistant"` | `OpikAssistantMessage` | `string \| AssistantContent` (text, tool call, reasoning parts) |
| `"tool"` | `OpikToolMessage` | `ToolContent` (tool result parts) |

Minimal usage: `{ role: "user", content: "Answer: {{question}}" }`

#### `abstract class BaseMetric` [T1]

**File:** `sdks/typescript/src/opik/evaluation/metrics/BaseMetric.ts:8`

```typescript
abstract class BaseMetric<T extends z.ZodObject<z.ZodRawShape>> {
  readonly name: string;
  readonly trackMetric: boolean;
  abstract readonly validationSchema: T;
  abstract score(input: unknown): EvaluationScoreResult | EvaluationScoreResult[]
    | Promise<EvaluationScoreResult> | Promise<EvaluationScoreResult[]>;
}
```

**EvaluationScoreResult** [T1]:
```typescript
type EvaluationScoreResult = {
  name: string;
  value: number;           // typically 0.0–1.0
  reason?: string;
  scoringFailed?: boolean;
}
```

**Built-in heuristic metrics** [T1]:

| Metric | Constructor | Default Name |
|--------|------------|--------------|
| `Contains` | `constructor(name = "contains", trackMetric = true, caseSensitive = false)` | `"contains"` |
| `ExactMatch` | `constructor(name = "exact_match", trackMetric = true)` | `"exact_match"` |
| `IsJson` | `constructor(name = "is_json_metric", trackMetric = true)` | `"is_json_metric"` |
| `RegexMatch` | `constructor(name = "regex_match", trackMetric = true)` | `"regex_match"` |

All heuristic metrics use **positional parameters** (not an options object). Example: `new Contains("has_keyword")`, not `new Contains({ name: "has_keyword" })`.

**Built-in LLM judge metrics** [T1]: `Moderation`, `Hallucination`, `Usefulness`, `AnswerRelevance`

#### `class BaseLLMJudgeMetric` (abstract) [T1]

**File:** `sdks/typescript/src/opik/evaluation/metrics/llmJudges/BaseLLMJudgeMetric.ts:53`

Base for LLM-powered evaluation metrics. Provides model initialization, settings management (temperature, seed, maxTokens). [T2: comprehensive JSDoc with @example]

#### Models [T1]

- `class OpikBaseModel` — abstract base; subclass and implement `generateProviderResponse(messages, options?)`
- `class VercelAIChatModel` — Vercel AI SDK adapter; pass a `LanguageModel` or model ID string

#### Evaluation Usage Example [T1]

```typescript
import { Opik } from "opik";
import { evaluate } from "opik/evaluation";
import { Contains } from "opik/evaluation/metrics";

const client = new Opik();
const dataset = await client.getOrCreateDataset("qa-test");

const result = await evaluate({
  dataset,
  task: async (item) => {
    const response = await myLLM(item.question);
    return { output: response };
  },
  scoringMetrics: [new Contains("has_keyword")],
  experimentName: "baseline-v1",
});

console.log(result.resultUrl); // link to Opik UI
```

### Prompt System

#### `class BasePrompt` (abstract) [T1]

**File:** `sdks/typescript/src/opik/prompt/BasePrompt.ts:26`

[T2: JSDoc — "Abstract base class for all prompt types. Provides common functionality for versioning, property updates, and deletion."]

#### `class Prompt` [T1]

**File:** `sdks/typescript/src/opik/prompt/Prompt.ts:17`

Text-template prompt with mustache-style `{{variable}}` interpolation.

#### `class ChatPrompt` [T1]

**File:** `sdks/typescript/src/opik/prompt/ChatPrompt.ts:23`

Message-array prompt supporting system/user/assistant roles.

#### `class PromptVersion` [T1]

**File:** `sdks/typescript/src/opik/prompt/PromptVersion.ts:18`

Represents a specific version of a prompt with commit tracking.

### Dataset & Experiment

#### `class Dataset` [T1]

**File:** `sdks/typescript/src/opik/dataset/Dataset.ts:22`

Manages dataset items with CRUD operations and batch support.

#### `class Experiment` [T1]

**File:** `sdks/typescript/src/opik/experiment/Experiment.ts:25`

Tracks evaluation experiment results linked to datasets.

### Query Language

#### `class OpikQueryLanguage` [T1]

**File:** `sdks/typescript/src/opik/query/OpikQueryLanguage.ts:37`

OQL parser for filtering traces, prompts, and other entities. Format: `<COLUMN> <OPERATOR> <VALUE> [AND ...]`

```typescript
constructor(queryString?: string) // optional — parses the query; defaults to empty (no filters)
```

### Error Hierarchy [T1]

- `OpikError` (base) → `JsonParseError`, `JsonNotArrayError`, `JsonItemNotObjectError`
- → `DatasetNotFoundError`, `DatasetItemMissingIdError`, `DatasetItemUpdateError`
- → `ExperimentNotFoundError`, `ExperimentConfigError`
- → `SearchTimeoutError`
- `PromptNotFoundError`, `PromptPlaceholderError`, `PromptValidationError`, `PromptTemplateStructureMismatch`
- Evaluation: `MetricError`, `MetricComputationError`, `JSONParsingError`, `ModelError`, `ModelGenerationError`, `ModelConfigurationError`

### Utility Exports [T1]

- `generateId()` — UUID generation
- `flushAll()` — flush all OpikClient instances
- `logger` — tslog logger instance
- `setLoggerLevel(level: keyof typeof logLevels)` — set minimum log level. Valid levels: `"SILLY" | "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL"`. Default: `"INFO"` (overridable via `OPIK_LOG_LEVEL` env var).
- `disableLogger()` — suppress all log output

---

## Source 2: ACE TypeScript Framework (kayba-ai/ace-ts)

### Skillbook

#### `interface Skill` [T1]

**File:** `src/skillbook.ts`

```typescript
interface Skill {
  id: string;
  section: string;
  content: string;
  helpful: number;
  harmful: number;
  neutral: number;
  created_at: string;
  updated_at: string;
  embedding?: number[];
  status: "active" | "invalid";
}
```

#### `class Skillbook` [T1]

**File:** `src/skillbook.ts`

Central storage for learned strategies/skills. Supports serialization, persistence, and update batches.

```typescript
constructor() // empty skillbook
```

**Key methods:** [T1]
- `addSkill(section, content, skillId?, metadata?): Skill`
- `updateSkill(skillId, options: { content?, metadata? }): Skill | null`
- `tagSkill(skillId, tag, increment?): Skill | null`
- `removeSkill(skillId, soft?): void`
- `getSkill(skillId): Skill | null`
- `skills(includeInvalid?): Skill[]`
- `applyUpdate(update: UpdateBatch): void`
- `asPrompt(): string` — JSON-encoded for LLM context
- `stats(): Record<string, any>`
- `saveToFile(path): void` / `static loadFromFile(path): Skillbook`
- `dumps(): string` / `static loads(data): Skillbook`
- `toDict()` / `static fromDict(payload): Skillbook`

#### `function createSkill` [T1]

```typescript
function createSkill(params: {
  id: string; section: string; content: string;
  helpful?: number; harmful?: number; neutral?: number;
  embedding?: number[]; status?: "active" | "invalid";
}): Skill
```

#### `function skillToLLMDict(skill: Skill): Record<string, any>` [T1]

### Roles (Agent Pipeline)

#### `class Agent` [T1]

**File:** `src/roles.ts`

LLM-powered agent that generates answers using skillbook context.

```typescript
constructor(llm: LLMClient, promptTemplate?: (params) => string)
```

**Methods:** [T1]
- `async generate(params: { question, context?, skillbook, reflection? }): Promise<AgentOutput>`

**AgentOutput** [T1]:
```typescript
interface AgentOutput {
  reasoning: string;
  final_answer: string;
  skill_ids: string[];
  raw?: Record<string, any>;
}
```

#### `class ReplayAgent` [T1]

**File:** `src/roles.ts`

Deterministic agent for testing — returns pre-configured responses.

```typescript
constructor(responses?: Record<string, string>, defaultResponse?: string)
```

#### `class Reflector` [T1]

**File:** `src/roles.ts`

Analyzes agent performance and extracts learnings.

```typescript
constructor(llm: LLMClient, promptTemplate?: (params) => string)
```

**Methods:** [T1]
- `async reflect(params: { question, generatorAnswer, feedback, groundTruth?, skillbook }): Promise<ReflectorOutput>`

**ReflectorOutput** [T1]:
```typescript
interface ReflectorOutput {
  analysis: string;
  helpful_skill_ids: string[];
  harmful_skill_ids: string[];
  new_learnings: Array<{ section: string; content: string; atomicity_score: number; }>;
  reflection_quality?: { root_cause_identified: boolean; learnings_actionable: boolean; evidence_based: boolean; };
}
```

#### `class SkillManager` [T1]

**File:** `src/roles.ts`

Curates skillbook updates from reflections.

```typescript
constructor(llm: LLMClient, promptTemplate?: (params) => string)
```

**Methods:** [T1]
- `async curate(params: { reflectionAnalysis, skillbook }): Promise<UpdateBatch>`

#### `function extractCitedSkillIds(text: string): string[]` [T1]

Extracts `[section-00001]` style skill ID citations from text.

### Adaptation Loops

#### `interface ACEConfig` [T1]

```typescript
interface ACEConfig {
  skillbook?: Skillbook;
  agent: Agent;
  reflector: Reflector;
  skillManager: SkillManager;
  maxRefinementRounds?: number; // default: 1
  reflectionWindow?: number;   // default: 3
}
```

#### `class OfflineACE` [T1]

**File:** `src/adaptation.ts`

Multi-epoch training over a fixed dataset.

```typescript
constructor(config: ACEConfig)
```

**Methods:** [T1]
- `async run(samples: Sample[], environment: TaskEnvironment, options?: { epochs?, checkpointInterval?, checkpointDir? }): Promise<ACEStepResult[]>`
- `getSkillbook(): Skillbook`

#### `class OnlineACE` [T1]

**File:** `src/adaptation.ts`

Sequential learning from streaming samples (single pass).

```typescript
constructor(config: ACEConfig)
```

**Methods:** [T1]
- `async run(samples: Sample[], environment: TaskEnvironment): Promise<ACEStepResult[]>`
- `getSkillbook(): Skillbook`

#### `interface Sample` [T1]

```typescript
interface Sample {
  question: string;
  context?: string;
  groundTruth?: string;
  metadata?: Record<string, any>;
}
```

#### `interface TaskEnvironment` [T1]

```typescript
interface TaskEnvironment {
  evaluate(sample: Sample, agentOutput: AgentOutput): EnvironmentResult;
}
```

#### `class SimpleEnvironment` [T1]

**File:** `src/adaptation.ts:96`

Default environment: exact string match against `groundTruth`. No constructor parameters (parameterless).

```typescript
constructor() // no parameters
```

### LLM Clients

> **DISAMBIGUATION:** ACE exports two `VercelAIClient` classes. Use the **simple** one
> (`llm.ts`) when constructing `Agent`/`Reflector`/`SkillManager` — it accepts a Vercel AI
> `LanguageModel` directly. Use the **provider** one (`llm_providers/`) when you need
> full configuration (temperature, retries, fallbacks, streaming). The provider version is
> re-exported as `VercelAIProviderClient` from the package root to avoid name collision. [T1]

#### `abstract class LLMClient` [T1]

**File:** `src/llm.ts`

```typescript
constructor(model?: string)
abstract complete(prompt: string, options?: any): Promise<LLMResponse>
```

#### `class VercelAIClient` (simple — for role constructors) [T1]

**File:** `src/llm.ts`
**Import:** `import { VercelAIClient } from "@kayba/ace-framework"`

```typescript
constructor(params: { model: LanguageModel; defaultOptions?: any })
```
Methods: `complete(prompt, options?)`, `completeStructured<T>(prompt, schema, options?)`

#### `class VercelAIProviderClient` (full-featured — for advanced config) [T1]

**File:** `src/llm_providers/vercel_ai_client.ts`
**Import:** `import { VercelAIProviderClient } from "@kayba/ace-framework"`

```typescript
constructor(config: VercelAIConfig)
```

**VercelAIConfig** [T1]:
```typescript
interface VercelAIConfig {
  model: string | LanguageModel;
  provider?: "openai" | "anthropic" | "google" | "custom";
  apiKey?: string; temperature?: number; maxTokens?: number;
  topP?: number; timeout?: number; maxRetries?: number;
  fallbacks?: string[]; metadata?: Record<string, any>;
  trackCost?: boolean; maxBudget?: number; verbose?: boolean;
  // ... additional config
}
```

Methods: `complete(prompt, options?)`, `completeWithStream(prompt, options?)`, `static listModels()`, `static resolveSamplingParams(...)`

#### `function createLLMClient` [T1]

```typescript
async function createLLMClient(params: {
  provider: "openai" | "anthropic" | "google" | "custom";
  model: string; apiKey?: string; options?: any;
}): Promise<VercelAIClient>
```

#### `function createVercelAIClient` [T1]

```typescript
function createVercelAIClient(params: {
  provider: "openai" | "anthropic" | "google";
  model: string; apiKey?: string;
  temperature?: number; maxTokens?: number;
  options?: Partial<VercelAIConfig>;
}): VercelAIClient
```

### Integrations

#### `function wrapSkillbookContext(skillbook: Skillbook): string` [T1]

**File:** `src/integrations/base.ts`

[T2: 87-line architectural JSDoc — "Base classes and utilities for ACE integrations with external agentic frameworks."]

Formats skillbook as injectable context text for external agents. Returns empty string if no skills.

**Integration pattern** [T2]:
1. **INJECT:** `wrapSkillbookContext(skillbook)` → append to agent input
2. **EXECUTE:** External agent runs normally
3. **LEARN:** ACE analyzes results and updates skillbook

#### `class ACEAgent` [T1]

**File:** `src/integrations/simple.ts`

High-level wrapper combining Agent + Reflector + SkillManager with auto-learning.

```typescript
constructor(config: { model: LanguageModel; skillbookPath?: string; skillbook?: Skillbook; modelOptions?: any; })
```

**Methods:** [T1]
- `async ask(question: string, context?: string): Promise<string>` — ask + auto-learn
- `saveSkillbook(path: string): void`
- `static fromSkillbook(skillbookPath, model, modelOptions?): ACEAgent`
- `getStats(): Record<string, any>`

### Observability (Opik Integration)

#### `class OpikIntegration` [T1]

**File:** `src/observability/opik_integration.ts`

Bridges ACE framework events to Opik tracing.

```typescript
constructor(projectName?: string, enableAutoConfig?: boolean, tags?: string[])
```

**Methods:** [T1]
- `logSkillEvolution(skillId, content, helpful, harmful, neutral, section, metadata?): void`
- `logSkillbookUpdate(operationType, skillsAdded?, skillsUpdated?, skillsRemoved?, totalSkills?, metadata?): void`
- `logRolePerformance(roleName, executionTime, success, inputData?, outputData?, metadata?): void`
- `logAdaptationMetrics(epoch, step, performanceScore, skillCount, successfulPredictions, totalPredictions, metadata?): void`
- `createExperiment(name, description?, metadata?): void`
- `setupVercelAICallback(): boolean`
- `isAvailable(): boolean`
- `flush(): Promise<void>`

#### Global Functions [T1]

- `configureOpik(projectName?, tags?): OpikIntegration`
- `getIntegration(): OpikIntegration`
- `OPIK_AVAILABLE: boolean`

#### Decorator Functions [T1]

- `aceTrack(name?, metadata?): MethodDecorator` — decorates methods with Opik tracing
- `trackRole(roleName): MethodDecorator` — specialized role tracking
- `maybeTrack(fn, name?, metadata?): Function` — conditional tracking wrapper

### Feature Detection [T1]

**File:** `src/features.ts`

- `hasVercelAI(): boolean`, `hasOpenAI(): boolean`, `hasAnthropic(): boolean`
- `hasGoogleAI(): boolean`, `hasLangChain(): boolean`
- `hasPlaywright(): boolean`, `hasPuppeteer(): boolean`
- `hasZod(): boolean`, `hasDotenv(): boolean`, `hasOpik(): boolean`
- `getAvailableFeatures(): Record<string, boolean>`
- `printFeatureStatus(): void`
- `clearFeatureCache(): void`

### Async Learning [T1]

#### `class ThreadSafeSkillbook` [T1]

**File:** `src/async_learning.ts`

Lock-based thread-safe wrapper around Skillbook for concurrent access.

```typescript
constructor(skillbook: Skillbook)
```

**Read methods (lock-free):** `asPrompt()`, `skills()`, `getSkill(id)`, `stats()`

**Write methods (locked):** [T1]
- `async applyUpdate(update: UpdateBatch): Promise<void>`
- `async tagSkill(skillId: string, tag: string, increment?: number): Promise<Skill | null>`
- `async addSkill(section: string, content: string, skillId?: string, metadata?: Record<string, number>): Promise<Skill>`
- `async updateSkill(skillId: string, options: { content?: string; metadata?: Record<string, number> }): Promise<Skill | null>`
- `async removeSkill(skillId: string): Promise<void>`

#### `class AsyncLearningPipeline` [T1]

**File:** `src/async_learning.ts`

Parallel reflection with serialized skill updates.

```typescript
constructor(options: AsyncLearningPipelineOptions)
```

**Methods:** [T1]
- `start(): void`, `stop(wait?, timeout?): Promise<number>`, `isRunning(): boolean`
- `submit(task: LearningTask): Promise<void> | null`
- `waitForCompletion(timeout?): Promise<boolean>`
- `get stats(): AsyncLearningPipelineStats`

### Deduplication System [T1]

#### `class SimilarityDetector` [T1]

**File:** `src/deduplication/detector.ts:16`

Finds similar skill pairs via embedding comparison.

```typescript
constructor(config?: DeduplicationConfig) // defaults to createDeduplicationConfig()
```

#### `class DeduplicationManager` [T1]

**File:** `src/deduplication/manager.ts:38`

Orchestrates dedup with LLM-based decisions.

```typescript
constructor(config?: DeduplicationConfig) // defaults to createDeduplicationConfig(); also creates internal SimilarityDetector
```

- `createDeduplicationConfig(overrides?): DeduplicationConfig`
- `applyConsolidationOperations(skillbook, operations): void`
- `generateSimilarityReport(similarPairs: Array<[Skill, Skill, number]>): string` — each tuple is `[skillA, skillB, similarityScore]`

### Updates System [T1]

**`OperationType`** [T1]: `"ADD" | "UPDATE" | "TAG" | "REMOVE"`

**`interface UpdateOperation`** [T1]:
```typescript
interface UpdateOperation {
  type: OperationType;
  section: string;
  content?: string;
  skill_id?: string;
  metadata?: Record<string, number>;
}
```

**`interface UpdateBatch`** [T1]:
```typescript
interface UpdateBatch {
  reasoning: string;
  operations: UpdateOperation[];
}
```

- `createUpdateOperation(params: { type: OperationType; section: string; content?: string; skill_id?: string; metadata?: Record<string, number> }): UpdateOperation`
- `createUpdateBatch(operations: UpdateOperation[]): UpdateBatch`
- `updateOperationFromJSON(json) / updateBatchFromJSON(json)`
- `updateOperationToJSON(op) / updateBatchToJSON(batch)`

### Prompt Templates [T1]

**v1 (prompts.ts):** `createAgentPrompt`, `createReflectorPrompt`, `createSkillManagerPrompt`, `wrapSkillbookForExternalAgent`, `SKILLBOOK_USAGE_INSTRUCTIONS`

**v2 (prompts_v2.ts):** `AGENT_V2_PROMPT`, `REFLECTOR_V2_PROMPT`, `SKILL_MANAGER_V2_PROMPT`, `CURATOR_V2_PROMPT`, domain-specific (MATH, CODE), `PromptManager`, `validatePromptOutput`

**v2.1 (prompts_v2_1.ts):** [T2: "+17% success rate"] `AGENT_V2_1_PROMPT`, `REFLECTOR_V2_1_PROMPT`, `SKILL_MANAGER_V2_1_PROMPT`, domain-specific, `PromptManagerV21`, `validatePromptOutputV21`, `comparePromptVersions`

---

## Usage Patterns

### Pattern 1: Basic Opik Tracing [T1+T3]

```typescript
import { Opik } from "opik";

const client = new Opik({
  apiKey: process.env.OPIK_API_KEY,
  projectName: "my-project",
});

const trace = client.trace({ name: "my-operation", input: { prompt: "Hello" } });
const span = trace.span({ name: "llm-call", type: "llm" });
span.update({ output: { text: "World" }, usage: { prompt_tokens: 5, completion_tokens: 3 } });
span.end();
trace.update({ output: { response: "World" } });
trace.end();
await client.flush();
```

### Pattern 2: Vercel AI + Opik Tracing [T1+T3]

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { OpikExporter } from "opik-vercel";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  traceExporter: new OpikExporter({ tags: ["production"] }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell a joke",
  experimental_telemetry: OpikExporter.getSettings({ name: "joke-gen" }),
});
```

### Pattern 3: Function Tracking with Decorator [T1]

```typescript
import { track, Opik } from "opik";

const traced = track({ name: "my-fn", type: "llm" }, async (input: string) => {
  return await callLLM(input);
});

// Or as class decorator:
class MyService {
  @track({ name: "process" })
  async process(data: string) { /* ... */ }
}
```

### Pattern 4: ACE Self-Improving Agent [T1]

```typescript
import { ACEAgent } from "ace-ts";
import { openai } from "@ai-sdk/openai";

const agent = new ACEAgent({ model: openai("gpt-4o-mini") });

// Agent auto-learns from each interaction
const answer1 = await agent.ask("If all cats are animals, is Felix an animal?");
const answer2 = await agent.ask("If all birds fly, can penguins fly?");

console.log(`Learned ${agent.skillbook.skills().length} skills`);
agent.saveSkillbook("trained.json");
```

### Pattern 5: Offline ACE Training Pipeline [T1]

```typescript
import { OfflineACE, Agent, Reflector, SkillManager, VercelAIClient } from "ace-ts";
import { openai } from "@ai-sdk/openai";

const client = new VercelAIClient({ model: openai("gpt-4") });
const ace = new OfflineACE({
  agent: new Agent(client),
  reflector: new Reflector(client),
  skillManager: new SkillManager(client),
});

const results = await ace.run(samples, environment, { epochs: 3 });
ace.getSkillbook().saveToFile("trained_skillbook.json");
```

### Pattern 6: ACE + External Agent Integration [T1]

```typescript
import { Skillbook, wrapSkillbookContext } from "ace-ts";

const skillbook = Skillbook.loadFromFile("trained.json");
const context = wrapSkillbookContext(skillbook);

// Inject into any external agent
const enhancedPrompt = `${task}\n\n${context}`;
const result = await externalAgent.execute(enhancedPrompt);
```

### Pattern 7: ACE + Opik Observability [T1]

**Setup order matters:** Configure Opik *before* creating ACE roles or using decorators.

```typescript
import { configureOpik, aceTrack, OpikIntegration } from "@kayba/ace-framework";
import { VercelAIClient, Agent, Reflector, SkillManager, OfflineACE } from "@kayba/ace-framework";
import { openai } from "@ai-sdk/openai";

// Step 1: Configure Opik FIRST (creates global integration)
const integration = configureOpik("my-ace-project", ["training"]);

// Step 2: Verify availability
if (!integration.isAvailable()) {
  console.warn("Opik package not installed — observability disabled");
}

// Step 3: Create roles (will use the configured integration)
const client = new VercelAIClient({ model: openai("gpt-4o") });
const agent = new Agent(client);
const reflector = new Reflector(client);
const skillManager = new SkillManager(client);

// Step 4: Run ACE — adaptation metrics auto-logged to Opik
const ace = new OfflineACE({ agent, reflector, skillManager });
const results = await ace.run(samples, environment, { epochs: 3 });

// Step 5: Flush traces
await integration.flush();
```

**Decorator usage** (requires Step 1 already done) [T1]:
```typescript
class MyService {
  @aceTrack("custom-operation")
  async process(input: string) { /* ... */ }
}
```

### Pattern 8: Opik Evaluation Pipeline [T1]

```typescript
import { Opik } from "opik";

const client = new Opik();
const dataset = await client.getOrCreateDataset("eval-data");
const experiment = await client.createExperiment({
  datasetName: "eval-data",
  name: "baseline-v1",
});
```

---

## API Surface

### Package: `opik` [T1]

**Entry point:** `sdks/typescript/src/opik/index.ts`

| Export | Type | Source |
|--------|------|--------|
| `Opik` (alias of OpikClient) | class | client/Client.ts |
| `OpikConfig` | type | config/Config.ts |
| `track`, `getTrackContext` | function | decorators/track.ts |
| `generateId` | function | utils/generateId.ts |
| `flushAll` | function | utils/flushAll.ts |
| `logger`, `setLoggerLevel`, `disableLogger` | function | utils/logger.ts |
| `Span` | type | tracer/Span.ts |
| `Trace` | type | tracer/Trace.ts |
| `OpikSpanType` | enum-like | rest_api/api/types/SpanType.ts |
| `DatasetPublic` | type | rest_api/api/types/ |
| `Prompt`, `PromptType` | class/type | prompt/ |
| `OpikQueryLanguage`, `FilterExpression` | class/type | query/ |
| `z` | re-export | zod |
| `evaluation/*` | module | evaluation/ |

### Package: `opik-vercel` [T1]

**Entry point:** `sdks/typescript/src/opik/integrations/opik-vercel/`

| Export | Type |
|--------|------|
| `OpikExporter` | class (SpanExporter) |

### Package: `ace-ts` [T1]

**Entry point:** `src/index.ts`

| Export | Type | Source |
|--------|------|--------|
| `Skillbook`, `createSkill`, `skillToLLMDict` | class/function | skillbook.ts |
| `Skill`, `SimilarityDecision` | type | skillbook.ts |
| `Agent`, `ReplayAgent`, `Reflector`, `SkillManager` | class | roles.ts |
| `AgentOutput`, `ReflectorOutput` | type | roles.ts |
| `extractCitedSkillIds` | function | roles.ts |
| `OfflineACE`, `OnlineACE`, `SimpleEnvironment` | class | adaptation.ts |
| `Sample`, `EnvironmentResult`, `TaskEnvironment`, `ACEStepResult`, `ACEConfig` | type | adaptation.ts |
| `LLMClient`, `DummyLLMClient`, `VercelAIClient` | class | llm.ts |
| `LLMResponse` | type | llm.ts |
| `createLLMClient` | function | llm.ts |
| `ACEAgent` | class | integrations/simple.ts |
| `wrapSkillbookContext` | function | integrations/base.ts |
| `VercelAIProviderClient`, `createVercelAIClient` | class/function | llm_providers/ |
| `VercelAIConfig` | type | llm_providers/ |
| `OpikIntegration`, `configureOpik`, `getIntegration`, `OPIK_AVAILABLE` | class/function | observability/ |
| `aceTrack`, `trackRole`, `maybeTrack` | function | observability/ |
| `ThreadSafeSkillbook`, `AsyncLearningPipeline` | class | async_learning.ts |
| `SimilarityDetector`, `DeduplicationManager` | class | deduplication/ |
| `hasVercelAI`, `hasOpenAI`, `hasAnthropic`, ... | function | features.ts |
| `PromptManager`, `PromptManagerV21` | class | prompts_v2.ts, prompts_v2_1.ts |
| Prompt constants: `AGENT_V2_PROMPT`, `REFLECTOR_V2_PROMPT`, ... | const | prompts_v2.ts |
| v2.1 prompts: `AGENT_V2_1_PROMPT`, ... | const | prompts_v2_1.ts |
| `UpdateOperation`, `UpdateBatch`, update helpers | type/function | updates.ts |
| `DeduplicationConfig`, dedup helpers | type/function | deduplication/ |

---

## Version Context [T3]

- **comet-ml/opik:** v1.10.1 (2026-01-30) — latest stable release
- **kayba-ai/ace-ts:** pre-release (no tagged releases)

---

## References

For detailed per-module documentation, see source files:

- [`OpikClient`](comet-ml/opik/sdks/typescript/src/opik/client/Client.ts)
- [`OpikExporter`](comet-ml/opik/sdks/typescript/src/opik/integrations/opik-vercel/src/exporter.ts)
- [`track decorator`](comet-ml/opik/sdks/typescript/src/opik/decorators/track.ts)
- [`Skillbook`](kayba-ai/ace-ts/src/skillbook.ts)
- [`Agent/Reflector/SkillManager`](kayba-ai/ace-ts/src/roles.ts)
- [`OfflineACE/OnlineACE`](kayba-ai/ace-ts/src/adaptation.ts)
- [`ACEAgent`](kayba-ai/ace-ts/src/integrations/simple.ts)
- [`OpikIntegration`](kayba-ai/ace-ts/src/observability/opik_integration.ts)
- [`wrapSkillbookContext`](kayba-ai/ace-ts/src/integrations/base.ts)

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.

---

## Quick Reference

```bash
# Formatting + linting
bun x ultracite fix          # auto-fix
bun x ultracite check        # check only

# Type checking
bun run check-types          # all workspaces

# Secret scanning
gitleaks git --no-banner     # full repo history

# Spell checking
typos                        # check
typos --write-changes        # auto-fix

# Commit message validation
echo "feat: test" | bun x commitlint

# Dead code detection
bun run knip                 # report
bun x knip --fix             # auto-remove unused exports
```
