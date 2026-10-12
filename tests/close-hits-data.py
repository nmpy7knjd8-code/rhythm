import json,glob
from fractions import Fraction as F
# Flags any voice with two hits closer than 20 ms, including sub-step hits. Flam/drag graces are spaced 20-28 ms by the engine.
bad={};tot=0
for f in sorted(glob.glob('/workspace/rhythm/public/songs/*.json')):
    d=json.load(open(f)); k=d['id']; t=0.0; last={}
    for s in d['sections']:
        for i,b in enumerate(s['bars']):
            stepSec=s['ticksPerStep'][i]*60/s['bpm'][i]/12
            rows={v:x for v,x in b.items() if not v.startswith('_')}; n=len(next(iter(rows.values())))
            ev=[(t+st*stepSec,v) for v,x in rows.items() for st,c in enumerate(x) if c!='.']
            ev+=[(t+(int(st)+float(F(fr)))*stepSec,v) for v,m in b.get('_sub',{}).items() for st,l in m.items() for fr,_ in l]
            for tt,v in sorted(ev):
                tot+=1
                if v in last and tt-last[v]<0.02: bad.setdefault(k,[]).append((s['name'],i,v,'%.1fms'%((tt-last[v])*1000)))
                last[v]=tt
            t+=n*stepSec
print('hits checked',tot,'| under 20 ms:',{k:(len(v),v[:3]) for k,v in bad.items()} or 'none')
