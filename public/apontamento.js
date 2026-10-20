(() => {
 'use strict';
 let rows=[],saved=new Map(),page=0,loading=null,loaded=false,current=null;const size=100;
 const $=id=>document.getElementById(id),text=v=>String(v??'').trim();
 const id=row=>text(row.ID_SPOOL),lot=row=>text(row['PROG FAB']);
 const format=date=>date?date.split('-').reverse().join('/'):'';
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const report=message=>$('ap-message').textContent=message;
 function options(select,values){const previous=select.value;select.replaceChildren(new Option('Todos',''));for(const value of [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})))select.add(new Option(value,value));if(values.includes(previous))select.value=previous;}
 function cutDate(value){
  if(value instanceof Date)return Number.isNaN(+value)?'':value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0');
  if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);return d?cutDate(String(d.y)+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0')):'';}
  const v=text(value),iso=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/),br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:$|\s)/);
  const result=iso?iso[1]+'-'+iso[2]+'-'+iso[3]:br?br[3]+'-'+br[2]+'-'+br[1]:'';
  if(!result)return '';const d=new Date(result+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===result?result:'';
 }
 function pointFor(row){const data=cutDate(row['CORTE/BISEL']);if(data)return {data,observacao:'',origem:'mysql'};const own=saved.get(id(row));return own&&!own.limpo?own:null;}
 function matching(){const service=$('ap-service').value,lote=$('ap-lot').value,q=$('ap-search').value.trim().toLocaleLowerCase(),only=$('ap-only').checked;return rows.filter(r=>(!service||text(r['SERVIÇO'])===service)&&(!lote||lot(r)===lote)&&(!only||Boolean(pointFor(r)))&&(!q||[r['ISOMÉTRICO'],r.SPOOL,r.QR].some(v=>text(v).toLocaleLowerCase().includes(q))));}
 function render(){
  const filtered=matching(),pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);const body=$('ap-table').tBodies[0];body.replaceChildren();
  for(const row of filtered.slice(page*size,(page+1)*size)){
   const point=pointFor(row),tr=document.createElement('tr');if(point)tr.className='ap-done';
   for(const value of [lot(row),row['ISOMÉTRICO'],row.SPOOL,format(point?.data),point?.observacao]){const td=document.createElement('td');td.textContent=text(value);tr.append(td);}
   if(point?.origem==='mysql'){const td=document.createElement('td');td.textContent='Apontado';tr.append(td);body.append(tr);continue;}
   const td=document.createElement('td'),actions=document.createElement('div'),button=document.createElement('button');actions.className='row';button.type='button';button.className='btn ghost';button.textContent=point?'Editar':'Apontar';button.onclick=()=>open(row);actions.append(button);
   if(point){const clear=document.createElement('button');clear.type='button';clear.className='btn ghost';clear.textContent='Limpar';clear.setAttribute('aria-label','Limpar apontamento de '+row['ISOMÉTRICO']+' '+row.SPOOL);clear.onclick=()=>clearPoint(row,button,clear);actions.append(clear);}
   td.append(actions);tr.append(td);body.append(tr);
  }
  $('ap-prev').disabled=page===0;$('ap-next').disabled=page>=pages-1;
  $('ap-count').textContent=filtered.length+' spool(s) · '+filtered.filter(r=>Boolean(pointFor(r))).length+' apontado(s) · página '+(page+1)+' de '+pages;
 }
 async function clearPoint(row,editButton,clearButton){
  if(!window.confirm('Limpar a data e a observação do spool '+row.SPOOL+' ('+row['ISOMÉTRICO']+')? As cópias já geradas serão mantidas.'))return;
  editButton.disabled=clearButton.disabled=true;
  try{await RDO.save('rdo_apontamentos',id(row),{spoolId:id(row),data:today(),observacao:'',limpo:true});saved.set(id(row),{limpo:true});RDO.draftRemove('apont-'+id(row));render();report('Apontamento removido. O spool pode ser apontado novamente.');}
  catch(e){report('Não foi possível limpar o apontamento. '+e.message);}
  finally{editButton.disabled=clearButton.disabled=false;}
 }
 function open(row){current=row;const point=pointFor(row),draft=RDO.draftGet('apont-'+id(row));$('ap-item').textContent='Lote '+lot(row)+' · '+row['ISOMÉTRICO']+' · '+row.SPOOL;$('ap-date').value=draft?.data||point?.data||today();$('ap-notes').value=draft?.observacao??point?.observacao??'';$('ap-error').textContent='';$('ap-dialog').showModal();}
 async function reloadPoints(){const records=await RDO.list('rdo_apontamentos');saved=new Map(records.map(r=>[String(r.spool_id),r.conteudo]));if(loaded)render();}
 async function load(){
  if(loading)return loading;if(loaded){render();return;}
  loading=(async()=>{
   try{
    await RDO.ready;report('Carregando a lista de spools…');let catalog;
    try{catalog=await RDO.catalog();$('ap-source').textContent='Base MySQL · '+new Date(catalog.checkedAt).toLocaleString('pt-BR');}
    catch(e){const response=await fetch('Spools.xlsx');if(!response.ok)throw e;const wb=XLSX.read(await response.arrayBuffer(),{type:'array',cellDates:true});catalog={rows:XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})};$('ap-source').textContent='Base inicial da planilha';report(e.message+' Usando a planilha inicial.');}
    rows=catalog.rows;if(!rows.length||rows.some(r=>!id(r)))throw Error('Base sem identificação dos spools.');
    if(new Set(rows.map(id)).size!==rows.length)throw Error('A base possui identificações repetidas.');
    options($('ap-service'),rows.map(r=>text(r['SERVIÇO'])));options($('ap-lot'),rows.map(lot));await reloadPoints();loaded=true;render();if(!$('ap-source').textContent.includes('inicial'))report('');
   }catch(e){report(e.message);}finally{loading=null;}
  })();return loading;
 }
 function exportRows(){return matching().filter(r=>Boolean(pointFor(r))).map(row=>{const point=pointFor(row),out={};for(const [key,value] of Object.entries(row)){if(['DATA DO ROMANEIO','OBS ROMANEIO','ROMANEIOS','QR'].includes(key))continue;out[key==='PROG FAB'?'Lote':key]=value;}out['Data do apontamento']=format(point.data);out['Observação do apontamento']=point.observacao||'';out['Responsável (e-mail)']=point.origem==='mysql'?'':RDO.user().email;return out;});}
 // Mantido separado para verificar o Excel com os mesmos dados exibidos no filtro.
 window.RDOApontamento={exportRows,matching};
 function start(){
  $('ap-service').onchange=()=>{options($('ap-lot'),rows.filter(r=>!$('ap-service').value||text(r['SERVIÇO'])===$('ap-service').value).map(lot));page=0;render();};
  for(const name of ['ap-lot','ap-only'])$(name).onchange=()=>{page=0;render();};let searchTimer;$('ap-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;render();},200);};
  $('ap-prev').onclick=()=>{page--;render();};$('ap-next').onclick=()=>{page++;render();};$('ap-cancel').onclick=()=>$('ap-dialog').close();
  $('ap-form').oninput=()=>{if(current)RDO.draftSet('apont-'+id(current),{data:$('ap-date').value,observacao:$('ap-notes').value});};
  $('ap-form').onsubmit=async e=>{
   e.preventDefault();if(!current||!$('ap-form').reportValidity())return;$('ap-save').disabled=true;
   try{const row=current,point={spoolId:id(row),data:$('ap-date').value,observacao:$('ap-notes').value.trim(),snapshot:row};await RDO.save('rdo_apontamentos',id(row),point);RDO.draftRemove('apont-'+id(row));saved.set(id(row),point);$('ap-dialog').close();render();report('Apontamento salvo.');}catch(e){$('ap-error').textContent=e.message;}finally{$('ap-save').disabled=false;}
  };
  $('ap-export').onclick=async()=>{
   const button=$('ap-export');button.disabled=true;
   try{await reloadPoints();const data=exportRows();if(!data.length)throw Error('Não há apontamentos nos filtros selecionados.');const wb=XLSX.utils.book_new(),sheet=XLSX.utils.json_to_sheet(data);sheet['!cols']=Object.keys(data[0]).map(k=>({wch:k.includes('Observação')?45:k==='ISOMÉTRICO'?45:20}));XLSX.utils.book_append_sheet(wb,sheet,'Apontamentos');await RDO.exportFile({blob:new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name:'Apontamentos_'+today()+'.xlsx',type:'apontamento_excel',items:data.length});report('Excel gerado e cópia guardada.');}catch(e){report(e.message);}finally{button.disabled=false;}
  };
  window.addEventListener('rdo-open-apont',load);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
