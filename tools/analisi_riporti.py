import json, sys, statistics as st
from collections import defaultdict
d = json.load(open(sys.argv[1], encoding='utf-8'))
qs = d['qs']
med = lambda a: round(st.median(a) / 1000, 2) if a else None
def grp(rows, key, minn=6, title=''):
    g = defaultdict(list)
    for q in rows:
        k = key(q)
        if k is not None: g[k].append(q['ms'])
    print('\n==', title)
    for k, v in sorted(g.items(), key=lambda kv: -st.median(kv[1])):
        if len(v) >= minn: print(f'  {str(k):40s} n={len(v):3d} med={med(v)}')

# 1-digit x 2-digit (both × and its inverse ÷), integers only
M = []
for q in qs:
    if q['op'] not in '×÷' or '.' in q['x'] + q['y']: continue
    x, y = int(q['x']), int(q['y'])
    f, m = (x, y) if q['op'] == '×' else (y, x // y)
    if 13 <= m <= 100 and f <= 12: M.append(dict(q, f=f, m=m))
print('1x2 cifre', len(M))
carry = lambda q: q['f'] * (q['m'] % 10) // 10
grp(M, lambda q: (q['op'], 'riporto ' + str(carry(q))), title='riporto unità→decine (cifra riportata)')
grp(M, lambda q: (q['op'], 'f ' + ('2-5' if q['f'] <= 5 else '6-9' if q['f'] <= 9 else '10-12')), title='per fattore piccolo')
grp(M, lambda q: (q['op'], 'unità m ' + str(q['m'] % 10)), title='per cifra delle unità di m')
grp(M, lambda q: (q['op'], 'decine m ' + str(q['m'] // 10)), title='per decina di m')
grp(M, lambda q: (q['op'], 'prodotto ' + ('<100' if q['f'] * q['m'] < 100 else '100-499' if q['f'] * q['m'] < 500 else '500+')), title='grandezza del prodotto')
# simple additive model: time ~ op + f band + carry + product size (least squares on log ms)
import math
feats = lambda q: [1, q['op'] == '÷', q['f'] >= 6, carry(q) >= 1, carry(q) >= 4, q['f'] * q['m'] >= 500, q['m'] % 10 == 0]
names = ['base', 'divisione', 'fattore>=6', 'riporto>=1', 'riporto>=4', 'prodotto>=500', 'm decina tonda']
X = [feats(q) for q in M]; Y = [math.log(q['ms']) for q in M]
k = len(names)
A = [[sum(float(X[r][i]) * float(X[r][j]) for r in range(len(X))) for j in range(k)] for i in range(k)]
b = [sum(float(X[r][i]) * Y[r] for r in range(len(X))) for i in range(k)]
# gaussian elimination
for i in range(k):
    p = max(range(i, k), key=lambda r: abs(A[r][i])); A[i], A[p] = A[p], A[i]; b[i], b[p] = b[p], b[i]
    for r in range(k):
        if r != i:
            c = A[r][i] / A[i][i]; A[r] = [A[r][j] - c * A[i][j] for j in range(k)]; b[r] -= c * b[i]
w = [b[i] / A[i][i] for i in range(k)]
print('\n== modello (moltiplicatore sul tempo)')
for n_, wi in zip(names, w): print(f'  {n_:16s} x{math.exp(wi):.2f}' + (f'  (base {math.exp(wi):.2f}s/1000)' if n_ == 'base' else ''))

# +/- : 2-digit and 3-digit
P = []
for q in qs:
    if q['op'] not in '+-' or '.' in q['x'] + q['y']: continue
    x, y = int(q['x']), int(q['y'])
    a, b2 = (x, y) if q['op'] == '+' else (y, x - y)
    P.append(dict(q, big=max(a, b2) > 100))
grp(P, lambda q: (q['op'], 'tre cifre' if q['big'] else 'due cifre', [t for t in q['tags'] if len(t) == 3 and t[1] in 'cb'][0]), 4, title='+ − per grandezza e riporti')
for q in P:
    if q['op'] == '-' and q['big']: print('   lento?', q['x'], '-', q['y'], round(q['ms'] / 1000, 1))
dec = [q for q in qs if '.' in q['x'] + q['y']]
grp(dec, lambda q: q['op'], 2, title='decimali')
