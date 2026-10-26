/**
 * @fileoverview Unit tests for NLP Ingredient Parser, Unit Converter, Nutrition Calculator,
 * Shopping List Aggregator, Cooking for Engineers Process Diagram, and Recipe Discovery (`tests/parser.test.js`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CulinaryKnowledgeGraph } from "../src/data/knowledgeGraph.js";
import { parseIngredientLine, parseIngredientList } from "../src/utils/ingredientParser.js";
import {
  convertIngredientMeasurement,
  scaleRecipeIngredients,
  formatTemperatureForSystem
} from "../src/utils/unitConverter.js";
import { calculateRecipeNutrition } from "../src/utils/nutritionCalculator.js";
import { aggregateShoppingList } from "../src/utils/shoppingListAggregator.js";
import {
  buildCookingForEngineersMatrix,
  renderCookingForEngineersHtml
} from "../src/recipes/processDiagram.js";
import {
  discoverRecipes,
  convertRecipeToDish,
  convertDishToRecipeDraft,
  parseRecipeImportPayload
} from "../src/recipes/recipeEngine.js";

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

const graph = new CulinaryKnowledgeGraph(dataset);

test("Phase 2.1 — NLP Ingredient Parser handles Unicode fractions, ranges, parenthetical overrides, and canonical IDs", () => {
  const p1 = parseIngredientLine("1 ½ lbs (680g) boneless, skinless chicken thighs, cut into 2-inch pieces", graph);
  assert.equal(p1.quantity, 1.5);
  assert.equal(p1.unit, "lb");
  assert.equal(p1.altQuantity, 680);
  assert.equal(p1.altUnit, "g");
  assert.equal(p1.ingredientId, "ing_chicken_thigh");
  assert.ok(p1.dietaryModifiers.includes("boneless"));

  const p2 = parseIngredientLine("2–3 cloves fresh garlic, finely grated", graph);
  assert.equal(p2.quantityMin, 2);
  assert.equal(p2.quantityMax, 3);
  assert.equal(p2.quantity, 2.5);
  assert.equal(p2.unit, "clove");
  assert.equal(p2.ingredientId, "ing_garlic");

  const p3 = parseIngredientLine("¾ cup extra-virgin olive oil (optional)", graph);
  assert.equal(p3.quantity, 0.75);
  assert.equal(p3.unit, "cup");
  assert.equal(p3.isOptional, true);
  assert.equal(p3.isStaple, true);
  assert.equal(p3.ingredientId, "ing_olive_oil_evoo");

  const list = parseIngredientList("2 tbsp unsalted butter\n1 large shallot, minced", graph);
  assert.equal(list.length, 2);
  assert.equal(list[0].ingredientId, "ing_butter_unsalted");
  assert.equal(list[1].ingredientId, "ing_shallot");
});

test("Phase 2.2 — Unit Converter & Recipe Scaler convert between Original, Metric, and Imperial", () => {
  const sampleRecipe = dataset.nytTop50[0]; // #1 Smashed Beef Kebab
  const scaledDoubleMetric = scaleRecipeIngredients(sampleRecipe, 8, "metric", dataset.nutritionCache);
  assert.equal(scaledDoubleMetric.length, sampleRecipe.ingredients.length);

  // 1.5 lb beef * 2 = 3 lb = ~1361 g in metric
  const beefMetric = scaledDoubleMetric.find((i) => i.ingredientId === "ing_beef_ground");
  assert.equal(beefMetric.scaledUnit, "g");
  assert.ok(beefMetric.scaledQuantity >= 1350 && beefMetric.scaledQuantity <= 1370);

  // Temperature conversion
  const tempMetric = formatTemperatureForSystem("Roast at 425°F until golden", "metric");
  assert.ok(tempMetric.includes("220°C"));
});

test("Phase 2.3 — USDA Nutrition Calculator computes accurate per-serving macros and daily values", () => {
  const sampleRecipe = dataset.nytTop50[0];
  const nut = calculateRecipeNutrition(sampleRecipe, dataset.nutritionCache);
  assert.equal(nut.servings, 4);
  assert.ok(nut.perServing.calories > 350 && nut.perServing.calories < 1100);
  assert.ok(nut.perServing.protein_g > 25);
  assert.equal(
    nut.macroSplitPct.protein + nut.macroSplitPct.fat + nut.macroSplitPct.carbs >= 99 &&
      nut.macroSplitPct.protein + nut.macroSplitPct.fat + nut.macroSplitPct.carbs <= 101,
    true
  );
});

test("Phase 2.4 — Cooking for Engineers Tabular Process Diagram guarantees valid rectangular rowspan/colspan matrix", () => {
  for (const rec of dataset.recipes) {
    const matrix = buildCookingForEngineersMatrix(rec, {
      targetServings: rec.servings * 1.5,
      unitSystem: "metric",
      nutritionCache: dataset.nutritionCache
    });
    assert.equal(matrix.rowCount, rec.ingredients.length);
    assert.equal(matrix.colCount, rec.steps.length);
    for (let c = 0; c < matrix.colCount; c++) {
      let totalSpan = 0;
      for (let r = 0; r < matrix.rowCount; r++) {
        const cell = matrix.grid[r][c];
        if (cell.type !== "covered") totalSpan += cell.rowspan;
      }
      assert.equal(totalSpan, matrix.rowCount);
    }
  }

  const html = renderCookingForEngineersHtml(dataset.nytTop50[0], {
    unitSystem: "original",
    nutritionCache: dataset.nutritionCache
  });
  assert.ok(html.includes("cfe-process-table"));
  assert.ok(html.includes("Smash &amp; Sear Unmoved"));
});

test("Phase 2.5 — Ingredient-Driven Recipe Discovery, Missing-Ingredient Ranking, and Dish/Menu/Import Integration", () => {
  // User has salmon, white miso, rice, coconut milk, spinach -> #18 One-Pot Miso-Turmeric Salmon should rank at top with 0-2 missing!
  const discovered = discoverRecipes({
    recipes: dataset.recipes,
    knowledgeGraph: graph,
    selectedIngredientIds: [
      "ing_salmon",
      "ing_miso_white",
      "ing_rice_jasmine_short",
      "ing_coconut_milk",
      "ing_spinach"
    ],
    matchFilter: "up_to_4_missing"
  });

  assert.ok(discovered.length > 0);
  assert.equal(discovered[0].recipe.id, "rec_nyt2025_18_one_pot_miso_turmeric_salmon_rice");
  assert.ok(discovered[0].missingCount <= 4);

  // Convert Recipe -> Dish and Dish -> Recipe Draft
  const dish = convertRecipeToDish(graph, dataset.nytTop50[0]);
  assert.equal(dish.name, "Smashed Beef Kebab With Cucumber Yogurt");
  assert.ok(dish.ingredients.some((i) => i.ingredientId === "ing_beef_ground"));

  const draft = convertDishToRecipeDraft(graph, dish);
  assert.equal(draft.ingredients.length, dish.ingredients.length);
  assert.ok(draft.steps.length >= 3);

  // Parse freeform Markdown recipe import
  const imported = parseRecipeImportPayload(
    `# Pan-Seared Sea Bass with Capers
Ingredients:
- 2 fillets sea bass
- 2 tbsp unsalted butter
- 2 tbsp capers, drained
- 1 whole fresh lemon, juiced
Instructions:
1. Sear sea bass fillets in hot skillet for 4 minutes until crispy.
2. Swirl in unsalted butter, capers, and lemon juice for 1 minute and plate.`,
    graph
  );
  assert.equal(imported.length, 1);
  assert.equal(imported[0].title, "Pan-Seared Sea Bass with Capers");
  assert.ok(imported[0].ingredients.some((i) => i.ingredientId === "ing_sea_bass"));

  // Shopping list aggregation across two recipes
  const shopping = aggregateShoppingList([dataset.nytTop50[0], dataset.nytTop50[4]], graph, dataset.nutritionCache);
  assert.ok(shopping.totalUniqueIngredients >= 14);
  assert.ok(shopping.aisles.length >= 4);
});
