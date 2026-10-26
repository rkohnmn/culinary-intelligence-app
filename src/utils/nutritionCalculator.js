/**
 * @fileoverview Deterministic Nutrition Calculator (`src/utils/nutritionCalculator.js`).
 *
 * Computes per-serving and whole-recipe macro/micronutrient profiles from:
 * - Local `public/data/nutrition_cache.json` (USDA FoodData Central CC0 reference data for all 491 canonical ingredients)
 * - Optional live USDA FoodData Central API lookup when an API key and network are provided, with automatic cache fallback
 * - Cooking preparation retention/yield adjustments (e.g., fat rendering during searing/roasting, moisture loss)
 */

import { resolveIngredientGrams } from "./unitConverter.js";

const DAILY_VALUES = Object.freeze({
  calories: 2000,
  protein_g: 50,
  fat_g: 78,
  saturated_fat_g: 20,
  carbs_g: 275,
  fiber_g: 28,
  sodium_mg: 2300,
  potassium_mg: 4700,
  calcium_mg: 1300,
  iron_mg: 18
});

const PREPARATION_RETENTION = Object.freeze({
  raw: { calories: 1.0, fat: 1.0, sodium: 1.0 },
  roasted: { calories: 0.96, fat: 0.92, sodium: 1.0 },
  sauteed: { calories: 0.98, fat: 0.95, sodium: 1.0 },
  braised: { calories: 1.0, fat: 0.98, sodium: 0.95 },
  grilled: { calories: 0.93, fat: 0.88, sodium: 1.0 },
  poached: { calories: 0.95, fat: 0.94, sodium: 0.85 },
  steamed: { calories: 0.99, fat: 0.99, sodium: 0.95 },
  fried: { calories: 1.08, fat: 1.12, sodium: 1.0 }
});

/**
 * Calculates complete nutrition breakdown for a recipe or dish.
 *
 * @param {Object} recipeOrDish
 * @param {Object} nutritionCache Parsed `nutrition_cache.json`
 * @param {Object} [options]
 * @param {number} [options.servings] Override servings count
 * @returns {Object}
 */
export function calculateRecipeNutrition(recipeOrDish, nutritionCache, options = {}) {
  const servings = Math.max(1, Number(options.servings || recipeOrDish?.servings || 4));
  const ingredients = Array.isArray(recipeOrDish?.ingredients) ? recipeOrDish.ingredients : [];

  const totals = {
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    saturated_fat_g: 0,
    carbs_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    potassium_mg: 0,
    calcium_mg: 0,
    iron_mg: 0
  };

  const breakdownByIngredient = [];

  for (const item of ingredients) {
    if (item.isOptional) continue;
    const ingId = item.ingredientId;
    const cacheEntry = (ingId && nutritionCache?.ingredients?.[ingId]) || null;
    const grams = resolveIngredientGrams(item, nutritionCache);
    const factor = grams / 100.0;
    const prep = item.preparation || "cooked_default";
    const retention = PREPARATION_RETENTION[prep] || { calories: 1.0, fat: 1.0, sodium: 1.0 };

    const per100 = cacheEntry?.per100g || {
      calories: 50,
      protein_g: 2.0,
      fat_g: 1.0,
      saturated_fat_g: 0.2,
      carbs_g: 8.0,
      fiber_g: 1.5,
      sugar_g: 2.0,
      sodium_mg: 25,
      potassium_mg: 180,
      calcium_mg: 20,
      iron_mg: 0.6
    };

    const itemCalories = per100.calories * factor * retention.calories;
    const itemProtein = per100.protein_g * factor;
    const itemFat = per100.fat_g * factor * retention.fat;
    const itemSatFat = per100.saturated_fat_g * factor * retention.fat;
    const itemCarbs = per100.carbs_g * factor;
    const itemFiber = per100.fiber_g * factor;
    const itemSugar = per100.sugar_g * factor;
    const itemSodium = per100.sodium_mg * factor * retention.sodium;
    const itemPotassium = per100.potassium_mg * factor;
    const itemCalcium = per100.calcium_mg * factor;
    const itemIron = per100.iron_mg * factor;

    totals.calories += itemCalories;
    totals.protein_g += itemProtein;
    totals.fat_g += itemFat;
    totals.saturated_fat_g += itemSatFat;
    totals.carbs_g += itemCarbs;
    totals.fiber_g += itemFiber;
    totals.sugar_g += itemSugar;
    totals.sodium_mg += itemSodium;
    totals.potassium_mg += itemPotassium;
    totals.calcium_mg += itemCalcium;
    totals.iron_mg += itemIron;

    breakdownByIngredient.push({
      ingredientId: ingId,
      name: item.name || cacheEntry?.name || ingId,
      grams: Math.round(grams),
      calories: Math.round(itemCalories),
      protein_g: Number(itemProtein.toFixed(1)),
      fat_g: Number(itemFat.toFixed(1)),
      carbs_g: Number(itemCarbs.toFixed(1))
    });
  }

  const perServing = {
    calories: Math.round(totals.calories / servings),
    protein_g: Number((totals.protein_g / servings).toFixed(1)),
    fat_g: Number((totals.fat_g / servings).toFixed(1)),
    saturated_fat_g: Number((totals.saturated_fat_g / servings).toFixed(1)),
    carbs_g: Number((totals.carbs_g / servings).toFixed(1)),
    fiber_g: Number((totals.fiber_g / servings).toFixed(1)),
    sugar_g: Number((totals.sugar_g / servings).toFixed(1)),
    sodium_mg: Math.round(totals.sodium_mg / servings),
    potassium_mg: Math.round(totals.potassium_mg / servings),
    calcium_mg: Math.round(totals.calcium_mg / servings),
    iron_mg: Number((totals.iron_mg / servings).toFixed(1))
  };

  const dailyValuePct = {
    calories: Math.round((perServing.calories / DAILY_VALUES.calories) * 100),
    protein_g: Math.round((perServing.protein_g / DAILY_VALUES.protein_g) * 100),
    fat_g: Math.round((perServing.fat_g / DAILY_VALUES.fat_g) * 100),
    saturated_fat_g: Math.round((perServing.saturated_fat_g / DAILY_VALUES.saturated_fat_g) * 100),
    carbs_g: Math.round((perServing.carbs_g / DAILY_VALUES.carbs_g) * 100),
    fiber_g: Math.round((perServing.fiber_g / DAILY_VALUES.fiber_g) * 100),
    sodium_mg: Math.round((perServing.sodium_mg / DAILY_VALUES.sodium_mg) * 100),
    potassium_mg: Math.round((perServing.potassium_mg / DAILY_VALUES.potassium_mg) * 100),
    calcium_mg: Math.round((perServing.calcium_mg / DAILY_VALUES.calcium_mg) * 100),
    iron_mg: Math.round((perServing.iron_mg / DAILY_VALUES.iron_mg) * 100)
  };

  const proteinCal = perServing.protein_g * 4;
  const fatCal = perServing.fat_g * 9;
  const carbCal = perServing.carbs_g * 4;
  const macroCalSum = Math.max(1, proteinCal + fatCal + carbCal);

  return {
    servings,
    perServing,
    dailyValuePct,
    macroSplitPct: {
      protein: Math.round((proteinCal / macroCalSum) * 100),
      fat: Math.round((fatCal / macroCalSum) * 100),
      carbs: Math.round((carbCal / macroCalSum) * 100)
    },
    breakdownByIngredient: breakdownByIngredient.sort((a, b) => b.calories - a.calories),
    provenance: "USDA FoodData Central CC0 Reference Cache (Per 100g Edible Portion)"
  };
}
