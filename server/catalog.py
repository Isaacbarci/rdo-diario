"""Leitura de catalogos MySQL; sem comandos de escrita no banco de origem."""
import datetime,decimal,hashlib,json,math,os,re,ssl,struct
from pathlib import Path
import pymysql
from pymysql.constants import CLIENT
from pymysql.constants import FIELD_TYPE

HERE=Path(__file__).resolve().parent
RULES=json.loads((HERE/'catalog_rules.json').read_text(encoding='utf-8'))
TABLES={'spool':'TB_STG_MAPA_SPOOLS','suporte':'TB_STG_MAPA_SUPORTE','materiais':'TB_STG_MAPA_ESTOQUE_MATERIAIS'}

class TLSConnection(pymysql.connections.Connection):
 def _request_authentication(self):
  if not self.server_capabilities & CLIENT.SSL:
   raise ConnectionError('O servidor precisa aceitar TLS antes da autenticacao.')
  return super()._request_authentication()

def connect(password=None):
 context=ssl.create_default_context(cafile=str(HERE/'mysql-server.pem'))
 # O servidor usa certificado proprio, sem nome DNS. A confianca e fixada
 # neste certificado exato, e nao em qualquer certificado autoassinado.
 context.check_hostname=False
 context.verify_flags |= ssl.VERIFY_X509_PARTIAL_CHAIN
 conn=TLSConnection(host=os.environ.get('MYSQL_HOST','186.202.152.83'),port=int(os.environ.get('MYSQL_PORT','3306')),
  user=os.environ.get('MYSQL_USER','zep_palmont'),password=password if password is not None else os.environ['MYSQL_PASSWORD'],
  database=os.environ.get('MYSQL_DATABASE','zep_palmont'),charset='utf8mb4',ssl=context,
  connect_timeout=12,read_timeout=90,write_timeout=15,cursorclass=pymysql.cursors.DictCursor,autocommit=False)
 if not isinstance(conn._sock,ssl.SSLSocket):
  conn.close();raise ConnectionError('TLS obrigatorio.')
 pinned=ssl.PEM_cert_to_DER_cert((HERE/'mysql-server.pem').read_text(encoding='ascii'))
 if hashlib.sha256(conn._sock.getpeercert(binary_form=True)).digest()!=hashlib.sha256(pinned).digest():
  conn.close();raise ConnectionError('Certificado diferente do servidor configurado.')
 return conn

def number(value):
 if value is None or value=='':return None
 try:
  n=float(value)
  return n if math.isfinite(n) else None
 except (ValueError,TypeError):return None

def round_even(value):
 n=number(value)
 return round(n,2) if n is not None else None

def round_up(value):
 n=number(value)
 return math.copysign(math.ceil(abs(n)*100)/100,n) if n is not None else None

def int_even(value):
 n=number(value)
 return round(n) if n is not None else None

def clean(value):
 if value is None:return ''
 if isinstance(value,(datetime.datetime,datetime.date)):return value.strftime('%d/%m/%Y')
 if isinstance(value,decimal.Decimal):return float(value)
 if isinstance(value,float) and not math.isfinite(value):return ''
 return value

REPLACE={'PLANTA DE E2G - VALE DO ROSÁRIO':'RAIZEN - VALE DO ROSÁRIO','PROJETO DA LINHA DE PICAGEM 5':'PATIO DE MADEIRA - BRACELL','EUCAFLUFF':'MAQUINA LIMEIRA - EUCAFLUFF','PROJETO MG-450':'INGREDION-MG-450'}
def service(value):
 result=str(value or '')
 for a,b in REPLACE.items():result=result.replace(a,b)
 return result

def spool(row):
 service_=service(row.get('SERVIÇO'))
 if service_ not in ['BOP','Cristalização','Evaporação','PLANTA DE E2G - GASA','RAIZEN - VALE DO ROSÁRIO','WLP']:return None
 if service_=='RAIZEN - VALE DO ROSÁRIO':return None
 service_=service_.replace('PLANTA DE E2G - GASA','RAIZEN - GASA')
 iso=str(row.get('ISOMÉTRICO') or '');s=str(row.get('SPOOL') or '')
 ident=s.split(' ')[-1].replace('SP','').replace(' ','').strip()
 if service_=='RAIZEN - GASA':ident=ident.lstrip('0')
 r={**row,'SERVIÇO':service_.replace('Evaporação','EVAP').replace('Cristalização','EVAP').replace('Gaseificação','WLP'),
  'DIÂM. NOMINAL':row.get('DIAMETRO'),'PESO':round_even(row.get('PESO')),'ÁREA SUPERF.':round_even(row.get('AREA_SUPERFICIE')),
  'DATA DO ROMANEIO':row.get('DATA ÚLTIMO ROM'),'OBS ROMANEIO':'','COR':row.get('COR_LINHA'),
  'QR':'Isometrico: '+iso.split(' ')[0]+' Spool: '+ident}
 return r

SUPPORT_RENAME={'SERVICO':'Serviço','Identificação':'Identificação 1','IDENTIFICACAO2':'Identificação 2','Prog Fab':'Prog. Fab.','INFORMACOES':'Informações','QTDE_ENVIADA':'Qtde Enviada','AREA_SUPERFICIE':'Área Superfície','ID_SISTEMA':'ID'}
def suporte(row):
 r={SUPPORT_RENAME.get(k,k):v for k,v in row.items()}
 if r.get('Localização')=='GK':return None
 s=service(r.get('Serviço'))
 if s not in ['BOP','Cristalização','Evaporação','Gaseificação','LOTES DE SUPORTES E DISPOSITIVOS','PLANTA DE E2G - GASA','RAIZEN - VALE DO ROSÁRIO','WLP']:return None
 r['Serviço']=s.replace('PLANTA DE E2G - GASA','RAIZEN - GASA').replace('Evaporação','EVAP').replace('Cristalização','EVAP Cristalização').replace('Gaseificação','WLP Gaseificação')
 qty=number(r.get('Qtde'));sent=number(r.get('Qtde Enviada'))
 r['Saldo']=int_even(qty-sent) if qty is not None and sent is not None else ''
 weight=round_up(r.get('Peso (Kg)'));area=round_up(r.get('Área Superfície'))
 r.update({'Qtde':int_even(qty),'Qtde Enviada':int_even(sent),'Peso (Kg)':weight,'Área Superfície':area,'PESO TOTAL':weight,'ÁREA M² TOTAL':area,
  'PESO Unitário':weight/qty if weight is not None and qty else '', 'AREA M² Unitário':area/qty if area is not None and qty else '',
  'DATA DO ROMANEIO':'','QTD ENVIADA':'','OBS ROMANEIO':'','PESO ENVIADO':'','ÁREA ENVIADA':''})
 digits=re.sub(r'[^0-9]','',str(r.get('Identificação 1') or ''))
 r['QR']='2$'+str(r.get('Posição / TAG') or '')+'$ID-'+(str(int(digits)) if digits else '-')
 return r

NPS=['1/8','1/4','3/8','1/2','3/4','1','1 1/4','1 1/2','2','2 1/2','3','3 1/2','4','5','6','8','10','12','14','16','18','20','24','26','28','30','32','36','40','42','44']
def diameter(text):
 if text is None:return ''
 t=str(text).replace('×','x').replace('\xa0',' ').replace('“','"').replace('”','"').replace('″','"').replace(' X ',' x ')
 t=re.sub(r'\b([1-9]|[1-3][0-9]|40)\.(1/2|1/4|3/4)',r'\1 \2',t)
 parts=[p for p in re.split(r'[\s,;:()\[\]{}|+\-xX]+',t) if p];found=[]
 for i,token in enumerate(parts):
  if not token.endswith('"'):continue
  value=parts[i-1]+' '+token if i>0 and parts[i-1].isdigit() and '/' in token else token
  if value[:-1] in NPS and value not in found:found.append(value)
 result=' x '.join(found[:2])
 for v in ['1 1/2','2 1/2','1 1/4','3 1/2']:result=result.replace(v+'"',v.replace(' ','.')+'"')
 return result

def materiais(row):
 if row.get('DISCIPLINA') not in ['Caldeiraria','Tubulação']:return None
 if row.get('CLIENTE') in ['Andritz - Project Tissue Machine - Bracell Lençóis Paulista-SP','CENIBRA','NOURYON','Andritz - Maquina de Papel - Suzano Limeira-SP','BRACELL - Lençóis Paulista-SP','INGREDION']:return None
 r=dict(row);r['DN']=diameter(row.get('DESCRICAO'))
 table=RULES['materiais'].get('dnTable',[])
 dn_map={str(x[0]):x[1] for x in table[1:] if len(x)>1}
 r['Tabela1.DN mm']=dn_map.get((r['DN'].split('"')[0]+'"') if r['DN'] else '"','')
 for key in ['SALDOGERAL','QTDEENTRADA','QTDECADASTRADA','SAIDA','RESERVADO','PESO_CAD','PESO']:r[key]=int_even(r.get(key))
 r['PESO TOTAL']=r['PESO']*r['SALDOGERAL'] if r.get('PESO') is not None and r.get('SALDOGERAL') is not None else ''
 return r

TRANSFORM={'spool':spool,'suporte':suporte,'materiais':materiais}
# Busca apenas os campos usados pelas mesmas regras das planilhas originais.
SOURCE_FIELDS={
 'spool':['SERVIÇO','ISOMÉTRICO','SPOOL','ÁREA','REV','MATERIAL','PROG FAB','EXECUTANTE FAB','PESO','AREA_SUPERFICIE','LINHA','COND PINT','DIAMETRO','DATA ÚLTIMO ROM','COR_LINHA','ID_SPOOL','ROMANEIOS','STATUS','CORTE/BISEL'],
 'suporte':['SERVICO','Posição / TAG','Identificação','IDENTIFICACAO2','REV','Prog Fab','Desenho Suporte','INFORMACOES','Tipo de Suporte','Tipo Estrutura','Linha','Qtde','QTDE_ENVIADA','Peso (Kg)','AREA_SUPERFICIE','Número Romaneio','Data Romaneio','Localização','Status','Observação','ID_SISTEMA'],
 'materiais':[h for h in RULES['materiais']['headers'] if h not in ('DN','Tabela1.DN mm','PESO TOTAL')]
}
SOURCE_FILTERS={
 'spool':('SERVIÇO',['BOP','Cristalização','Evaporação','PLANTA DE E2G - GASA','WLP']),
 'suporte':('SERVICO',['BOP','Cristalização','Evaporação','Gaseificação','LOTES DE SUPORTES E DISPOSITIVOS','PLANTA DE E2G - GASA','PLANTA DE E2G - VALE DO ROSÁRIO','WLP']),
 'materiais':('DISCIPLINA',['Caldeiraria','Tubulação'])
}

def read_catalog(module,password=None):
 if module not in TABLES:raise ValueError('Modulo invalido')
 connection=connect(password)
 try:
  with connection.cursor() as cur:
   cur.execute('SET TRANSACTION READ ONLY')
   connection.begin()
   field,values=SOURCE_FILTERS[module]
   sql='SELECT '+','.join('`'+h+'`' for h in SOURCE_FIELDS[module])+' FROM `'+TABLES[module]+'` WHERE `'+field+'` IN ('+','.join(['%s']*len(values))+')'
   cur.execute(sql,tuple(values))
   float32_fields=[c[0] for c in cur.description if c[1]==FIELD_TYPE.FLOAT]
   rows=[];headers=RULES[module]['headers'];ids=set()
   for source in cur.fetchall():
    # O conector do Excel le FLOAT como IEEE-754 de 32 bits. Reconstituir
    # esses valores preserva Round/RoundUp das consultas Power Query.
    for key in float32_fields:
     if source.get(key) is not None:source[key]=struct.unpack('<f',struct.pack('<f',source[key]))[0]
    row=TRANSFORM[module](source)
    if row is None:continue
    row={key:clean(row.get(key)) for key in headers}
    idkey='ID_SPOOL' if module=='spool' else 'ID'
    id_=str(row.get(idkey,''))
    if not id_ or id_ in ids:raise ValueError('Identificacao ausente ou repetida na base')
    ids.add(id_)
    rows.append(row)
   rows.sort(key=lambda r:str(r['ID_SPOOL' if module=='spool' else 'ID']))
  if not rows:raise ValueError('Base vazia: a ultima base sera preservada')
  payload={'module':module,'headers':headers,'rows':rows,'kind':'objects'}
  payload['version']=hashlib.sha256(json.dumps(payload,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()).hexdigest()
  payload['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
  return payload
 finally:
  connection.rollback();connection.close()
