/**
 * @fileoverview Bridging Ingredients & Rescue Recommendation Engine (Requirement 10).
 *
 * When a user intentionally selects an unusual or challenging combination (or when the dish
 * exhibits a structural imbalance), this module:
 * 1. Identifies active pairwise tensions and structural imbalances in the dish.
 * 2. Generates candidate bridge ingredients, preparation changes, role adjustments, or unifying sauces.
 * 3. Evaluates every candidate bridge against ALL selected ingredients in the dish (never fixing
 *    one conflict by introducing a worse conflict elsewhere without disclosing the tradeoff).
 * 4. Ranks candidates deterministically and order-independently by a composite of conflict mitigation,
 *    overall set-wide compatibility, and culinary evidence support.
 */

import {
  analyzeDishStructure,
  evaluatePairwise,
  evaluateCandidateAgainstDish,
  evaluateDishWarnings
} from "./compatibility.js";

/**
 * Generates ranked bridge and rescue suggestions for the current dish.
 *
 * @param {import("../data/knowledgeGraph.js").CulinaryKnowledgeGraph} graph
 * @param {Object} dish
 * @param {Object} [options]
 * @param {number} [options.limit=8]
 * @returns {Array<Object>} Ranked BridgeSuggestion items
 */
export function findBridgeSuggestions(graph, dish, options = {}) {
  const { limit = 8 } = options;
  const rawSelected = dish?.ingredients || [];
  if (rawSelected.length < 2) return [];

  const selected = [...rawSelected].sort((a, b) =>
    String(a.ingredientId || "").localeCompare(String(b.ingredientId || ""))
  );
  const structure = analyzeDishStructure(graph, dish);
  const warnings = evaluateDishWarnings(graph, dish, structure);
  const pairWarnings = warnings.filter(
    (w) => w.severity === "challenging" || w.severity === "conditional"
  );
  const structWarnings = warnings.filter((w) => w.severity === "structural_imbalance");

  const bridgeCandidatesMap = new Map();

  // Helper to register a candidate ingredient as a potential bridge
  const addIngredientBridgeCandidate = (ingId, targetConflictId, mechanism, supportLevel, baseMitigation) => {
    if (!ingId || structure.activeIngredientIds.has(ingId) || !graph.ingredients.has(ingId)) {
      return;
    }
    const existing = bridgeCandidatesMap.get(ingId);
    if (existing) {
      existing.conflictMitigationScore = Math.min(100, existing.conflictMitigationScore + 15);
      if (!existing.mechanisms.includes(mechanism)) {
        existing.mechanisms.push(mechanism);
      }
      return;
    }
    bridgeCandidatesMap.set(ingId, {
      candidateIngredientId: ingId,
      targetConflictId,
      mechanisms: [mechanism],
      supportLevel,
      conflictMitigationScore: baseMitigation
    });
  };

  // 1. Collect explicit balancing ingredients from pairwise conflicts
  for (const w of pairWarnings) {
    const [idA, idB] = w.involvedIngredients;
    const ingA = graph.ingredients.get(idA);
    const ingB = graph.ingredients.get(idB);
    const pairLabel = ingA && ingB ? `${ingA.name} + ${ingB.name}` : w.title;

    for (const bId of w.suggestedBridges || []) {
      const bIng = graph.ingredients.get(bId);
      if (!bIng) continue;
      addIngredientBridgeCandidate(
        bId,
        w.id,
        `Explicitly documented culinary bridge for ${pairLabel}: ${determineMechanismDescription(bIng, ingA, ingB)}`,
        "established",
        88
      );
    }

    // Also search graph neighbors that pair strongly with BOTH idA and idB (shared adjacency bridge)
    if (idA && idB) {
      const neighborsA = graph.adjacency.get(idA) || [];
      for (const edgeA of neighborsA) {
        if (edgeA.relationship.affinityScore < 65) continue;
        const candId = edgeA.partnerId;
        if (structure.activeIngredientIds.has(candId)) continue;
        const pwB = evaluatePairwise(graph, candId, idB, { cuisineIds: dish?.cuisineIds });
        if (pwB.score >= 60 && !pwB.isConflict) {
          addIngredientBridgeCandidate(
            candId,
            w.id,
            `Shared aromatic/flavor connector that pairs strongly with both ${ingA?.name} and ${ingB?.name}`,
            pwB.isDocumented ? "established" : "contextually_supported",
            78
          );
        }
      }
    }
  }

  // 2. Collect structural balance bridges (acid for richness, fat/sweet for bitterness, cooling for heat)
  for (const sw of structWarnings) {
    for (const bId of sw.suggestedBridges || []) {
      const bIng = graph.ingredients.get(bId);
      if (!bIng) continue;
      addIngredientBridgeCandidate(
        bId,
        sw.id,
        `Resolves '${sw.title}' by supplying ${bIng.defaultRoles.slice(0, 2).join("/")}`,
        "contextually_supported",
        74
      );
    }
  }

  // 3. Even if there are no overt conflicts, if any pair of selected ingredients has weak/unconnected affinity,
  // find shared graph connectors that tie them together (evaluated across all canonical pairs)
  if (pairWarnings.length === 0 && structWarnings.length === 0 && selected.length >= 2) {
    for (const ap of structure.activePairs || []) {
      if (ap.pw.score < 45) {
        const ingA = graph.ingredients.get(ap.idA);
        const ingB = graph.ingredients.get(ap.idB);
        for (const edgeA of graph.adjacency.get(ap.idA) || []) {
          if (edgeA.relationship.affinityScore < 70) continue;
          const candId = edgeA.partnerId;
          if (structure.activeIngredientIds.has(candId)) continue;
          const pwB = evaluatePairwise(graph, candId, ap.idB, { cuisineIds: dish?.cuisineIds });
          if (pwB.score >= 65) {
            addIngredientBridgeCandidate(
              candId,
              `connect_${ap.idA}_${ap.idB}`,
              `Connects ${ingA?.name} and ${ingB?.name} via shared culinary affinity`,
              "established",
              72
            );
          }
        }
      }
    }
  }

  // 4. Evaluate every candidate ingredient bridge against ALL selected ingredients in the dish
  const results = [];
  const connectedIdsCanonical = selected.map((s) => s.ingredientId);

  for (const [candId, meta] of bridgeCandidatesMap.entries()) {
    const evalAll = evaluateCandidateAgainstDish(graph, candId, dish, structure);
    if (!evalAll) continue;

    // Do not recommend a bridge that introduces a severe conflict with another selected ingredient
    if (evalAll.hasSevereConflict) continue;

    let tradeoffNote = null;
    if (evalAll.conflicts.length > 0) {
      tradeoffNote = `Mitigates the primary tension, though it has a mild secondary tension with ${evalAll.conflicts
        .map((c) => c.withIngredientName)
        .join(", ")}.`;
    }

    const compositeRank =
      meta.conflictMitigationScore * 0.55 +
      evalAll.totalScore * 0.45 -
      evalAll.conflicts.length * 18;

    results.push({
      id: `bridge_ing_${candId}`,
      type: "ingredient",
      candidateIngredientId: candId,
      candidateName: evalAll.name,
      suggestedRole: evalAll.suggestedRole,
      suggestedPreparation: evalAll.suggestedPreparation,
      targetConflictId: meta.targetConflictId,
      connectedIngredients: connectedIdsCanonical,
      mechanism: meta.mechanisms[0],
      overallCompatibilityScore: evalAll.totalScore,
      conflictMitigationScore: meta.conflictMitigationScore,
      compositeRank: Math.round(compositeRank),
      supportLevel: meta.supportLevel,
      rationale: `${meta.mechanisms.join("; ")}. Evaluated across all ${
        selected.length
      } active ingredients (${evalAll.primaryExplanation})`,
      tradeoffNote
    });
  }

  // 5. Check preparation-state adjustments that reduce active conflicts without adding new ingredients
  for (const sel of selected) {
    const ing = graph.ingredients.get(sel.ingredientId);
    if (!ing) continue;
    if (
      sel.preparation === "raw" &&
      (ing.preparations || []).includes("roasted") &&
      (sel.ingredientId === "ing_garlic" ||
        sel.ingredientId.includes("onion") ||
        ing.categories.includes("vegetables"))
    ) {
      const involvedInWarning = pairWarnings.some((w) =>
        w.involvedIngredients.includes(sel.ingredientId)
      );
      if (involvedInWarning) {
        results.push({
          id: `bridge_prep_${sel.ingredientId}_roasted`,
          type: "preparation_change",
          candidateIngredientId: sel.ingredientId,
          candidateName: `Change ${ing.name} preparation from Raw to Roasted`,
          suggestedPreparation: "roasted",
          targetConflictId: pairWarnings[0].id,
          connectedIngredients: connectedIdsCanonical,
          mechanism: "Thermal caramelization & sharpness reduction",
          overallCompatibilityScore: 82,
          conflictMitigationScore: 76,
          compositeRank: 79,
          supportLevel: "established",
          rationale: `Roasting ${ing.name} converts pungent raw volatiles into sweet, nutty Maillard compounds that coexist far more smoothly with the rest of the dish.`,
          tradeoffNote: null
        });
      }
    }
  }

  // 6. Check if a unifying Sauce Template bridges the selected ingredients
  if ((dish?.sauceIds || []).length === 0 && (pairWarnings.length > 0 || selected.length >= 2)) {
    for (const sauce of graph.sauces.values()) {
      const compatHits = selected.filter((s) =>
        (sauce.compatibleIngredients || []).includes(s.ingredientId)
      );
      const clashHits = selected.filter((s) =>
        (sauce.challengingIngredients || []).includes(s.ingredientId)
      );
      if (compatHits.length >= 2 && clashHits.length === 0) {
        results.push({
          id: `bridge_sauce_${sauce.id}`,
          type: "sauce_unifier",
          candidateSauceId: sauce.id,
          candidateName: `Unify with ${sauce.name}`,
          targetConflictId: pairWarnings[0]?.id || "dish_unifier",
          connectedIngredients: compatHits.map((c) => c.ingredientId),
          mechanism: "Unifying emulsified/reduced sauce structure",
          overallCompatibilityScore: 85,
          conflictMitigationScore: 80,
          compositeRank: 82,
          supportLevel: "established",
          rationale: `${sauce.name} explicitly pairs with ${compatHits
            .map((c) => graph.ingredients.get(c.ingredientId)?.name)
            .join(" and ")}, providing a cohesive flavor vehicle. ${sauce.preparationNotes}`,
          tradeoffNote: null
        });
      }
    }
  }

  results.sort((a, b) => b.compositeRank - a.compositeRank || a.id.localeCompare(b.id));
  return results.slice(0, limit);
}

/**
 * Generates a concise culinary mechanism phrase explaining how `bridgeIng` helps `ingA` and `ingB`.
 */
function determineMechanismDescription(bridgeIng, ingA, ingB) {
  const fp = bridgeIng.flavorProfile || {};
  if (fp.acidity >= 3) {
    return `${bridgeIng.name} introduces bright acidity to cut lipid heaviness and refresh the palate`;
  }
  if (fp.fatRichness >= 3 && fp.sweetness >= 2) {
    return `${bridgeIng.name} supplies creamy fat and subtle sweetness to round harsh or bitter edges`;
  }
  if (fp.sweetness >= 3) {
    return `${bridgeIng.name} adds sweetness that suppresses bitterness and balances high acidity or heat`;
  }
  if (fp.umami >= 3) {
    return `${bridgeIng.name} provides savory glutamate depth that anchors both components`;
  }
  if (fp.herbalCharacter >= 3 || fp.floralCharacter >= 3) {
    return `${bridgeIng.name} connects ${ingA?.name || "the pair"} and ${
      ingB?.name || "its partner"
    } through shared aromatic volatiles`;
  }
  return `${bridgeIng.name} acts as a structural and flavor buffer between ${
    ingA?.name || "the ingredients"
  } and ${ingB?.name || "the dish"}`;
}
