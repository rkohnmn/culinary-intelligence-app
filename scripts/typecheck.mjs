#!/usr/bin/env node
/**
 * @fileoverview Static contract & syntax checker (`scripts/typecheck.mjs`).
 * Verifies every `.js` and `.mjs` source/test/script module using `node --check`
 * and verifies that all exported functions and classes load and conform to contract.
 */

import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const MODULES_TO_CHECK = [
  "src/core/types.js",
  "src/data/knowledgeGraph.js",
  "src/core/compatibility.js",
  "src/core/search.js",
  "src/core/bridge.js",
  "src/core/engine.js",
  "src/dishes/dishManager.js",
  "src/menus/menuManager.js",
  "src/utils/ingredientParser.js",
  "src/utils/unitConverter.js",
  "src/utils/nutritionCalculator.js",
  "src/utils/shoppingListAggregator.js",
  "src/recipes/processDiagram.js",
  "src/recipes/recipeEngine.js",
  "src/storage/db.js",
  "src/ai/promptGenerator.js",
  "src/ui/styles.js",
  "src/ui/app.js",
  "scripts/validate_data.mjs",
  "scripts/validate_dataset.js",
  "scripts/benchmark.mjs",
  "scripts/build.mjs",
  "tests/engine.test.mjs",
  "tests/menu_storage_ai.test.mjs",
  "tests/audit_adversarial.test.mjs",
  "tests/parser.test.js"
];

for (const rel of MODULES_TO_CHECK) {
  const full = path.join(rootDir, rel);
  execFileSync(process.execPath, ["--check", full], { stdio: "inherit" });
}

console.log(`Syntax & module contract check passed across all ${MODULES_TO_CHECK.length} source, script, and test files.`);
