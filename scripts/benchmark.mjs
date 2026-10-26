#!/usr/bin/env node
/**
 * @fileoverview Performance Benchmarking Suite (`scripts/benchmark.mjs`).
 *
 * Implements Requirement 16.3 & 16.4:
 * Benchmarks representative operations across the production culinary knowledge base
 * (491 canonical ingredients, 1,338 pairing relationships, 1,682 aliases, 34 sauces, 24 sides):
 * 1. Autocomplete over the initial ingredient corpus (prefix, alias, fuzzy)
 * 2. Direct & parent-inherited pairing lookup
 * 3. Ranking recommendations for 1 selected ingredient
 * 4. Ranking recommendations for 5+ selected ingredients
 * 5. Recalculating after adding an intentionally challenging ingredient (override)
 * 6. Bridge discovery over a multi-ingredient conflict state
 * 7. Removing ingredients and recalculating
 * 8. Evaluating multiple dishes in a 4-course menu
 *
 * Evaluates the C++/WebAssembly decision gate based on actual P50/P95/mean latency.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { CulinaryKnowledgeGraph } from "../src/data/knowledgeGraph.js";
import { CulinaryEngine } from "../src/core/engine.js";
import { findBridgeSuggestions } from "../src/core/bridge.js";
import {
  createDish,
  addIngredientToDish,
  removeIngredientFromDish
} from "../src/dishes/dishManager.js";
import {
  createMenu,
  addDishToMenu,
  evaluateMenu
} from "../src/menus/menuManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../public/data");

const dataset = {
  sources: JSON.parse(fs.readFileSync(path.join(dataDir, "sources.json"), "utf8")),
  cuisines: JSON.parse(fs.readFileSync(path.join(dataDir, "cuisines.json"), "utf8")),
  ingredients: JSON.parse(fs.readFileSync(path.join(dataDir, "ingredients.json"), "utf8")),
  sauces: JSON.parse(fs.readFileSync(path.join(dataDir, "sauces.json"), "utf8")),
  sides: JSON.parse(fs.readFileSync(path.join(dataDir, "sides.json"), "utf8")),
  pairings: JSON.parse(fs.readFileSync(path.join(dataDir, "pairings.json"), "utf8"))
};

function runBenchmark(name, iterations, fn) {
  // Warmup
  for (let i = 0; i < Math.min(10, iterations); i++) fn();

  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const mean = sum / samples.length;
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];

  return {
    name,
    iterations,
    meanMs: Number(mean.toFixed(3)),
    p50Ms: Number(p50.toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    p99Ms: Number(p99.toFixed(3))
  };
}

const initStart = performance.now();
const graph = new CulinaryKnowledgeGraph(dataset);
const engine = new CulinaryEngine(graph);
const initMs = Number((performance.now() - initStart).toFixed(3));

// Prepare fixture states
let dish1 = addIngredientToDish(graph, createDish({ name: "1-Ing Dish" }), "ing_beef_ribeye");

let dish5 = createDish({ name: "5-Ing Dish", cuisineIds: ["cuisine_french"] });
for (const id of [
  "ing_duck_breast",
  "ing_shallot",
  "ing_thyme_fresh",
  "ing_wine_red",
  "ing_butter_unsalted",
  "ing_mushroom_chanterelle"
]) {
  dish5 = addIngredientToDish(graph, dish5, id);
}

let dishOverride = addIngredientToDish(
  graph,
  dish5,
  "ing_blue_cheese",
  { isOverride: true, overrideReason: "Benchmark override" }
);

let dishConflict = createDish({ name: "Conflict Dish" });
dishConflict = addIngredientToDish(graph, dishConflict, "ing_cod_halibut");
dishConflict = addIngredientToDish(graph, dishConflict, "ing_butter_unsalted");
dishConflict = addIngredientToDish(graph, dishConflict, "ing_blue_cheese", { isOverride: true });

let menu4 = createMenu({ name: "4-Course Benchmark Menu" });
menu4 = addDishToMenu(menu4, dish1, { courseType: "appetizer" });
menu4 = addDishToMenu(menu4, dish5, { courseType: "main_course" });
menu4 = addDishToMenu(menu4, dishConflict, { courseType: "side" });
menu4 = addDishToMenu(menu4, dishOverride, { courseType: "cheese_intermezzo" });

const results = [
  runBenchmark("1. Autocomplete over corpus (prefix + context)", 100, () => {
    engine.searchIngredients("garl", dish1);
  }),
  runBenchmark("2. Direct & inherited pairing lookup (100 lookups/op)", 200, () => {
    for (let i = 0; i < 100; i++) {
      graph.getPairing("ing_beef_ribeye", "ing_garlic");
      graph.getPairing("ing_lemon_preserved", "ing_lamb_shoulder");
    }
  }),
  runBenchmark("3. Full recommendation ranking (1 selected ingredient)", 50, () => {
    engine.recommendIngredients(dish1);
  }),
  runBenchmark("4. Full recommendation ranking (6 selected ingredients)", 50, () => {
    engine.recommendIngredients(dish5);
  }),
  runBenchmark("5. Recalculating after challenging override (7 ingredients)", 50, () => {
    engine.evaluateDish(dishOverride);
  }),
  runBenchmark("6. Bridge discovery on multi-ingredient conflict", 100, () => {
    findBridgeSuggestions(graph, dishConflict);
  }),
  runBenchmark("7. Removing ingredient & full dish re-evaluation", 50, () => {
    const dRemoved = removeIngredientFromDish(dishOverride, "ing_blue_cheese");
    engine.evaluateDish(dRemoved);
  }),
  runBenchmark("8. Evaluating 4-course menu progression", 200, () => {
    evaluateMenu(graph, menu4);
  })
];

console.log("=====================================================================");
console.log("CULINARY ENGINE PERFORMANCE BENCHMARK REPORT");
console.log(`Corpus: ${graph.ingredients.size} canonical ingredients, ${graph.pairMap.size} pairings`);
console.log(`Graph index build time: ${initMs} ms`);
console.log("=====================================================================");
console.table(results);

const maxP95 = Math.max(...results.map((r) => r.p95Ms));
console.log(`Max P95 latency across all interactive operations: ${maxP95} ms (60fps frame budget = 16.6 ms, human instant threshold = 50 ms)`);
if (maxP95 < 25) {
  console.log("C++/WebAssembly Gate Verdict: NOT WARRANTED. Native JS/TS indexed graph engine completes all operations well within a single interactive frame.");
}
