/**
 * @fileoverview Dynamic ingredient search and context-aware autocomplete engine.
 * Supports:
 * - Exact canonical name & alias matching
 * - Prefix & token-prefix matching
 * - Case-insensitive, punctuation-normalized, Unicode/diacritic-normalized matching
 * - Bounded Levenshtein typo tolerance (kept strictly subordinate to exact/prefix matches)
 * - Context-aware status annotation against the current dish:
 *   1. "recommended" (positively supported by current selections)
 *   2. "available_neutral" (compatible/available without strong positive or negative signal)
 *   3. "pairing_concern" (documented or inferred compatibility challenge — still returned in search with warning explanation so the user can explicitly override!)
 *   4. "already_selected" (already in the active dish)
 */

import { normalizeText } from "../data/knowledgeGraph.js";
import { analyzeDishStructure, evaluateCandidateAgainstDish } from "./compatibility.js";

/**
 * Computes bounded Damerau-Levenshtein edit distance between two normalized strings.
 * @param {string} a
 * @param {string} b
 * @param {number} [maxDist=2]
 * @returns {number} Distance, or maxDist + 1 if exceeded
 */
export function boundedLevenshtein(a, b, maxDist = 2) {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;

  const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[lenA][lenB];
}

/**
 * Computes lexical match score for an indexed ingredient entry against a normalized query.
 * Exact matches and prefix matches always outrank fuzzy matches.
 * @param {Object} entry - Search index entry from CulinaryKnowledgeGraph
 * @param {string} qNorm - Normalized query string
 * @param {string[]} qTokens - Query tokens
 * @returns {{ matchType: string, lexicalScore: number } | null}
 */
function scoreLexicalMatch(entry, qNorm, qTokens) {
  if (!qNorm) {
    return { matchType: "browse", lexicalScore: 50 };
  }

  // 1. Exact canonical name match
  if (entry.nameNorm === qNorm) {
    return { matchType: "exact_name", lexicalScore: 1000 };
  }

  // 2. Exact alias match
  if (entry.aliasesNorm.includes(qNorm)) {
    return { matchType: "exact_alias", lexicalScore: 950 };
  }

  // 3. Canonical name starts with query
  if (entry.nameNorm.startsWith(qNorm)) {
    return { matchType: "prefix_name", lexicalScore: 880 - Math.min(40, entry.nameNorm.length - qNorm.length) };
  }

  // 4. Any alias starts with query
  for (const al of entry.aliasesNorm) {
    if (al.startsWith(qNorm)) {
      return { matchType: "prefix_alias", lexicalScore: 830 - Math.min(40, al.length - qNorm.length) };
    }
  }

  // 5. All query tokens match token prefixes in name or aliases
  const allTokensPrefixMatch = qTokens.every((qt) =>
    entry.tokens.some((t) => t.startsWith(qt))
  );
  if (allTokensPrefixMatch) {
    const exactTokenCount = qTokens.filter((qt) => entry.tokens.includes(qt)).length;
    return {
      matchType: "token_prefix",
      lexicalScore: 740 + exactTokenCount * 25
    };
  }

  // 6. Substring match inside canonical name or alias (for queries >= 3 chars)
  if (qNorm.length >= 3) {
    if (entry.nameNorm.includes(qNorm)) {
      return { matchType: "substring_name", lexicalScore: 620 };
    }
    if (entry.aliasesNorm.some((al) => al.includes(qNorm))) {
      return { matchType: "substring_alias", lexicalScore: 580 };
    }
  }

  // 7. Bounded typo-tolerant fuzzy match (only for queries >= 4 chars so short prefixes aren't polluted)
  if (qNorm.length >= 4) {
    const maxDist = qNorm.length >= 7 ? 2 : 1;
    let bestDist = maxDist + 1;
    for (const tok of entry.tokens) {
      if (tok.length < 3) continue;
      const d = boundedLevenshtein(qNorm, tok, maxDist);
      if (d < bestDist) bestDist = d;
      // Also check prefix of longer token
      if (tok.length > qNorm.length) {
        const dPref = boundedLevenshtein(qNorm, tok.slice(0, qNorm.length), 1);
        if (dPref < bestDist) bestDist = dPref;
      }
    }
    if (bestDist <= maxDist) {
      return {
        matchType: "fuzzy",
        lexicalScore: 320 - bestDist * 80
      };
    }
  }

  return null;
}

/**
 * Searches the ingredient catalog and annotates every matching ingredient with
 * its real-time compatibility status against the current working dish.
 *
 * Crucial requirement (Section 8.2 & 9.2):
 * Even if an ingredient is normally excluded from default proactive recommendations
 * due to a challenging or incompatible relationship with current selections,
 * explicit search MUST still return it, explain the concern, identify the conflicting
 * selection(s), and allow the user to select/override it.
 *
 * @param {import("../data/knowledgeGraph.js").CulinaryKnowledgeGraph} graph
 * @param {string} query
 * @param {Object} [dishContext] - Current working dish
 * @param {Object} [options]
 * @param {string} [options.categoryFilter]
 * @param {number} [options.limit=25]
 * @returns {Array<Object>}
 */
export function searchIngredientsWithContext(graph, query, dishContext = null, options = {}) {
  const { categoryFilter = "", limit = 25 } = options;
  const qNorm = normalizeText(query || "");
  const qTokens = qNorm.split(" ").filter(Boolean);

  const selectedIds = new Set(
    (dishContext?.ingredients || []).map((item) => item.ingredientId)
  );
  const precomputedStructure = dishContext && dishContext.ingredients?.length > 0 ? analyzeDishStructure(graph, dishContext) : null;

  const candidates = [];

  for (const entry of graph.searchIndex) {
    if (categoryFilter && !entry.categories.includes(categoryFilter)) {
      continue;
    }

    const lex = scoreLexicalMatch(entry, qNorm, qTokens);
    if (!lex) continue;

    const ing = graph.ingredients.get(entry.id);
    if (!ing) continue;

    let contextStatus = "available_neutral";
    let compatibilityScore = 50;
    let warningSummary = null;
    let conflictingIngredients = [];
    let supportingIngredients = [];
    let primaryReason = ing.culinaryNotes;

    if (selectedIds.has(ing.id)) {
      contextStatus = "already_selected";
      primaryReason = "Already selected in the current dish.";
    } else if (dishContext && Array.isArray(dishContext.ingredients) && dishContext.ingredients.length > 0) {
      const evalResult = evaluateCandidateAgainstDish(graph, ing.id, dishContext, precomputedStructure);
      compatibilityScore = evalResult.totalScore;
      conflictingIngredients = evalResult.conflicts.map((c) => c.withIngredientId);
      supportingIngredients = evalResult.positiveMatches.map((m) => m.withIngredientId);

      if (evalResult.hasSevereConflict || evalResult.totalScore < 32) {
        contextStatus = "pairing_concern";
        warningSummary = evalResult.warningExplanation;
        primaryReason = evalResult.warningExplanation || evalResult.primaryExplanation;
      } else if (evalResult.totalScore >= 66 || evalResult.positiveMatches.length > 0) {
        contextStatus = "recommended";
        primaryReason = evalResult.primaryExplanation;
      } else {
        contextStatus = "available_neutral";
        primaryReason = evalResult.primaryExplanation;
      }
    }

    // Combined ordering score:
    // Exact and strong lexical matches ALWAYS stay at the top so searching for a specific
    // excluded ingredient (like "Blue Cheese") immediately surfaces it. Within the same
    // lexical tier, recommended ingredients rank above neutral and challenging ones.
    const contextBonus =
      contextStatus === "recommended"
        ? 35
        : contextStatus === "available_neutral"
        ? 10
        : contextStatus === "pairing_concern"
        ? -15
        : -25;

    const combinedRankScore = lex.lexicalScore + contextBonus + (compatibilityScore - 50) * 0.25;

    candidates.push({
      ingredient: ing,
      id: ing.id,
      name: ing.name,
      categories: ing.categories,
      defaultRoles: ing.defaultRoles,
      matchType: lex.matchType,
      lexicalScore: lex.lexicalScore,
      compatibilityScore,
      combinedRankScore,
      contextStatus,
      warningSummary,
      conflictingIngredients,
      supportingIngredients,
      primaryReason
    });
  }

  candidates.sort((a, b) => {
    if (b.combinedRankScore !== a.combinedRankScore) {
      return b.combinedRankScore - a.combinedRankScore;
    }
    return a.name.localeCompare(b.name);
  });

  return candidates.slice(0, limit);
}
