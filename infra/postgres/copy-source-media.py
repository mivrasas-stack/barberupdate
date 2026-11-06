#!/usr/bin/env python3
"""Read-only migration of public media onto BarberNow's own VPS disk."""
import json,os,re,subprocess,sys,hashlib,urllib.request
from pathlib import Path
from urllib.parse import urlparse,quote

js = """
import {createDb} from './src/db.js';import {configFromEnv} from './src/config.js';
const cfg=configFromEnv(process.env),db=createDb(cfg);
try{
 const assets=await db.query('SELECT storage_bucket,storage_path,mime_type FROM public.media_assets');
 const photos=await db.query("SELECT logo_url AS url FROM public.tenants UNION ALL SELECT cover_url FROM public.tenants UNION ALL SELECT photo_url FROM public.barbers UNION ALL SELECT photo_url FROM public.products");
 const galleries=await db.query("SELECT unnest(portfolio) AS url FROM public.tenants UNION ALL SELECT unnest(portfolio) FROM public.barbers");
 process.stdout.write(JSON.stringify({origin:cfg.supabaseUrl,assets:assets.rows,
  references:[...photos.rows,...galleries.rows].map(x=>x.url).filter(Boolean)}));
}finally{await db.close()}
"""
response=subprocess.run(['docker','exec','-i','barbernow-production-worker-1','node','--input-type=module'],input=js,capture_output=True,text=True,timeout=35)
if response.returncode:sys.exit('Failed to retrieve legacy public media metadata')
d=json.loads(response.stdout)
origin=urlparse(d['origin'])
if origin.scheme!='https' or not origin.hostname or not origin.hostname.endswith('.supabase.co'):
    sys.exit('Unexpected legacy source origin')
volume=subprocess.check_output(['docker','volume','inspect','barbernow_media_data','--format','{{.Mountpoint}}'],text=True,timeout=10).strip()
root=Path(volume).resolve()
if not root.is_dir():sys.exit('Local media volume missing')
pattern=re.compile(r'^(?:avatars/[0-9a-f-]{36}|[0-9a-f-]{36}/(?:shop|barber|products|logo|cover|portfolio|service|product))/[0-9a-f-]{36}\.(?:jpg|png|webp)$',re.I)
prefix='/storage/v1/object/public/barberos-images/'
paths=set(a['storage_path'] for a in d['assets'] if a['storage_bucket']=='barberos-images')
for value in d['references']:
    parsed=urlparse(value)
    if (parsed.scheme,parsed.netloc)==(origin.scheme,origin.netloc) and parsed.path.startswith(prefix):
        paths.add(parsed.path[len(prefix):])
copied=0
results=[]
for path in sorted(paths):
    if not pattern.fullmatch(path):
        results.append({'category':'invalid_path'})
        continue
    url=d['origin'].rstrip('/')+prefix+'/'.join(quote(p,safe='') for p in path.split('/'))
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BarberNow media migration'}),timeout=15) as stream:
            mime=stream.headers.get('Content-Type','').split(';')[0]
            data=stream.read(4_000_001)
    except Exception:
        results.append({'category':'fetch_failed'})
        continue
    ext=path.rsplit('.',1)[1]
    expected={'jpg':'image/jpeg','png':'image/png','webp':'image/webp'}[ext]
    magic=(expected=='image/jpeg' and data[:3]==bytes.fromhex('ffd8ff') or
           expected=='image/png' and data[:8]==bytes.fromhex('89504e470d0a1a0a') or
           expected=='image/webp' and data[:4]==b'RIFF' and data[8:12]==b'WEBP')
    if len(data)>4_000_000 or len(data)<12 or mime!=expected or not magic:
        results.append({'category':'bad_image'})
        continue
    dest=(root/path).resolve()
    if not str(dest).startswith(str(root)+os.sep):sys.exit('Invalid output path')
    dest.parent.mkdir(parents=True,exist_ok=True,mode=0o750)
    if dest.exists():
        if hashlib.sha256(dest.read_bytes()).digest()!=hashlib.sha256(data).digest():sys.exit('Existing image checksum mismatch')
    else:
        fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o640)
        with os.fdopen(fd,'wb') as file:file.write(data)
        copied+=1
    results.append({'category':'ok','path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for entry in [root,*root.rglob('*')]:
    os.chown(entry,1000,1000)
    os.chmod(entry,0o750 if entry.is_dir() else 0o640)
manifest=Path('/opt/barbernow/migration-backups/source-20261105/media-migration-manifest.json')
manifest.write_text(json.dumps({'origin':d['origin'],'files':results},indent=2))
os.chmod(manifest,0o600)
print('MEDIA_REFERENCED',len(paths),'COPIED',copied,'TOTAL_VALID',sum(x['category']=='ok' for x in results),'FAILED',sum(x['category']!='ok' for x in results))