(() => {
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const generatedDay=value=>{const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const part=type=>parts.find(p=>p.type===type).value;return part('year')+'-'+part('month')+'-'+part('day');};
 function matches(file,filters){const day=generatedDay(file.criado_em);return normalize(file.nome).includes(normalize(filters.name))&&normalize(file.equipe||file.nome).includes(normalize(filters.team))&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);}
 document.addEventListener('DOMContentLoaded',async()=>{
  const $=id=>document.getElementById(id),message=$('message'),inputs=['search-name','search-team','date-from','date-to'];
  try{
   await RDO.ready;const files=await RDO.history();
   const render=()=>{
    const filters={name:$('search-name').value.trim(),team:$('search-team').value.trim(),from:$('date-from').value,to:$('date-to').value};
    $('files').replaceChildren();if(filters.from&&filters.to&&filters.from>filters.to){message.textContent='A data inicial deve ser anterior ou igual à data final.';return;}
    const found=files.filter(file=>matches(file,filters));message.textContent=found.length+' de '+files.length+' arquivo(s).';
    if(!found.length){message.textContent='Nenhum arquivo encontrado.';return;}
    for(const file of found){
     const item=document.createElement('article'),name=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');name.textContent=file.nome;
     info.textContent=[new Date(file.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),file.equipe,file.turno?file.turno+'º turno':'',file.autor_email].filter(Boolean).join(' · ');button.textContent='Baixar cópia';
     button.onclick=async()=>{button.disabled=true;try{await RDO.historyDownload(file);}catch(e){message.textContent=e.message;}finally{button.disabled=false;}};
     item.append(name,info,button);$('files').append(item);
    }
   };
   inputs.forEach(id=>$(id).addEventListener('input',render));$('clear-filters').onclick=()=>{inputs.forEach(id=>$(id).value='');render();};render();
  }catch(e){message.textContent=e.message;}
 });
})();
