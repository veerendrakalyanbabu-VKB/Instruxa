import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compilePrompt,
  findPromptPresetByGoal,
  getPromptPreset,
  promptPresets,
} from "../lib/prompt-compiler.mjs";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("quick-start presets compile distinct prompt contracts", () => {
  const outputs = promptPresets.map((preset) =>
    compilePrompt({
      goal: preset.goal,
      audience: preset.audience,
      tone: preset.tone,
      presetId: preset.id,
    }),
  );

  assert.equal(new Set(outputs).size, promptPresets.length);
  assert.match(outputs[0], /System context and component responsibilities/);
  assert.match(outputs[0], /tenant-isolation boundaries/);
  assert.match(outputs[1], /Market hypothesis and ideal customer profile/);
  assert.match(outputs[1], /30\/60\/90-day plan/);
  assert.match(outputs[2], /Validated extraction payload/);
  assert.match(outputs[2], /valid JSON only/);
});

test("each compiled prompt includes its selected workflow and configured fields", () => {
  for (const preset of promptPresets) {
    const output = compilePrompt({
      goal: preset.goal,
      audience: preset.audience,
      tone: preset.tone,
      presetId: preset.id,
    });

    assert.match(output, new RegExp(`# Workflow\\n${preset.name}`));
    assert.ok(output.includes(preset.goal));
    assert.ok(output.includes(preset.audience));
    assert.ok(output.includes(preset.role));
    assert.equal((output.match(/^\d+\. /gm) ?? []).length, preset.outputContract.length);
  }
});

test("saved preset goals recover the correct compiler workflow", () => {
  for (const preset of promptPresets) {
    assert.equal(findPromptPresetByGoal(preset.goal)?.id, preset.id);
  }
  assert.equal(findPromptPresetByGoal("A completely custom objective"), undefined);
  assert.equal(getPromptPreset("unknown").id, "custom");
});

test("studio applies the complete preset and exposes active selection", () => {
  assert.match(page, /function applyPreset\(id:string\)/);
  assert.match(page, /setAudience\(preset\.audience\)/);
  assert.match(page, /setTone\(preset\.tone\)/);
  assert.match(page, /aria-pressed=\{presetId===id\}/);
  assert.match(page, /compilePrompt\(\{goal,audience,tone,presetId\}\)/);
});
