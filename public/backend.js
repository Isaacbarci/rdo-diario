(() => {
 'use strict';
 let config,session,key,refreshing;const loginPage=location.pathname.endsWith('/login.html');
 const change=()=>window.dispatchEvent(new Event('rdo-change'));
 const user=()=>{if(!session?.user?.id)throw Error('Entre na sua conta.');return session.user;};
 function remember(value){session=value;if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}
 async function request(path,options={},token){
  let response;try{response=await fetch(config.supabaseUrl+path,{...options,cache:'no-store',signal:AbortSignal.timeout(20000),headers:{apikey:config.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...options.headers}});}catch(_){throw Error('Não foi possível conectar. Seus dados preenchidos permanecem neste aparelho.');}
  const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch(_){value=null;}
  if(!response.ok){const e=Error(value?.message||value?.msg||value?.error_description||'Não foi possível concluir.');e.status=response.status;throw e;}return value;
 }
 async function token(){
  if(!session?.access_token)throw Error('Entre na sua conta.');
  if((session.expires_at||0)*1000<Date.now()+60000){
   if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})}).then(s=>{remember({...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)});return s;}).catch(e=>{if(e.status===400||e.status===401){remember(null);location.replace('login.html');}throw e;}).finally(()=>refreshing=null);
   await refreshing;
  }return session.access_token;
 }
 async function rest(path,options={}){await api.ready;return request('/rest/v1/'+path,options,await token());}
 const validTables=new Set(['rdo_registros','rdo_semanas','rdo_apontamentos']);
 async function list(table){if(!validTables.has(table))throw Error('Tabela inválida.');const all=[];for(let offset=0;;offset+=500){const part=await rest(table+'?select=*&order=id&offset='+offset+'&limit=500');all.push(...part);if(part.length<500)return all;}}
 async function save(table,id,conteudo){
  if(!validTables.has(table))throw Error('Tabela inválida.');const row={id,user_id:user().id,conteudo};
  if(table==='rdo_apontamentos'){row.spool_id=String(conteudo.spoolId);row.data_apontamento=conteudo.data;}
  await rest(table+'?on_conflict=user_id,id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});change();return id;
 }
 async function remove(table,id){if(!validTables.has(table))throw Error('Tabela inválida.');await rest(table+'?id=eq.'+encodeURIComponent(id),{method:'DELETE'});change();}
 function localKey(name){return 'rdo.'+config.supabaseUrl+'.'+user().id+'.'+name;}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 const api={
  ready:null,user,rest,list,save,remove,
  async login(email,password){await api.ready;const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});remember({...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)});},
  async signup(email,password){await api.ready;return request('/auth/v1/signup?redirect_to='+encodeURIComponent(new URL('login.html',location.href).href),{method:'POST',body:JSON.stringify({email,password})});},
  async recover(email){await api.ready;return request('/auth/v1/recover?redirect_to='+encodeURIComponent(new URL('login.html',location.href).href),{method:'POST',body:JSON.stringify({email})});},
  async password(password){await api.ready;return request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password})},await token());},
  async logout(){try{await request('/auth/v1/logout',{method:'POST'},session?.access_token);}finally{remember(null);location.replace('login.html');}},
  draftGet(name){try{return JSON.parse(localStorage.getItem(localKey(name))||'null');}catch(_){return null;}},
  draftSet(name,value){localStorage.setItem(localKey(name),JSON.stringify(value));},draftRemove(name){localStorage.removeItem(localKey(name));},
  async catalog(){
   await api.ready;const response=await fetch('/api/catalogo?modulo=spool',{cache:'no-store',signal:AbortSignal.timeout(65000),headers:{Authorization:'Bearer '+await token()}});
   if(!response.ok)throw Error('Não foi possível atualizar a base pelo MySQL.');const value=await response.json();if(value.module!=='spool'||!value.rows?.length)throw Error('Base de spools inválida.');return value;
  },
  async exportFile({blob,name,type,items=0}){
   await api.ready;const id=crypto.randomUUID(),owner=user().id,path=owner+'/'+id+(name.endsWith('.xlsx')?'.xlsx':'.html');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
   if(blob.size>20971520)throw Error('O arquivo ultrapassou 20 MB.');
   await request('/storage/v1/object/rdo-arquivos/'+path,{method:'POST',headers:{'Content-Type':blob.type,'x-upsert':'false'},body:blob},await token());
   await rest('rdo_arquivos',{method:'POST',body:JSON.stringify({id,user_id:owner,tipo:type,nome:name,caminho:path,tamanho:blob.size,sha256:hash,itens:items})});
   download(blob,name);
  },
  async history(){const all=[];for(let offset=0;;offset+=500){const part=await rest('rdo_arquivos?select=*&order=criado_em.desc,id&offset='+offset+'&limit=500');all.push(...part);if(part.length<500)return all;}},
  async historyDownload(row){const response=await fetch(config.supabaseUrl+'/storage/v1/object/authenticated/rdo-arquivos/'+row.caminho,{cache:'no-store',headers:{apikey:config.supabaseKey,Authorization:'Bearer '+await token()}});if(!response.ok)throw Error('Não foi possível baixar a cópia.');const blob=await response.blob(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(blob.size!==row.tamanho||hash!==row.sha256)throw Error('A integridade do arquivo não pôde ser confirmada.');download(blob,row.nome);},
  adapter(){
   const document=path=>({set:async value=>{const parts=path.split('/');if(parts[0]==='rdo'&&parts.length===2)return;if(parts[0]==='rdo'&&parts.length===4&&parts[1]===user().id)return save('rdo_registros',parts[3],value);if(parts[0]==='semanas')return save('rdo_semanas',parts[1],value);throw Error('Registro inválido.');},delete:async()=>{const parts=path.split('/');if(parts[0]==='semanas')return remove('rdo_semanas',parts[1]);if(parts[0]==='rdo'&&parts[1]===user().id)return remove('rdo_registros',parts[3]);throw Error('Registro inválido.');}});
   return {doc:document,collection:path=>({doc:id=>document(path+'/'+id),add:async value=>{if(path!=='rdo/'+user().id+'/itens')throw Error('Conta incorreta.');const id=crypto.randomUUID();await save('rdo_registros',id,value);return {id};}})};
  }
 };
 window.RDO=api;
 api.ready=(async()=>{
  config=await(await fetch('config.json',{cache:'no-store'})).json();if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)||!config.supabaseKey)throw Error('Configure o projeto Supabase em public/config.json.');
  key='rdo.auth.'+config.supabaseUrl;try{session=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.get('access_token')){const access=hash.get('access_token'),u=await request('/auth/v1/user',{},access);remember({access_token:access,refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600),user:u});if(hash.get('type')==='recovery')sessionStorage.setItem('rdo.recovery','1');history.replaceState(null,'',location.pathname);}
  if(loginPage)return;
  if(!session){location.replace('login.html');return new Promise(()=>{});}
  const u=await request('/auth/v1/user',{},await token());remember({...session,user:u});
 })();
 api.ready.catch(e=>{const box=document.getElementById('status')||document.getElementById('message');if(box){box.hidden=false;box.textContent=e.message;}});
 window.addEventListener('storage',event=>{if(event.key===key&&!loginPage)location.replace('login.html');});
})();

