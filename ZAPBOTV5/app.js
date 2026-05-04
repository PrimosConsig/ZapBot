ocument.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});
 
/* ──────────────
   ESTADO GLOBAL
   ────────────── */
let uploadedFile = null;
let contacts     = [];
let running      = false;
let opTimeout    = null;
let statEnv      = 0;
let statErr      = 0;
let statInv      = 0;
let sessionHistory = [];
 
/* ──────────────
   UPLOAD / FILE
   ────────────── */
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
 
  uploadedFile = file;
 
  document.getElementById('upload-placeholder').style.display = 'none';
  document.getElementById('upload-filename').style.display    = 'block';
  document.getElementById('upload-filename').textContent      = file.name;
  document.getElementById('upload-size').style.display        = 'block';
  document.getElementById('upload-size').textContent          = (file.size / 1024).toFixed(1) + ' KB';
  document.getElementById('upload-remove').style.display      = 'flex';
  document.getElementById('upload-add').style.display         = 'none';
  document.getElementById('upload-zone').classList.add('has-file');
 
  if (window.XLSX) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
 
        contacts = data.map(row => ({
          nome:     String(row['nome']     || row['Nome']     || row['NOME']     || '').trim(),
          telefone: String(row['telefone'] || row['Telefone'] || row['TELEFONE'] || '').trim()
        })).filter(r => r.telefone);
 
        addLog('info', `✅ Importados ${contacts.length} contatos de "${file.name}"`);
      } catch (err) {
        addLog('err', `Erro ao ler arquivo: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  } else {
    addLog('warn', 'SheetJS não carregado. Usando dados de demonstração.');
    contacts = [{ nome: 'Teste', telefone: '11999999999' }];
  }
}
 
function removeFile(e) {
  e.stopPropagation();
  uploadedFile = null;
  contacts     = [];
  document.getElementById('file-input').value                  = '';
  document.getElementById('upload-placeholder').style.display  = 'block';
  document.getElementById('upload-filename').style.display     = 'none';
  document.getElementById('upload-size').style.display         = 'none';
  document.getElementById('upload-remove').style.display       = 'none';
  document.getElementById('upload-add').style.display          = 'flex';
  document.getElementById('upload-zone').classList.remove('has-file');
}
 
/* ──────────────
   CADÊNCIA
   ────────────── */
function updateCadencia(v) {
  document.getElementById('cadencia-val').textContent   = v;
  document.getElementById('cadencia-label').textContent = v;
  const pct = ((v - 10) / (120 - 10)) * 100;
  document.getElementById('range-fill').style.width = pct + '%';
}
 
/* ──────────────
   LOG
   ────────────── */
function addLog(type, msg) {
  const block   = document.getElementById('log-block');
  const entries = document.getElementById('log-entries');
 
  block.style.display = 'block';
 
  const now = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
 
  const cls  = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : 'log-warn';
 
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">[${now}]</span><span class="${cls}">${msg}</span>`;
  entries.appendChild(div);
  block.scrollTop = block.scrollHeight;
}
 
/* ──────────────
   STATS
   ────────────── */
function updateStats() {
  document.getElementById('stat-env').textContent = statEnv;
  document.getElementById('stat-err').textContent = statErr;
  document.getElementById('stat-inv').textContent = statInv;
}
 
function resetStats() {
  statEnv = 0; statErr = 0; statInv = 0;
  updateStats();
}
 
/* ──────────────
   HISTÓRICO
   ────────────── */
function saveSession(date, total, cadencia) {
  sessionHistory.unshift({
    date, total, cadencia,
    enviados:  statEnv,
    erros:     statErr,
    invalidos: statInv
  });
  renderHistory();
}
 
function renderHistory() {
  const c = document.getElementById('hist-container');
  if (!sessionHistory.length) {
    c.innerHTML = '<div class="empty-hist">// NENHUM DISPARO REGISTRADO AINDA</div>';
    return;
  }
 
  const rows = sessionHistory.map(s => `
    <tr>
      <td>${s.date}</td>
      <td>${s.total}</td>
      <td><span class="badge badge-ok">${s.enviados}</span></td>
      <td><span class="badge badge-err">${s.erros}</span></td>
      <td><span class="badge badge-inv">${s.invalidos}</span></td>
      <td>${s.cadencia}s</td>
    </tr>
  `).join('');
 
  c.innerHTML = `
    <table class="hist-table">
      <thead>
        <tr>
          <th>DATA/HORA</th>
          <th>TOTAL</th>
          <th>ENVIADOS</th>
          <th>ERROS</th>
          <th>INVÁLIDOS</th>
          <th>CADÊNCIA</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
 
/* ──────────────
   OPERAÇÃO
   ────────────── */
function iniciarOperacao() {
  if (running) return;
 
  const frases = document.getElementById('frases-input')
    .value.split('\n').map(l => l.trim()).filter(Boolean);
 
  if (!frases.length) {
    alert('Configure ao menos uma frase de mensagem.');
    return;
  }
 
  // Modo demo se não houver contatos importados
  if (!contacts.length) {
    contacts = [
      { nome: 'João',  telefone: '11999990001' },
      { nome: 'Maria', telefone: '11999990002' },
      { nome: 'Pedro', telefone: '11999990003' },
    ];
    addLog('warn', 'Nenhum arquivo importado — usando dados de demonstração');
  }
 
  running = true;
  resetStats();
 
  const cadencia = parseInt(document.getElementById('cadencia-range').value, 10);
  const total    = contacts.length;
  let   current  = 0;
  const startDate = new Date().toLocaleString('pt-BR');
 
  // UI: estado ativo
  document.getElementById('btn-iniciar').style.display   = 'none';
  document.getElementById('btn-parar').style.display     = 'inline-block';
  document.getElementById('progress-block').style.display = 'block';
  document.getElementById('log-block').style.display      = 'block';
  document.getElementById('log-entries').innerHTML         = '';
  document.getElementById('prog-bar').style.width          = '0%';
  document.getElementById('status-dot').classList.add('active');
  document.getElementById('status-text').textContent       = 'RODANDO';
 
  addLog('info', `⚙️ Iniciando ${total} disparos | Cadência: ${cadencia}s`);
 
  function sendNext() {
    if (!running || current >= total) {
      finishOperation(startDate, total, cadencia);
      return;
    }
 
    const contact = contacts[current];
    const frase   = frases[Math.floor(Math.random() * frases.length)];
    const msg     = frase.replace('{nome}', contact.nome || '');
 
    // Simula resultado (o disparo real é feito pelo Python)
    const rand = Math.random();
    if (rand > 0.12) {
      addLog('ok', `📨 Enviado → ${contact.nome || contact.telefone} | "${msg.substring(0, 45)}..."`);
      statEnv++;
    } else if (rand > 0.04) {
      addLog('err', `⚠️ Erro ao enviar para ${contact.nome || contact.telefone}`);
      statErr++;
    } else {
      addLog('warn', `❌ Número inválido: ${contact.telefone}`);
      statInv++;
    }
 
    updateStats();
 
    current++;
    const pct = Math.round((current / total) * 100);
    document.getElementById('prog-bar').style.width    = pct + '%';
    document.getElementById('prog-count').textContent  = `${current} / ${total}`;
    document.getElementById('prog-label').textContent  = `DISPARANDO... ${pct}%`;
 
    opTimeout = setTimeout(sendNext, cadencia * 1000);
  }
 
  sendNext();
}
 
function pararOperacao() {
  running = false;
  if (opTimeout) clearTimeout(opTimeout);
  addLog('warn', '🛑 Operação interrompida pelo usuário');
  resetUI();
}
 
function finishOperation(startDate, total, cadencia) {
  running = false;
  addLog('ok', `✅ Concluído! ${statEnv} enviados | ${statErr} erros | ${statInv} inválidos`);
  document.getElementById('prog-label').textContent = 'CONCLUÍDO ✓';
  saveSession(startDate, total, cadencia);
  resetUI();
}
 
function resetUI() {
  document.getElementById('btn-iniciar').style.display = 'inline-block';
  document.getElementById('btn-parar').style.display   = 'none';
  document.getElementById('status-dot').classList.remove('active');
  document.getElementById('status-text').textContent   = 'INATIVO';
}