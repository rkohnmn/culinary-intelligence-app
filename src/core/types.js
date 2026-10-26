/**
 * @fileoverview Centralized domain types and TypeScript contracts for the
 * Culinary Intelligence, Ingredient Pairing & Menu Building Web Application.
 *
 * This module defines the canonical schemas for:
 * - Ingredients, preparation states, categories, and culinary roles
 * - Flavor characteristics (ordinal 0-4 scales + qualitative notes)
 * - Pairing relationships, conditional modifiers, and provenance records
 * - Sauces, composed side/accompaniment templates, and cuisine contexts
 * - Working and saved Dishes, Compatibility Overrides, Warnings, and Bridges
 * - Multi-course Menus and Menu-level evaluation observations
 * - IndexedDB persistence, schema migration, and Export/Import payloads
 */

export const SCHEMA_VERSION = 2;
export const EXPORT_FORMAT_ID = "culinary-intelligence-backup-v2";

/**
 * Ingredient classification categories (an ingredient may belong to multiple).
 */
export const INGREDIENT_CATEGORIES = Object.freeze([
  "meat",
  "poultry",
  "fish",
  "shellfish",
  "vegetables",
  "fruits",
  "grains",
  "rice",
  "pasta",
  "legumes",
  "nuts_and_seeds",
  "herbs",
  "spices",
  "dairy",
  "eggs",
  "oils_and_fats",
  "acids",
  "fermented",
  "aromatics",
  "sweeteners",
  "condiments",
  "sauces",
  "stocks_and_liquids",
  "fungi",
  "seaVegetables",
  "baking_and_pantry"
]);

/**
 * Contextual culinary roles an ingredient can serve inside a specific dish.
 */
export const CULINARY_ROLES = Object.freeze([
  "main_component",
  "supporting_component",
  "aromatic",
  "seasoning",
  "acid",
  "fat",
  "sweetener",
  "umami_boost",
  "sauce_component",
  "garnish",
  "vegetable_accompaniment",
  "starch",
  "texture_contrast",
  "finishing_element",
  "bridge_element"
]);

/**
 * Common preparation states that alter flavor characteristics and pairing behavior.
 */
export const PREPARATION_STATES = Object.freeze([
  "raw",
  "roasted",
  "sauteed",
  "braised",
  "grilled",
  "poached",
  "steamed",
  "fried",
  "caramelized",
  "fermented",
  "pickled",
  "cured",
  "smoked",
  "dried",
  "toasted",
  "infused",
  "reduced",
  "emulsified",
  "fresh_whole",
  "cooked_default"
]);

/**
 * Relationship classifications between two ingredients.
 */
export const RELATIONSHIP_TYPES = Object.freeze([
  "strong_established",
  "common_compatible",
  "conditionally_compatible",
  "less_conventional_useful",
  "challenging",
  "context_dependent_incompatibility",
  "insufficient_information"
]);

/**
 * Evidence provenance tiers to distinguish documented culinary facts from editorial or inferred rules.
 */
export const PROVENANCE_TIERS = Object.freeze([
  "documented_external",
  "original_editorial",
  "algorithmically_inferred",
  "illustrative_fixture"
]);

/**
 * @typedef {Object} FlavorProfile
 * @property {number} sweetness - Ordinal 0 (none) to 4 (intense)
 * @property {number} acidity - Ordinal 0 to 4
 * @property {number} saltiness - Ordinal 0 to 4
 * @property {number} bitterness - Ordinal 0 to 4
 * @property {number} umami - Ordinal 0 to 4
 * @property {number} fatRichness - Ordinal 0 to 4
 * @property {number} heatPungency - Ordinal 0 to 4
 * @property {number} herbalCharacter - Ordinal 0 to 4
 * @property {number} floralCharacter - Ordinal 0 to 4
 * @property {number} earthiness - Ordinal 0 to 4
 * @property {number} smokiness - Ordinal 0 to 4
 * @property {number} aromaticIntensity - Ordinal 1 (subtle) to 4 (dominant)
 * @property {number} perceivedRichness - Ordinal 0 to 4
 * @property {string[]} textures - e.g. ["crisp", "creamy", "tender", "flaky", "gelatinous"]
 * @property {boolean} isEditorialApproximation - True if ordinal profile is an editorial approximation
 */

/**
 * @typedef {Object} PreparationModifier
 * @property {string} state - Preparation state ID from PREPARATION_STATES
 * @property {Partial<FlavorProfile>} flavorDelta - Changes to ordinal flavor dimensions when prepared this way
 * @property {string} culinaryNote - Explanation of how this preparation shifts behavior
 */

/**
 * @typedef {Object} Ingredient
 * @property {string} id - Stable canonical identifier (e.g., "ing_lemon_fresh", "ing_lemon_preserved")
 * @property {string} name - Primary display name
 * @property {string} [parentIngredientId] - Optional parent canonical ID if this is a distinct culinary variant
 * @property {string[]} aliases - Alternative names, regional terms, and common spelling variations
 * @property {string[]} categories - One or more category IDs from INGREDIENT_CATEGORIES
 * @property {string[]} defaultRoles - Typical roles from CULINARY_ROLES
 * @property {FlavorProfile} flavorProfile - Baseline flavor and texture profile
 * @property {string[]} preparations - Common preparation states
 * @property {PreparationModifier[]} [preparationModifiers] - Specific adjustments by preparation state
 * @property {string[]} cuisines - Associated cuisine IDs
 * @property {string[]} dietaryFlags - Reliable flags e.g. ["meat", "poultry", "fish", "shellfish", "dairy", "egg", "nuts", "gluten", "allium", "soy", "sesame"]
 * @property {string} provenanceId - Reference to SourceRegistryEntry.id
 * @property {string} provenanceTier - One of PROVENANCE_TIERS
 * @property {string} culinaryNotes - Concise explanation of culinary function and pairing behavior
 */

/**
 * @typedef {Object} PairingRelationship
 * @property {string} id - Stable relationship ID
 * @property {string} ingredientA - Canonical ingredient ID
 * @property {string} ingredientB - Canonical ingredient ID
 * @property {string} classification - One of RELATIONSHIP_TYPES
 * @property {number} affinityScore - Numeric -100 to +100 representing baseline compatibility
 * @property {string[]} [applicablePreparationsA] - Optional preparation states where this applies
 * @property {string[]} [applicablePreparationsB] - Optional preparation states where this applies
 * @property {string[]} [cuisines] - Cuisines where this combination is characteristic
 * @property {string} rationale - Explainable culinary reason for the relationship
 * @property {string[]} [balancingIngredients] - Canonical ingredient IDs that strengthen or bridge this pair
 * @property {string[]} [strengtheningConditions] - Contextual conditions that improve fit
 * @property {string[]} [weakeningConditions] - Contextual conditions that degrade fit
 * @property {string} provenanceId - Reference to SourceRegistryEntry.id
 * @property {string} provenanceTier - One of PROVENANCE_TIERS
 * @property {"high"|"medium"|"exploratory"} confidence - Evidence confidence level
 */

/**
 * @typedef {Object} SauceTemplate
 * @property {string} id - Stable sauce ID (e.g., "sauce_beurre_blanc")
 * @property {string} name - Display name
 * @property {string} category - e.g., "emulsified_butter", "pan_reduction", "herb_condiment", "fermented_glaze", "mother_sauce", "spiced_gravy", "vinaigrette"
 * @property {string[]} mainIngredients - Canonical ingredient IDs defining the sauce
 * @property {FlavorProfile} flavorProfile - Aggregate flavor characteristics of the sauce
 * @property {string[]} typicalApplications - Roles/categories it excels with
 * @property {string[]} cuisines - Associated cuisine IDs
 * @property {string[]} compatibleIngredients - Explicit strong ingredient matches
 * @property {string[]} challengingIngredients - Ingredients that clash with this sauce
 * @property {string} technique - Core preparation technique
 * @property {string} preparationNotes - Concise explanation of structure and usage
 * @property {string} provenanceId - Source registry ID
 */

/**
 * @typedef {Object} SideTemplate
 * @property {string} id - Stable side dish ID (e.g., "side_pommes_puree")
 * @property {string} name - Display name
 * @property {string} category - e.g., "composed_vegetable", "starch_preparation", "grain_pilaf", "acidic_salad", "legume_accompaniment"
 * @property {string[]} mainIngredients - Canonical ingredient IDs
 * @property {FlavorProfile} flavorProfile - Aggregate profile of the composed side
 * @property {string[]} cuisines - Associated cuisine IDs
 * @property {string[]} complementsRoles - Dish traits this side balances (e.g., ["high_richness", "braised_meat", "spicy_main"])
 * @property {string} culinaryRationale - Why and when to serve this accompaniment
 * @property {string} provenanceId - Source registry ID
 */

/**
 * @typedef {Object} CuisineContext
 * @property {string} id - Stable cuisine ID (e.g., "cuisine_french_classical", "cuisine_sichuan")
 * @property {string} name - Display name
 * @property {string} region - Broad geographical region
 * @property {string} description - Nuanced overview acknowledging regional specificity
 * @property {string[]} signatureIngredients - Core pantry ingredients
 * @property {string[]} signatureSauces - Core sauces
 * @property {string[]} commonTechniques - Characteristic cooking methods
 * @property {string} flavorStructureNotes - Typical acid/fat/aromatic/umami architecture
 */

/**
 * @typedef {Object} SourceRegistryEntry
 * @property {string} id - Stable source ID
 * @property {string} title - Source title
 * @property {string} publisher - Publisher or organization
 * @property {string} url - Canonical URL
 * @property {string} license - License or legal reuse basis
 * @property {string} attribution - Attribution statement
 * @property {string} accessedDate - ISO date string
 * @property {string[]} derivedFields - Fields derived from this source
 * @property {string} restrictions - Redistribution notes
 * @property {string} tier - One of PROVENANCE_TIERS
 */

/**
 * @typedef {Object} SelectedIngredient
 * @property {string} ingredientId - Canonical ingredient ID (or preserved legacy ID if missing from catalog)
 * @property {string} [fallbackName] - Stored display name for resilient recovery if catalog changes
 * @property {string} role - Assigned role from CULINARY_ROLES
 * @property {string} preparation - Assigned preparation state from PREPARATION_STATES
 * @property {boolean} isOverride - True if user explicitly accepted a compatibility warning when adding
 * @property {string} [overrideReason] - Recorded warning explanation at time of override
 * @property {string} addedAt - ISO timestamp
 */

/**
 * @typedef {Object} CompatibilityWarning
 * @property {string} id - Deterministic warning key
 * @property {"challenging"|"conditional"|"structural_imbalance"|"missing_catalog_item"} severity
 * @property {string[]} involvedIngredients - Canonical IDs involved
 * @property {string} title - Short accessible summary
 * @property {string} explanation - Detailed contextual explanation
 * @property {boolean} isContextual - Whether preparation/role/bridge can mitigate it
 * @property {string[]} suggestedBridges - Canonical ingredient IDs or preparation adjustments
 * @property {boolean} acceptedByOverride - Whether user has already acknowledged and overridden this warning
 */

/**
 * @typedef {Object} BridgeSuggestion
 * @property {string} id - Deterministic bridge ID
 * @property {"ingredient"|"preparation_change"|"role_adjustment"|"sauce_unifier"} type
 * @property {string} [candidateIngredientId] - If type === "ingredient", the bridging ingredient ID
 * @property {string} [candidateSauceId] - If type === "sauce_unifier", the sauce ID
 * @property {string} targetConflictId - The warning or ingredient pair being rescued
 * @property {string[]} connectedIngredients - All selected ingredients evaluated against this bridge
 * @property {string} mechanism - e.g., "acid_cuts_richness", "aromatic_shared_compound", "umami_savory_bridge", "sweetness_softens_bitterness", "fat_buffers_heat"
 * @property {number} overallCompatibilityScore - Compatibility across ALL selected ingredients (0-100)
 * @property {number} conflictMitigationScore - Degree to which the specific conflict is reduced (0-100)
 * @property {"established"|"contextually_supported"|"experimental"} supportLevel
 * @property {string} rationale - Traceable culinary explanation
 * @property {string} [tradeoffNote] - Disclosed if the bridge has a minor secondary tension
 */

/**
 * @typedef {Object} RecommendationItem
 * @property {string} candidateId - Ingredient ID, Sauce ID, or Side ID
 * @property {"ingredient"|"sauce"|"side"} itemType
 * @property {string} name - Display name
 * @property {number} totalScore - Normalized suitability score (0-100)
 * @property {Object} scoreBreakdown
 * @property {number} scoreBreakdown.pairingSupport - Direct pairwise support across all selected items
 * @property {number} scoreBreakdown.contextualFit - Preparation and cooking method alignment
 * @property {number} scoreBreakdown.roleUsefulness - Contribution to missing dish structure
 * @property {number} scoreBreakdown.balanceContribution - Acid/fat/umami/sweet/texture balance improvement
 * @property {number} scoreBreakdown.bridgeBenefit - Conflict mitigation value if active conflicts exist
 * @property {number} scoreBreakdown.cuisineAlignment - Alignment with optional selected cuisine(s)
 * @property {number} scoreBreakdown.conflictPenalty - Penalty for any negative interactions
 * @property {number} scoreBreakdown.redundancyPenalty - Penalty for duplicating already crowded roles
 * @property {string} suggestedRole - Recommended role in the current dish
 * @property {string} suggestedPreparation - Recommended preparation state
 * @property {"high"|"medium"|"exploratory"} confidence
 * @property {string[]} explanationCategories - e.g. ["Established ingredient pairing", "Acid-richness balance"]
 * @property {string} primaryExplanation - Specific explanation referencing the active dish selections
 */

/**
 * @typedef {Object} Dish
 * @property {string} id - Stable UUID/slug
 * @property {string} name - User-defined dish name
 * @property {string} description - Optional description
 * @property {SelectedIngredient[]} ingredients - Ordered selected ingredients
 * @property {string[]} sauceIds - Selected SauceTemplate IDs
 * @property {string[]} sideIds - Selected SideTemplate IDs
 * @property {string[]} cookingMethods - Optional dish-level cooking techniques
 * @property {string[]} cuisineIds - Optional selected cuisine preference IDs
 * @property {string} courseRole - Optional default course role (e.g., "main_course", "appetizer")
 * @property {string} notes - User culinary notes (treated strictly as non-executable data)
 * @property {Record<string, boolean>} acceptedOverrides - Map of warning ID or ingredient ID -> true
 * @property {string} [sourceDishId] - If duplicated or snapshotted into a menu, tracks origin dish ID
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {number} schemaVersion - Schema version for migration
 */

/**
 * @typedef {Object} MenuCourseItem
 * @property {string} entryId - Unique ID for this placement in the menu
 * @property {string} courseType - e.g., "appetizer", "soup", "salad", "main_course", "side", "dessert", "custom"
 * @property {string} customCourseLabel - Optional user-defined course name
 * @property {number} order - Sequence index within the menu
 * @property {Dish} dishSnapshot - Independent editable copy/snapshot of the dish so edits in one menu never corrupt another menu or library master
 * @property {string} [linkedLibraryDishId] - Optional reference to the library dish it was cloned from
 */

/**
 * @typedef {Object} Menu
 * @property {string} id - Stable menu ID
 * @property {string} name - Menu name
 * @property {string} description - Optional description
 * @property {string} theme - Optional culinary theme
 * @property {string[]} cuisineIds - Optional menu-wide cuisine context
 * @property {MenuCourseItem[]} items - Ordered courses and dish snapshots
 * @property {string} notes - User notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {number} schemaVersion - Schema version
 */
