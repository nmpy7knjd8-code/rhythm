import sys,subprocess,re,html,hashlib,os
def text(url):
    fn='cache/'+hashlib.md5(url.encode()).hexdigest()+'.txt'
    if os.path.exists(fn): return open(fn).read()
    os.makedirs('cache',exist_ok=True)
    r=subprocess.run(['curl','-sL','--compressed','-m','40','-A','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',url],capture_output=True)
    h=r.stdout.decode('utf-8','ignore')
    h=re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>',' ',h); h=re.sub(r'(?s)<[^>]+>',' ',h); h=html.unescape(h)
    t=re.sub(r'\s+',' ',h); open(fn,'w').write(t); return t
def norm(s):
    s=s.replace('\u2019',"'").replace('\u2018',"'").replace('\u201c','"').replace('\u201d','"').replace('\u2014','-').replace('\u2013','-').replace('\u2026','...')
    return re.sub(r'\s+',' ',s).strip().lower()
if __name__=='__main__':
    for u in sys.argv[1:]:
        t=text(u); print(u,len(t))
