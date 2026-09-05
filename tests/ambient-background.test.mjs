import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("components/ambient-background.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("renders the ambient background as a non-interactive visual layer", () => {
  assert.match(page, /<AmbientBackground\s*\/>/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(css, /\.motion-world\s*\{/);
  assert.match(css, /pointer-events:\s*none/);
});

test("honors reduced-motion preferences", () => {
  assert.match(component, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none\s*!important/);
});
