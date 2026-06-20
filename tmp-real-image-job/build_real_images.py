from __future__ import annotations
import hashlib, io, sys, time
from pathlib import Path
import fitz, requests
from PIL import Image, ImageChops, ImageStat

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'real_product_images'; CACHE=ROOT/'.cache'
OUT.mkdir(parents=True,exist_ok=True); CACHE.mkdir(exist_ok=True)
S=requests.Session(); S.headers.update({'User-Agent':'Mozilla/5.0 Chrome/124 Safari/537.36','Referer':'https://les.mitsubishielectric.co.uk/'})

SRC={
'ln-r':('https://les.mitsubishielectric.co.uk/assets/Product/4433b3bcbb/M-Series-MSZ-LN-Red-v2__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4164'),
'ln-b':('https://les.mitsubishielectric.co.uk/assets/Product/66551105e1/M-Series-MSZ-LN-Black-v2__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4164'),
'ln-v':('https://les.mitsubishielectric.co.uk/assets/Product/3e3902f4ea/M-Series-MSZ-LN-Pearl-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4164'),
'ln-w':('https://les.mitsubishielectric.co.uk/assets/Product/78ab4f5694/M-Series-MSZ-LN-Natural-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4164'),
'rz':('https://les.mitsubishielectric.co.uk/assets/Product/MSZ-R2-white-background-2__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/5482'),
'ay':('https://les.mitsubishielectric.co.uk/assets/Product/MSZ-AY25-50VGK-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4788'),
'ef-b':('https://les.mitsubishielectric.co.uk/assets/Product/83e071d086/M-Series-MSZ-EF-Zen-Black__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/3593'),
'ef-s':('https://les.mitsubishielectric.co.uk/assets/Product/0666a08dc8/M-Series-MSZ-EF-Zen-Silver__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/3593'),
'ef-w':('https://les.mitsubishielectric.co.uk/assets/Product/92e4a08f61/M-Series-MSZ-EF-Zen-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/3593'),
'hr':('https://les.mitsubishielectric.co.uk/assets/Product/bb034efcad/M-Series-MSZ-HR-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4097'),
'mfz':('https://les.mitsubishielectric.co.uk/assets/Product/e89db12ed3/M-Series-MFZ-KJ-Floor-Mounted-Unit__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4163'),
'mxz':('https://les.mitsubishielectric.co.uk/assets/Product/1d1db016af/MXZ-3D54-3D68-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4206'),
'pumy-sp':('https://les.mitsubishielectric.co.uk/assets/Product/60d1fec4ac/PUMY-Single-fan-White__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/3768'),
'pumy-p':('https://les.mitsubishielectric.co.uk/assets/Product/70a9961c88/PUMY-image-v3__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4159'),
'pla-zm-v':('https://les.mitsubishielectric.co.uk/assets/Product/68acba89d7/Mr-Slim-PLA-ZM-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4165'),
'pla-zm-y':('https://les.mitsubishielectric.co.uk/assets/Product/68acba89d7/Mr-Slim-PLA-ZM-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4169'),
'pla-m-v':('https://les.mitsubishielectric.co.uk/assets/Product/68acba89d7/Mr-Slim-PLA-ZM-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4166'),
'pla-m-y':('https://les.mitsubishielectric.co.uk/assets/Product/68acba89d7/Mr-Slim-PLA-ZM-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4167'),
'pla-sm':('https://les.mitsubishielectric.co.uk/assets/Product/68acba89d7/Mr-Slim-PLA-ZM-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4168'),
'slz':('https://les.mitsubishielectric.co.uk/assets/Product/70085b73ec/Mr-Slim-SLZ-KF-Ceiling-Cassette__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4170'),
'pca':('https://les.mitsubishielectric.co.uk/assets/Product/960390f8f0/Mr-Slim-PCA-M-v2__FillWzYwMCw0MDBd.png','https://library.mitsubishielectric.co.uk/pdf/download_full/4182')}

MODELS=[]
def add(key,*slugs): MODELS.extend((s,key) for s in slugs)
for n in (18,25,35,50,60):
    for c in 'rbvw': add('ln-'+c,f'mitsubishi-electric-msz-ln{n}vg3{c}')
for n in (25,35,50): add('rz',f'mitsubishi-electric-msz-rz{n}vu',f'mitsubishi-electric-msz-rz{n}vub')
add('ay',*[f'mitsubishi-electric-msz-ay{n}vgk2' for n in (15,20,25,35,42,50)],*[f'mitsubishi-electric-msz-ap{n}vgk2' for n in (60,71)])
for n in (18,22,25,35,50):
    for c in 'bsw': add('ef-'+c,f'mitsubishi-electric-msz-ef{n}vgk2{c}')
add('hr',*[f'mitsubishi-electric-msz-hr{n}vf2' for n in (25,35,50,60,71)])
add('mfz',*[f'mitsubishi-electric-mfz-kt{n}vg' for n in (25,35,50)])
add('mxz',*[f'mitsubishi-electric-mxz-{x}' for x in ('2f33vf3','2f42vf3','2f53vf3','3f54vf3','3f68vf3','4f72vf3','4f83vf','5f102vf','6f122vf')])
add('pumy-sp',*[f'mitsubishi-electric-pumy-sp{n}{p}' for n in (112,125,140) for p in ('vkm','ykm')])
add('pumy-p',*[f'mitsubishi-electric-pumy-p{n}{p}' for n in (112,125,140) for p in ('vkm5','ykm4')],'mitsubishi-electric-pumy-p200ykm2')
add('pla-zm-v',*[f'mitsubishi-electric-pla-zm{n}ea2-puz-zm{n}{p}' for n,p in ((35,'vka2'),(50,'vka2'),(60,'vha2'),(71,'vha2'),(100,'vda'),(125,'vda'),(140,'vda'))])
add('pla-zm-y',*[f'mitsubishi-electric-pla-zm{n}ea2-puz-zm{n}yda' for n in (100,125,140)])
add('pla-m-v',*[f'mitsubishi-electric-pla-m{n}ea2-{o}' for n,o in ((35,'suz-m35var2'),(50,'suz-m50var2'),(60,'suz-m60var2'),(71,'suz-m71var1'),(100,'puz-m100vka2'),(125,'puz-m125vka2'),(140,'puz-m140vka2'))])
add('pla-m-y',*[f'mitsubishi-electric-pla-m{n}ea2-puz-m{n}yka2' for n in (100,125,140)])
add('pla-sm',*[f'mitsubishi-electric-pla-sm{n}ea-{o}' for n,o in ((71,'suz-sm71va'),(100,'puz-sm100vka2'),(125,'puz-sm125vka2'),(140,'puz-sm140vka2'))])
add('slz','mitsubishi-electric-slz-m15fa',*[f'mitsubishi-electric-slz-m{n}fa-suz-m{n}var2' for n in (25,35,50,60)])
add('pca',*[f'mitsubishi-electric-pca-m{n}ka2-puz-zm{n}{p}' for n,p in ((50,'vka2'),(60,'vha2'),(71,'vha2'),(100,'vda'),(125,'vda'),(140,'vda'))])
assert len(MODELS)==114, len(MODELS)

def sha(b): return hashlib.sha256(b).hexdigest()
def get(url):
    last=None
    for i in range(5):
        try:
            r=S.get(url,timeout=90,allow_redirects=True)
            if r.status_code==200 and len(r.content)>1000:return r.content
            last=RuntimeError(f'HTTP {r.status_code}, {len(r.content)} bytes')
        except Exception as e:last=e
        time.sleep(2**i)
    raise RuntimeError(f'{url}: {last}')
def image(b):
    im=Image.open(io.BytesIO(b)); im.load(); return im.convert('RGBA' if im.mode=='RGBA' else 'RGB')
def score(im):
    w,h=im.size
    if w<280 or h<160 or w/max(h,1)>6 or w/max(h,1)<.15:return -1
    sm=im.convert('RGB'); sm.thumbnail((220,220)); v=sum(ImageStat.Stat(sm).var)/3
    return -1 if v<10 else w*h*(1+min(v/1800,2))
def encode(im,trim=False):
    if trim:
        x=im.convert('RGBA'); bg=Image.new('RGBA',x.size,(255,255,255,255)); d=ImageChops.difference(x,bg).convert('L').point(lambda p:0 if p<7 else 255); box=d.getbbox()
        if box:
            l,t,r,b=box; im=im.crop((max(0,l-20),max(0,t-20),min(im.width,r+20),min(im.height,b+20)))
    im.thumbnail((1800,1400),Image.Resampling.LANCZOS)
    if im.mode not in ('RGB','RGBA'):im=im.convert('RGB')
    o=io.BytesIO(); im.save(o,'WEBP',quality=92,method=6); return o.getvalue()
def primary(key):
    url,_=SRC[key]; p=CACHE/('p-'+sha(url.encode())[:18]+'.webp')
    if p.exists():return p.read_bytes()
    im=image(get(url))
    if score(im)<0:raise RuntimeError(f'primary rejected {im.size}')
    b=encode(im,True);p.write_bytes(b);return b
def secondary(key,first_hash):
    _,url=SRC[key]; p=CACHE/('s-'+sha(url.encode())[:18]+'-'+first_hash[:8]+'.webp')
    if p.exists():return p.read_bytes()
    pdf=get(url)
    if not pdf.startswith(b'%PDF'):raise RuntimeError('not a PDF')
    doc=fitz.open(stream=pdf,filetype='pdf'); cand=[];seen=set()
    for page in list(doc)[:4]:
        try:blocks=page.get_text('dict').get('blocks',[])
        except Exception:blocks=[]
        blobs=[b.get('image') for b in blocks if b.get('type')==1 and b.get('image')]
        for info in page.get_images(full=True):
            try:blobs.append(doc.extract_image(info[0])['image'])
            except Exception:pass
        for raw in blobs:
            try:im=image(raw);s=score(im)
            except Exception:continue
            if s<0:continue
            b=encode(im);h=sha(b)
            if h==first_hash or h in seen:continue
            seen.add(h);cand.append((s,b))
    if not cand:raise RuntimeError('no second official product image in PDF')
    cand.sort(reverse=True,key=lambda x:x[0]);b=cand[0][1];p.write_bytes(b);return b

def main():
    errors=[]
    for i,(slug,key) in enumerate(MODELS,1):
        d=OUT/slug;d.mkdir(parents=True,exist_ok=True)
        try:
            a=primary(key);b=secondary(key,sha(a))
            if sha(a)==sha(b):raise RuntimeError('identical images')
            (d/'01-urun.webp').write_bytes(a);(d/'02-resmi-urun-fotografi.webp').write_bytes(b)
            print(f'[{i:03}/114] OK {slug}')
        except Exception as e:errors.append(f'{slug}: {e}');print(errors[-1],file=sys.stderr)
    imgs=list(OUT.rglob('*.webp'));bad=[d.name for d in OUT.iterdir() if d.is_dir() and len(list(d.glob('*.webp')))!=2]
    print(f'models={len(MODELS)} images={len(imgs)} errors={len(errors)} bad={len(bad)}')
    if errors or len(imgs)!=228 or bad:
        print('\n'.join(errors),file=sys.stderr);raise SystemExit(1)
if __name__=='__main__':main()
