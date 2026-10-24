"""Account administration. Credentials are read only in the server environment."""
import json, os, re
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from uuid import UUID
from datetime import datetime,timezone

ROOT_EMAIL='isaacbarci@gmail.com'
class AdminError(Exception):
 def __init__(self,status,message):self.status=status;super().__init__(message)

def call(base,key,path,method='GET',body=None,token=None,headers=None):
 data=None if body is None else json.dumps(body).encode()
 request_headers={'apikey':key,'Content-Type':'application/json',**(headers or {})}
 if token or not key.startswith('sb_'):request_headers['Authorization']='Bearer '+(token or key)
 req=Request(base+path,data=data,method=method,headers=request_headers)
 try:
  with urlopen(req,timeout=15) as response:
   data=response.read();return json.loads(data) if data else None
 except HTTPError as exc:
  # Never forward provider responses containing account details or credentials.
  if exc.code in (401,403):raise AdminError(403,'Acesso não autorizado. Entre novamente com a conta administradora.') from None
  if exc.code==404 and path.startswith('/rest/v1/rdo_acessos'):raise AdminError(503,'Aplique usuarios-permissoes-rdo.sql no Supabase deste aplicativo para ativar a gestão de permissões.') from None
  if exc.code==422:raise AdminError(409,'Não foi possível concluir. Confira se o e-mail já existe e se a senha atende à política do banco.') from None
  if exc.code==429:raise AdminError(429,'Muitas solicitações. Aguarde antes de tentar novamente.') from None
  raise AdminError(409 if method=='DELETE' else 503,'Não foi possível concluir no Supabase. Para excluir uma conta com arquivos ou vínculos, remova esses registros primeiro pelo painel Supabase.') from None
 except (URLError,TimeoutError):raise AdminError(503,'Conexão indisponível com o Supabase. Confira a lista antes de repetir a operação.') from None

def validate_id(value):
 try:return str(UUID(str(value)))
 except (ValueError,TypeError,AttributeError):raise AdminError(400,'Conta inválida.') from None

def public_user(row,permission=None):
 permission=permission or {}
 try:inactive=datetime.fromisoformat(str(row.get('banned_until','')).replace('Z','+00:00'))>datetime.now(timezone.utc)
 except (ValueError,TypeError):inactive=False
 return {k:row.get(k) for k in ('id','email','created_at','last_sign_in_at','email_confirmed_at')}|{'desativada':inactive,'principal':str(row.get('email','')).lower()==ROOT_EMAIL,'administrador_total':bool(permission.get('administrador_total')),'ver_historico':bool(permission.get('ver_historico')),'excluir_copias':bool(permission.get('excluir_copias')),'excluir_proprias':bool(permission.get('excluir_proprias') or permission.get('excluir_copias'))}

def dispatch(base,public_key,authorization,method,query,payload,transport=call):
 if not authorization.startswith('Bearer ') or len(authorization)>8192:raise AdminError(401,'Entre com a conta administradora.')
 current=transport(base,public_key,'/auth/v1/user',token=authorization[7:])
 if not current.get('email_confirmed_at') or transport(base,public_key,'/rest/v1/rpc/rdo_admin','POST',{},token=authorization[7:]) is not True:raise AdminError(403,'Somente administradores totais podem gerenciar usuários.')
 secret=os.environ.get('SUPABASE_SECRET_KEY','').strip()
 if not secret:raise AdminError(503,'Gerenciamento de usuários ainda não ativado. Configure SUPABASE_SECRET_KEY no servidor da Vercel.')
 if method=='GET':
  try:page=max(1,min(100000,int(query.get('page',['1'])[0])))
  except (ValueError,TypeError):raise AdminError(400,'Página inválida.')
  search=str(query.get('search',[''])[0]).strip().lower()
  if len(search)>254:raise AdminError(400,'A busca deve ter até 254 caracteres.')
  params={'page':page,'per_page':50}
  if search:params['filter']=search
  data=transport(base,secret,'/auth/v1/admin/users?'+urlencode(params))
  users=data.get('users',[]);ids=','.join(validate_id(u['id']) for u in users)
  permissions=transport(base,secret,'/rest/v1/rdo_acessos?select=user_id,administrador_total,ver_historico,excluir_copias,excluir_proprias&user_id=in.('+ids+')') if ids else []
  by_id={p['user_id']:p for p in permissions}
  return {'users':[public_user(u,by_id.get(u['id'])) for u in users],'page':page,'has_more':len(users)==50}
 if method!='POST':raise AdminError(405,'Método não permitido.')
 action=payload.get('action')
 if action=='create':
  email=str(payload.get('email','')).strip().lower();password=payload.get('password')
  if len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise AdminError(400,'Informe um e-mail válido.')
  if not isinstance(password,str) or not 8<=len(password)<=128:raise AdminError(400,'Use uma senha entre 8 e 128 caracteres.')
  row=transport(base,secret,'/auth/v1/admin/users','POST',{'email':email,'password':password,'email_confirm':True})
  return {'user':public_user(row),'message':'Conta criada. Já pode entrar com o e-mail e a senha definidos.'}
 if action not in ('permissions','delete','set_active','reset_password'):raise AdminError(400,'Operação inválida.')
 target_id=validate_id(payload.get('id'))
 target=transport(base,secret,'/auth/v1/admin/users/'+target_id)
 if target_id==current.get('id') or str(target.get('email','')).lower()==ROOT_EMAIL:raise AdminError(403,'A conta administradora principal é protegida.')
 if action=='reset_password':
  password=payload.get('password')
  if not isinstance(password,str) or not 8<=len(password)<=128:raise AdminError(400,'Use uma senha entre 8 e 128 caracteres.')
  transport(base,secret,'/auth/v1/admin/users/'+target_id,'PUT',{'password':password})
  return {'message':'Senha redefinida. A conta já pode entrar com a nova senha.'}
 if action=='set_active':
  active=payload.get('active')
  if type(active) is not bool:raise AdminError(400,'Estado da conta inválido.')
  updated=transport(base,secret,'/auth/v1/admin/users/'+target_id,'PUT',{'ban_duration':'none' if active else '876000h'})
  return {'user':public_user(updated),'message':'Conta reativada.' if active else 'Conta desativada. Os dados foram preservados.'}
 if action=='permissions':
  view=payload.get('ver_historico');delete=payload.get('excluir_copias');own=payload.get('excluir_proprias',False)
  if type(view) is not bool or type(delete) is not bool or type(own) is not bool:raise AdminError(400,'Permissões inválidas.')
  if delete and not view:raise AdminError(400,'Para excluir cópias, permita também ver o histórico de todos.')
  full_admin=payload.get('administrador_total')
  if 'administrador_total' not in payload:
   previous=transport(base,secret,'/rest/v1/rdo_acessos?select=administrador_total&user_id=eq.'+target_id);full_admin=bool(previous and previous[0].get('administrador_total'))
  if type(full_admin) is not bool:raise AdminError(400,'Permissão de administrador inválida.')
  row={'user_id':target_id,'administrador_total':full_admin,'ver_historico':view,'excluir_copias':delete,'excluir_proprias':own or delete}
  transport(base,secret,'/rest/v1/rdo_acessos?on_conflict=user_id','POST',row,headers={'Prefer':'resolution=merge-duplicates,return=minimal'})
  return {'message':'Permissões atualizadas.'}
 if payload.get('confirm_email','').strip().lower()!=str(target.get('email','')).lower():raise AdminError(400,'Digite o e-mail da conta para confirmar a exclusão.')
 # Do not silently erase files or data belonging to other apps in this shared project.
 copies=transport(base,secret,'/rest/v1/rdo_arquivos?select=id&limit=1&user_id=eq.'+target_id)
 if copies:raise AdminError(409,'Esta conta possui cópias no histórico. Exclua essas cópias antes de excluir a conta.')
 transport(base,secret,'/auth/v1/admin/users/'+target_id,'DELETE',{'should_soft_delete':False})
 return {'message':'Conta excluída do Supabase.'}
