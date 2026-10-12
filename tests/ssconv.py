import json,sys,math
from fractions import Fraction as Fr
GM={91:'snare',92:'openHat',93:'ride',94:'china',96:'crash2',97:'crash2',98:'crash2',65:'tomHi',66:'tomMid',67:'cowbell',68:'cowbell',81:'rideBell',83:'shaker',85:'shaker',86:'tomFloor',87:'tomFloor',78:'crossStick',126:'crash1',35:'kick',36:'kick',38:'snare',40:'snare',39:'snare',37:'crossStick',42:'closedHat',44:'pedalHat',46:'openHat',49:'crash1',57:'crash2',55:'crash2',52:'china',51:'ride',59:'ride',53:'rideBell',41:'tomFloor',43:'tomFloor',45:'tomMid',47:'tomMid',48:'tomHi',50:'tomHi',56:'cowbell',54:'shaker',70:'shaker',69:'shaker',82:'shaker',75:'crossStick',76:'crossStick',77:'crossStick',62:'tomHi',63:'tomMid',64:'tomFloor',60:'tomHi',61:'tomMid',31:'crossStick',33:'crossStick',34:'rideBell',58:'crossStick',22:'closedHat',26:'openHat',21:'closedHat',23:'openHat',24:'openHat',25:'openHat',27:'pedalHat',28:'crash1',29:'crash1',30:'china'}
DYN={'ppp':0.2,'pp':0.3,'p':0.45,'mp':0.6,'mf':0.75,'f':0.85,'ff':0.95,'fff':1.0}
def expand(ms):
    order=[];i=0;start=0;passes={};n=len(ms)
    guard=0
    while i<n and guard<5000:
        guard+=1;m=ms[i]
        if m.get('repeatStart'): start=i
        ae=m.get('alternateEnding')
        p=passes.get(start,1)
        if ae and p not in ae: i+=1; continue
        order.append(i)
        rc=m.get('repeat')
        if rc:
            if passes.get(start,1)<rc: passes[start]=passes.get(start,1)+1; i=start; continue
            else: passes[start]=1
        i+=1
    return order
# GM note -> (row voice override, variant id); the row keeps the grid compact, the variant keeps the real instrument/pitch
VAR={55:('crash1','splash'),59:('ride','ride2'),67:('cowbell','agogoHi'),68:('cowbell','agogoLo'),48:('tomHi','tomHi2'),45:('tomMid','tomMid2'),41:('tomFloor','tomFloor2'),
     30:('china','chinaSmall'),94:('china','chinaSmall'),34:('rideBell','bellBig'),81:('rideBell','bellBig'),96:('crash1','splash'),28:('crash1','crash16')}
def bar_events(m,sig):
    num,den=sig; barLen=Fr(num,den)  # in whole notes
    ev=[];unknown=set()
    for v in m.get('voices',[]):
        pos=Fr(0); pend_grace=False
        for b in v.get('beats',[]):
            d=Fr(*b['duration'])
            # Songsterr 'duration' is already the sounding length (dots and tuplets applied), e.g. a 16th triplet is [1,24].
            if b.get('graceNote') or b.get('grace'):
                pend_grace={GM.get(nt.get('fret')) for nt in b.get('notes',[])}; continue
            vel=DYN.get(b.get('velocity','mf'),0.75)
            if not b.get('rest'):
                for nt in b.get('notes',[]):
                    if nt.get('tie') or nt.get('rest'): continue
                    vo=GM.get(nt.get('fret'))
                    if not vo: unknown.add(nt.get('fret')); continue
                    vv=vel
                    if nt.get('ghost'): vv=0.3
                    if nt.get('accentuated') or nt.get('accent'): vv=1.0 if nt.get('accentuated')!=1 else 0.95
                    fr=nt.get('fret'); va=None
                    if fr in VAR: vo,va=VAR[fr]
                    ev.append((pos,vo,vv,'f' if pend_grace and vo in pend_grace else '',va))
            pend_grace=False
            pos+=d
    return barLen,ev,unknown
def grid(barLen,ev):
    """Pick a base grid (16ths, 8th-triplets or 16th-triplets) that fits most onsets.
    Onsets between grid steps (32nds, sextuplets, quintuplets, rolls) become sub-hits:
    _sub[voice][step] = [[fraction_of_step, velocity], ...], scheduled at their exact time."""
    best=None;bestScore=-1
    for tps in (3,4,2):
        step=Fr(tps,48); sc=sum(1 for p,*_ in ev if (p/step).denominator==1)
        if sc>bestScore or (sc==bestScore and best is None): best,bestScore=tps,sc
    step=Fr(best,48); steps=int(barLen/step)
    tr={};sub={}
    var={}
    for p,vo,vv,fl,va in ev:
        q=p/step; i=int(q); frac=q-i
        if i>=steps: continue
        a=tr.setdefault(vo,['.']*steps)
        c='f' if fl else str(max(1,min(9,round(vv*9))))
        if frac==0:
            if a[i]=='.' or c=='f' or c>a[i]:
                a[i]=c
                if va: var.setdefault(vo,{})[str(i)]=va
                else: var.get(vo,{}).pop(str(i),None)
        else:
            l=sub.setdefault(vo,{}).setdefault(str(i),[]); fr=f'{frac.numerator}/{frac.denominator}'  # exact rational offset within the step
            same=[x for x in l if x[0]==fr]  # two notes on one row at one instant (e.g. both mid toms) = one stroke
            if same: same[0][1]=max(same[0][1],round(vv,2))
            else: l.append([fr,round(vv,2)])
    if not tr: tr={'kick':['.']*steps}
    out={k:''.join(v) for k,v in tr.items()}
    if sub: out['_sub']=sub
    var={k:v for k,v in var.items() if v}
    if var: out['_var']=var
    return best,steps,out
def convert(path):
    d=json.load(open(path)); p=d['part']; ms=p['measures']
    sig=(4,4); sigs=[]; feel=None; feels=[]
    for m in ms:
        if m.get('signature'): sig=tuple(m['signature'])
        if 'tripletFeel' in m: feel=m['tripletFeel'] if m['tripletFeel'] not in ('none','off',False,None) else None
        sigs.append(sig); feels.append(feel)
    order=expand(ms)
    tempo=p.get('automations',{}).get('tempo',[{'bpm':100,'type':4}])
    t0=tempo[0]; bpm=t0['bpm']*(4/t0.get('type',4)) if t0.get('type',4)!=4 else t0['bpm']
    if t0.get('type')==8: bpm=t0['bpm']/2
    if t0.get('type')==2: bpm=t0['bpm']*2
    def qbpm(t):
        b=t['bpm']*(1.5 if t.get('dotted') else 1); ty=t.get('type',4)  # a dotted beat unit (e.g. dotted quarter in 12/8) is 1.5 of that note
        return b*4/ty if ty else b
    tm=sorted(tempo,key=lambda t:(t.get('measure',0),t.get('position',0)))
    def bpmAt(idx):
        cur=tm[0]
        for t in tm:
            if t.get('measure',0)<idx or (t.get('measure',0)==idx and not t.get('position',0)): cur=t
        return round(qbpm(cur),2)
    secs=[];cur=None;unk=set();marker='Intro'
    for idx in order:
        m=ms[idx]
        mk=(m.get('marker') or {}).get('text')
        if mk: marker=mk
        if cur is None or mk:
            cur={'name':marker,'bars':[],'ticksPerStep':[],'timeSig':[],'bpm':[]}; secs.append(cur)
        bl,ev,u=bar_events(m,sigs[idx]); unk|=u
        # Songsterr 'tripletFeel' (shuffle): notated straight pairs play as triplet long-short.
        # The off-beat of each pair moves from 1/2 to 2/3 of the pair; real tuplets are left alone.
        f=feels[idx]
        if f in ('16th','8th'):
            u_=Fr(1,8) if f=='16th' else Fr(1,4)
            tr_feel=f
            ev=[(p-(p%u_)+u_*Fr(2,3) if p%u_==u_/2 else p,)+tuple(r) for p,*r in ev]
        tps,steps,tr=grid(bl,ev)
        if f in ('16th','8th'): tr['_feel']=f
        # tempo changes inside the bar: [fraction of the bar, quarter-note BPM], applied at that exact point
        mid=[[str(Fr(t['position']).limit_denominator(192)),round(qbpm(t),2)] for t in tm if t.get('measure',0)==idx and t.get('position',0)]
        if mid: tr['_tempo']=mid
        cur['bars'].append(tr); cur['ticksPerStep'].append(tps); cur['timeSig'].append('%d/%d'%sigs[idx]); cur['bpm'].append(bpmAt(idx))
    return dict(bpm=round(qbpm(tm[0])),tempos=tempo,sections=secs,unknown=sorted(x for x in unk if x is not None),nbars=len(order),title=d['meta']['title'],artist=d['meta']['artist'],songId=d['meta']['songId'],revisionId=d['meta']['revisionId'],track=d['meta']['tracks'][d['track']]['name'])
if __name__=='__main__':
    r=convert(sys.argv[1]); print(r['title'],r['bpm'],r['nbars'],'unknown',r['unknown'])
    for s in r['sections']: print(' ',s['name'],len(s['bars']),set(s['timeSig']),set(s['ticksPerStep']))
    print(r['sections'][1]['bars'][0] if len(r['sections'])>1 else r['sections'][0]['bars'][4])

def autosection(bars, tps, ts, bpm, title):
    """Split an unmarked tab into parts where the drum texture changes."""
    def feat(b):
        on={k for k,v in b.items() if k!='_sub' and any(c!='.' for c in v)}|set(b.get('_sub',{}))
        if not on or on=={'kick'} and False: return 'no drums'
        cym='ride' if on&{'ride','rideBell'} else 'open hat' if 'openHat' in on and 'closedHat' not in on else 'hi-hat' if on&{'closedHat','openHat','pedalHat'} else 'rim' if 'crossStick' in on else 'toms' if on&{'tomHi','tomMid','tomFloor'} else 'drums'
        return cym
    f=[feat(b) for b in bars]
    runs=[]
    for i,x in enumerate(f):
        if runs and runs[-1][0]==x: runs[-1][2]=i+1
        else: runs.append([x,i,i+1])
    # merge short runs (< 4 bars) into the previous run
    m=[]
    for r in runs:
        if m and (r[2]-r[1]<4 or m[-1][0]==r[0]): m[-1][2]=r[2]
        else: m.append(r)
    if len(m)>1 and m[0][2]-m[0][1]<4 and m[0][0]!='no drums': m[1][1]=m[0][1]; m.pop(0)
    out=[]
    for j,(x,a,b) in enumerate(m):
        name=('Intro (no drums)' if x=='no drums' and a==0 else f'Part {j+1} · {x}' )
        out.append(dict(name=name,bars=bars[a:b],ticksPerStep=tps[a:b],timeSig=ts[a:b],bpm=bpm[a:b]))
    if len(out)==1:  # uniform texture: split into 8-bar phrases instead of one giant section
        o=out[0]; out=[]
        for a in range(0,len(o['bars']),8):
            b=min(len(o['bars']),a+8)
            out.append(dict(name=f'Groove · bars {a+1}–{b}',bars=o['bars'][a:b],ticksPerStep=o['ticksPerStep'][a:b],timeSig=o['timeSig'][a:b],bpm=o['bpm'][a:b]))
    return out
