/**
 * @typedef {"code-architect" | "strategy-brief" | "structured-extraction" | "custom"} PromptPresetId
 */

/**
 * @typedef {object} PromptPreset
 * @property {PromptPresetId} id
 * @property {string} name
 * @property {string} signal
 * @property {string} goal
 * @property {string} audience
 * @property {string} tone
 * @property {string} role
 * @property {readonly string[]} requirements
 * @property {readonly string[]} outputContract
 * @property {string} qualityBar
 */

/** @type {readonly PromptPreset[]} */
export const promptPresets = Object.freeze([
  Object.freeze({
    id: "code-architect",
    name: "Code architect",
    signal: "Architecture",
    goal: "Design a production-ready API for a multi-tenant SaaS application",
    audience: "Senior backend engineers",
    tone: "Precise & technical",
    role: "You are a principal software architect experienced in secure, observable, multi-tenant production systems.",
    requirements: Object.freeze([
      "State the assumptions and workload boundaries that materially affect the design.",
      "Define component responsibilities, request and data flows, and tenant-isolation boundaries.",
      "Cover authentication, authorization, secrets, validation, rate limiting, and auditability.",
      "Describe failure modes, retries, idempotency, observability, and recovery behavior.",
      "Separate MVP decisions from scale-stage changes and explain the trigger for each change.",
      "Include concrete API, data-model, and acceptance-test examples where they improve precision.",
    ]),
    outputContract: Object.freeze([
      "Executive architecture summary",
      "System context and component responsibilities",
      "Request, data, and trust-boundary flows",
      "API and persistence design",
      "Reliability, security, and observability controls",
      "Implementation sequence and acceptance tests",
    ]),
    qualityBar: "The design must be implementable, internally consistent, explicit about tradeoffs, and free of invented requirements.",
  }),
  Object.freeze({
    id: "strategy-brief",
    name: "Strategy brief",
    signal: "Strategy",
    goal: "Create a go-to-market plan for a developer tooling startup",
    audience: "Founders and product leaders",
    tone: "Concise & executive",
    role: "You are a product strategy lead who turns incomplete market information into testable commercial decisions.",
    requirements: Object.freeze([
      "Separate known facts, assumptions, and open questions.",
      "Define the ideal customer profile, urgent problem, buying trigger, and credible initial wedge.",
      "Develop positioning against the status quo and realistic alternatives without unsupported market claims.",
      "Recommend acquisition motions, activation steps, pricing hypotheses, and retention loops.",
      "Prioritize experiments by expected learning value, cost, and reversibility.",
      "Define leading indicators, decision thresholds, risks, and a focused 90-day operating plan.",
    ]),
    outputContract: Object.freeze([
      "Decision summary",
      "Market hypothesis and ideal customer profile",
      "Positioning and differentiated wedge",
      "Acquisition, activation, pricing, and retention plan",
      "Prioritized experiments with success thresholds",
      "30/60/90-day plan, risks, and unresolved questions",
    ]),
    qualityBar: "The brief must distinguish evidence from assumptions, avoid fabricated market data, and end with measurable decisions.",
  }),
  Object.freeze({
    id: "structured-extraction",
    name: "Structured extraction",
    signal: "Extraction",
    goal: "Extract contracts into a validated JSON schema with citations",
    audience: "Data and compliance engineers",
    tone: "Precise & technical",
    role: "You are a document intelligence engineer specializing in auditable, schema-constrained information extraction.",
    requirements: Object.freeze([
      "Define the target JSON schema, field types, required fields, enums, and validation rules before extraction.",
      "Return valid JSON only for the extraction payload; do not include comments inside JSON.",
      "Attach a source locator or citation to every extracted factual value.",
      "Use null for missing or uncertain values and never infer unsupported facts.",
      "Normalize dates, currencies, parties, obligations, and identifiers without losing the source text.",
      "Report schema violations, conflicting evidence, and low-confidence fields separately.",
      "Include a compact validation checklist and representative edge cases.",
    ]),
    outputContract: Object.freeze([
      "Target JSON Schema",
      "Validated extraction payload",
      "Field-level evidence map",
      "Validation and normalization results",
      "Conflicts, missing fields, and confidence notes",
      "Edge cases and acceptance tests",
    ]),
    qualityBar: "The result must be deterministic, machine-parseable, traceable to source evidence, and explicit about uncertainty.",
  }),
]);

/** @type {PromptPreset} */
const customPreset = Object.freeze({
  id: "custom",
  name: "Custom workflow",
  signal: "Custom",
  goal: "",
  audience: "a professional delivery team",
  tone: "Precise & technical",
  role: "You are a senior AI delivery specialist who turns an objective into a clear, verifiable execution plan.",
  requirements: Object.freeze([
    "State material assumptions and unresolved questions.",
    "Break the objective into concrete responsibilities and execution steps.",
    "Identify constraints, dependencies, failure modes, and validation criteria.",
    "Use examples only when they improve precision.",
    "Call out tradeoffs and avoid unsupported claims.",
  ]),
  outputContract: Object.freeze([
    "Outcome summary",
    "Assumptions and constraints",
    "Recommended approach",
    "Implementation sequence",
    "Risks and validation criteria",
  ]),
  qualityBar: "The response must be actionable, internally consistent, and explicit about uncertainty.",
});

export const PROMPT_COMPILER_VERSION = "2026-09-pilot-1";

/**
 * @param {string} id
 * @returns {PromptPreset}
 */
export function getPromptPreset(id) {
  return promptPresets.find((preset) => preset.id === id) ?? customPreset;
}

/**
 * @param {string} goal
 * @returns {PromptPreset | undefined}
 */
export function findPromptPresetByGoal(goal) {
  return promptPresets.find((preset) => preset.goal === goal.trim());
}

/**
 * @param {{goal: string, audience: string, tone: string, presetId: string, outputFormat?: string}} input
 */
export function compilePrompt({ goal, audience, tone, presetId, outputFormat = "auto" }) {
  const preset = getPromptPreset(presetId);
  const objective = goal.trim() || "Describe the desired outcome";
  const intendedAudience = audience.trim() || preset.audience;
  const communicationStyle = tone.trim() || preset.tone;
  const jsonOnly = outputFormat === "json" || (outputFormat === "auto" && /\b(?:json[ -]only|only\s+(?:valid\s+)?json|(?:return|output|respond(?:\s+with)?)\s+(?:valid\s+)?json\s+only)\b/i.test(objective));
  const jsonRequirements = [
    "Return exactly one valid JSON value matching the fields and schema requested in the objective.",
    "Do not include Markdown fences, commentary, report sections, or extra keys outside the requested schema.",
    "Use null for missing or uncertain values; never invent facts.",
    "Include citations or validation details only if the requested schema provides fields for them.",
    "Check JSON syntax and required fields before returning the value.",
  ];
  const requirements = (jsonOnly ? jsonRequirements : preset.requirements).map((item) => `- ${item}`).join("\n");
  const outputContract = (jsonOnly ? ["A single JSON value, with no surrounding text."] : preset.outputContract).map((item, index) => `${index + 1}. ${item}`).join("\n");

  return `# Compiler version
${PROMPT_COMPILER_VERSION}

# Workflow
${preset.name}

# Role
${preset.role}

# Objective
${objective}

# Audience
Write for ${intendedAudience}. Use a ${communicationStyle.toLowerCase()} communication style.

# Output format
${jsonOnly ? "JSON only" : "Report"}

# Requirements
${requirements}

# Output contract
${outputContract}

# Quality bar
${jsonOnly ? "The complete response must parse as JSON and follow the requested schema. Preserve uncertainty without adding unrequested fields." : preset.qualityBar}`;
}

/** Restore the stored snapshot, never silently recompile an existing project.
 * The workflow header is persisted inside compiledPrompt, including legacy projects.
 * @param {{goal:string,audience:string,tone:string,model:string,compiledPrompt?:string}} project
 */
export function restorePromptProject(project) {
  const snapshot = typeof project.compiledPrompt === "string" && project.compiledPrompt.trim()
    ? project.compiledPrompt : null;
  const compilerVersion = snapshot?.match(/^# Compiler version\r?\n([^\r\n]+)/m)?.[1] ?? null;
  const workflow = snapshot?.match(/^# Workflow\r?\n([^\r\n]+)/m)?.[1];
  const preset = promptPresets.find(item => item.name === workflow)
    ?? (snapshot ? undefined : findPromptPresetByGoal(project.goal));
  const outputFormat = snapshot?.match(/^# Output format\r?\nJSON only$/m) ? "json"
    : snapshot?.match(/^# Output format\r?\nReport$/m) ? "report" : "auto";
  const presetId = preset?.id ?? "custom";
  return { ...project, presetId, outputFormat, compilerVersion,
    compiledPrompt: snapshot ?? compilePrompt({ ...project, presetId, outputFormat }) };
}

/** @param {{title:string,goal:string,audience:string,tone:string,model:string,compiledPrompt:string}} project */
export function projectDraftKey(project) {
  return JSON.stringify([project.title, project.goal, project.audience, project.tone, project.model, project.compiledPrompt]);
}
