(() => {
 'use strict';
 let rows=[],legacy=new Map(),selected=new Map(),locked=new Set(),booked=new Map(),records=[],recordId=null,page=0,loaded=false,viewingSaved=false;
 const size=15,$=id=>document.getElementById(id),text=v=>String(v??'').trim(),id=r=>text(r.ID_SPOOL),lot=r=>text(r['PROG FAB']);
 const format=d=>d?d.split('-').reverse().join('/'):'',report=m=>{$('ap-message').textContent=m;};
 function cutDate(value){
  if(value instanceof Date)return Number.isNaN(+value)?'':value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');
  if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);return d?cutDate(String(d.y)+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0')):'';}
  const v=text(value),iso=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/),br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:$|\s)/);
  const result=iso?iso[1]+'-'+iso[2]+'-'+iso[3]:br?br[3]+'-'+br[2]+'-'+br[1]:'';
  if(!result)return '';const d=new Date(result+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===result?result:'';
 }
 function sourcePoint(row){const data=cutDate(row['CORTE/BISEL']);return data?{data,observacao:'',origem:'mysql'}:null;}
 function rebuildBooked(){booked=new Map();for(const r of records){if(r.id===recordId)continue;for(const p of r.apontamentos||[])booked.set(String(p.spoolId),{...p,origem:'outro-rdo'});}}
 function otherPoint(row){
  if(booked.has(id(row)))return booked.get(id(row));
  const old=legacy.get(id(row));return old&&!old.limpo?{...old,origem:'anterior'}:null;
 }
 function pointFor(row){const own=selected.get(id(row));return sourcePoint(row)||(own?(locked.has(id(row))?{...own,origem:'salvo'}:own):null)||otherPoint(row);}
 function options(select,values){const previous=select.value;select.replaceChildren(new Option('Todos',''));for(const value of [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})))select.add(new Option(value,value));if(values.includes(previous))select.value=previous;}
 function scope(){const service=$('ap-service').value,lote=$('ap-lot').value,q=$('ap-search').value.trim().toLocaleLowerCase();return rows.filter(r=>(!service||text(r['SERVIÇO'])===service)&&(!lote||lot(r)===lote)&&(!q||[r['ISOMÉTRICO'],r.ID_SPOOL].some(v=>text(v).toLocaleLowerCase().includes(q))));}
 function matching(){const status=$('ap-status').value;return scope().filter(r=>status==='all'||(status==='selected'?selected.has(id(r)):status==='done'?Boolean(pointFor(r)?.origem):!pointFor(r)?.origem));}
 function render(){
  if(!$('ap-table'))return;const filtered=matching(),pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);const body=$('ap-table').tBodies[0];body.replaceChildren();
  for(const row of filtered.slice(page*size,(page+1)*size)){
   const point=pointFor(row),mine=selected.has(id(row)),tr=document.createElement('tr');if(point)tr.className='ap-done';
   for(const [i,value] of [lot(row),row['ISOMÉTRICO'],row.SPOOL+' · ID '+id(row),format(point?.data)].entries()){const td=document.createElement('td');td.dataset.label=['Lote','Isométrico','Spool / ID','Data do apontamento'][i];td.textContent=text(value);tr.append(td);}
   const td=document.createElement('td');
   if(point?.origem){const badge=document.createElement('span');badge.className='ap-badge';badge.textContent='Apontado';badge.title=point.origem==='mysql'?'Data de CORTE/BISEL no MySQL':point.origem==='salvo'?'Atividade salva neste RDO. Abra Editar para retirar.':point.origem==='outro-rdo'?'Vinculado a outro RDO da sua conta':'Apontamento anterior preservado';td.append(badge);}
   else{const label=document.createElement('label'),check=document.createElement('input'),caption=document.createElement('span');label.className='ap-check';check.type='checkbox';check.checked=mine;check.disabled=!loaded||viewingSaved;check.setAttribute('aria-label','Selecionar spool '+row.SPOOL+' ID '+id(row));caption.textContent=mine?'Selecionado':'Selecionar';
    check.onchange=()=>{if(check.checked){const data=cutDate($('f-data').value);if(!data){check.checked=false;report('Escolha a data do RDO antes de selecionar o spool.');$('f-data').focus();return;}selected.set(id(row),{spoolId:id(row),data,observacao:'',snapshot:{...row}});}else selected.delete(id(row));changed();report('Seleção atualizada. Salve o RDO para gravar as atividades.');};
    label.append(check,caption);td.append(label);
   }
   tr.append(td);body.append(tr);
  }
  const all=scope(),done=all.filter(r=>pointFor(r)?.origem).length;$('ap-total').textContent=all.length;$('ap-done').textContent=done;$('ap-pending').textContent=all.length-done;
  $('ap-selected-count').textContent=selected.size+' neste RDO';$('ap-prev').disabled=page===0;$('ap-next').disabled=page>=pages-1;
  $('ap-count').textContent=filtered.length+' spool(s) · página '+(page+1)+' de '+pages;
 }
 function changed(){render();window.dispatchEvent(new Event('rdo-activities-change'));}
 function syncDate(){for(const point of selected.values())point.data=$('f-data').value;changed();}
 function read(){return [...selected.values()].map(p=>({...p,data:$('f-data').value,snapshot:{...p.snapshot}}));}
 function setRecord(r,viewOnly=false){recordId=r.id||null;viewingSaved=Boolean(viewOnly&&recordId);selected=new Map((r.apontamentos||[]).map(p=>[String(p.spoolId),{...p,data:r.data||$('f-data').value}]));locked=viewOnly?new Set(selected.keys()):new Set();rebuildBooked();page=0;render();report('');}
 function validate(){
  if(!selected.size)return null;
  for(const point of selected.values()){
   if(!cutDate($('f-data').value))return 'Informe uma data válida para o RDO.';
   const row=rows.find(r=>id(r)===String(point.spoolId))||point.snapshot;
   if(!row||!loaded)return 'Aguarde o carregamento da lista de spools antes de salvar.';
   if(otherPoint(row))return 'O spool '+row.SPOOL+' já está apontado fora deste RDO. Retire-o das atividades antes de salvar.';
  }
  return null;
 }
 async function load(){
  try{
   await RDO.ready;report('Carregando a lista de spools…');let catalog;
   try{catalog=await RDO.catalog();$('ap-source').textContent='Base MySQL · '+new Date(catalog.checkedAt).toLocaleString('pt-BR');}
   catch(e){const response=await fetch('Spools.xlsx');if(!response.ok)throw e;const wb=XLSX.read(await response.arrayBuffer(),{type:'array',cellDates:true});catalog={rows:XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})};$('ap-source').textContent='Base inicial da planilha';}
   if(!catalog.rows.length||catalog.rows.some(r=>!id(r))||new Set(catalog.rows.map(id)).size!==catalog.rows.length)throw Error('A base precisa conter IDs únicos dos spools.');
   const old=await RDO.list('rdo_apontamentos');legacy=new Map(old.map(r=>[String(r.spool_id),r.conteudo]));rows=catalog.rows;loaded=true;
   options($('ap-service'),rows.map(r=>text(r['SERVIÇO'])));options($('ap-lot'),rows.map(lot));render();report('');
  }catch(e){report(e.message);}
 }
 window.RDOApontamento={read,setRecord,setRecords(value){records=value||[];rebuildBooked();render();},validate,matching};
 function start(){
  records=window.RDOActivityRecords||[];setRecord(window.RDOActivityRecord||{},Boolean(window.RDOActivityRecord?.viewOnly));
  $('ap-service').onchange=()=>{options($('ap-lot'),rows.filter(r=>!$('ap-service').value||text(r['SERVIÇO'])===$('ap-service').value).map(lot));page=0;render();};
  for(const name of ['ap-lot','ap-status'])$(name).onchange=()=>{page=0;render();};let timer;$('ap-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=0;render();},180);};
  $('ap-prev').onclick=()=>{page--;render();};$('ap-next').onclick=()=>{page++;render();};
  $('f-data').addEventListener('input',syncDate);$('f-data').addEventListener('change',syncDate);
  load();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
