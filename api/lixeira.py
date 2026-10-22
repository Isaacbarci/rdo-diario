from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.user_admin import AdminError
from server.history_trash import dispatch
AUTH_BASE='https://aifukuicddxpxzvfnmur.supabase.co'
PUBLIC_KEY='sb_publishable_AMPPojZCPk1WLcb3sbfofA_vofzyfAh'
class handler(BaseHTTPRequestHandler):
 def send_json(self,status,data):
  blob=json.dumps(data,ensure_ascii=False).encode();self.send_response(status)
  self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','private, no-store');self.send_header('Vary','Authorization');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(blob)));self.end_headers();self.wfile.write(blob)
 def execute(self):
  try:
   origin=self.headers.get('Origin')
   if origin and urlparse(origin).netloc!=self.headers.get('Host'):raise AdminError(403,'Origem não autorizada.')
   payload={}
   if self.command=='POST':
    if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise AdminError(415,'Envie os dados em JSON.')
    try:length=int(self.headers.get('Content-Length','0'))
    except ValueError:raise AdminError(400,'Requisição inválida.')
    if not 0<length<=16384:raise AdminError(413,'Requisição inválida.')
    try:payload=json.loads(self.rfile.read(length))
    except (ValueError,UnicodeError):raise AdminError(400,'Dados inválidos.')
    if not isinstance(payload,dict):raise AdminError(400,'Dados inválidos.')
   result=dispatch(AUTH_BASE,PUBLIC_KEY,self.headers.get('Authorization',''),self.command,parse_qs(urlparse(self.path).query),payload)
   return self.send_json(200,result)
  except AdminError as exc:return self.send_json(exc.status,{'message':str(exc)})
  except Exception as exc:
   print(json.dumps({'event':'history_trash_error','type':type(exc).__name__}),flush=True)
   return self.send_json(503,{'message':'Não foi possível concluir. Confira a lista antes de repetir a operação.'})
 def do_GET(self):self.execute()
 def do_POST(self):self.execute()
 def do_DELETE(self):self.send_json(405,{'message':'Método não permitido.'})
 def do_OPTIONS(self):self.send_json(405,{'message':'Método não permitido.'})
