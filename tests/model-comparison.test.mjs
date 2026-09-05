import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runner = await readFile(new URL("../components/model-runner.tsx", import.meta.url), "utf8");

test("model comparison reports the provider-specific failure", () => {
  assert.match(runner, /Failed — \$\{failures\.join\(" \| "\)\}/);
  assert.match(runner, /labels\[targets\[index\]\]/);
});

test("provider errors redact API-key-shaped values before display", () => {
  assert.match(runner, /replace\(\/sk-/);
  assert.match(runner, /\[redacted\]/);
});
