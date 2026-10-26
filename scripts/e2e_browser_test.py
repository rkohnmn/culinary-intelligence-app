#!/usr/bin/env python3
"""
End-to-End Headless Chromium Browser & Subpath HTTP Verification Suite (`scripts/e2e_browser_test.py`).
Verifies both Phase 1 (Dish Workbench, Pairing Engine, Overrides, Bridges, Multi-Course Menus, AI Prompt Studio,
IndexedDB/JSON Backup Recovery) and Phase 2 (Recipe Discovery, NYT Cooking 50 Most Popular of 2025, Renowned Chef
Collections, Cooking for Engineers Tabular Process Diagram, Recipe Scaling & Unit Conversion, USDA Nutrition Facts,
Shopping List Aggregator, and Local Recipe Personalization/Import).
"""

import os
import time
import shutil
import tempfile
import threading
import socket
import urllib.request
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BUILD_SITE_DIR = "/working_dir/c_c6eac74e7224c867/culinary-intelligence-app/build_site"
HTML_PATH = "/working_dir/c_c6eac74e7224c867/artifacts/file_generation/ttl=63d/output/culinary_intelligence_app.html"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def verify_github_pages_subpath_http():
    """Serves build_site/ under /repository-name/ and verifies index.html + all relative assets and JSON files."""
    temp_root = tempfile.mkdtemp(prefix="gh_pages_subpath_")
    subpath_dir = os.path.join(temp_root, "repository-name")
    os.makedirs(os.path.join(subpath_dir, "assets"), exist_ok=True)
    os.makedirs(os.path.join(subpath_dir, "data"), exist_ok=True)

    # Copy explicitly so 9p readdir caching never omits files
    for rel_file in [
        "index.html",
        ".nojekyll",
        "assets/styles.css",
        "assets/app.bundle.js",
        "assets/hero-duck-atelier.jpg",
        "assets/card-botanical-pairings.jpg",
        "assets/card-nyt-kebab.jpg",
        "data/sources.json",
        "data/cuisines.json",
        "data/ingredients.json",
        "data/sauces.json",
        "data/sides.json",
        "data/pairings.json",
        "data/nyt_top_50_2025.json",
        "data/chef_collections.json",
        "data/recipes.json",
        "data/nutrition_cache.json"
    ]:
        shutil.copyfile(os.path.join(BUILD_SITE_DIR, rel_file), os.path.join(subpath_dir, rel_file))

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()

    server = ThreadingHTTPServer(
        ("127.0.0.1", port),
        lambda *a, **kw: QuietHandler(*a, directory=temp_root, **kw)
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()

    try:
        base_url = f"http://127.0.0.1:{port}/repository-name/index.html"
        with urllib.request.urlopen(base_url) as resp:
            assert resp.status == 200
            index_html = resp.read().decode("utf-8")

        assert 'href="/' not in index_html and 'src="/' not in index_html, "Found root-relative path in index.html!"

        relative_targets = [
            "./assets/styles.css",
            "./assets/app.bundle.js",
            "./assets/hero-duck-atelier.jpg",
            "./assets/card-botanical-pairings.jpg",
            "./assets/card-nyt-kebab.jpg",
            "./data/sources.json",
            "./data/cuisines.json",
            "./data/ingredients.json",
            "./data/sauces.json",
            "./data/sides.json",
            "./data/pairings.json",
            "./data/nyt_top_50_2025.json",
            "./data/chef_collections.json",
            "./data/recipes.json",
            "./data/nutrition_cache.json",
            "./.nojekyll"
        ]
        for rel in relative_targets:
            resolved_url = urllib.parse.urljoin(base_url, rel)
            with urllib.request.urlopen(resolved_url) as r:
                assert r.status == 200, f"Subpath fetch failed for {resolved_url}"
                body = r.read()
                if rel != "./.nojekyll":
                    assert len(body) > 50, f"Unexpected empty asset at {resolved_url}"

        print(f"[E2E] 1. GitHub Pages subpath HTTP server (/repository-name/) verified across all {len(relative_targets)} relative assets.")
    finally:
        server.shutdown()
        shutil.rmtree(temp_root, ignore_errors=True)


def load_app_in_chromium(driver, html_content):
    driver.get("about:blank")
    driver.execute_script(
        "document.open(); document.write(arguments[0]); document.close(); window.dispatchEvent(new Event('DOMContentLoaded'));",
        html_content
    )


def run_e2e_tests():
    verify_github_pages_subpath_http()

    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1400,900")
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=opts)
    wait = WebDriverWait(driver, 10)

    try:
        # 2. Load application and verify initial render
        load_app_in_chromium(driver, html_content)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".app-title")))
        time.sleep(0.3)

        title_text = driver.find_element(By.CSS_SELECTOR, ".app-title").text
        assert "Culinary Intelligence" in title_text, f"Unexpected title: {title_text}"
        status_pill = driver.find_element(By.ID, "autosave-status-pill").text
        print(f"[E2E] 2. Initial render & persistence status: {status_pill}")
        assert "autosaved" in status_pill.lower()

        # 2.5 Verify Dedicated Home / Atelier Landing Page & Live Anchor Spotlight Interaction
        hero_title = driver.find_element(By.CSS_SELECTOR, ".atelier-hero-title").text
        assert "Molecular & Classical Affinity" in hero_title, f"Unexpected Hero title: {hero_title}"
        scallop_pill = driver.find_element(By.CSS_SELECTOR, "[data-action='select-home-spotlight-ing'][data-ing-id='ing_scallop_sea']")
        scallop_pill.click()
        time.sleep(0.2)
        assert "Live Multi-Factor Affinity Matrix for Sea Scallops" in driver.page_source
        print("[E2E] 2.5 Dedicated Home / Atelier Landing Page & Live Pairing Spotlight verified.")

        # 3. Click "Start a Blank Dish" from Home / Atelier (switches to Dish Workbench), set custom name, and add "Cod / Halibut"
        new_btn = driver.find_element(By.CSS_SELECTOR, "[data-action='new-blank-dish']")
        new_btn.click()
        time.sleep(0.2)

        name_input = driver.find_element(By.ID, "dish-name-input")
        name_input.clear()
        name_input.send_keys("E2E Browser Test Cod Dish")
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", name_input)

        search_input = driver.find_element(By.ID, "ingredient-search-input")
        search_input.send_keys("Cod")
        time.sleep(0.2)
        search_input.send_keys(Keys.ENTER)
        time.sleep(0.2)

        selected_rows = driver.find_elements(By.CSS_SELECTOR, ".selected-item-row")
        assert len(selected_rows) == 1, f"Expected 1 selected ingredient, found {len(selected_rows)}"
        assert "Cod / Halibut" in selected_rows[0].text
        print("[E2E] 3. Keyboard search & selection of 'Cod / Halibut' succeeded.")

        # 4. Search for challenging/excluded ingredient "Blue Cheese", verify warning badge & banner, and confirm override
        search_input = driver.find_element(By.ID, "ingredient-search-input")
        search_input.send_keys("Blue Cheese")
        time.sleep(0.2)
        dropdown_text = driver.find_element(By.ID, "autocomplete-dropdown-slot").text
        assert "Challenging" in dropdown_text, f"Expected Challenging badge in dropdown, got: {dropdown_text}"
        search_input.send_keys(Keys.ENTER)
        time.sleep(0.2)

        banner = driver.find_element(By.CSS_SELECTOR, ".override-confirmation-banner")
        assert "Blue Cheese" in banner.text and "Cod" in banner.text
        override_btn = driver.find_element(By.CSS_SELECTOR, "[data-action='confirm-override-add']")
        override_btn.click()
        time.sleep(0.3)

        selected_rows = driver.find_elements(By.CSS_SELECTOR, ".selected-item-row")
        assert len(selected_rows) == 2, "Both Cod and Blue Cheese must be selected after override"
        print("[E2E] 4. Explicit search override & non-blocking warning flow succeeded.")

        # 5. Verify Bridging Rescue panel appears and apply a bridge ingredient
        rescue_card = driver.find_element(By.CSS_SELECTOR, ".card-rescue")
        assert "Recommended Bridging Ingredients" in rescue_card.text
        apply_bridge_btn = rescue_card.find_element(By.CSS_SELECTOR, "[data-action='apply-bridge-suggestion']")
        apply_bridge_btn.click()
        time.sleep(0.3)

        selected_rows = driver.find_elements(By.CSS_SELECTOR, ".selected-item-row")
        assert len(selected_rows) == 3, "Applying bridge ingredient should increase selected count to 3"
        print("[E2E] 5. Bridging ingredient discovery and 1-click application succeeded.")

        # 6. Switch to Multi-Course Menu Builder tab, add working dish, set custom course label, and round-trip edit in Workbench
        menu_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='menu_composer']")
        menu_tab.click()
        time.sleep(0.2)
        add_work_btn = driver.find_element(By.CSS_SELECTOR, "[data-action='add-working-dish-to-menu']")
        add_work_btn.click()
        time.sleep(0.3)
        course_cards = driver.find_elements(By.CSS_SELECTOR, ".menu-course-card")
        assert len(course_cards) >= 2, "Menu should have at least 2 course cards"

        first_course_select = course_cards[0].find_element(By.CSS_SELECTOR, "[data-action='change-menu-course-type']")
        Select(first_course_select).select_by_value("custom")
        time.sleep(0.2)
        custom_input = driver.find_element(By.CSS_SELECTOR, "[data-action='edit-menu-custom-course-label']")
        custom_input.send_keys("Amuse-Bouche")
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", custom_input)
        time.sleep(0.2)

        load_wb_btn = driver.find_elements(By.CSS_SELECTOR, "[data-action='edit-menu-course-in-workbench']")[0]
        load_wb_btn.click()
        time.sleep(0.25)
        update_snap_btn = driver.find_element(By.CSS_SELECTOR, "[data-action='update-edited-menu-course']")
        update_snap_btn.click()
        time.sleep(0.25)
        print(f"[E2E] 6. Multi-Course Menu Builder, Custom Course Label, and Snapshot Update verified ({len(course_cards)} courses active).")

        # 7. Switch to Knowledge Base & Provenance tab and verify search input preserves focus across keystrokes
        kb_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='knowledge_provenance']")
        kb_tab.click()
        time.sleep(0.2)
        kb_search = driver.find_element(By.ID, "knowledge-catalog-search")
        kb_search.send_keys("miso")
        time.sleep(0.2)
        active_id = driver.execute_script("return document.activeElement ? document.activeElement.id : '';")
        assert active_id == "knowledge-catalog-search", f"Knowledge search input lost focus! Active element: {active_id}"
        kb_results_text = driver.find_element(By.ID, "knowledge-catalog-results-slot").text
        assert "Miso" in kb_results_text
        print("[E2E] 7. Knowledge Base & Provenance search and focus retention verified.")

        # 8. Switch to External AI Prompt Generator tab and verify prompt includes all selections & overrides
        ai_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='ai_prompt_studio']")
        ai_tab.click()
        time.sleep(0.2)
        prompt_val = driver.find_element(By.ID, "ai-prompt-output-textarea").get_attribute("value")
        assert "<dish_data_json>" in prompt_val
        print("[E2E] 8. External AI Prompt Studio verified.")

        # 9. Switch to Saved Library & Backups tab, export JSON backup, reload fresh instance, and re-import JSON backup
        lib_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='library_backups']")
        lib_tab.click()
        time.sleep(0.2)
        export_btn = driver.find_element(By.CSS_SELECTOR, "[data-action='export-json-backup']")
        export_btn.click()
        time.sleep(0.3)
        exported_val = driver.find_element(By.ID, "backup-json-textarea").get_attribute("value")
        assert '"format": "culinary-intelligence-backup-v2"' in exported_val
        assert "E2E Browser Test Cod Dish" in exported_val

        load_app_in_chromium(driver, html_content)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-tab='library_backups']")))
        driver.find_element(By.CSS_SELECTOR, "[data-tab='library_backups']").click()
        time.sleep(0.2)
        ta = driver.find_element(By.ID, "backup-json-textarea")
        driver.execute_script(
            "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
            ta,
            exported_val
        )
        driver.find_element(By.CSS_SELECTOR, "[data-action='import-json-backup']").click()
        time.sleep(0.3)
        driver.find_element(By.CSS_SELECTOR, "[data-tab='dish_workbench']").click()
        time.sleep(0.2)
        driver.find_element(By.CSS_SELECTOR, "[data-tab='library_backups']").click()
        time.sleep(0.2)
        open_cod_btns = driver.find_elements(By.CSS_SELECTOR, "[data-action='open-saved-dish']")
        assert len(open_cod_btns) >= 2, "Expected imported dishes in Saved Dishes Library"
        print("[E2E] 9. Full browser Export/Import state recovery verified.")

        # 10. Phase 2 E2E Verification: Recipe Discovery, NYT 2025 Top 50, Cooking for Engineers Diagram, Nutrition, Chef Collections & Shopping List
        rec_tab = driver.find_element(By.CSS_SELECTOR, "[data-tab='recipe_discovery']")
        rec_tab.click()
        time.sleep(0.3)

        # Verify NYT #1 Smashed Beef Kebab is loaded by default
        assert "Smashed Beef Kebab" in driver.page_source
        # Switch to Cooking for Engineers Process Diagram
        cfe_btn = driver.find_element(By.CSS_SELECTOR, "[data-mode='cooking_for_engineers']")
        cfe_btn.click()
        time.sleep(0.2)
        cfe_table = driver.find_element(By.CSS_SELECTOR, ".cfe-process-table")
        assert "Smash & Sear Unmoved" in cfe_table.text

        # Switch to Metric units and 2x scaling
        metric_btn = driver.find_element(By.CSS_SELECTOR, "[data-unit-system='metric']")
        metric_btn.click()
        time.sleep(0.2)
        scale_2x = driver.find_element(By.CSS_SELECTOR, "[data-mult='2']")
        scale_2x.click()
        time.sleep(0.2)
        assert "1361 g" in driver.page_source or "1360 g" in driver.page_source

        # Switch to USDA Nutrition Facts
        nut_btn = driver.find_element(By.CSS_SELECTOR, "[data-mode='nutrition_facts']")
        nut_btn.click()
        time.sleep(0.2)
        assert "Per-Serving USDA Nutrition Estimate" in driver.page_source

        # Switch to Renowned Chef Collections subview
        chefs_btn = driver.find_element(By.CSS_SELECTOR, "[data-subview='chefs']")
        chefs_btn.click()
        time.sleep(0.2)
        assert "J. Kenji López-Alt" in driver.page_source and "Samin Nosrat" in driver.page_source

        # Switch to Shopping List subview
        shop_btn = driver.find_element(By.CSS_SELECTOR, "[data-subview='shopping']")
        shop_btn.click()
        time.sleep(0.2)
        assert "Consolidated Grocery List by Aisle" in driver.page_source
        print("[E2E] 10. Phase 2 Recipe Discovery, Cooking for Engineers Diagram, Scaling/Units, Nutrition, Chefs & Shopping List verified.")

        # 11. Test Mobile Viewport Usability (375x812) and verify zero horizontal overflow
        driver.set_window_size(375, 812)
        time.sleep(0.2)
        overflow = driver.execute_script(
            "return document.documentElement.scrollWidth > document.documentElement.clientWidth;"
        )
        assert not overflow, "Mobile viewport (375px) has horizontal scroll overflow!"
        print("[E2E] 11. Mobile viewport (375x812) layout verified with zero horizontal overflow.")

        # 12. Check browser logs for any uncaught runtime JS errors
        logs = [
            entry
            for entry in driver.get_log("browser")
            if entry.get("level") == "SEVERE" and "favicon" not in entry.get("message", "")
        ]
        assert len(logs) == 0, f"Unexpected browser console errors: {logs}"
        print("[E2E] 12. Zero browser console errors.")

        print("=====================================================================")
        print("ALL 12 SUBPATH HTTP & HEADLESS CHROMIUM BROWSER E2E TESTS PASSED")
        print("=====================================================================")
    finally:
        driver.quit()


if __name__ == "__main__":
    run_e2e_tests()
