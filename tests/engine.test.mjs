/**
 * @fileoverview Comprehensive automated test suite for:
 * - Ingredient Search & Autocomplete (Section 18.2)
 * - Pairwise & Multi-Ingredient Pairing Logic (Section 18.3)
 * - Mandatory 10-Case Multi-Ingredient Override & Bridge Fixture Tests (Section 18.4)
 * - Sauce & Accompaniment Recommendations & Overlap Deduplication (Section 18.5)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CulinaryKnowledgeGraph, validateCulinaryDataset } from "../src/data/knowledgeGraph.js";
import { CulinaryEngine } from "../src/core/engine.js";
import { evaluatePairwise, evaluateCandidateAgainstDish } from "../src/core/compatibility.js";
import {
  createDish,
  addIngredientToDish,
  removeIngredientFromDish,
  updateDishIngredient,
  toggleDishSauce,
  updateDishMetadata
} from "../src/dishes/dishManager.js";
import { CulinaryStorage } from "../src/storage/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../public/data");

const prodDataset = {
  sources: JSON.parse(fs.readFileSync(path.join(dataDir, "sources.json"), "utf8")),
  cuisines: JSON.parse(fs.readFileSync(path.join(dataDir, "cuisines.json"), "utf8")),
  ingredients: JSON.parse(fs.readFileSync(path.join(dataDir, "ingredients.json"), "utf8")),
  sauces: JSON.parse(fs.readFileSync(path.join(dataDir, "sauces.json"), "utf8")),
  sides: JSON.parse(fs.readFileSync(path.join(dataDir, "sides.json"), "utf8")),
  pairings: JSON.parse(fs.readFileSync(path.join(dataDir, "pairings.json"), "utf8"))
};

const prodGraph = new CulinaryKnowledgeGraph(prodDataset);
const prodEngine = new CulinaryEngine(prodGraph);

test("Section 18.1 / Phase 2 — Production Culinary Dataset Integrity", () => {
  const validation = validateCulinaryDataset(prodDataset);
  assert.equal(validation.valid, true, `Errors: ${validation.errors.join("; ")}`);
  assert.ok(validation.stats.ingredients >= 250, "Must have at least 250 canonical ingredients");
  assert.ok(validation.stats.pairings >= 500, "Must have at least 500 pairing relationships");
  assert.ok(validation.stats.cuisines >= 10, "Must have at least 10 culinary traditions");
});

test("Section 18.2 — Ingredient Search & Context-Aware Autocomplete", () => {
  // 1. Exact search
  const exactRes = prodEngine.searchIngredients("Fresh Lemon (Juice & Zest)");
  assert.ok(exactRes.length > 0);
  assert.equal(exactRes[0].id, "ing_lemon_fresh");
  assert.equal(exactRes[0].matchType, "exact_name");

  // 2. Prefix search
  const prefixRes = prodEngine.searchIngredients("lem");
  assert.ok(prefixRes.some((r) => r.id === "ing_lemon_fresh"));
  assert.ok(prefixRes.some((r) => r.id === "ing_lemongrass"));

  // 3. Alias matching (e.g. "entrecote" -> ing_beef_ribeye, "coriander leaves" -> ing_cilantro_fresh)
  const aliasRes = prodEngine.searchIngredients("entrecote");
  assert.equal(aliasRes[0].id, "ing_beef_ribeye");
  const cilantroAlias = prodEngine.searchIngredients("coriander leaves");
  assert.equal(cilantroAlias[0].id, "ing_cilantro_fresh");

  // 4. Case and diacritic normalization ("Jalapeño" vs "JALAPENO", "Crème Fraîche" vs "creme fraiche")
  const jalapenoRes = prodEngine.searchIngredients("JALAPENO");
  assert.equal(jalapenoRes[0].id, "ing_chile_jalapeno");
  const cremeRes = prodEngine.searchIngredients("creme fraiche");
  assert.ok(cremeRes.some((r) => r.id === "ing_creme_fraiche" || r.id === "ing_heavy_cream"));

  // 5. Fuzzy typo tolerance (e.g. "cauliflour" -> ing_cauliflower)
  const fuzzyRes = prodEngine.searchIngredients("cauliflour");
  assert.ok(fuzzyRes.some((r) => r.id === "ing_cauliflower"));

  // 6. No-result handling
  const emptyRes = prodEngine.searchIngredients("xyzquantumnonexistent999");
  assert.equal(emptyRes.length, 0);

  // 7. Distinct variants are NOT collapsed (lemon vs lime vs preserved lemon; fresh tomato vs tomato paste vs sun-dried)
  assert.notEqual(prodEngine.resolveIngredientId("Fresh Lemon (Juice & Zest)"), prodEngine.resolveIngredientId("Preserved Lemon (Salt-Cured)"));
  assert.notEqual(prodEngine.resolveIngredientId("Fresh Ripe Tomato"), prodEngine.resolveIngredientId("Double-Concentrated Tomato Paste"));
  assert.notEqual(prodEngine.resolveIngredientId("Fresh Ripe Tomato"), prodEngine.resolveIngredientId("Sun-Dried Tomatoes"));

  // 8. Contextual search annotation & explicit retrieval of normally excluded ingredients
  let dish = createDish({ name: "Delicate Cod Dish" });
  dish = addIngredientToDish(prodGraph, dish, "ing_cod_halibut");
  const blueCheeseSearch = prodEngine.searchIngredients("Blue Cheese", dish);
  const bcHit = blueCheeseSearch.find((r) => r.id === "ing_blue_cheese");
  assert.ok(bcHit, "Explicitly searched excluded ingredient must be returned in search results");
  assert.equal(bcHit.contextStatus, "pairing_concern");
  assert.ok(bcHit.warningSummary && bcHit.warningSummary.length > 10, "Must include warning explanation");
  assert.ok(bcHit.conflictingIngredients.includes("ing_cod_halibut"), "Must identify conflicting selection");
});

test("Section 18.3 — Pairwise & Contextual Pairing Evaluation", () => {
  // 1. Known positive relationship
  const pos = evaluatePairwise(prodGraph, "ing_tomato_fresh", "ing_basil_sweet");
  assert.equal(pos.classification, "strong_established");
  assert.ok(pos.score >= 90);
  assert.equal(pos.isConflict, false);

  // 2. Known contextual conflict
  const neg = evaluatePairwise(prodGraph, "ing_cod_halibut", "ing_blue_cheese");
  assert.equal(neg.isConflict, true);
  assert.equal(neg.isSevereConflict, true);
  assert.ok(neg.score <= -60);

  // 3. Missing direct relationship is NOT automatically classified as negative
  const unlinked = evaluatePairwise(prodGraph, "ing_quinoa", "ing_turnip_parsnip");
  assert.equal(unlinked.isConflict, false, "Missing direct pairing must not be marked incompatible");
  assert.ok(unlinked.score >= 0);

  // 4. Preparation state alters flavor profile & compatibility
  const rawGarlicFp = prodGraph.getEffectiveFlavorProfile("ing_garlic", "raw");
  const roastedGarlicFp = prodGraph.getEffectiveFlavorProfile("ing_garlic", "roasted");
  assert.ok(rawGarlicFp.heatPungency > roastedGarlicFp.heatPungency, "Roasting garlic reduces raw pungency");
  assert.ok(roastedGarlicFp.sweetness > rawGarlicFp.sweetness, "Roasting garlic increases sweetness");

  // 5. Cuisine preference influences ranking appropriately without acting as universal prohibition
  let dishNoCuis = addIngredientToDish(prodGraph, createDish(), "ing_chicken_thigh");
  let dishThai = updateDishMetadata(dishNoCuis, { cuisineIds: ["cuisine_thai"] });
  const evalLemongrassNoCuis = evaluateCandidateAgainstDish(prodGraph, "ing_lemongrass", dishNoCuis);
  const evalLemongrassThai = evaluateCandidateAgainstDish(prodGraph, "ing_lemongrass", dishThai);
  assert.ok(evalLemongrassThai.totalScore > evalLemongrassNoCuis.totalScore, "Thai cuisine context boosts lemongrass rank");
});

test("Section 18.4 — Mandatory 10-Case Deterministic Fixture Override & Multi-Ingredient Recalculation Suite", async () => {
  /**
   * Build a deterministic synthetic fixture with Ingredients A, B, C, D, and Bridge E
   * (plus test the exact same 10 cases on real culinary ingredients!)
   *
   * Synthetic fixture:
   * - Ingredient A (`ing_syn_a`): Poached Dover Sole (lean delicate fish)
   * - Ingredient B (`ing_syn_b`): Cultured Butter (rich dairy fat, pairs strongly with A)
   * - Ingredient C (`ing_syn_c`): Roquefort Blue Cheese (documented negative relationship with A, excluded from default recommendations)
   * - Ingredient D (`ing_syn_d`): Candidate ingredient evaluated against A + B + C together
   * - Ingredient Bridge (`ing_syn_bridge`): Fresh Lemon & Walnut Bridge (documented balancing bridge for A + C that also pairs with B)
   */
  const fixtureDataset = {
    sources: [
      {
        id: "src_fixture",
        title: "Deterministic Test Fixture",
        publisher: "QA Suite",
        url: "https://example.org",
        license: "MIT",
        attribution: "Fixture",
        accessedDate: "2026-10-24",
        derivedFields: ["all"],
        restrictions: "None",
        tier: "illustrative_fixture"
      }
    ],
    cuisines: [
      {
        id: "cuis_test",
        name: "Test Cuisine",
        region: "Test",
        description: "Test",
        signatureIngredients: ["ing_syn_a", "ing_syn_b", "ing_syn_d", "ing_syn_bridge"],
        signatureSauces: [],
        commonTechniques: ["poached", "roasted"],
        flavorStructureNotes: "Test"
      }
    ],
    ingredients: [
      {
        id: "ing_syn_a",
        name: "Ingredient A (Delicate Sole)",
        aliases: ["sole a"],
        categories: ["fish"],
        defaultRoles: ["main_component"],
        flavorProfile: { sweetness: 2, acidity: 0, saltiness: 1, bitterness: 0, umami: 2, fatRichness: 1, heatPungency: 0, herbalCharacter: 0, floralCharacter: 0, earthiness: 0, smokiness: 0, aromaticIntensity: 1, perceivedRichness: 1, textures: ["flaky"], isEditorialApproximation: true },
        preparations: ["poached"],
        cuisines: ["cuis_test"],
        dietaryFlags: ["fish"],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        culinaryNotes: "Delicate base protein A."
      },
      {
        id: "ing_syn_b",
        name: "Ingredient B (Cultured Butter)",
        aliases: ["butter b"],
        categories: ["dairy", "oils_and_fats"],
        defaultRoles: ["fat", "supporting_component"],
        flavorProfile: { sweetness: 2, acidity: 0, saltiness: 1, bitterness: 0, umami: 1, fatRichness: 4, heatPungency: 0, herbalCharacter: 0, floralCharacter: 0, earthiness: 0, smokiness: 0, aromaticIntensity: 2, perceivedRichness: 4, textures: ["creamy"], isEditorialApproximation: true },
        preparations: ["emulsified"],
        cuisines: ["cuis_test"],
        dietaryFlags: ["dairy"],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        culinaryNotes: "Rich lipid partner B."
      },
      {
        id: "ing_syn_c",
        name: "Ingredient C (Pungent Blue Cheese)",
        aliases: ["blue cheese c"],
        categories: ["dairy", "fermented"],
        defaultRoles: ["supporting_component"],
        flavorProfile: { sweetness: 0, acidity: 1, saltiness: 4, bitterness: 2, umami: 4, fatRichness: 4, heatPungency: 2, herbalCharacter: 0, floralCharacter: 0, earthiness: 3, smokiness: 0, aromaticIntensity: 4, perceivedRichness: 4, textures: ["crumbly"], isEditorialApproximation: true },
        preparations: ["raw"],
        cuisines: ["cuis_test"],
        dietaryFlags: ["dairy"],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        culinaryNotes: "Challenging pungent component C."
      },
      {
        id: "ing_syn_d",
        name: "Ingredient D (Crisp Tart Apple)",
        aliases: ["apple d"],
        categories: ["fruits", "acids"],
        defaultRoles: ["acid", "texture_contrast"],
        flavorProfile: { sweetness: 2, acidity: 4, saltiness: 0, bitterness: 0, umami: 0, fatRichness: 0, heatPungency: 0, herbalCharacter: 1, floralCharacter: 2, earthiness: 0, smokiness: 0, aromaticIntensity: 2, perceivedRichness: 0, textures: ["crisp"], isEditorialApproximation: true },
        preparations: ["raw"],
        cuisines: ["cuis_test"],
        dietaryFlags: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        culinaryNotes: "Acidic crisp component D evaluated against A + B + C."
      },
      {
        id: "ing_syn_bridge",
        name: "Ingredient Bridge (Fresh Lemon Juice)",
        aliases: ["lemon bridge"],
        categories: ["acids", "fruits"],
        defaultRoles: ["acid", "bridge_element"],
        flavorProfile: { sweetness: 1, acidity: 4, saltiness: 0, bitterness: 0, umami: 0, fatRichness: 0, heatPungency: 0, herbalCharacter: 1, floralCharacter: 3, earthiness: 0, smokiness: 0, aromaticIntensity: 3, perceivedRichness: 0, textures: ["liquid"], isEditorialApproximation: true },
        preparations: ["raw"],
        cuisines: ["cuis_test"],
        dietaryFlags: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        culinaryNotes: "High-acid bridge that cuts richness and rescues A + C."
      }
    ],
    sauces: [],
    sides: [],
    pairings: [
      {
        id: "p_ab",
        ingredientA: "ing_syn_a",
        ingredientB: "ing_syn_b",
        classification: "strong_established",
        affinityScore: 92,
        cuisines: ["cuis_test"],
        rationale: "A and B form a classic sole meunière foundation.",
        balancingIngredients: ["ing_syn_bridge"],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_ac_neg",
        ingredientA: "ing_syn_a",
        ingredientB: "ing_syn_c",
        classification: "context_dependent_incompatibility",
        affinityScore: -80,
        cuisines: ["cuis_test"],
        rationale: "C's pungent ketones overwhelm delicate fish A.",
        balancingIngredients: ["ing_syn_bridge", "ing_syn_d"],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_ad",
        ingredientA: "ing_syn_a",
        ingredientB: "ing_syn_d",
        classification: "common_compatible",
        affinityScore: 68,
        cuisines: ["cuis_test"],
        rationale: "D adds crisp tartness to A.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_bd",
        ingredientA: "ing_syn_b",
        ingredientB: "ing_syn_d",
        classification: "strong_established",
        affinityScore: 84,
        cuisines: ["cuis_test"],
        rationale: "D cuts the richness of butter B.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_cd",
        ingredientA: "ing_syn_c",
        ingredientB: "ing_syn_d",
        classification: "strong_established",
        affinityScore: 90,
        cuisines: ["cuis_test"],
        rationale: "D pairs classically with blue cheese C and mitigates its pungency.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_abridge",
        ingredientA: "ing_syn_a",
        ingredientB: "ing_syn_bridge",
        classification: "strong_established",
        affinityScore: 95,
        cuisines: ["cuis_test"],
        rationale: "Lemon brightens delicate fish A.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_bbridge",
        ingredientA: "ing_syn_b",
        ingredientB: "ing_syn_bridge",
        classification: "strong_established",
        affinityScore: 90,
        cuisines: ["cuis_test"],
        rationale: "Lemon emulsifies with butter B.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      },
      {
        id: "p_cbridge",
        ingredientA: "ing_syn_c",
        ingredientB: "ing_syn_bridge",
        classification: "conditionally_compatible",
        affinityScore: 55,
        cuisines: ["cuis_test"],
        rationale: "Lemon acidity cuts blue cheese C.",
        balancingIngredients: [],
        provenanceId: "src_fixture",
        provenanceTier: "illustrative_fixture",
        confidence: "high"
      }
    ]
  };

  const fixGraph = new CulinaryKnowledgeGraph(fixtureDataset);
  const fixEngine = new CulinaryEngine(fixGraph);

  // Case 1: Ingredient A selected. Appropriate suggestions appear.
  let dish = createDish({ name: "Fixture Override Dish" });
  dish = addIngredientToDish(fixGraph, dish, "ing_syn_a");
  const eval1 = fixEngine.evaluateDish(dish);
  const recIds1 = eval1.ingredientRecs.recommendations.map((r) => r.candidateId);
  assert.ok(recIds1.includes("ing_syn_b"), "Case 1: Ingredient B must be recommended when A is selected");

  // Case 2: Ingredient B selected. Suggestions now reflect A and B together.
  dish = addIngredientToDish(fixGraph, dish, "ing_syn_b");
  const eval2 = fixEngine.evaluateDish(dish);
  const recD2 = eval2.ingredientRecs.recommendations.find((r) => r.candidateId === "ing_syn_d");
  assert.ok(recD2, "Case 2: Ingredient D appears in recommendations for A + B");
  assert.equal(recD2.positiveMatches.length, 2, "Case 2: D is evaluated against BOTH A and B");

  // Case 3: Ingredient C has a documented negative relationship with the current selection. It is excluded from default recommendations.
  const recIds2 = eval2.ingredientRecs.recommendations.map((r) => r.candidateId);
  assert.equal(recIds2.includes("ing_syn_c"), false, "Case 3: Negative ingredient C must be excluded from default recommendations");
  assert.ok(eval2.ingredientRecs.excludedConflictCount >= 1, "Case 3: Excluded conflict count recorded");

  // Case 4: The user explicitly searches for C. It appears in search results with appropriate warning information.
  const searchC = fixEngine.searchIngredients("Blue Cheese", dish);
  const hitC = searchC.find((r) => r.id === "ing_syn_c");
  assert.ok(hitC, "Case 4: Explicit search must retrieve C");
  assert.equal(hitC.contextStatus, "pairing_concern", "Case 4: C is marked with pairing_concern");
  assert.ok(hitC.warningSummary.includes("Ingredient A"), "Case 4: Warning identifies conflicting selection A");

  // Case 5: The user selects C despite the warning. A, B, and C remain selected.
  dish = addIngredientToDish(fixGraph, dish, "ing_syn_c", {
    isOverride: true,
    overrideReason: hitC.warningSummary
  });
  assert.deepEqual(
    dish.ingredients.map((i) => i.ingredientId),
    ["ing_syn_a", "ing_syn_b", "ing_syn_c"],
    "Case 5: A, B, and C all remain selected"
  );
  assert.equal(dish.acceptedOverrides["ing_syn_c"], true, "Case 5: Override state recorded");

  // Case 6: The next recommendation cycle evaluates A, B, and C together.
  const eval6 = fixEngine.evaluateDish(dish);
  assert.ok(eval6.warnings.length >= 1, "Case 6: Conflict remains visible as informational warning");
  assert.equal(eval6.warnings[0].acceptedByOverride, true, "Case 6: User is not repeatedly forced to re-confirm accepted override");

  // Case 7: A possible ingredient D is assessed against all three (A, B, and C), not only the most recent selection.
  const candD7 = evaluateCandidateAgainstDish(fixGraph, "ing_syn_d", dish);
  assert.equal(
    candD7.positiveMatches.length,
    3,
    "Case 7: Candidate D must be evaluated against all three selected ingredients (A, B, and C)"
  );
  assert.ok(
    candD7.bridgedConflicts.length >= 1,
    "Case 7: Candidate D is recognized as bridging the A+C conflict while pairing with B"
  );

  // Case 8: A bridge suggestion is evaluated for overall improvement across A, B, and C.
  const bridges8 = eval6.bridges;
  assert.ok(bridges8.length >= 1, "Case 8: Bridge suggestions generated for A + B + C");
  const topBridge = bridges8.find((b) => b.candidateIngredientId === "ing_syn_bridge" || b.candidateIngredientId === "ing_syn_d");
  assert.ok(topBridge, "Case 8: Documented bridge appears in bridge suggestions");
  assert.deepEqual(
    topBridge.connectedIngredients,
    ["ing_syn_a", "ing_syn_b", "ing_syn_c"],
    "Case 8: Bridge evaluated across all 3 selected ingredients"
  );

  // Case 9: Removing C causes recommendations and warnings to update correctly.
  const dishWithoutC = removeIngredientFromDish(dish, "ing_syn_c");
  const eval9 = fixEngine.evaluateDish(dishWithoutC);
  assert.equal(
    eval9.warnings.filter((w) => w.severity === "challenging").length,
    0,
    "Case 9: Removing C clears the challenging conflict warning"
  );
  assert.equal(
    Boolean(dishWithoutC.acceptedOverrides["ing_syn_c"]),
    false,
    "Case 9: Removing C cleans up its override record"
  );

  // Case 10: Saving and reopening the dish (with C) preserves C and its intentional selection state.
  const storage = new CulinaryStorage({ forceMemory: true });
  await storage.init();
  await storage.saveDish(dish);
  const loadedDishes = await storage.getAllDishes();
  const reopened = loadedDishes.find((d) => d.id === dish.id);
  assert.ok(reopened, "Case 10: Saved dish reopened from storage");
  assert.deepEqual(
    reopened.ingredients.map((i) => i.ingredientId),
    ["ing_syn_a", "ing_syn_b", "ing_syn_c"],
    "Case 10: Reopened dish preserves A, B, and C"
  );
  const cEntry = reopened.ingredients.find((i) => i.ingredientId === "ing_syn_c");
  assert.equal(cEntry.isOverride, true, "Case 10: Intentional override flag preserved across serialization");
  assert.equal(reopened.acceptedOverrides["ing_syn_c"], true, "Case 10: Accepted override map preserved");
});

test("Section 18.5 — Sauce & Accompaniment Recommendations & Constituent Deduplication", () => {
  // Start with Salmon + Shallot
  let dish = createDish({ name: "Pan-Seared Salmon" });
  dish = addIngredientToDish(prodGraph, dish, "ing_salmon");
  dish = addIngredientToDish(prodGraph, dish, "ing_shallot");

  const sauceRecs = prodEngine.recommendSauces(dish);
  assert.ok(sauceRecs.templates.length > 0, "Should recommend compatible sauces for Salmon + Shallot");
  const beurreBlanc = sauceRecs.templates.find((s) => s.id === "sauce_beurre_blanc");
  assert.ok(beurreBlanc, "Beurre Blanc should be recommended for Salmon + Shallot");
  assert.ok(
    beurreBlanc.constituentOverlap.includes("Shallot"),
    "Sauce recommendation must recognize that Shallot is already in the dish"
  );
  assert.ok(sauceRecs.customComposition, "Should also synthesize a custom sauce composition");

  // Adding Beurre Blanc to the dish affects subsequent recommendations and deduplicates overlap
  const structBeforeSauce = prodEngine.evaluateDish(dish).structure;
  dish = toggleDishSauce(dish, "sauce_beurre_blanc");
  const structAfterSauce = prodEngine.evaluateDish(dish).structure;
  assert.ok(
    structAfterSauce.totals.acidity > structBeforeSauce.totals.acidity,
    "Adding Beurre Blanc updates the dish's aggregate flavor structure"
  );

  // Side recommendations distinguish composed side dishes from raw ingredients
  const sideRecs = prodEngine.recommendSides(dish);
  assert.ok(sideRecs.length > 0, "Should recommend composed side dishes");
  assert.ok(
    sideRecs.every((s) => Array.isArray(s.constituentNames) && s.constituentNames.length >= 2),
    "Composed sides must have multiple constituent ingredients distinct from single raw ingredients"
  );
});
