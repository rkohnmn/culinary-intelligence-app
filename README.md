# Culinary Intelligence, Ingredient Pairing & Menu Building Web Application

## 1. What the Application Does

The **Culinary Intelligence, Ingredient Pairing & Menu Building Workbench** is a static, locally persistent decision-support system for constructing individual dishes and multi-course menus. Users can begin with any ingredient, sauce, starch, vegetable, cooking technique, or regional tradition. The engine evaluates the entire active selection, ranks context-aware additions, surfaces compatibility warnings without blocking user experimentation, proposes bridging ingredients to rescue challenging combinations, and evaluates multi-course menu progression.

## 2. Technical Architecture

- **Runtime Model:** Client-side ES2022 modules bundled into static browser assets (`./assets/app.bundle.js`, `./assets/styles.css`, `./data/*.json`). Zero backend servers, user accounts, or external runtime API keys are required.
- **Knowledge Graph (`src/data/knowledgeGraph.js`):** Indexes 491 canonical ingredients, 1,682 aliases, 2,749 pairing relationships (0 orphan ingredients, biochemically and culinarily validated), 34 sauce templates, 24 composed side templates, 68 structured recipes, and 15 regional culinary traditions into $O(1)$ lookup maps and normalized search tokens.
- **Deterministic Recommendation Engine (`src/core/engine.js`, `src/core/compatibility.js`, `src/core/bridge.js`):** Evaluates candidate suitability across all selected ingredients ($A + B + C \dots$), preparation states, sauces (deduplicating overlapping constituents), and structural roles with 100% permutation order-independence.
- **Visual Asset Pipeline (`public/assets/`):** Bundles high-resolution editorial culinary photography (`hero-duck-atelier.jpg`, `card-botanical-pairings.jpg`, `card-nyt-kebab.jpg`) with automatic base64-inlining in the standalone single-file distribution and static copying to `./build_site/assets/`.
- **Domain Layers (`src/dishes/dishManager.js`, `src/menus/menuManager.js`):** Manage immutable dish updates, override tracking, and multi-course menus using isolated dish snapshots (`dishSnapshot` + `linkedLibraryDishId`).
- **Persistence (`src/storage/db.js`):** Stores user work in browser `IndexedDB` (`culinary_intel_db_v2`) with sequence-guarded debounced autosaving, automatic fallback (`localStorage` / memory) when IndexedDB is restricted, schema version migrations, and validated JSON import/export.

## 3. Requirements for Local Development

- **Node.js:** v18.0.0 or newer (tested on Node v18.20.4 and v20+).
- **Browser:** Any modern Chromium, Firefox, or WebKit browser supporting ES2022 and IndexedDB.
- **Optional E2E Runner:** Python 3.8+ with `selenium` and headless `chromium` for running `scripts/e2e_browser_test.py`.

## 4. Installation

Clone or extract the repository. Because the project uses zero external npm runtime dependencies, no external registry downloads are required to run the core validator, test suite, benchmark runner, or build script:

```bash
cd culinary-intelligence-app
npm run verify
```

## 5. Running the Local Development Server

Serve the built static site (`build_site/`) using any static file server:

```bash
npm run build
npx serve build_site
# Or using Python's built-in HTTP server:
python3 -m http.server 8080 --directory build_site
```

Then open `http://localhost:8080` in your browser. You can also open the self-contained single-file build directly in any browser.

## 6. Building the Production Website

Run the deterministic build pipeline:

```bash
npm run build
```

This generates `build_site/` containing `index.html`, `.nojekyll`, `./assets/styles.css`, `./assets/app.bundle.js`, and `./data/*.json`.

## 7. Running Tests

Execute the data validator, syntax/contract checker, unit/integration suite, performance benchmark, and headless Chromium E2E suite:

```bash
npm run validate:data
npm run typecheck
npm run test
npm run benchmark
npm run test:e2e
```

## 8. Deploying to GitHub Pages

The repository includes `.github/workflows/deploy.yml`, which automatically:
1. Checks out the repository.
2. Configures Node.js 20.
3. Validates the culinary dataset (`npm run validate:data`).
4. Runs contract/syntax checks (`npm run typecheck`).
5. Executes the unit and integration test suite (`npm run test`).
6. Runs the benchmark suite (`npm run benchmark`).
7. Builds the production static bundle (`npm run build`).
8. Uploads `./build_site` via `actions/upload-pages-artifact@v3` and deploys via `actions/deploy-pages@v4`.

In your GitHub repository settings, navigate to **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.

## 9. Configuring the Project Repository Path

All asset references in `build_site/index.html` use strictly relative paths (`./assets/styles.css`, `./assets/app.bundle.js`). The application works without modification whether hosted at:
- A root user/organization domain (`https://username.github.io/`)
- A project subpath (`https://username.github.io/repository-name/`)
- A custom domain (`https://culinary.example.com/`)

Note on network privacy: While the application never transmits user dishes, menus, or ingredient selections to any external server, visiting a GitHub Pages site still generates standard HTTP asset requests to GitHub's hosting infrastructure.

## 10. How Local Storage Works

The application persists saved dishes, saved menus, and the active workspace inside browser `IndexedDB` (`culinary_intel_db_v2`). Rapid edits trigger a 150ms debounced autosave guarded by a monotonic sequence counter so stale async writes never overwrite newer edits.

**Browser Storage Limitations:** Browser storage is not a permanent archival backup. Clearing site data, using private/incognito windows, or hitting browser quota eviction can remove local data. The UI requests `navigator.storage.persist()` where supported and continues operating seamlessly if denied.

## 11. How Backups Work

Open **3. Saved Library & JSON Backups** to export or import a human-readable JSON file (`format: "culinary-intelligence-backup-v2"`, `schemaVersion: 2`).
- **Export:** Serializes all saved dishes, saved menus, active workspace state, explicit override flags, and ingredient display names (`fallbackName`).
- **Import:** Validates file size (<5 MB), JSON syntax, format identifier, and record schemas before applying changes. Supports three duplicate-ID strategies: **Merge**, **Keep Both**, and **Replace**. Older `v1` records are migrated automatically.

## 12. How to Add Ingredients

Add a new object to `public/data/ingredients.json` with a unique `id` (e.g., `ing_black_cardamom`), `name`, `aliases`, `categories` (from `INGREDIENT_CATEGORIES` in `src/core/types.js`), `defaultRoles` (from `CULINARY_ROLES`), `flavorProfile` (ordinal `0`–`4` scales), `preparations`, `cuisines`, `dietaryFlags`, `provenanceId`, `provenanceTier`, and `culinaryNotes`. Run `npm run validate:data` to verify schema and referential integrity.

## 13. How to Add Pairing Relationships

Add a new record to `public/data/pairings.json` specifying `ingredientA`, `ingredientB`, `classification` (`strong_established`, `common_compatible`, `conditionally_compatible`, `less_conventional_useful`, `challenging`, or `context_dependent_incompatibility`), `affinityScore` (`-100` to `100`), `cuisines`, `rationale`, `balancingIngredients`, and `provenanceId`. Run `npm run validate:data` to verify that all referenced ingredient and source IDs exist.

## 14. How to Extend Cuisine Coverage

Add a new cuisine object to `public/data/cuisines.json` with `id`, `name`, `region`, `description`, `signatureIngredients`, `signatureSauces`, `commonTechniques`, and `flavorStructureNotes`. Tag relevant ingredients and sauces with the new cuisine `id`.

## 15. How to Extend the Recommendation Logic

- **Pairwise & Multi-Ingredient Scoring:** Edit `evaluatePairwise` and `evaluateCandidateAgainstDish` in `src/core/compatibility.js`.
- **Bridging & Rescue Discovery:** Edit `findBridgeSuggestions` in `src/core/bridge.js`.
- **Menu-Level Progression Rules:** Edit `evaluateMenu` in `src/menus/menuManager.js`.

## 16. How the Optional AI Prompt Generator Works

Open **4. External AI Prompt Generator** and choose **Analyze Current Dish** or **Analyze Complete Menu**. `src/ai/promptGenerator.ts` (`src/ai/promptGenerator.js`) packages the active selections, roles, preparations, sauces, sides, compatibility warnings, and intentional overrides into a delimited `<dish_data_json>` or `<menu_data_json>` block. User-entered notes are isolated as passive data attributes with explicit anti-injection instructions so they are never interpreted as system commands. Click **Copy Prompt to Clipboard** and paste into ChatGPT, Claude, Gemini, or any preferred assistant.

## 17. Visual Media & Editorial Assets

The application features custom editorial food photography assets designed specifically for the test-kitchen atelier interface:
- `hero-duck-atelier.jpg`: Pan-seared scored duck breast with caramelized figs, herbs, and sea salt on dark slate.
- `card-botanical-pairings.jpg`: Botanical flat lay with black garlic, star anise, red Sichuan peppercorns, and fresh herbs.
- `card-nyt-kebab.jpg`: Spiced smashed beef kebabs over cucumber-dill labneh with chili butter.

These assets are stored under `public/assets/` and processed by `scripts/build.mjs`, which copies them to `./build_site/assets/` and inlines them as base64 data URIs into the single-file distribution for offline execution.

## 18. Known Limitations & Audit Verification

- **Curated Reference Scope:** While the dataset covers 491 canonical ingredients and 2,749 pairings across 15 culinary traditions, it is a curated culinary reference rather than an exhaustive global encyclopedia. All 320 orphan ingredients were resolved and all 17 cloned profiles repaired during the independent audit (documented in `POST_BUILD_AUDIT.md`).
- **Allergen & Safety Disclaimer:** Dietary flags (`meat`, `poultry`, `fish`, `shellfish`, `dairy`, `egg`, `nuts`, `gluten`, `allium`, `soy`, `sesame`) are informational aids for canonical ingredients and cannot verify commercial cross-contamination or medical allergen safety.

## 19. Phase 2 Expansion: Recipe Intelligence, NYT 2025 Top 50, Chef Collections & Cooking for Engineers Process Diagrams

- **Recipe Corpus (`public/data/nyt_top_50_2025.json`, `public/data/chef_collections.json`, `public/data/recipes.json`):** 68 structured recipes including all 50 recipes of **NYT Cooking's 50 Most Popular Recipes of 2025** (Ranks #1–#50) and 18 signature dishes across **14 Renowned Chef Collections** (J. Kenji López-Alt, Samin Nosrat, Yotam Ottolenghi, Thomas Keller, Marcella Hazan, David Chang, Jacques Pépin, Massimo Bottura, Alice Waters, Eric Kim, Hetty Lui McKinnon, Dan Pelosi, Ali Slagle, and Zainab Issa).
- **Dual-Mode Cooking Instructions (`src/recipes/processDiagram.js`):** Interactive toggle between numbered Step-by-Step Instructions (with completion checkboxes, temperatures, timers, and sensory cues) and a rectangular **Cooking for Engineers** tabular process matrix (`rowspan`/`colspan` dependency table).
- **NLP Ingredient Parser, Unit Converter, USDA Nutrition Calculator & Shopping List Aggregator (`src/utils/*.js`):** Full support for Unicode fractions, mixed numbers, ranges, parenthetical overrides, dynamic scaling (`0.5x`–`3x`), `Original` / `Metric` / `Imperial` conversion, USDA FoodData Central per-serving nutrition facts (`public/data/nutrition_cache.json` covering all 491 canonical ingredients), and aisle-grouped shopping list aggregation.
- **Verification:** `26` modules typechecked, `22/22` unit/integration/adversarial test suites passing (`npm test`), and `12/12` subpath HTTP & headless Chromium E2E tests passing (`npm run test:e2e`).
