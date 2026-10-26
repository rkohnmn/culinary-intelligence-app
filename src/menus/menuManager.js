/**
 * @fileoverview Multi-course menu construction and menu-level culinary evaluation (`src/menus/menuManager.js`).
 *
 * Implements Requirement 13:
 * - Flexible course categories (Appetizer, Soup, Salad, Main Course, Side, Dessert, or Custom user-defined course)
 * - Safe dish reuse semantics: Snapshot-on-Assignment (`dishSnapshot` + `linkedLibraryDishId`).
 *   Placing the same saved dish into multiple menus creates an isolated deep snapshot in each menu,
 *   preventing accidental cross-menu corruption while retaining the link to sync or save back to the library.
 * - Menu-level evaluation:
 *   1. Repeated dominant/main ingredients across courses
 *   2. Repeated rich sauce profiles or heavy dairy/lipid saturation across consecutive courses
 *   3. Acid/richness progression and palate cleansers
 *   4. Texture contrast vs monotony across the meal
 *   5. Cuisine/theme coherence observations (advisory, never enforcing a rigid Western structure)
 */

import { SCHEMA_VERSION } from "../core/types.js";
import { createEntityId, createDish } from "../dishes/dishManager.js";
import { analyzeDishStructure } from "../core/compatibility.js";

export const STANDARD_COURSE_TYPES = Object.freeze([
  { id: "appetizer", label: "Appetizer / Starter" },
  { id: "soup", label: "Soup / Broth" },
  { id: "salad", label: "Salad / Crudo" },
  { id: "main_course", label: "Main Course" },
  { id: "side", label: "Side / Accompaniment" },
  { id: "cheese_intermezzo", label: "Cheese / Intermezzo" },
  { id: "dessert", label: "Dessert" },
  { id: "custom", label: "User-Defined Course" }
]);

/**
 * Creates a new multi-course Menu object.
 * @param {Partial<import("../core/types.js").Menu>} [initial]
 * @returns {import("../core/types.js").Menu}
 */
export function createMenu(initial = {}) {
  const now = new Date().toISOString();
  return {
    id: initial.id || createEntityId("menu"),
    name: initial.name ?? "Untitled Tasting Menu",
    description: initial.description ?? "",
    theme: initial.theme ?? "",
    cuisineIds: Array.isArray(initial.cuisineIds) ? [...initial.cuisineIds] : [],
    items: Array.isArray(initial.items)
      ? initial.items.map((item, idx) => ({
          ...item,
          order: typeof item.order === "number" ? item.order : idx,
          dishSnapshot: createDish(structuredClone(item.dishSnapshot))
        }))
      : [],
    notes: initial.notes ?? "",
    createdAt: initial.createdAt || now,
    updatedAt: initial.updatedAt || now,
    schemaVersion: SCHEMA_VERSION
  };
}

/**
 * Duplicates a menu with a new ID and deep-cloned course snapshots.
 * @param {import("../core/types.js").Menu} menu
 * @param {string} [newName]
 * @returns {import("../core/types.js").Menu}
 */
export function duplicateMenu(menu, newName) {
  const now = new Date().toISOString();
  return createMenu({
    ...structuredClone(menu),
    id: createEntityId("menu"),
    name: newName || `${menu.name} (Copy)`,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * Adds a dish to a menu as an isolated snapshot (preserving `linkedLibraryDishId` so
 * editing the dish inside this menu never corrupts other menus or the library dish).
 *
 * @param {import("../core/types.js").Menu} menu
 * @param {import("../core/types.js").Dish} dish
 * @param {Object} [options]
 * @param {string} [options.courseType]
 * @param {string} [options.customCourseLabel]
 * @returns {import("../core/types.js").Menu}
 */
export function addDishToMenu(menu, dish, options = {}) {
  const snapshot = createDish({
    ...structuredClone(dish),
    id: createEntityId("dish_snap"),
    sourceDishId: dish.id
  });

  const entry = {
    entryId: createEntityId("course_entry"),
    courseType: options.courseType || dish.courseRole || "main_course",
    customCourseLabel: options.customCourseLabel || "",
    order: menu.items.length,
    dishSnapshot: snapshot,
    linkedLibraryDishId: dish.id
  };

  return {
    ...menu,
    items: [...menu.items, entry],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Removes a course entry from a menu and re-normalizes course order indices.
 * @param {import("../core/types.js").Menu} menu
 * @param {string} entryId
 * @returns {import("../core/types.js").Menu}
 */
export function removeDishFromMenu(menu, entryId) {
  const filtered = menu.items
    .filter((item) => item.entryId !== entryId)
    .map((item, idx) => ({ ...item, order: idx }));
  return {
    ...menu,
    items: filtered,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Reorders a course entry within a menu (moving up/down or to a target index).
 * @param {import("../core/types.js").Menu} menu
 * @param {string} entryId
 * @param {number} targetIndex
 * @returns {import("../core/types.js").Menu}
 */
export function reorderMenuCourse(menu, entryId, targetIndex) {
  const list = [...menu.items].sort((a, b) => a.order - b.order);
  const currentIndex = list.findIndex((item) => item.entryId === entryId);
  if (currentIndex === -1) return menu;

  const boundedTarget = Math.max(0, Math.min(list.length - 1, targetIndex));
  const [moved] = list.splice(currentIndex, 1);
  list.splice(boundedTarget, 0, moved);

  const reindexed = list.map((item, idx) => ({ ...item, order: idx }));
  return {
    ...menu,
    items: reindexed,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates the course category, custom label, or isolated `dishSnapshot` of a menu entry.
 * @param {import("../core/types.js").Menu} menu
 * @param {string} entryId
 * @param {Object} updates
 * @param {string} [updates.courseType]
 * @param {string} [updates.customCourseLabel]
 * @param {import("../core/types.js").Dish} [updates.dishSnapshot]
 * @returns {import("../core/types.js").Menu}
 */
export function updateMenuCourseEntry(menu, entryId, updates = {}) {
  const nextItems = menu.items.map((item) => {
    if (item.entryId !== entryId) return item;
    return {
      ...item,
      courseType: updates.courseType ?? item.courseType,
      customCourseLabel: updates.customCourseLabel ?? item.customCourseLabel,
      dishSnapshot: updates.dishSnapshot
        ? createDish(structuredClone(updates.dishSnapshot))
        : item.dishSnapshot
    };
  });
  return {
    ...menu,
    items: nextItems,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Evaluates a complete multi-course menu for cross-dish harmony, repetition,
 * richness/acid progression, texture diversity, and connective suggestions.
 *
 * @param {import("../data/knowledgeGraph.js").CulinaryKnowledgeGraph} graph
 * @param {import("../core/types.js").Menu} menu
 * @returns {{
 *   observations: Array<{ id: string, type: "warning"|"suggestion"|"strength", title: string, explanation: string, affectedEntryIds: string[] }>,
 *   courseSummaries: Array<Object>,
 *   overallRichnessScore: number,
 *   overallAcidityScore: number,
 *   sharedCuisines: string[]
 * }}
 */
export function evaluateMenu(graph, menu) {
  const orderedItems = [...(menu?.items || [])].sort((a, b) => a.order - b.order);
  const observations = [];
  const courseSummaries = [];

  if (orderedItems.length === 0) {
    return {
      observations: [],
      courseSummaries: [],
      overallRichnessScore: 0,
      overallAcidityScore: 0,
      sharedCuisines: []
    };
  }

  // Track ingredients, main components, sauce categories, and flavor profiles across courses
  const ingredientOccurrences = new Map(); // ingId -> Array<{ entryId, dishName, role }>
  const sauceCategoryOccurrences = new Map(); // sauceCategory -> Array<{ entryId, dishName, sauceName }>
  const courseTextures = [];
  const cuisineCounts = new Map();

  let richnessSum = 0;
  let aciditySum = 0;
  let highRichnessCourseCount = 0;
  let highAcidCourseCount = 0;

  for (const entry of orderedItems) {
    const dish = entry.dishSnapshot;
    const struct = analyzeDishStructure(graph, dish);
    richnessSum += struct.averages.perceivedRichness || 0;
    aciditySum += struct.averages.acidity || 0;

    if ((struct.averages.perceivedRichness || 0) >= 2.8 || struct.maxRichness >= 4) {
      highRichnessCourseCount++;
    }
    if ((struct.averages.acidity || 0) >= 2.2 || struct.maxAcidity >= 3) {
      highAcidCourseCount++;
    }

    for (const sel of dish.ingredients || []) {
      if (!ingredientOccurrences.has(sel.ingredientId)) {
        ingredientOccurrences.set(sel.ingredientId, []);
      }
      ingredientOccurrences.get(sel.ingredientId).push({
        entryId: entry.entryId,
        dishName: dish.name,
        role: sel.role
      });
    }

    for (const sId of dish.sauceIds || []) {
      const sauce = graph.sauces.get(sId);
      if (!sauce) continue;
      if (!sauceCategoryOccurrences.has(sauce.category)) {
        sauceCategoryOccurrences.set(sauce.category, []);
      }
      sauceCategoryOccurrences.get(sauce.category).push({
        entryId: entry.entryId,
        dishName: dish.name,
        sauceName: sauce.name
      });
    }

    for (const cId of dish.cuisineIds || []) {
      cuisineCounts.set(cId, (cuisineCounts.get(cId) || 0) + 1);
    }

    // Primary texture signature of the dish
    const dishTextures = new Set();
    for (const sel of dish.ingredients || []) {
      const fp = graph.getEffectiveFlavorProfile(sel.ingredientId, sel.preparation);
      for (const t of fp?.textures || []) dishTextures.add(t);
    }
    courseTextures.push({
      entryId: entry.entryId,
      dishName: dish.name,
      textures: Array.from(dishTextures)
    });

    courseSummaries.push({
      entryId: entry.entryId,
      courseType: entry.courseType,
      customCourseLabel: entry.customCourseLabel,
      dishName: dish.name,
      ingredientCount: (dish.ingredients || []).length,
      richness: struct.averages.perceivedRichness || 0,
      acidity: struct.averages.acidity || 0,
      umami: struct.averages.umami || 0,
      heat: struct.averages.heatPungency || 0
    });
  }

  // 1. Check for repeated dominant / main ingredients across multiple courses
  for (const [ingId, uses] of ingredientOccurrences.entries()) {
    if (uses.length < 2) continue;
    const ing = graph.ingredients.get(ingId);
    const mainUses = uses.filter(
      (u) => u.role === "main_component" || u.role === "supporting_component"
    );
    if (mainUses.length >= 2) {
      observations.push({
        id: `menu_obs_repeat_ing_${ingId}`,
        type: "warning",
        title: `Repeated Prominent Ingredient: ${ing?.name || ingId}`,
        explanation: `${ing?.name || ingId} appears as a main or supporting component across ${
          mainUses.length
        } dishes (${mainUses.map((u) => u.dishName).join(", ")}). Consider varying the primary protein/vegetable or shifting one occurrence to a subtle garnish.`,
        affectedEntryIds: mainUses.map((u) => u.entryId)
      });
    }
  }

  // 2. Check for repeated sauce profiles (e.g., two courses relying on rich butter emulsions or nut emulsions)
  for (const [cat, uses] of sauceCategoryOccurrences.entries()) {
    if (uses.length >= 2) {
      observations.push({
        id: `menu_obs_repeat_sauce_${cat}`,
        type: "warning",
        title: `Repeated Sauce Structure (${cat.replace(/_/g, " ")})`,
        explanation: `Multiple courses rely on ${cat.replace(/_/g, " ")} sauces (${uses
          .map((u) => `${u.dishName}: ${u.sauceName}`)
          .join("; ")}). Swapping one for a lighter vinaigrette, clear broth, or herb condiment will improve course progression.`,
        affectedEntryIds: uses.map((u) => u.entryId)
      });
    }
  }

  // 3. Check overall richness vs acidity balance across the menu
  if (orderedItems.length >= 2 && highRichnessCourseCount >= 2 && highAcidCourseCount === 0) {
    observations.push({
      id: "menu_obs_heavy_richness_no_relief",
      type: "warning",
      title: "High Cumulative Richness Across Courses",
      explanation:
        "Several courses carry heavy fat/lipid richness without an acidic salad, crudo, pickled accompaniment, or citrus-forward course to refresh the palate.",
      affectedEntryIds: orderedItems.map((i) => i.entryId)
    });
  } else if (orderedItems.length >= 2 && highRichnessCourseCount >= 1 && highAcidCourseCount >= 1) {
    observations.push({
      id: "menu_obs_balanced_progression",
      type: "strength",
      title: "Balanced Richness and Acidic Relief",
      explanation:
        "The menu pairs richer savory courses with bright acidic elements, preventing palate fatigue across the progression.",
      affectedEntryIds: orderedItems.map((i) => i.entryId)
    });
  }

  // 4. Check for consecutive courses with nearly identical high acidity
  let consecutiveHighAcid = 0;
  for (const cs of courseSummaries) {
    if (cs.acidity >= 2.6) consecutiveHighAcid++;
    else consecutiveHighAcid = 0;
    if (consecutiveHighAcid >= 3) {
      observations.push({
        id: "menu_obs_excessive_acid_streak",
        type: "suggestion",
        title: "Several Courses Share a Strong Acidic Profile",
        explanation:
          "Three or more consecutive courses feature high acidity. Introducing a comforting starch, grain, or creamy/umami element can round the menu's arc.",
        affectedEntryIds: courseSummaries.map((c) => c.entryId)
      });
      break;
    }
  }

  // 5. Check texture contrast across courses
  if (orderedItems.length >= 2) {
    const allSoftOrCreamy = courseTextures.every(
      (ct) =>
        ct.textures.length > 0 &&
        ct.textures.every(
          (t) =>
            t.includes("creamy") ||
            t.includes("velvety") ||
            t.includes("soft") ||
            t.includes("tender") ||
            t.includes("puree")
        )
    );
    if (allSoftOrCreamy) {
      observations.push({
        id: "menu_obs_texture_monotony",
        type: "suggestion",
        title: "Uniformly Soft / Creamy Textures Across Courses",
        explanation:
          "Every dish in the menu emphasizes soft, braised, or pureed textures. Adding toasted nuts/seeds (dukkah, pangrattato, almonds), crisp raw vegetables, or a seared crust will create welcome textural contrast.",
        affectedEntryIds: orderedItems.map((i) => i.entryId)
      });
    }
  }

  // 6. Single-dish menu suggestion: suggest a complementary side or starter
  if (orderedItems.length === 1) {
    const onlyDish = orderedItems[0].dishSnapshot;
    const onlyStruct = analyzeDishStructure(graph, onlyDish);
    if (onlyStruct.maxRichness >= 3) {
      observations.push({
        id: "menu_obs_single_dish_pairing_tip",
        type: "suggestion",
        title: "Complementary Course Suggestion",
        explanation: `${onlyDish.name} has a rich profile. Consider pairing it with a crisp acidic starter or shaved fennel/chicory salad to open or refresh the meal.`,
        affectedEntryIds: [orderedItems[0].entryId]
      });
    } else {
      observations.push({
        id: "menu_obs_single_dish_ready",
        type: "strength",
        title: "Single-Course Menu Active",
        explanation: `${onlyDish.name} is ready. Add additional courses (starter, side, or dessert) to evaluate multi-course progression.`,
        affectedEntryIds: [orderedItems[0].entryId]
      });
    }
  }

  const sharedCuisines = Array.from(cuisineCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cid]) => graph.cuisines.get(cid)?.name || cid);

  return {
    observations,
    courseSummaries,
    overallRichnessScore: Number((richnessSum / orderedItems.length).toFixed(2)),
    overallAcidityScore: Number((aciditySum / orderedItems.length).toFixed(2)),
    sharedCuisines
  };
}
