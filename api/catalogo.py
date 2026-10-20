from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import gzip,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.catalog import read_catalog

CONFIG=json.loads((Path(__file__).resolve().parents[1]/'server/config.json').read_text(encoding='utf-8'))
AUTH_URL=CONFIG['supabaseUrl']+'/auth/v1/user'
PUBLIC_KEY=CONFIG['supabaseKey']

def authorize(header):
 if not header.startswith('Bearer ') or len(header)>8192:return False
 req=Request(AUTH_URL,headers={'apikey':PUBLIC_KEY,'Authorization':header})
 with urlopen(req,timeout=15) as response:
  user=json.load(response)
  return bool(user.get('id'))

class handler(BaseHTTPRequestHandler):
 def send_json(self,code,payload,compress=False):
  data=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
  if compress:data=gzip.compress(data,compresslevel=6)
  if len(data)>4_000_000:
   return self.send_json(413,{'message':'A base ultrapassou o limite. A ultima copia local sera preservada.'})
  self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
  self.send_header('Cache-Control','private, no-store');self.send_header('Vary','Authorization, Accept-Encoding')
  if compress:self.send_header('Content-Encoding','gzip')
  self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def do_GET(self):
  module=parse_qs(urlparse(self.path).query).get('modulo',[''])[0]
  if module!='spool':return self.send_json(400,{'message':'Modulo invalido.'})
  try:
   if not authorize(self.headers.get('Authorization','')):return self.send_json(401,{'message':'Entre na sua conta para atualizar a base.'})
  except HTTPError as e:
   return self.send_json(401 if e.code in (401,403) else 503,{'message':'Nao foi possivel validar a conta. Entre novamente.'})
  except Exception:
   return self.send_json(503,{'message':'Autenticacao indisponivel. A ultima base local sera preservada.'})
  try:
   payload=read_catalog(module)
   return self.send_json(200,payload,compress='gzip' in self.headers.get('Accept-Encoding',''))
  except Exception as e:
   print(json.dumps({'event':'catalog_error','module':module,'type':type(e).__name__}),flush=True)
   return self.send_json(503,{'message':'Nao foi possivel atualizar pelo MySQL. A ultima base local sera preservada.'})
 def do_POST(self):self.send_json(405,{'message':'Somente leitura.'})
