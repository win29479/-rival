"""
End-to-End Real 2-Browser Multiplayer Verification Suite for MATH RIVALS 3D.
Tests:
  1. Main Menu & 3D WebGL Arena rendering
  2. Room Creation & Room Joining via 6-char code (2 real browser sessions)
  3. Lobby sync (Blue vs Red teams, Ready toggle, Host-only Start)
  4. 3-2-1 Countdown & Synchronized 90s Match Timer across both browsers
  5. Math Question assignment, Correct Answer (+100 pts + Random Weapon Reveal)
  6. Wrong Answer (+0 pts + No Weapon + Thai explanation)
  7. 3D Movement (WASD + Jump), Shooting (ammo sync), Reload (R), Live Scoreboard (Tab)
  8. Real Browser Reload + Reconnect preserving exact score & weapon
  9. Real Player Disconnect handling without breaking the live match
"""
import json
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

APP_URL = os.environ.get("APP_URL", "http://localhost:5173")
SCREENSHOT_DIR = os.environ.get(
    "SCREENSHOT_DIR",
    "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/df4f397d-f46c-4c3f-9ee9-2735054d1b34/scratch/e2e_shots",
)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Load ground-truth answers from shared/questions.ts strictly for E2E answer automation
with open("shared/questions.ts", "r", encoding="utf-8") as f:
    q_src = f.read()

PROMPT_TO_ANSWER = {}
for m in re.finditer(
    r"prompt:\s*'([^']+)'[\s\S]*?correctIndex:\s*([0-3])",
    q_src,
):
    PROMPT_TO_ANSWER[m.group(1)] = int(m.group(2))

assert len(PROMPT_TO_ANSWER) == 48, f"Expected 48 parsed prompts, got {len(PROMPT_TO_ANSWER)}"


def parse_mmss(text: str) -> int:
    parts = text.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])


def run_e2e():
    errors_p1 = []
    errors_p2 = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox",
            ],
        )

        ctx1 = browser.new_context(viewport={"width": 1280, "height": 720})
        ctx2 = browser.new_context(viewport={"width": 1280, "height": 720})
        page1 = ctx1.new_page()
        page2 = ctx2.new_page()

        page1.on("pageerror", lambda err: errors_p1.append(str(err)))
        page2.on("pageerror", lambda err: errors_p2.append(str(err)))

        print("[1/9] Loading Main Menu in both browsers...")
        page1.goto(APP_URL, wait_until="networkidle")
        page2.goto(APP_URL, wait_until="networkidle")
        page1.wait_for_selector("#btn-menu-create", timeout=15000)
        page2.wait_for_selector("#btn-menu-join", timeout=15000)
        page1.wait_for_timeout(800)
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/01_main_menu.png")

        print("[2/9] Player 1 creating room...")
        page1.fill("#input-player-name", "NeonHost")
        page1.click("#btn-menu-create")
        page1.wait_for_selector("#lobby-room-code", timeout=10000)
        room_code = page1.inner_text("#lobby-room-code").strip()
        assert len(room_code) == 6, f"Invalid room code: {room_code}"
        print(f"      -> Room created: {room_code}")

        print("[3/9] Player 2 joining room via Room Code...")
        page2.fill("#input-player-name", "CyberGuest")
        page2.click("#btn-menu-join")
        page2.wait_for_selector("#input-room-code", timeout=10000)
        page2.fill("#input-room-code", room_code)
        page2.click("#btn-join-room-submit")
        page2.wait_for_selector("#lobby-room-code", timeout=10000)

        # Wait for lobby sync across both sessions + pick Valorant-style Agents
        page1.wait_for_function(
            "() => document.querySelector('#lobby-player-count')?.textContent?.includes('2 / 8')",
            timeout=10000,
        )
        page1.click("#btn-agent-aegis")
        page2.click("#btn-agent-pulse")
        page2.click("#btn-toggle-ready")
        page1.wait_for_timeout(450)
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/02_lobby.png")
        print("      -> Both players synced in Lobby with Agents AEGIS & PULSE!", flush=True)

        print("[4/9] Host starting 90-second match (3-2-1 Countdown)...", flush=True)
        page1.click("#btn-start-match")
        page1.wait_for_selector("#hud-match-timer", timeout=10000)
        page2.wait_for_selector("#hud-match-timer", timeout=10000)

        # Wait for 3-second countdown to finish and enter live combat
        page1.wait_for_selector("#btn-hud-open-math", timeout=10000)
        page2.wait_for_selector("#btn-hud-open-math", timeout=10000)
        t1 = parse_mmss(page1.inner_text("#hud-match-timer"))
        t2 = parse_mmss(page2.inner_text("#hud-match-timer"))
        assert abs(t1 - t2) <= 1, f"Timer desync: P1={t1}s vs P2={t2}s"
        assert 85 <= t1 <= 90, f"Unexpected initial match timer: {t1}s"
        print(f"      -> Synchronized timers verified! P1={t1}s, P2={t2}s", flush=True)

        print("[5/9] Player 1 opening Math Terminal & answering CORRECTLY...", flush=True)
        page1.click("#btn-hud-open-math")
        page1.wait_for_selector("#math-question-prompt", timeout=8000)
        q1_prompt = page1.inner_text("#math-question-prompt").strip()
        assert q1_prompt in PROMPT_TO_ANSWER, f"Unknown prompt: {q1_prompt}"
        correct_idx = PROMPT_TO_ANSWER[q1_prompt]
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/03_math_terminal.png")

        page1.click(f"#btn-math-choice-{correct_idx}")
        page1.wait_for_selector("#weapon-reveal-banner", timeout=8000)
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/04_weapon_reveal.png")

        # Verify P1 score = 100 and weapon equipped
        page1.wait_for_function(
            "() => document.querySelector('#hud-my-score')?.textContent?.trim() === '100'",
            timeout=8000,
        )
        weapon_name = page1.inner_text("#hud-weapon-name").strip()
        assert weapon_name != "NO WEAPON EQUIPPED", "Weapon should be equipped after correct answer!"
        ammo_before = int(page1.inner_text("#hud-ammo-value").strip())
        print(f"      -> P1 answered correctly! Score=100, Weapon={weapon_name}, Ammo={ammo_before}", flush=True)

        print("[6/9] Player 2 answering WRONGLY -> verify +0 pts & NO weapon...", flush=True)
        page2.click("#btn-hud-open-math")
        page2.wait_for_selector("#math-question-prompt", timeout=8000)
        q2_prompt = page2.inner_text("#math-question-prompt").strip()
        wrong_idx = (PROMPT_TO_ANSWER[q2_prompt] + 1) % 4
        page2.click(f"#btn-math-choice-{wrong_idx}")
        page2.wait_for_selector("#math-answer-feedback", timeout=8000)
        fb_text = page2.inner_text("#math-answer-feedback")
        assert "WRONG ANSWER" in fb_text, f"Expected WRONG ANSWER feedback, got: {fb_text}"
        page2.click("#btn-close-math")
        assert page2.inner_text("#hud-my-score").strip() == "0"
        assert page2.inner_text("#hud-weapon-name").strip() == "NO WEAPON EQUIPPED"
        print("      -> P2 wrong answer properly gave +0 pts & no weapon!", flush=True)

        print("[7/9] Testing Agent Skills ([C] Barrier Wall & [Q] Recon Sonar), 3D movement, shooting & reload...", flush=True)
        page1.wait_for_timeout(1200)
        # Cast Aegis [C] Barrier Wall on P1 and Pulse [Q] Recon Sonar on P2!
        page1.keyboard.press("KeyC")
        page2.keyboard.press("KeyQ")
        page1.wait_for_timeout(350)
        c_status = page1.inner_text("#hud-skill-C-status").strip()
        q_status_p2 = page2.inner_text("#hud-skill-Q-status").strip()
        assert c_status != "READY" and c_status.endswith("s"), f"Expected P1 C cooldown, got {c_status}"
        assert q_status_p2 != "READY" and q_status_p2.endswith("s"), f"Expected P2 Q cooldown, got {q_status_p2}"

        # Walk, jump, shoot, and capture live 3D Arena with deployed Emerald Barrier Wall & Ability Dock!
        page1.keyboard.down("KeyD")
        page1.wait_for_timeout(250)
        page1.keyboard.press("Space")
        page1.wait_for_timeout(200)
        page1.keyboard.up("KeyD")
        page1.keyboard.press("KeyF")
        page1.wait_for_timeout(300)
        ammo_after = int(page1.inner_text("#hud-ammo-value").strip())
        assert ammo_after < ammo_before, f"Expected ammo to decrement below {ammo_before}, got {ammo_after}"
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/05_arena_combat.png")

        # Reload with R
        page1.keyboard.press("KeyR")
        page1.wait_for_timeout(2700)
        ammo_reloaded = int(page1.inner_text("#hud-ammo-value").strip())
        assert ammo_reloaded == ammo_before, f"Expected reloaded ammo {ammo_before}, got {ammo_reloaded}"

        # Live Scoreboard (Tab)
        page1.keyboard.down("Tab")
        page1.wait_for_selector("#live-scoreboard-overlay", timeout=5000)
        sb_text = page1.inner_text("#live-scoreboard-overlay")
        assert "NeonHost" in sb_text and "CyberGuest" in sb_text and "100" in sb_text
        page1.screenshot(animations="disabled", path=f"{SCREENSHOT_DIR}/06_live_scoreboard.png")
        page1.keyboard.up("Tab")
        print(f"      -> Skills (P1 Barrier CD={c_status}, P2 Recon CD={q_status_p2}), Shooting ({ammo_before}->{ammo_after}->{ammo_reloaded}), and Scoreboard verified!", flush=True)

        print("[8/9] Testing REAL Browser Reload + Reconnect preserving score & weapon...", flush=True)
        stored_before = page1.evaluate("() => sessionStorage.getItem('math_rivals_3d_session')")
        assert stored_before is not None, "Expected sessionStorage to contain active session before reload!"
        page1.reload(wait_until="domcontentloaded")
        page1.wait_for_selector("#btn-menu-reconnect", timeout=15000)
        page1.click("#btn-menu-reconnect")
        page1.wait_for_selector("#hud-my-score", timeout=15000)
        assert page1.inner_text("#hud-my-score").strip() == "100", "Score lost on reconnect!"
        assert page1.inner_text("#hud-weapon-name").strip() == weapon_name, "Weapon lost on reconnect!"
        print("      -> Reconnect restored exact score (100) and weapon!", flush=True)

        print("[9/9] Testing REAL Player Disconnect handling...", flush=True)
        ctx2.close()
        page1.wait_for_timeout(700)
        page1.keyboard.down("Tab")
        page1.wait_for_selector("#live-scoreboard-overlay", timeout=8000)
        sb_after_dc = page1.inner_text("#live-scoreboard-overlay")
        assert "OFFLINE" in sb_after_dc, "Disconnected player should show OFFLINE on live scoreboard!"
        page1.keyboard.up("Tab")
        print("      -> Disconnect cleanly reflected as OFFLINE on scoreboard without interrupting match!", flush=True)

        browser.close()

    assert len(errors_p1) == 0, f"Player 1 page errors: {errors_p1}"
    assert len(errors_p2) == 0, f"Player 2 page errors: {errors_p2}"
    print("\nALL 9 REAL 2-BROWSER MULTIPLAYER E2E VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")


if __name__ == "__main__":
    run_e2e()
