"""Independent timing audit: recompute every drum onset from the source Songsterr tab and diff against the app's part files.
Positions are exact Fractions of a whole note; seconds use the tab's tempo map. Reports per song:
 onset mismatches > 1 ms (missing / extra / shifted), bar-length errors vs the meter, and source ambiguities
 (voices whose durations don't fill the bar, mid-bar tempo changes)."""
import json,re,sys,os
from fractions import Fraction as Fr
sys.path.insert(0,'/workspace/research')
import ssconv
from ssconv import GM,expand
VAR=getattr(ssconv,'VAR',{})
ssconv.GM[84]='rideBell'; ssconv.GM[95]='crash1'; VAR[95]=('crash1','splash')
R='/workspace/research'; APP=os.environ.get('APP','/workspace/rhythm/public/songs')
def sources():
    idx=json.load(open(f'{R}/songsterr/index.json')); out={}
    for k,v in idx.items():
        if isinstance(v,list) and os.path.exists(f'{R}/songsterr/{k}.json'): out[k]=f'{R}/songsterr/{k}.json'
    for m in re.finditer(r"^\('(\w+)','(\w+)'",open(f'{R}/more.py').read(),re.M): out[m.group(1)]=f'{R}/ss2/{m.group(2)}.json'
    return out
def row(fret):
    if fret in VAR: return VAR[fret][0]
    return GM.get(fret)
def qbpm(t): ty=t.get('type',4); b=Fr(t['bpm'])*(Fr(3,2) if t.get('dotted') else 1); return b*4/ty if ty else b
def src_bars(path):
    p=json.load(open(path))['part']; ms=p['measures']
    sig=(4,4); sigs=[]; feel=None; feels=[]
    for m in ms:
        if m.get('signature'): sig=tuple(m['signature'])
        if 'tripletFeel' in m: feel=m['tripletFeel'] if m['tripletFeel'] not in ('none','off',False,None) else None
        sigs.append(sig); feels.append(feel)
    tm=sorted(p.get('automations',{}).get('tempo',[{'bpm':100,'type':4}]),key=lambda t:(t.get('measure',0),t.get('position',0)))
    midbar=sum(1 for t in tm if t.get('position',0))
    bars=[]; amb=[]
    for idx in expand(ms):
        m=ms[idx]; num,den=sigs[idx]; L=Fr(num,den)
        cur=tm[0]
        for t in tm:
            if t.get('measure',0)<idx or (t.get('measure',0)==idx and not t.get('position',0)): cur=t
        mids=[(Fr(t['position']).limit_denominator(192)*L,qbpm(t)) for t in tm if t.get('measure',0)==idx and t.get('position',0)]
        on=[]
        for vi,v in enumerate(m.get('voices',[])):
            pos=Fr(0)
            for b in v.get('beats',[]):
                d=Fr(*b['duration'])
                if b.get('graceNote') or b.get('grace'): continue
                if not b.get('rest'):
                    for nt in b.get('notes',[]):
                        if nt.get('tie') or nt.get('rest'): continue
                        r=row(nt.get('fret'))
                        if r: on.append((pos,r))
                pos+=d
            if pos!=L and any(not b.get('rest') for b in v.get('beats',[])): amb.append((len(bars),vi,str(pos),str(L)))
        f=feels[idx]
        if f in ('16th','8th'):
            u=Fr(1,8) if f=='16th' else Fr(1,4)
            on=[(q-(q%u)+u*Fr(2,3) if q%u==u/2 else q,r) for q,r in on]
        on=[(q,r) for q,r in on if q<L]
        bars.append(dict(L=L,bpm=qbpm(cur),mids=mids,on=sorted(set(on))))
    return bars,amb,midbar
def app_bars(k):
    d=json.load(open(f'{APP}/{k}.json')); out=[]
    for s in d['sections']:
        for i,b in enumerate(s['bars']):
            tps=s['ticksPerStep'][i]; bpm=s['bpm'][i]; num,den=map(int,s['timeSig'][i].split('/'))
            rows={v:x for v,x in b.items() if not v.startswith('_')}; n=len(next(iter(rows.values())))
            step=Fr(tps,48)  # step length in whole notes
            on=[(st*step,v) for v,x in rows.items() for st,c in enumerate(x) if c!='.']
            on+=[((int(st)+Fr(fr).limit_denominator(48))*step,v) for v,m in b.get('_sub',{}).items() for st,l in m.items() for fr,_ in l]
            mids=[(Fr(f)*n*step,Fr(b2).limit_denominator(1000)) for f,b2 in b.get('_tempo',[])]
            out.append(dict(len=n*step,meter=Fr(num,den),bpm=bpm,mids=mids,on=sorted(set(on))))
    return out
def audit(k,path):
    sb,amb,midbar=src_bars(path); ab=app_bars(k)
    res=dict(bars_src=len(sb),bars_app=len(ab),mismatch=0,barlen=0,tempo=0,ambiguous=len(amb),midbar_tempo=midbar,examples=[])
    for i,(s,a) in enumerate(zip(sb,ab)):
        def sec(w,bpm,mids):
            # piecewise: whole-note position -> seconds with tempo changes inside the bar
            t=0.0; at=Fr(0); cur=bpm
            for q,b2 in mids:
                if w<=q: break
                t+=float(q-at)*240/float(cur); at=q; cur=b2
            return t+float(w-at)*240/float(cur)
        if a['len']!=s['L'] or a['meter']!=s['L']: res['barlen']+=1; res['examples'].append(('barlen',i,str(a['len']),str(s['L']))) if len(res['examples'])<6 else None
        if abs(float(a['bpm'])-float(s['bpm']))>0.01: res['tempo']+=1
        S={}; A={}
        for q,r in s['on']: S.setdefault(r,[]).append(sec(q,s['bpm'],s['mids']))
        for q,r in a['on']: A.setdefault(r,[]).append(sec(q,a['bpm'],a['mids']))
        for r in set(S)|set(A):
            x=sorted(S.get(r,[])); y=sorted(A.get(r,[]))
            used=[False]*len(y)
            for t in x:
                j=min((j for j in range(len(y)) if not used[j]),key=lambda j:abs(y[j]-t),default=None)
                if j is None or abs(y[j]-t)>0.001:
                    res['mismatch']+=1
                    if len(res['examples'])<6: res['examples'].append(('onset',i,r,round(t*1000,2),None if j is None else round(y[j]*1000,2)))
                else: used[j]=True
            res['mismatch']+=used.count(False)
    if len(sb)!=len(ab): res['mismatch']+=abs(len(sb)-len(ab))*999
    return res
if __name__=='__main__':
    src=sources(); tot=dict(mismatch=0,barlen=0,tempo=0); rows=[]
    for k in sorted(src):
        if not os.path.exists(f'{APP}/{k}.json'): continue
        r=audit(k,src[k]); rows.append((k,r))
        for x in tot: tot[x]+=r[x]
    for k,r in rows:
        if True or r['mismatch'] or r['barlen'] or r['tempo'] or r['ambiguous'] or r['midbar_tempo']:
            print(f"{k:16} onsets≠{r['mismatch']:5} barlen≠{r['barlen']:4} tempo≠{r['tempo']:3} ambiguous-voices={r['ambiguous']:3} midbar-tempo={r['midbar_tempo']} {r['examples'][:3]}")
    print('SONGS',len(rows),'TOTAL',tot)
