"""Private archive retention. Only the principal account restores copies."""
import os,hmac
from datetime import datetime,timedelta,timezone
from urllib.parse import urlencode
from server.user_admin import call,AdminError,ROOT_EMAIL,validate_id

TABLE='rdo_arquivos'
BUCKET='rdo-arquivos'
PREFIX='rdo'
NAME='nome'
AUTHOR='autor_email'

def purge(base,secret,transport,cutoff=None):
 params={'select':'id,user_id,caminho','excluido_em':'not.is.null','order':'excluido_em,id','limit':100}
 if cutoff:params['or']='(excluido_em.lte.'+cutoff+',eliminacao_em.not.is.null)'
 rows=transport(base,secret,'/rest/v1/'+TABLE+'?'+urlencode(params))
 for row in rows:
  owner=validate_id(row['user_id']);identifier=validate_id(row['id'])
  if row['caminho'] not in (owner+'/'+identifier+'.xlsx',owner+'/'+identifier+'.html'):raise AdminError(409,'Caminho de cópia inválido; limpeza interrompida.')
 if not rows:return {'removed':0,'has_more':False}
 filters={'id':'in.('+','.join(row['id'] for row in rows)+')','excluido_em':'not.is.null'}
 if cutoff:filters['or']=params['or']
 # Atomically claim only rows still in trash. Restore rejects claimed rows.
 claimed=transport(base,secret,'/rest/v1/'+TABLE+'?'+urlencode(filters),'PATCH',{'eliminacao_em':datetime.now(timezone.utc).isoformat()},headers={'Prefer':'return=representation'})
 if claimed:
  transport(base,secret,'/storage/v1/object/'+BUCKET,'DELETE',{'prefixes':[row['caminho'] for row in claimed]})
  transport(base,secret,'/rest/v1/'+TABLE+'?'+urlencode({'id':'in.('+','.join(row['id'] for row in claimed)+')','excluido_em':'not.is.null','eliminacao_em':'not.is.null'}),'DELETE')
 return {'removed':len(claimed or []),'has_more':len(rows)==100}

def dispatch(base,public_key,authorization,method,query,payload,transport=call):
 secret=os.environ.get('SUPABASE_SECRET_KEY','').strip()
 if not secret:raise AdminError(503,'Lixeira ainda não configurada no servidor.')
 cutoff=(datetime.now(timezone.utc)-timedelta(days=30)).isoformat()
 if query.get('cleanup')==['1']:
  expected=os.environ.get('CRON_SECRET','')
  if method!='GET' or not expected or not hmac.compare_digest(authorization,'Bearer '+expected):raise AdminError(403,'Acesso não autorizado.')
  return purge(base,secret,transport,cutoff)
 if not authorization.startswith('Bearer ') or len(authorization)>8192:raise AdminError(401,'Entre com a conta administradora.')
 token=authorization[7:]
 current=transport(base,public_key,'/auth/v1/user',token=token)
 if str(current.get('email','')).lower()!=ROOT_EMAIL or not current.get('email_confirmed_at'):raise AdminError(403,'Somente a conta administradora principal pode acessar a lixeira.')
 if method=='POST':
  if payload.get('action')=='empty':
   if payload.get('confirm')!='ESVAZIAR':raise AdminError(400,'Digite ESVAZIAR para confirmar.')
   return purge(base,secret,transport)
  if payload.get('action')!='restore':raise AdminError(400,'Operação inválida.')
  identifier=validate_id(payload.get('id'))
  restored=transport(base,public_key,'/rest/v1/rpc/'+PREFIX+'_copia_restaurar','POST',{'p_id':identifier},token=token)
  if restored is not True:raise AdminError(409,'Cópia indisponível ou prazo de restauração encerrado.')
  return {'restored':True}
 if method!='GET':raise AdminError(405,'Método não permitido.')
 try:page=max(1,min(100000,int(query.get('page',['1'])[0])))
 except (ValueError,TypeError):raise AdminError(400,'Página inválida.')
 search=str(query.get('search',[''])[0]).strip()
 if len(search)>254:raise AdminError(400,'Busca muito longa.')
 params={'select':'*','excluido_em':'gt.'+cutoff,'order':'excluido_em.desc,id','offset':(page-1)*50,'limit':51}
 if search:
  pattern='*'+search.replace('\\','\\\\').replace('"','\\"')+'*'
  params['or']='('+NAME+'.ilike."'+pattern+'",'+AUTHOR+'.ilike."'+pattern+'")'
 rows=transport(base,secret,'/rest/v1/'+TABLE+'?'+urlencode(params))
 return {'files':rows[:50],'has_more':len(rows)>50,'page':page}

