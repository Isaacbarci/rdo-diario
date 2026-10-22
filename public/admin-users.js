(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let page=1,busy=false,searchTerm='';
 function notice(text){$('users-message').textContent=text;}
 function checkbox(label,checked){const wrapper=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=checked;wrapper.append(input,document.createTextNode(label));return {wrapper,input};}
 function button(text,click){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;}
 function deletionDialog(user){
  const dialog=document.createElement('dialog');dialog.className='users-dialog';
  const title=document.createElement('h2');title.textContent='Excluir conta?';
  const info=document.createElement('p');info.textContent='A conta '+user.email+' será excluída deste projeto Supabase. Seus dados vinculados podem ser apagados. Arquivos ou vínculos existentes podem impedir a exclusão.';if($('users-management').dataset.sharedRdo==='true')info.textContent+=' Este banco é compartilhado com o Romaneio Teste; excluir a conta também afeta o acesso dela ao Romaneio Teste.';
  const label=document.createElement('label');label.textContent='Digite o e-mail para confirmar';const email=document.createElement('input');email.type='email';email.autocomplete='off';label.append(email);
  const error=document.createElement('p');error.setAttribute('role','status');
  const cancel=button('Cancelar',()=>dialog.close()),remove=button('Excluir conta',async()=>{
   if(email.value.trim().toLowerCase()!==user.email.toLowerCase()){error.textContent='Digite o e-mail completo da conta.';return;}
   remove.disabled=true;cancel.disabled=true;dialog.oncancel=e=>e.preventDefault();
   try{const result=await RDO.manageUsers({action:'delete',id:user.id,confirm_email:email.value});dialog.close();await load();notice(result.message);}catch(e){error.textContent=e.message;}finally{remove.disabled=false;cancel.disabled=false;dialog.oncancel=null;}
  });remove.className='danger';dialog.append(title,info,label,error,cancel,remove);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();cancel.focus();
 }
 function activationDialog(user){
  const activate=!!user.desativada,dialog=document.createElement('dialog');dialog.className='users-dialog';
  const title=document.createElement('h2');title.textContent=activate?'Reativar conta?':'Desativar conta?';
  const info=document.createElement('p');info.textContent=activate?'Permitir novamente o acesso de '+user.email+'?':'Bloquear novos acessos online de '+user.email+'? Os dados serão mantidos. Sessões já abertas podem permanecer até a renovação. O bloqueio não recolhe dados já disponíveis offline.';
  if($('users-management').dataset.sharedRdo==='true')info.textContent+=' Esta alteração também vale para o acesso ao Romaneio Teste neste banco.';
  const error=document.createElement('p');error.setAttribute('role','status');
  const cancel=button('Cancelar',()=>dialog.close()),confirm=button(activate?'Reativar conta':'Desativar conta',async()=>{
   confirm.disabled=true;cancel.disabled=true;dialog.oncancel=e=>e.preventDefault();
   try{const result=await RDO.manageUsers({action:'set_active',id:user.id,active:activate});dialog.close();await load();notice(result.message);}catch(e){error.textContent=e.message;}finally{confirm.disabled=false;cancel.disabled=false;dialog.oncancel=null;}
  });dialog.append(title,info,error,cancel,confirm);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();cancel.focus();
 }
 function render(user){
  const card=document.createElement('article');card.className='user-card';
  const name=document.createElement('h3');name.textContent=user.email||'Conta sem e-mail';card.append(name);
  if(user.principal){const badge=document.createElement('p');badge.textContent='Administradora principal · acesso total · conta protegida';card.append(badge);return card;}
  const status=document.createElement('p');status.textContent=user.desativada?'Conta desativada':user.email_confirmed_at?'Conta ativa · e-mail confirmado':'Conta ativa · e-mail ainda não confirmado';card.append(status);
  const view=checkbox('Ver histórico de todas as contas',user.ver_historico),own=checkbox('Excluir apenas as próprias cópias',user.excluir_proprias||user.excluir_copias),remove=checkbox('Excluir cópias de todas as contas',user.excluir_copias);
  view.input.onchange=()=>{if(!view.input.checked)remove.input.checked=false;};remove.input.onchange=()=>{if(remove.input.checked){view.input.checked=true;own.input.checked=true;}};
  own.input.onchange=()=>{if(!own.input.checked)remove.input.checked=false;};
  const result=document.createElement('p');result.setAttribute('role','status');
  const save=button('Salvar permissões',async()=>{save.disabled=true;try{const data=await RDO.manageUsers({action:'permissions',id:user.id,ver_historico:view.input.checked,excluir_copias:remove.input.checked,excluir_proprias:own.input.checked});result.textContent=data.message;}catch(e){result.textContent=e.message;}finally{save.disabled=false;}});
  const del=button('Excluir conta',()=>deletionDialog(user));del.className='danger';del.disabled=!user.email;const toggle=button(user.desativada?'Reativar conta':'Desativar conta',()=>activationDialog(user));toggle.disabled=!user.email;card.append(view.wrapper,own.wrapper,remove.wrapper,save,toggle,del,result);return card;
 }
 async function load(){
  if(busy)return;busy=true;$('users-prev').disabled=true;$('users-next').disabled=true;$('users-reload').disabled=true;$('users-search-button').disabled=true;$('users-search-clear').disabled=true;$('users-search-input').disabled=true;notice('Carregando usuários…');
  try{const data=await RDO.manageUsers(null,page,searchTerm);$('users-list').replaceChildren(...data.users.map(render));$('users-page').textContent='Página '+page;$('users-prev').disabled=page===1;$('users-next').disabled=!data.has_more;notice(data.users.length?'As permissões valem somente para o histórico deste RDO.':'Nenhuma conta encontrada.');}
  catch(e){notice(e.message);}finally{busy=false;$('users-reload').disabled=false;$('users-search-button').disabled=false;$('users-search-clear').disabled=false;$('users-search-input').disabled=false;}
 }
 window.RDOUsers={async mount(){
  if(!await RDO.isAdmin())return;
  $('users-management').hidden=false;
  $('users-create').onsubmit=async e=>{e.preventDefault();const submit=$('users-create-button');submit.disabled=true;notice('Criando conta…');try{const result=await RDO.manageUsers({action:'create',email:$('users-email').value,password:$('users-password').value});$('users-password').value='';$('users-email').value='';searchTerm='';$('users-search-input').value='';page=1;await load();notice(result.message);}catch(err){notice(err.message);}finally{submit.disabled=false;}};
  $('users-search').onsubmit=e=>{e.preventDefault();if(busy)return;searchTerm=$('users-search-input').value.trim();page=1;load();};
  $('users-search-clear').onclick=()=>{if(busy)return;$('users-search-input').value='';searchTerm='';page=1;load();};
  $('users-prev').onclick=()=>{if(!busy){page=Math.max(1,page-1);load();}};$('users-next').onclick=()=>{if(!busy){page++;load();}};$('users-reload').onclick=load;await load();
 }};
})();
