"""Validate seed data files: counts, schema shape, duplicates, cross-references.
Run: py validate_data.py
"""
import json, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DATA = Path(__file__).parent / 'data'
problems = []
info = []

def load(name):
    p = DATA / name
    if not p.exists():
        problems.append(f'{name}: MISSING')
        return None
    try:
        return json.loads(p.read_text(encoding='utf-8-sig'))
    except Exception as e:
        problems.append(f'{name}: JSON error: {e}')
        return None

# --- vocab ---
vocab = []
for f in ['vocab1.json', 'vocab2.json', 'vocab3.json']:
    v = load(f)
    if v is not None:
        info.append(f'{f}: {len(v)} items')
        vocab += v

if vocab:
    ids = [v['id'] for v in vocab]
    if len(ids) != len(set(ids)):
        problems.append('vocab: duplicate ids')
    kas = {}
    for v in vocab:
        kas.setdefault(v['ka'].strip(), []).append(v['id'])
    dupes = {k: xs for k, xs in kas.items() if len(xs) > 1}
    if dupes:
        info.append(f'vocab: {len(dupes)} duplicate headwords (app dedupes, keeps lowest rank): ' +
                    ', '.join(f"{k}({'/'.join(x)})" for k, x in list(dupes.items())[:15]))
    for v in vocab:
        if len(v.get('sentences', [])) < 2:
            problems.append(f"vocab {v['id']} ({v['ka']}): fewer than 2 sentences")
        for k in ['id', 'rank', 'ka', 'en', 'pos', 'week', 'tags']:
            if k not in v:
                problems.append(f"vocab {v.get('id','?')}: missing {k}")
    flagged = sum(1 for v in vocab if v.get('verify'))
    info.append(f'vocab total: {len(vocab)} (unique ka: {len(kas)}), verify-flagged: {flagged}')

# --- dialogues ---
dialogues = []
for f in ['dialogues1.json', 'dialogues2.json']:
    d = load(f)
    if d is not None:
        info.append(f'{f}: {len(d)} dialogues')
        dialogues += d
for d in dialogues:
    for k in ['id', 'week', 'scene', 'title_ka', 'title_en', 'grammar', 'lines']:
        if k not in d:
            problems.append(f"dialogue {d.get('id','?')}: missing {k}")
    if len(d.get('lines', [])) < 4:
        problems.append(f"dialogue {d.get('id','?')}: only {len(d.get('lines', []))} lines")

# --- verbs ---
verbs = []
for f in ['verbs1.json', 'verbs2.json']:
    v = load(f)
    if v is not None:
        info.append(f'{f}: {len(v)} verbs')
        verbs += v
for v in verbs:
    scr = v.get('screeves', {})
    for name, forms in scr.items():
        if forms is not None and len(forms) != 6:
            problems.append(f"verb {v.get('id','?')} ({v.get('masdar','?')}): screeve {name} has {len(forms)} forms")
    if not any(scr.get(s) for s in scr):
        problems.append(f"verb {v.get('id','?')}: all screeves null")
flagged = sum(1 for v in verbs if v.get('verify'))
info.append(f'verbs total: {len(verbs)}, entries with verify flags: {flagged}')

# --- grammar ---
g = load('grammar.json')
if g is not None:
    info.append(f'grammar.json: {len(g)} lessons')
    for les in g:
        items = (les.get('drill') or {}).get('items', [])
        if len(items) < 4:
            problems.append(f"grammar {les.get('id','?')}: only {len(items)} drill items")
        for it in items:
            if it['answer'] not in it['choices']:
                problems.append(f"grammar {les.get('id','?')}: answer '{it['answer']}' not in choices")
            if '___' not in it.get('prompt', ''):
                problems.append(f"grammar {les.get('id','?')}: prompt missing ___ blank: {it.get('prompt','')[:40]}")

# --- others ---
for f, expect in [('curriculum.json', 30), ('speaker_tasks.json', 30), ('register.json', 25), ('pronunciation.json', None)]:
    d = load(f)
    if d is not None:
        n = len(d) if isinstance(d, list) else len(d.get('contrasts', [])) + len(d.get('ladders', []))
        info.append(f'{f}: {n} entries')

st = load('speaker_tasks.json')
if st:
    for t in st:
        if len(t.get('phrases', [])) != 3 or len(t.get('theyMayAsk', [])) != 2:
            problems.append(f"speaker task {t.get('id','?')}: wrong phrase counts")

print('--- INFO ---')
for i in info: print(' ', i)
print('--- PROBLEMS ---' if problems else '--- NO PROBLEMS ---')
for p in problems: print(' !', p)
sys.exit(1 if problems else 0)
