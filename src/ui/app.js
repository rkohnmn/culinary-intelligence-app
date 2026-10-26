/**
 * @fileoverview Interactive Frontend Application (`src/ui/app.js`).
 *
 * Implements Phase 1 + Phase 2 + Atelier Micro-UX & Design Taste Specification (`DESIGN.md`):
 * - Restrained, high-contrast test-kitchen reference catalog UI with editorial serif headers and tabular numerals
 * - Scroll-position and input-focus preservation across all re-renders (`data-preserve-scroll`)
 * - Accessible ARIA combobox (`role="combobox"`, keyboard navigation `ArrowDown`, `ArrowUp`, `Enter`, `Escape`, global `/` focus shortcut)
 * - Context-aware autocomplete showing `[Recommended]`, `[Available]`, `[Challenging — Override Available]`, and `[In Dish]`
 * - Non-blocking inline override confirmation and warning banners (zero native `alert()` / `confirm()` / `prompt()`)
 * - Full Dish Construction: arbitrary starting point, role and preparation selectors, mini flavor badges, sauces, composed sides, and dynamic pan-sauce synthesis
 * - Bridging & Rescue Recommendations panel when conflicts or imbalances exist
 * - Phase 2 Recipe Discovery Studio: NYT Cooking 50 Most Popular of 2025, 14 Renowned Chef Collections, Step-by-Step vs Interactive *Cooking for Engineers* Process Matrix, Live Non-Blocking Kitchen Countdown Timer, Yield Scaling, Metric/Imperial Unit & Temperature Conversion, USDA Nutrition Facts, Interactive Checkoff Shopping List Aggregator, and Local Recipe Personalization/Bulk Importer
 * - Multi-Course Menu Builder, Saved Library & JSON Backup Manager, External AI Prompt Studio, and Interactive Knowledge Base Explorer
 */

import {
  INGREDIENT_CATEGORIES,
  CULINARY_ROLES,
  PREPARATION_STATES
} from "../core/types.js";
import { CulinaryKnowledgeGraph } from "../data/knowledgeGraph.js";
import { CulinaryEngine } from "../core/engine.js";
import {
  createDish,
  duplicateDish,
  addIngredientToDish,
  removeIngredientFromDish,
  updateDishIngredient,
  toggleDishSauce,
  toggleDishSide,
  updateDishMetadata
} from "../dishes/dishManager.js";
import {
  STANDARD_COURSE_TYPES,
  createMenu,
  duplicateMenu,
  addDishToMenu,
  removeDishFromMenu,
  reorderMenuCourse,
  updateMenuCourseEntry,
  evaluateMenu
} from "../menus/menuManager.js";
import { CulinaryStorage } from "../storage/db.js";
import { generateExternalAiPrompt } from "../ai/promptGenerator.js";
import {
  scaleRecipeIngredients,
  formatTemperatureForSystem
} from "../utils/unitConverter.js";
import { calculateRecipeNutrition } from "../utils/nutritionCalculator.js";
import { aggregateShoppingList } from "../utils/shoppingListAggregator.js";
import { renderCookingForEngineersHtml } from "../recipes/processDiagram.js";
import {
  discoverRecipes,
  convertRecipeToDish,
  convertDishToRecipeDraft,
  parseRecipeImportPayload,
  normalizeRecipeRecord
} from "../recipes/recipeEngine.js";

/**
 * Safely escapes any user-controlled or dynamic string before rendering into HTML.
 * Prevents XSS / executable HTML injection (Requirement 19.2).
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats an identifier slug into a readable label.
 * @param {string} slug
 * @returns {string}
 */
export function formatSlug(slug) {
  if (!slug) return "";
  return String(slug)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a count and noun with proper singular/plural agreement.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Preset starter templates so users can either start from scratch or load a classic/experimental dish with 1 click.
 */
const QUICK_STARTER_PRESETS = [
  {
    id: "preset_duck_orange",
    label: "French Duck Breast & Turnips",
    dish: {
      name: "Pan-Roasted Duck Breast with Glazed Turnips",
      cuisineIds: ["cuisine_french"],
      cookingMethods: ["sauteed", "roasted"],
      ingredients: [
        { ingredientId: "ing_duck_breast", role: "main_component", preparation: "sauteed", isOverride: false },
        { ingredientId: "ing_turnip_parsnip", role: "vegetable_accompaniment", preparation: "braised", isOverride: false },
        { ingredientId: "ing_shallot", role: "aromatic", preparation: "sauteed", isOverride: false }
      ],
      sauceIds: ["sauce_sherry_pan_glaze"],
      sideIds: ["side_lentilles_du_puy"]
    }
  },
  {
    id: "preset_sichuan_mapo",
    label: "Sichuan Mapo Tofu & Pork",
    dish: {
      name: "Sichuan Mala Tofu & Minced Pork",
      cuisineIds: ["cuisine_chinese_sichuan"],
      cookingMethods: ["sauteed", "braised"],
      ingredients: [
        { ingredientId: "ing_tofu_firm", role: "main_component", preparation: "braised", isOverride: false },
        { ingredientId: "ing_doubanjiang", role: "sauce_component", preparation: "sauteed", isOverride: false },
        { ingredientId: "ing_sichuan_peppercorn", role: "seasoning", preparation: "toasted", isOverride: false },
        { ingredientId: "ing_garlic", role: "aromatic", preparation: "sauteed", isOverride: false },
        { ingredientId: "ing_scallion", role: "garnish", preparation: "raw", isOverride: false }
      ],
      sauceIds: ["sauce_mala_chili_oil"],
      sideIds: ["side_smashed_cucumber_sesame"]
    }
  },
  {
    id: "preset_conflict_rescue",
    label: "Unusual Pairing Demo (Cod + Blue Cheese Rescue)",
    dish: {
      name: "Experimental Poached Cod with Blue Cheese Override",
      cuisineIds: ["cuisine_french"],
      cookingMethods: ["poached", "roasted"],
      ingredients: [
        { ingredientId: "ing_cod_halibut", role: "main_component", preparation: "poached", isOverride: false },
        { ingredientId: "ing_butter_unsalted", role: "fat", preparation: "emulsified", isOverride: false },
        {
          ingredientId: "ing_blue_cheese",
          role: "supporting_component",
          preparation: "raw",
          isOverride: true,
          overrideReason: "Deliberately selected challenging pairing to demonstrate bridge rescue recommendations"
        }
      ],
      acceptedOverrides: { ing_blue_cheese: true },
      sauceIds: [],
      sideIds: []
    }
  }
];

export class CulinaryAppController {
  /**
   * @param {Object} params
   * @param {HTMLElement} params.rootElement
   * @param {Object} params.dataset
   */
  constructor({ rootElement, dataset }) {
    this.root = rootElement;
    this.dataset = dataset;
    this.graph = new CulinaryKnowledgeGraph(dataset);
    this.engine = new CulinaryEngine(this.graph);
    this.storage = new CulinaryStorage();
    this.chefCollections = dataset.chefCollections || [];
    this.nutritionCache = dataset.nutritionCache || { ingredients: {} };
    this.builtinRecipes = (dataset.recipes || []).map((r) => normalizeRecipeRecord(r, this.graph));

    // Application state
    this.state = {
      activeTab: "home_atelier", // "home_atelier" | "dish_workbench" | "recipe_discovery" | "menu_composer" | "library_backups" | "ai_prompt_studio" | "knowledge_provenance"
      homeSpotlightIngredientId: "ing_duck_breast",
      workingDish: createDish({
        name: "Pan-Seared Salmon & Spring Greens",
        cuisineIds: ["cuisine_french"],
        cookingMethods: ["sauteed"],
        ingredients: [
          {
            ingredientId: "ing_salmon",
            fallbackName: "Salmon Fillet",
            role: "main_component",
            preparation: "sauteed",
            isOverride: false,
            addedAt: new Date().toISOString()
          }
        ]
      }),
      workingMenu: createMenu({
        name: "Seasonal Three-Course Bistro Menu",
        theme: "Acid-Balanced Coastal & Woodland Progression"
      }),
      savedDishes: [],
      savedMenus: [],
      searchQuery: "",
      searchCategoryFilter: "",
      recCategoryFilter: "",
      recRoleFilter: "",
      autocompleteOpen: false,
      autocompleteIndex: 0,
      pendingOverrideCandidate: null,
      editingMenuEntryId: null,
      aiPromptScope: "dish",
      aiCulinaryObjective: "",
      generatedPrompt: null,
      importConflictMode: "merge",
      storageStatus: {
        backendType: "initializing",
        persistentGranted: false,
        lastSavedAt: null,
        error: null
      },
      toastMessage: null,
      backupJsonText: "",
      knowledgeSearchQuery: "",
      knowledgeCategoryFilter: "",
      savedRecipes: [],
      recipeSubView: "discover",
      recipeCollectionFilter: "all",
      recipeChefFilter: "all",
      recipeCourseFilter: "all",
      recipeMatchFilter: "all",
      recipeSearchQuery: "",
      recipeUseDishIngredients: false,
      pantryIngredientIds: [],
      activeRecipeId: "rec_nyt2025_01_smashed_beef_kebab",
      recipeInstructionMode: "step_by_step",
      recipeTargetServings: null,
      recipeUnitSystem: "original",
      completedSteps: {},
      shoppingListRecipeIds: ["rec_nyt2025_01_smashed_beef_kebab", "rec_nyt2025_05_hoisin_garlic_noodles"],
      checkedShoppingItems: {},
      recipeEditorDraft: null,
      recipeImportText: "",
      activeTimer: null // { label, remainingSeconds, totalSeconds, running }
    };

    this._toastTimer = null;
    this._timerInterval = null;
  }

  async init() {
    try {
      const storageInfo = await this.storage.init();
      this.state.storageStatus.backendType = storageInfo.backendType;
      this.state.storageStatus.persistentGranted = storageInfo.persistentGranted;

      const savedWorkspace = await this.storage.loadWorkspaceState();
      const dishes = await this.storage.getAllDishes();
      const menus = await this.storage.getAllMenus();

      if (savedWorkspace?.workingDish) {
        this.state.workingDish = savedWorkspace.workingDish;
      } else if (dishes.length === 0) {
        await this.storage.saveDish(this.state.workingDish);
        this.state.workingMenu = addDishToMenu(this.state.workingMenu, this.state.workingDish, {
          courseType: "main_course"
        });
        await this.storage.saveMenu(this.state.workingMenu);
      }

      if (savedWorkspace?.workingMenu) {
        this.state.workingMenu = savedWorkspace.workingMenu;
      }

      this.state.savedDishes = await this.storage.getAllDishes();
      this.state.savedMenus = await this.storage.getAllMenus();
      this.state.savedRecipes = await this.storage.getAllRecipes();
      this.state.storageStatus.lastSavedAt = new Date().toISOString();
    } catch (err) {
      this.state.storageStatus.backendType = "memory_fallback";
      this.state.storageStatus.error = err.message;
    }

    this._bindDelegatedEvents();
    this.render();
  }

  showToast(msg) {
    this.state.toastMessage = msg;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.state.toastMessage = null;
      const toastEl = this.root.querySelector("#app-toast-banner");
      if (toastEl) toastEl.remove();
    }, 3800);
    this.render();
  }

  _startStepTimer(minutes, label) {
    const totalSeconds = Math.max(1, Math.round(Number(minutes || 1) * 60));
    this.state.activeTimer = {
      label: label || "Kitchen Timer",
      remainingSeconds: totalSeconds,
      totalSeconds,
      running: true
    };
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      if (!this.state.activeTimer || !this.state.activeTimer.running) return;
      this.state.activeTimer.remainingSeconds = Math.max(0, this.state.activeTimer.remainingSeconds - 1);
      if (this.state.activeTimer.remainingSeconds === 0) {
        this.state.activeTimer.running = false;
        clearInterval(this._timerInterval);
        this._timerInterval = null;
        this.showToast(`Timer complete: ${this.state.activeTimer.label}`);
      } else {
        this._updateTimerDom();
      }
    }, 1000);
    this._updateTimerDom();
    this.showToast(`Started ${minutes} min timer for ${label}.`);
  }

  _formatTimerMMSS(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  _updateTimerDom() {
    const slot = this.root.querySelector("#kitchen-timer-slot");
    if (!slot) return;
    const t = this.state.activeTimer;
    if (!t) {
      slot.innerHTML = "";
      return;
    }
    slot.innerHTML = `
      <span id="kitchen-timer-pill" class="timer-pill" role="timer" aria-live="off">
        <span>⏱ ${escapeHtml(t.label)}: <strong>${this._formatTimerMMSS(t.remainingSeconds)}</strong></span>
        <button type="button" class="search-clear-btn" data-action="toggle-pause-timer">${
          t.running ? "Pause" : "Resume"
        }</button>
        <button type="button" class="search-clear-btn" data-action="dismiss-timer" aria-label="Dismiss timer">×</button>
      </span>
    `;
  }

  triggerAutosave() {
    this.storage.scheduleAutosave(
      {
        workingDish: this.state.workingDish,
        workingMenu: this.state.workingMenu,
        preferences: {}
      },
      async (status) => {
        if (status.ok) {
          this.state.storageStatus.lastSavedAt = status.timestamp;
          this.state.storageStatus.error = null;
          this.state.savedDishes = await this.storage.getAllDishes();
          this.state.savedMenus = await this.storage.getAllMenus();
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this._updateStatusIndicatorDom();
        } else {
          this.state.storageStatus.error = status.error;
          this._updateStatusIndicatorDom();
        }
      },
      150
    );
  }

  _updateStatusIndicatorDom() {
    const el = this.root.querySelector("#autosave-status-pill");
    if (!el) return;
    if (this.state.storageStatus.error) {
      el.textContent = `[!] Storage Warning: ${this.state.storageStatus.error}`;
      el.className = "status-pill status-warning";
    } else {
      const timeStr = this.state.storageStatus.lastSavedAt
        ? new Date(this.state.storageStatus.lastSavedAt).toLocaleTimeString()
        : "Ready";
      el.textContent = `Autosaved (${this.state.storageStatus.backendType}) · ${timeStr}`;
      el.className = "status-pill status-ok";
    }
  }

  /**
   * Central delegated event handler so every button, input, select, and keyboard shortcut works reliably.
   */
  _bindDelegatedEvents() {
    this.root.addEventListener("click", async (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) {
        if (!e.target.closest(".search-combobox-wrap") && this.state.autocompleteOpen) {
          this.state.autocompleteOpen = false;
          this.renderSearchDropdownOnly();
        }
        return;
      }

      const action = target.dataset.action;

      switch (action) {
        case "switch-tab": {
          this.state.activeTab = target.dataset.tab;
          if (this.state.activeTab === "ai_prompt_studio") {
            this._refreshAiPrompt();
          }
          this.render();
          break;
        }

        case "dismiss-toast": {
          this.state.toastMessage = null;
          const toastEl = this.root.querySelector("#app-toast-banner");
          if (toastEl) toastEl.remove();
          break;
        }

        case "start-step-timer": {
          e.stopPropagation();
          const mins = Number(target.dataset.minutes || 5);
          const label = target.dataset.label || "Cooking Stage";
          this._startStepTimer(mins, label);
          break;
        }

        case "toggle-pause-timer": {
          if (this.state.activeTimer) {
            this.state.activeTimer.running = !this.state.activeTimer.running;
            this._updateTimerDom();
          }
          break;
        }

        case "dismiss-timer": {
          if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
          }
          this.state.activeTimer = null;
          this._updateTimerDom();
          break;
        }

        case "clear-ingredient-search": {
          this.state.searchQuery = "";
          this.state.autocompleteOpen = false;
          this.render();
          const input = this.root.querySelector("#ingredient-search-input");
          if (input) input.focus();
          break;
        }

        case "clear-recipe-search": {
          this.state.recipeSearchQuery = "";
          this.render();
          const input = this.root.querySelector("#recipe-discovery-search");
          if (input) input.focus();
          break;
        }

        case "clear-knowledge-search": {
          this.state.knowledgeSearchQuery = "";
          this.state.knowledgeCategoryFilter = "";
          this.render();
          const input = this.root.querySelector("#knowledge-catalog-search");
          if (input) input.focus();
          break;
        }

        case "set-knowledge-category": {
          const cat = target.dataset.cat || "";
          this.state.knowledgeCategoryFilter = this.state.knowledgeCategoryFilter === cat ? "" : cat;
          this.render();
          break;
        }

        case "add-catalog-ing-to-dish": {
          const ingId = target.dataset.ingId;
          const ing = this.graph.ingredients.get(ingId);
          if (ing) {
            this.state.workingDish = addIngredientToDish(this.graph, this.state.workingDish, ingId, {
              isOverride: false
            });
            this.triggerAutosave();
            this.showToast(`Added "${ing.name}" to your active Dish Workbench.`);
          }
          break;
        }

        case "reset-rec-filters": {
          this.state.recCategoryFilter = "";
          this.state.recRoleFilter = "";
          this.render();
          break;
        }

        case "clear-dish-context-chips": {
          this.state.workingDish = updateDishMetadata(this.state.workingDish, {
            cuisineIds: [],
            cookingMethods: []
          });
          this.triggerAutosave();
          this.render();
          break;
        }

        case "load-preset": {
          const presetId = target.dataset.presetId;
          const preset = QUICK_STARTER_PRESETS.find((p) => p.id === presetId);
          if (preset) {
            this.state.workingDish = createDish(structuredClone(preset.dish));
            this.state.pendingOverrideCandidate = null;
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Loaded preset: ${preset.label}`);
          }
          break;
        }

        case "new-blank-dish": {
          this.state.workingDish = createDish({
            name: "Untitled Dish",
            ingredients: [],
            sauceIds: [],
            sideIds: [],
            cuisineIds: [],
            cookingMethods: []
          });
          this.state.pendingOverrideCandidate = null;
          this.state.activeTab = "dish_workbench";
          this.triggerAutosave();
          this.showToast("Started a fresh empty dish in the Dish Workbench.");
          break;
        }

        case "select-home-spotlight-ing": {
          const ingId = target.dataset.ingId;
          if (ingId && this.graph.ingredients.has(ingId)) {
            this.state.homeSpotlightIngredientId = ingId;
            this.render();
          }
          break;
        }

        case "home-launch-spotlight-dish": {
          const anchorId = target.dataset.ingId || this.state.homeSpotlightIngredientId || "ing_duck_breast";
          const anchor = this.graph.ingredients.get(anchorId);
          if (anchor) {
            let draft = createDish({
              name: `Atelier ${anchor.name.replace(/\s*\([^)]*\)/g, "")} Composition`,
              cuisineIds: (anchor.cuisines || []).slice(0, 1),
              cookingMethods: (anchor.preparations || ["sauteed"]).slice(0, 1),
              ingredients: [
                {
                  ingredientId: anchor.id,
                  role: "main_component",
                  preparation: (anchor.preparations && anchor.preparations[0]) || "sauteed",
                  isOverride: false
                }
              ]
            });
            const evalPreview = this.engine.evaluateDish(draft, { limit: 6 });
            const previewRecList = evalPreview.ingredientRecs?.recommendations || [];
            for (const rec of previewRecList.slice(0, 3)) {
              draft = addIngredientToDish(this.graph, draft, rec.id, {
                role: rec.suggestedRole || "supporting_component",
                preparation: rec.suggestedPreparation || "raw",
                isOverride: false
              });
            }
            if (evalPreview.sauceRecs?.templates?.[0]) {
              draft = toggleDishSauce(draft, evalPreview.sauceRecs.templates[0].id);
            }
            if (evalPreview.sideRecs?.[0]) {
              draft = toggleDishSide(draft, evalPreview.sideRecs[0].id);
            }
            this.state.workingDish = draft;
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Loaded "${draft.name}" with top affinity pairings into the Dish Workbench.`);
          }
          break;
        }

        case "home-launch-pair-with-anchor": {
          const anchorId = target.dataset.anchorId || this.state.homeSpotlightIngredientId || "ing_duck_breast";
          const pairId = target.dataset.pairId;
          const anchor = this.graph.ingredients.get(anchorId);
          const pairIng = this.graph.ingredients.get(pairId);
          if (anchor && pairIng) {
            let draft = createDish({
              name: `${anchor.name.replace(/\s*\([^)]*\)/g, "")} & ${pairIng.name.replace(/\s*\([^)]*\)/g, "")}`,
              cuisineIds: (anchor.cuisines || []).slice(0, 1),
              cookingMethods: (anchor.preparations || ["sauteed"]).slice(0, 1),
              ingredients: [
                {
                  ingredientId: anchor.id,
                  role: "main_component",
                  preparation: (anchor.preparations && anchor.preparations[0]) || "sauteed",
                  isOverride: false
                }
              ]
            });
            draft = addIngredientToDish(this.graph, draft, pairIng.id, {
              role: target.dataset.role || "supporting_component",
              preparation: target.dataset.prep || "raw",
              isOverride: false
            });
            this.state.workingDish = draft;
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Paired ${anchor.name} + ${pairIng.name} in the Dish Workbench.`);
          }
          break;
        }

        case "home-open-recipe": {
          const recId = target.dataset.recipeId;
          const mode = target.dataset.mode || "step_by_step";
          if (recId) {
            this.state.activeRecipeId = recId;
            this.state.recipeInstructionMode = mode;
            this.state.recipeSubView = "discover";
            this.state.activeTab = "recipe_discovery";
            this.render();
          }
          break;
        }

        case "home-filter-collection": {
          this.state.recipeCollectionFilter = target.dataset.collection || "all";
          this.state.recipeChefFilter = target.dataset.chef || "all";
          this.state.recipeSubView = target.dataset.subview || "discover";
          this.state.activeTab = "recipe_discovery";
          this.render();
          break;
        }

        case "duplicate-working-dish": {
          const dup = duplicateDish(this.state.workingDish);
          await this.storage.saveDish(dup);
          this.state.workingDish = dup;
          this.state.savedDishes = await this.storage.getAllDishes();
          this.showToast(`Duplicated dish as "${dup.name}".`);
          break;
        }

        case "save-working-dish-explicit": {
          await this.storage.saveDish(this.state.workingDish);
          this.state.savedDishes = await this.storage.getAllDishes();
          this.state.storageStatus.lastSavedAt = new Date().toISOString();
          this.showToast(`Saved "${this.state.workingDish.name}" to local library.`);
          break;
        }

        case "select-autocomplete-item": {
          const ingId = target.dataset.ingId;
          const status = target.dataset.status;
          const warning = target.dataset.warning || "";
          this._handleSelectIngredientFromSearch(ingId, status, warning);
          break;
        }

        case "confirm-override-add": {
          const pending = this.state.pendingOverrideCandidate;
          if (pending) {
            this.state.workingDish = addIngredientToDish(
              this.graph,
              this.state.workingDish,
              pending.id,
              {
                isOverride: true,
                overrideReason: pending.warningSummary
              }
            );
            this.state.pendingOverrideCandidate = null;
            this.state.searchQuery = "";
            this.state.autocompleteOpen = false;
            this.triggerAutosave();
            this.showToast(
              `Added ${pending.name} as an intentional culinary override. Recommendations and bridges updated for the full combination.`
            );
          }
          break;
        }

        case "cancel-override-add": {
          this.state.pendingOverrideCandidate = null;
          this.render();
          break;
        }

        case "add-recommended-ingredient": {
          const ingId = target.dataset.ingId;
          const role = target.dataset.role;
          const prep = target.dataset.prep;
          this.state.workingDish = addIngredientToDish(this.graph, this.state.workingDish, ingId, {
            role,
            preparation: prep,
            isOverride: false
          });
          this.triggerAutosave();
          this.render();
          break;
        }

        case "remove-dish-ingredient": {
          const ingId = target.dataset.ingId;
          this.state.workingDish = removeIngredientFromDish(this.state.workingDish, ingId);
          this.triggerAutosave();
          this.render();
          break;
        }

        case "apply-bridge-suggestion": {
          const bridgeType = target.dataset.bridgeType;
          const candId = target.dataset.candId;
          const prep = target.dataset.prep;
          if (bridgeType === "ingredient" && candId) {
            this.state.workingDish = addIngredientToDish(this.graph, this.state.workingDish, candId, {
              role: "bridge_element"
            });
            this.showToast(`Added bridging ingredient: ${this.graph.ingredients.get(candId)?.name || candId}`);
          } else if (bridgeType === "preparation_change" && candId && prep) {
            this.state.workingDish = updateDishIngredient(this.state.workingDish, candId, {
              preparation: prep
            });
            this.showToast(`Updated preparation to '${prep}' to improve dish harmony.`);
          } else if (bridgeType === "sauce_unifier" && candId) {
            this.state.workingDish = toggleDishSauce(this.state.workingDish, candId);
            this.showToast(`Applied unifying sauce: ${this.graph.sauces.get(candId)?.name || candId}`);
          }
          this.triggerAutosave();
          this.render();
          break;
        }

        case "toggle-sauce": {
          const sauceId = target.dataset.sauceId;
          this.state.workingDish = toggleDishSauce(this.state.workingDish, sauceId);
          this.triggerAutosave();
          this.render();
          break;
        }

        case "toggle-side": {
          const sideId = target.dataset.sideId;
          this.state.workingDish = toggleDishSide(this.state.workingDish, sideId);
          this.triggerAutosave();
          this.render();
          break;
        }

        case "toggle-cuisine": {
          const cuisineId = target.dataset.cuisineId;
          const current = new Set(this.state.workingDish.cuisineIds || []);
          if (current.has(cuisineId)) current.delete(cuisineId);
          else current.add(cuisineId);
          this.state.workingDish = updateDishMetadata(this.state.workingDish, {
            cuisineIds: Array.from(current)
          });
          this.triggerAutosave();
          this.render();
          break;
        }

        case "toggle-cooking-method": {
          const method = target.dataset.method;
          const current = new Set(this.state.workingDish.cookingMethods || []);
          if (current.has(method)) current.delete(method);
          else current.add(method);
          this.state.workingDish = updateDishMetadata(this.state.workingDish, {
            cookingMethods: Array.from(current)
          });
          this.triggerAutosave();
          this.render();
          break;
        }

        case "add-working-dish-to-menu": {
          const courseSelect = this.root.querySelector("#quick-add-course-type");
          const courseType = courseSelect ? courseSelect.value : this.state.workingDish.courseRole || "main_course";
          await this.storage.saveDish(this.state.workingDish);
          this.state.workingMenu = addDishToMenu(this.state.workingMenu, this.state.workingDish, {
            courseType
          });
          await this.storage.saveMenu(this.state.workingMenu);
          this.state.savedDishes = await this.storage.getAllDishes();
          this.state.savedMenus = await this.storage.getAllMenus();
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this.triggerAutosave();
          this.showToast(
            `Added snapshot of "${this.state.workingDish.name}" to menu "${this.state.workingMenu.name}".`
          );
          break;
        }

        // Menu actions
        case "new-blank-menu": {
          this.state.workingMenu = createMenu({
            name: "New Multi-Course Menu",
            theme: "",
            items: []
          });
          this.triggerAutosave();
          this.showToast("Created new blank menu.");
          break;
        }

        case "duplicate-working-menu": {
          const dup = duplicateMenu(this.state.workingMenu);
          await this.storage.saveMenu(dup);
          this.state.workingMenu = dup;
          this.state.savedMenus = await this.storage.getAllMenus();
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this.showToast(`Duplicated menu as "${dup.name}".`);
          break;
        }

        case "add-saved-dish-to-menu": {
          const dishId = target.dataset.dishId;
          const courseSelect = this.root.querySelector(`#course-select-for-${dishId}`);
          const courseType = courseSelect ? courseSelect.value : "main_course";
          const found = this.state.savedDishes.find((d) => d.id === dishId);
          if (found) {
            this.state.workingMenu = addDishToMenu(this.state.workingMenu, found, { courseType });
            this.triggerAutosave();
            this.showToast(`Added isolated snapshot of "${found.name}" to menu.`);
          }
          break;
        }

        case "move-menu-course": {
          const entryId = target.dataset.entryId;
          const dir = Number(target.dataset.dir);
          const idx = this.state.workingMenu.items.findIndex((i) => i.entryId === entryId);
          if (idx !== -1) {
            this.state.workingMenu = reorderMenuCourse(this.state.workingMenu, entryId, idx + dir);
            this.triggerAutosave();
            this.render();
          }
          break;
        }

        case "remove-menu-course": {
          const entryId = target.dataset.entryId;
          this.state.workingMenu = removeDishFromMenu(this.state.workingMenu, entryId);
          this.triggerAutosave();
          this.render();
          break;
        }

        case "edit-menu-course-in-workbench": {
          const entryId = target.dataset.entryId;
          const entry = this.state.workingMenu.items.find((i) => i.entryId === entryId);
          if (entry) {
            this.state.workingDish = createDish(structuredClone(entry.dishSnapshot));
            this.state.editingMenuEntryId = entryId;
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Loaded course "${this.state.workingDish.name}" into Dish Workbench. Click "Update Course Snapshot in Menu" when done.`);
          }
          break;
        }

        case "update-edited-menu-course": {
          const entryId = this.state.editingMenuEntryId;
          if (entryId && this.state.workingMenu.items.some((i) => i.entryId === entryId)) {
            this.state.workingMenu = updateMenuCourseEntry(this.state.workingMenu, entryId, {
              dishSnapshot: this.state.workingDish
            });
            await this.storage.saveMenu(this.state.workingMenu);
            this.state.savedMenus = await this.storage.getAllMenus();
            this.state.savedRecipes = await this.storage.getAllRecipes();
            this.triggerAutosave();
            this.showToast(`Updated course snapshot "${this.state.workingDish.name}" in menu "${this.state.workingMenu.name}".`);
          }
          break;
        }

        // Library & Backup actions
        case "open-saved-dish": {
          const dishId = target.dataset.dishId;
          const found = this.state.savedDishes.find((d) => d.id === dishId);
          if (found) {
            this.state.workingDish = createDish(structuredClone(found));
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Reopened "${found.name}".`);
          }
          break;
        }

        case "delete-saved-dish": {
          const dishId = target.dataset.dishId;
          await this.storage.deleteDish(dishId);
          this.state.savedDishes = await this.storage.getAllDishes();
          this.showToast("Deleted dish from saved library.");
          break;
        }

        case "open-saved-menu": {
          const menuId = target.dataset.menuId;
          const found = this.state.savedMenus.find((m) => m.id === menuId);
          if (found) {
            this.state.workingMenu = createMenu(structuredClone(found));
            this.state.activeTab = "menu_composer";
            this.triggerAutosave();
            this.showToast(`Reopened menu "${found.name}".`);
          }
          break;
        }

        case "delete-saved-menu": {
          const menuId = target.dataset.menuId;
          await this.storage.deleteMenu(menuId);
          this.state.savedMenus = await this.storage.getAllMenus();
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this.showToast("Deleted menu from saved library.");
          break;
        }

        case "export-json-backup": {
          await this.storage.saveWorkspaceState({ workingDish: this.state.workingDish, workingMenu: this.state.workingMenu, preferences: {} });
          await this.storage.saveDish(this.state.workingDish);
          await this.storage.saveMenu(this.state.workingMenu);
          const jsonStr = await this.storage.exportBackupJson(this.graph);
          this.state.backupJsonText = jsonStr;
          const textarea = this.root.querySelector("#backup-json-textarea");
          if (textarea) textarea.value = jsonStr;
          try {
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `culinary-intelligence-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch {
            // In restricted sandboxes where download links are blocked, textarea holds the full JSON
          }
          this.showToast("Exported structured JSON backup.");
          break;
        }

        case "import-json-backup": {
          const textarea = this.root.querySelector("#backup-json-textarea");
          const rawJson = (textarea && textarea.value) ? textarea.value : (this.state.backupJsonText || "");
          try {
            const res = await this.storage.importBackupJson(rawJson, {
              conflictMode: this.state.importConflictMode
            });
            this.state.savedDishes = await this.storage.getAllDishes();
            this.state.savedMenus = await this.storage.getAllMenus();
            this.state.savedRecipes = await this.storage.getAllRecipes();
            const importedWorkspace = await this.storage.loadWorkspaceState();
            if (importedWorkspace?.workingDish) {
              this.state.workingDish = importedWorkspace.workingDish;
            } else if (this.state.savedDishes.length > 0) {
              this.state.workingDish = this.state.savedDishes[0];
            }
            if (this.state.savedMenus.length > 0) {
              this.state.workingMenu = this.state.savedMenus[0];
            }
            this.showToast(
              `Imported ${res.importedDishes} dish(es) and ${res.importedMenus} menu(s) (${res.migratedLegacyRecords} migrated).`
            );
          } catch (err) {
            this.showToast(err.message);
          }
          break;
        }

        // Phase 2 Recipe Studio actions
        case "discover-recipes-from-dish": {
          this.state.pantryIngredientIds = (this.state.workingDish.ingredients || []).map((i) => i.ingredientId);
          this.state.recipeUseDishIngredients = true;
          this.state.recipeSubView = "discover";
          this.state.activeTab = "recipe_discovery";
          this.render();
          this.showToast(`Filtering recipes by your ${this.state.pantryIngredientIds.length} active Dish Workbench ingredient(s).`);
          break;
        }

        case "convert-working-dish-to-recipe": {
          const draft = convertDishToRecipeDraft(this.graph, this.state.workingDish);
          await this.storage.saveRecipe(draft);
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this.state.activeRecipeId = draft.id;
          this.state.recipeSubView = "discover";
          this.state.activeTab = "recipe_discovery";
          this.render();
          this.showToast(`Saved "${draft.title}" as a structured recipe with Cooking for Engineers process diagram.`);
          break;
        }

        case "set-recipe-subview": {
          this.state.recipeSubView = target.dataset.subview || "discover";
          this.render();
          break;
        }

        case "select-recipe-card": {
          this.state.activeRecipeId = target.dataset.recipeId;
          this.state.recipeTargetServings = null;
          this.state.recipeSubView = "discover";
          this.render();
          break;
        }

        case "select-chef-collection": {
          this.state.recipeChefFilter = target.dataset.chefId || "all";
          this.state.recipeCollectionFilter = "all";
          this.state.recipeSubView = "discover";
          const matching = this.getAllAvailableRecipes().find((r) => r.chefId === this.state.recipeChefFilter);
          if (matching) this.state.activeRecipeId = matching.id;
          this.render();
          break;
        }

        case "toggle-recipe-use-dish-ings": {
          this.state.recipeUseDishIngredients = !this.state.recipeUseDishIngredients;
          if (this.state.recipeUseDishIngredients) {
            this.state.pantryIngredientIds = (this.state.workingDish.ingredients || []).map((i) => i.ingredientId);
          } else {
            this.state.pantryIngredientIds = [];
          }
          this.render();
          break;
        }

        case "set-recipe-instruction-mode": {
          this.state.recipeInstructionMode = target.dataset.mode || "step_by_step";
          this.render();
          break;
        }

        case "set-recipe-unit-system": {
          this.state.recipeUnitSystem = target.dataset.unitSystem || "original";
          this.render();
          break;
        }

        case "scale-recipe-servings": {
          const mult = Number(target.dataset.mult || 1);
          const activeRec = this.getActiveRecipe();
          const base = activeRec ? Number(activeRec.servings || 4) : 4;
          this.state.recipeTargetServings = Math.max(1, Math.round(base * mult));
          this.render();
          break;
        }

        case "toggle-recipe-step-done": {
          const key = target.dataset.stepKey;
          if (key) {
            this.state.completedSteps[key] = !this.state.completedSteps[key];
            this.render();
          }
          break;
        }

        case "reset-recipe-steps": {
          const rec = this.getActiveRecipe();
          if (rec) {
            for (const k of Object.keys(this.state.completedSteps)) {
              if (k.startsWith(`${rec.id}::`)) {
                delete this.state.completedSteps[k];
              }
            }
            this.render();
          }
          break;
        }

        case "load-recipe-into-workbench": {
          const explicitId = target.dataset.recipeId;
          const rec = explicitId
            ? this.getAllAvailableRecipes().find((r) => r.id === explicitId)
            : this.getActiveRecipe();
          if (rec) {
            this.state.workingDish = convertRecipeToDish(this.graph, rec);
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Loaded "${rec.title}" into Dish Workbench for flavor & pairing analysis.`);
          }
          break;
        }

        case "merge-recipe-into-workbench": {
          const rec = this.getActiveRecipe();
          if (rec) {
            for (const ing of rec.ingredients || []) {
              if (ing.ingredientId) {
                this.state.workingDish = addIngredientToDish(this.graph, this.state.workingDish, ing.ingredientId, {
                  role: ing.role || "supporting_component",
                  preparation: ing.preparation || "cooked_default",
                  isOverride: false
                });
              }
            }
            this.state.activeTab = "dish_workbench";
            this.triggerAutosave();
            this.showToast(`Merged canonical ingredients from "${rec.title}" into your Working Dish.`);
          }
          break;
        }

        case "add-recipe-to-menu": {
          const rec = this.getActiveRecipe();
          if (rec) {
            const dishSnap = convertRecipeToDish(this.graph, rec);
            await this.storage.saveDish(dishSnap);
            this.state.workingMenu = addDishToMenu(this.state.workingMenu, dishSnap, {
              courseType: dishSnap.courseRole || "main_course"
            });
            await this.storage.saveMenu(this.state.workingMenu);
            this.state.savedDishes = await this.storage.getAllDishes();
            this.state.savedMenus = await this.storage.getAllMenus();
            this.triggerAutosave();
            this.showToast(`Added "${rec.title}" as a course in menu "${this.state.workingMenu.name}".`);
          }
          break;
        }

        case "add-recipe-to-shopping-list": {
          const rec = this.getActiveRecipe();
          if (rec) {
            if (!this.state.shoppingListRecipeIds.includes(rec.id)) {
              this.state.shoppingListRecipeIds.push(rec.id);
            }
            this.state.recipeSubView = "shopping";
            this.render();
            this.showToast(`Added "${rec.title}" to Shopping List Aggregator.`);
          }
          break;
        }

        case "remove-recipe-from-shopping-list": {
          const rId = target.dataset.recipeId;
          this.state.shoppingListRecipeIds = this.state.shoppingListRecipeIds.filter((id) => id !== rId);
          this.render();
          break;
        }

        case "toggle-shopping-item-checked": {
          const itemKey = target.dataset.itemKey;
          if (itemKey) {
            this.state.checkedShoppingItems[itemKey] = !this.state.checkedShoppingItems[itemKey];
            this.render();
          }
          break;
        }

        case "clear-checked-shopping-items": {
          this.state.checkedShoppingItems = {};
          this.render();
          break;
        }

        case "copy-shopping-list": {
          const all = this.getAllAvailableRecipes();
          const selectedRecipes = this.state.shoppingListRecipeIds
            .map((id) => all.find((r) => r.id === id))
            .filter(Boolean);
          const aggregated = aggregateShoppingList(selectedRecipes, this.graph, this.nutritionCache);
          const lines = [
            `# Consolidated Grocery List (${selectedRecipes.map((r) => r.title).join(", ")})`,
            `Total Unique Items: ${aggregated.totalUniqueIngredients} · Est. Weight: ${aggregated.totalWeightGrams}g`,
            ""
          ];
          for (const aisle of aggregated.aisles) {
            lines.push(`## ${aisle.aisle}`);
            for (const item of aisle.items) {
              const mark = this.state.checkedShoppingItems[item.key] ? "[x]" : "[ ]";
              lines.push(`- ${mark} ${item.name} — ${item.formattedAmount} (for: ${item.usedInRecipes.join(", ")})`);
            }
            lines.push("");
          }
          const text = lines.join("\n");
          let copied = false;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              copied = true;
            }
          } catch {
            copied = false;
          }
          this.showToast(copied ? "Copied formatted grocery list to clipboard." : "Prepared grocery list for copy.");
          break;
        }

        case "print-kitchen-sheet": {
          try {
            window.print();
          } catch {
            // Ignored if sandbox blocks print dialog
          }
          break;
        }

        case "duplicate-personalize-recipe": {
          const rec = this.getActiveRecipe();
          if (rec) {
            const copy = normalizeRecipeRecord(
              {
                ...structuredClone(rec),
                id: `rec_custom_${Date.now()}`,
                title: `${rec.title} (Personalized)`,
                collectionId: "user_custom",
                isCustom: true
              },
              this.graph
            );
            await this.storage.saveRecipe(copy);
            this.state.savedRecipes = await this.storage.getAllRecipes();
            this.state.activeRecipeId = copy.id;
            this.state.recipeEditorDraft = structuredClone(copy);
            this.state.recipeSubView = "editor";
            this.render();
            this.showToast(`Created personalized local copy of "${rec.title}".`);
          }
          break;
        }

        case "save-custom-recipe-editor": {
          const titleEl = this.root.querySelector("#recipe-editor-title");
          const authorEl = this.root.querySelector("#recipe-editor-author");
          const servingsEl = this.root.querySelector("#recipe-editor-servings");
          const prepEl = this.root.querySelector("#recipe-editor-prep");
          const cookEl = this.root.querySelector("#recipe-editor-cook");
          const headnoteEl = this.root.querySelector("#recipe-editor-headnote");
          const ingsEl = this.root.querySelector("#recipe-editor-ingredients");
          const stepsEl = this.root.querySelector("#recipe-editor-steps");

          const draftId = this.state.recipeEditorDraft?.id || `rec_custom_${Date.now()}`;
          const ingLines = (ingsEl ? ingsEl.value : "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const stepLines = (stepsEl ? stepsEl.value : "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

          const saved = normalizeRecipeRecord(
            {
              id: draftId,
              title: titleEl?.value || "Custom Kitchen Recipe",
              author: authorEl?.value || "Personal Kitchen",
              servings: Number(servingsEl?.value || 4),
              prepTimeMinutes: Number(prepEl?.value || 15),
              cookTimeMinutes: Number(cookEl?.value || 20),
              headnote: headnoteEl?.value || "",
              collectionId: "user_custom",
              isCustom: true,
              ingredients: ingLines.length > 0 ? ingLines : ["2 tbsp olive oil", "2 cloves garlic, minced"],
              steps: stepLines.length > 0 ? stepLines : ["Prepare and cook ingredients until tender."]
            },
            this.graph
          );

          await this.storage.saveRecipe(saved);
          this.state.savedRecipes = await this.storage.getAllRecipes();
          this.state.activeRecipeId = saved.id;
          this.state.recipeSubView = "discover";
          this.render();
          this.showToast(`Saved "${saved.title}" with auto-generated Cooking for Engineers process matrix.`);
          break;
        }

        case "import-recipes-bulk": {
          const ta = this.root.querySelector("#recipe-bulk-import-textarea");
          const raw = ta ? ta.value : this.state.recipeImportText;
          try {
            const importedList = parseRecipeImportPayload(raw, this.graph);
            for (const rec of importedList) {
              await this.storage.saveRecipe(rec);
            }
            this.state.savedRecipes = await this.storage.getAllRecipes();
            if (importedList[0]) {
              this.state.activeRecipeId = importedList[0].id;
            }
            this.state.recipeSubView = "discover";
            this.render();
            this.showToast(`Imported ${importedList.length} recipe(s) into your local collection.`);
          } catch (err) {
            this.showToast(err.message);
          }
          break;
        }

        case "delete-saved-recipe": {
          const rId = target.dataset.recipeId;
          await this.storage.deleteRecipe(rId);
          this.state.savedRecipes = await this.storage.getAllRecipes();
          if (this.state.activeRecipeId === rId) {
            this.state.activeRecipeId = this.builtinRecipes[0]?.id || "";
          }
          this.render();
          this.showToast("Deleted custom recipe from local storage.");
          break;
        }

        case "set-ai-scope": {
          this.state.aiPromptScope = target.dataset.scope;
          this._refreshAiPrompt();
          this.render();
          break;
        }

        case "generate-ai-prompt": {
          this._refreshAiPrompt();
          this.showToast("Generated structured external AI prompt from current state.");
          break;
        }

        case "copy-ai-prompt": {
          this._refreshAiPrompt();
          const text = this.state.generatedPrompt?.promptText || "";
          let copied = false;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              copied = true;
            }
          } catch {
            copied = false;
          }
          if (!copied) {
            const ta = this.root.querySelector("#ai-prompt-output-textarea");
            if (ta) {
              ta.select();
              try {
                document.execCommand("copy");
                copied = true;
              } catch {
                copied = false;
              }
            }
          }
          this.showToast(
            copied
              ? "Copied prompt to clipboard for use in ChatGPT, Claude, Gemini, or any external assistant."
              : "Selected prompt text — press Ctrl+C / Cmd+C to copy."
          );
          break;
        }
      }
    });

    // Delegated input & change handlers
    this.root.addEventListener("input", (e) => {
      const target = e.target;
      if (target.id === "ingredient-search-input") {
        this.state.searchQuery = target.value;
        this.state.autocompleteOpen = true;
        this.state.autocompleteIndex = 0;
        this.renderSearchDropdownOnly();
      } else if (target.id === "dish-name-input") {
        this.state.workingDish = updateDishMetadata(this.state.workingDish, { name: target.value });
        this.triggerAutosave();
      } else if (target.id === "dish-notes-input") {
        this.state.workingDish = updateDishMetadata(this.state.workingDish, { notes: target.value });
        this.triggerAutosave();
      } else if (target.id === "menu-name-input") {
        this.state.workingMenu.name = target.value;
        this.state.workingMenu.updatedAt = new Date().toISOString();
        this.triggerAutosave();
      } else if (target.id === "menu-theme-input") {
        this.state.workingMenu.theme = target.value;
        this.state.workingMenu.updatedAt = new Date().toISOString();
        this.triggerAutosave();
      } else if (target.id === "menu-notes-input") {
        this.state.workingMenu.notes = target.value;
        this.state.workingMenu.updatedAt = new Date().toISOString();
        this.triggerAutosave();
      } else if (target.id === "ai-objective-input") {
        this.state.aiCulinaryObjective = target.value;
        this._refreshAiPrompt();
        const ta = this.root.querySelector("#ai-prompt-output-textarea");
        if (ta && this.state.generatedPrompt) {
          ta.value = this.state.generatedPrompt.promptText;
        }
      } else if (target.id === "backup-json-textarea") {
        this.state.backupJsonText = target.value;
      } else if (target.dataset.action === "edit-menu-custom-course-label") {
        const entryId = target.dataset.entryId;
        this.state.workingMenu = updateMenuCourseEntry(this.state.workingMenu, entryId, {
          customCourseLabel: target.value
        });
        this.triggerAutosave();
      } else if (target.id === "knowledge-catalog-search") {
        this.state.knowledgeSearchQuery = target.value;
        this.renderKnowledgeCatalogListOnly();
      } else if (target.id === "recipe-discovery-search") {
        this.state.recipeSearchQuery = target.value;
        this.renderRecipeListOnly();
      } else if (target.id === "recipe-bulk-import-textarea") {
        this.state.recipeImportText = target.value;
      }
    });

    this.root.addEventListener("change", async (e) => {
      const target = e.target;
      if (target.dataset.action === "change-ingredient-role") {
        const ingId = target.dataset.ingId;
        this.state.workingDish = updateDishIngredient(this.state.workingDish, ingId, {
          role: target.value
        });
        this.triggerAutosave();
        this.render();
      } else if (target.dataset.action === "change-ingredient-prep") {
        const ingId = target.dataset.ingId;
        this.state.workingDish = updateDishIngredient(this.state.workingDish, ingId, {
          preparation: target.value
        });
        this.triggerAutosave();
        this.render();
      } else if (target.id === "rec-category-filter") {
        this.state.recCategoryFilter = target.value;
        this.render();
      } else if (target.id === "rec-role-filter") {
        this.state.recRoleFilter = target.value;
        this.render();
      } else if (target.id === "dish-course-role-select") {
        this.state.workingDish = updateDishMetadata(this.state.workingDish, {
          courseRole: target.value
        });
        this.triggerAutosave();
      } else if (target.dataset.action === "change-menu-course-type") {
        const entryId = target.dataset.entryId;
        this.state.workingMenu = updateMenuCourseEntry(this.state.workingMenu, entryId, {
          courseType: target.value
        });
        this.triggerAutosave();
        this.render();
      } else if (target.id === "recipe-collection-filter") {
        this.state.recipeCollectionFilter = target.value;
        this.render();
      } else if (target.id === "recipe-chef-filter") {
        this.state.recipeChefFilter = target.value;
        this.render();
      } else if (target.id === "recipe-course-filter") {
        this.state.recipeCourseFilter = target.value;
        this.render();
      } else if (target.id === "recipe-match-filter") {
        this.state.recipeMatchFilter = target.value;
        this.render();
      } else if (target.id === "import-conflict-mode-select") {
        this.state.importConflictMode = target.value;
      } else if (target.id === "backup-file-input" && target.files?.[0]) {
        const file = target.files[0];
        const text = await file.text();
        const ta = this.root.querySelector("#backup-json-textarea");
        if (ta) ta.value = text;
        this.showToast(`Loaded file "${file.name}" into backup editor. Click 'Validate & Import JSON' to apply.`);
      }
    });

    // Global "/" shortcut to focus active tab's search bar + combobox keyboard navigation
    document.addEventListener("keydown", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isInputFocused = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (e.key === "/" && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const searchEl =
          this.root.querySelector("#ingredient-search-input") ||
          this.root.querySelector("#recipe-discovery-search") ||
          this.root.querySelector("#knowledge-catalog-search");
        if (searchEl) {
          e.preventDefault();
          searchEl.focus();
          searchEl.select();
        }
      }
    });

    this.root.addEventListener("keydown", (e) => {
      if (e.target.id !== "ingredient-search-input") return;
      const results = this.engine.searchIngredients(this.state.searchQuery, this.state.workingDish, {
        limit: 12
      });
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.state.autocompleteOpen = true;
        this.state.autocompleteIndex = Math.min(
          Math.max(0, results.length - 1),
          this.state.autocompleteIndex + 1
        );
        this.renderSearchDropdownOnly();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.state.autocompleteIndex = Math.max(0, this.state.autocompleteIndex - 1);
        this.renderSearchDropdownOnly();
      } else if (e.key === "Escape") {
        this.state.autocompleteOpen = false;
        this.renderSearchDropdownOnly();
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        const chosen = results[this.state.autocompleteIndex] || results[0];
        if (chosen) {
          this._handleSelectIngredientFromSearch(
            chosen.id,
            chosen.contextStatus,
            chosen.warningSummary || ""
          );
        }
      }
    });

    this.root.addEventListener("focusin", (e) => {
      if (e.target.id === "ingredient-search-input") {
        this.state.autocompleteOpen = true;
        this.renderSearchDropdownOnly();
      }
    });
  }

  _handleSelectIngredientFromSearch(ingId, contextStatus, warningSummary) {
    if (!ingId) return;
    const ing = this.graph.ingredients.get(ingId);
    if (!ing) return;

    if (contextStatus === "already_selected") {
      this.showToast(`${ing.name} is already in your active dish.`);
      return;
    }

    if (contextStatus === "pairing_concern") {
      this.state.pendingOverrideCandidate = {
        id: ing.id,
        name: ing.name,
        warningSummary:
          warningSummary ||
          `Pairing concern detected between ${ing.name} and your current selections.`
      };
      this.state.autocompleteOpen = false;
      this.render();
      return;
    }

    this.state.workingDish = addIngredientToDish(this.graph, this.state.workingDish, ingId, {
      isOverride: false
    });
    this.state.pendingOverrideCandidate = null;
    this.state.searchQuery = "";
    this.state.autocompleteOpen = false;
    this.triggerAutosave();
    this.render();
  }

  _refreshAiPrompt() {
    this.state.generatedPrompt = generateExternalAiPrompt(this.graph, {
      scope: this.state.aiPromptScope,
      dish: this.state.workingDish,
      menu: this.state.workingMenu,
      culinaryObjective: this.state.aiCulinaryObjective
    });
  }

  /**
   * Updates only the autocomplete dropdown container so typing in the search input never loses cursor focus.
   */
  renderSearchDropdownOnly() {
    const container = this.root.querySelector("#autocomplete-dropdown-slot");
    const input = this.root.querySelector("#ingredient-search-input");
    if (!container) return;
    if (input) {
      input.setAttribute("aria-expanded", String(Boolean(this.state.autocompleteOpen)));
    }
    container.innerHTML = this._buildAutocompleteDropdownHtml();
  }

  _buildAutocompleteDropdownHtml() {
    if (!this.state.autocompleteOpen) return "";
    const results = this.engine.searchIngredients(this.state.searchQuery, this.state.workingDish, {
      limit: 12
    });

    if (results.length === 0) {
      return `
        <div class="autocomplete-popover" role="listbox" aria-label="Ingredient suggestions">
          <div class="empty-state-compact">
            No matching ingredient found for "${escapeHtml(this.state.searchQuery)}". Try a broader term or alias (e.g., "lemon", "shoyu", "ribeye", "chanterelle").
          </div>
        </div>
      `;
    }

    return `
      <div class="autocomplete-popover" role="listbox" aria-label="Ingredient suggestions">
        ${results
          .map((item, idx) => {
            const isFocused = idx === this.state.autocompleteIndex;
            let badgeHtml = "";
            if (item.contextStatus === "recommended") {
              badgeHtml = `<span class="badge badge-strong">[+] Recommended (${item.compatibilityScore})</span>`;
            } else if (item.contextStatus === "pairing_concern") {
              badgeHtml = `<span class="badge badge-warning">[!] Challenging — Override Available</span>`;
            } else if (item.contextStatus === "already_selected") {
              badgeHtml = `<span class="badge badge-neutral">[✓] In Dish</span>`;
            } else {
              badgeHtml = `<span class="badge badge-neutral">[·] Available (${item.compatibilityScore})</span>`;
            }

            return `
              <div
                id="ac-opt-${escapeHtml(item.id)}"
                role="option"
                aria-selected="${isFocused}"
                class="autocomplete-option ${isFocused ? "ac-focused" : ""} ac-status-${escapeHtml(item.contextStatus)}"
                data-action="select-autocomplete-item"
                data-ing-id="${escapeHtml(item.id)}"
                data-status="${escapeHtml(item.contextStatus)}"
                data-warning="${escapeHtml(item.warningSummary || "")}"
              >
                <div class="ac-row-top">
                  <strong>${escapeHtml(item.name)}</strong>
                  ${badgeHtml}
                </div>
                <div class="ac-row-meta">
                  <span>Categories: ${escapeHtml(item.categories.map(formatSlug).join(", "))}</span>
                  <span>·</span>
                  <span>${escapeHtml(item.primaryReason)}</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  /**
   * Renders the complete application while preserving scroll positions on `[data-preserve-scroll]` containers
   * and restoring active input focus and selection ranges.
   */
  render() {
    const scrollMap = new Map();
    for (const el of this.root.querySelectorAll("[data-preserve-scroll]")) {
      const key = el.getAttribute("data-preserve-scroll");
      if (key) {
        scrollMap.set(key, { top: el.scrollTop, left: el.scrollLeft });
      }
    }

    let focusedElementSelector = null;
    let selStart = null;
    let selEnd = null;
    const active = document.activeElement;
    if (active && this.root.contains(active)) {
      if (active.id) {
        focusedElementSelector = `#${active.id}`;
      } else if (active.getAttribute("data-action")) {
        const action = active.getAttribute("data-action");
        const entryId = active.getAttribute("data-entry-id");
        const ingId = active.getAttribute("data-ing-id");
        if (entryId) {
          focusedElementSelector = `[data-action="${action}"][data-entry-id="${entryId}"]`;
        } else if (ingId) {
          focusedElementSelector = `[data-action="${action}"][data-ing-id="${ingId}"]`;
        } else {
          focusedElementSelector = `[data-action="${action}"]`;
        }
      }
      if (typeof active.selectionStart === "number") {
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
      }
    }

    const evalState = this.engine.evaluateDish(this.state.workingDish, {
      categoryFilter: this.state.recCategoryFilter,
      roleFilter: this.state.recRoleFilter,
      limit: 18
    });

    const ingCount = this.state.workingDish.ingredients.length;
    const recCount = this.getAllAvailableRecipes().length;
    const courseCount = this.state.workingMenu.items.length;

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <div class="header-brand">
            <h1 class="app-title">Culinary Intelligence &amp; Menu Composition Workbench</h1>
            <p class="app-subtitle">
              Deterministic Multi-Ingredient Pairing · Explainable Flavor Balance · Bridge Rescue · Recipe &amp; Menu Architecture
            </p>
          </div>
          <div class="header-status">
            <span id="kitchen-timer-slot"></span>
            <span id="autosave-status-pill" class="status-pill ${
              this.state.storageStatus.error ? "status-warning" : "status-ok"
            }">
              ${
                this.state.storageStatus.error
                  ? `[!] Storage Warning: ${escapeHtml(this.state.storageStatus.error)}`
                  : `Autosaved (${escapeHtml(this.state.storageStatus.backendType)})`
              }
            </span>
          </div>
        </header>

        <div id="toast-mount-slot">
          ${
            this.state.toastMessage
              ? `<div id="app-toast-banner" class="toast-banner" role="status" aria-live="polite">
                  <span>${escapeHtml(this.state.toastMessage)}</span>
                  <button type="button" class="search-clear-btn" data-action="dismiss-toast" aria-label="Dismiss notification">×</button>
                </div>`
              : ""
          }
        </div>

        <nav class="app-tabs" aria-label="Primary Workspace Sections">
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "home_atelier" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="home_atelier"
          >
            <span>Atelier Home</span>
            <span class="tab-count-pill">Start</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "dish_workbench" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="dish_workbench"
          >
            <span>1. Dish Workbench</span>
            <span class="tab-count-pill">${pluralize(ingCount, "Ingredient")}</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "recipe_discovery" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="recipe_discovery"
          >
            <span>2. Recipe Studio</span>
            <span class="tab-count-pill">${pluralize(recCount, "Recipe")}</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "menu_composer" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="menu_composer"
          >
            <span>3. Menu Builder</span>
            <span class="tab-count-pill">${pluralize(courseCount, "Course")}</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "library_backups" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="library_backups"
          >
            <span>4. Library &amp; Backups</span>
            <span class="tab-count-pill">${this.state.savedDishes.length}D · ${this.state.savedMenus.length}M</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "ai_prompt_studio" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="ai_prompt_studio"
          >
            <span>5. AI Prompt Studio</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.state.activeTab === "knowledge_provenance" ? "tab-active" : ""}"
            data-action="switch-tab"
            data-tab="knowledge_provenance"
          >
            <span>6. Knowledge &amp; Provenance</span>
            <span class="tab-count-pill">${this.graph.ingredients.size}</span>
          </button>
        </nav>

        <main class="app-main">
          ${this._renderActiveTabContent(evalState)}
        </main>
      </div>
    `;

    this._updateTimerDom();

    for (const [key, pos] of scrollMap.entries()) {
      const restoredEl = this.root.querySelector(`[data-preserve-scroll="${key}"]`);
      if (restoredEl) {
        restoredEl.scrollTop = pos.top;
        restoredEl.scrollLeft = pos.left;
      }
    }

    if (focusedElementSelector) {
      const elToFocus = this.root.querySelector(focusedElementSelector);
      if (elToFocus) {
        elToFocus.focus();
        if (selStart !== null && typeof elToFocus.setSelectionRange === "function") {
          try {
            elToFocus.setSelectionRange(selStart, selEnd);
          } catch {
            // ignore if unsupported
          }
        }
      }
    }
  }

  _renderActiveTabContent(evalState) {
    switch (this.state.activeTab) {
      case "home_atelier":
        return this._renderHomeAtelier();
      case "dish_workbench":
        return this._renderDishWorkbench(evalState);
      case "recipe_discovery":
        return this._renderRecipeDiscoveryStudio();
      case "menu_composer":
        return this._renderMenuComposer();
      case "library_backups":
        return this._renderLibraryAndBackups();
      case "ai_prompt_studio":
        return this._renderAiPromptStudio();
      case "knowledge_provenance":
        return this._renderKnowledgeAndProvenance();
      default:
        return this._renderDishWorkbench(evalState);
    }
  }

  _renderHomeAtelier() {
    const spotlightId = this.state.homeSpotlightIngredientId || "ing_duck_breast";
    const spotlightIng =
      this.graph.ingredients.get(spotlightId) ||
      this.graph.ingredients.get("ing_duck_breast") ||
      Array.from(this.graph.ingredients.values())[0];

    const spotlightDish = createDish({
      name: `${spotlightIng.name} Study`,
      cuisineIds: (spotlightIng.cuisines || []).slice(0, 1),
      cookingMethods: (spotlightIng.preparations || ["sauteed"]).slice(0, 1),
      ingredients: [
        {
          ingredientId: spotlightIng.id,
          role: "main_component",
          preparation: (spotlightIng.preparations && spotlightIng.preparations[0]) || "sauteed",
          isOverride: false
        }
      ]
    });

    const spotlightEval = this.engine.evaluateDish(spotlightDish, { limit: 5 });
    const topRecs = (spotlightEval.ingredientRecs?.recommendations || []).slice(0, 5);
    const topSauce = spotlightEval.sauceRecs?.templates?.[0] || null;
    const topSide = spotlightEval.sideRecs?.[0] || null;

    const samplerAnchors = [
      { id: "ing_duck_breast", label: "Duck Breast" },
      { id: "ing_salmon", label: "Salmon Fillet" },
      { id: "ing_scallop_sea", label: "Sea Scallops" },
      { id: "ing_miso_white", label: "White Miso" },
      { id: "ing_sichuan_peppercorn", label: "Sichuan Peppercorn" },
      { id: "ing_cod_halibut", label: "Cod / Halibut" },
      { id: "ing_mushroom_chanterelle", label: "Wild Mushrooms" },
      { id: "ing_lamb_rack_loin", label: "Lamb Rack" },
      { id: "ing_cacao_dark", label: "Dark Chocolate (70%+)" }
    ].filter((a) => this.graph.ingredients.has(a.id));

    const featuredRecipes = [
      this.builtinRecipes.find((r) => r.id === "rec_chef_kenji_crispy_roast_potatoes"),
      this.builtinRecipes.find((r) => r.id === "rec_chef_samin_buttermilk_roast_chicken"),
      this.builtinRecipes.find((r) => r.id === "rec_chef_keller_butter_poached_lobster")
    ].filter(Boolean);

    const nytHeroRecipe =
      this.builtinRecipes.find((r) => r.id === "rec_nyt2025_01_smashed_beef_kebab") ||
      this.builtinRecipes[0];

    const fp = spotlightIng.flavorProfile || {};
    const sensoryAxes = [
      { key: "umami", label: "Savory / Umami", val: fp.umami ?? 2 },
      { key: "fatRichness", label: "Richness / Fat", val: fp.fatRichness ?? 2 },
      { key: "acidity", label: "Acidity / Brightness", val: fp.acidity ?? 1 },
      { key: "sweetness", label: "Sweetness", val: fp.sweetness ?? 1 },
      { key: "herbalCharacter", label: "Herbal / Aromatic", val: fp.herbalCharacter ?? 2 },
      { key: "heatPungency", label: "Pungency / Heat", val: fp.heatPungency ?? 0 }
    ];

    return `
      <div class="atelier-home-stack">
        <!-- HERO SECTION: CHIAROSCURO TEST-KITCHEN ATELIER -->
        <section class="atelier-hero" aria-label="Culinary Intelligence Atelier Hero">
          <div class="atelier-hero-copy">
            <div class="atelier-eyebrow">
              <span>Atelier Reference Engine</span>
              <span>·</span>
              <span>${this.graph.ingredients.size} Ingredients</span>
              <span>·</span>
              <span>${(this.dataset.pairings || []).length.toLocaleString()} Pairings</span>
              <span>·</span>
              <span>${this.getAllAvailableRecipes().length} Recipes</span>
            </div>
            <h2 class="atelier-hero-title">
              Compose Dishes by <em>Molecular &amp; Classical Affinity</em> — Not Guesswork.
            </h2>
            <p class="atelier-hero-lead">
              Start with any single ingredient in your kitchen, test multi-ingredient flavor balance across eight sensory axes, rescue clashing combinations with culinary bridges, or cook from NYT Cooking’s 2025 Top 50 and 14 renowned chef collections using interactive <em>Cooking for Engineers</em> stage matrices.
            </p>
            <div class="atelier-hero-cta-row">
              <button
                type="button"
                class="btn-hero-primary"
                data-action="switch-tab"
                data-tab="dish_workbench"
              >
                Open Dish Workbench →
              </button>
              <button
                type="button"
                class="btn-hero-outline"
                data-action="switch-tab"
                data-tab="recipe_discovery"
              >
                Explore ${this.getAllAvailableRecipes().length} Chef &amp; NYT 2025 Recipes
              </button>
              <button
                type="button"
                class="btn-hero-outline"
                data-action="new-blank-dish"
              >
                Start a Blank Dish
              </button>
            </div>

            <div class="atelier-hero-sampler">
              <span class="atelier-sampler-label">Test an Anchor Ingredient Live in the Pairing Lab Below:</span>
              <div class="atelier-sampler-pills" role="group" aria-label="Live anchor ingredient selector">
                ${samplerAnchors
                  .map(
                    (a) => `
                  <button
                    type="button"
                    class="atelier-pill ${a.id === spotlightIng.id ? "atelier-pill-active" : ""}"
                    data-action="select-home-spotlight-ing"
                    data-ing-id="${escapeHtml(a.id)}"
                  >
                    ${escapeHtml(a.label)}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          </div>

          <div class="atelier-hero-visual">
            <img
              src="./assets/hero-duck-atelier.jpg"
              alt="Overhead editorial culinary composition of pan-seared scored duck breast, roasted halved figs, fresh herbs, flaky sea salt in a copper pinch bowl, and charred Meyer lemon on dark slate"
              class="atelier-hero-img"
            />
            <div class="atelier-hero-caption-overlay">
              <div>
                <div style="font-family:var(--font-mono);font-size:10.5px;color:#DFB77C;text-transform:uppercase;letter-spacing:0.05em;">
                  Active Specimen Preview
                </div>
                <strong>${escapeHtml(spotlightIng.name)}</strong>
                <span style="color:#BFB8AC;"> · Top Match: ${escapeHtml(topRecs[0]?.name || "Shallot")} (${topRecs[0]?.totalScore || 95})</span>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                data-action="home-launch-spotlight-dish"
                data-ing-id="${escapeHtml(spotlightIng.id)}"
              >
                Build Dish with ${escapeHtml(spotlightIng.name.replace(/\s*\([^)]*\)/g, ""))} →
              </button>
            </div>
          </div>
        </section>

        <!-- SECTION 1: ASYMMETRIC BENTO INTERACTIVE PAIRING LAB -->
        <section class="atelier-bento-grid" aria-label="Interactive Live Pairing Lab">
          <div class="card atelier-specimen-card">
            <div>
              <div class="card-header">
                <div>
                  <h2>1. Botanical &amp; Sensory Specimen Dossier</h2>
                  <span class="card-subtitle">Live 8-axis sensory profile for your selected anchor ingredient</span>
                </div>
                <span class="badge badge-role">${escapeHtml((spotlightIng.categories || []).map(formatSlug).join(" · "))}</span>
              </div>

              <div class="atelier-specimen-media">
                <img
                  src="./assets/card-botanical-pairings.jpg"
                  alt="Overhead test-kitchen flat lay of black garlic, star anise, red Sichuan peppercorns, fresh tarragon, charred orange peel, and brown butter on stone parchment"
                  class="atelier-specimen-img"
                />
                <span class="atelier-specimen-plate-tag">SPECIMEN ID: ${escapeHtml(spotlightIng.id)}</span>
              </div>

              <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                  <strong style="font-family:var(--font-display);font-size:18px;">${escapeHtml(spotlightIng.name)}</strong>
                  <span style="font-size:12px;color:var(--color-text-muted);">
                    Preparations: ${escapeHtml((spotlightIng.preparations || []).slice(0, 4).map(formatSlug).join(", "))}
                  </span>
                </div>
                <p style="margin:4px 0 10px 0;font-size:13px;color:var(--color-text-muted);">
                  ${escapeHtml(spotlightIng.culinaryNotes || "versatile culinary anchor with structured aromatic and savory balance.")}
                </p>
              </div>

              <div class="flavor-meters-grid" style="margin-bottom:12px;">
                ${sensoryAxes
                  .map((axis) => {
                    const pct = Math.min(100, Math.round((Number(axis.val || 0) / 4) * 100));
                    return `
                      <div>
                        <div class="meter-label-row">
                          <span>${escapeHtml(axis.label)}</span>
                          <span class="mono-num">${Number(axis.val || 0).toFixed(1)} / 4.0</span>
                        </div>
                        <div class="meter-track">
                          <div class="meter-fill" style="width:${pct}%;"></div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            <div class="inline-action-group" style="justify-content:space-between;padding-top:10px;border-top:1px solid var(--color-border);">
              <span style="font-size:12px;color:var(--color-text-muted);">
                Classical affinities: <strong>${escapeHtml((spotlightIng.cuisines || []).slice(0, 3).map((cId) => this.graph.cuisines.get(cId)?.name || formatSlug(cId.replace(/^cuisine_/, ""))).join(", ") || "Cross-Regional")}</strong>
              </span>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                data-action="home-launch-spotlight-dish"
                data-ing-id="${escapeHtml(spotlightIng.id)}"
              >
                Load Full Composition in Workbench →
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2>Live Multi-Factor Affinity Matrix for ${escapeHtml(spotlightIng.name.replace(/\s*\([^)]*\)/g, ""))}</h2>
                <span class="card-subtitle">Computed deterministically by the Culinary Engine — click any pairing to launch</span>
              </div>
              <span class="badge badge-strong">[+] Real-Time Engine Output</span>
            </div>

            <div class="rec-card-list" style="margin-bottom:12px;">
              ${topRecs
                .map(
                  (rec) => `
                <div class="rec-card">
                  <div class="rec-card-header">
                    <div>
                      <strong>${escapeHtml(rec.name)}</strong>
                      <div class="rec-badges">
                        <span class="badge badge-strong">Score ${rec.totalScore}/100</span>
                        <span class="badge badge-role">Role: ${escapeHtml(formatSlug(rec.suggestedRole))}</span>
                        <span class="badge badge-neutral">Prep: ${escapeHtml(formatSlug(rec.suggestedPreparation))}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-action="home-launch-pair-with-anchor"
                      data-anchor-id="${escapeHtml(spotlightIng.id)}"
                      data-pair-id="${escapeHtml(rec.id)}"
                      data-role="${escapeHtml(rec.suggestedRole || "supporting_component")}"
                      data-prep="${escapeHtml(rec.suggestedPreparation || "raw")}"
                    >
                      + Pair in Workbench
                    </button>
                  </div>
                  <p class="rec-explanation" style="margin:6px 0 0 0;">
                    ${escapeHtml(rec.explanation)}
                  </p>
                </div>
              `
                )
                .join("")}
            </div>

            <div class="form-row-split" style="margin-bottom:0;">
              ${
                topSauce
                  ? `<div class="custom-sauce-box" style="margin-top:0;">
                      <div style="font-size:11px;font-family:var(--font-mono);text-transform:uppercase;color:var(--color-secondary);">
                        Top Unifying Sauce (Fit ${topSauce.score})
                      </div>
                      <strong>${escapeHtml(topSauce.name)}</strong>
                      <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
                        ${escapeHtml(topSauce.rationale)}
                      </div>
                    </div>`
                  : ""
              }
              ${
                topSide
                  ? `<div class="custom-sauce-box" style="margin-top:0;">
                      <div style="font-size:11px;font-family:var(--font-mono);text-transform:uppercase;color:var(--color-primary);">
                        Recommended Accompaniment (Fit ${topSide.score})
                      </div>
                      <strong>${escapeHtml(topSide.name)}</strong>
                      <div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">
                        ${escapeHtml(topSide.rationale)}
                      </div>
                    </div>`
                  : ""
              }
            </div>
          </div>
        </section>

        <!-- SECTION 2: EDITORIAL SPREAD — NYT COOKING 2025 MOST POPULAR & 14 RENOWNED CHEF ARCHIVES -->
        <section class="card" aria-label="Curated Recipe & Chef Collections">
          <div class="card-header">
            <div>
              <h2>2. Curated Culinary Archives: NYT Cooking 2025 Top 50 &amp; 14 Renowned Chefs</h2>
              <span class="card-subtitle">Every recipe includes both narrative Step-by-Step instructions and a <em>Cooking for Engineers</em> tabular process matrix</span>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              data-action="switch-tab"
              data-tab="recipe_discovery"
            >
              Browse All ${this.getAllAvailableRecipes().length} Recipes →
            </button>
          </div>

          <div class="chip-group" style="margin-bottom:14px;" aria-label="Quick collection filters">
            <button
              type="button"
              class="chip chip-active"
              data-action="home-filter-collection"
              data-collection="nyt_top_50_2025"
              data-chef="all"
            >
              ★ NYT Cooking 2025 Top 50
            </button>
            <button
              type="button"
              class="chip"
              data-action="home-filter-collection"
              data-collection="renowned_chefs"
              data-chef="all"
            >
              All 14 Renowned Chef Signatures
            </button>
            ${this.chefCollections
              .slice(0, 8)
              .map(
                (c) => `
              <button
                type="button"
                class="chip"
                data-action="home-filter-collection"
                data-collection="all"
                data-chef="${escapeHtml(c.id)}"
              >
                ${escapeHtml(c.name)}
              </button>
            `
              )
              .join("")}
          </div>

          <div class="atelier-editorial-grid">
            ${
              nytHeroRecipe
                ? `<div class="atelier-featured-recipe-card">
                    <img
                      src="./assets/card-nyt-kebab.jpg"
                      alt="Editorial ceramic plate of seared spiced smashed beef kebab skewers over swirled cucumber-dill yogurt labneh with warm red chili butter"
                      class="atelier-featured-recipe-img"
                    />
                    <div class="atelier-featured-recipe-body">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                        <span class="badge badge-strong">NYT Cooking #1 Most Popular of 2025</span>
                        <span class="badge badge-neutral">${nytHeroRecipe.totalTimeMinutes} min · ${nytHeroRecipe.servings} servings</span>
                      </div>
                      <h3 style="margin:0 0 6px 0;font-family:var(--font-display);font-size:20px;">
                        ${escapeHtml(nytHeroRecipe.title)}
                      </h3>
                      <div style="font-size:12.5px;color:var(--color-secondary);font-weight:600;margin-bottom:8px;">
                        By ${escapeHtml(nytHeroRecipe.author)}
                      </div>
                      <p style="margin:0 0 12px 0;font-size:13px;color:var(--color-text-muted);">
                        ${escapeHtml(nytHeroRecipe.headnote)}
                      </p>
                      <div class="inline-action-group">
                        <button
                          type="button"
                          class="btn btn-sm btn-primary"
                          data-action="home-open-recipe"
                          data-recipe-id="${escapeHtml(nytHeroRecipe.id)}"
                          data-mode="cooking_for_engineers"
                        >
                          Open Cooking for Engineers Matrix →
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-secondary"
                          data-action="home-open-recipe"
                          data-recipe-id="${escapeHtml(nytHeroRecipe.id)}"
                          data-mode="step_by_step"
                        >
                          Step-by-Step View
                        </button>
                      </div>
                    </div>
                  </div>`
                : ""
            }

            <div class="atelier-showcase-list">
              ${featuredRecipes
                .map(
                  (rec) => `
                <div class="atelier-showcase-row">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div>
                      <span class="badge badge-role" style="margin-bottom:4px;">Chef Signature · ${escapeHtml(rec.author)}</span>
                      <h3 style="margin:0;font-family:var(--font-display);font-size:16px;">
                        ${escapeHtml(rec.title)}
                      </h3>
                    </div>
                    <span class="badge badge-neutral">${rec.totalTimeMinutes} min</span>
                  </div>
                  <p style="margin:6px 0 10px 0;font-size:12.8px;color:var(--color-text-muted);">
                    ${escapeHtml(rec.headnote)}
                  </p>
                  <div class="inline-action-group">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      data-action="home-open-recipe"
                      data-recipe-id="${escapeHtml(rec.id)}"
                      data-mode="cooking_for_engineers"
                    >
                      Process Matrix →
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-action="home-open-recipe"
                      data-recipe-id="${escapeHtml(rec.id)}"
                      data-mode="step_by_step"
                    >
                      Step-by-Step
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-action="load-recipe-into-workbench"
                      data-recipe-id="${escapeHtml(rec.id)}"
                    >
                      Load in Dish Workbench
                    </button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </section>

        <!-- SECTION 3: FOUR-STAGE ARCHITECTURAL WORKFLOW STRIP -->
        <section class="card" aria-label="Four-Stage Culinary Architecture">
          <div class="card-header">
            <div>
              <h2>3. Four-Stage Culinary Architecture</h2>
              <span class="card-subtitle">Every module operates locally in your browser with deterministic culinary reasoning</span>
            </div>
          </div>

          <div class="atelier-pillars-grid">
            <div class="atelier-pillar-card">
              <div>
                <div class="atelier-pillar-num">STAGE 01 / AFFINITY &amp; ROLES</div>
                <h3 class="atelier-pillar-title">Multi-Ingredient Dish Workbench</h3>
                <p class="atelier-pillar-desc">
                  Combine any number of ingredients and see how every new addition shifts the collective 8-axis sensory balance, classical sauce affinities, and pan-sauce synthesis.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                data-action="load-preset"
                data-preset-id="preset_duck_orange"
              >
                Load Duck &amp; Turnips Preset →
              </button>
            </div>

            <div class="atelier-pillar-card atelier-pillar-card-accent">
              <div>
                <div class="atelier-pillar-num">STAGE 02 / OVERRIDE &amp; BRIDGE</div>
                <h3 class="atelier-pillar-title">Challenging Pairing Rescue</h3>
                <p class="atelier-pillar-desc">
                  Never hit a dead end. Override traditional rules (like Poached Cod + Blue Cheese) and let the engine compute bridging ingredients and preparation shifts that unify the plate.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                data-action="load-preset"
                data-preset-id="preset_conflict_rescue"
              >
                Test Cod + Blue Cheese Rescue →
              </button>
            </div>

            <div class="atelier-pillar-card">
              <div>
                <div class="atelier-pillar-num">STAGE 03 / PROCESS MATRIX</div>
                <h3 class="atelier-pillar-title">Cooking for Engineers View</h3>
                <p class="atelier-pillar-desc">
                  Switch any recipe between narrative steps and a pinned-column stage matrix with 1-click completion checkoffs, live kitchen timers, metric/imperial conversion, and USDA nutrition.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                data-action="home-open-recipe"
                data-recipe-id="rec_nyt2025_01_smashed_beef_kebab"
                data-mode="cooking_for_engineers"
              >
                Inspect Process Matrix →
              </button>
            </div>

            <div class="atelier-pillar-card atelier-pillar-card-accent">
              <div>
                <div class="atelier-pillar-num">STAGE 04 / MENU &amp; GROCERY</div>
                <h3 class="atelier-pillar-title">Multi-Course Menus &amp; Aisle Lists</h3>
                <p class="atelier-pillar-desc">
                  Sequence appetizers, mains, sides, and desserts with cross-course fat/acid fatigue checks, then aggregate multiple recipes into a normalized grocery list grouped by store aisle.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-secondary"
                data-action="switch-tab"
                data-tab="menu_composer"
              >
                Open Multi-Course Menu Builder →
              </button>
            </div>
          </div>
        </section>

        <!-- SECTION 4: AUTHENTIC DATASET PROVENANCE LEDGER & FINAL CTA -->
        <section class="card" aria-label="Dataset Provenance & Architecture Ledger">
          <div class="card-header">
            <div>
              <h2>4. Verified Culinary Knowledge Graph &amp; Local Persistence Ledger</h2>
              <span class="card-subtitle">Zero external API keys, zero accounts, and zero fabricated metrics — 100% locally persistent</span>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              data-action="switch-tab"
              data-tab="knowledge_provenance"
            >
              Inspect Full Provenance Catalog →
            </button>
          </div>

          <div class="atelier-ledger-grid">
            <div class="atelier-ledger-cell">
              <div class="atelier-ledger-val">${this.graph.ingredients.size}</div>
              <div class="atelier-ledger-label">Canonical Ingredients</div>
              <div class="atelier-ledger-sub">With USDA nutrition &amp; density weights</div>
            </div>
            <div class="atelier-ledger-cell">
              <div class="atelier-ledger-val">${(this.dataset.pairings || []).length.toLocaleString()}</div>
              <div class="atelier-ledger-label">Explainable Pairings</div>
              <div class="atelier-ledger-sub">Scored with mechanisms &amp; provenance</div>
            </div>
            <div class="atelier-ledger-cell">
              <div class="atelier-ledger-val">${this.getAllAvailableRecipes().length}</div>
              <div class="atelier-ledger-label">Structured Recipes</div>
              <div class="atelier-ledger-sub">50 NYT 2025 + 18 Chef Signatures</div>
            </div>
            <div class="atelier-ledger-cell">
              <div class="atelier-ledger-val">${this.graph.sauces.size} · ${this.graph.sides.size}</div>
              <div class="atelier-ledger-label">Sauces &amp; Composed Sides</div>
              <div class="atelier-ledger-sub">Plus dynamic pan-sauce synthesis</div>
            </div>
            <div class="atelier-ledger-cell">
              <div class="atelier-ledger-val">${this.graph.sources.size}</div>
              <div class="atelier-ledger-label">Primary Culinary Sources</div>
              <div class="atelier-ledger-sub">USDA, Escoffier, McGee, Culinary Institute</div>
            </div>
          </div>

          <div class="atelier-final-cta-banner">
            <div>
              <strong style="font-family:var(--font-display);font-size:19px;color:#FAF8F5;">
                Ready to compose your next dish or multi-course menu?
              </strong>
              <div style="font-size:13px;color:#D8D3C8;margin-top:2px;">
                All work saves automatically to your browser’s IndexedDB and can be exported or imported as portable JSON at any time.
              </div>
            </div>
            <div class="inline-action-group">
              <button
                type="button"
                class="btn-hero-primary"
                data-action="switch-tab"
                data-tab="dish_workbench"
              >
                Enter Dish Workbench →
              </button>
              <button
                type="button"
                class="btn-hero-outline"
                data-action="home-filter-collection"
                data-collection="all"
                data-chef="all"
                data-subview="shopping"
              >
                Open Consolidated Grocery List
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  _renderDishWorkbench(evalState) {
    const dish = this.state.workingDish;
    const { structure, warnings, bridges, ingredientRecs, sauceRecs, sideRecs } = evalState;
    const hasContextFilters =
      (dish.cuisineIds && dish.cuisineIds.length > 0) ||
      (dish.cookingMethods && dish.cookingMethods.length > 0);
    const hasRecFilters = Boolean(this.state.recCategoryFilter || this.state.recRoleFilter);

    return `
      <div class="preset-bar" aria-label="Quick starter dish presets">
        <div class="preset-group">
          <span class="preset-label">Presets:</span>
          ${QUICK_STARTER_PRESETS.map(
            (p) => `
              <button type="button" class="btn btn-sm btn-secondary" data-action="load-preset" data-preset-id="${escapeHtml(
                p.id
              )}">
                ${escapeHtml(p.label)}
              </button>
            `
          ).join("")}
        </div>
        <div class="preset-group">
          <button type="button" class="btn btn-sm btn-secondary" data-action="new-blank-dish">
            Clear / New Blank Dish
          </button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="duplicate-working-dish">
            Duplicate Dish
          </button>
          <button type="button" class="btn btn-sm btn-primary" data-action="save-working-dish-explicit">
            Save Dish to Library
          </button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="discover-recipes-from-dish">
            Match Recipes (${dish.ingredients.length})
          </button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="convert-working-dish-to-recipe">
            Convert to Recipe
          </button>
          ${
            this.state.editingMenuEntryId &&
            this.state.workingMenu.items.some((i) => i.entryId === this.state.editingMenuEntryId)
              ? `<button type="button" class="btn btn-sm btn-primary" data-action="update-edited-menu-course">
                  Update Course Snapshot in Menu
                </button>`
              : ""
          }
        </div>
      </div>

      <div class="workbench-grid">
        <!-- LEFT COLUMN: Search & Add Ingredients (Above the Fold), Selected Ingredients, Dish Identity, Context Chips, Sauces & Sides -->
        <section class="panel-col" aria-label="Active Dish Construction">
          <!-- INGREDIENT SEARCH & CONTEXT-AWARE AUTOCOMPLETE (ABOVE THE FOLD) -->
          <div class="card">
            <div class="card-header">
              <h2>Search &amp; Add Ingredients (Any Starting Point)</h2>
              <span class="card-subtitle">Start with a protein, vegetable, sauce, starch, herb, or spice</span>
            </div>
            <div class="search-combobox-wrap">
              <label for="ingredient-search-input" class="form-label">
                Search by name, alias, or regional term (e.g. "entrecote", "shoyu", "blue cheese", "preserved lemon")
              </label>
              <div class="search-input-wrap">
                <input
                  id="ingredient-search-input"
                  type="text"
                  role="combobox"
                  aria-expanded="${Boolean(this.state.autocompleteOpen)}"
                  aria-autocomplete="list"
                  aria-controls="autocomplete-dropdown-slot"
                  class="form-input search-input-lg"
                  value="${escapeHtml(this.state.searchQuery)}"
                  placeholder="Type an ingredient name or press / to search..."
                  autocomplete="off"
                />
                <div class="search-input-accessory">
                  ${
                    this.state.searchQuery
                      ? `<button type="button" class="search-clear-btn" data-action="clear-ingredient-search" aria-label="Clear search">Clear ×</button>`
                      : `<kbd class="kbd-hint" title="Press / to focus search">/</kbd>`
                  }
                </div>
              </div>
              <div id="autocomplete-dropdown-slot">
                ${this._buildAutocompleteDropdownHtml()}
              </div>
            </div>

            ${
              this.state.pendingOverrideCandidate
                ? `
                <div class="override-confirmation-banner" role="region" aria-label="Compatibility warning override confirmation">
                  <div class="override-banner-title">
                    <strong>[!] Culinary Compatibility Concern: ${escapeHtml(
                      this.state.pendingOverrideCandidate.name
                    )}</strong>
                  </div>
                  <p class="override-banner-body">
                    ${escapeHtml(this.state.pendingOverrideCandidate.warningSummary)}
                  </p>
                  <p class="override-banner-note">
                    You can intentionally include this ingredient anyway. Once added, the engine preserves your choice without repeated prompts and searches for bridging ingredients to make the full combination work.
                  </p>
                  <div class="override-banner-actions">
                    <button type="button" class="btn btn-warning-override" data-action="confirm-override-add">
                      Include ${escapeHtml(
                        this.state.pendingOverrideCandidate.name
                      )} Anyway (Override)
                    </button>
                    <button type="button" class="btn btn-secondary" data-action="cancel-override-add">
                      Cancel
                    </button>
                  </div>
                </div>
              `
                : ""
            }
          </div>

          <!-- SELECTED INGREDIENTS LIST -->
          <div class="card">
            <div class="card-header">
              <h2>Selected Dish Ingredients (${dish.ingredients.length})</h2>
              <span class="card-subtitle">Adjust role or preparation state to recalculate harmony</span>
            </div>
            ${
              dish.ingredients.length === 0
                ? `<div class="empty-state">No ingredients selected yet. Search above, pick a sauce or cuisine below, or click any recommended starter on the right.</div>`
                : `
                <div class="selected-ingredients-list">
                  ${dish.ingredients
                    .map((sel) => {
                      const ing = this.graph.ingredients.get(sel.ingredientId);
                      const fp = this.graph.getEffectiveFlavorProfile(sel.ingredientId, sel.preparation);
                      const displayName = ing?.name || sel.fallbackName || sel.ingredientId;
                      const availPreps = Array.from(
                        new Set([...(ing?.preparations || []), ...PREPARATION_STATES])
                      );
                      const topFlavorTags = [];
                      if (fp) {
                        if (fp.umami >= 2) topFlavorTags.push(`Umami ${fp.umami}`);
                        if (fp.acidity >= 2) topFlavorTags.push(`Acid ${fp.acidity}`);
                        if (fp.fatRichness >= 2) topFlavorTags.push(`Fat ${fp.fatRichness}`);
                        if (fp.sweetness >= 2) topFlavorTags.push(`Sweet ${fp.sweetness}`);
                        if (fp.heatPungency >= 2) topFlavorTags.push(`Heat ${fp.heatPungency}`);
                        if (fp.herbalCharacter >= 2) topFlavorTags.push(`Herbal ${fp.herbalCharacter}`);
                      }

                      return `
                        <div class="selected-item-row ${sel.isOverride ? "selected-item-override" : ""}">
                          <div class="selected-item-main">
                            <div class="selected-item-title">
                              <strong>${escapeHtml(displayName)}</strong>
                              ${
                                sel.isOverride
                                  ? `<span class="badge badge-warning" title="${escapeHtml(
                                      sel.overrideReason || "Intentional user override"
                                    )}">[!] Intentional Override</span>`
                                  : ""
                              }
                              ${
                                !ing
                                  ? `<span class="badge badge-neutral">[Preserved Legacy Item]</span>`
                                  : ""
                              }
                              ${topFlavorTags
                                .slice(0, 3)
                                .map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
                                .join("")}
                            </div>
                            <div class="selected-item-notes">
                              ${escapeHtml(ing?.culinaryNotes || "Preserved user ingredient record.")}
                            </div>
                          </div>
                          <div class="selected-item-controls">
                            <label class="sr-only" for="role-${escapeHtml(sel.ingredientId)}">Role for ${escapeHtml(
                        displayName
                      )}</label>
                            <select
                              id="role-${escapeHtml(sel.ingredientId)}"
                              class="form-select form-select-sm"
                              data-action="change-ingredient-role"
                              data-ing-id="${escapeHtml(sel.ingredientId)}"
                              title="Culinary role in dish"
                            >
                              ${CULINARY_ROLES.map(
                                (r) =>
                                  `<option value="${escapeHtml(r)}" ${
                                    sel.role === r ? "selected" : ""
                                  }>Role: ${escapeHtml(formatSlug(r))}</option>`
                              ).join("")}
                            </select>

                            <label class="sr-only" for="prep-${escapeHtml(sel.ingredientId)}">Preparation for ${escapeHtml(
                        displayName
                      )}</label>
                            <select
                              id="prep-${escapeHtml(sel.ingredientId)}"
                              class="form-select form-select-sm"
                              data-action="change-ingredient-prep"
                              data-ing-id="${escapeHtml(sel.ingredientId)}"
                              title="Preparation state"
                            >
                              ${availPreps
                                .map(
                                  (p) =>
                                    `<option value="${escapeHtml(p)}" ${
                                      sel.preparation === p ? "selected" : ""
                                    }>Prep: ${escapeHtml(formatSlug(p))}</option>`
                                )
                                .join("")}
                            </select>

                            <button
                              type="button"
                              class="btn btn-sm btn-danger-outline"
                              data-action="remove-dish-ingredient"
                              data-ing-id="${escapeHtml(sel.ingredientId)}"
                              aria-label="Remove ${escapeHtml(displayName)}"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
            }

            <div class="form-row" style="margin-top: 12px; margin-bottom: 0;">
              <label for="dish-notes-input" class="form-label">Chef Notes &amp; Plating Ideas</label>
              <textarea
                id="dish-notes-input"
                class="form-textarea"
                rows="2"
                placeholder="Record proportions, plating notes, or technique reminders..."
              >${escapeHtml(dish.notes || "")}</textarea>
            </div>
          </div>

          <!-- ACTIVE DISH IDENTITY & QUICK-ADD -->
          <div class="card">
            <div class="card-header">
              <h2>Active Dish Configuration</h2>
              <span class="card-subtitle">${pluralize(dish.ingredients.length, "ingredient")} · ${pluralize(
      (dish.sauceIds || []).length,
      "sauce"
    )} · ${pluralize((dish.sideIds || []).length, "side")}</span>
            </div>
            <div class="form-row">
              <label for="dish-name-input" class="form-label">Dish Name</label>
              <input
                id="dish-name-input"
                type="text"
                class="form-input"
                value="${escapeHtml(dish.name)}"
                placeholder="e.g., Pan-Seared Sea Bass with Fennel &amp; Blood Orange"
              />
            </div>

            <div class="form-row-split" style="margin-bottom: 0;">
              <div>
                <label for="dish-course-role-select" class="form-label">Default Course Role</label>
                <select id="dish-course-role-select" class="form-select">
                  ${STANDARD_COURSE_TYPES.map(
                    (c) =>
                      `<option value="${escapeHtml(c.id)}" ${
                        dish.courseRole === c.id ? "selected" : ""
                      }>${escapeHtml(c.label)}</option>`
                  )}
                </select>
              </div>
              <div class="menu-quick-add-box">
                <label for="quick-add-course-type" class="form-label">Send Snapshot to Active Menu</label>
                <div class="inline-action-group">
                  <select id="quick-add-course-type" class="form-select">
                    ${STANDARD_COURSE_TYPES.map(
                      (c) =>
                        `<option value="${escapeHtml(c.id)}" ${
                          dish.courseRole === c.id ? "selected" : ""
                        }>${escapeHtml(c.label)}</option>`
                    )}
                  </select>
                  <button type="button" class="btn btn-primary" data-action="add-working-dish-to-menu">
                    + Add to Menu
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- OPTIONAL CULINARY TRADITION & COOKING METHOD CONTEXT -->
          <div class="card">
            <div class="card-header">
              <h2>Culinary Tradition &amp; Technique Context</h2>
              ${
                hasContextFilters
                  ? `<button type="button" class="search-clear-btn" data-action="clear-dish-context-chips">Clear Context ×</button>`
                  : `<span class="card-subtitle">Influences ranking without restricting discovery</span>`
              }
            </div>
            <div class="form-row">
              <span class="form-label">Culinary Tradition Preference (${(dish.cuisineIds || []).length} active)</span>
              <div class="chip-group">
                ${Array.from(this.graph.cuisines.values())
                  .map((c) => {
                    const active = (dish.cuisineIds || []).includes(c.id);
                    return `
                      <button
                        type="button"
                        class="chip ${active ? "chip-active" : ""}"
                        data-action="toggle-cuisine"
                        data-cuisine-id="${escapeHtml(c.id)}"
                        aria-pressed="${active}"
                        title="${escapeHtml(c.description)}"
                      >
                        ${escapeHtml(c.name)}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            <div class="form-row" style="margin-bottom: 0;">
              <span class="form-label">Dish Cooking Techniques (${(dish.cookingMethods || []).length} active)</span>
              <div class="chip-group">
                ${["roasted", "sauteed", "braised", "grilled", "poached", "steamed", "raw", "fried", "smoked", "fermented"]
                  .map((m) => {
                    const active = (dish.cookingMethods || []).includes(m);
                    return `
                      <button
                        type="button"
                        class="chip ${active ? "chip-active" : ""}"
                        data-action="toggle-cooking-method"
                        data-method="${escapeHtml(m)}"
                        aria-pressed="${active}"
                      >
                        ${escapeHtml(formatSlug(m))}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>

          <!-- SAUCES & COMPOSED SIDES -->
          <div class="card">
            <div class="card-header">
              <h2>Sauces &amp; Composed Side Accompaniments</h2>
              <span class="card-subtitle">Constituent ingredients deduplicate against your dish</span>
            </div>

            <div class="active-sauces-sides">
              <div>
                <strong>Selected Sauces (${(dish.sauceIds || []).length}):</strong>
                ${
                  (dish.sauceIds || []).length === 0
                    ? `<span class="card-subtitle">None selected</span>`
                    : (dish.sauceIds || [])
                        .map((id) => {
                          const s = this.graph.sauces.get(id);
                          return `<button type="button" class="chip chip-active" data-action="toggle-sauce" data-sauce-id="${escapeHtml(
                            id
                          )}">${escapeHtml(s?.name || id)} [×]</button>`;
                        })
                        .join(" ")
                }
              </div>
              <div style="margin-top: 6px;">
                <strong>Selected Composed Sides (${(dish.sideIds || []).length}):</strong>
                ${
                  (dish.sideIds || []).length === 0
                    ? `<span class="card-subtitle">None selected</span>`
                    : (dish.sideIds || [])
                        .map((id) => {
                          const s = this.graph.sides.get(id);
                          return `<button type="button" class="chip chip-active" data-action="toggle-side" data-side-id="${escapeHtml(
                            id
                          )}">${escapeHtml(s?.name || id)} [×]</button>`;
                        })
                        .join(" ")
                }
              </div>
            </div>

            <h3 class="subsection-title">Recommended Sauce Templates</h3>
            <div class="rec-card-list">
              ${sauceRecs.templates
                .map(
                  (sr) => `
                  <div class="rec-mini-card">
                    <div class="rec-mini-top">
                      <strong>${escapeHtml(sr.name)}</strong>
                      <span class="badge badge-strong">Fit: ${sr.score}</span>
                    </div>
                    <p class="rec-mini-desc">${escapeHtml(sr.rationale)}</p>
                    <div class="rec-mini-meta">
                      <span>Technique: ${escapeHtml(sr.technique)}</span>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-action="toggle-sauce"
                      data-sauce-id="${escapeHtml(sr.id)}"
                    >
                      + Add Sauce to Dish
                    </button>
                  </div>
                `
                )
                .join("")}
            </div>

            ${
              sauceRecs.customComposition
                ? `
                <div class="custom-sauce-box">
                  <strong>Dynamic Pan Sauce Construction: ${escapeHtml(
                    sauceRecs.customComposition.title
                  )}</strong>
                  <p class="rec-mini-desc">${escapeHtml(sauceRecs.customComposition.explanation)}</p>
                </div>
              `
                : ""
            }

            <h3 class="subsection-title">Recommended Composed Side Dishes</h3>
            <div class="rec-card-list">
              ${sideRecs
                .map(
                  (side) => `
                  <div class="rec-mini-card">
                    <div class="rec-mini-top">
                      <strong>${escapeHtml(side.name)}</strong>
                      <span class="badge badge-strong">Fit: ${side.score}</span>
                    </div>
                    <p class="rec-mini-desc">${escapeHtml(side.rationale)}</p>
                    <div class="rec-mini-meta">
                      <span>Key components: ${escapeHtml(side.constituentNames.join(", "))}</span>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      data-action="toggle-side"
                      data-side-id="${escapeHtml(side.id)}"
                    >
                      + Add Composed Side
                    </button>
                  </div>
                `
                )
                .join("")}
            </div>
          </div>
        </section>

        <!-- RIGHT COLUMN: Dish Balance Diagnostics, Warnings, Bridge Rescue, and Multi-Ingredient Recommendations -->
        <section class="panel-col" aria-label="Culinary Intelligence & Recommendations">
          <!-- FLAVOR BALANCE & DIAGNOSTICS -->
          <div class="card">
            <div class="card-header">
              <h2>Multi-Ingredient Balance &amp; Structure Analysis</h2>
              <span class="card-subtitle">Evaluated across ${pluralize(
                dish.ingredients.length,
                "selected ingredient"
              )} and ${pluralize((dish.sauceIds || []).length, "sauce")}</span>
            </div>
            <div class="flavor-meters-grid">
              ${[
                ["Umami / Savory", structure.averages.umami, ""],
                ["Acidity / Brightness", structure.averages.acidity, "meter-fill-acidity"],
                ["Fat / Richness", structure.averages.perceivedRichness, "meter-fill-fat"],
                ["Sweetness", structure.averages.sweetness, "meter-fill-sweet"],
                ["Bitterness", structure.averages.bitterness, ""],
                ["Heat / Pungency", structure.averages.heatPungency, "meter-fill-heat"],
                ["Herbal / Aromatic", structure.averages.herbalCharacter, "meter-fill-herbal"],
                [
                  "Smokiness / Earth",
                  Math.max(structure.averages.smokiness || 0, structure.averages.earthiness || 0),
                  "meter-fill-fat"
                ]
              ]
                .map(([label, val, fillClass]) => {
                  const clamped = Math.min(4.0, Number(val || 0));
                  const pct = Math.min(100, Math.round((clamped / 4) * 100));
                  return `
                    <div class="meter-item">
                      <div class="meter-label-row">
                        <span>${escapeHtml(label)}</span>
                        <span class="mono-num">${clamped} / 4.0</span>
                      </div>
                      <div class="meter-track">
                        <div class="meter-fill ${fillClass}" style="width: ${pct}%"></div>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>

          <!-- COMPATIBILITY WARNINGS & BRIDGING RESCUE PANEL -->
          ${
            warnings.length > 0 || bridges.length > 0
              ? `
              <div class="card card-rescue" role="region" aria-label="Compatibility Warnings and Rescue Bridges">
                <div class="card-header">
                  <h2>Compatibility Observations &amp; Bridging Rescue Engine</h2>
                </div>

                ${
                  warnings.length > 0
                    ? `
                    <div class="warnings-list">
                      ${warnings
                        .map(
                          (w) => `
                          <div class="warning-item warning-${escapeHtml(w.severity)}">
                            <div class="warning-item-header">
                              <strong>${
                                w.severity === "challenging" ? "[!] " : "[i] "
                              }${escapeHtml(w.title)}</strong>
                              <span class="badge ${
                                w.acceptedByOverride ? "badge-neutral" : "badge-warning"
                              }">
                                ${
                                  w.acceptedByOverride
                                    ? "Intentional Selection Preserved"
                                    : "Advisory Warning"
                                }
                              </span>
                            </div>
                            <p class="warning-item-body">${escapeHtml(w.explanation)}</p>
                          </div>
                        `
                        )
                        .join("")}
                    </div>
                  `
                    : ""
                }

                ${
                  bridges.length > 0
                    ? `
                    <h3 class="subsection-title">Recommended Bridging Ingredients &amp; Technique Adjustments</h3>
                    <div class="rec-card-list">
                      ${bridges
                        .map(
                          (b) => `
                          <div class="rec-mini-card bridge-card">
                            <div class="rec-mini-top">
                              <strong>[Bridge] ${escapeHtml(b.candidateName)}</strong>
                              <span class="badge badge-strong">Mitigation: ${
                                b.conflictMitigationScore
                              } · Overall Fit: ${b.overallCompatibilityScore} (${escapeHtml(
                            b.supportLevel
                          )})</span>
                            </div>
                            <p class="rec-mini-desc">${escapeHtml(b.rationale)}</p>
                            ${
                              b.tradeoffNote
                                ? `<p class="tradeoff-note">Tradeoff note: ${escapeHtml(
                                    b.tradeoffNote
                                  )}</p>`
                                : ""
                            }
                            <button
                              type="button"
                              class="btn btn-sm btn-primary"
                              data-action="apply-bridge-suggestion"
                              data-bridge-type="${escapeHtml(b.type)}"
                              data-cand-id="${escapeHtml(
                                b.candidateIngredientId || b.candidateSauceId || ""
                              )}"
                              data-prep="${escapeHtml(b.suggestedPreparation || "")}"
                            >
                              + Apply Bridge (${escapeHtml(formatSlug(b.type))})
                            </button>
                          </div>
                        `
                        )
                        .join("")}
                    </div>
                  `
                    : ""
                }
              </div>
            `
              : ""
          }

          <!-- CONTEXTUAL MULTI-INGREDIENT RECOMMENDATIONS -->
          <div class="card">
            <div class="card-header">
              <h2>Contextual Ingredient Recommendations</h2>
              <div class="inline-action-group">
                <span class="card-subtitle">
                  Ranked across all active selections (${
                    ingredientRecs.excludedConflictCount
                  } incompatible items filtered; searchable on left)
                </span>
                ${
                  hasRecFilters
                    ? `<button type="button" class="search-clear-btn" data-action="reset-rec-filters">Reset Filters ×</button>`
                    : ""
                }
              </div>
            </div>

            <div class="filter-bar">
              <div>
                <label for="rec-category-filter" class="form-label">Filter by Category</label>
                <select id="rec-category-filter" class="form-select">
                  <option value="">All Categories</option>
                  ${INGREDIENT_CATEGORIES.map(
                    (c) =>
                      `<option value="${escapeHtml(c)}" ${
                        this.state.recCategoryFilter === c ? "selected" : ""
                      }>${escapeHtml(formatSlug(c))}</option>`
                  ).join("")}
                </select>
              </div>
              <div>
                <label for="rec-role-filter" class="form-label">Filter by Dish Role</label>
                <select id="rec-role-filter" class="form-select">
                  <option value="">All Culinary Roles</option>
                  ${CULINARY_ROLES.map(
                    (r) =>
                      `<option value="${escapeHtml(r)}" ${
                        this.state.recRoleFilter === r ? "selected" : ""
                      }>${escapeHtml(formatSlug(r))}</option>`
                  ).join("")}
                </select>
              </div>
            </div>

            ${
              ingredientRecs.fallbackMessage
                ? `<div class="empty-state">${escapeHtml(ingredientRecs.fallbackMessage)}</div>`
                : `
                <div class="recommendations-grid">
                  ${ingredientRecs.recommendations
                    .map(
                      (rec) => `
                      <div class="rec-card">
                        <div class="rec-card-header">
                          <div>
                            <strong class="rec-title">${escapeHtml(rec.name)}</strong>
                            <div class="rec-badges">
                              <span class="badge badge-strong">Score: ${rec.totalScore}</span>
                              <span class="badge badge-role">Role: ${escapeHtml(
                                formatSlug(rec.suggestedRole)
                              )}</span>
                              <span class="badge badge-neutral">Confidence: ${escapeHtml(
                                rec.confidence
                              )}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="btn btn-sm btn-primary"
                            data-action="add-recommended-ingredient"
                            data-ing-id="${escapeHtml(rec.candidateId)}"
                            data-role="${escapeHtml(rec.suggestedRole)}"
                            data-prep="${escapeHtml(rec.suggestedPreparation)}"
                          >
                            + Add
                          </button>
                        </div>
                        <p class="rec-explanation">${escapeHtml(rec.primaryExplanation)}</p>
                        <div class="rec-tags-row">
                          ${(rec.explanationCategories || [])
                            .map((cat) => `<span class="tag-pill">${escapeHtml(cat)}</span>`)
                            .join("")}
                        </div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
            }
          </div>
        </section>
      </div>
    `;
  }

  _renderMenuComposer() {
    const menu = this.state.workingMenu;
    const menuEval = evaluateMenu(this.graph, menu);
    const orderedItems = [...(menu.items || [])].sort((a, b) => a.order - b.order);

    return `
      <div class="workbench-grid">
        <section class="panel-col" aria-label="Menu Configuration and Courses">
          <div class="card">
            <div class="card-header">
              <h2>Active Multi-Course Menu: ${escapeHtml(menu.name)}</h2>
              <div class="inline-action-group">
                <button type="button" class="btn btn-sm btn-secondary" data-action="new-blank-menu">
                  New Blank Menu
                </button>
                <button type="button" class="btn btn-sm btn-secondary" data-action="duplicate-working-menu">
                  Duplicate Menu
                </button>
                <button type="button" class="btn btn-sm btn-secondary" data-action="print-kitchen-sheet">
                  Print Menu Card
                </button>
              </div>
            </div>

            <div class="form-row-split">
              <div>
                <label for="menu-name-input" class="form-label">Menu Title</label>
                <input
                  id="menu-name-input"
                  type="text"
                  class="form-input"
                  value="${escapeHtml(menu.name)}"
                />
              </div>
              <div>
                <label for="menu-theme-input" class="form-label">Optional Culinary Theme / Occasion</label>
                <input
                  id="menu-theme-input"
                  type="text"
                  class="form-input"
                  value="${escapeHtml(menu.theme || "")}"
                  placeholder="e.g., Autumn Mediterranean Harvest"
                />
              </div>
            </div>

            <div class="form-row" style="margin-bottom: 0;">
              <label for="menu-notes-input" class="form-label">Menu Service &amp; Pacing Notes</label>
              <textarea id="menu-notes-input" class="form-textarea" rows="2">${escapeHtml(
                menu.notes || ""
              )}</textarea>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2>Menu Courses (${orderedItems.length})</h2>
              <span class="card-subtitle">
                Each course stores an isolated dish snapshot so editing a dish in one menu never mutates another menu
              </span>
            </div>

            ${
              orderedItems.length === 0
                ? `<div class="empty-state">No dishes in this menu yet. Add your current working dish or pick from your saved dishes on the right.</div>`
                : `
                <div class="menu-courses-list">
                  ${orderedItems
                    .map((entry, idx) => {
                      const d = entry.dishSnapshot;
                      const ingNames = (d.ingredients || []).map(
                        (s) => this.graph.ingredients.get(s.ingredientId)?.name || s.fallbackName || s.ingredientId
                      );
                      const sauceNames = (d.sauceIds || []).map(
                        (id) => this.graph.sauces.get(id)?.name || id
                      );
                      const sideNames = (d.sideIds || []).map(
                        (id) => this.graph.sides.get(id)?.name || id
                      );
                      return `
                        <div class="menu-course-card">
                          <div class="menu-course-header">
                            <div>
                              <span class="badge badge-role">Course ${idx + 1}</span>
                              ${
                                entry.customCourseLabel
                                  ? `<span class="badge badge-role" style="margin-left: 4px;">${escapeHtml(
                                      entry.customCourseLabel
                                    )}</span>`
                                  : ""
                              }
                              <strong style="font-size: 15px; margin-left: 6px;">${escapeHtml(
                                d.name
                              )}</strong>
                            </div>
                            <div class="inline-action-group">
                              <select
                                class="form-select form-select-sm"
                                data-action="change-menu-course-type"
                                data-entry-id="${escapeHtml(entry.entryId)}"
                                aria-label="Course type for ${escapeHtml(d.name)}"
                              >
                                ${STANDARD_COURSE_TYPES.map(
                                  (ct) =>
                                    `<option value="${escapeHtml(ct.id)}" ${
                                      entry.courseType === ct.id ? "selected" : ""
                                    }>${escapeHtml(ct.label)}</option>`
                                ).join("")}
                              </select>
                              ${
                                entry.courseType === "custom" || Boolean(entry.customCourseLabel)
                                  ? `<input
                                      type="text"
                                      class="form-input"
                                      style="width: 165px; padding: 4px 8px; font-size: 12px;"
                                      data-action="edit-menu-custom-course-label"
                                      data-entry-id="${escapeHtml(entry.entryId)}"
                                      value="${escapeHtml(entry.customCourseLabel || "")}"
                                      placeholder="Custom course label..."
                                      aria-label="Custom course label for ${escapeHtml(d.name)}"
                                    />`
                                  : ""
                              }
                              <button
                                type="button"
                                class="btn btn-sm btn-secondary"
                                data-action="move-menu-course"
                                data-entry-id="${escapeHtml(entry.entryId)}"
                                data-dir="-1"
                                ${idx === 0 ? "disabled" : ""}
                              >
                                ↑ Up
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-secondary"
                                data-action="move-menu-course"
                                data-entry-id="${escapeHtml(entry.entryId)}"
                                data-dir="1"
                                ${idx === orderedItems.length - 1 ? "disabled" : ""}
                              >
                                ↓ Down
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-secondary"
                                data-action="edit-menu-course-in-workbench"
                                data-entry-id="${escapeHtml(entry.entryId)}"
                              >
                                Load in Dish Workbench
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-danger-outline"
                                data-action="remove-menu-course"
                                data-entry-id="${escapeHtml(entry.entryId)}"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div class="menu-course-body">
                            <div><strong>Ingredients:</strong> ${escapeHtml(
                              ingNames.join(", ") || "None"
                            )}</div>
                            ${
                              sauceNames.length
                                ? `<div><strong>Sauces:</strong> ${escapeHtml(
                                    sauceNames.join(", ")
                                  )}</div>`
                                : ""
                            }
                            ${
                              sideNames.length
                                ? `<div><strong>Sides:</strong> ${escapeHtml(
                                    sideNames.join(", ")
                                  )}</div>`
                                : ""
                            }
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
            }
          </div>
        </section>

        <section class="panel-col" aria-label="Menu Evaluation and Dish Reuse">
          <div class="card">
            <div class="card-header">
              <h2>Menu-Level Culinary Evaluation &amp; Progression</h2>
              <span class="card-subtitle mono-num">
                Avg Richness: ${Math.min(4.0, Number(menuEval.overallRichnessScore || 0))} / 4.0 · Avg Acidity: ${Math.min(
      4.0,
      Number(menuEval.overallAcidityScore || 0)
    )} / 4.0
              </span>
            </div>

            ${
              menuEval.observations.length === 0
                ? `<div class="empty-state">Add one or more courses to view menu-wide balance and repetition analysis.</div>`
                : `
                <div class="warnings-list">
                  ${menuEval.observations
                    .map(
                      (obs) => `
                      <div class="warning-item warning-${
                        obs.type === "warning" ? "challenging" : "conditional"
                      }">
                        <div class="warning-item-header">
                          <strong>${
                            obs.type === "warning"
                              ? "[!] "
                              : obs.type === "strength"
                              ? "[✓] "
                              : "[i] "
                          }${escapeHtml(obs.title)}</strong>
                          <span class="badge badge-neutral">${escapeHtml(
                            formatSlug(obs.type)
                          )}</span>
                        </div>
                        <p class="warning-item-body">${escapeHtml(obs.explanation)}</p>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
            }
          </div>

          <div class="card">
            <div class="card-header">
              <h2>Add Saved Dishes to This Menu</h2>
              <span class="card-subtitle">Reusing a dish across multiple menus creates a safe independent snapshot</span>
            </div>
            <div class="rec-card-list">
              <div class="rec-mini-card">
                <div class="rec-mini-top">
                  <strong>Current Working Dish: ${escapeHtml(this.state.workingDish.name)}</strong>
                  <span class="badge badge-strong">${pluralize(
                    this.state.workingDish.ingredients.length,
                    "ingredient"
                  )}</span>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  style="margin-top: 6px;"
                  data-action="add-working-dish-to-menu"
                >
                  + Add Working Dish to Menu
                </button>
              </div>

              ${this.state.savedDishes
                .map(
                  (d) => `
                  <div class="rec-mini-card">
                    <div class="rec-mini-top">
                      <strong>${escapeHtml(d.name)}</strong>
                      <span class="badge badge-neutral">${pluralize(d.ingredients.length, "ingredient")}</span>
                    </div>
                    <div class="inline-action-group" style="margin-top: 6px;">
                      <select id="course-select-for-${escapeHtml(
                        d.id
                      )}" class="form-select form-select-sm" aria-label="Course role for ${escapeHtml(
                    d.name
                  )}">
                        ${STANDARD_COURSE_TYPES.map(
                          (ct) =>
                            `<option value="${escapeHtml(ct.id)}" ${
                              d.courseRole === ct.id ? "selected" : ""
                            }>${escapeHtml(ct.label)}</option>`
                        ).join("")}
                      </select>
                      <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        data-action="add-saved-dish-to-menu"
                        data-dish-id="${escapeHtml(d.id)}"
                      >
                        + Add Snapshot to Menu
                      </button>
                    </div>
                  </div>
                `
                )
                .join("")}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  _renderLibraryAndBackups() {
    return `
      <div class="workbench-grid">
        <section class="panel-col" aria-label="Saved Dishes and Menus">
          <div class="card">
            <div class="card-header">
              <h2>Saved Dishes Library (${this.state.savedDishes.length})</h2>
            </div>
            ${
              this.state.savedDishes.length === 0
                ? `<div class="empty-state">No saved dishes in storage yet.</div>`
                : `
                <div class="rec-card-list">
                  ${this.state.savedDishes
                    .map(
                      (d) => `
                      <div class="rec-mini-card">
                        <div class="rec-mini-top">
                          <strong>${escapeHtml(d.name)}</strong>
                          <span class="badge badge-neutral">${pluralize(
                            d.ingredients.length,
                            "ingredient"
                          )} · Updated ${new Date(d.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <p class="rec-mini-desc">
                          Ingredients: ${escapeHtml(
                            d.ingredients
                              .map(
                                (i) =>
                                  this.graph.ingredients.get(i.ingredientId)?.name ||
                                  i.fallbackName ||
                                  i.ingredientId
                              )
                              .join(", ") || "None"
                          )}
                        </p>
                        <div class="inline-action-group">
                          <button
                            type="button"
                            class="btn btn-sm btn-primary"
                            data-action="open-saved-dish"
                            data-dish-id="${escapeHtml(d.id)}"
                          >
                            Open in Dish Workbench
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-danger-outline"
                            data-action="delete-saved-dish"
                            data-dish-id="${escapeHtml(d.id)}"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
            }
          </div>

          <div class="card">
            <div class="card-header">
              <h2>Saved Menus Library (${this.state.savedMenus.length})</h2>
            </div>
            ${
              this.state.savedMenus.length === 0
                ? `<div class="empty-state">No saved menus in storage yet.</div>`
                : `
                <div class="rec-card-list">
                  ${this.state.savedMenus
                    .map(
                      (m) => `
                      <div class="rec-mini-card">
                        <div class="rec-mini-top">
                          <strong>${escapeHtml(m.name)}</strong>
                          <span class="badge badge-neutral">${pluralize(m.items.length, "course")}</span>
                        </div>
                        <div class="inline-action-group" style="margin-top: 6px;">
                          <button
                            type="button"
                            class="btn btn-sm btn-primary"
                            data-action="open-saved-menu"
                            data-menu-id="${escapeHtml(m.id)}"
                          >
                            Open in Menu Builder
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-danger-outline"
                            data-action="delete-saved-menu"
                            data-menu-id="${escapeHtml(m.id)}"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
            }
          </div>
        </section>

        <section class="panel-col" aria-label="Import Export and Storage Limitations">
          <div class="card">
            <div class="card-header">
              <h2>Structured JSON Backup — Export &amp; Import</h2>
              <span class="card-subtitle">Preserves dishes, menus, explicit compatibility overrides, and legacy ingredient names</span>
            </div>

            <div class="storage-disclosure-box">
              <strong>Browser Storage &amp; Privacy Disclosure:</strong>
              All dishes, menus, and preferences persist locally in your browser via <code>IndexedDB</code> (${escapeHtml(
                this.state.storageStatus.backendType
              )}). No account, server database, or external telemetry is used. Browser storage can be cleared if you wipe site data, close a private window, or hit storage limits. Export a JSON backup below to keep a permanent copy.
            </div>

            <div class="form-row-split" style="margin-top: 12px;">
              <div>
                <label for="import-conflict-mode-select" class="form-label">Duplicate ID Import Behavior</label>
                <select id="import-conflict-mode-select" class="form-select">
                  <option value="merge" ${
                    this.state.importConflictMode === "merge" ? "selected" : ""
                  }>Merge (Update matching IDs, keep existing)</option>
                  <option value="keep_both" ${
                    this.state.importConflictMode === "keep_both" ? "selected" : ""
                  }>Keep Both (Assign new ID to duplicates)</option>
                  <option value="replace" ${
                    this.state.importConflictMode === "replace" ? "selected" : ""
                  }>Replace All Existing Data</option>
                </select>
              </div>
              <div>
                <label for="backup-file-input" class="form-label">Load JSON Backup File from Disk</label>
                <input id="backup-file-input" type="file" accept=".json,application/json" class="form-input" />
              </div>
            </div>

            <div class="inline-action-group" style="margin: 12px 0;">
              <button type="button" class="btn btn-primary" data-action="export-json-backup">
                Export All Data to JSON
              </button>
              <button type="button" class="btn btn-secondary" data-action="import-json-backup">
                Validate &amp; Import JSON
              </button>
            </div>

            <div class="form-row" style="margin-bottom: 0;">
              <label for="backup-json-textarea" class="form-label">JSON Backup Payload Inspector / Editor</label>
              <textarea
                id="backup-json-textarea"
                class="form-textarea mono-textarea"
                rows="12"
                placeholder="Click 'Export All Data to JSON' to view or download your structured backup, or paste a backup JSON payload here and click 'Validate & Import JSON'..."
              >${escapeHtml(this.state.backupJsonText || "")}</textarea>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  _renderAiPromptStudio() {
    if (!this.state.generatedPrompt) {
      this._refreshAiPrompt();
    }
    const promptObj = this.state.generatedPrompt;

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h2>Optional External AI Prompt Generator</h2>
            <span class="card-subtitle">
              Generates a self-contained, structured prompt from your selections for use in ChatGPT, Claude, Gemini, or any external assistant. No data is transmitted automatically.
            </span>
          </div>
          <div class="segmented-control">
            <button
              type="button"
              class="seg-btn ${this.state.aiPromptScope === "dish" ? "seg-btn-active" : ""}"
              data-action="set-ai-scope"
              data-scope="dish"
            >
              Scope: Current Dish
            </button>
            <button
              type="button"
              class="seg-btn ${this.state.aiPromptScope === "menu" ? "seg-btn-active" : ""}"
              data-action="set-ai-scope"
              data-scope="menu"
            >
              Scope: Complete Menu
            </button>
          </div>
        </div>

        <div class="form-row-split">
          <div>
            <label for="ai-objective-input" class="form-label">Optional Specific Culinary Goal or Constraint</label>
            <input
              id="ai-objective-input"
              type="text"
              class="form-input"
              value="${escapeHtml(this.state.aiCulinaryObjective)}"
              placeholder="e.g., Refine plating and suggest a wine or non-alcoholic pairing..."
            />
          </div>
          <div class="inline-action-group" style="align-items: flex-end;">
            <button type="button" class="btn btn-secondary" data-action="generate-ai-prompt">
              Refresh Prompt
            </button>
            <button type="button" class="btn btn-primary" data-action="copy-ai-prompt">
              Copy Prompt to Clipboard
            </button>
          </div>
        </div>

        <div class="form-row" style="margin-top: 12px; margin-bottom: 0;">
          <label for="ai-prompt-output-textarea" class="form-label">
            ${escapeHtml(promptObj.title)} (${pluralize(promptObj.includedIngredientCount, "ingredient")}, ${pluralize(
      promptObj.includedOverrideCount,
      "intentional override"
    )} included)
          </label>
          <textarea
            id="ai-prompt-output-textarea"
            class="form-textarea mono-textarea"
            rows="20"
            readonly
          >${escapeHtml(promptObj.promptText)}</textarea>
        </div>
      </div>
    `;
  }

  renderKnowledgeCatalogListOnly() {
    const slot = this.root.querySelector("#knowledge-catalog-results-slot");
    if (!slot) return;
    slot.innerHTML = this._buildKnowledgeCatalogListHtml();
  }

  _buildKnowledgeCatalogListHtml() {
    const q = (this.state.knowledgeSearchQuery || "").trim().toLowerCase();
    const catFilter = this.state.knowledgeCategoryFilter || "";
    const activeDishIds = new Set((this.state.workingDish.ingredients || []).map((i) => i.ingredientId));
    const allIngs = Array.from(this.graph.ingredients.values());
    const filteredIngs = allIngs.filter((i) => {
      if (catFilter && !(i.categories || []).includes(catFilter)) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.categories || []).some((c) => c.toLowerCase().includes(q)) ||
        (i.aliases || []).some((a) => a.toLowerCase().includes(q))
      );
    });

    if (filteredIngs.length === 0) {
      return `<div class="empty-state">No canonical ingredients match "${escapeHtml(
        this.state.knowledgeSearchQuery
      )}".</div>`;
    }

    return filteredIngs
      .slice(0, 40)
      .map((ing) => {
        const inDish = activeDishIds.has(ing.id);
        return `
        <div class="rec-mini-card">
          <div class="rec-mini-top">
            <div>
              <strong>${escapeHtml(ing.name)}</strong>
              <span class="badge badge-neutral" style="margin-left: 6px;"><code>${escapeHtml(ing.id)}</code></span>
            </div>
            ${
              inDish
                ? `<span class="badge badge-strong">[✓] In Working Dish</span>`
                : `<button type="button" class="btn btn-sm btn-secondary" data-action="add-catalog-ing-to-dish" data-ing-id="${escapeHtml(
                    ing.id
                  )}">+ Add to Dish</button>`
            }
          </div>
          <p class="rec-mini-desc">${escapeHtml(ing.culinaryNotes)}</p>
          <div class="rec-mini-meta">
            <span>Categories: ${(ing.categories || []).map((c) => `<button type="button" class="tag-pill tag-pill-clickable" data-action="set-knowledge-category" data-cat="${escapeHtml(c)}">${escapeHtml(formatSlug(c))}</button>`).join(" ")}</span> ·
            <span>Roles: ${escapeHtml(ing.defaultRoles.map(formatSlug).join(", "))}</span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  _renderKnowledgeAndProvenance() {
    const allIngs = Array.from(this.graph.ingredients.values());
    const quickCats = [
      ["", "All (491)"],
      ["meat", "Meat"],
      ["poultry", "Poultry"],
      ["fish", "Fish"],
      ["shellfish", "Shellfish"],
      ["vegetables", "Vegetables"],
      ["fruits", "Fruits"],
      ["herbs", "Herbs"],
      ["spices", "Spices"],
      ["dairy", "Dairy & Cheese"],
      ["grains", "Grains"],
      ["legumes", "Legumes"],
      ["acids", "Acids"],
      ["fermented", "Ferments"]
    ];

    return `
      <div class="workbench-grid">
        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <h2>Source Provenance &amp; Licensing Registry</h2>
              <span class="card-subtitle">Zero unauthorized copyrighted compilation data; 100% documented provenance</span>
            </div>
            <div class="rec-card-list">
              ${Array.from(this.graph.sources.values())
                .map(
                  (src) => `
                  <div class="rec-mini-card">
                    <div class="rec-mini-top">
                      <strong>${escapeHtml(src.title)}</strong>
                      <span class="badge badge-strong">${escapeHtml(src.license)}</span>
                    </div>
                    <p class="rec-mini-desc">
                      <strong>Publisher:</strong> ${escapeHtml(src.publisher)} · <strong>Tier:</strong> <code>${escapeHtml(
                    src.tier
                  )}</code>
                    </p>
                    <p class="rec-mini-desc">${escapeHtml(src.attribution)}</p>
                  </div>
                `
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <h2>Canonical Ingredient Catalog Explorer (${allIngs.length} Ingredients)</h2>
              <span class="card-subtitle">Click "+ Add to Dish" to send any catalog item directly to the Workbench</span>
            </div>
            <div class="form-row">
              <label for="knowledge-catalog-search" class="form-label">Filter Catalog by Name, Alias, or Category</label>
              <div class="search-input-wrap">
                <input
                  id="knowledge-catalog-search"
                  type="text"
                  class="form-input"
                  value="${escapeHtml(this.state.knowledgeSearchQuery)}"
                  placeholder="Filter 491 canonical ingredients (press / to focus)..."
                />
                <div class="search-input-accessory">
                  ${
                    this.state.knowledgeSearchQuery || this.state.knowledgeCategoryFilter
                      ? `<button type="button" class="search-clear-btn" data-action="clear-knowledge-search">Clear ×</button>`
                      : `<kbd class="kbd-hint">/</kbd>`
                  }
                </div>
              </div>
            </div>
            <div class="chip-group" style="margin-bottom: 12px;">
              ${quickCats
                .map(
                  ([catId, label]) => `
                  <button
                    type="button"
                    class="chip ${this.state.knowledgeCategoryFilter === catId ? "chip-active" : ""}"
                    data-action="set-knowledge-category"
                    data-cat="${escapeHtml(catId)}"
                  >${escapeHtml(label)}</button>
                `
                )
                .join("")}
            </div>
            <div id="knowledge-catalog-results-slot" class="rec-card-list" data-preserve-scroll="kb-catalog">
              ${this._buildKnowledgeCatalogListHtml()}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  getAllAvailableRecipes() {
    const map = new Map();
    for (const r of this.builtinRecipes || []) {
      map.set(r.id, r);
    }
    for (const r of this.state.savedRecipes || []) {
      map.set(r.id, r);
    }
    return Array.from(map.values());
  }

  getActiveRecipe() {
    const all = this.getAllAvailableRecipes();
    return all.find((r) => r.id === this.state.activeRecipeId) || all[0] || null;
  }

  renderRecipeListOnly() {
    const slot = this.root.querySelector("#recipe-discovery-results-slot");
    if (!slot) return;
    slot.innerHTML = this._buildRecipeListHtml();
  }

  _getEvaluatedRecipes() {
    const selectedIds = this.state.recipeUseDishIngredients
      ? (this.state.workingDish.ingredients || []).map((i) => i.ingredientId)
      : this.state.pantryIngredientIds || [];

    return discoverRecipes({
      recipes: this.getAllAvailableRecipes(),
      knowledgeGraph: this.graph,
      selectedIngredientIds: selectedIds,
      searchQuery: this.state.recipeSearchQuery,
      collectionFilter: this.state.recipeCollectionFilter,
      chefFilter: this.state.recipeChefFilter,
      courseFilter: this.state.recipeCourseFilter,
      matchFilter: this.state.recipeMatchFilter,
      assumePantryStaples: true
    });
  }

  _buildRecipeListHtml() {
    const evaluated = this._getEvaluatedRecipes();
    if (evaluated.length === 0) {
      return `<div class="empty-state">No recipes match the current filters. Try switching "Missing Ingredient Filter" to "All Recipes" or clearing the search box.</div>`;
    }

    return evaluated
      .map((item) => {
        const r = item.recipe;
        const isActive = r.id === this.state.activeRecipeId;
        const rankBadge = r.rank
          ? `<span class="badge badge-strong">NYT #${r.rank} of 2025</span>`
          : r.isCustom
          ? `<span class="badge badge-warning">Custom / Personalized</span>`
          : `<span class="badge badge-role">Chef Signature</span>`;

        const matchBadgeClass =
          item.matchTier === "ready_to_cook" || item.matchTier === "almost_there"
            ? "badge-strong"
            : item.matchTier === "few_missing"
            ? "badge-warning"
            : "badge-neutral";

        return `
          <div
            class="recipe-card-item ${isActive ? "recipe-card-active" : ""}"
            data-action="select-recipe-card"
            data-recipe-id="${escapeHtml(r.id)}"
          >
            <div class="rec-card-header">
              <div>
                ${rankBadge}
                <strong style="font-size: 14px; margin-left: 4px;">${escapeHtml(r.title)}</strong>
              </div>
              <span class="badge ${matchBadgeClass}">${escapeHtml(item.matchLabel)}</span>
            </div>
            <div class="rec-mini-meta" style="margin-top: 4px;">
              <span>By <strong>${escapeHtml(r.author)}</strong></span> ·
              <span>${r.totalTimeMinutes} min (${r.prepTimeMinutes}m prep / ${r.cookTimeMinutes}m cook)</span> ·
              <span>Serves ${r.servings}</span>
            </div>
            ${
              item.matchedIngredients.length > 0
                ? `<div style="font-size: 12px; color: var(--color-success); margin-top: 3px;">
                    <strong>[✓] Uses your ingredients (${item.matchedIngredients.length}):</strong> ${escapeHtml(
                    item.matchedIngredients.map((i) => i.name).join(", ")
                  )}
                  </div>`
                : ""
            }
            ${
              item.missingEssentialIngredients.length > 0 && item.missingEssentialIngredients.length <= 5
                ? `<div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
                    <strong>[+] Additional needed (${item.missingEssentialIngredients.length}):</strong> ${escapeHtml(
                    item.missingEssentialIngredients.map((i) => i.name).join(", ")
                  )}
                  </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  _renderRecipeDiscoveryStudio() {
    const dishIngCount = (this.state.workingDish.ingredients || []).length;
    return `
      <div class="preset-bar" aria-label="Recipe Discovery Sub-Navigation">
        <div class="preset-group">
          <span class="preset-label">Recipe Studio:</span>
          <button
            type="button"
            class="btn btn-sm ${this.state.recipeSubView === "discover" ? "btn-primary" : "btn-secondary"}"
            data-action="set-recipe-subview"
            data-subview="discover"
          >
            Discover &amp; Cook (NYT 2025 Top 50 + Chef Canon)
          </button>
          <button
            type="button"
            class="btn btn-sm ${this.state.recipeSubView === "chefs" ? "btn-primary" : "btn-secondary"}"
            data-action="set-recipe-subview"
            data-subview="chefs"
          >
            Renowned Chef Collections (${this.chefCollections.length} Chefs)
          </button>
          <button
            type="button"
            class="btn btn-sm ${this.state.recipeSubView === "shopping" ? "btn-primary" : "btn-secondary"}"
            data-action="set-recipe-subview"
            data-subview="shopping"
          >
            Shopping List (${pluralize(this.state.shoppingListRecipeIds.length, "Recipe")})
          </button>
          <button
            type="button"
            class="btn btn-sm ${this.state.recipeSubView === "editor" ? "btn-primary" : "btn-secondary"}"
            data-action="set-recipe-subview"
            data-subview="editor"
          >
            + Create or Import Recipes (${this.state.savedRecipes.length} Saved)
          </button>
        </div>
        <div class="preset-group">
          <button
            type="button"
            class="btn btn-sm ${this.state.recipeUseDishIngredients ? "btn-primary" : "btn-secondary"}"
            data-action="toggle-recipe-use-dish-ings"
          >
            ${
              this.state.recipeUseDishIngredients
                ? `[✓] Matching Dish Ingredients (${dishIngCount})`
                : `Match Active Dish Ingredients (${dishIngCount})`
            }
          </button>
        </div>
      </div>

      ${
        this.state.recipeSubView === "chefs"
          ? this._renderChefCollectionsView()
          : this.state.recipeSubView === "shopping"
          ? this._renderShoppingListView()
          : this.state.recipeSubView === "editor"
          ? this._renderRecipeEditorView()
          : this._renderRecipeDiscoverAndInspectorView()
      }
    `;
  }

  _renderRecipeDiscoverAndInspectorView() {
    const activeRec = this.getActiveRecipe();
    const targetServings = this.state.recipeTargetServings || activeRec?.servings || 4;
    const unitSystem = this.state.recipeUnitSystem || "original";
    const scaledIngs = activeRec
      ? scaleRecipeIngredients(activeRec, targetServings, unitSystem, this.nutritionCache)
      : [];
    const nutrition = activeRec
      ? calculateRecipeNutrition(activeRec, this.nutritionCache, { servings: targetServings })
      : null;

    const totalSteps = activeRec?.steps?.length || 0;
    const doneSteps = activeRec
      ? (activeRec.steps || []).filter((st, idx) =>
          Boolean(this.state.completedSteps[`${activeRec.id}::${st.stepNumber || idx + 1}`])
        ).length
      : 0;
    const donePct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

    return `
      <div class="workbench-grid">
        <!-- LEFT COLUMN: Filter Bar & Ranked Recipe List -->
        <section class="panel-col" aria-label="Recipe Discovery Catalog">
          <div class="card">
            <div class="card-header">
              <h2>Recipe Discovery &amp; Missing-Ingredient Matcher</h2>
              <span class="card-subtitle">
                NYT Cooking's 50 Most Popular Recipes of 2025 + Renowned Chef Signature Dishes
              </span>
            </div>

            <div class="form-row">
              <label for="recipe-discovery-search" class="form-label">Search by Title, Chef, Ingredient, or Tag</label>
              <div class="search-input-wrap">
                <input
                  id="recipe-discovery-search"
                  type="text"
                  class="form-input"
                  value="${escapeHtml(this.state.recipeSearchQuery)}"
                  placeholder="e.g., Smashed Beef Kebab, Miso Salmon, Hummus Pasta, Kenji, Ottolenghi..."
                />
                <div class="search-input-accessory">
                  ${
                    this.state.recipeSearchQuery
                      ? `<button type="button" class="search-clear-btn" data-action="clear-recipe-search">Clear ×</button>`
                      : `<kbd class="kbd-hint">/</kbd>`
                  }
                </div>
              </div>
            </div>

            <div class="recipe-filter-grid">
              <div>
                <label for="recipe-collection-filter" class="form-label">Collection</label>
                <select id="recipe-collection-filter" class="form-select">
                  <option value="all" ${this.state.recipeCollectionFilter === "all" ? "selected" : ""}>All Collections (${this.getAllAvailableRecipes().length})</option>
                  <option value="nyt_top_50_2025" ${this.state.recipeCollectionFilter === "nyt_top_50_2025" ? "selected" : ""}>NYT Cooking 50 Most Popular of 2025 (50)</option>
                  <option value="renowned_chefs" ${this.state.recipeCollectionFilter === "renowned_chefs" ? "selected" : ""}>Renowned Chef Signature Canon</option>
                  <option value="user_custom" ${this.state.recipeCollectionFilter === "user_custom" ? "selected" : ""}>My Personalized / Imported Recipes (${this.state.savedRecipes.length})</option>
                </select>
              </div>

              <div>
                <label for="recipe-chef-filter" class="form-label">Chef / Author</label>
                <select id="recipe-chef-filter" class="form-select">
                  <option value="all" ${this.state.recipeChefFilter === "all" ? "selected" : ""}>All Chefs &amp; Authors</option>
                  ${this.chefCollections
                    .map(
                      (c) =>
                        `<option value="${escapeHtml(c.id)}" ${
                          this.state.recipeChefFilter === c.id ? "selected" : ""
                        }>${escapeHtml(c.name)} (${c.recipeIds?.length || 0})</option>`
                    )
                    .join("")}
                </select>
              </div>

              <div>
                <label for="recipe-match-filter" class="form-label">Missing Ingredient Filter</label>
                <select id="recipe-match-filter" class="form-select">
                  <option value="all" ${this.state.recipeMatchFilter === "all" ? "selected" : ""}>All Recipes</option>
                  <option value="ready_or_almost" ${this.state.recipeMatchFilter === "ready_or_almost" ? "selected" : ""}>Ready or Almost There (0–2 Missing)</option>
                  <option value="up_to_4_missing" ${this.state.recipeMatchFilter === "up_to_4_missing" ? "selected" : ""}>Few Additional (≤ 4 Missing)</option>
                  <option value="uses_selected" ${this.state.recipeMatchFilter === "uses_selected" ? "selected" : ""}>Uses Any Selected Ingredient</option>
                </select>
              </div>

              <div>
                <label for="recipe-course-filter" class="form-label">Course / Dish Type</label>
                <select id="recipe-course-filter" class="form-select">
                  <option value="all" ${this.state.recipeCourseFilter === "all" ? "selected" : ""}>All Course Types</option>
                  <option value="main_course" ${this.state.recipeCourseFilter === "main_course" ? "selected" : ""}>Main Courses</option>
                  <option value="pasta_grain" ${this.state.recipeCourseFilter === "pasta_grain" ? "selected" : ""}>Pasta, Noodles &amp; Grains</option>
                  <option value="soup" ${this.state.recipeCourseFilter === "soup" ? "selected" : ""}>Soups &amp; Stews</option>
                  <option value="salad_vegetable" ${this.state.recipeCourseFilter === "salad_vegetable" ? "selected" : ""}>Salads &amp; Vegetable Mains</option>
                  <option value="side_dish" ${this.state.recipeCourseFilter === "side_dish" ? "selected" : ""}>Side Dishes</option>
                  <option value="starter" ${this.state.recipeCourseFilter === "starter" ? "selected" : ""}>Starters</option>
                  <option value="dessert" ${this.state.recipeCourseFilter === "dessert" ? "selected" : ""}>Desserts &amp; Baking</option>
                  <option value="beverage" ${this.state.recipeCourseFilter === "beverage" ? "selected" : ""}>Beverages</option>
                </select>
              </div>
            </div>

            <div id="recipe-discovery-results-slot" class="recipe-list-scroll" data-preserve-scroll="recipe-list">
              ${this._buildRecipeListHtml()}
            </div>
          </div>
        </section>

        <!-- RIGHT COLUMN: Active Recipe Cooking Studio & Process Diagram -->
        <section class="panel-col" aria-label="Active Recipe Cooking Instruction Studio">
          ${
            !activeRec
              ? `<div class="card"><div class="empty-state">Select a recipe on the left to inspect its ingredients, step-by-step instructions, and Cooking for Engineers diagram.</div></div>`
              : `
              <div class="card">
                <div class="card-header">
                  <div>
                    ${
                      activeRec.rank
                        ? `<span class="badge badge-strong">NYT Cooking #${activeRec.rank} Most Popular of 2025</span>`
                        : `<span class="badge badge-role">Chef Signature Collection</span>`
                    }
                    <h2 style="margin-top: 6px; font-size: 20px;">${escapeHtml(activeRec.title)}</h2>
                    <div class="card-subtitle" style="margin-top: 2px;">
                      By <strong>${escapeHtml(activeRec.author)}</strong> ·
                      Prep: ${activeRec.prepTimeMinutes}m · Cook: ${activeRec.cookTimeMinutes}m · Total: ${
                  activeRec.totalTimeMinutes
                }m ·
                      Difficulty: ${escapeHtml(activeRec.difficulty)}
                      ${
                        activeRec.sourceUrl
                          ? ` · <a href="${escapeHtml(
                              activeRec.sourceUrl
                            )}" target="_blank" rel="noopener noreferrer">Source Reference ↗</a>`
                          : ""
                      }
                    </div>
                  </div>
                </div>

                <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--color-text); background: #F4F1EA; padding: 10px 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--color-secondary);">
                  <strong>Culinary Architecture &amp; Why It Works:</strong> ${escapeHtml(activeRec.headnote)}
                </p>

                <!-- 1-Click Integration Actions -->
                <div class="inline-action-group" style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border);">
                  <button type="button" class="btn btn-sm btn-primary" data-action="load-recipe-into-workbench">
                    Open in Dish Workbench
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="merge-recipe-into-workbench">
                    + Merge Ingredients into Dish
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="add-recipe-to-menu">
                    + Add Recipe as Course in Menu
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="add-recipe-to-shopping-list">
                    + Add to Shopping List
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="duplicate-personalize-recipe">
                    Duplicate &amp; Personalize
                  </button>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="print-kitchen-sheet">
                    Print Recipe Sheet
                  </button>
                  ${
                    activeRec.isCustom
                      ? `<button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-saved-recipe" data-recipe-id="${escapeHtml(
                          activeRec.id
                        )}">Delete Custom Recipe</button>`
                      : ""
                  }
                </div>

                <!-- Scaling & Unit Segmented Controls -->
                <div class="form-row-split" style="margin-bottom: 12px;">
                  <div>
                    <span class="form-label">Scale Yield (Current: ${targetServings} Servings, Base: ${
                  activeRec.servings
                })</span>
                    <div class="segmented-control segmented-control-full">
                      ${[0.5, 1, 1.5, 2, 3]
                        .map((mult) => {
                          const s = Math.max(1, Math.round(activeRec.servings * mult));
                          const active = targetServings === s;
                          return `<button type="button" class="seg-btn ${
                            active ? "seg-btn-active" : ""
                          }" data-action="scale-recipe-servings" data-mult="${mult}">${mult}× (${s})</button>`;
                        })
                        .join("")}
                    </div>
                  </div>
                  <div>
                    <span class="form-label">Measurement &amp; Temperature System</span>
                    <div class="segmented-control segmented-control-full">
                      <button type="button" class="seg-btn ${
                        unitSystem === "original" ? "seg-btn-active" : ""
                      }" data-action="set-recipe-unit-system" data-unit-system="original">Original</button>
                      <button type="button" class="seg-btn ${
                        unitSystem === "metric" ? "seg-btn-active" : ""
                      }" data-action="set-recipe-unit-system" data-unit-system="metric">Metric (g, ml, °C)</button>
                      <button type="button" class="seg-btn ${
                        unitSystem === "imperial" ? "seg-btn-active" : ""
                      }" data-action="set-recipe-unit-system" data-unit-system="imperial">Imperial (oz, °F)</button>
                    </div>
                  </div>
                </div>

                <!-- Instruction Mode Switcher (Single-Line Segmented Control) -->
                <div class="segmented-control segmented-control-full" style="margin-bottom: 12px;" role="tablist" aria-label="Cooking Instruction Display Mode">
                  <button
                    type="button"
                    class="seg-btn ${
                      this.state.recipeInstructionMode === "step_by_step" ? "seg-btn-active" : ""
                    }"
                    data-action="set-recipe-instruction-mode"
                    data-mode="step_by_step"
                  >
                    1. Step-by-Step (${activeRec.steps.length} Steps)
                  </button>
                  <button
                    type="button"
                    class="seg-btn ${
                      this.state.recipeInstructionMode === "cooking_for_engineers"
                        ? "seg-btn-active"
                        : ""
                    }"
                    data-action="set-recipe-instruction-mode"
                    data-mode="cooking_for_engineers"
                  >
                    2. Cooking for Engineers Diagram
                  </button>
                  <button
                    type="button"
                    class="seg-btn ${
                      this.state.recipeInstructionMode === "nutrition_facts" ? "seg-btn-active" : ""
                    }"
                    data-action="set-recipe-instruction-mode"
                    data-mode="nutrition_facts"
                  >
                    3. USDA Nutrition (${nutrition ? nutrition.perServing.calories : 0} kcal/serv)
                  </button>
                </div>

                ${
                  this.state.recipeInstructionMode !== "nutrition_facts"
                    ? `
                    <div class="recipe-progress-bar-wrap">
                      <div style="flex: 1 1 auto;">
                        <div class="meter-label-row">
                          <span><strong>Cooking Stage Progress:</strong> ${doneSteps} of ${totalSteps} stages completed</span>
                          <span class="mono-num">${donePct}%</span>
                        </div>
                        <div class="meter-track">
                          <div class="meter-fill meter-fill-acidity" style="width: ${donePct}%"></div>
                        </div>
                      </div>
                      ${
                        doneSteps > 0
                          ? `<button type="button" class="search-clear-btn" data-action="reset-recipe-steps">Reset Progress</button>`
                          : ""
                      }
                    </div>
                  `
                    : ""
                }

                ${
                  this.state.recipeInstructionMode === "cooking_for_engineers"
                    ? renderCookingForEngineersHtml(activeRec, {
                        targetServings,
                        unitSystem,
                        nutritionCache: this.nutritionCache,
                        completedSteps: this.state.completedSteps
                      })
                    : this.state.recipeInstructionMode === "nutrition_facts"
                    ? this._renderRecipeNutritionPanel(activeRec, nutrition)
                    : this._renderRecipeStepByStepPanel(activeRec, scaledIngs, unitSystem)
                }
              </div>
            `
          }
        </section>
      </div>
    `;
  }

  _renderRecipeStepByStepPanel(recipe, scaledIngs, unitSystem) {
    return `
      <div>
        <h3 class="subsection-title">Scaled Ingredients (${scaledIngs.length} Components)</h3>
        <div class="selected-ingredients-list" style="margin-bottom: 14px;">
          ${scaledIngs
            .map(
              (ing) => `
              <div class="selected-item-row" style="padding: 7px 10px;">
                <div>
                  <code style="font-weight: 600; color: var(--color-primary);">${escapeHtml(
                    ing.formattedMeasurement
                  )}</code>
                  <strong style="margin-left: 6px;">${escapeHtml(ing.name)}</strong>${
                ing.preparationNote
                  ? `<span style="color: var(--color-text-muted);">, ${escapeHtml(
                      ing.preparationNote
                    )}</span>`
                  : ""
              }
                </div>
                <div class="inline-action-group">
                  <span class="badge badge-role">${escapeHtml(ing.componentGroup || "Main")}</span>
                  <span class="badge badge-neutral">${escapeHtml(formatSlug(ing.role || "component"))}</span>
                </div>
              </div>
            `
            )
            .join("")}
        </div>

        <h3 class="subsection-title">Structured Cooking Steps (Click Step to Check Off · Click Timer to Count Down)</h3>
        <div>
          ${(recipe.steps || [])
            .map((st, idx) => {
              const stepNum = st.stepNumber || idx + 1;
              const stepKey = `${recipe.id}::${stepNum}`;
              const isDone = Boolean(this.state.completedSteps[stepKey]);
              const tempStr = formatTemperatureForSystem(st.temperature || "", unitSystem);
              const usedIngs = (st.ingredientIndices || [])
                .map((i) => scaledIngs[i])
                .filter(Boolean);

              return `
                <div
                  class="step-card ${isDone ? "step-card-done" : ""}"
                  data-action="toggle-recipe-step-done"
                  data-step-key="${escapeHtml(stepKey)}"
                  style="cursor: pointer;"
                >
                  <div class="rec-card-header">
                    <div>
                      <span class="badge badge-strong">${isDone ? "[✓] Completed" : `Step ${stepNum}`}</span>
                      <strong style="margin-left: 6px; font-size: 14px;">${escapeHtml(
                        st.phase || "Stage"
                      )} — ${escapeHtml(st.actionVerb || "")}</strong>
                    </div>
                    <div class="inline-action-group">
                      ${
                        st.durationMinutes
                          ? `<button
                              type="button"
                              class="badge badge-role cfe-timer-btn"
                              data-action="start-step-timer"
                              data-minutes="${st.durationMinutes}"
                              data-label="${escapeHtml(`${recipe.title} — Step ${stepNum}: ${st.actionVerb || "Stage"}`)}"
                              title="Start ${st.durationMinutes} min kitchen timer"
                            >⏱ ${st.durationMinutes} min</button>`
                          : ""
                      }
                      ${tempStr ? `<span class="badge badge-neutral">${escapeHtml(tempStr)}</span>` : ""}
                    </div>
                  </div>
                  <p style="margin: 6px 0; font-size: 13.5px;">${escapeHtml(st.instruction)}</p>
                  ${
                    st.sensoryCue
                      ? `<div style="font-size: 12px; color: var(--color-success);"><strong>Sensory Target:</strong> ${escapeHtml(
                          st.sensoryCue
                        )}</div>`
                      : ""
                  }
                  ${
                    usedIngs.length > 0
                      ? `<div style="font-size: 11.5px; color: var(--color-text-muted); margin-top: 4px;">
                          <strong>Stage Inputs:</strong> ${escapeHtml(
                          usedIngs.map((i) => `${i.formattedMeasurement} ${i.name}`).join(" · ")
                        )}
                        </div>`
                      : ""
                  }
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  _renderRecipeNutritionPanel(recipe, nutrition) {
    if (!nutrition) return "";
    const p = nutrition.perServing;
    const dv = nutrition.dailyValuePct;
    return `
      <div>
        <h3 class="subsection-title">Per-Serving USDA Nutrition Estimate (1 of ${nutrition.servings} Servings)</h3>
        <p class="card-subtitle" style="margin-bottom: 8px;">
          Computed deterministically from ${escapeHtml(nutrition.provenance)} with thermal preparation retention factors.
        </p>

        <div class="nutrition-grid">
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Calories</div>
            <strong style="font-size: 18px;">${p.calories} kcal</strong>
            <div class="card-subtitle">${dv.calories}% DV</div>
          </div>
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Protein (${nutrition.macroSplitPct.protein}%)</div>
            <strong style="font-size: 18px;">${p.protein_g} g</strong>
            <div class="card-subtitle">${dv.protein_g}% DV</div>
          </div>
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Total Fat (${nutrition.macroSplitPct.fat}%)</div>
            <strong style="font-size: 18px;">${p.fat_g} g</strong>
            <div class="card-subtitle">Sat Fat: ${p.saturated_fat_g}g (${dv.saturated_fat_g}% DV)</div>
          </div>
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Carbohydrates (${nutrition.macroSplitPct.carbs}%)</div>
            <strong style="font-size: 18px;">${p.carbs_g} g</strong>
            <div class="card-subtitle">Fiber: ${p.fiber_g}g (${dv.fiber_g}% DV)</div>
          </div>
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Sodium / Potassium</div>
            <strong style="font-size: 15px;">${p.sodium_mg}mg / ${p.potassium_mg}mg</strong>
            <div class="card-subtitle">${dv.sodium_mg}% / ${dv.potassium_mg}% DV</div>
          </div>
          <div class="nutrition-stat-box">
            <div class="card-subtitle">Calcium / Iron</div>
            <strong style="font-size: 15px;">${p.calcium_mg}mg / ${p.iron_mg}mg</strong>
            <div class="card-subtitle">${dv.calcium_mg}% / ${dv.iron_mg}% DV</div>
          </div>
        </div>

        <h3 class="subsection-title">Per-Ingredient Nutrient Contribution (Whole Recipe)</h3>
        <div class="selected-ingredients-list">
          ${nutrition.breakdownByIngredient
            .map(
              (b) => `
              <div class="selected-item-row" style="padding: 6px 10px;">
                <span><strong>${escapeHtml(b.name)}</strong> (~${b.grams}g)</span>
                <span class="mono-num" style="font-size: 12px;">
                  ${b.calories} kcal · P: ${b.protein_g}g · F: ${b.fat_g}g · C: ${b.carbs_g}g
                </span>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  _renderChefCollectionsView() {
    return `
      <div class="card">
        <div class="card-header">
          <h2>Renowned Chef Signature Collections (${this.chefCollections.length} Culinary Masters)</h2>
          <span class="card-subtitle">
            Explore each chef's culinary philosophy, signature biochemical pairings, and published recipes
          </span>
        </div>
        <div class="chef-grid">
          ${this.chefCollections
            .map((chef) => {
              const chefRecipes = this.getAllAvailableRecipes().filter((r) => r.chefId === chef.id);
              return `
                <div class="rec-card">
                  <div class="rec-card-header">
                    <div>
                      <strong style="font-size: 15px;">${escapeHtml(chef.name)}</strong>
                      <div class="card-subtitle">${escapeHtml(chef.title)}</div>
                    </div>
                    <span class="badge badge-strong">${pluralize(chefRecipes.length, "Recipe")}</span>
                  </div>
                  <p class="rec-explanation">${escapeHtml(chef.philosophy)}</p>
                  <div style="font-size: 12px; margin: 6px 0;">
                    <strong>Signature Dishes in Corpus:</strong>
                    <ul style="margin: 4px 0 8px 18px; padding: 0;">
                      ${chefRecipes
                        .slice(0, 5)
                        .map((r) => `<li>${escapeHtml(r.title)}${r.rank ? ` (NYT #${r.rank})` : ""}</li>`)
                        .join("")}
                    </ul>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    data-action="select-chef-collection"
                    data-chef-id="${escapeHtml(chef.id)}"
                  >
                    Browse ${escapeHtml(chef.name)}'s Recipes →
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  _renderShoppingListView() {
    const all = this.getAllAvailableRecipes();
    const selectedRecipes = this.state.shoppingListRecipeIds
      .map((id) => all.find((r) => r.id === id))
      .filter(Boolean);
    const aggregated = aggregateShoppingList(selectedRecipes, this.graph, this.nutritionCache);
    const checkedCount = aggregated.items.filter((i) => Boolean(this.state.checkedShoppingItems[i.key])).length;

    return `
      <div class="workbench-grid">
        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <h2>Recipes in Active Shopping List (${selectedRecipes.length})</h2>
              <span class="card-subtitle">Ingredients normalize by canonical ID and unify by weight &amp; unit</span>
            </div>
            ${
              selectedRecipes.length === 0
                ? `<div class="empty-state">No recipes queued yet. Open any recipe and click "+ Add to Shopping List".</div>`
                : `
                <div class="rec-card-list">
                  ${selectedRecipes
                    .map(
                      (r) => `
                      <div class="rec-mini-card">
                        <div class="rec-mini-top">
                          <strong>${escapeHtml(r.title)} (Serves ${r.servings})</strong>
                          <button
                            type="button"
                            class="btn btn-sm btn-danger-outline"
                            data-action="remove-recipe-from-shopping-list"
                            data-recipe-id="${escapeHtml(r.id)}"
                          >
                            Remove
                          </button>
                        </div>
                        <div class="rec-mini-meta">By ${escapeHtml(r.author)} · ${pluralize(
                        r.ingredients.length,
                        "ingredient"
                      )}</div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `
            }
          </div>
        </section>

        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <div>
                <h2>Consolidated Grocery List by Aisle (${aggregated.totalUniqueIngredients} Unique Items)</h2>
                <span class="card-subtitle">
                  ${checkedCount} of ${aggregated.totalUniqueIngredients} checked · Total Estimated Weight: ${
      aggregated.totalWeightGrams
    }g (Click any row to check off)
                </span>
              </div>
              <div class="inline-action-group">
                ${
                  checkedCount > 0
                    ? `<button type="button" class="btn btn-sm btn-secondary" data-action="clear-checked-shopping-items">Uncheck All</button>`
                    : ""
                }
                <button type="button" class="btn btn-sm btn-secondary" data-action="print-kitchen-sheet">
                  Print List
                </button>
                <button type="button" class="btn btn-sm btn-primary" data-action="copy-shopping-list">
                  Copy Grocery List
                </button>
              </div>
            </div>
            ${
              aggregated.aisles.length === 0
                ? `<div class="empty-state">Add recipes to view your consolidated aisle-sorted shopping list.</div>`
                : aggregated.aisles
                    .map(
                      (aisle) => `
                      <h3 class="subsection-title">${escapeHtml(aisle.aisle)} (${aisle.items.length})</h3>
                      <div class="selected-ingredients-list">
                        ${aisle.items
                          .map((item) => {
                            const isChecked = Boolean(this.state.checkedShoppingItems[item.key]);
                            return `
                            <div
                              class="selected-item-row ${isChecked ? "shopping-item-checked" : ""}"
                              style="padding: 7px 10px; cursor: pointer;"
                              data-action="toggle-shopping-item-checked"
                              data-item-key="${escapeHtml(item.key)}"
                            >
                              <div>
                                <span class="mono-num" style="margin-right: 6px; color: var(--color-primary);">${
                                  isChecked ? "[✓]" : "[ ]"
                                }</span>
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.isStaple ? `<span class="badge badge-neutral">Pantry Staple</span>` : ""}
                                <div style="font-size: 11px; color: var(--color-text-muted); margin-left: 24px;">
                                  Used in: ${escapeHtml(item.usedInRecipes.join(", "))}
                                </div>
                              </div>
                              <code style="font-weight: 600; color: var(--color-primary);">${escapeHtml(
                                item.formattedAmount
                              )}</code>
                            </div>
                          `;
                          })
                          .join("")}
                      </div>
                    `
                    )
                    .join("")
            }
          </div>
        </section>
      </div>
    `;
  }

  _renderRecipeEditorView() {
    const draft = this.state.recipeEditorDraft || {
      title: "Custom Braised Short Ribs with Gremolata",
      author: "Personal Kitchen",
      servings: 4,
      prepTimeMinutes: 20,
      cookTimeMinutes: 150,
      headnote: "Slow-braised beef short ribs in dry red wine and bone stock finished with bright lemon-parsley gremolata.",
      ingredients: [
        { rawText: "2 lb beef short ribs" },
        { rawText: "2 tbsp extra-virgin olive oil" },
        { rawText: "1 large yellow onion, diced" },
        { rawText: "2 medium carrots, diced" },
        { rawText: "4 cloves garlic, smashed" },
        { rawText: "1 cup dry red wine" },
        { rawText: "2 cups beef stock" },
        { rawText: "1 whole fresh lemon, zested" },
        { rawText: "1/2 cup flat-leaf parsley, chopped" }
      ],
      steps: [
        { instruction: "Sear beef short ribs in hot olive oil for 8 minutes until deeply browned on all sides." },
        { instruction: "Sauté diced onion, carrots, and smashed garlic for 5 minutes until softened." },
        { instruction: "Deglaze with dry red wine, add beef stock, cover, and braise at 325°F for 120 minutes until fork-tender." },
        { instruction: "Garnish with fresh lemon zest and chopped flat-leaf parsley before serving." }
      ]
    };

    const ingText = (draft.ingredients || []).map((i) => i.rawText || `${i.quantity} ${i.unit} ${i.name}`).join("\n");
    const stepText = (draft.steps || []).map((s) => s.instruction || s).join("\n");

    return `
      <div class="workbench-grid">
        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <h2>Create or Personalize Recipe Locally</h2>
              <span class="card-subtitle">Parses fractions, links canonical ingredients, and builds a Cooking for Engineers diagram</span>
            </div>

            <div class="form-row-split">
              <div>
                <label for="recipe-editor-title" class="form-label">Recipe Title</label>
                <input id="recipe-editor-title" type="text" class="form-input" value="${escapeHtml(draft.title)}" />
              </div>
              <div>
                <label for="recipe-editor-author" class="form-label">Author / Attribution</label>
                <input id="recipe-editor-author" type="text" class="form-input" value="${escapeHtml(draft.author)}" />
              </div>
            </div>

            <div class="form-row-split">
              <div>
                <label for="recipe-editor-servings" class="form-label">Servings</label>
                <input id="recipe-editor-servings" type="number" class="form-input" value="${Number(draft.servings || 4)}" />
              </div>
              <div>
                <label for="recipe-editor-prep" class="form-label">Prep Minutes / Cook Minutes</label>
                <div class="inline-action-group">
                  <input id="recipe-editor-prep" type="number" class="form-input" style="flex: 1 1 80px;" value="${Number(draft.prepTimeMinutes || 15)}" />
                  <input id="recipe-editor-cook" type="number" class="form-input" style="flex: 1 1 80px;" value="${Number(draft.cookTimeMinutes || 25)}" />
                </div>
              </div>
            </div>

            <div class="form-row">
              <label for="recipe-editor-headnote" class="form-label">Culinary Notes / Headnote</label>
              <textarea id="recipe-editor-headnote" class="form-textarea" rows="2">${escapeHtml(draft.headnote || "")}</textarea>
            </div>

            <div class="form-row">
              <label for="recipe-editor-ingredients" class="form-label">Ingredients (One per line — fractions like 1 ½, ranges 2-3, and (grams) supported)</label>
              <textarea id="recipe-editor-ingredients" class="form-textarea mono-textarea" rows="7">${escapeHtml(ingText)}</textarea>
            </div>

            <div class="form-row">
              <label for="recipe-editor-steps" class="form-label">Cooking Steps (One step per line)</label>
              <textarea id="recipe-editor-steps" class="form-textarea" rows="6">${escapeHtml(stepText)}</textarea>
            </div>

            <button type="button" class="btn btn-primary" data-action="save-custom-recipe-editor">
              Save Recipe &amp; Build Process Diagram
            </button>
          </div>
        </section>

        <section class="panel-col">
          <div class="card">
            <div class="card-header">
              <h2>Individual or Bulk Recipe Collection Import</h2>
              <span class="card-subtitle">Paste a JSON array of recipes OR plain-text / Markdown recipes separated by <code>---</code></span>
            </div>

            <div class="form-row">
              <label for="recipe-bulk-import-textarea" class="form-label">Recipe Collection Payload (JSON or Markdown)</label>
              <textarea
                id="recipe-bulk-import-textarea"
                class="form-textarea mono-textarea"
                rows="14"
                placeholder="# Pan-Roasted Halibut with Brown Butter Capers&#10;Ingredients:&#10;- 2 fillets cod or halibut&#10;- 3 tbsp unsalted butter&#10;- 2 tbsp capers, drained&#10;- 1 whole fresh lemon, juiced&#10;Instructions:&#10;1. Sear halibut fillets in skillet for 4 minutes per side until golden.&#10;2. Add butter, capers, and lemon juice to pan, swirl until foaming, and spoon over fish."
              >${escapeHtml(this.state.recipeImportText || "")}</textarea>
            </div>

            <button type="button" class="btn btn-primary" data-action="import-recipes-bulk">
              Parse &amp; Import Recipe Collection
            </button>
          </div>
        </section>
      </div>
    `;
  }
}
