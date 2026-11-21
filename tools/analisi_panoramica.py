import json, sys, statistics as st
from collections import defaultdict, Counter

d = json.load(open(sys.argv[1], encoding='utf-8'))
S = {s['id']: s for s in d['sessions']}
qs = d['qs']
print('sessions', len(d['sessions']), 'real (not imported)', sum(1 for s in d['sessions'] if not s.get('src')), 'questions', len(qs))
print(Counter(S[q['s']]['name'] for q in qs if q['s'] in S))
print('dates', sorted(Counter(S[q['s']]['t'][:10] for q in qs if q['s'] in S).items()))

def med(a): return st.median(a) if a else float('nan')
def show(title, key, minn=8):
    g = defaultdict(list)
    for q in qs:
        k = key(q)
        if k is not None: g[k].append(q)
    rows = sorted(((k, len(v), med([x['ms'] for x in v]) / 1000, sum(x.get('slip', False) for x in v) / len(v)) for k, v in g.items() if len(v) >= minn), key=lambda r: -r[2])
    print('\n==', title)
    for k, n, m, sl in rows: print(f'  {str(k):28s} n={n:4d}  med={m:5.2f}s  slip={sl:4.0%}')

ops = lambda q: q['op']
show('per operazione', ops)
show('per op + cifre risultato', lambda q: (q['op'], q.get('al')))

def fx(q):
    x, y = float(q['x']), float(q['y'])
    return x, y
# multiplication: by small factor, and by "other" operand features
def mul_f(q):
    if q['op'] not in '×÷': return None
    x, y = fx(q)
    f = x if q['op'] == '×' else y
    return (q['op'], int(f))
show('× e ÷ per fattore', mul_f)
def mul_shape(q):
    if q['op'] != '×': return None
    x, y = fx(q)
    m = y
    if m != int(m): return ('×', 'decimale')
    m = int(m)
    return ('×', 'm<=12' if m <= 12 else 'm 13-19' if m < 20 else 'm decina tonda' if m % 10 == 0 else 'm 2 cifre, unità ' + ('≤5' if m % 10 <= 5 else '>5'))
show('× per forma del secondo fattore', mul_shape)
def mul_carry(q):
    if q['op'] != '×': return None
    x, y = fx(q)
    if y != int(y) or y < 13: return None
    f, m = int(x), int(y)
    # carry from units product into tens: f*(m%10) >= 10
    return ('×', 'riporto unità→decine' if f * (m % 10) >= 10 else 'senza riporto', 'risultato ' + str(len(str(f * m))) + ' cifre')
show('× 1×2 cifre: riporto', mul_carry)
def div_shape(q):
    if q['op'] != '÷': return None
    x, y = fx(q)
    a = x / y
    if a != int(a): return ('÷', 'decimale')
    return ('÷', 'quoziente ≤12' if a <= 12 else 'quoziente 13-100')
show('÷ per quoziente', div_shape)
def add_c(q):
    if q['op'] not in '+-': return None
    t = [t for t in q.get('tags', []) if t[1:2] in 'cb' and len(t) == 3]
    return (q['op'], t[0] if t else '?', 'cifre ' + str(q.get('al')))
show('+ − per riporti/prestiti e cifre', add_c)

# per question "fact" for × tables: slowest individual facts
def fact(q):
    if q['op'] != '×': return None
    x, y = fx(q)
    if y != int(y) or y > 12: return None
    return f'{int(min(x,y))}×{int(max(x,y))}'
show('tabelline: singoli fatti (≥3)', fact, 3)

# skips
print('\nskipped', sum(1 for q in qs if q.get('skip')), [ (q['x'], q['op'], q['y']) for q in qs if q.get('skip')][:30])
# test sessions
for s in d['sessions']:
    if s.get('key') == '"test"': print('test', s['t'], s['score'])
# learning curve: median ms per day per op
g = defaultdict(list)
for q in qs:
    if q['s'] in S: g[(S[q['s']]['t'][:10], q['op'])].append(q['ms'])
print('\nper giorno/op'); [print(' ', k, len(v), round(med(v)/1000, 2)) for k, v in sorted(g.items())]
