/**
 * @fileoverview Test-Kitchen Reference Catalog & Atelier Design System CSS (`src/ui/styles.js`).
 * Adheres strictly to `DESIGN.md` tokens, WCAG AA/AAA contrast, physical easing curves, and `@media print`.
 */

export const APP_STYLES = `
:root {
  --color-primary: #2C4A3E;
  --color-primary-hover: #1F352C;
  --color-primary-subtle: #EBF2EE;
  --color-secondary: #7A4B2A;
  --color-secondary-subtle: #F5EFEA;
  --color-surface: #FAF8F5;
  --color-surface-elevated: #FFFFFF;
  --color-surface-sunken: #EAE5DD;
  --color-background: #F3EFEA;
  --color-text: #1C1B19;
  --color-text-muted: #57534E;
  --color-border: #DCD6CD;
  --color-border-strong: #C5BEB3;
  --color-error: #A82424;
  --color-warning: #9C5700;
  --color-warning-bg: #FFF5E6;
  --color-success: #23633D;
  --color-success-bg: #EBF5EE;
  --font-display: 'Newsreader', 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 0 rgba(255, 255, 255, 0.85) inset, 0 1px 3px rgba(28, 27, 25, 0.06);
  --shadow-md: 0 8px 24px rgba(28, 27, 25, 0.12), 0 2px 6px rgba(28, 27, 25, 0.06);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--color-background);
  background-image: radial-gradient(rgba(122, 75, 42, 0.055) 1px, transparent 0);
  background-size: 20px 20px;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  max-width: 1480px;
  margin: 0 auto;
  padding: 16px 20px 32px 20px;
}

/* --- HEADER & STATUS BAR --- */
.app-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-strong);
}

.app-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 1.8vw, 24px);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--color-text);
}

.app-subtitle {
  margin: 2px 0 0 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.header-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-border);
}

.status-ok {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border-color: #B7DFC5;
}

.status-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border-color: #F0C48A;
}

.timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background-color: var(--color-secondary-subtle);
  color: var(--color-secondary);
  border: 1px solid #D6BEAA;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* --- TOAST BANNER (NON-DESTRUCTIVE OVERLAY) --- */
#toast-mount-slot {
  position: relative;
}

.toast-banner {
  margin-top: 8px;
  padding: 9px 14px;
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 13px;
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  animation: toastSlideIn 180ms var(--ease-out-expo);
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* --- PRIMARY NAVIGATION TABS (SINGLE LINE ON DESKTOP) --- */
.app-tabs {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 4px;
  margin: 12px 0;
  padding: 4px;
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  scrollbar-width: none;
}

.app-tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 9px;
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 600;
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 140ms var(--ease-out-expo), color 140ms var(--ease-out-expo), transform 120ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.tab-btn:hover {
  background-color: rgba(250, 248, 245, 0.7);
}

.tab-btn:active {
  transform: scale(0.99);
}

.tab-count-pill {
  display: inline-block;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-xs);
  background-color: rgba(28, 27, 25, 0.08);
  color: inherit;
}

.tab-active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
  box-shadow: 0 1px 3px rgba(28, 27, 25, 0.16);
}

.tab-active:hover {
  background-color: var(--color-primary-hover);
}

.tab-active .tab-count-pill {
  background-color: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

.tab-btn:focus-visible,
.btn:focus-visible,
.seg-btn:focus-visible,
.form-input:focus-visible,
.form-select:focus-visible,
.form-textarea:focus-visible,
.chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* --- PRESET & SUB-NAVIGATION BAR --- */
.preset-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
  padding: 9px 14px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.preset-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.preset-label {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-right: 4px;
}

/* --- WORKBENCH TWO-COLUMN GRID --- */
.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 980px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
}

.panel-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* --- CARDS & HEADERS --- */
.card {
  min-width: 0;
  overflow-wrap: break-word;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.card-rescue {
  border-left: 4px solid var(--color-warning);
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.card-header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.card-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
}

.subsection-title {
  margin: 14px 0 8px 0;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--color-secondary);
}

/* --- FORMS, INPUTS & CUSTOM SELECT CARETS --- */
.form-row {
  margin-bottom: 12px;
}

.form-row-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

@media (max-width: 640px) {
  .form-row-split {
    grid-template-columns: 1fr;
  }
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--color-text);
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 11px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--color-text);
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  transition: border-color 140ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.form-input:hover, .form-select:hover, .form-textarea:hover {
  border-color: #9E9689;
}

.form-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2357534E' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
}

.form-select-sm {
  width: auto;
  padding: 5px 26px 5px 9px;
  font-size: 12px;
  background-position: right 8px center;
}

.inline-action-group .form-select:not(.form-select-sm) {
  flex: 1 1 110px;
  min-width: 0;
  width: auto;
}

.menu-quick-add-box .inline-action-group {
  flex-wrap: nowrap;
}

.mono-textarea {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
}

/* --- SEARCH INPUT WITH KBD SHORTCUT & CLEAR BUTTON --- */
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input-wrap .form-input {
  padding-right: 64px;
}

.search-input-accessory {
  position: absolute;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kbd-hint {
  display: inline-block;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  pointer-events: none;
}

.search-clear-btn {
  padding: 2px 7px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.search-clear-btn:hover {
  color: var(--color-text);
  background-color: #E0D9CE;
}

/* --- BUTTONS & SEGMENTED CONTROLS --- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 12px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 140ms var(--ease-out-expo), border-color 140ms var(--ease-out-expo), transform 100ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  background-color: #F4F2EE !important;
  color: var(--color-text-muted) !important;
  border-color: var(--color-border) !important;
  box-shadow: none !important;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: var(--color-surface-elevated);
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.btn-secondary:hover:not(:disabled) {
  background-color: #F0ECE3;
  border-color: #ACA497;
}

.btn-warning-override {
  background-color: var(--color-warning);
  color: #FFFFFF;
  border-color: var(--color-warning);
}

.btn-danger-outline {
  background-color: var(--color-surface-elevated);
  color: var(--color-error);
  border-color: #E2B4B4;
}

.btn-danger-outline:hover:not(:disabled) {
  background-color: #FDF2F2;
  border-color: var(--color-error);
}

.segmented-control {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 3px;
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.segmented-control-full {
  display: flex;
  flex-wrap: nowrap;
  width: 100%;
}

.segmented-control-full .seg-btn {
  padding: 5px 6px;
  font-size: 11.5px;
  min-width: 0;
}

.seg-btn {
  flex: 1 1 auto;
  padding: 5px 10px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  cursor: pointer;
  white-space: nowrap;
  text-align: center;
  transition: background-color 140ms var(--ease-out-expo), color 140ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.seg-btn:hover {
  color: var(--color-text);
}

.seg-btn-active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  box-shadow: 0 1px 2px rgba(28, 27, 25, 0.14);
}

.seg-btn-active:hover {
  color: #FFFFFF;
  background-color: var(--color-primary-hover);
}

/* --- CHIPS --- */
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 120ms var(--ease-out-expo), border-color 120ms var(--ease-out-expo), transform 100ms var(--ease-spring);
}

.chip:hover {
  background-color: #F0ECE3;
  border-color: var(--color-border-strong);
}

.chip:active {
  transform: scale(0.96);
}

.chip-active {
  background-color: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
}

.chip-active:hover {
  background-color: var(--color-primary-hover);
  color: #FFFFFF;
}

/* --- AUTOCOMPLETE COMBOBOX --- */
.search-combobox-wrap {
  position: relative;
}

.autocomplete-popover {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 60;
  max-height: 340px;
  overflow-y: auto;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  margin-top: 4px;
  animation: popoverFadeIn 150ms var(--ease-out-expo);
}

@keyframes popoverFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.autocomplete-option {
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color 100ms ease-out;
}

.autocomplete-option:last-child {
  border-bottom: none;
}

.autocomplete-option:hover, .ac-focused {
  background-color: #F2EFE9;
}

.ac-status-pairing_concern {
  border-left: 4px solid var(--color-warning);
}

.ac-status-recommended {
  border-left: 4px solid var(--color-success);
}

.ac-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.ac-row-meta {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.override-confirmation-banner {
  margin-top: 12px;
  padding: 12px 14px;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-left: 4px solid var(--color-warning);
  border-radius: var(--radius-sm);
  animation: popoverFadeIn 180ms var(--ease-out-expo);
}

.override-banner-title {
  color: var(--color-warning);
  margin-bottom: 4px;
}

.override-banner-body, .override-banner-note {
  margin: 4px 0;
  font-size: 13px;
}

.override-banner-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* --- SELECTED INGREDIENTS & INTERACTIVE ROWS --- */
.selected-ingredients-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-item-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: border-color 140ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.selected-item-row:hover {
  border-color: var(--color-border-strong);
}

.selected-item-override {
  border-left: 4px solid var(--color-warning);
}

.selected-item-main {
  flex: 1 1 230px;
}

.selected-item-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.selected-item-notes {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.selected-item-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* --- BADGES & TAGS --- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-xs);
}

.badge-strong {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid #B7DFC5;
}

.badge-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid #F0C48A;
}

.badge-role {
  background-color: var(--color-secondary-subtle);
  color: var(--color-secondary);
  border: 1px solid #DFCFC2;
}

.badge-neutral {
  background-color: #F4F2EE;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

/* --- 8-AXIS FLAVOR METERS --- */
.flavor-meters-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.meter-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.mono-num {
  font-family: var(--font-mono);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.meter-track {
  height: 8px;
  background-color: var(--color-surface-sunken);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-xs);
  transition: width 260ms var(--ease-out-expo);
}

.meter-fill-acidity { background-color: #2E6F40; }
.meter-fill-fat { background-color: #8C5828; }
.meter-fill-sweet { background-color: #9E5A3C; }
.meter-fill-heat { background-color: #A63429; }
.meter-fill-herbal { background-color: #2B6653; }

/* --- WARNINGS & RECOMMENDATIONS --- */
.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-elevated);
}

.warning-challenging {
  background-color: var(--color-warning-bg);
  border-color: #F0C48A;
  border-left: 4px solid var(--color-warning);
}

.warning-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.warning-item-body {
  margin: 4px 0 0 0;
  font-size: 13px;
}

.filter-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

@media (max-width: 640px) {
  .filter-bar, .flavor-meters-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .form-select-sm {
    max-width: 100%;
  }
  .btn {
    white-space: normal;
    text-align: center;
  }
}

.recommendations-grid, .rec-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-card, .rec-mini-card {
  padding: 11px 13px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: border-color 140ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.rec-card:hover, .rec-mini-card:hover {
  border-color: var(--color-border-strong);
}

.bridge-card {
  border-left: 4px solid var(--color-primary);
}

.rec-card-header, .rec-mini-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.rec-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.rec-explanation, .rec-mini-desc {
  margin: 6px 0;
  font-size: 13px;
  color: var(--color-text);
}

.rec-mini-meta {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.rec-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-pill {
  font-size: 11px;
  padding: 1px 6px;
  background-color: var(--color-background);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
}

.custom-sauce-box, .storage-disclosure-box {
  margin-top: 10px;
  padding: 10px 12px;
  background-color: #F4F1EA;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-secondary);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

/* --- MENU COURSES --- */
.menu-courses-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.menu-course-card {
  padding: 12px 14px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.menu-course-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.menu-course-body {
  font-size: 13px;
  color: var(--color-text-muted);
}

.inline-action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.empty-state, .empty-state-compact {
  padding: 20px 16px;
  text-align: center;
  color: var(--color-text-muted);
  background-color: var(--color-surface-elevated);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* --- PHASE 2: RECIPE DISCOVERY, COOKING FOR ENGINEERS MATRIX, NUTRITION & SHOPPING LIST --- */
.recipe-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

@media (max-width: 560px) {
  .recipe-filter-grid {
    grid-template-columns: 1fr;
  }
}

.recipe-list-scroll {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 760px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
}

.recipe-card-item {
  padding: 11px 13px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 120ms var(--ease-out-expo), border-color 120ms var(--ease-out-expo), transform 100ms var(--ease-out-expo);
}

.recipe-card-item:hover {
  background-color: #F5F2EC;
  border-color: var(--color-border-strong);
}

.recipe-card-active {
  border: 2px solid var(--color-primary);
  background-color: var(--color-primary-subtle);
}

.recipe-progress-bar-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

/* --- COOKING FOR ENGINEERS PROCESS MATRIX (STICKY LEFT COLUMNS & INTERACTIVE STAGES) --- */
.cfe-diagram-wrapper {
  margin-top: 10px;
  max-width: 100%;
}

.cfe-diagram-legend {
  padding: 9px 12px;
  margin-bottom: 10px;
  font-size: 12px;
  background-color: #F4F1EA;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.cfe-table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-elevated);
  scrollbar-width: thin;
}

.cfe-process-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  min-width: 600px;
}

.cfe-process-table th, .cfe-process-table td {
  border-right: 1px solid #C8C1B6;
  border-bottom: 1px solid #C8C1B6;
  padding: 8px 10px;
  vertical-align: middle;
  text-align: left;
}

.cfe-process-table thead th {
  background-color: #EFECE6;
  color: var(--color-text);
  font-weight: 600;
  border-bottom: 2px solid var(--color-border-strong);
}

.cfe-th-qty, .cfe-td-qty {
  position: sticky;
  left: 0;
  z-index: 4;
  width: 86px;
  min-width: 86px;
  white-space: nowrap;
  background-color: #FAF8F5;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.cfe-th-ing, .cfe-td-ing {
  position: sticky;
  left: 86px;
  z-index: 4;
  width: 195px;
  min-width: 185px;
  background-color: #FAF8F5;
  box-shadow: 2px 0 4px rgba(28, 27, 25, 0.05);
}

.cfe-ing-row:hover .cfe-td-qty,
.cfe-ing-row:hover .cfe-td-ing {
  background-color: #F2EFE8;
}

.cfe-ing-prep {
  color: var(--color-text-muted);
  font-size: 11px;
}

.cfe-ing-group {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-secondary);
  margin-top: 2px;
}

.cfe-stage-num {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.cfe-stage-verb {
  font-size: 12px;
  color: var(--color-primary);
}

.cfe-th-stage-done {
  background-color: var(--color-success-bg) !important;
}

.cfe-cell-action {
  background-color: #F3F8F5;
  border: 2px solid var(--color-primary) !important;
  min-width: 170px;
  cursor: pointer;
  transition: background-color 120ms ease-out;
}

.cfe-cell-action:hover {
  background-color: #E6F2EB;
}

.cfe-cell-action-done {
  background-color: #EBF5EE;
  border-color: var(--color-success) !important;
  opacity: 0.82;
}

.cfe-timer-btn {
  cursor: pointer;
}

.cfe-timer-btn:hover {
  background-color: var(--color-secondary);
  color: #FFFFFF;
}

.cfe-action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cfe-action-verb {
  color: var(--color-primary);
  font-size: 13px;
}

.cfe-action-temp {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-secondary);
  margin-bottom: 4px;
}

.cfe-action-desc {
  margin: 4px 0;
  font-size: 12px;
  line-height: 1.4;
}

.cfe-action-cue {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #B7DFC5;
  font-size: 11px;
  color: var(--color-success);
}

.cfe-cell-pass {
  background-color: #FAF8F5;
  text-align: center !important;
  color: #9E978E;
  font-family: var(--font-mono);
}

.cfe-cell-carry {
  background-color: #FFFDF9;
  text-align: center !important;
  color: var(--color-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
}

/* --- STEP CARDS & SHOPPING CHECKOFF --- */
.step-card {
  padding: 12px 14px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  transition: background-color 140ms var(--ease-out-expo), border-color 140ms var(--ease-out-expo);
}

.step-card:hover {
  border-color: var(--color-border-strong);
}

.step-card-done {
  opacity: 0.72;
  background-color: #F4F2EE;
  border-left-color: var(--color-success);
}

.shopping-item-checked {
  opacity: 0.6;
  background-color: #F4F2EE;
}

.shopping-item-checked strong {
  text-decoration: line-through;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 8px;
  margin: 10px 0;
}

.nutrition-stat-box {
  padding: 10px 12px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-variant-numeric: tabular-nums;
}

.chef-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

/* --- ATELIER HOME / EDITORIAL LANDING PAGE --- */
.atelier-home-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.atelier-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  gap: 24px;
  align-items: center;
  padding: 28px 30px;
  background: linear-gradient(135deg, #13211B 0%, #1C3128 65%, #233B30 100%);
  color: #FAF8F5;
  border: 1px solid #355044;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

@media (max-width: 960px) {
  .atelier-hero {
    grid-template-columns: 1fr;
    padding: 20px 18px;
  }
}

.atelier-eyebrow {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  margin-bottom: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #DFB77C;
  background-color: rgba(223, 183, 124, 0.12);
  border: 1px solid rgba(223, 183, 124, 0.35);
  border-radius: var(--radius-xs);
}

.atelier-hero-title {
  margin: 0 0 12px 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 2.7vw, 36px);
  font-weight: 600;
  line-height: 1.16;
  letter-spacing: -0.02em;
  color: #FAF8F5;
}

.atelier-hero-title em {
  font-style: italic;
  color: #DFB77C;
  font-weight: 500;
}

.atelier-hero-lead {
  margin: 0 0 18px 0;
  font-size: 14.5px;
  line-height: 1.58;
  color: #D8D3C8;
  max-width: 64ch;
}

.atelier-hero-cta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.btn-hero-primary {
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 700;
  color: #14221C;
  background-color: #DFB77C;
  border: 1px solid #E8C896;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 140ms var(--ease-out-expo), transform 100ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
}

.btn-hero-primary:hover {
  background-color: #E9C793;
  transform: translateY(-1px);
}

.btn-hero-outline {
  padding: 9px 15px;
  font-size: 13px;
  font-weight: 600;
  color: #FAF8F5;
  background-color: rgba(250, 248, 245, 0.08);
  border: 1px solid rgba(250, 248, 245, 0.28);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 140ms var(--ease-out-expo), border-color 140ms var(--ease-out-expo);
}

.btn-hero-outline:hover {
  background-color: rgba(250, 248, 245, 0.16);
  border-color: #DFB77C;
}

.atelier-hero-sampler {
  padding-top: 14px;
  border-top: 1px solid rgba(250, 248, 245, 0.14);
}

.atelier-sampler-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #DFB77C;
  margin-bottom: 8px;
}

.atelier-sampler-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.atelier-pill {
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 600;
  color: #EAE5DD;
  background-color: rgba(250, 248, 245, 0.07);
  border: 1px solid rgba(250, 248, 245, 0.2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 120ms var(--ease-out-expo), border-color 120ms var(--ease-out-expo), transform 100ms var(--ease-spring);
}

.atelier-pill:hover {
  background-color: rgba(250, 248, 245, 0.15);
  border-color: rgba(223, 183, 124, 0.6);
}

.atelier-pill-active {
  color: #14221C;
  background-color: #DFB77C;
  border-color: #DFB77C;
}

.atelier-pill-active:hover {
  background-color: #E8C896;
}

.atelier-hero-visual {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(223, 183, 124, 0.32);
  background-color: #0E1914;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
}

.atelier-hero-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: cover;
}

.atelier-hero-caption-overlay {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: rgba(16, 28, 23, 0.94);
  border-top: 1px solid rgba(223, 183, 124, 0.25);
  font-size: 12px;
  color: #EAE5DD;
}

/* --- SECTION 1: INTERACTIVE BENTO PAIRING LAB --- */
.atelier-bento-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .atelier-bento-grid {
    grid-template-columns: 1fr;
  }
}

.atelier-specimen-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.atelier-specimen-media {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  margin-bottom: 12px;
  background-color: #E6E0D5;
}

.atelier-specimen-img {
  display: block;
  width: 100%;
  height: 195px;
  object-fit: cover;
}

.atelier-specimen-plate-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 3px 9px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  background-color: rgba(28, 27, 25, 0.84);
  color: #FAF8F5;
  border-radius: var(--radius-xs);
}

/* --- SECTION 2: EDITORIAL SPREAD (NYT 2025 & CHEF ARCHIVES) --- */
.atelier-editorial-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .atelier-editorial-grid {
    grid-template-columns: 1fr;
  }
}

.atelier-featured-recipe-card {
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.atelier-featured-recipe-img {
  display: block;
  width: 100%;
  height: 230px;
  object-fit: cover;
  border-bottom: 1px solid var(--color-border);
}

.atelier-featured-recipe-body {
  padding: 16px;
}

.atelier-showcase-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.atelier-showcase-row {
  padding: 13px 15px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-sm);
  transition: border-color 140ms var(--ease-out-expo), box-shadow 140ms var(--ease-out-expo);
}

.atelier-showcase-row:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}

/* --- SECTION 3: 4-STAGE ARCHITECTURAL PROCESS STRIP --- */
.atelier-pillars-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1080px) {
  .atelier-pillars-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .atelier-pillars-grid {
    grid-template-columns: 1fr;
  }
}

.atelier-pillar-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.atelier-pillar-card-accent {
  border-top-color: var(--color-secondary);
}

.atelier-pillar-num {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-secondary);
  margin-bottom: 6px;
}

.atelier-pillar-title {
  margin: 0 0 6px 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.atelier-pillar-desc {
  margin: 0 0 12px 0;
  font-size: 12.8px;
  color: var(--color-text-muted);
  line-height: 1.48;
}

/* --- SECTION 4: PROVENANCE LEDGER & FINAL CTA --- */
.atelier-ledger-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.atelier-ledger-cell {
  padding: 12px 14px;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.atelier-ledger-val {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.atelier-ledger-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  margin-top: 3px;
}

.atelier-ledger-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.atelier-final-cta-banner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  background: linear-gradient(135deg, #16261F 0%, #233C31 100%);
  color: #FAF8F5;
  border-radius: var(--radius-md);
  border: 1px solid #355044;
}

/* --- REDUCED MOTION & PRINT KITCHEN SHEET --- */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@media print {
  body {
    background: #FFFFFF !important;
    color: #000000 !important;
  }
  .app-tabs, .preset-bar, #toast-mount-slot, .btn, .segmented-control {
    display: none !important;
  }
  .workbench-grid {
    grid-template-columns: 1fr !important;
  }
  .card {
    box-shadow: none !important;
    border: 1px solid #999999 !important;
    break-inside: avoid;
  }
}
`;
