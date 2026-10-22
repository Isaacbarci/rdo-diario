(() => {
 'use strict';
 let allowed,ownAllowed;
 const isAdmin=()=>allowed||(allowed=RDO.ready.then(()=>RDO.canDeleteCopies?RDO.canDeleteCopies():RDO.isAdmin()).catch(()=>false));
 window.RDOHistoryActions={async add(container,row,reload,message){
  const global=await isAdmin();
  if(!global){if(row.user_id!==RDO.user().id)return;ownAllowed=ownAllowed||(RDO.canDeleteOwnCopies?RDO.canDeleteOwnCopies():Promise.resolve(false)).catch(()=>false);if(!await ownAllowed)return;}
  const button=document.createElement('button');button.type='button';button.textContent='Excluir';button.style.cssText='background:#a52b35;margin:6px';button.disabled=!!row.pendente;
  button.onclick=async()=>{
   const dialog=document.createElement('dialog');dialog.style.cssText='max-width:460px;width:calc(100% - 32px);box-sizing:border-box;padding:24px;background:#14232f;color:#fff;border:1px solid #60788a;border-radius:12px;overflow-wrap:anywhere';
   const title=document.createElement('h2');title.textContent='Excluir cópia?';
   const name=document.createElement('p');name.textContent=row.nome_arquivo;
   const info=document.createElement('p');info.textContent='A cópia será removida do histórico e do armazenamento online. Os registros e atividades do RDO serão mantidos.';
   const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.type='button';
   const confirm=document.createElement('button');confirm.textContent='Excluir';confirm.type='button';confirm.style.cssText='background:#a52b35;color:white;margin:8px;padding:10px';
   cancel.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
   confirm.onclick=async()=>{confirm.disabled=true;cancel.disabled=true;dialog.oncancel=e=>e.preventDefault();button.disabled=true;try{await RDO.historyDelete(row.id);dialog.close();await reload();message.textContent='';}catch(e){dialog.close();await reload();message.textContent=e.message;}finally{button.disabled=false;}};
   dialog.append(title,name,info,cancel,confirm);document.body.append(dialog);dialog.showModal();cancel.focus();
  };container.append(button);
 }};
})();
