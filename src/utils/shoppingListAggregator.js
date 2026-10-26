/**
 * @fileoverview Shopping List & Prep Aggregator (`src/utils/shoppingListAggregator.js`).
 *
 * Consolidates ingredients across multiple scaled recipes or an entire multi-course menu:
 * - Merges identical canonical `ingredientId`s (or normalized names)
 * - Unifies compatible measurements via gram/unit conversion
 * - Groups items into intuitive grocery store aisles
 * - Separates assumed kitchen staples (salt, black pepper, cooking oil) for quick toggling
 */

import { resolveIngredientGrams, formatCulinaryQuantity } from "./unitConverter.js";

const CATEGORY_TO_AISLE = Object.freeze({
  vegetables: "Produce & Fresh Aromatics",
  fruits: "Produce & Fresh Aromatics",
  herbs: "Produce & Fresh Aromatics",
  aromatics: "Produce & Fresh Aromatics",
  fungi: "Produce & Fresh Aromatics",
  meat: "Meat, Poultry & Seafood",
  poultry: "Meat, Poultry & Seafood",
  fish: "Meat, Poultry & Seafood",
  shellfish: "Meat, Poultry & Seafood",
  dairy: "Dairy, Eggs & Cheese",
  eggs: "Dairy, Eggs & Cheese",
  grains: "Grains, Pasta, Legumes & Bakery",
  rice: "Grains, Pasta, Legumes & Bakery",
  pasta: "Grains, Pasta, Legumes & Bakery",
  legumes: "Grains, Pasta, Legumes & Bakery",
  nuts_and_seeds: "Grains, Pasta, Legumes & Bakery",
  spices: "Spices & Dry Seasonings",
  oils_and_fats: "Pantry Oils, Acids, Ferments & Condiments",
  acids: "Pantry Oils, Acids, Ferments & Condiments",
  fermented: "Pantry Oils, Acids, Ferments & Condiments",
  sweeteners: "Pantry Oils, Acids, Ferments & Condiments",
  condiments: "Pantry Oils, Acids, Ferments & Condiments",
  stocks_and_liquids: "Pantry Oils, Acids, Ferments & Condiments",
  seaVegetables: "Pantry Oils, Acids, Ferments & Condiments"
});

/**
 * Aggregates ingredients from an array of recipes (each optionally specifying `{ recipe, targetServings }`).
 *
 * @param {Array<Object>} recipeEntries Array of recipes or `{ recipe, targetServings }`
 * @param {Object} [knowledgeGraph=null]
 * @param {Object} [nutritionCache=null]
 * @returns {Object} Structured shopping list grouped by aisle
 */
export function aggregateShoppingList(recipeEntries, knowledgeGraph = null, nutritionCache = null) {
  const merged = new Map();

  for (const entry of recipeEntries || []) {
    const recipe = entry?.recipe || entry;
    if (!recipe || !Array.isArray(recipe.ingredients)) continue;

    const baseServings = Math.max(1, Number(recipe.servings || 4));
    const targetServings = Math.max(0.5, Number(entry?.targetServings || baseServings));
    const scale = targetServings / baseServings;

    for (const ing of recipe.ingredients) {
      const key = ing.ingredientId || String(ing.name || "").toLowerCase().trim();
      if (!key) continue;

      const canonIng = (ing.ingredientId && knowledgeGraph?.ingredients?.get(ing.ingredientId)) || null;
      const primaryCategory = canonIng?.categories?.[0] || "vegetables";
      const aisle = CATEGORY_TO_AISLE[primaryCategory] || "Pantry Oils, Acids, Ferments & Condiments";
      const scaledQty = Number(ing.quantity || 1) * scale;
      const unit = String(ing.unit || "whole").toLowerCase();
      const grams = resolveIngredientGrams({ ...ing, quantity: scaledQty, unit }, nutritionCache);

      if (!merged.has(key)) {
        merged.set(key, {
          key,
          ingredientId: ing.ingredientId || null,
          name: canonIng?.name?.split(" (")[0] || ing.name || key,
          aisle,
          isStaple: Boolean(ing.isStaple),
          totalGrams: 0,
          unitTotals: new Map(),
          usedInRecipes: new Set()
        });
      }

      const rec = merged.get(key);
      rec.totalGrams += grams;
      rec.unitTotals.set(unit, (rec.unitTotals.get(unit) || 0) + scaledQty);
      rec.usedInRecipes.add(recipe.title || recipe.name || "Recipe");
    }
  }

  const aislesMap = new Map();
  const allItems = [];

  for (const item of merged.values()) {
    const unitParts = [];
    for (const [u, q] of item.unitTotals.entries()) {
      unitParts.push(`${formatCulinaryQuantity(q, u)} ${u}`.trim());
    }
    const formattedTotal = `${unitParts.join(" + ")} (~${Math.round(item.totalGrams)}g)`;

    const entryObj = {
      key: item.key,
      ingredientId: item.ingredientId,
      name: item.name,
      aisle: item.aisle,
      isStaple: item.isStaple,
      totalGrams: Math.round(item.totalGrams),
      formattedAmount: formattedTotal,
      usedInRecipes: Array.from(item.usedInRecipes)
    };

    allItems.push(entryObj);
    if (!aislesMap.has(item.aisle)) {
      aislesMap.set(item.aisle, []);
    }
    aislesMap.get(item.aisle).push(entryObj);
  }

  const aisles = Array.from(aislesMap.entries()).map(([aisleName, items]) => ({
    aisle: aisleName,
    items: items.sort((a, b) => a.name.localeCompare(b.name))
  }));

  return {
    totalUniqueIngredients: allItems.length,
    totalWeightGrams: Math.round(allItems.reduce((acc, i) => acc + i.totalGrams, 0)),
    aisles,
    items: allItems
  };
}
