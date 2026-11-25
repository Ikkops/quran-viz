"""Screenshots for the docs site (docs/public/shots/*.png), taken from a
running dev server with example data, so they can be refreshed after a UI
change:

    npm run dev                       # note the port
    uv run --with playwright python scripts/docs_screenshots.py http://localhost:5173

Uses the installed Google Chrome (no browser download). The example data is
written into that browser profile only; nothing of the learner's is read.
Convert to WebP afterwards (cwebp) to keep the site small.
"""

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "docs" / "public" / "shots"
PHONE = {"width": 390, "height": 844}
DESKTOP = {"width": 1280, "height": 800}


def example_storage() -> dict[str, object]:
    status = ["0"] * 6236

    def mark(a: int, b: int, v: str) -> None:
        for i in range(a, b + 1):
            status[i - 1] = v

    mark(1, 7, "2")  # al-Fatihah
    mark(8, 47, "2")  # al-Baqarah 1-40
    mark(38, 47, "3")
    mark(2141, 2150, "1")  # al-Kahf 1-10, being memorised
    mark(5673, 6236, "2")  # juz 30
    mark(5700, 5712, "3")
    now = int(time.time() * 1000)
    day = 86_400_000
    log = [[1 + i % 20, 1 if i % 9 == 0 else 3, now - i * day // 2] for i in range(40)]
    reading = {
        time.strftime("%Y-%m-%d", time.localtime((now - d * day) / 1000)): 600 + 120 * (d % 4)
        for d in range(0, 20)
    }
    return {
        "qv.welcome": True,
        "qv.lang": "en",
        "qv.hifdh": {"status": "".join(status), "stumbles": {}, "reviews": {}},
        "qv.hifdh.log": log,
        "qv.reading.log": reading,
        "qv.lastRead.list": [
            {"id": 3730, "s": 36, "at": now - 3_600_000},
            {"id": 2160, "s": 18, "at": now - day},
            {"id": 262, "s": 2, "at": now - 3 * day},
        ],
        "qv.activity.tab": "hifdh",
    }


def shoot(page, url: str, name: str, scroll_to: str | None = None, wait: float = 2.5) -> None:
    page.goto(url)
    page.wait_for_timeout(int(wait * 1000))
    if scroll_to:
        page.evaluate(
            """(text) => {
              const h = [...document.querySelectorAll('h2, h3')].find((e) => e.textContent.includes(text));
              if (h) window.scrollBy(0, h.getBoundingClientRect().top - 72);
            }""",
            scroll_to,
        )
        page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"wrote docs/public/shots/{name}.png")


def main() -> None:
    base = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:5173"
    OUT.mkdir(parents=True, exist_ok=True)
    seed = "".join(
        f"localStorage.setItem({json.dumps(k)}, {json.dumps(json.dumps(v))});"
        for k, v in example_storage().items()
    )
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for viewport, scale, shots in (
            (
                PHONE,
                2,
                [
                    ("/#home", "home", None),
                    ("/#home/r/surah/36", "reader", None),
                    ("/#activity", "memorisation", "Progress"),
                    ("/#settings", "sync", "Sync between devices"),
                ],
            ),
            (DESKTOP, 1, [("/#dashboard", "dashboard", None)]),
        ):
            ctx = browser.new_context(viewport=viewport, device_scale_factor=scale)
            ctx.add_init_script(f"if (!sessionStorage.getItem('seeded')) {{ {seed} sessionStorage.setItem('seeded', '1'); }}")
            page = ctx.new_page()
            for path, name, scroll in shots:
                shoot(page, base + path, name, scroll)
            ctx.close()
        # The printed mushaf page, in its own context so the layout choice
        # doesn't leak into the other shots.
        ctx = browser.new_context(viewport=PHONE, device_scale_factor=2)
        ctx.add_init_script(
            f"if (!sessionStorage.getItem('seeded')) {{ {seed} "
            "localStorage.setItem('qv.reader.mode', JSON.stringify('mushaf')); "
            "sessionStorage.setItem('seeded', '1'); }"
        )
        shoot(ctx.new_page(), base + "/#home/r/surah/1", "mushaf", None, wait=4)
        browser.close()


if __name__ == "__main__":
    main()
