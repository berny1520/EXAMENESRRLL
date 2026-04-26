
const state = {
  data: {summary:{}, records:[], examRows:[]},
  filters: {search:'', cargo:'', mutual:'', estado:'', prioridad:'', examen:''}
};

function boot(){
  state.data = window.APP_EMBEDDED_DATA || {summary:{},records:[],examRows:[]};
  renderStatics();
  bind();
  renderAll();
}

function renderStatics(){
  const s = state.data.summary || {};
  document.getElementById('todayDate').textContent = s.today || '';
  document.getElementById('systemName').textContent = (window.APP_CONFIG||{}).systemName || 'Sistema de Alertas y Control de Vencimientos';
  document.getElementById('badgeAlerts').textContent = s.usuariosVencidos || 0;

  setKpi('kpiVencidos', s.usuariosVencidos || 0, percent(s.usuariosVencidos || 0, s.totalUsuarios || 0));
  setKpi('kpiPorVencer', s.usuariosPorVencer || 0, percent(s.usuariosPorVencer || 0, s.totalUsuarios || 0));
  setKpi('kpiAlDia', s.usuariosAlDia || 0, percent(s.usuariosAlDia || 0, s.totalUsuarios || 0));
  setKpi('kpiSinFecha', s.usuariosSinFecha || 0, percent(s.usuariosSinFecha || 0, s.totalUsuarios || 0));
  setKpi('kpiTotal', s.totalUsuarios || 0, 100);

  fillSelect('filter-cargo', uniq(state.data.records.map(x=>x.cargo)).sort());
  fillSelect('filter-mutual', uniq(state.data.records.map(x=>x.mutual)).sort());
  fillSelect('filter-estado', ['VENCIDO','POR VENCER','AL DÍA','SIN FECHA']);
  fillSelect('filter-prioridad', ['CRÍTICA','ALTA','NORMAL','REVISAR']);
  fillSelect('filter-examen', uniq(state.data.examRows.map(x=>x.examen)).sort());
}

function setKpi(id, value, pct){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
  const bar = document.querySelector(`[data-bar="${id}"]`);
  if(bar) bar.style.width = Math.max(6, pct) + '%';
}

function percent(a,b){ return !b ? 0 : Math.round((a/b)*100); }
function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }

function fillSelect(id, items){
  const el = document.getElementById(id);
  if(!el) return;
  const ph = el.dataset.placeholder || 'Todos';
  el.innerHTML = `<option value="">${ph}</option>` + items.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
}

function bind(){
  document.querySelectorAll('.navBtn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const view = btn.dataset.view;
      document.querySelectorAll('.navBtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tabPane').forEach(p=>p.classList.remove('active'));
      const pane = document.getElementById('view-' + view);
      if(pane) pane.classList.add('active');
    });
  });

  ['search','cargo','mutual','estado','prioridad','examen'].forEach(k=>{
    const el = document.getElementById('filter-' + k);
    if(!el) return;
    const evt = k === 'search' ? 'input' : 'change';
    el.addEventListener(evt, ()=>{
      state.filters[k] = el.value.trim();
      renderAll();
    });
  });

  document.getElementById('clearFilters').addEventListener('click', ()=>{
    state.filters = {search:'', cargo:'', mutual:'', estado:'', prioridad:'', examen:''};
    ['search','cargo','mutual','estado','prioridad','examen'].forEach(k=>{
      const el = document.getElementById('filter-' + k);
      if(el) el.value = '';
    });
    renderAll();
  });

  document.getElementById('exportCsv').addEventListener('click', ()=>downloadCSV(filteredRecords(), 'usuarios_examenes_filtrados.csv'));
  document.getElementById('exportReport').addEventListener('click', ()=>exportReport());
  document.getElementById('closeModal').addEventListener('click', ()=>document.getElementById('detailModal').classList.remove('show'));
  document.getElementById('detailModal').addEventListener('click', (e)=>{ if(e.target.id==='detailModal') e.currentTarget.classList.remove('show'); });
}

function filteredRecords(){
  const f = state.filters;
  return state.data.records.filter(r=>{
    const s = [r.codigo,r.rut,r.nombre,r.cargo,r.proximoExamen,r.mutual].join(' ').toLowerCase();
    return (!f.search || s.includes(f.search.toLowerCase()))
      && (!f.cargo || r.cargo===f.cargo)
      && (!f.mutual || r.mutual===f.mutual)
      && (!f.estado || r.estado===f.estado)
      && (!f.prioridad || r.prioridad===f.prioridad)
      && (!f.examen || r.examenes.some(e=>e.nombre===f.examen));
  });
}

function filteredExamRows(){
  const f = state.filters;
  return state.data.examRows.filter(r=>{
    const s = [r.rut,r.nombre,r.cargo,r.examen,r.mutual].join(' ').toLowerCase();
    return (!f.search || s.includes(f.search.toLowerCase()))
      && (!f.cargo || r.cargo===f.cargo)
      && (!f.mutual || r.mutual===f.mutual)
      && (!f.estado || r.estado===f.estado)
      && (!f.prioridad || r.prioridad===f.prioridad)
      && (!f.examen || r.examen===f.examen);
  });
}

function renderAll(){
  renderDashboard();
  renderUsers();
  renderVencimientos();
  renderAlertas();
  renderReportes();
}

function renderDashboard(){
  const recs = filteredRecords();
  const total = recs.length || 1;
  const cV = recs.filter(x=>x.estado==='VENCIDO').length;
  const cP = recs.filter(x=>x.estado==='POR VENCER').length;
  const cA = recs.filter(x=>x.estado==='AL DÍA').length;
  const cS = recs.filter(x=>x.estado==='SIN FECHA').length;

  drawDoughnut('chartEstado', [
    {label:'Vencidos', value:cV, color:'#ff4d57'},
    {label:'Por vencer', value:cP, color:'#ff961f'},
    {label:'Al día', value:cA, color:'#79d85b'},
    {label:'Sin fecha', value:cS, color:'#4f8cff'}
  ], 'legendEstado');

  const upcoming = filteredExamRows()
    .filter(r=>typeof r.dias === 'number' && r.dias >= 0 && r.dias <= 30)
    .reduce((a, r)=>{
      if(r.dias <= 7) a[0]++; else if(r.dias <= 15) a[1]++; else a[2]++;
      return a;
    }, [0,0,0]);

  drawBars('chartVencimientos', [
    {label:'0-7 días', value:upcoming[0], color:'#ff4d57'},
    {label:'8-15 días', value:upcoming[1], color:'#ff961f'},
    {label:'16-30 días', value:upcoming[2], color:'#f1c33c'}
  ]);

  const mutualMap = {};
  recs.forEach(r=>mutualMap[r.mutual]=(mutualMap[r.mutual]||0)+1);
  const palette = ['#79d85b','#4f8cff','#ba5cff','#ff961f','#ff4d57','#4fd7db'];
  drawDoughnut('chartMutual', Object.entries(mutualMap).map((x,i)=>({label:x[0], value:x[1], color:palette[i%palette.length]})), 'legendMutual');

  document.getElementById('alertCrit').textContent = cV;
  document.getElementById('alertSoon').textContent = cP;
  document.getElementById('alertNoDate').textContent = cS;

  document.getElementById('dashboardTableBody').innerHTML = userRows(recs.slice(0,12));
  bindViewButtons('#dashboardTableBody');
}

function renderUsers(){
  const recs = filteredRecords();
  document.getElementById('usersCount').textContent = `${recs.length} registros`;
  document.getElementById('usersTableBody').innerHTML = userRows(recs);
  bindViewButtons('#usersTableBody');
}

function userRows(recs){
  if(!recs.length) return `<tr><td colspan="11"><div class="empty">No hay resultados para los filtros aplicados.</div></td></tr>`;
  return recs.map(r=>`
    <tr>
      <td>${esc(r.codigo)}</td>
      <td>${esc(r.rut)}</td>
      <td>${esc(r.nombre)}</td>
      <td>${esc(r.cargo)}</td>
      <td>${esc(r.mutual)}</td>
      <td>${esc(r.proximoExamen || '-')}</td>
      <td>${esc(r.proximoVencimiento || '-')}</td>
      <td>${r.diasRestantes ?? '-'}</td>
      <td>${estadoBadge(r.estado)}</td>
      <td>${prioBadge(r.prioridad)}</td>
      <td><button class="eyeBtn" data-rut="${attr(r.rut)}">👁</button></td>
    </tr>
  `).join('');
}

function renderVencimientos(){
  const rows = filteredExamRows()
    .filter(r=>r.fechaISO)
    .sort((a,b)=>a.fechaISO.localeCompare(b.fechaISO));
  const tb = document.getElementById('vencTableBody');
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="9"><div class="empty">No hay vencimientos para mostrar.</div></td></tr>`;
    return;
  }
  tb.innerHTML = rows.map(r=>`
    <tr>
      <td>${esc(r.rut)}</td>
      <td>${esc(r.nombre)}</td>
      <td>${esc(r.cargo)}</td>
      <td>${esc(r.mutual)}</td>
      <td>${esc(r.examen)}</td>
      <td>${esc(r.fecha)}</td>
      <td>${r.dias ?? '-'}</td>
      <td>${estadoBadge(r.estado)}</td>
      <td>${prioBadge(r.prioridad)}</td>
    </tr>
  `).join('');
}

function renderAlertas(){
  const rows = filteredExamRows()
    .filter(r=>['VENCIDO','POR VENCER','SIN FECHA'].includes(r.estado))
    .sort((a,b)=>{
      const order = {'VENCIDO':0,'POR VENCER':1,'SIN FECHA':2};
      return order[a.estado]-order[b.estado] || ((a.dias ?? 99999) - (b.dias ?? 99999));
    });
  const el = document.getElementById('alertsList');
  if(!rows.length){
    el.innerHTML = `<div class="empty">No hay alertas con los filtros actuales.</div>`;
    return;
  }
  el.innerHTML = rows.map(r=>`
    <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">${esc(r.nombre)}</div>
          <div class="muted">${esc(r.rut)} · ${esc(r.cargo)} · ${esc(r.examen)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="muted">${esc(r.fecha || 'Sin fecha')}</span>
          ${estadoBadge(r.estado)}
          ${prioBadge(r.prioridad)}
        </div>
      </div>
    </div>
  `).join('');
}

function renderReportes(){
  const recs = filteredRecords();
  const total = recs.length || 1;
  const venc = recs.filter(x=>x.estado==='VENCIDO').length;
  const por = recs.filter(x=>x.estado==='POR VENCER').length;
  const ok = recs.filter(x=>x.estado==='AL DÍA').length;
  const sin = recs.filter(x=>x.estado==='SIN FECHA').length;

  document.getElementById('reportSummary').innerHTML = `
    <div class="metaGrid">
      <div class="metaCard"><div class="l">Cumplimiento al día</div><div class="v">${Math.round(ok*100/total)}%</div></div>
      <div class="metaCard"><div class="l">Críticos</div><div class="v" style="color:#ff6f75">${venc}</div></div>
      <div class="metaCard"><div class="l">Por vencer</div><div class="v" style="color:#ffb050">${por}</div></div>
      <div class="metaCard"><div class="l">Sin fecha</div><div class="v" style="color:#8ab8ff">${sin}</div></div>
    </div>
  `;

  const cargoMap = {};
  recs.forEach(r=>{
    cargoMap[r.cargo] = cargoMap[r.cargo] || {total:0,v:0,p:0,a:0};
    cargoMap[r.cargo].total++;
    if(r.estado==='VENCIDO') cargoMap[r.cargo].v++;
    if(r.estado==='POR VENCER') cargoMap[r.cargo].p++;
    if(r.estado==='AL DÍA') cargoMap[r.cargo].a++;
  });

  const rows = Object.entries(cargoMap).sort((a,b)=>b[1].total-a[1].total).map(([cargo,v])=>`
    <tr>
      <td>${esc(cargo)}</td>
      <td>${v.total}</td>
      <td>${v.v}</td>
      <td>${v.p}</td>
      <td>${v.a}</td>
      <td>${Math.round(v.a*100/(v.total||1))}%</td>
    </tr>
  `).join('');
  document.getElementById('reportTableBody').innerHTML = rows || `<tr><td colspan="6"><div class="empty">Sin datos.</div></td></tr>`;
}

function bindViewButtons(scope){
  document.querySelectorAll(`${scope} .eyeBtn`).forEach(btn=>{
    btn.onclick = ()=>openUser(btn.dataset.rut);
  });
}

function openUser(rut){
  const user = state.data.records.find(r=>r.rut===rut);
  if(!user) return;
  document.getElementById('modalUserTitle').innerHTML = `
    <h2>${esc(user.nombre)}</h2>
    <div class="muted">${esc(user.rut)} · ${esc(user.cargo)} · ${esc(user.mutual)}</div>
  `;
  document.getElementById('modalMeta').innerHTML = `
    <div class="metaCard"><div class="l">Código</div><div class="v">${esc(user.codigo)}</div></div>
    <div class="metaCard"><div class="l">Resultado examen</div><div class="v">${esc(user.resultado || '—')}</div></div>
    <div class="metaCard"><div class="l">Evaluación de riesgo</div><div class="v">${esc(user.riesgo || '—')}</div></div>
    <div class="metaCard"><div class="l">Fecha contrato</div><div class="v">${esc(user.fechaContrato || '—')}</div></div>
  `;
  document.getElementById('modalExams').innerHTML = user.examenes.map(e=>`
    <div class="examCard">
      <h4>${esc(e.nombre)}</h4>
      <div class="muted">Vencimiento</div>
      <div class="date">${esc(e.fecha || 'Sin fecha')}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${estadoBadge(e.estado)}
        ${prioBadge(e.prioridad)}
        <span class="badge gray">${e.dias ?? '—'} días</span>
      </div>
    </div>
  `).join('');
  document.getElementById('detailModal').classList.add('show');
}

function estadoBadge(v){
  const c = v==='VENCIDO'?'red':v==='POR VENCER'?'orange':v==='AL DÍA'?'green':'blue';
  return `<span class="badge ${c}">${esc(v)}</span>`;
}
function prioBadge(v){
  const c = v==='CRÍTICA'?'red':v==='ALTA'?'orange':v==='NORMAL'?'green':'gray';
  return `<span class="badge ${c}">${esc(v)}</span>`;
}

function drawDoughnut(id, segments, legendId){
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.clearRect(0,0,w,h);

  const total = segments.reduce((a,b)=>a+b.value,0) || 1;
  const cx = w * 0.28, cy = h * 0.5;
  const r = Math.min(w,h) * 0.28;
  const inner = r * 0.58;
  let start = -Math.PI/2;

  segments.forEach(seg=>{
    const angle = (seg.value/total) * Math.PI*2;
    ctx.beginPath();
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.arc(cx,cy,inner,start+angle,start,true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(cx,cy,inner-8,0,Math.PI*2);
  ctx.fillStyle = '#0b1628';
  ctx.fill();

  if(legendId){
    document.getElementById(legendId).innerHTML = segments.map(seg=>{
      const pct = Math.round((seg.value*100)/total);
      return `<div class="legendRow"><span class="legendDot" style="background:${seg.color}"></span><span>${esc(seg.label)}: ${seg.value} (${pct}%)</span></div>`;
    }).join('');
  }
}

function drawBars(id, items){
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.clearRect(0,0,w,h);

  const pad = {l:34,r:12,t:18,b:34};
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const max = Math.max(1, ...items.map(i=>i.value));

  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.fillStyle = '#dce5f7';
  ctx.font = '12px Arial';

  for(let i=0;i<4;i++){
    const y = pad.t + (ch/3)*i;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
  }

  const each = cw / items.length;
  const barW = Math.min(46, each*0.42);

  items.forEach((it,i)=>{
    const x = pad.l + each*i + (each-barW)/2;
    const bh = (it.value/max) * (ch-12);
    const y = pad.t + ch - bh;
    roundRect(ctx, x, y, barW, bh, 8, it.color);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(it.value), x + barW/2 - 4, y - 8);
    ctx.fillStyle = '#dce5f7';
    ctx.fillText(it.label, x - 8, h - 10);
  });
}

function roundRect(ctx, x, y, w, h, r, color){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function downloadCSV(rows, filename){
  if(!rows.length){ alert('No hay datos para exportar.'); return; }
  const cols = ['codigo','rut','nombre','cargo','mutual','proximoExamen','proximoVencimiento','diasRestantes','estado','prioridad','resultado','riesgo'];
  const csv = [cols.join(',')].concat(rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))).join('\n');
  saveBlob(csv, filename);
}
function exportReport(){
  const rows = filteredRecords();
  const lines = [['RUT','Nombre','Cargo','Mutual','Próximo examen','Vencimiento','Días','Estado','Prioridad']];
  rows.forEach(r=>lines.push([r.rut,r.nombre,r.cargo,r.mutual,r.proximoExamen,r.proximoVencimiento,r.diasRestantes,r.estado,r.prioridad]));
  saveBlob(lines.map(r=>r.map(csvCell).join(',')).join('\n'), 'reporte_gerencial_examenes.csv');
}
function saveBlob(content, filename){
  const blob = new Blob([content], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
function csvCell(v){ return `"${String(v ?? '').replaceAll('"','""')}"`; }
function esc(v){ return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function attr(v){ return esc(v).replaceAll("'", '&#39;'); }

window.addEventListener('DOMContentLoaded', boot);
