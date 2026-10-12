import fetch,quotes,json
ok={};bad=[]
for d,qs in quotes.Q.items():
    for q in qs:
        t=fetch.norm(fetch.text(q[5]))
        n=fetch.norm(q[0]).replace('"','').rstrip(',')
        tt=t.replace('"','')
        if n in tt: ok.setdefault(d,[]).append(q)
        else: bad.append((d,q[0][:60],q[5],len(t)))
for b in bad: print('FAIL',b)
print({d:len(v) for d,v in ok.items()})
json.dump(ok,open('ok.json','w'))
