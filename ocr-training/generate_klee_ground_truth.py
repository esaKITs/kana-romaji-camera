#!/usr/bin/env python3
"""Generate reproducible Klee One kana OCR training/evaluation pairs.

Usage:
  python generate_klee_ground_truth.py --regular /path/to/KleeOne-Regular.ttf \
    --semibold /path/to/KleeOne-SemiBold.ttf --output ./ground-truth
Requires Pillow: pip install Pillow
Source fonts: https://github.com/fontworks-fonts/Klee (SIL OFL 1.1).
This script does NOT fine-tune or deploy an OCR model.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

KANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
KATA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"
MARKS = "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ"
LINES = [
    KANA, KATA, MARKS,
    "きゃきゅきょしゃしゅしょちゃちゅちょにゃにゅにょ",
    "キャキュキョシャシュショチャチュチョニャニュニョ",
    "がっこう きって ちょっと りょこう きょうしつ",
    "こんにちは ありがとうございます よろしくおねがいします",
    "コーヒー スーパー パーティー コンピューター",
    "禁じられています あなたの健康 お子様が含まれています",
    "ひらがな カタカナ ふりがな",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--regular", required=True, type=Path)
    ap.add_argument("--semibold", required=True, type=Path)
    ap.add_argument("--output", default=Path("ground-truth"), type=Path)
    args = ap.parse_args()
    for p in (args.regular, args.semibold):
        if not p.is_file(): ap.error(f"Font not found: {p}")
    args.output.mkdir(parents=True, exist_ok=True)
    count = 0
    for style, path in (("regular", args.regular), ("semibold", args.semibold)):
        for size in (14, 20, 28, 40):
            font = ImageFont.truetype(str(path), size)
            for index, line in enumerate(LINES):
                # Ground truth includes kanji only as background/context, never as a romaji target.
                bbox = font.getbbox(line)
                width = max(120, bbox[2] - bbox[0] + 32)
                height = max(40, bbox[3] - bbox[1] + 24)
                im = Image.new("RGB", (width, height), "white")
                draw = ImageDraw.Draw(im)
                draw.text((16 - bbox[0], 12 - bbox[1]), line, font=font, fill="black")
                stem = f"klee_{style}_{size}_{index:02d}"
                im.save(args.output / f"{stem}.png")
                (args.output / f"{stem}.gt.txt").write_text(line, encoding="utf-8")
                count += 1
    print(f"Created {count} image/ground-truth pairs in {args.output}")

if __name__ == "__main__":
    main()
