/**
 * @fileoverview Culinary Unit Converter & Recipe Scaler (`src/utils/unitConverter.js`).
 *
 * Supports:
 * - Volume <-> Weight conversion using ingredient-specific densities (`densityGPerMl`)
 *   and unit weights (`defaultUnitGrams`) from `nutrition_cache.json`
 * - Unit system toggling: "original" | "metric" (g, ml, °C) | "imperial" (oz, lb, cup, tbsp, tsp, °F)
 * - Readable culinary fraction formatting (½, ¼, ¾, ⅓, ⅔, ⅛)
 * - Dynamic serving multiplier scaling across all recipe ingredients
 * - Temperature conversion inside cooking step instructions (°F <-> °C)
 */

const VOLUME_TO_ML = Object.freeze({
  tsp: 4.92892,
  tbsp: 14.7868,
  fl_oz: 29.5735,
  cup: 236.588,
  ml: 1.0,
  l: 1000.0,
  pinch: 0.3,
  dash: 0.6
});

const WEIGHT_TO_GRAMS = Object.freeze({
  g: 1.0,
  kg: 1000.0,
  oz: 28.3495,
  lb: 453.592,
  can: 425.0
});

const DEFAULT_UNIT_GRAMS = Object.freeze({
  clove: 5,
  stalk: 45,
  sprig: 3,
  bunch: 150,
  head: 350,
  bulb: 220,
  slice: 35,
  piece: 120,
  fillet: 170,
  sheet: 3,
  leaf: 1,
  whole: 120,
  large: 150,
  medium: 115,
  small: 75
});

const FRACTION_TABLE = [
  { val: 0.125, glyph: "⅛" },
  { val: 0.25, glyph: "¼" },
  { val: 1 / 3, glyph: "⅓" },
  { val: 0.375, glyph: "⅜" },
  { val: 0.5, glyph: "½" },
  { val: 0.625, glyph: "⅝" },
  { val: 2 / 3, glyph: "⅔" },
  { val: 0.75, glyph: "¾" },
  { val: 0.875, glyph: "⅞" }
];

/**
 * Formats a numeric quantity into a readable kitchen string (using vulgar fractions for imperial/count units).
 * @param {number} value
 * @param {string} [unit="whole"]
 * @returns {string}
 */
export function formatCulinaryQuantity(value, unit = "whole") {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (unit === "g" || unit === "ml") {
    return value >= 10 ? String(Math.round(value)) : String(Number(value.toFixed(1)));
  }
  if (unit === "kg" || unit === "l") {
    return String(Number(value.toFixed(2)));
  }

  const whole = Math.floor(value + 0.04);
  const rem = value - whole;

  if (Math.abs(rem) < 0.06) {
    return String(whole || 1);
  }

  let bestGlyph = "";
  let minDiff = 1;
  for (const item of FRACTION_TABLE) {
    const diff = Math.abs(rem - item.val);
    if (diff < minDiff) {
      minDiff = diff;
      bestGlyph = item.glyph;
    }
  }

  if (minDiff <= 0.06 && bestGlyph) {
    return whole > 0 ? `${whole} ${bestGlyph}` : bestGlyph;
  }

  return String(Number(value.toFixed(2)));
}

/**
 * Resolves the gram weight of an ingredient quantity + unit using `nutritionCache` or fallback tables.
 * @param {Object} ingredientEntry
 * @param {Object} [nutritionCache]
 * @returns {number} Weight in grams
 */
export function resolveIngredientGrams(ingredientEntry, nutritionCache = null) {
  const qty = Number(ingredientEntry?.quantity ?? 1);
  const unit = String(ingredientEntry?.unit || "whole").toLowerCase();
  const ingId = ingredientEntry?.ingredientId;
  const cacheEntry = (ingId && nutritionCache?.ingredients?.[ingId]) || null;

  if (WEIGHT_TO_GRAMS[unit]) {
    return qty * WEIGHT_TO_GRAMS[unit];
  }

  if ( cacheEntry?.defaultUnitGrams?.[unit] ) {
    return qty * cacheEntry.defaultUnitGrams[unit];
  }

  if (VOLUME_TO_ML[unit]) {
    const ml = qty * VOLUME_TO_ML[unit];
    const density = cacheEntry?.densityGPerMl ?? 0.85;
    return ml * density;
  }

  if (DEFAULT_UNIT_GRAMS[unit]) {
    return qty * DEFAULT_UNIT_GRAMS[unit];
  }

  return qty * 100;
}

/**
 * Converts a single ingredient quantity and unit to the requested `unitSystem`.
 *
 * @param {Object} ingredientEntry
 * @param {"original"|"metric"|"imperial"} [unitSystem="original"]
 * @param {number} [scaleFactor=1]
 * @param {Object} [nutritionCache=null]
 * @returns {{quantity: number, unit: string, formatted: string, grams: number}}
 */
export function convertIngredientMeasurement(
  ingredientEntry,
  unitSystem = "original",
  scaleFactor = 1,
  nutritionCache = null
) {
  const baseQty = Number(ingredientEntry?.quantity ?? 1) * Number(scaleFactor || 1);
  const baseUnit = String(ingredientEntry?.unit || "whole").toLowerCase();
  const scaledEntry = { ...ingredientEntry, quantity: baseQty, unit: baseUnit };
  const grams = resolveIngredientGrams(scaledEntry, nutritionCache);

  if (unitSystem === "original") {
    const fmt = formatCulinaryQuantity(baseQty, baseUnit);
    return {
      quantity: Number(baseQty.toFixed(3)),
      unit: baseUnit,
      formatted: `${fmt} ${baseUnit}`.trim(),
      grams: Number(grams.toFixed(1))
    };
  }

  if (unitSystem === "metric") {
    // Keep count units (clove, whole, large, medium, sprig, slice, sheet, leaf) as count + gram hint
    if (DEFAULT_UNIT_GRAMS[baseUnit]) {
      const fmt = formatCulinaryQuantity(baseQty, baseUnit);
      return {
        quantity: Number(baseQty.toFixed(2)),
        unit: baseUnit,
        formatted: `${fmt} ${baseUnit} (${Math.round(grams)}g)`,
        grams: Number(grams.toFixed(1))
      };
    }
    // Liquid volume units for oils, stocks, vinegars, milks -> ml
    const isLiquid =
      VOLUME_TO_ML[baseUnit] &&
      /oil|vinegar|wine|stock|broth|milk|cream|sauce|water|juice|brine|mirin|shoyu|soy/i.test(
        `${ingredientEntry?.name || ""} ${ingredientEntry?.ingredientId || ""}`
      );
    if (isLiquid) {
      const ml = baseQty * VOLUME_TO_ML[baseUnit];
      return {
        quantity: Math.round(ml),
        unit: "ml",
        formatted: `${Math.round(ml)} ml`,
        grams: Number(grams.toFixed(1))
      };
    }
    return {
      quantity: Math.round(grams),
      unit: "g",
      formatted: `${Math.round(grams)} g`,
      grams: Number(grams.toFixed(1))
    };
  }

  // unitSystem === "imperial"
  if (baseUnit === "g" || baseUnit === "kg") {
    const oz = grams / 28.3495;
    if (oz >= 16) {
      const lb = oz / 16;
      const fmt = formatCulinaryQuantity(lb, "lb");
      return {
        quantity: Number(lb.toFixed(2)),
        unit: "lb",
        formatted: `${fmt} lb`,
        grams: Number(grams.toFixed(1))
      };
    }
    const fmt = formatCulinaryQuantity(oz, "oz");
    return {
      quantity: Number(oz.toFixed(2)),
      unit: "oz",
      formatted: `${fmt} oz`,
      grams: Number(grams.toFixed(1))
    };
  }

  if (baseUnit === "ml" || baseUnit === "l") {
    const ml = baseUnit === "l" ? baseQty * 1000 : baseQty;
    if (ml >= 60) {
      const cups = ml / 236.588;
      const fmt = formatCulinaryQuantity(cups, "cup");
      return {
        quantity: Number(cups.toFixed(2)),
        unit: "cup",
        formatted: `${fmt} cup`,
        grams: Number(grams.toFixed(1))
      };
    }
    const tbsp = ml / 14.7868;
    const fmt = formatCulinaryQuantity(tbsp, "tbsp");
    return {
      quantity: Number(tbsp.toFixed(2)),
      unit: "tbsp",
      formatted: `${fmt} tbsp`,
      grams: Number(grams.toFixed(1))
    };
  }

  const fmt = formatCulinaryQuantity(baseQty, baseUnit);
  return {
    quantity: Number(baseQty.toFixed(3)),
    unit: baseUnit,
    formatted: `${fmt} ${baseUnit}`.trim(),
    grams: Number(grams.toFixed(1))
  };
}

/**
 * Scales all ingredients of a recipe to `targetServings` and converts to `unitSystem`.
 * @param {Object} recipe
 * @param {number} [targetServings]
 * @param {"original"|"metric"|"imperial"} [unitSystem="original"]
 * @param {Object} [nutritionCache=null]
 * @returns {Array<Object>}
 */
export function scaleRecipeIngredients(
  recipe,
  targetServings = null,
  unitSystem = "original",
  nutritionCache = null
) {
  const baseServings = Math.max(1, Number(recipe?.servings || 4));
  const desired = Math.max(0.5, Number(targetServings || baseServings));
  const scaleFactor = desired / baseServings;

  return (recipe?.ingredients || []).map((ing) => {
    const conv = convertIngredientMeasurement(ing, unitSystem, scaleFactor, nutritionCache);
    return {
      ...ing,
      scaledQuantity: conv.quantity,
      scaledUnit: conv.unit,
      formattedMeasurement: conv.formatted,
      estimatedGrams: conv.grams
    };
  });
}

/**
 * Converts temperature mentions in a string when switching between metric and imperial.
 * @param {string} text
 * @param {"original"|"metric"|"imperial"} [unitSystem="original"]
 * @returns {string}
 */
export function formatTemperatureForSystem(text, unitSystem = "original") {
  if (!text || unitSystem === "original") return String(text || "");
  let res = String(text).replace(/(\d{3})\s*°\s*F(?:\s*\/\s*\d{2,3}\s*°\s*C)?/g, (match, fStr) => {
    const f = Number(fStr);
    const c = Math.round(((f - 32) * 5) / 9 / 5) * 5;
    return unitSystem === "metric" ? `${c}°C (${f}°F)` : `${f}°F (${c}°C)`;
  });
  if (unitSystem === "imperial") {
    res = res.replace(/(\d{2,3})\s*°\s*C(?!\s*\))/g, (match, cStr) => {
      const c = Number(cStr);
      const f = Math.round((c * 9) / 5 + 32);
      return `${f}°F (${c}°C)`;
    });
  }
  return res;
}
