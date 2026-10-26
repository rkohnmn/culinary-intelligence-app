/**
 * @fileoverview Deterministic Culinary NLP Ingredient Parser (`src/utils/ingredientParser.js`).
 *
 * Parses freeform recipe ingredient lines into structured records:
 * - Unicode vulgar fractions (½, ⅓, ⅔, ¼, ¾, ⅕, ⅖, ⅗, ⅘, ⅙, ⅚, ⅛, ⅜, ⅝, ⅞)
 * - ASCII fractions (1/2) and mixed numbers (1 1/2, 2½)
 * - Numeric ranges (2-3, 2–3, 2 to 3) with min/max and mean quantity
 * - Parenthetical weight/volume overrides (e.g., "2 tbsp (28g) unsalted butter")
 * - Canonical measurement unit normalization
 * - Preparation state and preparation notes extraction
 * - Dietary/optional/staple modifier detection
 * - Optional canonical ingredient ID resolution via CulinaryKnowledgeGraph
 */

export const UNICODE_FRACTIONS = Object.freeze({
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875
});

export const UNIT_ALIASES = Object.freeze({
  tbsp: "tbsp",
  tbs: "tbsp",
  tb: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  "fl oz": "fl_oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  clove: "clove",
  cloves: "clove",
  stalk: "stalk",
  stalks: "stalk",
  rib: "stalk",
  ribs: "stalk",
  sprig: "sprig",
  sprigs: "sprig",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  bulb: "bulb",
  bulbs: "bulb",
  can: "can",
  cans: "can",
  slice: "slice",
  slices: "slice",
  piece: "piece",
  pieces: "piece",
  fillet: "fillet",
  fillets: "fillet",
  sheet: "sheet",
  sheets: "sheet",
  leaf: "leaf",
  leaves: "leaf",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  whole: "whole",
  large: "large",
  medium: "medium",
  small: "small"
});

const PREP_STATE_KEYWORDS = [
  { regex: /\b(roasted|roast)\b/i, state: "roasted" },
  { regex: /\b(sauteed|sautéed|seared|pan-seared|browned)\b/i, state: "sauteed" },
  { regex: /\b(braised|simmered|stewed)\b/i, state: "braised" },
  { regex: /\b(grilled|charred|broiled)\b/i, state: "grilled" },
  { regex: /\b(poached)\b/i, state: "poached" },
  { regex: /\b(steamed)\b/i, state: "steamed" },
  { regex: /\b(fried|crispy|deep-fried)\b/i, state: "fried" },
  { regex: /\b(caramelized)\b/i, state: "caramelized" },
  { regex: /\b(fermented|aged)\b/i, state: "fermented" },
  { regex: /\b(pickled|brined)\b/i, state: "pickled" },
  { regex: /\b(cured)\b/i, state: "cured" },
  { regex: /\b(smoked)\b/i, state: "smoked" },
  { regex: /\b(dried|dehydrated)\b/i, state: "dried" },
  { regex: /\b(toasted)\b/i, state: "toasted" },
  { regex: /\b(infused|steeped)\b/i, state: "infused" },
  { regex: /\b(reduced)\b/i, state: "reduced" },
  { regex: /\b(emulsified|whisked|whipped)\b/i, state: "emulsified" },
  { regex: /\b(raw|fresh|unseasoned|chilled)\b/i, state: "raw" }
];

const STAPLE_KEYWORDS = /\b(kosher salt|sea salt|table salt|black pepper|water|neutral oil|cooking oil|extra-virgin olive oil|olive oil)\b/i;

export function normalizeUnicodeFractions(str) {
  if (!str) return "";
  let out = String(str);
  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (out.includes(glyph)) {
      out = out.replace(new RegExp(`(\\d)\\s*${glyph}`, "g"), (_, d) => `${Number(d) + val}`);
      out = out.replace(new RegExp(glyph, "g"), `${val}`);
    }
  }
  return out;
}

export function parseNumericValue(token) {
  if (!token) return null;
  const cleaned = normalizeUnicodeFractions(token.trim());
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    return den !== 0 ? whole + num / den : whole;
  }
  const fracMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    return den !== 0 ? num / den : null;
  }
  const numVal = Number(cleaned);
  return Number.isFinite(numVal) ? numVal : null;
}

function singularizeWord(w) {
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ves") && w.length > 4) return w.slice(0, -3) + "f";
  if (w.endsWith("oes") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Parses a single raw ingredient line into a structured ingredient object.
 *
 * @param {string} rawLine
 * @param {Object} [knowledgeGraph] Optional CulinaryKnowledgeGraph for canonical ID lookup
 * @returns {Object}
 */
export function parseIngredientLine(rawLine, knowledgeGraph = null) {
  const original = String(rawLine || "").trim();
  if (!original) {
    return {
      rawText: "",
      quantity: 1,
      quantityMin: 1,
      quantityMax: 1,
      unit: "whole",
      altQuantity: null,
      altUnit: null,
      name: "",
      ingredientId: null,
      preparation: "cooked_default",
      preparationNote: "",
      isOptional: false,
      isStaple: false,
      dietaryModifiers: []
    };
  }

  let working = original.replace(/^(\*|-|•|\d+\.)\s*/, "").trim();
  const isOptional = /\b(optional|to taste|for serving|for garnish)\b/i.test(working);
  working = working.replace(/\(\s*optional\s*\)/gi, "").trim();

  const dietaryModifiers = [];
  for (const mod of ["vegan", "gluten-free", "dairy-free", "unsalted", "low-sodium", "full-fat", "boneless", "skinless", "skin-on", "bone-in"]) {
    if (new RegExp(`\\b${mod}\\b`, "i").test(working)) {
      dietaryModifiers.push(mod.toLowerCase());
    }
  }

  // Extract parenthetical alternate measurement e.g. "(680g)", "(28g)", "(15-ounce/440ml)"
  let altQuantity = null;
  let altUnit = null;
  const parenMatch = working.match(/\((?:about\s+)?(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*-?\s*(g|grams?|oz|ounces?|ml|lb|pounds?|cups?|tbsp|tsp)\b[^)]*\)/i);
  if (parenMatch) {
    altQuantity = parseNumericValue(parenMatch[1]);
    const rawAltU = parenMatch[2].toLowerCase().replace(/s$/, "");
    altUnit = UNIT_ALIASES[rawAltU] || rawAltU;
    working = working.replace(parenMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  const norm = normalizeUnicodeFractions(working);
  const numPattern = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
  const rangeRegex = new RegExp(`^(${numPattern})(?:\\s*(?:-|–|to)\\s*(${numPattern}))?\\s*(.*)$`, "i");

  let quantity = 1;
  let quantityMin = 1;
  let quantityMax = 1;
  let remainder = norm;

  const qMatch = norm.match(rangeRegex);
  if (qMatch) {
    const q1 = parseNumericValue(qMatch[1]);
    const q2 = qMatch[2] ? parseNumericValue(qMatch[2]) : null;
    if (q1 !== null) {
      if (q2 !== null && q2 >= q1) {
        quantityMin = q1;
        quantityMax = q2;
        quantity = Number(((q1 + q2) / 2).toFixed(3));
      } else {
        quantity = Number(q1.toFixed(3));
        quantityMin = quantity;
        quantityMax = quantity;
      }
      remainder = qMatch[3].trim();
    }
  }

  let unit = "whole";
  const words = remainder.split(/\s+/);
  if (words.length > 0) {
    const firstWordClean = words[0].toLowerCase().replace(/[.,;:]+$/, "");
    const twoWordsClean = words.length > 1 ? `${firstWordClean} ${words[1].toLowerCase().replace(/[.,;:]+$/, "")}` : "";
    if (UNIT_ALIASES[twoWordsClean]) {
      unit = UNIT_ALIASES[twoWordsClean];
      remainder = words.slice(2).join(" ");
    } else if (UNIT_ALIASES[firstWordClean] && words.length > 1) {
      unit = UNIT_ALIASES[firstWordClean];
      remainder = words.slice(1).join(" ");
    }
  }

  remainder = remainder.replace(/^of\s+/i, "").trim();

  // Protect "boneless, skinless" or "bone-in, skin-on" before splitting on comma
  const protectedRem = remainder
    .replace(/\b(boneless|bone-in),\s*(skinless|skin-on)\b/gi, "$1 $2");

  let namePart = protectedRem;
  let prepNote = "";
  const commaIdx = protectedRem.indexOf(",");
  if (commaIdx !== -1) {
    namePart = protectedRem.slice(0, commaIdx).trim();
    prepNote = protectedRem.slice(commaIdx + 1).trim();
  } else {
    const trailingParen = protectedRem.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (trailingParen) {
      namePart = trailingParen[1].trim();
      prepNote = trailingParen[2].trim();
    }
  }

  let preparation = "cooked_default";
  for (const item of PREP_STATE_KEYWORDS) {
    if (item.regex.test(original)) {
      preparation = item.state;
      break;
    }
  }

  const isStaple = STAPLE_KEYWORDS.test(namePart) || STAPLE_KEYWORDS.test(original);

  let ingredientId = null;
  if (knowledgeGraph && typeof knowledgeGraph.resolveIngredientId === "function") {
    const stripped = namePart
      .replace(/\b(fresh|dried|ground|whole|large|medium|small|boneless|skinless|skin-on|bone-in|unsalted|kosher|extra-virgin|finely|coarsely)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const singularStripped = stripped.split(/\s+/).map(singularizeWord).join(" ");

    ingredientId =
      knowledgeGraph.resolveIngredientId(namePart) ||
      knowledgeGraph.resolveIngredientId(stripped) ||
      knowledgeGraph.resolveIngredientId(singularStripped);

    if (!ingredientId) {
      const tokens = singularStripped
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      for (let len = tokens.length; len >= 1 && !ingredientId; len--) {
        for (let start = 0; start <= tokens.length - len; start++) {
          const phrase = tokens.slice(start, start + len).join(" ");
          const resolved = knowledgeGraph.resolveIngredientId(phrase);
          if (resolved) {
            ingredientId = resolved;
            break;
          }
        }
      }
    }
  }

  return {
    rawText: original,
    quantity,
    quantityMin,
    quantityMax,
    unit,
    altQuantity,
    altUnit,
    name: namePart || original,
    ingredientId,
    preparation,
    preparationNote: prepNote,
    isOptional,
    isStaple,
    dietaryModifiers
  };
}

export function parseIngredientList(input, knowledgeGraph = null) {
  const lines = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
  return lines.map((line) => parseIngredientLine(line, knowledgeGraph));
}
