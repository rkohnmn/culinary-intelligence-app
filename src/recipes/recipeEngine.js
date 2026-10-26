/**
 * @fileoverview Phase 2 Recipe Intelligence, Discovery, Chef Collections & Import Engine (`src/recipes/recipeEngine.js`).
 */

import { createDish, createEntityId } from "../dishes/dishManager.js";
import { parseIngredientLine } from "../utils/ingredientParser.js";

const ACTION_VERB_PATTERNS = [
  { regex: /\b(sear|brown|char|blister|smash)\b/i, verb: "Sear & Brown", phase: "Thermal Sear" },
  { regex: /\b(roast|bake|broil)\b/i, verb: "Roast / Bake", phase: "Oven Roast" },
  { regex: /\b(simmer|braise|stew|boil|poach)\b/i, verb: "Simmer & Braise", phase: "Simmer" },
  { regex: /\b(whisk|emulsify|blend|purée|puree|mix|cream)\b/i, verb: "Whisk & Emulsify", phase: "Emulsion" },
  { regex: /\b(sauté|saute|sweat|fry|stir-fry|toast|bloom)\b/i, verb: "Sauté & Bloom", phase: "Aromatics" },
  { regex: /\b(marinate|pickle|macerate|cure|soak|brine)\b/i, verb: "Marinate / Cure", phase: "Prep & Cure" },
  { regex: /\b(plate|serve|garnish|top|drizzle|toss|fold)\b/i, verb: "Fold & Plate", phase: "Finish & Plate" }
];

export function normalizeRecipeRecord(raw, knowledgeGraph = null) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid recipe record.");
  }

  const id = String(raw.id || createEntityId("rec_user")).trim();
  const title = String(raw.title || raw.name || "Untitled Recipe").trim();
  const author = String(raw.author || raw.chefName || "User Kitchen").trim();
  const collectionId = String(raw.collectionId || "user_custom").trim();
  const prepTimeMinutes = Math.max(0, Number(raw.prepTimeMinutes ?? 15));
  const cookTimeMinutes = Math.max(0, Number(raw.cookTimeMinutes ?? 20));
  const servings = Math.max(1, Number(raw.servings ?? 4));

  const rawIngs = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients = rawIngs.map((item) => {
    if (typeof item === "string") {
      const parsed = parseIngredientLine(item, knowledgeGraph);
      return {
        ingredientId: parsed.ingredientId || null,
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        preparation: parsed.preparation,
        preparationNote: parsed.preparationNote,
        role: "supporting_component",
        componentGroup: "Main Dish",
        isStaple: parsed.isStaple,
        isOptional: parsed.isOptional,
        rawText: parsed.rawText
      };
    }
    const resolvedId =
      item.ingredientId ||
      (knowledgeGraph && item.name ? knowledgeGraph.resolveIngredientId(item.name) : null);
    return {
      ingredientId: resolvedId || null,
      name: String(item.name || resolvedId || "Ingredient").trim(),
      quantity: Number(item.quantity ?? 1),
      unit: String(item.unit || "whole").trim(),
      preparation: String(item.preparation || "cooked_default").trim(),
      preparationNote: String(item.preparationNote || "").trim(),
      role: String(item.role || "supporting_component").trim(),
      componentGroup: String(item.componentGroup || "Main Dish").trim(),
      isStaple: Boolean(item.isStaple),
      isOptional: Boolean(item.isOptional),
      rawText: String(
        item.rawText ||
          `${item.quantity ?? 1} ${item.unit || "whole"} ${item.name || ""}${
            item.preparationNote ? `, ${item.preparationNote}` : ""
          }`
      ).trim()
    };
  });

  const rawSteps = Array.isArray(raw.steps)
    ? raw.steps
    : Array.isArray(raw.instructions)
    ? raw.instructions
    : [];

  const steps = rawSteps.map((st, idx) => {
    const text = typeof st === "string" ? st : String(st.instruction || st.text || "").trim();
    let inferredVerb = st?.actionVerb || "";
    let inferredPhase = st?.phase || "";
    if (!inferredVerb || !inferredPhase) {
      for (const pat of ACTION_VERB_PATTERNS) {
        if (pat.regex.test(text)) {
          if (!inferredVerb) inferredVerb = pat.verb;
          if (!inferredPhase) inferredPhase = pat.phase;
          break;
        }
      }
    }
    if (!inferredVerb) inferredVerb = idx === rawSteps.length - 1 ? "Finish & Plate" : `Stage ${idx + 1}`;
    if (!inferredPhase) inferredPhase = idx === 0 ? "Prep & Base" : idx === rawSteps.length - 1 ? "Finish" : "Cook";

    let durationMinutes = Number(st?.durationMinutes ?? 0);
    if (!durationMinutes) {
      const mMatch = text.match(/(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)/i);
      if (mMatch) durationMinutes = Number(mMatch[1]);
    }

    let temperature = String(st?.temperature || "").trim();
    if (!temperature) {
      const tMatch = text.match(/(\d{3}\s*°\s*[FC]|\b(?:high|medium-high|medium-low|medium|low)\s+heat\b)/i);
      if (tMatch) temperature = tMatch[1];
    }

    let ingredientIndices = Array.isArray(st?.ingredientIndices) ? st.ingredientIndices : [];
    if (ingredientIndices.length === 0 && ingredients.length > 0) {
      const lowerText = text.toLowerCase();
      ingredients.forEach((ing, ingIdx) => {
        const words = String(ing.name || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 4);
        if (words.some((w) => lowerText.includes(w))) {
          ingredientIndices.push(ingIdx);
        }
      });
      if (ingredientIndices.length === 0) {
        const start = Math.floor((idx * ingredients.length) / Math.max(1, rawSteps.length));
        const end = Math.max(start + 1, Math.floor(((idx + 1) * ingredients.length) / Math.max(1, rawSteps.length)));
        for (let k = start; k < Math.min(ingredients.length, end); k++) {
          ingredientIndices.push(k);
        }
      }
    }

    return {
      stepNumber: idx + 1,
      phase: inferredPhase,
      actionVerb: inferredVerb,
      instruction: text,
      durationMinutes,
      temperature,
      sensoryCue: String(st?.sensoryCue || "").trim(),
      ingredientIndices
    };
  });

  return {
    id,
    rank: typeof raw.rank === "number" ? raw.rank : null,
    title,
    author,
    chefId: raw.chefId || null,
    collectionId,
    sourceTitle: String(raw.sourceTitle || "Local Culinary Collection").trim(),
    sourceUrl: String(raw.sourceUrl || "").trim(),
    licenseNote: String(
      raw.licenseNote || "Original or user-personalized recipe formulation stored locally."
    ).trim(),
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes: prepTimeMinutes + cookTimeMinutes,
    servings,
    difficulty: String(raw.difficulty || "Easy").trim(),
    courseRole: String(raw.courseRole || "main_course").trim(),
    cuisineIds: Array.isArray(raw.cuisineIds) ? raw.cuisineIds : [],
    cookingMethods: Array.isArray(raw.cookingMethods) ? raw.cookingMethods : ["sauteed"],
    sauceIds: Array.isArray(raw.sauceIds) ? raw.sauceIds : [],
    sideIds: Array.isArray(raw.sideIds) ? raw.sideIds : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    headnote: String(raw.headnote || raw.description || "").trim(),
    ingredients,
    steps,
    isCustom: Boolean(raw.isCustom || collectionId === "user_custom"),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function matchesUserIngredients(graph, recipeIngId, haveSet) {
  if (!recipeIngId || !haveSet || haveSet.size === 0) return false;
  if (haveSet.has(recipeIngId)) return true;
  if (!graph) return false;

  const recIng = graph.ingredients.get(recipeIngId);
  if (recIng?.parentId && haveSet.has(recIng.parentId)) return true;

  for (const userIngId of haveSet) {
    const uIng = graph.ingredients.get(userIngId);
    if (uIng?.parentId && uIng.parentId === recipeIngId) return true;
    if (uIng?.parentId && recIng?.parentId && uIng.parentId === recIng.parentId) return true;
  }
  return false;
}

const COMMON_PANTRY_SEASONINGS = new Set([
  "ing_olive_oil_evoo",
  "ing_mustard_oil_neutral",
  "ing_black_pepper",
  "ing_soy_sauce_shoyu",
  "ing_butter_unsalted",
  "ing_garlic",
  "ing_onion_yellow",
  "ing_turmeric_ground",
  "ing_cumin_seed",
  "ing_oregano_marjoram"
]);

export function discoverRecipes({
  recipes = [],
  knowledgeGraph = null,
  selectedIngredientIds = [],
  searchQuery = "",
  collectionFilter = "all",
  chefFilter = "all",
  courseFilter = "all",
  matchFilter = "all",
  assumePantryStaples = true
}) {
  const haveSet = new Set((selectedIngredientIds || []).filter(Boolean));
  const q = String(searchQuery || "").trim().toLowerCase();

  const evaluated = [];

  for (const recipe of recipes) {
    if (collectionFilter && collectionFilter !== "all") {
      if (collectionFilter === "nyt_top_50_2025" && recipe.collectionId !== "nyt_top_50_2025") continue;
      if (collectionFilter === "renowned_chefs" && recipe.collectionId !== "renowned_chefs" && !recipe.chefId) continue;
      if (collectionFilter === "user_custom" && !recipe.isCustom && recipe.collectionId !== "user_custom") continue;
    }

    if (chefFilter && chefFilter !== "all" && recipe.chefId !== chefFilter) {
      continue;
    }

    if (courseFilter && courseFilter !== "all" && recipe.courseRole !== courseFilter) {
      continue;
    }

    if (q) {
      const hay = [
        recipe.title,
        recipe.author,
        recipe.headnote,
        ...(recipe.tags || []),
        ...(recipe.ingredients || []).map((i) => i.name)
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const matchedIngredients = [];
    const missingEssentialIngredients = [];
    const missingStapleIngredients = [];

    for (const ing of recipe.ingredients || []) {
      if (ing.isOptional) continue;
      const isMatched = matchesUserIngredients(knowledgeGraph, ing.ingredientId, haveSet);
      if (isMatched) {
        matchedIngredients.push(ing);
      } else if (
        assumePantryStaples &&
        (ing.isStaple || (ing.role === "seasoning" && COMMON_PANTRY_SEASONINGS.has(ing.ingredientId)))
      ) {
        missingStapleIngredients.push(ing);
      } else {
        missingEssentialIngredients.push(ing);
      }
    }

    const totalEssential = Math.max(1, matchedIngredients.length + missingEssentialIngredients.length);
    const coveragePercent = Math.round((matchedIngredients.length / totalEssential) * 100);
    const missingCount = missingEssentialIngredients.length;

    let matchTier = "inspiration";
    let matchLabel = `${missingCount} additional ingredients needed`;
    if (haveSet.size > 0) {
      if (missingCount === 0 && matchedIngredients.length > 0) {
        matchTier = "ready_to_cook";
        matchLabel = "Ready to Cook (0 missing)";
      } else if (missingCount <= 2 && matchedIngredients.length > 0) {
        matchTier = "almost_there";
        matchLabel = `Almost There (Only ${missingCount} more needed)`;
      } else if (missingCount <= 4 && matchedIngredients.length > 0) {
        matchTier = "few_missing";
        matchLabel = `Few Additional (${missingCount} needed)`;
      }
    } else {
      matchLabel = `${totalEssential} core ingredients`;
    }

    if (matchFilter === "ready_or_almost" && (missingCount > 2 || (haveSet.size > 0 && matchedIngredients.length === 0))) continue;
    if (matchFilter === "up_to_4_missing" && (missingCount > 4 || (haveSet.size > 0 && matchedIngredients.length === 0))) continue;
    if (matchFilter === "uses_selected" && haveSet.size > 0 && matchedIngredients.length === 0) continue;

    const rankScore =
      haveSet.size > 0
        ? matchedIngredients.length * 28 + coveragePercent * 0.6 - missingCount * 6
        : recipe.rank
        ? 100 - recipe.rank
        : 60;

    evaluated.push({
      recipe,
      matchedIngredients,
      missingEssentialIngredients,
      missingStapleIngredients,
      missingCount,
      coveragePercent,
      matchTier,
      matchLabel,
      discoveryScore: Number(rankScore.toFixed(1))
    });
  }

  return evaluated.sort((a, b) => {
    if (haveSet.size > 0) {
      if (b.matchedIngredients.length !== a.matchedIngredients.length) {
        return b.matchedIngredients.length - a.matchedIngredients.length;
      }
      if (a.missingCount !== b.missingCount) {
        return a.missingCount - b.missingCount;
      }
      return b.coveragePercent - a.coveragePercent;
    }
    const rankA = a.recipe.rank ?? 999;
    const rankB = b.recipe.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.recipe.title.localeCompare(b.recipe.title);
  });
}

export function convertRecipeToDish(knowledgeGraph, recipe) {
  const seenIngIds = new Set();
  const dishIngredients = [];

  for (const item of recipe.ingredients || []) {
    const ingId =
      item.ingredientId ||
      (knowledgeGraph && item.name ? knowledgeGraph.resolveIngredientId(item.name) : null);
    if (!ingId || seenIngIds.has(ingId)) continue;
    seenIngIds.add(ingId);
    dishIngredients.push({
      ingredientId: ingId,
      fallbackName: item.name || ingId,
      role: item.role || "supporting_component",
      preparation: item.preparation || "cooked_default",
      isOverride: false,
      addedAt: new Date().toISOString()
    });
  }

  return createDish({
    name: recipe.title,
    description: recipe.headnote || `By ${recipe.author}`,
    notes: `Source: ${recipe.author} (${recipe.sourceTitle || "Recipe Collection"}). Servings: ${recipe.servings}. Prep: ${recipe.prepTimeMinutes}m, Cook: ${recipe.cookTimeMinutes}m.`,
    courseRole:
      recipe.courseRole === "pasta_grain" || recipe.courseRole === "salad_vegetable"
        ? "first_course"
        : recipe.courseRole || "main_course",
    cuisineIds: [...(recipe.cuisineIds || [])],
    cookingMethods: [...(recipe.cookingMethods || ["sauteed"])],
    ingredients: dishIngredients,
    sauceIds: [...(recipe.sauceIds || [])],
    sideIds: [...(recipe.sideIds || [])]
  });
}

export function convertDishToRecipeDraft(knowledgeGraph, dish) {
  const ingredients = (dish.ingredients || []).map((sel) => {
    const canon = knowledgeGraph?.ingredients?.get(sel.ingredientId);
    const name = canon?.name?.split(" (")[0] || sel.fallbackName || sel.ingredientId;
    const isMain = sel.role === "main_component";
    const isAromatic = sel.role === "aromatic" || sel.role === "seasoning";
    return {
      ingredientId: sel.ingredientId,
      name,
      quantity: isMain ? 1.5 : isAromatic ? 2 : 0.5,
      unit: isMain ? "lb" : isAromatic ? "tbsp" : "cup",
      preparation: sel.preparation || "sauteed",
      preparationNote: sel.preparation || "prepared",
      role: sel.role || "supporting_component",
      componentGroup: isMain ? "Main Component" : isAromatic ? "Aromatics & Seasoning" : "Supporting & Finish",
      isStaple: false,
      isOptional: false
    };
  });

  const mainIndices = [];
  const aromaticIndices = [];
  ingredients.forEach((ing, idx) => {
    if (ing.role === "main_component") mainIndices.push(idx);
    else if (ing.role === "aromatic" || ing.role === "seasoning" || ing.role === "fat") aromaticIndices.push(idx);
  });

  const allIndices = ingredients.map((_, idx) => idx);
  const step1Indices =
    aromaticIndices.length > 0 ? aromaticIndices : allIndices.slice(0, Math.max(1, Math.ceil(allIndices.length / 2)));
  const step2Indices = mainIndices.length > 0 ? [...step1Indices, ...mainIndices] : allIndices;

  const steps = [
    {
      stepNumber: 1,
      phase: "Prep & Aromatics",
      actionVerb: "Prep & Sweat Aromatics",
      instruction: `Prepare and measure all components. Warm cooking fat over medium heat and bloom the aromatics and seasonings until fragrant.`,
      durationMinutes: 8,
      temperature: "Medium Heat",
      sensoryCue: "Fragrant aromatic base without scorching",
      ingredientIndices: step1Indices
    },
    {
      stepNumber: 2,
      phase: "Thermal Cooking",
      actionVerb: "Cook Primary Components",
      instruction: `Cook the primary dish components using ${
        (dish.cookingMethods || ["sauteed"]).join(" / ")
      } technique until tender and golden.`,
      durationMinutes: 15,
      temperature: "Medium-High Heat",
      sensoryCue: "Golden Maillard development and tender interior",
      ingredientIndices: step2Indices
    },
    {
      stepNumber: 3,
      phase: "Finish & Plate",
      actionVerb: "Balance, Emulsify & Plate",
      instruction: `Fold in finishing acids, garnishes, and supporting accompaniments, taste for salt-acid-fat equilibrium, and serve warm.`,
      durationMinutes: 4,
      temperature: "Warm Service",
      sensoryCue: "Glossy, balanced finish",
      ingredientIndices: allIndices
    }
  ];

  return normalizeRecipeRecord(
    {
      id: createEntityId("rec_from_dish"),
      title: dish.name || "Custom Workbench Recipe",
      author: "Personal Culinary Workbench",
      collectionId: "user_custom",
      prepTimeMinutes: 15,
      cookTimeMinutes: 25,
      servings: 4,
      courseRole: dish.courseRole || "main_course",
      cuisineIds: [...(dish.cuisineIds || [])],
      cookingMethods: [...(dish.cookingMethods || ["sauteed"])],
      sauceIds: [...(dish.sauceIds || [])],
      sideIds: [...(dish.sideIds || [])],
      tags: ["Custom Dish Conversion", "Workbench"],
      headnote: dish.notes || `Converted from Dish Workbench selection (${ingredients.length} ingredients).`,
      ingredients,
      steps,
      isCustom: true
    },
    knowledgeGraph
  );
}

export function parseRecipeImportPayload(rawInput, knowledgeGraph = null) {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) {
    throw new Error("Recipe import input is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Malformed JSON in recipe import: ${err.message}`);
    }
    const rawArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.recipes)
      ? parsed.recipes
      : [parsed];
    return rawArray.map((item) =>
      normalizeRecipeRecord({ ...item, isCustom: true, collectionId: item.collectionId || "user_custom" }, knowledgeGraph)
    );
  }

  const blocks = trimmed.split(/\n---+\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const title = (lines[0] || "Imported Recipe").replace(/^#+\s*/, "").trim();

    const ingLines = [];
    const stepLines = [];
    let section = "header";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:#+\s*)?ingredients?:?$/i.test(line)) {
        section = "ingredients";
        continue;
      }
      if (/^(?:#+\s*)?(?:instructions?|steps?|directions?|method):?$/i.test(line)) {
        section = "steps";
        continue;
      }
      if (section === "ingredients" || (section === "header" && /^(\*|-|•|\d+|\d+\/\d+|[½⅓⅔¼¾⅛])/.test(line))) {
        ingLines.push(line);
      } else {
        stepLines.push(line.replace(/^(?:step\s*\d+[:.]?|\d+[.)])\s*/i, ""));
      }
    }

    return normalizeRecipeRecord(
      {
        id: createEntityId("rec_import"),
        title,
        author: "Imported Collection",
        collectionId: "user_custom",
        ingredients: ingLines.length > 0 ? ingLines : ["1 tbsp olive oil", "2 cloves garlic, minced"],
        steps: stepLines.length > 0 ? stepLines : ["Prepare ingredients and cook until tender."],
        isCustom: true
      },
      knowledgeGraph
    );
  });
}
