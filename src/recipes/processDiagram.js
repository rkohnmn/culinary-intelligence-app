/**
 * @fileoverview Visual Process Diagram Generator inspired by Cooking for Engineers (`src/recipes/processDiagram.js`).
 *
 * Implements a deterministic tabular recipe flow matrix where:
 * - Left columns list scaled, unit-converted ingredients ordered by component & stage entry (sticky on horizontal scroll)
 * - Subsequent stage columns represent sequential/parallel cooking operations
 * - Action cells use exact `rowspan` across contiguous ingredient subsets that combine at that stage,
 *   while inactive or already-combined rows use pass-through cells so every row and column forms
 *   a mathematically exact rectangular HTML `<table>` (no ragged or overlapping cells).
 * - Interactive stage completion (`data-action="toggle-recipe-step-done"`) and live step timer triggers.
 */

import { scaleRecipeIngredients, formatTemperatureForSystem } from "../utils/unitConverter.js";

function escapeDiagramHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the deterministic 2D grid model for a Cooking for Engineers tabular process diagram.
 *
 * Guarantees that for an R x C stage matrix (R ingredients, C steps),
 * every cell (r, c) is covered by exactly one cell entry (either a `rowspan` origin cell
 * or a covered placeholder), so HTML table rendering is 100% rectangular and valid.
 *
 * @param {Object} recipe
 * @param {Object} [options]
 * @param {number} [options.targetServings]
 * @param {"original"|"metric"|"imperial"} [options.unitSystem="original"]
 * @param {Object} [options.nutritionCache=null]
 * @returns {Object}
 */
export function buildCookingForEngineersMatrix(recipe, options = {}) {
  const unitSystem = options.unitSystem || "original";
  const scaledIngredients = scaleRecipeIngredients(
    recipe,
    options.targetServings || recipe?.servings || 4,
    unitSystem,
    options.nutritionCache || null
  );

  const rawSteps = Array.isArray(recipe?.steps) ? recipe.steps : [];
  const numIngs = scaledIngredients.length;

  if (numIngs === 0 || rawSteps.length === 0) {
    return {
      orderedIngredients: scaledIngredients,
      steps: rawSteps,
      grid: [],
      rowCount: numIngs,
      colCount: rawSteps.length,
      totalPrepMinutes: Number(recipe?.prepTimeMinutes || 0),
      totalCookMinutes: Number(recipe?.cookTimeMinutes || 0)
    };
  }

  // Order ingredients by their earliest step appearance so combining rows are contiguous
  const firstStepForIng = scaledIngredients.map((_, idx) => {
    for (let sIdx = 0; sIdx < rawSteps.length; sIdx++) {
      const indices = rawSteps[sIdx].ingredientIndices || [];
      if (indices.includes(idx)) return sIdx;
    }
    return rawSteps.length;
  });

  const orderIndices = scaledIngredients
    .map((_, idx) => idx)
    .sort((a, b) => {
      if (firstStepForIng[a] !== firstStepForIng[b]) {
        return firstStepForIng[a] - firstStepForIng[b];
      }
      return a - b;
    });

  const oldToNewRow = new Map();
  orderIndices.forEach((oldIdx, newRow) => {
    oldToNewRow.set(oldIdx, newRow);
  });

  const orderedIngredients = orderIndices.map((oldIdx, newRow) => ({
    ...scaledIngredients[oldIdx],
    originalIndex: oldIdx,
    diagramRow: newRow
  }));

  const numCols = rawSteps.length;
  // Initialize R x C grid
  const grid = Array.from({ length: numIngs }, () =>
    Array.from({ length: numCols }, () => ({
      type: "empty", // "action" | "covered" | "passthrough_before" | "component_carry"
      rowspan: 1,
      colspan: 1,
      step: null,
      label: ""
    }))
  );

  // Track when each row has entered active processing
  const rowFirstActiveCol = new Array(numIngs).fill(numCols);

  rawSteps.forEach((step, colIdx) => {
    const rawIndices =
      Array.isArray(step.ingredientIndices) && step.ingredientIndices.length > 0
        ? step.ingredientIndices
        : orderIndices;

    const mappedRows = rawIndices
      .map((oldIdx) => oldToNewRow.get(oldIdx))
      .filter((r) => r !== undefined && r >= 0 && r < numIngs)
      .sort((a, b) => a - b);

    const isFinalStep = colIdx === numCols - 1;
    const minRow = isFinalStep ? 0 : mappedRows.length > 0 ? mappedRows[0] : 0;
    const maxRow = isFinalStep
      ? numIngs - 1
      : mappedRows.length > 0
      ? mappedRows[mappedRows.length - 1]
      : numIngs - 1;
    const span = Math.max(1, maxRow - minRow + 1);

    for (let r = minRow; r <= maxRow; r++) {
      if (colIdx < rowFirstActiveCol[r]) {
        rowFirstActiveCol[r] = colIdx;
      }
    }

    grid[minRow][colIdx] = {
      type: "action",
      rowspan: span,
      colspan: 1,
      step: {
        ...step,
        formattedTemperature: formatTemperatureForSystem(step.temperature || "", unitSystem)
      },
      label: step.actionVerb || `Stage ${colIdx + 1}`
    };

    for (let r = minRow + 1; r <= maxRow; r++) {
      grid[r][colIdx] = {
        type: "covered",
        rowspan: 0,
        colspan: 0,
        step: null,
        label: ""
      };
    }
  });

  // Fill remaining non-action cells as either "passthrough_before" or "component_carry"
  for (let r = 0; r < numIngs; r++) {
    for (let c = 0; c < numCols; c++) {
      if (grid[r][c].type === "empty") {
        if (c < rowFirstActiveCol[r]) {
          grid[r][c] = {
            type: "passthrough_before",
            rowspan: 1,
            colspan: 1,
            step: null,
            label: "───►"
          };
        } else {
          grid[r][c] = {
            type: "component_carry",
            rowspan: 1,
            colspan: 1,
            step: null,
            label: "──► [Hold / Merge] ──►"
          };
        }
      }
    }
  }

  return {
    orderedIngredients,
    steps: rawSteps,
    grid,
    rowCount: numIngs,
    colCount: numCols,
    totalPrepMinutes: Number(recipe?.prepTimeMinutes || 0),
    totalCookMinutes: Number(recipe?.cookTimeMinutes || 0)
  };
}

/**
 * Renders the Cooking for Engineers visual process diagram as an accessible, interactive HTML table.
 *
 * @param {Object} recipe
 * @param {Object} [options]
 * @param {Object} [options.completedSteps]
 * @returns {string} HTML string
 */
export function renderCookingForEngineersHtml(recipe, options = {}) {
  const matrix = buildCookingForEngineersMatrix(recipe, options);
  const { orderedIngredients, steps, grid } = matrix;
  const completedSteps = options.completedSteps || {};

  if (orderedIngredients.length === 0) {
    return `<div class="empty-state">No ingredients or steps available to diagram.</div>`;
  }

  return `
    <div class="cfe-diagram-wrapper" role="region" aria-label="Cooking for Engineers Tabular Process Diagram for ${escapeDiagramHtml(
      recipe.title
    )}">
      <div class="cfe-diagram-legend">
        <div>
          <strong>Cooking for Engineers Process Matrix:</strong>
          Ingredients enter on the left; each column from left to right represents a cooking stage. Vertical cells spanning multiple rows combine those exact components until the finished dish emerges on the right. <em>Click any stage box to mark it complete.</em>
        </div>
      </div>
      <div class="cfe-table-scroll" data-preserve-scroll="cfe-matrix-${escapeDiagramHtml(recipe.id || "active")}">
        <table class="cfe-process-table">
          <thead>
            <tr>
              <th scope="col" class="cfe-th-qty">Amount</th>
              <th scope="col" class="cfe-th-ing">Ingredient &amp; Mise en Place</th>
              ${steps
                .map((st, idx) => {
                  const stepKey = `${recipe.id}::${st.stepNumber || idx + 1}`;
                  const isDone = Boolean(completedSteps[stepKey]);
                  return `
                  <th scope="col" class="cfe-th-stage ${isDone ? "cfe-th-stage-done" : ""}">
                    <div class="cfe-stage-num">Stage ${idx + 1} · ${escapeDiagramHtml(
                    st.phase || "Process"
                  )} ${isDone ? "✓" : ""}</div>
                    <div class="cfe-stage-verb">${escapeDiagramHtml(st.actionVerb || `Step ${idx + 1}`)}</div>
                  </th>
                `;
                })
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${orderedIngredients
              .map((ing, rIdx) => {
                const rowCells = grid[rIdx] || [];
                const cellsHtml = rowCells
                  .map((cell, cIdx) => {
                    if (cell.type === "covered") return "";
                    if (cell.type === "action" && cell.step) {
                      const st = cell.step;
                      const stepNum = st.stepNumber || cIdx + 1;
                      const stepKey = `${recipe.id}::${stepNum}`;
                      const isDone = Boolean(completedSteps[stepKey]);
                      return `
                        <td
                          class="cfe-cell-action ${isDone ? "cfe-cell-action-done" : ""}"
                          rowspan="${cell.rowspan}"
                          data-action="toggle-recipe-step-done"
                          data-step-key="${escapeDiagramHtml(stepKey)}"
                          title="Click to toggle Stage ${stepNum} completion"
                        >
                          <div class="cfe-action-header">
                            <strong class="cfe-action-verb">${
                              isDone ? "[✓] " : ""
                            }${escapeDiagramHtml(st.actionVerb)}</strong>
                            <div class="inline-action-group">
                              ${
                                st.durationMinutes
                                  ? `<button
                                      type="button"
                                      class="badge badge-role cfe-timer-btn"
                                      data-action="start-step-timer"
                                      data-minutes="${st.durationMinutes}"
                                      data-label="${escapeDiagramHtml(`${recipe.title} — Stage ${stepNum}: ${st.actionVerb}`)}"
                                      title="Start ${st.durationMinutes} min kitchen timer"
                                    >⏱ ${st.durationMinutes} min</button>`
                                  : ""
                              }
                            </div>
                          </div>
                          ${
                            st.formattedTemperature
                              ? `<div class="cfe-action-temp">Temp: ${escapeDiagramHtml(
                                  st.formattedTemperature
                                )}</div>`
                              : ""
                          }
                          <p class="cfe-action-desc">${escapeDiagramHtml(st.instruction)}</p>
                          ${
                            st.sensoryCue
                              ? `<div class="cfe-action-cue"><em>Cue:</em> ${escapeDiagramHtml(
                                  st.sensoryCue
                                )}</div>`
                              : ""
                          }
                        </td>
                      `;
                    }
                    if (cell.type === "component_carry") {
                      return `<td class="cfe-cell-carry" title="Prepared component carried forward to merge"><span class="cfe-carry-line">──► Hold &amp; Merge ──►</span></td>`;
                    }
                    return `<td class="cfe-cell-pass" title="Ingredient enters at a later stage"><span class="cfe-pass-line">───►</span></td>`;
                  })
                  .join("");

                return `
                  <tr class="cfe-ing-row">
                    <td class="cfe-td-qty"><code>${escapeDiagramHtml(
                      ing.formattedMeasurement
                    )}</code></td>
                    <td class="cfe-td-ing">
                      <strong>${escapeDiagramHtml(ing.name)}</strong>${
                  ing.preparationNote
                    ? `<span class="cfe-ing-prep">, ${escapeDiagramHtml(
                        ing.preparationNote
                      )}</span>`
                    : ""
                }
                      <div class="cfe-ing-group">${escapeDiagramHtml(
                        ing.componentGroup || "Main"
                      )}</div>
                    </td>
                    ${cellsHtml}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
