import json,os,re
from ssconv import convert
gen=json.load(open('song-patterns.generated.json'))  # generated (v2) incl journeys
idx=json.load(open('songsterr/index.json'))
vc=lambda v:'.' if v<=0 else str(max(1,min(9,round(v*9))))
os.makedirs('/workspace/rhythm/public/songs',exist_ok=True)
meta=[];full=[]
# 30 more songs (rock + virtuoso) already converted by more.py; Quadrant 4 is only partly tabbed, so it's left out
EXTRA=[x for x in json.load(open('song-patterns-more.json')) if x['id'] not in ('quadrant4','blackpage')]
EXTRA_IDS={x['id'] for x in EXTRA}
for e in gen+EXTRA:
    k=e['id']; e=dict(e)
    if k in EXTRA_IDS: pass
    elif k in idx and isinstance(idx[k],list):
        r=convert(f'songsterr/{k}.json')
        sid=idx[k][0]
        url=f"https://www.songsterr.com/a/wsa/{re.sub('[^a-z0-9]+','-',r['artist'].lower())}-{re.sub('[^a-z0-9]+','-',r['title'].lower())}-drum-tab-s{sid}"
        rs=r['sections']
        if len(rs)==1:
            from ssconv import autosection
            s0=rs[0]; rs=autosection(s0['bars'],s0['ticksPerStep'],s0['timeSig'],s0['bpm'],r['title']); auto=True
        else: auto=False
        secs=[]
        for j,s in enumerate(rs):
            if s['name'].startswith('(') or s['name'].startswith('...'): s=dict(s,name=f'Section {j+1}')
            hum={'cometogether':{'Intro':dict(lateMs=14,jitterMs=7)}}.get(k,{}).get(s['name'])
            secs.append(dict(name=s['name'],bars=s['bars'],**({'humanize':hum} if hum else {}),ticksPerStep=s['ticksPerStep'],timeSig=s['timeSig'],bpm=s['bpm'],confidence='transcribed: Songsterr community drum tab (note-complete as published; not checked bar-by-bar against the recording)'+('; section boundaries detected from changes in the drum part (the tab has no section markers)' if auto else '')))
        # Named forms for auto-sectioned tabs, matched to the drum textures (hi-hat verses, ride choruses, open-hat solo sections)
        NAMED={'driven':['Intro','Chorus 1','Verse 1','Chorus 2','Guitar solo','Chorus 3','Verse 2','Solo build','Chorus 4','Outro vamp','Ending']}
        if k in NAMED and len(NAMED[k])==len(secs):
            for s2,n in zip(secs,NAMED[k]): s2['name']=n; s2['confidence']+='; section names estimated from the drum texture and song structure'
        e['sections']=secs; e['bpm']=r['bpm']
        e['source']=url; e['transcription']=dict(source='Songsterr',songId=sid,revisionId=r['revisionId'],track=r['track'],bars=r['nbars'],tempoChanges=len(r['tempos']))
        e['confidence']='transcribed (Songsterr community tab)'
        e['formNote']=f"Full drum part from the Songsterr community tab (revision {r['revisionId']}, track: {r['track'] or 'drums'}), with repeats expanded, tempo map and section markers as published. Community tabs can contain errors."
        if k=='funkydrummer': e['formNote']+=' This tab covers the "Bonus Beat Reprise" version.'
        if k=='cobham': e['formNote']+=' The tab is partial (about 2.5 minutes).'
        sec_len=sum(n*4/d*60/b for s in secs for ts,b in zip(s['timeSig'],s['bpm']) for n,d in [map(int,ts.split('/'))])
        e['lengthCheck']=dict(e.get('lengthCheck',{}),modelSeconds=round(sec_len))
    else:
        secs=[]
        for s in e['sections']:
            bars=[{kk:''.join(map(vc,a)) for kk,a in b.items() if any(a)} for b in s['bars']]
            n=len(bars); secs.append(dict(name=s['name'],bars=bars,ticksPerStep=[s.get('ticksPerStep',e.get('ticksPerStep',3))]*n,timeSig=[s.get('timeSig',e['timeSig'])]*n,bpm=[e['bpm']]*n,confidence=s.get('confidence','approximate')))
        e['sections']=secs
    for s in e['sections']: s['timeSig']=[t if re.match(r'^\d+/\d+$',t) else e['timeSig'] if re.match(r'^\d+/\d+$',e['timeSig']) else '4/4' for t in s['timeSig']]
    full.append(e)
    # tom variants only mean something when the song also uses the base tom on that row; otherwise the variant IS that row's drum
    TOMV={'tomHi2':'tomHi','tomMid2':'tomMid','tomFloor2':'tomFloor'}
    base=set()
    for sec in e['sections']:
        for b in sec['bars']:
            vm=b.get('_var',{})
            for row in TOMV.values():
                if any(c!='.' and str(i) not in vm.get(row,{}) for i,c in enumerate(b.get(row,''))): base.add(row)
    for sec in e['sections']:
        for b in sec['bars']:
            vm=b.get('_var')
            if not vm: continue
            for row in list(vm):
                vm[row]={i:v for i,v in vm[row].items() if not (v in TOMV and TOMV[v] not in base)}
                if not vm[row]: del vm[row]
            if not vm: del b['_var']
    json.dump(dict(id=k,sections=e['sections']),open(f'/workspace/rhythm/public/songs/{k}.json','w'),separators=(',',':'))
    m={x:y for x,y in e.items() if x!='sections'}
    m['form']=[dict(section=s['name'],bars=len(s['bars']),timeSig=sorted(set(s['timeSig']))) for s in e['sections']]
    fb=0
    for sec in e['sections']:
        for b in sec['bars']:
            if b.get('_sub') or any(c not in '.' for k2,v in b.items() if k2 not in ('_sub','_var') for c in v): break
            fb+=1
        else: continue
        break
    m['firstDrumBar']=fb
    m['category']='Journeys' if k.startswith('j-') else ('Virtuoso' if e.get('category')=='virtuoso' else 'Songs')
    meta.append(m)
one=[e['id'] for e in full if len(e['sections'])<2]
intro_only=[e['id'] for e in full if len(e['sections'])==1 or all(s['name'].lower().startswith('intro') for s in e['sections'])]
print('CHECK single-section songs:',one or 'none','| intro-only labels:',intro_only or 'none')
json.dump(full,open('song-patterns.json.full','w'))
meta=[m for m in meta if m['id'] not in ('j-shaman','thetapulse')]  # removed at Garrett's request
json.dump(meta,open('/workspace/rhythm/src/data/songs.json','w'),separators=(',',':'))
print(len(meta), sum(1 for m in meta if m.get('transcription')),'transcribed')

# ---- hand fixes: research/overrides.json is applied on every build, and the build fails if any is not in effect ----
import shutil, subprocess
OV = json.load(open('/workspace/rhythm/scripts/overrides.json'))
APPD = '/workspace/rhythm'
meta = json.load(open(f'{APPD}/src/data/songs.json'))
meta = [m for m in meta if m['id'] not in OV['remove']]
for m in meta:
    for k, v in OV['meta'].get(m['id'], {}).items(): m[k] = v
for tf in OV['textFixes']:
    for m in meta:
        if m['id'] == tf['song']: m.update(json.loads(json.dumps(m).replace(tf['find'], tf['replace'])))
json.dump(meta, open(f'{APPD}/src/data/songs.json', 'w'), separators=(',', ':'), ensure_ascii=False)
for r in OV['remove']:
    if os.path.exists(f'{APPD}/public/songs/{r}.json'): os.remove(f'{APPD}/public/songs/{r}.json')
for f in OV['pinnedFiles']: shutil.copy(f'{APPD}/scripts/overrides/{f}.json', f'{APPD}/public/songs/{f}.json')
for tf in OV['textFixes']:
    p = f"{APPD}/public/songs/{tf['song']}.json"; t = open(p).read().replace(tf['find'], tf['replace']); open(p, 'w').write(t)
if OV.get('tagShuffle'): subprocess.run(['python3', 'tag_feel.py'], check=True, cwd=os.path.dirname(os.path.abspath(__file__)), stdout=subprocess.DEVNULL)
subprocess.run(['node', 'scripts/check-overrides.mjs'], check=True, cwd=APPD)
