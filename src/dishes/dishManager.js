/**
 * @fileoverview Dish domain management (`src/dishes/dishManager.js`).
 * Supports creating, editing, duplicating, adding/removing ingredients in arbitrary order,
 * assigning contextual roles and preparation states, managing sauces and composed sides,
 * and recording explicit compatibility overrides without repeated user nagging.
 */

import { SCHEMA_VERSION } from "../core/types.js";
import { inferBestRoleForCandidate, analyzeDishStructure } from "../core/compatibility.js";

/**
 * Generates a deterministic or random collision-free ID.
 * @param {string} [prefix="dish"]
 * @returns {string}
 */
export function createEntityId(prefix = "dish") {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Creates a clean working dish object.
 * @param {Partial<import("../core/types.js").Dish>} [initial]
 * @returns {import("../core/types.js").Dish}
 */
export function createDish(initial = {}) {
  const now = new Date().toISOString();
  return {
    id: initial.id || createEntityId("dish"),
    name: initial.name ?? "Untitled Culinary Creation",
    description: initial.description ?? "",
    ingredients: Array.isArray(initial.ingredients)
      ? initial.ingredients.map((item) => ({ ...item }))
      : [],
    sauceIds: Array.isArray(initial.sauceIds) ? [...initial.sauceIds] : [],
    sideIds: Array.isArray(initial.sideIds) ? [...initial.sideIds] : [],
    cookingMethods: Array.isArray(initial.cookingMethods) ? [...initial.cookingMethods] : [],
    cuisineIds: Array.isArray(initial.cuisineIds) ? [...initial.cuisineIds] : [],
    courseRole: initial.courseRole || "main_course",
    notes: initial.notes ?? "",
    acceptedOverrides: initial.acceptedOverrides ? { ...initial.acceptedOverrides } : {},
    sourceDishId: initial.sourceDishId || undefined,
    createdAt: initial.createdAt || now,
    updatedAt: initial.updatedAt || now,
    schemaVersion: SCHEMA_VERSION
  };
}

/**
 * Deep-clones and duplicates an existing dish with a fresh ID and timestamps.
 * @param {import("../core/types.js").Dish} dish
 * @param {string} [newName]
 * @returns {import("../core/types.js").Dish}
 */
export function duplicateDish(dish, newName) {
  const now = new Date().toISOString();
  return createDish({
    ...structuredClone(dish),
    id: createEntityId("dish"),
    name: newName || `${dish.name} (Copy)`,
    sourceDishId: dish.id,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * Adds an ingredient to a dish, automatically inferring its contextual role and default preparation
 * if not explicitly specified, and recording override metadata if the user confirmed a challenging pairing.
 *
 * @param {import("../data/knowledgeGraph.js").CulinaryKnowledgeGraph} graph
 * @param {import("../core/types.js").Dish} dish
 * @param {string} ingredientId
 * @param {Object} [options]
 * @param {string} [options.role]
 * @param {string} [options.preparation]
 * @param {boolean} [options.isOverride=false]
 * @param {string} [options.overrideReason]
 * @returns {import("../core/types.js").Dish} Updated immutable dish copy
 */
export function addIngredientToDish(graph, dish, ingredientId, options = {}) {
  if (!dish || !ingredientId) return dish;
  if (dish.ingredients.some((i) => i.ingredientId === ingredientId)) {
    return dish;
  }

  const ing = graph.ingredients.get(ingredientId);
  const structure = analyzeDishStructure(graph, dish);

  const inferredRole =
    options.role ||
    (ing ? inferBestRoleForCandidate(ing, structure) : "supporting_component");

  const inferredPrep =
    options.preparation ||
    (ing && Array.isArray(ing.preparations) && ing.preparations.length > 0
      ? ing.preparations[0]
      : "raw");

  const nextAcceptedOverrides = { ...(dish.acceptedOverrides || {}) };
  if (options.isOverride) {
    nextAcceptedOverrides[ingredientId] = true;
  }

  const entry = {
    ingredientId,
    fallbackName: ing?.name || options.fallbackName || ingredientId,
    role: inferredRole,
    preparation: inferredPrep,
    isOverride: Boolean(options.isOverride),
    overrideReason: options.overrideReason || undefined,
    addedAt: new Date().toISOString()
  };

  return {
    ...dish,
    ingredients: [...dish.ingredients, entry],
    acceptedOverrides: nextAcceptedOverrides,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Removes an ingredient from a dish and cleans up any override flags that depended solely on it.
 * (Requirement 9.5: Removal and revision must invalidate stale warnings and overrides.)
 *
 * @param {import("../core/types.js").Dish} dish
 * @param {string} ingredientId
 * @returns {import("../core/types.js").Dish}
 */
export function removeIngredientFromDish(dish, ingredientId) {
  if (!dish) return dish;
  const nextIngredients = dish.ingredients.filter((i) => i.ingredientId !== ingredientId);
  const nextOverrides = {};
  for (const [k, v] of Object.entries(dish.acceptedOverrides || {})) {
    if (k !== ingredientId && !k.includes(ingredientId)) {
      nextOverrides[k] = v;
    }
  }
  return {
    ...dish,
    ingredients: nextIngredients,
    acceptedOverrides: nextOverrides,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates the role or preparation state of a selected ingredient in the dish.
 *
 * @param {import("../core/types.js").Dish} dish
 * @param {string} ingredientId
 * @param {Object} updates
 * @param {string} [updates.role]
 * @param {string} [updates.preparation]
 * @returns {import("../core/types.js").Dish}
 */
export function updateDishIngredient(dish, ingredientId, updates = {}) {
  if (!dish) return dish;
  const nextIngredients = dish.ingredients.map((item) => {
    if (item.ingredientId !== ingredientId) return item;
    return {
      ...item,
      role: updates.role ?? item.role,
      preparation: updates.preparation ?? item.preparation
    };
  });
  return {
    ...dish,
    ingredients: nextIngredients,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Toggles a sauce template on the dish.
 * @param {import("../core/types.js").Dish} dish
 * @param {string} sauceId
 * @returns {import("../core/types.js").Dish}
 */
export function toggleDishSauce(dish, sauceId) {
  const current = new Set(dish.sauceIds || []);
  if (current.has(sauceId)) {
    current.delete(sauceId);
  } else {
    current.add(sauceId);
  }
  return {
    ...dish,
    sauceIds: Array.from(current),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Toggles a composed side template on the dish.
 * @param {import("../core/types.js").Dish} dish
 * @param {string} sideId
 * @returns {import("../core/types.js").Dish}
 */
export function toggleDishSide(dish, sideId) {
  const current = new Set(dish.sideIds || []);
  if (current.has(sideId)) {
    current.delete(sideId);
  } else {
    current.add(sideId);
  }
  return {
    ...dish,
    sideIds: Array.from(current),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates metadata fields (name, description, notes, cuisineIds, cookingMethods, courseRole) on a dish.
 * @param {import("../core/types.js").Dish} dish
 * @param {Partial<import("../core/types.js").Dish>} fields
 * @returns {import("../core/types.js").Dish}
 */
export function updateDishMetadata(dish, fields = {}) {
  return {
    ...dish,
    ...fields,
    updatedAt: new Date().toISOString()
  };
}
