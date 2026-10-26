/**
 * @fileoverview Validates the static culinary knowledge base (sources, cuisines,
 * ingredients, sauces, sides, and pairings) for schema compliance and referential
 * integrity, and builds the fast in-memory `CulinaryKnowledgeGraph` used by
 * the recommendation and menu engines.
 */

import {
  INGREDIENT_CATEGORIES,
  CULINARY_ROLES,
  PREPARATION_STATES,
  RELATIONSHIP_TYPES,
  PROVENANCE_TIERS
} from "../core/types.js";

/**
 * Normalizes a string for case-insensitive, diacritic-insensitive, and punctuation-tolerant matching.
 * @param {string} str
 * @returns {string}
 */
export function normalizeText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`\-_/(),.:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates a deterministic canonical pair key from two ingredient IDs.
 * @param {string} idA
 * @param {string} idB
 * @returns {string}
 */
export function makePairKey(idA, idB) {
  return idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`;
}

/**
 * Validates all dataset collections and returns detailed validation findings.
 * Enforces referential integrity, flavor profile uniqueness, preparation delta key validity,
 * and pairing coverage across the ingredient catalog.
 *
 * @param {Object} dataset
 * @param {Array} dataset.sources
 * @param {Array} dataset.cuisines
 * @param {Array} dataset.ingredients
 * @param {Array} dataset.sauces
 * @param {Array} dataset.sides
 * @param {Array} dataset.pairings
 * @returns {{ valid: boolean, errors: string[], warnings: string[], stats: Object }}
 */
export function validateCulinaryDataset(dataset) {
  const errors = [];
  const warnings = [];

  if (!dataset || typeof dataset !== "object") {
    return { valid: false, errors: ["Dataset root must be an object."], warnings: [], stats: {} };
  }

  const { sources = [], cuisines = [], ingredients = [], sauces = [], sides = [], pairings = [] } = dataset;

  const sourceIds = new Set();
  for (const src of sources) {
    if (!src.id || typeof src.id !== "string") {
      errors.push("Source entry missing valid string id.");
    } else if (sourceIds.has(src.id)) {
      errors.push(`Duplicate source id: ${src.id}`);
    } else {
      sourceIds.add(src.id);
    }
    if (!src.license || !src.publisher) {
      errors.push(`Source ${src.id} missing license or publisher.`);
    }
    if (!PROVENANCE_TIERS.includes(src.tier)) {
      errors.push(`Source ${src.id} has invalid provenance tier: ${src.tier}`);
    }
  }

  const cuisineIds = new Set();
  for (const cuis of cuisines) {
    if (!cuis.id) {
      errors.push("Cuisine entry missing id.");
    } else if (cuisineIds.has(cuis.id)) {
      errors.push(`Duplicate cuisine id: ${cuis.id}`);
    } else {
      cuisineIds.add(cuis.id);
    }
  }

  const ingredientIds = new Set();
  const validCategories = new Set(INGREDIENT_CATEGORIES);
  const validRoles = new Set(CULINARY_ROLES);
  const flavorProfileSignatures = new Map();

  for (const ing of ingredients) {
    if (!ing.id || !ing.name) {
      errors.push(`Ingredient missing id or name: ${JSON.stringify(ing)}`);
      continue;
    }
    if (ingredientIds.has(ing.id)) {
      errors.push(`Duplicate ingredient id: ${ing.id}`);
    }
    ingredientIds.add(ing.id);

    if (!Array.isArray(ing.categories) || ing.categories.length === 0) {
      errors.push(`Ingredient ${ing.id} must have at least one category.`);
    } else {
      for (const c of ing.categories) {
        if (!validCategories.has(c) && c !== "starch") {
          errors.push(`Ingredient ${ing.id} has unknown category '${c}'.`);
        }
      }
    }

    if (!Array.isArray(ing.defaultRoles) || ing.defaultRoles.length === 0) {
      errors.push(`Ingredient ${ing.id} must have at least one defaultRole.`);
    } else {
      for (const r of ing.defaultRoles) {
        if (!validRoles.has(r)) {
          errors.push(`Ingredient ${ing.id} has unknown role '${r}'.`);
        }
      }
    }

    if (!ing.flavorProfile || typeof ing.flavorProfile.umami !== "number") {
      errors.push(`Ingredient ${ing.id} missing valid flavorProfile.`);
    } else {
      const fpSig = JSON.stringify(ing.flavorProfile);
      const list = flavorProfileSignatures.get(fpSig) || [];
      list.push(ing.id);
      flavorProfileSignatures.set(fpSig, list);

      if (Array.isArray(ing.preparationModifiers)) {
        for (const pm of ing.preparationModifiers) {
          for (const deltaKey of Object.keys(pm.flavorDelta || {})) {
            if (typeof ing.flavorProfile[deltaKey] !== "number") {
              errors.push(
                `Ingredient ${ing.id} preparationModifier '${pm.state}' has unrecognized flavorDelta key '${deltaKey}'.`
              );
            }
          }
        }
      }
    }

    if (!sourceIds.has(ing.provenanceId)) {
      errors.push(`Ingredient ${ing.id} references unknown provenanceId '${ing.provenanceId}'.`);
    }

    for (const cId of ing.cuisines || []) {
      if (!cuisineIds.has(cId)) {
        errors.push(`Ingredient ${ing.id} references unknown cuisine '${cId}'.`);
      }
    }
  }

  for (const [, ids] of flavorProfileSignatures.entries()) {
    if (ids.length > 2) {
      errors.push(
        `Copy-pasted flavorProfile detected across ${ids.length} ingredients: ${ids.slice(0, 5).join(", ")}`
      );
    }
  }

  // Second pass on ingredients for parentIngredientId
  for (const ing of ingredients) {
    if (ing.parentIngredientId && !ingredientIds.has(ing.parentIngredientId)) {
      errors.push(`Ingredient ${ing.id} references unknown parentIngredientId '${ing.parentIngredientId}'.`);
    }
  }

  // Validate sauces
  const sauceIds = new Set();
  for (const sauce of sauces) {
    if (!sauce.id || !sauce.name) {
      errors.push("Sauce missing id or name.");
      continue;
    }
    if (sauceIds.has(sauce.id)) {
      errors.push(`Duplicate sauce id: ${sauce.id}`);
    }
    sauceIds.add(sauce.id);

    for (const mId of sauce.mainIngredients || []) {
      if (!ingredientIds.has(mId)) {
        errors.push(`Sauce ${sauce.id} mainIngredients references unknown ingredient '${mId}'.`);
      }
    }
    for (const cId of sauce.compatibleIngredients || []) {
      if (!ingredientIds.has(cId)) {
        errors.push(`Sauce ${sauce.id} compatibleIngredients references unknown ingredient '${cId}'.`);
      }
    }
    for (const chId of sauce.challengingIngredients || []) {
      if (!ingredientIds.has(chId)) {
        errors.push(`Sauce ${sauce.id} challengingIngredients references unknown ingredient '${chId}'.`);
      }
    }
    if (!sourceIds.has(sauce.provenanceId)) {
      errors.push(`Sauce ${sauce.id} references unknown provenanceId '${sauce.provenanceId}'.`);
    }
  }

  // Validate sides
  const sideIds = new Set();
  for (const side of sides) {
    if (!side.id || !side.name) {
      errors.push("Side missing id or name.");
      continue;
    }
    if (sideIds.has(side.id)) {
      errors.push(`Duplicate side id: ${side.id}`);
    }
    sideIds.add(side.id);

    for (const mId of side.mainIngredients || []) {
      if (!ingredientIds.has(mId)) {
        errors.push(`Side ${side.id} mainIngredients references unknown ingredient '${mId}'.`);
      }
    }
    if (!sourceIds.has(side.provenanceId)) {
      errors.push(`Side ${side.id} references unknown provenanceId '${side.provenanceId}'.`);
    }
  }

  // Validate cuisine signature references
  for (const cuis of cuisines) {
    for (const sigIng of cuis.signatureIngredients || []) {
      if (!ingredientIds.has(sigIng)) {
        errors.push(`Cuisine ${cuis.id} references unknown signatureIngredient '${sigIng}'.`);
      }
    }
  }

  // Validate pairings
  const validRelTypes = new Set(RELATIONSHIP_TYPES);
  const pairKeys = new Set();
  const pairingCountsByIng = new Map(Array.from(ingredientIds).map((id) => [id, 0]));

  for (const p of pairings) {
    if (!p.id) {
      errors.push("Pairing missing id.");
    }
    if (!ingredientIds.has(p.ingredientA)) {
      errors.push(`Pairing ${p.id} references unknown ingredientA '${p.ingredientA}'.`);
    } else {
      pairingCountsByIng.set(p.ingredientA, (pairingCountsByIng.get(p.ingredientA) || 0) + 1);
    }
    if (!ingredientIds.has(p.ingredientB)) {
      errors.push(`Pairing ${p.id} references unknown ingredientB '${p.ingredientB}'.`);
    } else {
      pairingCountsByIng.set(p.ingredientB, (pairingCountsByIng.get(p.ingredientB) || 0) + 1);
    }
    if (p.ingredientA === p.ingredientB) {
      errors.push(`Pairing ${p.id} is self-referential (${p.ingredientA}).`);
    }
    const pk = makePairKey(p.ingredientA, p.ingredientB);
    if (pairKeys.has(pk)) {
      warnings.push(`Duplicate pair key ${pk} in pairing ${p.id}.`);
    }
    pairKeys.add(pk);

    if (!validRelTypes.has(p.classification)) {
      errors.push(`Pairing ${p.id} has invalid classification '${p.classification}'.`);
    }
    if (typeof p.affinityScore !== "number" || p.affinityScore < -100 || p.affinityScore > 100) {
      errors.push(`Pairing ${p.id} has out-of-range affinityScore: ${p.affinityScore}.`);
    }
    if (!p.rationale || p.rationale.trim().length < 10) {
      errors.push(`Pairing ${p.id} missing substantive rationale.`);
    }
    for (const bId of p.balancingIngredients || []) {
      if (!ingredientIds.has(bId)) {
        errors.push(`Pairing ${p.id} balancingIngredients references unknown ingredient '${bId}'.`);
      }
    }
    if (!sourceIds.has(p.provenanceId)) {
      errors.push(`Pairing ${p.id} references unknown provenanceId '${p.provenanceId}'.`);
    }
  }

  // When validating the full production catalog (>= 50 ingredients), require zero orphan ingredients
  if (ingredients.length >= 50) {
    const orphans = Array.from(pairingCountsByIng.entries())
      .filter(([, count]) => count === 0)
      .map(([id]) => id);
    if (orphans.length > 0) {
      errors.push(
        `Dataset contains ${orphans.length} orphan ingredient(s) with 0 pairings: ${orphans.slice(0, 8).join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      sources: sources.length,
      cuisines: cuisines.length,
      ingredients: ingredients.length,
      sauces: sauces.length,
      sides: sides.length,
      pairings: pairings.length
    }
  };
}

/**
 * Precomputed in-memory knowledge graph for fast O(1) lookup, adjacency traversal,
 * and normalized search indexing.
 */
export class CulinaryKnowledgeGraph {
  /**
   * @param {Object} dataset
   */
  constructor(dataset) {
    this.sources = new Map((dataset.sources || []).map((s) => [s.id, s]));
    this.cuisines = new Map((dataset.cuisines || []).map((c) => [c.id, c]));
    this.ingredients = new Map();
    this.sauces = new Map((dataset.sauces || []).map((s) => [s.id, s]));
    this.sides = new Map((dataset.sides || []).map((s) => [s.id, s]));

    /** @type {Map<string, Object>} Pair key "idA::idB" -> PairingRelationship */
    this.pairMap = new Map();

    /** @type {Map<string, Array<{ partnerId: string, relationship: Object }>>} */
    this.adjacency = new Map();

    /** @type {Map<string, string>} Normalized alias/name -> canonical ingredient ID */
    this.aliasToId = new Map();

    /** @type {Array<{ id: string, nameNorm: string, tokens: string[], aliasesNorm: string[], categories: string[] }>} */
    this.searchIndex = [];

    for (const ing of dataset.ingredients || []) {
      this.ingredients.set(ing.id, ing);
      this.adjacency.set(ing.id, []);

      const nameNorm = normalizeText(ing.name);
      this.aliasToId.set(nameNorm, ing.id);
      this.aliasToId.set(ing.id.toLowerCase(), ing.id);
      for (const part of String(ing.name || "").replace(/\([^)]*\)/g, "").split("/")) {
        const partNorm = normalizeText(part);
        if (partNorm && !this.aliasToId.has(partNorm)) {
          this.aliasToId.set(partNorm, ing.id);
        }
      }

      const aliasesNorm = [];
      for (const al of ing.aliases || []) {
        const alNorm = normalizeText(al);
        if (alNorm) {
          aliasesNorm.push(alNorm);
          if (!this.aliasToId.has(alNorm)) {
            this.aliasToId.set(alNorm, ing.id);
          }
        }
      }

      const tokens = Array.from(
        new Set([
          ...nameNorm.split(" ").filter(Boolean),
          ...aliasesNorm.flatMap((a) => a.split(" ").filter(Boolean))
        ])
      );

      this.searchIndex.push({
        id: ing.id,
        nameNorm,
        tokens,
        aliasesNorm,
        categories: ing.categories || []
      });
    }

    for (const rel of dataset.pairings || []) {
      const key = makePairKey(rel.ingredientA, rel.ingredientB);
      this.pairMap.set(key, rel);
      if (this.adjacency.has(rel.ingredientA)) {
        this.adjacency.get(rel.ingredientA).push({
          partnerId: rel.ingredientB,
          relationship: rel
        });
      }
      if (this.adjacency.has(rel.ingredientB)) {
        this.adjacency.get(rel.ingredientB).push({
          partnerId: rel.ingredientA,
          relationship: rel
        });
      }
    }
  }

  /**
   * Resolves an input string (canonical ID, display name, or alias) to a canonical ingredient ID.
   * @param {string} queryOrId
   * @returns {string|null}
   */
  resolveIngredientId(queryOrId) {
    if (!queryOrId) return null;
    if (this.ingredients.has(queryOrId)) return queryOrId;
    const norm = normalizeText(queryOrId);
    return this.aliasToId.get(norm) || null;
  }

  /**
   * Retrieves a direct or parent-inherited pairing relationship between two ingredients.
   * @param {string} idA
   * @param {string} idB
   * @returns {Object|null}
   */
  getPairing(idA, idB) {
    if (!idA || !idB || idA === idB) return null;
    const direct = this.pairMap.get(makePairKey(idA, idB));
    if (direct) return direct;

    // Check parent ingredient fallback if variant doesn't have an explicit override
    const ingA = this.ingredients.get(idA);
    const ingB = this.ingredients.get(idB);
    const parentA = ingA?.parentIngredientId;
    const parentB = ingB?.parentIngredientId;

    if (parentA && parentA !== idB) {
      const pRel = this.pairMap.get(makePairKey(parentA, idB));
      if (pRel) {
        return {
          ...pRel,
          ingredientA: idA,
          ingredientB: idB,
          inheritedFromParent: parentA
        };
      }
    }
    if (parentB && parentB !== idA) {
      const pRel = this.pairMap.get(makePairKey(idA, parentB));
      if (pRel) {
        return {
          ...pRel,
          ingredientA: idA,
          ingredientB: idB,
          inheritedFromParent: parentB
        };
      }
    }
    if (parentA && parentB && parentA !== parentB) {
      const ppRel = this.pairMap.get(makePairKey(parentA, parentB));
      if (ppRel) {
        return {
          ...ppRel,
          ingredientA: idA,
          ingredientB: idB,
          inheritedFromParent: `${parentA}+${parentB}`
        };
      }
    }
    return null;
  }

  /**
   * Computes the effective flavor profile of an ingredient adjusted for its preparation state.
   * @param {string} ingredientId
   * @param {string} [preparation]
   * @returns {Object|null}
   */
  getEffectiveFlavorProfile(ingredientId, preparation) {
    const ing = this.ingredients.get(ingredientId);
    if (!ing) return null;
    const base = { ...ing.flavorProfile };
    if (!preparation || !Array.isArray(ing.preparationModifiers)) {
      return base;
    }
    const mod = ing.preparationModifiers.find((m) => m.state === preparation);
    if (mod && mod.flavorDelta) {
      for (const [k, delta] of Object.entries(mod.flavorDelta)) {
        const key = k.charAt(0).toLowerCase() + k.slice(1);
        if (typeof base[key] === "number" && typeof delta === "number") {
          base[key] = Math.max(0, Math.min(4, base[key] + delta));
        }
      }
    }
    // General culinary rules for preparation states when no explicit override exists
    if (preparation === "roasted" || preparation === "caramelized") {
      base.sweetness = Math.min(4, (base.sweetness || 0) + 1);
      base.umami = Math.min(4, (base.umami || 0) + 1);
    } else if (preparation === "grilled" || preparation === "smoked") {
      base.smokiness = Math.min(4, (base.smokiness || 0) + 2);
    } else if (preparation === "pickled") {
      base.acidity = Math.min(4, (base.acidity || 0) + 2);
    }
    return base;
  }
}
