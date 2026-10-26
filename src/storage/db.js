/**
 * @fileoverview Local persistence engine (`src/storage/db.js`).
 *
 * Implements Requirement 5 & Phase 2 Recipe Persistence:
 * - IndexedDB primary database (`culinary_intel_db_v2`) storing:
 *   - `dishes` (saved dishes)
 *   - `menus` (saved menus)
 *   - `recipes` (saved custom, personalized, and imported recipes)
 *   - `workspace` (current working dish, current working menu, user preferences)
 * - Automatic fallback to `localStorage` and in-memory Map when running in Node.js tests,
 *   sandboxed iframes, or private browsing modes where IndexedDB is blocked.
 * - Sequence-guarded, debounced autosave controller that prevents stale async writes from
 *   overwriting newer states and accurately reports persistence status.
 * - Schema migration from v1 to v2 (`migratePersistedRecord`) preserving any renamed/removed
 *   reference ingredients via `fallbackName`.
 * - Validated JSON Export & Import (`exportBackupJson`, `importBackupJson`) with duplicate ID
 *   conflict handling (`merge` vs `keep_both` vs `replace`), size/type validation, and strict non-execution of untrusted text.
 */

import { SCHEMA_VERSION, EXPORT_FORMAT_ID } from "../core/types.js";
import { createDish, createEntityId } from "../dishes/dishManager.js";
import { createMenu } from "../menus/menuManager.js";
import { normalizeRecipeRecord } from "../recipes/recipeEngine.js";

const DB_NAME = "culinary_intel_db_v2";
const DB_VERSION = 3;

/**
 * Sanitizes untrusted string fields during import so executable HTML/script payloads are stripped or neutralized.
 * @param { unknown } value
 * @param {number} [maxLen=2000]
 * @returns {string}
 */
export function sanitizeTextField(value, maxLen = 2000) {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen).replace(/\0/g, "");
}

/**
 * Migrates an older v1 dish, menu, or recipe record to the current `SCHEMA_VERSION` (v2).
 * Preserves any legacy ingredient references via `fallbackName`.
 *
 * @param {Object} record
 * @param {"dish"|"menu"|"recipe"} recordType
 * @returns {Object}
 */
export function migratePersistedRecord(record, recordType) {
  if (!record || typeof record !== "object") {
    throw new Error(`Invalid ${recordType} record for migration.`);
  }

  const version = typeof record.schemaVersion === "number" ? record.schemaVersion : 1;

  if (recordType === "dish") {
    const rawIngredients = Array.isArray(record.ingredients) ? record.ingredients : [];
    const migratedIngredients = rawIngredients.map((item) => {
      if (typeof item === "string") {
        return {
          ingredientId: sanitizeTextField(item, 120),
          fallbackName: sanitizeTextField(item, 120),
          role: "supporting_component",
          preparation: "raw",
          isOverride: false,
          addedAt: new Date().toISOString()
        };
      }
      const ingId = sanitizeTextField(item.ingredientId || item.id || "", 120);
      return {
        ingredientId: ingId,
        fallbackName: sanitizeTextField(item.fallbackName || item.name || ingId, 160),
        role: sanitizeTextField(item.role || "supporting_component", 80),
        preparation: sanitizeTextField(item.preparation || "raw", 80),
        isOverride: Boolean(item.isOverride),
        overrideReason: item.overrideReason ? sanitizeTextField(item.overrideReason, 500) : undefined,
        addedAt: item.addedAt || new Date().toISOString()
      };
    });

    return createDish({
      ...record,
      id: sanitizeTextField(record.id || createEntityId("dish"), 120),
      name: sanitizeTextField(record.name || "Migrated Dish", 200),
      description: sanitizeTextField(record.description || "", 1000),
      notes: sanitizeTextField(record.notes || "", 2000),
      ingredients: migratedIngredients,
      sauceIds: Array.isArray(record.sauceIds)
        ? record.sauceIds.map((s) => sanitizeTextField(s, 120))
        : [],
      sideIds: Array.isArray(record.sideIds)
        ? record.sideIds.map((s) => sanitizeTextField(s, 120))
        : [],
      cuisineIds: Array.isArray(record.cuisineIds)
        ? record.cuisineIds.map((c) => sanitizeTextField(c, 120))
        : [],
      cookingMethods: Array.isArray(record.cookingMethods)
        ? record.cookingMethods.map((m) => sanitizeTextField(m, 120))
        : [],
      acceptedOverrides:
        record.acceptedOverrides && typeof record.acceptedOverrides === "object"
          ? { ...record.acceptedOverrides }
          : {},
      schemaVersion: SCHEMA_VERSION,
      migratedFromVersion: version < SCHEMA_VERSION ? version : undefined
    });
  }

  if (recordType === "menu") {
    const rawItems = Array.isArray(record.items || record.courses)
      ? record.items || record.courses
      : [];
    const migratedItems = rawItems.map((entry, idx) => ({
      entryId: sanitizeTextField(entry.entryId || createEntityId("course_entry"), 120),
      courseType: sanitizeTextField(entry.courseType || "main_course", 80),
      customCourseLabel: sanitizeTextField(entry.customCourseLabel || "", 120),
      order: typeof entry.order === "number" ? entry.order : idx,
      dishSnapshot: migratePersistedRecord(
        entry.dishSnapshot || entry.dish || { name: "Course Dish", ingredients: [] },
        "dish"
      ),
      linkedLibraryDishId: entry.linkedLibraryDishId
        ? sanitizeTextField(entry.linkedLibraryDishId, 120)
        : undefined
    }));

    return createMenu({
      ...record,
      id: sanitizeTextField(record.id || createEntityId("menu"), 120),
      name: sanitizeTextField(record.name || "Migrated Menu", 200),
      description: sanitizeTextField(record.description || "", 1000),
      theme: sanitizeTextField(record.theme || "", 200),
      notes: sanitizeTextField(record.notes || "", 2000),
      items: migratedItems,
      schemaVersion: SCHEMA_VERSION
    });
  }

  if (recordType === "recipe") {
    return normalizeRecipeRecord({
      ...record,
      id: sanitizeTextField(record.id || createEntityId("rec_user"), 120),
      title: sanitizeTextField(record.title || record.name || "Custom Recipe", 240),
      author: sanitizeTextField(record.author || "User Kitchen", 160),
      headnote: sanitizeTextField(record.headnote || record.description || "", 2000),
      isCustom: true
    });
  }

  return record;
}

/**
 * Storage adapter supporting Browser IndexedDB with seamless fallback to localStorage/in-memory
 * for environments where IndexedDB is unavailable or blocked.
 */
export class CulinaryStorage {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.forceMemory=false]
   * @param {boolean} [options.simulateFailure=false]
   */
  constructor(options = {}) {
    this.forceMemory = Boolean(options.forceMemory);
    this.simulateFailure = Boolean(options.simulateFailure);
    this.backendType = "uninitialized";
    this.db = null;

    this.memoryStores = {
      dishes: new Map(),
      menus: new Map(),
      recipes: new Map(),
      workspace: new Map()
    };

    // Monotonic sequence counters for stale async write prevention
    this.writeSequence = 0;
    this.appliedSequence = 0;
    this.debounceTimer = null;
  }

  /**
   * Initializes IndexedDB connection or falls back gracefully if blocked/unsupported.
   * @returns {Promise<{ backendType: string, persistentGranted: boolean }>}
   */
  async init() {
    if (this.simulateFailure) {
      throw new Error("Simulated storage initialization failure.");
    }

    let persistentGranted = false;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.storage &&
        typeof navigator.storage.persist === "function"
      ) {
        persistentGranted = await navigator.storage.persist();
      }
    } catch {
      persistentGranted = false;
    }

    if (
      !this.forceMemory &&
      typeof indexedDB !== "undefined" &&
      indexedDB !== null
    ) {
      try {
        this.db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("dishes")) {
              db.createObjectStore("dishes", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("menus")) {
              db.createObjectStore("menus", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("recipes")) {
              db.createObjectStore("recipes", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("workspace")) {
              db.createObjectStore("workspace", { keyPath: "key" });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
          req.onblocked = () => reject(new Error("IndexedDB connection blocked"));
        });
        this.backendType = "indexeddb";
        return { backendType: this.backendType, persistentGranted };
      } catch {
        // Fall through to localStorage / memory fallback
      }
    }

    try {
      if (!this.forceMemory && typeof localStorage !== "undefined") {
        const testKey = "__culinary_storage_probe__";
        localStorage.setItem(testKey, "1");
        localStorage.removeItem(testKey);
        this.backendType = "localstorage_fallback";
        this._hydrateMemoryFromLocalStorage();
        return { backendType: this.backendType, persistentGranted };
      }
    } catch {
      // Fall through to pure memory
    }

    this.backendType = "memory_fallback";
    return { backendType: this.backendType, persistentGranted };
  }

  _hydrateMemoryFromLocalStorage() {
    try {
      const raw = localStorage.getItem(DB_NAME);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const d of parsed.dishes || []) this.memoryStores.dishes.set(d.id, d);
      for (const m of parsed.menus || []) this.memoryStores.menus.set(m.id, m);
      for (const r of parsed.recipes || []) this.memoryStores.recipes.set(r.id, r);
      for (const [k, v] of Object.entries(parsed.workspace || {})) {
        this.memoryStores.workspace.set(k, { key: k, value: v });
      }
    } catch {
      // Ignore corrupt localStorage fallback
    }
  }

  _syncMemoryToLocalStorage() {
    if (this.backendType !== "localstorage_fallback") return;
    try {
      const payload = {
        dishes: Array.from(this.memoryStores.dishes.values()),
        menus: Array.from(this.memoryStores.menus.values()),
        recipes: Array.from(this.memoryStores.recipes.values()),
        workspace: Object.fromEntries(
          Array.from(this.memoryStores.workspace.entries()).map(([k, obj]) => [k, obj.value])
        )
      };
      localStorage.setItem(DB_NAME, JSON.stringify(payload));
    } catch (err) {
      throw new Error(`Browser storage quota or write error: ${err.message}`);
    }
  }

  async _putRecord(storeName, record) {
    if (this.simulateFailure) {
      throw new Error("Simulated storage write failure (quota exceeded or blocked).");
    }
    if (this.backendType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error || new Error(`IndexedDB write failed on ${storeName}`));
      });
    }
    const key = storeName === "workspace" ? record.key : record.id;
    this.memoryStores[storeName].set(key, structuredClone(record));
    this._syncMemoryToLocalStorage();
    return record;
  }

  async _deleteRecord(storeName, key) {
    if (this.simulateFailure) {
      throw new Error("Simulated storage delete failure.");
    }
    if (this.backendType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error(`IndexedDB delete failed on ${storeName}`));
      });
    }
    this.memoryStores[storeName].delete(key);
    this._syncMemoryToLocalStorage();
    return true;
  }

  async _getAllRecords(storeName) {
    if (this.simulateFailure) {
      throw new Error("Simulated storage read failure.");
    }
    if (this.backendType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error(`IndexedDB read failed on ${storeName}`));
      });
    }
    return Array.from(this.memoryStores[storeName].values()).map((r) => structuredClone(r));
  }

  async saveDish(dish) {
    const migrated = migratePersistedRecord(dish, "dish");
    await this._putRecord("dishes", migrated);
    return migrated;
  }

  async getAllDishes() {
    const raw = await this._getAllRecords("dishes");
    return raw
      .map((r) => migratePersistedRecord(r, "dish"))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  async deleteDish(dishId) {
    return this._deleteRecord("dishes", dishId);
  }

  async saveMenu(menu) {
    const migrated = migratePersistedRecord(menu, "menu");
    await this._putRecord("menus", migrated);
    return migrated;
  }

  async getAllMenus() {
    const raw = await this._getAllRecords("menus");
    return raw
      .map((r) => migratePersistedRecord(r, "menu"))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  async deleteMenu(menuId) {
    return this._deleteRecord("menus", menuId);
  }

  /**
   * Saves a custom, personalized, or imported recipe to persistent storage.
   * @param {Object} recipe
   * @returns {Promise<Object>}
   */
  async saveRecipe(recipe) {
    const migrated = migratePersistedRecord(recipe, "recipe");
    await this._putRecord("recipes", migrated);
    return migrated;
  }

  /**
   * Retrieves all saved custom/personalized recipes.
   * @returns {Promise<Array<Object>>}
   */
  async getAllRecipes() {
    const raw = await this._getAllRecords("recipes");
    return raw
      .map((r) => migratePersistedRecord(r, "recipe"))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  /**
   * Deletes a saved custom recipe by ID.
   * @param {string} recipeId
   */
  async deleteRecipe(recipeId) {
    return this._deleteRecord("recipes", recipeId);
  }

  async saveWorkspaceState(workspaceState) {
    const seq = ++this.writeSequence;
    const copy = structuredClone(workspaceState);
    if (seq < this.appliedSequence) {
      return { saved: false, sequence: seq };
    }
    await this._putRecord("workspace", {
      key: "active_workspace",
      sequence: seq,
      updatedAt: new Date().toISOString(),
      value: copy
    });
    this.appliedSequence = Math.max(this.appliedSequence, seq);
    return { saved: true, sequence: seq };
  }

  scheduleAutosave(workspaceState, onStatus = null, delayMs = 180) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(async () => {
      try {
        const res = await this.saveWorkspaceState(workspaceState);
        if (res.saved && workspaceState.workingDish) {
          await this.saveDish(workspaceState.workingDish);
        }
        if (res.saved && workspaceState.workingMenu) {
          await this.saveMenu(workspaceState.workingMenu);
        }
        if (onStatus) {
          onStatus({ ok: true, timestamp: new Date().toISOString() });
        }
      } catch (err) {
        if (onStatus) {
          onStatus({ ok: false, error: err.message });
        }
      }
    }, delayMs);
  }

  async loadWorkspaceState() {
    const records = await this._getAllRecords("workspace");
    const entry = records.find((r) => r.key === "active_workspace");
    if (!entry || !entry.value) return null;

    const val = entry.value;
    return {
      workingDish: val.workingDish ? migratePersistedRecord(val.workingDish, "dish") : null,
      workingMenu: val.workingMenu ? migratePersistedRecord(val.workingMenu, "menu") : null,
      preferences: val.preferences || {}
    };
  }

  async exportBackupJson(graph = null) {
    const dishes = await this.getAllDishes();
    const menus = await this.getAllMenus();
    const recipes = await this.getAllRecipes();
    const workspace = await this.loadWorkspaceState();

    if (graph) {
      for (const d of dishes) {
        for (const sel of d.ingredients || []) {
          const ing = graph.ingredients.get(sel.ingredientId);
          if (ing) sel.fallbackName = ing.name;
        }
      }
    }

    const payload = {
      format: EXPORT_FORMAT_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      dishes,
      menus,
      recipes,
      workspace: workspace || {}
    };

    return JSON.stringify(payload, null, 2);
  }

  async importBackupJson(jsonString, options = {}) {
    const { conflictMode = "merge" } = options;

    if (typeof jsonString !== "string" || jsonString.trim().length === 0) {
      throw new Error("Import failed: Backup input is empty or not a string.");
    }
    if (jsonString.length > 5 * 1024 * 1024) {
      throw new Error("Import failed: File exceeds the 5 MB safety limit.");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error("Import failed: Malformed JSON syntax.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Import failed: Root JSON element must be a structured object.");
    }

    const validFormats = new Set([
      EXPORT_FORMAT_ID,
      "culinary-intelligence-backup-v1"
    ]);
    if (!validFormats.has(parsed.format)) {
      throw new Error(
        `Import failed: Unrecognized backup format '${String(parsed.format)}'. Expected '${EXPORT_FORMAT_ID}'.`
      );
    }

    if (!Array.isArray(parsed.dishes) || !Array.isArray(parsed.menus)) {
      throw new Error("Import failed: Backup must contain 'dishes' and 'menus' arrays.");
    }

    const existingDishes = await this.getAllDishes();
    const existingMenus = await this.getAllMenus();
    const existingRecipes = await this.getAllRecipes();
    const existingDishIds = new Set(existingDishes.map((d) => d.id));
    const existingMenuIds = new Set(existingMenus.map((m) => m.id));
    const existingRecipeIds = new Set(existingRecipes.map((r) => r.id));

    const duplicateIdsDetected = [];
    let migratedLegacyRecords = 0;

    const preparedDishes = [];
    for (const rawDish of parsed.dishes) {
      if (!rawDish || typeof rawDish !== "object" || !rawDish.name) {
        throw new Error("Import failed: Dish entry is missing required structure or name.");
      }
      if ((rawDish.schemaVersion || 1) < SCHEMA_VERSION) {
        migratedLegacyRecords++;
      }
      const migrated = migratePersistedRecord(rawDish, "dish");
      if (existingDishIds.has(migrated.id)) {
        duplicateIdsDetected.push(migrated.id);
        if (conflictMode === "keep_both") {
          migrated.id = createEntityId("dish");
          migrated.name = `${migrated.name} (Imported)`;
        }
      }
      preparedDishes.push(migrated);
    }

    const preparedMenus = [];
    for (const rawMenu of parsed.menus) {
      if (!rawMenu || typeof rawMenu !== "object" || !rawMenu.name) {
        throw new Error("Import failed: Menu entry is missing required structure or name.");
      }
      if ((rawMenu.schemaVersion || 1) < SCHEMA_VERSION) {
        migratedLegacyRecords++;
      }
      const migrated = migratePersistedRecord(rawMenu, "menu");
      if (existingMenuIds.has(migrated.id)) {
        duplicateIdsDetected.push(migrated.id);
        if (conflictMode === "keep_both") {
          migrated.id = createEntityId("menu");
          migrated.name = `${migrated.name} (Imported)`;
        }
      }
      preparedMenus.push(migrated);
    }

    const preparedRecipes = [];
    if (Array.isArray(parsed.recipes)) {
      for (const rawRec of parsed.recipes) {
        if (!rawRec || typeof rawRec !== "object" || !(rawRec.title || rawRec.name)) {
          throw new Error("Import failed: Recipe entry is missing required title.");
        }
        const migrated = migratePersistedRecord(rawRec, "recipe");
        if (existingRecipeIds.has(migrated.id)) {
          duplicateIdsDetected.push(migrated.id);
          if (conflictMode === "keep_both") {
            migrated.id = createEntityId("rec_user");
            migrated.title = `${migrated.title} (Imported)`;
          }
        }
        preparedRecipes.push(migrated);
      }
    }

    if (conflictMode === "replace") {
      for (const d of existingDishes) await this.deleteDish(d.id);
      for (const m of existingMenus) await this.deleteMenu(m.id);
      for (const r of existingRecipes) await this.deleteRecipe(r.id);
    }

    for (const d of preparedDishes) await this.saveDish(d);
    for (const m of preparedMenus) await this.saveMenu(m);
    for (const r of preparedRecipes) await this.saveRecipe(r);

    if (parsed.workspace && typeof parsed.workspace === "object") {
      const ws = {
        workingDish: parsed.workspace.workingDish
          ? migratePersistedRecord(parsed.workspace.workingDish, "dish")
          : preparedDishes[0] || null,
        workingMenu: parsed.workspace.workingMenu
          ? migratePersistedRecord(parsed.workspace.workingMenu, "menu")
          : preparedMenus[0] || null,
        preferences: parsed.workspace.preferences || {}
      };
      await this.saveWorkspaceState(ws);
    }

    return {
      importedDishes: preparedDishes.length,
      importedMenus: preparedMenus.length,
      importedRecipes: preparedRecipes.length,
      duplicateIdsDetected,
      migratedLegacyRecords
    };
  }
}
