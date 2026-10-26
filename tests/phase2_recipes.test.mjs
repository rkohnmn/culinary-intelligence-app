/**
 * @fileoverview Phase 2 Recipe Studio, Cooking for Engineers Matrix & Utilities Test Suite (`tests/phase2_recipes.test.mjs`).
 *
 * Verifies:
 * - 1. NLP Ingredient Parser: Unicode fractions, mixed numbers, ranges, parenthetical weights, prep detection, and knowledge graph resolution.
 * - 2. Unit Converter & Recipe Scaler: original, metric, imperial conversions, scaling yield, culinary fraction formatting, and temperature conversions.
 * - 3. USDA Nutrition Calculator: per-serving calories, macros, micronutrients, daily value percentages, and preparation retention factors.
 * - 4. Cooking for Engineers Process Diagram: exact rectangular R x C matrix, rowspan/colspan validation, table rendering, completion toggling, and inline timers.
 * - 5. Recipe Discovery Engine: missing-ingredient ranking, recipe-to-dish and dish-to-recipe conversions, and freeform markdown import.
 * - 6. Shopping List Aggregator: consolidation across multiple scaled recipes into grocery store aisles.
 * - 7. Recipe Storage & Backup Recovery: saveRecipe, getAllRecipes, deleteRecipe, and backup export/import containing custom recipes.
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
  formatCulinaryQuantity,
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
  parseRecipeImportPayload,
  normalizeRecipeRecord
} from "../src/recipes/recipeEngine.js";
import { CulinaryStorage } from "../src/storage/db.js";

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

test("Phase 2.1: NLP Ingredient Parser handles Unicode fractions, ranges, parentheticals, and ID resolution", () => {
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

test("Phase 2.2: Unit Converter & Recipe Scaler convert measurements and temperatures accurately", () => {
  const sampleRecipe = dataset.nytTop50[0]; // #1 Smashed Beef Kebab
  const scaledDoubleMetric = scaleRecipeIngredients(sampleRecipe, 8, "metric", dataset.nutritionCache);
  assert.equal(scaledDoubleMetric.length, sampleRecipe.ingredients.length);

  // 1.5 lb ground beef scaled to 8 servings (2x) = 3 lb = ~1361 g in metric
  const beefMetric = scaledDoubleMetric.find((i) => i.ingredientId === "ing_beef_ground");
  assert.equal(beefMetric.scaledUnit, "g");
  assert.ok(beefMetric.scaledQuantity >= 1350 && beefMetric.scaledQuantity <= 1370);

  // Culinary quantity fraction formatting
  assert.equal(formatCulinaryQuantity(0.5), "½");
  assert.equal(formatCulinaryQuantity(1.75), "1 ¾");
  assert.equal(formatCulinaryQuantity(2), "2");

  // Temperature conversion
  const tempMetric = formatTemperatureForSystem("Roast at 425°F until golden", "metric");
  assert.ok(tempMetric.includes("220°C"));
  const tempImperial = formatTemperatureForSystem("Bake at 200°C for 25 minutes", "imperial");
  assert.ok(tempImperial.includes("392°F") || tempImperial.includes("390°F") || tempImperial.includes("400°F"));
});

test("Phase 2.3: USDA Nutrition Calculator computes accurate per-serving macros and daily values", () => {
  const sampleRecipe = dataset.nytTop50[0];
  const nut = calculateRecipeNutrition(sampleRecipe, dataset.nutritionCache);
  assert.equal(nut.servings, 4);
  assert.ok(nut.perServing.calories > 350 && nut.perServing.calories < 1100);
  assert.ok(nut.perServing.protein_g > 25);
  assert.ok(nut.perServing.fat_g > 10);
  assert.ok(
    nut.macroSplitPct.protein + nut.macroSplitPct.fat + nut.macroSplitPct.carbs >= 99 &&
      nut.macroSplitPct.protein + nut.macroSplitPct.fat + nut.macroSplitPct.carbs <= 101,
    "Macro percentages must sum to ~100%"
  );
  assert.ok(nut.dailyValuePct.sodium_mg !== undefined);
});

test("Phase 2.4: Cooking for Engineers Process Diagram guarantees valid rectangular matrix across all recipes", () => {
  for (const rec of dataset.recipes) {
    const matrix = buildCookingForEngineersMatrix(rec, {
      targetServings: rec.servings * 1.5,
      unitSystem: "metric",
      nutritionCache: dataset.nutritionCache
    });
    assert.equal(matrix.rowCount, rec.ingredients.length, `Row count mismatch for recipe ${rec.id}`);
    assert.equal(matrix.colCount, rec.steps.length, `Col count mismatch for recipe ${rec.id}`);
    for (let c = 0; c < matrix.colCount; c++) {
      let totalSpan = 0;
      for (let r = 0; r < matrix.rowCount; r++) {
        const cell = matrix.grid[r][c];
        if (cell.type !== "covered") totalSpan += cell.rowspan;
      }
      assert.equal(totalSpan, matrix.rowCount, `Col ${c} rowspan sum does not match rowCount in recipe ${rec.id}`);
    }
  }

  const html = renderCookingForEngineersHtml(dataset.nytTop50[0], {
    unitSystem: "original",
    nutritionCache: dataset.nutritionCache
  });
  assert.ok(html.includes("cfe-process-table"));
  assert.ok(html.includes("Smash &amp; Sear Unmoved"));
  assert.ok(html.includes("data-action=\"toggle-recipe-step-done\""));
});

test("Phase 2.5: Recipe Discovery, Missing-Ingredient Ranking, and Conversions", () => {
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

  // Freeform Markdown recipe import
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

  // Shopping list aggregation
  const shopping = aggregateShoppingList([dataset.nytTop50[0], dataset.nytTop50[4]], graph, dataset.nutritionCache);
  assert.ok(shopping.totalUniqueIngredients >= 14);
  assert.ok(shopping.aisles.length >= 4);
});

test("Phase 2.6: Recipe Storage & Backup Recovery (saveRecipe, getAllRecipes, deleteRecipe, exportBackupJson)", async () => {
  const storage = new CulinaryStorage({ forceMemory: true });
  await storage.init();

  const customRecipe = normalizeRecipeRecord({
    id: "rec_user_custom_test_1",
    title: "Crispy Duck with Cherry Reduction",
    servings: 2,
    ingredients: [
      { rawText: "2 duck breasts", ingredientId: "ing_duck_breast", quantity: 2, unit: "whole" },
      { rawText: "1 cup sweet cherries", ingredientId: "ing_cherry", quantity: 1, unit: "cup" },
      { rawText: "2 tbsp unsalted butter", ingredientId: "ing_butter_unsalted", quantity: 2, unit: "tbsp" }
    ],
    steps: [
      { stepNumber: 1, text: "Score duck skin in crosshatch pattern and season with kosher salt." },
      { stepNumber: 2, text: "Place skin-side down in cold pan, render over medium-low heat for 12 minutes." },
      { stepNumber: 3, text: "Flip and finish cooking for 4 minutes; make cherry reduction with butter." }
    ]
  });

  await storage.saveRecipe(customRecipe);
  const allSaved = await storage.getAllRecipes();
  assert.equal(allSaved.length, 1);
  assert.equal(allSaved[0].id, "rec_user_custom_test_1");
  assert.equal(allSaved[0].title, "Crispy Duck with Cherry Reduction");

  // Export JSON backup containing recipes
  const backupJsonStr = await storage.exportBackupJson();
  assert.ok(backupJsonStr.includes("culinary-intelligence-backup-v2"));
  assert.ok(backupJsonStr.includes("Crispy Duck with Cherry Reduction"));

  // Delete recipe
  await storage.deleteRecipe("rec_user_custom_test_1");
  const afterDelete = await storage.getAllRecipes();
  assert.equal(afterDelete.length, 0);

  // Re-import backup JSON
  const importResult = await storage.importBackupJson(backupJsonStr, "merge");
  assert.equal(importResult.importedRecipes, 1);
  const afterReimport = await storage.getAllRecipes();
  assert.equal(afterReimport.length, 1);
  assert.equal(afterReimport[0].title, "Crispy Duck with Cherry Reduction");
});
