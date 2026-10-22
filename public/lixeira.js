document.addEventListener('DOMContentLoaded',async()=>{
 const api=RDO,$=id=>document.getElementById(id);let page=1,busy=false,emptying=false;
 const fmt=v=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 async function load(){if(busy||emptying)return;busy=true;$('empty-trash').disabled=true;$('prev').disabled=$('next').disabled=true;$('message').textContent='Carregando…';
 try{const data=await api.manageTrash(null,page,$('search').value.trim());$('files').replaceChildren();
 for(const row of data.files){const card=document.createElement('article'),name=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');name.textContent=row.nome_arquivo||row.nome;
 info.textContent=[row.responsavel||row.autor_email,'Excluído em '+fmt(row.excluido_em),'Restaurar até '+fmt(new Date(new Date(row.excluido_em).getTime()+30*86400000))].filter(Boolean).join(' · ');
 button.textContent=row.eliminacao_em?'Exclusão pendente':'Restaurar';button.disabled=!!row.eliminacao_em;button.onclick=async()=>{button.disabled=true;try{await api.manageTrash({action:'restore',id:row.id});await load();}catch(e){$('message').textContent=e.message;button.disabled=false;}};
 card.append(name,info,button);$('files').append(card);}
 $('message').textContent=data.files.length?'':'Lixeira vazia.';$('page').textContent='Página '+page;$('prev').disabled=page===1;$('next').disabled=!data.has_more;
 }catch(e){$('message').textContent=e.message;}finally{busy=false;$('empty-trash').disabled=false;}}
 $('empty-trash').onclick=()=>{
  if(busy||emptying)return;
  const dialog=document.createElement('dialog');dialog.style.cssText='background:#14232f;color:white;border:1px solid #60788a;border-radius:12px;padding:24px;max-width:460px;width:calc(100% - 32px)';
  const title=document.createElement('h2'),text=document.createElement('p'),input=document.createElement('input'),cancel=document.createElement('button'),confirm=document.createElement('button');
  title.textContent='Esvaziar lixeira?';text.textContent='Todos os arquivos da lixeira serão apagados definitivamente, inclusive os que não aparecem na pesquisa. Digite ESVAZIAR para confirmar.';
  input.placeholder='ESVAZIAR';input.setAttribute('aria-label','Digite ESVAZIAR para confirmar');input.autocomplete='off';input.style.cssText='width:100%;margin:12px 0';
  cancel.textContent='Cancelar';confirm.textContent='Esvaziar definitivamente';confirm.style.cssText='background:#a52b35;margin:8px 0 0 8px';confirm.disabled=true;
  input.oninput=()=>confirm.disabled=input.value.trim()!=='ESVAZIAR';cancel.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  confirm.onclick=async()=>{
   if(input.value.trim()!=='ESVAZIAR')return;dialog.close();emptying=true;$('empty-trash').disabled=true;$('files').querySelectorAll('button').forEach(b=>b.disabled=true);$('message').textContent='Esvaziando lixeira…';
   try{let more;do{const result=await api.manageTrash({action:'empty',confirm:'ESVAZIAR'});more=result.has_more;}while(more);emptying=false;page=1;await load();}
   catch(e){emptying=false;await load();$('message').textContent=e.message+' Use Esvaziar lixeira novamente para concluir.';}
   finally{$('empty-trash').disabled=false;}
  };
  dialog.append(title,text,input,cancel,confirm);document.body.append(dialog);dialog.showModal();cancel.focus();
 };
 $('search-form').onsubmit=e=>{e.preventDefault();if(!busy&&!emptying){page=1;load();}};$('clear').onclick=()=>{if(!busy&&!emptying){$('search').value='';page=1;load();}};$('prev').onclick=()=>{if(!busy&&!emptying){page=Math.max(1,page-1);load();}};$('next').onclick=()=>{if(!busy&&!emptying){page++;load();}};
 try{await api.ready;if(!await api.isAdmin())throw Error('Somente a conta administradora principal pode acessar a lixeira.');$('empty-trash').hidden=false;await load();}catch(e){$('message').textContent=e.message;}
});