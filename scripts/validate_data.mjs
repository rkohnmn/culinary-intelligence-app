#!/usr/bin/env node
/**
 * @fileoverview Validates both Phase 1 (ingredients, pairings, sauces, sides, cuisines, sources)
 * and Phase 2 (nyt_top_50_2025.json, chef_collections.json, recipes.json, nutrition_cache.json) datasets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCulinaryDataset, CulinaryKnowledgeGraph } from "../src/data/knowledgeGraph.js";
import { buildCookingForEngineersMatrix } from "../src/recipes/processDiagram.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../public/data");

const dataset = {
  sources: JSON.parse(fs.readFileSync(path.join(dataDir, "sources.json"), "utf8")),
  cuisines: JSON.parse(fs.readFileSync(path.join(dataDir, "cuisines.json"), "utf8")),
  ingredients: JSON.parse(fs.readFileSync(path.join(dataDir, "ingredients.json"), "utf8")),
  sauces: JSON.parse(fs.readFileSync(path.join(dataDir, "sauces.json"), "utf8")),
  sides: JSON.parse(fs.readFileSync(path.join(dataDir, "sides.json"), "utf8")),
  pairings: JSON.parse(fs.readFileSync(path.join(dataDir, "pairings.json"), "utf8")),
  nytTop50: JSON.parse(fs.readFileSync(path.join(dataDir, "nyt_top_50_2025.json"), "utf8")),
  chefCollections: JSON.parse(fs.readFileSync(path.join(dataDir, "chef_collections.json"), "utf8")),
  recipes: JSON.parse(fs.readFileSync(path.join(dataDir, "recipes.json"), "utf8")),
  nutritionCache: JSON.parse(fs.readFileSync(path.join(dataDir, "nutrition_cache.json"), "utf8"))
};

const result = validateCulinaryDataset(dataset);
const errors = [...result.errors];

// Phase 2 dataset validation
if (dataset.nytTop50.length !== 50) {
  errors.push(`Expected 50 recipes in nyt_top_50_2025.json, found ${dataset.nytTop50.length}`);
}

const ranks = new Set(dataset.nytTop50.map((r) => r.rank));
for (let r = 1; r <= 50; r++) {
  if (!ranks.has(r)) {
    errors.push(`Missing rank #${r} in nyt_top_50_2025.json`);
  }
}

const ingIdSet = new Set(dataset.ingredients.map((i) => i.id));
for (const rec of dataset.recipes) {
  if (!rec.id || !rec.title || !rec.author) {
    errors.push(`Recipe missing id, title, or author: ${JSON.stringify(rec.id)}`);
  }
  if (!Array.isArray(rec.ingredients) || rec.ingredients.length < 2) {
    errors.push(`Recipe ${rec.id} must have at least 2 structured ingredients.`);
  }
  for (const ing of rec.ingredients || []) {
    if (!ing.ingredientId || !ingIdSet.has(ing.ingredientId)) {
      errors.push(`Recipe ${rec.id} references unknown canonical ingredientId '${ing.ingredientId}'`);
    }
  }
  if (!Array.isArray(rec.steps) || rec.steps.length < 2) {
    errors.push(`Recipe ${rec.id} must have at least 2 structured steps.`);
  }
  // Verify Cooking for Engineers rectangular matrix invariant
  const matrix = buildCookingForEngineersMatrix(rec, { nutritionCache: dataset.nutritionCache });
  for (let col = 0; col < matrix.colCount; col++) {
    let coveredRows = 0;
    for (let row = 0; row < matrix.rowCount; row++) {
      const cell = matrix.grid[row][col];
      if (cell.type !== "covered") {
        coveredRows += cell.rowspan;
      }
    }
    if (coveredRows !== matrix.rowCount) {
      errors.push(
        `Recipe ${rec.id} Cooking for Engineers matrix column ${col} rowspan sum ${coveredRows} !== rowCount ${matrix.rowCount}`
      );
    }
  }
}

// Verify nutrition cache covers all 491 canonical ingredients
for (const ing of dataset.ingredients) {
  if (!dataset.nutritionCache?.ingredients?.[ing.id]) {
    errors.push(`Nutrition cache missing canonical ingredient '${ing.id}'`);
  }
}

console.log(
  "Dataset Statistics:",
  JSON.stringify({
    ...result.stats,
    nytTop50Recipes: dataset.nytTop50.length,
    chefCollections: dataset.chefCollections.length,
    totalRecipes: dataset.recipes.length,
    nutritionCacheEntries: Object.keys(dataset.nutritionCache.ingredients || {}).length
  })
);

if (errors.length > 0) {
  console.error(`Validation FAILED with ${errors.length} error(s):`);
  for (const err of errors.slice(0, 25)) {
    console.error("  -", err);
  }
  process.exit(1);
}

const graph = new CulinaryKnowledgeGraph(dataset);
console.log(
  `Knowledge Graph & Phase 2 Recipe Corpus verified: ${graph.ingredients.size} ingredients, ${graph.pairMap.size} unique pair edges, ${dataset.recipes.length} recipes (${dataset.nytTop50.length} NYT 2025 + ${dataset.recipes.length - dataset.nytTop50.length} Chef Classics), ${dataset.chefCollections.length} chef collections.`
);
