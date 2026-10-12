import fetch,claims,json
ok={};
for d,cs in claims.C.items():
    for c in cs:
        t=fetch.norm(fetch.text(c[2])); miss=[k for k in c[3] if fetch.norm(k) not in t]
        if miss: print('MISS',d,c[1][:50],miss,len(t))
        else: ok.setdefault(d,[]).append(c)
json.dump(ok,open('claims_ok.json','w'))
