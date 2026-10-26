#!/usr/bin/env node
/**
 * @fileoverview Reproducible Static Build Script (`scripts/build.mjs`).
 *
 * Produces:
 * 1. `build_site/` — GitHub Pages-ready static directory using strictly relative asset paths (`./assets/...`, `./data/...`)
 *    so the app works identically at `https://USERNAME.github.io/`, `https://USERNAME.github.io/REPO/`, or a custom domain,
 *    plus `.nojekyll` to prevent Jekyll from ignoring files.
 * 2. Single-file self-contained HTML build (`/working_dir/c_c6eac74e7224c867/artifacts/file_generation/ttl=63d/output/culinary_intelligence_app.html`)
 *    with all Phase 1 + Phase 2 modules, styles, editorial photography (base64-inlined), and the 491-ingredient / 2,749-pairing / 68-recipe / 14-chef / USDA nutrition dataset embedded
 *    for instant offline and Canvas execution.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, process.env.BUILD_OUT_DIR || "build_site");
const dataDir = path.join(rootDir, "public/data");
const publicAssetsDir = path.join(rootDir, "public/assets");

// 1. Load static JSON datasets (Phase 1 + Phase 2)
const dataset = {
  sources: JSON.parse(fs.readFileSync(path.join(dataDir, "sources.json"), "utf8")),
  cuisines: JSON.parse(fs.readFileSync(path.join(dataDir, "cuisines.json"), "utf8")),
  ingredients: JSON.parse(fs.readFileSync(path.join(dataDir, "ingredients.json"), "utf8")),
  sauces: JSON.parse(fs.readFileSync(path.join(dataDir, "sauces.json"), "utf8")),
  sides: JSON.parse(fs.readFileSync(path.join(dataDir, "sides.json"), "utf8")),
  pairings: JSON.parse(fs.readFileSync(path.join(dataDir, "pairings.json"), "utf8")),
  nytTop50: JSON.parse(fs.readFileSync(path.join(dataDir, "nyt_top_50_2025.json"), "utf8")),
  chefCollections: JSON.parse(fs.readFileSync(path.join(dataDir, "chef_collections.json"), "utf8")),
  recipes: JSON.parse(fs.readFileSync(path.join(dataDir, "recipes.json"), "utf8")),
  nutritionCache: JSON.parse(fs.readFileSync(path.join(dataDir, "nutrition_cache.json"), "utf8"))
};

// 2. Read and strip ES module import/export statements in dependency order to create a clean browser bundle
const moduleOrder = [
  "src/core/types.js",
  "src/data/knowledgeGraph.js",
  "src/core/compatibility.js",
  "src/core/search.js",
  "src/core/bridge.js",
  "src/core/engine.js",
  "src/dishes/dishManager.js",
  "src/menus/menuManager.js",
  "src/utils/ingredientParser.js",
  "src/utils/unitConverter.js",
  "src/utils/nutritionCalculator.js",
  "src/utils/shoppingListAggregator.js",
  "src/recipes/processDiagram.js",
  "src/recipes/recipeEngine.js",
  "src/storage/db.js",
  "src/ai/promptGenerator.js",
  "src/ui/styles.js",
  "src/ui/app.js"
];

function stripImportsAndExports(code) {
  let out = code.replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "");
  out = out.replace(/\bexport\s+(const|let|var|function|class|async\s+function)\b/g, "$1");
  return out;
}

const bundledModulesCode = moduleOrder
  .map((relPath) => {
    const raw = fs.readFileSync(path.join(rootDir, relPath), "utf8");
    return `// --- MODULE: ${relPath} ---\n` + stripImportsAndExports(raw);
  })
  .join("\n\n");

import { APP_STYLES } from "../src/ui/styles.js";

fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
fs.mkdirSync(path.join(distDir, "data"), { recursive: true });
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

const dataFiles = [
  "sources.json",
  "cuisines.json",
  "ingredients.json",
  "sauces.json",
  "sides.json",
  "pairings.json",
  "nyt_top_50_2025.json",
  "chef_collections.json",
  "recipes.json",
  "nutrition_cache.json"
];

for (const name of dataFiles) {
  fs.writeFileSync(path.join(distDir, "data", name), fs.readFileSync(path.join(dataDir, name), "utf8"));
}

const visualAssetFiles = [
  "hero-duck-atelier.jpg",
  "card-botanical-pairings.jpg",
  "card-nyt-kebab.jpg"
];

const base64AssetMap = {};
for (const imgName of visualAssetFiles) {
  const srcImgPath = path.join(publicAssetsDir, imgName);
  if (fs.existsSync(srcImgPath)) {
    fs.copyFileSync(srcImgPath, path.join(distDir, "assets", imgName));
    const b64 = fs.readFileSync(srcImgPath).toString("base64");
    base64AssetMap[`./assets/${imgName}`] = `data:image/jpeg;base64,${b64}`;
  }
}

fs.writeFileSync(path.join(distDir, "assets/styles.css"), APP_STYLES.trim() + "\n");

const bootstrapCode = `
(function() {
  const EMBEDDED_DATASET = ${JSON.stringify(dataset)};

  ${bundledModulesCode}

  window.addEventListener("DOMContentLoaded", () => {
    const rootElement = document.getElementById("app-root");
    if (!rootElement) return;
    const app = new CulinaryAppController({
      rootElement,
      dataset: EMBEDDED_DATASET
    });
    window.__culinaryApp = app;
    app.init();
  });
})();
`;

fs.writeFileSync(path.join(distDir, "assets/app.bundle.js"), bootstrapCode.trim() + "\n");

const distIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Culinary Intelligence, Recipe Discovery &amp; Menu Building Workbench</title>
  <link rel="stylesheet" href="./assets/styles.css" />
</head>
<body>
  <div id="app-root"></div>
  <script src="./assets/app.bundle.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, "index.html"), distIndexHtml);

let standaloneBootstrap = bootstrapCode.trim();
for (const [relUrl, dataUri] of Object.entries(base64AssetMap)) {
  standaloneBootstrap = standaloneBootstrap.split(relUrl).join(dataUri);
}

const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Culinary Intelligence, Recipe Discovery &amp; Menu Building Workbench</title>
  <style>
${APP_STYLES.trim()}
  </style>
</head>
<body>
  <div id="app-root"></div>
  <script>
${standaloneBootstrap}
  </script>
</body>
</html>
`;

const distStandalonePath = path.join(distDir, "culinary_intelligence_app.html");
fs.writeFileSync(distStandalonePath, standaloneHtml);

const optionalCanvasPath = process.env.STANDALONE_OUT_PATH || "/working_dir/c_c6eac74e7224c867/artifacts/file_generation/ttl=63d/output/culinary_intelligence_app.html";
let extraCanvasCreated = false;
try {
  fs.mkdirSync(path.dirname(optionalCanvasPath), { recursive: true });
  fs.writeFileSync(optionalCanvasPath, standaloneHtml);
  extraCanvasCreated = true;
} catch {
  // Gracefully ignored in environments where the container artifact path is not writable
}

console.log(`Production build complete:
  - GitHub Pages static bundle: ${distDir} (index.html + ./assets/styles.css + ./assets/app.bundle.js + ./assets/*.jpg + ./data/*.json)
  - Standalone Canvas Web App:  ${distStandalonePath}${extraCanvasCreated ? `\n  - Container Artifact Copy:    ${optionalCanvasPath}` : ""}`);
