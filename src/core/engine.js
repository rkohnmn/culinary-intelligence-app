/**
 * @fileoverview Main deterministic recommendation engine (`CulinaryEngine`).
 *
 * Exposes the unified engine contract required by Section 11 & Section 17.2:
 * - Search ingredients with real-time dish context (`searchIngredients`)
 * - Resolve canonical ingredient IDs (`resolveIngredientId`)
 * - Evaluate the complete current dish (`evaluateDish`)
 * - Generate and rank contextual ingredient additions (`recommendIngredients`)
 *   with default filtering of strong incompatibilities, while preserving all
 *   explicitly overridden selections in subsequent multi-ingredient calculations
 * - Recommend known sauces AND dynamic sauce constructions (`recommendSauces`)
 * - Recommend composed sides/accompaniments AND single accompanying ingredients (`recommendSides`)
 * - Identify compatibility concerns (`getCompatibilityWarnings`)
 * - Find rescue/bridge suggestions (`getBridgeSuggestions`)
 */

import { searchIngredientsWithContext } from "./search.js";
import {
  analyzeDishStructure,
  evaluatePairwise,
  evaluateCandidateAgainstDish,
  evaluateDishWarnings
} from "./compatibility.js";
import { findBridgeSuggestions } from "./bridge.js";

/**
 * Resolves the primary focal ingredient of a dish deterministically and independent of array insertion order.
 * Prefers `role === "main_component"`, then `defaultRoles[0] === "main_component"`, sorted by canonical ID.
 */
function resolvePrimaryDishIngredient(graph, selected) {
  if (!selected || selected.length === 0) return null;
  const canonical = [...selected].sort((a, b) =>
    String(a.ingredientId || "").localeCompare(String(b.ingredientId || ""))
  );
  const explicitMain = canonical.find((s) => s.role === "main_component" && graph.ingredients.has(s.ingredientId));
  if (explicitMain) return graph.ingredients.get(explicitMain.ingredientId);

  const defaultMain = canonical.find((s) => {
    const ing = graph.ingredients.get(s.ingredientId);
    return ing && ing.defaultRoles?.[0] === "main_component";
  });
  if (defaultMain) return graph.ingredients.get(defaultMain.ingredientId);

  for (const s of canonical) {
    const ing = graph.ingredients.get(s.ingredientId);
    if (ing) return ing;
  }
  return null;
}

export class CulinaryEngine {
  /**
   * @param {import("../data/knowledgeGraph.js").CulinaryKnowledgeGraph} knowledgeGraph
   */
  constructor(knowledgeGraph) {
    this.graph = knowledgeGraph;
  }

  /**
   * Resolves a canonical ID, display name, or alias to a canonical ingredient ID.
   * @param {string} queryOrId
   * @returns {string|null}
   */
  resolveIngredientId(queryOrId) {
    return this.graph.resolveIngredientId(queryOrId);
  }

  /**
   * Searches ingredients with real-time compatibility status against the working dish.
   * Explicitly returns normally excluded/incompatible ingredients when searched so the
   * user can inspect the warning and override if desired.
   *
   * @param {string} query
   * @param {Object} [dish]
   * @param {Object} [options]
   * @returns {Array<Object>}
   */
  searchIngredients(query, dish = null, options = {}) {
    return searchIngredientsWithContext(this.graph, query, dish, options);
  }

  /**
   * Generates deterministic, ranked ingredient recommendations for the current dish.
   *
   * Enforces:
   * - Default exclusion of candidates with documented or inferred strong conflicts
   *   (`hasConflict === true` or `totalScore < 40`)
   * - Evaluation against the COMPLETE active selection (including any previously
   *   overridden ingredients A + B + C, selected sauces, and selected composed sides)
   * - Fallback guidance if a strict category/role filter yields few high-confidence matches
   *
   * @param {Object} dish
   * @param {Object} [options]
   * @param {string} [options.categoryFilter]
   * @param {string} [options.roleFilter]
   * @param {number} [options.limit=24]
   * @returns {{
   *   recommendations: Array<Object>,
   *   groupedByRole: Record<string, Array<Object>>,
   *   excludedConflictCount: number,
   *   fallbackMessage: string|null
   * }}
   */
  recommendIngredients(dish, options = {}) {
    const { categoryFilter = "", roleFilter = "", limit = 24 } = options;
    const selected = dish?.ingredients || [];
    const structure = analyzeDishStructure(this.graph, dish);
    const selectedIds = structure.activeIngredientIds;

    // If the dish has no ingredients yet, check if a sauce, side, cuisine, or cooking method was chosen first!
    // (Requirement 3.1 & 12.2: User may begin with a sauce, culinary tradition, cooking method, vegetable, etc.)
    const hasStartingContext =
      selected.length > 0 ||
      (dish?.sauceIds && dish.sauceIds.length > 0) ||
      (dish?.sideIds && dish.sideIds.length > 0) ||
      (dish?.cuisineIds && dish.cuisineIds.length > 0) ||
      (dish?.cookingMethods && dish.cookingMethods.length > 0);

    const evaluations = [];
    let excludedConflictCount = 0;

    for (const ing of this.graph.ingredients.values()) {
      if (selectedIds.has(ing.id)) continue;
      if (categoryFilter && !ing.categories.includes(categoryFilter)) continue;
      if (roleFilter && !ing.defaultRoles.includes(roleFilter)) continue;

      if (!hasStartingContext) {
        // Starter recommendations across diverse roles when dish is completely blank
        evaluations.push({
          candidateId: ing.id,
          itemType: "ingredient",
          name: ing.name,
          categories: ing.categories,
          totalScore: 70 + (ing.defaultRoles.includes("main_component") ? 8 : 0),
          scoreBreakdown: {
            pairingSupport: 0,
            contextualFit: 10,
            roleUsefulness: 15,
            balanceContribution: 10,
            bridgeBenefit: 0,
            cuisineAlignment: 0,
            conflictPenalty: 0,
            redundancyPenalty: 0
          },
          suggestedRole: ing.defaultRoles[0] || "main_component",
          suggestedPreparation: ing.preparations?.[0] || "raw",
          confidence: "high",
          explanationCategories: ["Foundational starting point"],
          primaryExplanation: `Foundational ${ing.categories.join("/")} ingredient: ${ing.culinaryNotes}`
        });
        continue;
      }

      // If starting from a sauce, side, or cuisine with 0 ingredients yet
      if (selected.length === 0) {
        let score = 52;
        const reasons = [];
        const cats = [];

        for (const sId of dish?.sauceIds || []) {
          const sauce = this.graph.sauces.get(sId);
          if (!sauce) continue;
          if ((sauce.challengingIngredients || []).includes(ing.id)) {
            excludedConflictCount++;
            score = -10;
            break;
          }
          if ((sauce.compatibleIngredients || []).includes(ing.id)) {
            score += 32;
            reasons.push(`Directly complements selected sauce (${sauce.name})`);
            cats.push("Sauce compatibility");
          } else if ((sauce.mainIngredients || []).includes(ing.id)) {
            score += 12;
            reasons.push(`Core constituent of ${sauce.name}`);
          } else {
            // Check pairwise affinity with sauce mainIngredients
            for (const mId of (sauce.mainIngredients || []).slice(0, 3)) {
              const pw = evaluatePairwise(this.graph, ing.id, mId, { cuisineIds: dish?.cuisineIds });
              if (pw.isSevereConflict) {
                score = -10;
                break;
              }
              if (pw.score >= 75) {
                score += 10;
                reasons.push(`Pairs with ${sauce.name} constituent (${this.graph.ingredients.get(mId)?.name || mId})`);
                break;
              }
            }
          }
        }
        if (score < 0) continue;

        for (const sideId of dish?.sideIds || []) {
          const side = this.graph.sides.get(sideId);
          if (!side) continue;
          for (const mId of (side.mainIngredients || []).slice(0, 3)) {
            const pw = evaluatePairwise(this.graph, ing.id, mId, { cuisineIds: dish?.cuisineIds });
            if (pw.score >= 75) {
              score += 10;
              reasons.push(`Complements selected side (${side.name})`);
              break;
            }
          }
        }

        for (const cId of dish?.cuisineIds || []) {
          const cuis = this.graph.cuisines.get(cId);
          if (!cuis) continue;
          if ((cuis.signatureIngredients || []).includes(ing.id)) {
            score += 24;
            reasons.push(`Signature pantry ingredient in ${cuis.name}`);
            cats.push("Shared culinary tradition");
          } else if ((ing.cuisines || []).includes(cId)) {
            score += 12;
            reasons.push(`Associated with ${cuis.name}`);
            cats.push("Shared culinary tradition");
          }
        }

        for (const m of dish?.cookingMethods || []) {
          if ((ing.preparations || []).includes(m)) {
            score += 10;
            reasons.push(`Well suited to ${m} preparation`);
          }
        }

        if (score <= 52) continue;

        evaluations.push({
          candidateId: ing.id,
          itemType: "ingredient",
          name: ing.name,
          categories: ing.categories,
          totalScore: Math.min(98, score),
          scoreBreakdown: {
            pairingSupport: score - 52,
            contextualFit: 10,
            roleUsefulness: 12,
            balanceContribution: 8,
            bridgeBenefit: 0,
            cuisineAlignment: 10,
            conflictPenalty: 0,
            redundancyPenalty: 0
          },
          suggestedRole: ing.defaultRoles[0] || "main_component",
          suggestedPreparation:
            (dish?.cookingMethods || []).find((m) => (ing.preparations || []).includes(m)) ||
            ing.preparations?.[0] ||
            "raw",
          confidence: score >= 75 ? "high" : "medium",
          explanationCategories: cats.length ? cats : ["Contextual match"],
          primaryExplanation: `${reasons.join("; ")}. ${ing.culinaryNotes}`
        });
        continue;
      }

      // Standard multi-ingredient evaluation against all selected ingredients (A + B + C...)
      const ev = evaluateCandidateAgainstDish(this.graph, ing.id, dish, structure);
      if (!ev) continue;

      // Also check compatibility with any selected sauces and sides (deduplicating constituents already in the dish)
      let sauceAndSideBonus = 0;
      let sauceClash = false;
      for (const sId of dish?.sauceIds || []) {
        const sauce = this.graph.sauces.get(sId);
        if (!sauce) continue;
        if ((sauce.challengingIngredients || []).includes(ing.id)) {
          sauceClash = true;
          break;
        }
        if ((sauce.compatibleIngredients || []).includes(ing.id)) {
          sauceAndSideBonus += 10;
          if (!ev.explanationCategories.includes("Sauce compatibility")) {
            ev.explanationCategories.push("Sauce compatibility");
          }
        } else {
          // Check non-overlapping constituent mainIngredients of the sauce
          for (const mId of (sauce.mainIngredients || []).slice(0, 3)) {
            if (selectedIds.has(mId) || mId === ing.id) continue;
            const pw = evaluatePairwise(this.graph, ing.id, mId, { cuisineIds: dish?.cuisineIds });
            if (pw.isSevereConflict) {
              sauceClash = true;
              break;
            }
            if (pw.score >= 78) {
              sauceAndSideBonus += 4;
              if (!ev.explanationCategories.includes("Sauce compatibility")) {
                ev.explanationCategories.push("Sauce compatibility");
              }
              break;
            }
          }
          if (sauceClash) break;
        }
      }

      for (const sideId of dish?.sideIds || []) {
        const side = this.graph.sides.get(sideId);
        if (!side) continue;
        for (const mId of (side.mainIngredients || []).slice(0, 2)) {
          if (selectedIds.has(mId) || mId === ing.id) continue;
          const pw = evaluatePairwise(this.graph, ing.id, mId, { cuisineIds: dish?.cuisineIds });
          if (pw.isSevereConflict) {
            sauceClash = true;
            break;
          }
          if (pw.score >= 80) {
            sauceAndSideBonus += 3;
            break;
          }
        }
        if (sauceClash) break;
      }

      // Requirement 9.1: Exclude substantially incompatible candidates from default recommendation lists
      if (ev.hasConflict || ev.hasSevereConflict || sauceClash || ev.totalScore + sauceAndSideBonus < 40) {
        excludedConflictCount++;
        continue;
      }

      const finalScore = Math.min(99, ev.totalScore + sauceAndSideBonus);
      evaluations.push({
        ...ev,
        itemType: "ingredient",
        categories: ing.categories,
        totalScore: finalScore
      });
    }

    // Deterministic sorting: highest totalScore first, then documented matches count, then alphabetical name
    evaluations.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      const bPos = b.positiveMatches?.length || 0;
      const aPos = a.positiveMatches?.length || 0;
      if (bPos !== aPos) return bPos - aPos;
      return a.name.localeCompare(b.name);
    });

    // Group top recommendations by culinary role for structured UI presentation
    const groupedByRole = {
      main_component: [],
      supporting_component: [],
      aromatic_and_seasoning: [],
      acid_and_finishing: [],
      starch_and_accompaniment: []
    };

    for (const item of evaluations) {
      const r = item.suggestedRole;
      if (r === "main_component") {
        if (groupedByRole.main_component.length < 8) groupedByRole.main_component.push(item);
      } else if (r === "aromatic" || r === "seasoning" || r === "umami_boost") {
        if (groupedByRole.aromatic_and_seasoning.length < 10)
          groupedByRole.aromatic_and_seasoning.push(item);
      } else if (
        r === "acid" ||
        r === "finishing_element" ||
        r === "garnish" ||
        r === "bridge_element"
      ) {
        if (groupedByRole.acid_and_finishing.length < 10)
          groupedByRole.acid_and_finishing.push(item);
      } else if (
        r === "starch" ||
        r === "vegetable_accompaniment" ||
        r === "texture_contrast"
      ) {
        if (groupedByRole.starch_and_accompaniment.length < 10)
          groupedByRole.starch_and_accompaniment.push(item);
      } else {
        if (groupedByRole.supporting_component.length < 10)
          groupedByRole.supporting_component.push(item);
      }
    }

    let fallbackMessage = null;
    if (evaluations.length === 0) {
      fallbackMessage =
        "No high-confidence recommendations matched the current strict filters. Try clearing the category/role filter or use the search box to explore all catalog ingredients.";
    }

    return {
      recommendations: evaluations.slice(0, limit),
      groupedByRole,
      excludedConflictCount,
      fallbackMessage
    };
  }

  /**
   * Recommends both known SauceTemplates AND custom sauce compositions synthesized from
   * the current dish's ingredients (Requirement 12.3).
   * Canonicalizes ingredient iteration order for 100% order-independence.
   *
   * @param {Object} dish
   * @param {number} [limit=8]
   * @returns {{ templates: Array<Object>, customComposition: Object|null }}
   */
  recommendSauces(dish, limit = 8) {
    const rawSelected = dish?.ingredients || [];
    const selected = [...rawSelected].sort((a, b) =>
      String(a.ingredientId || "").localeCompare(String(b.ingredientId || ""))
    );
    const selectedIds = new Set(selected.map((s) => s.ingredientId));
    const activeSauceIds = new Set(dish?.sauceIds || []);
    const cuisineIds = dish?.cuisineIds || [];

    const scoredSauces = [];

    for (const sauce of this.graph.sauces.values()) {
      if (activeSauceIds.has(sauce.id)) continue;

      let score = 45;
      const matchedIngredients = [];
      const constituentOverlap = [];
      let hasClash = false;

      for (const sel of selected) {
        const ing = this.graph.ingredients.get(sel.ingredientId);
        if (!ing) continue;

        if ((sauce.challengingIngredients || []).includes(sel.ingredientId)) {
          hasClash = true;
          break;
        }
        if ((sauce.compatibleIngredients || []).includes(sel.ingredientId)) {
          score += 22;
          matchedIngredients.push(ing.name);
        } else {
          // Check pairwise affinity between selected ingredient and sauce's primary ingredients
          let subSum = 0;
          for (const mId of (sauce.mainIngredients || []).slice(0, 3)) {
            if (mId === sel.ingredientId) continue;
            const pw = evaluatePairwise(this.graph, sel.ingredientId, mId, { cuisineIds });
            if (pw.isSevereConflict) hasClash = true;
            subSum += pw.score;
          }
          score += Math.round(subSum / 12);
        }

        if ((sauce.mainIngredients || []).includes(sel.ingredientId)) {
          constituentOverlap.push(ing.name);
          score += 8; // Dish already contains a building block of this sauce!
        }
      }

      if (hasClash) continue;

      if (cuisineIds.length > 0 && (sauce.cuisines || []).some((c) => cuisineIds.includes(c))) {
        score += 15;
      }

      const finalScore = Math.max(10, Math.min(99, score));
      const missingConstituents = (sauce.mainIngredients || [])
        .filter((id) => !selectedIds.has(id))
        .map((id) => this.graph.ingredients.get(id)?.name || id);

      let rationale = sauce.preparationNotes;
      if (matchedIngredients.length > 0) {
        rationale = `Pairs directly with ${matchedIngredients.join(", ")}. ${sauce.preparationNotes}`;
      }
      if (constituentOverlap.length > 0) {
        rationale += ` (Builds on ${constituentOverlap.join(", ")} already in your dish.)`;
      }

      scoredSauces.push({
        sauce,
        id: sauce.id,
        name: sauce.name,
        category: sauce.category,
        score: finalScore,
        matchedIngredients,
        constituentOverlap,
        missingConstituents,
        technique: sauce.technique,
        rationale
      });
    }

    scoredSauces.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // Synthesize a dynamic pan/emulsion sauce composition from the dish's current context
    const customComposition = synthesizeDynamicSauceComposition(this.graph, dish);

    return {
      templates: scoredSauces.slice(0, limit),
      customComposition
    };
  }

  /**
   * Recommends composed SideTemplates (distinct from single raw ingredients, Requirement 12.4).
   * Evaluates across ALL selected dish ingredients in canonical order.
   *
   * @param {Object} dish
   * @param {number} [limit=6]
   * @returns {Array<Object>}
   */
  recommendSides(dish, limit = 6) {
    const rawSelected = dish?.ingredients || [];
    const selected = [...rawSelected].sort((a, b) =>
      String(a.ingredientId || "").localeCompare(String(b.ingredientId || ""))
    );
    const activeSideIds = new Set(dish?.sideIds || []);
    const cuisineIds = dish?.cuisineIds || [];
    const structure = analyzeDishStructure(this.graph, dish);
    const mainIng = resolvePrimaryDishIngredient(this.graph, selected);

    const scoredSides = [];

    for (const side of this.graph.sides.values()) {
      if (activeSideIds.has(side.id)) continue;

      let score = 48;
      const reasons = [];

      // Check cuisine alignment
      if (cuisineIds.length > 0 && (side.cuisines || []).some((c) => cuisineIds.includes(c))) {
        score += 18;
        reasons.push("Matches selected culinary tradition");
      } else if (mainIng) {
        if ((side.cuisines || []).some((c) => (mainIng.cuisines || []).includes(c))) {
          score += 12;
        }
      }

      // Check structural balance complementarity
      const sfp = side.flavorProfile || {};
      if (structure.diagnostics.needsAcid && sfp.acidity >= 3) {
        score += 20;
        reasons.push("High-acid accompaniment that cuts the main dish's richness");
      }
      if (structure.maxHeat >= 3 && (sfp.fatRichness >= 3 || sfp.sweetness >= 3)) {
        score += 16;
        reasons.push("Cooling/soothing side that balances spicy heat in the main dish");
      }
      if (!structure.roleCounts["starch"] && side.category === "starch_preparation") {
        score += 14;
        reasons.push("Provides a composed starch foundation to absorb dish juices");
      }
      if (!structure.roleCounts["vegetable_accompaniment"] && side.category === "composed_vegetable") {
        score += 12;
        reasons.push("Adds a composed vegetable accompaniment");
      }

      // Check pairwise compatibility across ALL selected dish ingredients
      let hasClash = false;
      let pairBonus = 0;
      for (const sel of selected) {
        for (const mId of (side.mainIngredients || []).slice(0, 2)) {
          if (sel.ingredientId === mId) continue;
          const pw = evaluatePairwise(this.graph, sel.ingredientId, mId, { cuisineIds });
          if (pw.isSevereConflict) hasClash = true;
          else if (pw.score >= 70) pairBonus += 5;
        }
      }
      if (hasClash) continue;
      score += Math.min(18, pairBonus);

      scoredSides.push({
        side,
        id: side.id,
        name: side.name,
        category: side.category,
        score: Math.min(98, score),
        constituentNames: (side.mainIngredients || []).map(
          (id) => this.graph.ingredients.get(id)?.name || id
        ),
        rationale:
          reasons.length > 0
            ? `${reasons.join("; ")}. ${side.culinaryRationale}`
            : side.culinaryRationale
      });
    }

    scoredSides.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return scoredSides.slice(0, limit);
  }

  /**
   * Evaluates the complete current dish and returns structure, warnings, bridges,
   * ingredient recommendations, sauce recommendations, and side recommendations.
   *
   * @param {Object} dish
   * @param {Object} [options]
   * @returns {Object} Complete dish evaluation state
   */
  evaluateDish(dish, options = {}) {
    const structure = analyzeDishStructure(this.graph, dish);
    const warnings = evaluateDishWarnings(this.graph, dish, structure);
    const bridges = findBridgeSuggestions(this.graph, dish, { limit: 6 });
    const ingredientRecs = this.recommendIngredients(dish, options);
    const sauceRecs = this.recommendSauces(dish, 6);
    const sideRecs = this.recommendSides(dish, 6);

    return {
      structure,
      warnings,
      bridges,
      ingredientRecs,
      sauceRecs,
      sideRecs
    };
  }
}

/**
 * Synthesizes a custom sauce formula from the active dish's ingredients and top compatible partners.
 * Uses canonical ingredient ordering and role-aware focal ingredient selection.
 */
function synthesizeDynamicSauceComposition(graph, dish) {
  const rawSelected = dish?.ingredients || [];
  if (rawSelected.length === 0) return null;

  const selected = [...rawSelected].sort((a, b) =>
    String(a.ingredientId || "").localeCompare(String(b.ingredientId || ""))
  );

  const byRole = {
    fat: null,
    acid: null,
    aromatic: null,
    umami: null,
    herb: null
  };

  for (const sel of selected) {
    const ing = graph.ingredients.get(sel.ingredientId);
    if (!ing) continue;
    if (!byRole.fat && ing.categories.includes("oils_and_fats")) byRole.fat = ing;
    if (!byRole.acid && ing.categories.includes("acids")) byRole.acid = ing;
    if (!byRole.aromatic && ing.categories.includes("aromatics")) byRole.aromatic = ing;
    if (!byRole.umami && (ing.defaultRoles.includes("umami_boost") || ing.categories.includes("fermented")))
      byRole.umami = ing;
    if (!byRole.herb && ing.categories.includes("herbs")) byRole.herb = ing;
  }

  const mainIng = resolvePrimaryDishIngredient(graph, selected);
  const cuis = dish?.cuisineIds?.[0] || mainIng?.cuisines?.[0] || "cuisine_french";

  // Fill any missing sauce structural slots using cuisine-coherent defaults
  const defaultMap = {
    cuisine_french: {
      fat: "ing_butter_unsalted",
      acid: "ing_wine_dry_white",
      aromatic: "ing_shallot",
      umami: "ing_stock_chicken_beef",
      herb: "ing_thyme_fresh"
    },
    cuisine_italian: {
      fat: "ing_olive_oil_evoo",
      acid: "ing_lemon_fresh",
      aromatic: "ing_garlic",
      umami: "ing_caper",
      herb: "ing_parsley_flat"
    },
    cuisine_japanese: {
      fat: "ing_sesame_oil_toasted",
      acid: "ing_vinegar_rice",
      aromatic: "ing_ginger_fresh",
      umami: "ing_soy_sauce_shoyu",
      herb: "ing_scallion"
    },
    cuisine_mexican: {
      fat: "ing_avocado",
      acid: "ing_lime_fresh",
      aromatic: "ing_onion_red",
      umami: "ing_tomatillo",
      herb: "ing_cilantro_fresh"
    },
    cuisine_thai: {
      fat: "ing_coconut_milk",
      acid: "ing_lime_fresh",
      aromatic: "ing_lemongrass",
      umami: "ing_fish_sauce",
      herb: "ing_basil_thai"
    }
  };

  const fallback = defaultMap[cuis] || defaultMap.cuisine_french;
  const fatIng = byRole.fat || graph.ingredients.get(fallback.fat);
  const acidIng = byRole.acid || graph.ingredients.get(fallback.acid);
  const aromIng = byRole.aromatic || graph.ingredients.get(fallback.aromatic);
  const umamiIng = byRole.umami || graph.ingredients.get(fallback.umami);
  const herbIng = byRole.herb || graph.ingredients.get(fallback.herb);

  const suggestedAdditions = [fatIng, acidIng, aromIng, umamiIng, herbIng]
    .filter((x) => x && !selected.some((s) => s.ingredientId === x.id))
    .map((x) => ({ id: x.id, name: x.name }));

  return {
    title: `Custom Pan Emulsion for ${mainIng?.name || "Current Dish"}`,
    components: {
      fat: fatIng?.name || "Butter / Olive Oil",
      acid: acidIng?.name || "Lemon / Wine Vinegar",
      aromatic: aromIng?.name || "Shallot / Garlic",
      savoryBase: umamiIng?.name || "Stock / Fermented Umami",
      finish: herbIng?.name || "Fresh Herbs"
    },
    suggestedAdditions,
    explanation: `Sweat ${aromIng?.name}, deglaze with ${acidIng?.name} and ${umamiIng?.name}, emulsify with ${fatIng?.name}, and finish with ${herbIng?.name}.`
  };
}
