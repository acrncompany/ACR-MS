"""Regenerates src/fonts/material-symbols-rounded-subset.woff2 with only the icons the app uses.

The generated font is committed, so normal builds do not need Python. Re-run only after adding a
new icon:  npm run icons   (requires: pip install fonttools brotli)

Icon names are collected from src/**/*.{ts,html} (<mat-icon>name</mat-icon>, `icon: 'name'`,
[icon]/ternaries) plus scripts/icons-extra.txt for names built dynamically.
"""

import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules" / "material-symbols" / "material-symbols-rounded.woff2"
TARGET = ROOT / "src" / "fonts" / "material-symbols-rounded-subset.woff2"
EXTRA = ROOT / "scripts" / "icons-extra.txt"

NAME = r"[a-z][a-z0-9_]*"
# Words that appear next to icons in templates but are not icon names.
IGNORED = {"dark", "light"}


def collect_names() -> set[str]:
    names: set[str] = set()
    for path in (ROOT / "src").rglob("*"):
        if path.suffix not in {".ts", ".html"}:
            continue
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"<mat-icon[^>]*>\s*([^<{]*?)\s*</mat-icon>", text):
            if re.fullmatch(NAME, match.group(1)):
                names.add(match.group(1))
        # string literals assigned to icon-ish properties / ternaries inside mat-icon
        for match in re.finditer(r"icon\s*[:=]\s*'(" + NAME + ")'", text):
            names.add(match.group(1))
        for match in re.finditer(r"<mat-icon[^>]*>\{\{([^}]*)\}\}</mat-icon>", text):
            names.update(re.findall(r"'(" + NAME + ")'", match.group(1)))
    names -= IGNORED
    if EXTRA.exists():
        names.update(n.strip() for n in EXTRA.read_text().split() if n.strip())
    return names


def main() -> int:
    names = collect_names()
    print(f"{len(names)} icons: {' '.join(sorted(names))}")

    font = TTFont(SOURCE)
    # Pin the variable axes: filled=0, weight 400, grade 0, optical size 24.
    font = instancer.instantiateVariableFont(font, {"FILL": 0, "wght": 400, "GRAD": 0, "opsz": 24})

    cmap = font.getBestCmap()
    letter_glyphs = {cmap[ord(c)] for c in "abcdefghijklmnopqrstuvwxyz0123456789_" if ord(c) in cmap}

    # Find the ligature glyph for each icon name by walking the GSUB 'liga' lookups.
    glyph_for_char = {g: c for c, g in cmap.items()}
    wanted: dict[tuple[str, ...], str] = {}
    for name in names:
        seq = tuple(cmap[ord(c)] for c in name)
        wanted[seq] = name
    found: set[str] = set()
    gsub = font["GSUB"].table
    for lookup in gsub.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            ligatures = getattr(sub, "ligatures", None)
            if not ligatures:
                continue
            for first, ligs in ligatures.items():
                for lig in ligs:
                    seq = (first, *lig.Component)
                    if seq in wanted:
                        found.add(wanted[seq])
    missing = names - found
    if missing:
        print("WARNING: no ligature found for:", ", ".join(sorted(missing)), file=sys.stderr)

    # Keep the ligature output glyphs for the wanted names only.
    out_glyphs: set[str] = set()
    for lookup in gsub.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            for first, ligs in (getattr(sub, "ligatures", None) or {}).items():
                for lig in ligs:
                    if (first, *lig.Component) in wanted:
                        out_glyphs.add(lig.LigGlyph)

    options = subset.Options()
    options.layout_features = ["rlig", "rclt", "liga"]
    options.layout_closure = False
    options.glyph_names = False
    options.notdef_outline = True
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(glyphs=sorted(out_glyphs | letter_glyphs))
    subsetter.subset(font)
    font.flavor = "woff2"
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    font.save(TARGET)
    print(f"wrote {TARGET.relative_to(ROOT)} ({TARGET.stat().st_size // 1024} KB)")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
