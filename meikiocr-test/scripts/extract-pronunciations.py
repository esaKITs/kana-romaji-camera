"""Reproduce the small, read-only kana pronunciation index.

Run with unidic-lite==1.0.8 installed; no analyzer or dictionary download is
needed by the application. Keep only unanimous, length-preserving vowel-to-
long-mark differences. Homophones with conflicting pronunciations are omitted.
This index cannot generate a reading for kanji and is not a morphological parser.
"""
import collections
import csv
import hashlib
import json
from pathlib import Path
import re
import struct
import unidic_lite

root = Path(__file__).resolve().parent.parent
source = Path(unidic_lite.DICDIR) / 'sys.dic'
raw = source.read_bytes()
header = struct.unpack('<10I', raw[:40])
assert header[1] == 102 and len(raw) == 72 + sum(header[6:9])
variants = collections.defaultdict(set)
for record in raw[72 + header[6] + header[7]:].split(b'\0'):
    if not record:
        continue
    fields = next(csv.reader([record.decode('utf-8')]))
    if len(fields) <= 18:
        continue
    kana, pron = fields[17], fields[9]
    if len(kana) >= 2 and re.fullmatch('[ァ-ヴー]+', kana) and re.fullmatch('[ァ-ヴー]+', pron):
        variants[kana].add(pron)

def hira(text):
    return ''.join(chr(ord(c) - 96) if 'ァ' <= c <= 'ヶ' else c for c in text)

entries = {}
for kana, choices in sorted(variants.items()):
    if len(choices) != 1:
        continue
    pron = next(iter(choices))
    if kana != pron and len(kana) == len(pron) and all(a == b or b == 'ー' and a in 'アイウエオ' for a, b in zip(kana, pron)):
        entries[hira(kana)] = hira(pron)
out = root / 'data'
out.mkdir(exist_ok=True)
payload = json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + '\n'
(out / 'kana-pronunciations.json').write_text(payload, encoding='utf-8')
metadata = {'package': 'unidic-lite', 'version': '1.0.8', 'dictionarySha256': hashlib.sha256(raw).hexdigest(),
            'entries': len(entries), 'bytes': len(payload.encode()), 'sha256': hashlib.sha256(payload.encode()).hexdigest(),
            'source': 'https://github.com/polm/unidic-lite', 'license': 'public/licenses/UniDic-LICENSE.txt'}
(out / 'kana-pronunciations.meta.json').write_text(json.dumps(metadata, indent=2) + '\n')
(root / 'public/licenses/UniDic-LICENSE.txt').write_bytes((source.parent / 'BSD').read_bytes())
print(json.dumps(metadata))
