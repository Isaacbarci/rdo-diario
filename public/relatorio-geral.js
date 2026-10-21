(() => {
 'use strict';
 const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
 const pad=n=>String(n).padStart(2,'0');
 const parseIso=value=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d);};
 const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const sum=o=>o?(Number(o.mecanica)||0)+(Number(o.tubulacao)||0)+(Number(o.solda)||0):0;
 const sumHE=r=>Object.values(r.horaExtra||{}).reduce((n,f)=>n+sum(f),0);
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const teamName=r=>String(r.supervisor||'Equipe não informada').replace(/\b(?:encarregado|técnico|engenheiro)\s+/gi,'').trim();
 const filePart=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
 const fileDate=v=>v.split('-').reverse().join('-');
 function filename(from,to,team,shift){return 'RDO_'+(team?filePart(team):'Geral')+(shift?'_'+shift+'-turno':'')+'_'+fileDate(from)+'_a_'+fileDate(to)+'.xlsx';}
 function selected(records,{from,to,team,shift}){return records.filter(r=>r.data>=from&&r.data<=to&&(!team||normalize(teamName(r))===normalize(team))&&(!shift||String(r.turno||'1')===shift)).map(r=>{
  const activities=[...(r.atividades||[])],ids=new Set(activities.map(a=>String(a.spoolId||'')));
  for(const point of r.apontamentos||[]){if(ids.has(String(point.spoolId)))continue;const snap=point.snapshot||{};activities.push({spoolId:point.spoolId,snapshot:snap,lote:String(snap['PROG FAB']??''),descricao:[snap['ISOMÉTRICO'],snap.SPOOL].filter(Boolean).join(' · '),data:point.data||r.data,observacao:point.observacao||''});ids.add(String(point.spoolId));}
  return {...r,atividades:activities};
 });}
function jornada(dataStr,turno){
  const dow=dataStr?parseIso(dataStr).getDay():new Date().getDay();
  const fimSem=dow===0||dow===6;
  if(turno==='2')return fimSem?{tipo:'fds2',turno:'2',das:'19:30',ate:'05:30',faixas:[]}
                              :{tipo:'turno2',turno:'2',inicio:'19:30',fimNormal:'05:30',faixas:[]};
  if(dow>=1&&dow<=4)return{tipo:'semana',turno:'1',fimNormal:'17:30',faixas:['19:30','21:00']};
  if(dow===5)return{tipo:'sexta',turno:'1',fimNormal:'16:30',faixas:['18:30','20:00']};
  return{tipo:'fds',turno:'1',das:'07:30',ate:'16:30',faixas:[]};
}
function isFdsTipo(j){return j.tipo==='fds'||j.tipo==='fds2'}
function jornadaTexto(j){
  if(j.tipo==='fds')return 'Fim de semana: o dia todo é extra, das 07:30 às 16:30';
  if(j.tipo==='fds2')return 'Fim de semana, 2º turno: o turno todo é extra, das 19:30 às 05:30';
  if(j.tipo==='turno2')return '2º turno: normal das 19:30 às 05:30 · extra após 05:30';
  return 'Normal até '+j.fimNormal+' · extra até '+j.faixas[0]+' ou até '+j.faixas[1];
}
function buildReportBook(rows){
  // Datas civis são números inteiros no Excel; não passam por conversão de fuso da biblioteca.
  const excelDay=value=>{const [y,m,d]=String(value).split('-').map(Number);return (Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000;};
  const excelMoment=value=>{const d=new Date(value);return (Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds())-Date.UTC(1899,11,30))/86400000;};
  function formatDates(sheet){for(const [key,cell] of Object.entries(sheet)){if(key[0]==='!'||cell.t!=='n')continue;const column=XLSX.utils.decode_cell(key).c,header=sheet[XLSX.utils.encode_cell({r:0,c:column})]?.v;if(['Data','Data do RDO','Data do apontamento','Semana (segunda)','Até (domingo)'].includes(header))cell.z='dd/mm/yyyy';if(['Enviado em','Data do envio'].includes(header))cell.z='dd/mm/yyyy hh:mm';}}
  rows=[...rows].sort((a,b)=>a.data.localeCompare(b.data)||teamName(a).localeCompare(teamName(b))||(a.turno||'1').localeCompare(b.turno||'1'));
  const z=v=>v||'';
  const rdo=rows.map(r=>{const e=r.efetivo||{},h=r.horaExtra||{},f1=h.faixa1||{},f2=h.faixa2||{},fd=h.fimDeSemana;return{
    'Data':excelDay(r.data),'Dia':DIAS[parseIso(r.data).getDay()],'Local':r.local||'','Responsável':r.supervisor,'Conta (e-mail)':r.autor_email||'','Frente':r.frente,
    'Turno':r.turno==='2'?'2º turno':'1º turno',
    'Jornada':jornadaTexto(jornada(r.data,r.turno||'1')),
    'Efetivo Mecânica':e.mecanica||0,'Efetivo Tubulação':e.tubulacao||0,'Efetivo Solda':e.solda||0,'Efetivo Total':sum(e),
    'Extra 1 até':fd?'':z(f1.ate),'Extra 1 Mecânica':z(f1.mecanica),'Extra 1 Tubulação':z(f1.tubulacao),'Extra 1 Solda':z(f1.solda),
    'Extra 2 até':fd?'':z(f2.ate),'Extra 2 Mecânica':z(f2.mecanica),'Extra 2 Tubulação':z(f2.tubulacao),'Extra 2 Solda':z(f2.solda),
    'Extra fim de semana':fd?sum(fd):'',
    'Total func. na extra':sumHE(r),
    'Atividades':(r.atividades||[]).map(a=>(a.lote?'Lote '+a.lote+': ':'')+a.descricao).join(' | '),
    'Observações':r.observacoes||'','Enviado em':r.criadoEm?excelMoment(r.criadoEm):'','ID':r.id}});
  const acts=[];rows.forEach(r=>(r.atividades||[]).forEach(a=>{const source=a.snapshot||{};acts.push({
    'Data do RDO':excelDay(r.data),'Local / equipe':r.local||'','Responsável':r.supervisor,'Conta (e-mail)':r.autor_email||'','Turno':r.turno==='2'?'2º':'1º',
    'Serviço':source['SERVIÇO']||'','Lote':/^\d+$/.test(a.lote)?Number(a.lote):a.lote,'Isométrico':source['ISOMÉTRICO']||'','Spool':source.SPOOL||'','ID Spool':a.spoolId||'',
    'Data do apontamento':a.data?excelDay(a.data):'','Observação do apontamento':a.observacao||'','Descrição':a.descricao||'','ID RDO':r.id});}));
  const wb=XLSX.utils.book_new();
  const s1=XLSX.utils.json_to_sheet(rdo,{cellDates:true,dateNF:'dd/mm/yyyy'});
  s1['!cols']=[{wch:11},{wch:9},{wch:24},{wch:30},{wch:11},{wch:9},{wch:50},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:12},{wch:10},{wch:60},{wch:40},{wch:17},{wch:22}];
  const s2=XLSX.utils.json_to_sheet(acts,{cellDates:true,dateNF:'dd/mm/yyyy'});
  s2['!cols']=[{wch:13},{wch:24},{wch:30},{wch:30},{wch:9},{wch:16},{wch:9},{wch:44},{wch:14},{wch:16},{wch:21},{wch:44},{wch:55},{wch:38}];
  [s1,s2].forEach(formatDates);
  XLSX.utils.book_append_sheet(wb,s1,'RDO');XLSX.utils.book_append_sheet(wb,s2,'Atividades do dia');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}

 window.RDOReport={filename,selected,buildBook:buildReportBook};
 document.addEventListener('DOMContentLoaded',async()=>{
  const $=id=>document.getElementById(id),message=$('report-message'),button=$('report-download');
  if(!$('report-form'))return;
  const today=iso(new Date());$('report-from').value=today;$('report-to').value=today;
  try{
   await RDO.ready;const {admin,records}=await RDO.reportRecords();
   const names=[...new Set(records.map(teamName))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;$('report-team').append(option);}
   message.textContent=admin?'Sua conta pode baixar os RDOs de todos os usuários.':'O download inclui somente os seus RDOs.';button.disabled=false;
  }catch(e){message.textContent=e.message;}
  $('report-form').addEventListener('submit',async event=>{
   event.preventDefault();const filters={from:$('report-from').value,to:$('report-to').value,team:$('report-team').value,shift:$('report-shift').value};
   if(!filters.from||!filters.to||filters.from>filters.to){message.textContent='Informe um período válido: a data inicial deve ser anterior ou igual à final.';return;}
   button.disabled=true;message.textContent='Buscando RDOs salvos no banco…';
   try{
    const {records}=await RDO.reportRecords(filters),rows=selected(records,filters);
    if(!rows.length){message.textContent='Nenhum RDO salvo encontrado para os filtros escolhidos.';return;}
    const name=filename(filters.from,filters.to,filters.team,filters.shift),blob=new Blob([buildReportBook(rows)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    await RDO.exportFile({blob,name,type:'rdo_excel',items:rows.length,equipe:filters.team||'Todas as equipes',turno:filters.shift,dataRdo:filters.from===filters.to?filters.from:null});
    message.textContent=rows.length+' RDO(s) incluído(s). Excel gerado e cópia salva no histórico.';window.dispatchEvent(new Event('rdo-history-updated'));
   }catch(e){message.textContent=e.message;}finally{button.disabled=false;}
  });
 });
})();
