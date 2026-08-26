"""前端页面截图检查 —— 逐一截图所有页面"""
from playwright.sync_api import sync_playwright
import os, time

BASE = "http://127.0.0.1:8080"
OUT = "screenshots"
os.makedirs(OUT, exist_ok=True)

pages_to_check = [
    ("01-home", "/#home", "系统首页"),
    ("02-case-center", "/#case-center", "案件中心"),
    ("03-case-analysis", "/#case-analysis", "智能案情分析"),
    ("04-contract", "/#contract", "合同管理"),
    ("05-consultation", "/#consultation", "智能咨询"),
    ("06-templates", "/#templates", "文书模板"),
    ("07-calculators", "/#calculators", "计算工具"),
    ("08-evidence", "/#evidence", "证据指引"),
    ("09-kg", "/#kg", "知识图谱"),
    ("10-audit", "/#audit", "审计报告"),
    ("11-rpa", "/#rpa", "自动化工具"),
    ("12-settings", "/#settings", "系统配置"),
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
        )
        page = context.new_page()

        # 1. 登录
        print("Logging in...")
        page.goto(BASE, wait_until="networkidle", timeout=15000)
        time.sleep(2)

        # Fill login form
        page.fill("#login-username", "admin")
        page.fill("#login-password", "admin123")
        page.click("button:has-text('登 录')")
        time.sleep(2)

        # Verify logged in
        try:
            page.wait_for_selector("#user-info", timeout=5000)
            print("Login OK")
        except:
            # Take debug screenshot
            page.screenshot(path=f"{OUT}/login-debug.png")
            print("Login may have failed, continuing anyway...")

        # 2. Screenshot each page
        for name, hash_path, title in pages_to_check:
            print(f"Capturing {name}: {title}...")
            try:
                page.goto(BASE + hash_path, wait_until="networkidle", timeout=10000)
                time.sleep(1.5)  # Wait for GSAP animations

                # Trigger data loads for specific pages
                if "case-center" in name:
                    time.sleep(0.5)
                if "templates" in name:
                    time.sleep(0.5)
                if "calculators" in name:
                    # Click first tab to ensure it shows
                    tab = page.query_selector('.tab[data-tab="calc-fee"]')
                    if tab: tab.click()
                    time.sleep(0.5)
                if "evidence" in name:
                    time.sleep(0.5)
                if "kg" in name:
                    time.sleep(0.5)
                if "audit" in name:
                    time.sleep(0.5)

                # Scroll to ensure scroll-triggered content loads
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.3)

                page.screenshot(path=f"{OUT}/{name}.png", full_page=False)
                print(f"  -> {OUT}/{name}.png saved")
            except Exception as e:
                print(f"  -> ERROR: {e}")
                page.screenshot(path=f"{OUT}/{name}-error.png")

        # 3. Test some interactions
        print("\nTesting interactions...")

        # Test case analysis step flow
        print("Testing case analysis flow...")
        page.goto(BASE + "/#case-analysis", wait_until="networkidle", timeout=10000)
        time.sleep(2)
        # Click first case type
        card = page.query_selector('.case-type-card')
        if card:
            card.click()
            time.sleep(0.5)
            page.screenshot(path=f"{OUT}/13-case-type-selected.png")
            print("  -> Case type selected")
        else:
            print("  -> No case type cards found (API may need auth)")

        # Test chat interface
        print("Testing consultation chat...")
        page.goto(BASE + "/#consultation", wait_until="networkidle", timeout=10000)
        time.sleep(1.5)
        page.fill("#chat-input", "合同违约金怎么算")
        page.screenshot(path=f"{OUT}/14-chat-filled.png")
        print("  -> Chat input filled")

        # Test calculator
        print("Testing calculator...")
        page.goto(BASE + "/#calculators", wait_until="networkidle", timeout=10000)
        time.sleep(1.5)
        # Ensure fee tab is active
        tab = page.query_selector('.tab[data-tab="calc-fee"]')
        if tab: tab.click()
        time.sleep(0.5)
        page.screenshot(path=f"{OUT}/15-calculator-fee.png")
        print("  -> Calculator fee tab")

        # Test templates
        print("Testing templates...")
        page.goto(BASE + "/#templates", wait_until="networkidle", timeout=10000)
        time.sleep(2)
        page.screenshot(path=f"{OUT}/16-templates-loaded.png")
        print("  -> Templates page")

        # 4. Mobile viewport test
        print("\nTesting mobile viewport...")
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/#home", wait_until="networkidle", timeout=10000)
        time.sleep(1)
        page.screenshot(path=f"{OUT}/17-mobile-home.png")
        page.goto(BASE + "/#consultation", wait_until="networkidle", timeout=10000)
        time.sleep(1)
        page.screenshot(path=f"{OUT}/18-mobile-chat.png")
        print("  -> Mobile screenshots done")

        browser.close()
    print(f"\nDone! {len(os.listdir(OUT))} screenshots saved to {OUT}/")

if __name__ == "__main__":
    run()
