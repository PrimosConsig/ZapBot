/* PRIMOS ZAPBOT — app.js */

var uploadedFile   = null;
var contacts       = [];
var running        = false;
var opTimeout      = null;
var statEnv        = 0;
var statErr        = 0;
var statInv        = 0;
var sessionHistory = [];

/* ── TABS ── */
var tabs = document.querySelectorAll('.tab');
for (var i = 0; i < tabs.length; i++) {
  tabs[i].addEventListener('click', function() {
    var allTabs     = document.querySelectorAll('.tab');
    var allContents = document.querySelectorAll('.tab-content');
    for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
    for (var k = 0; k < allContents.length; k++) allContents[k].classList.remove('active');
    this.classList.add('active');
    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
  });
}

/* ── SLIDER ── */
function updateSliderColor(val) {
  var min = 35, max = 210;
  var pct = ((val - min) / (max - min)) * 100;
  document.getElementById('cadencia-range').style.background =
    'linear-gradient(to right, #c8a84b ' + pct + '%, #2a2510 ' + pct + '%)';
  document.getElementById('cadencia-val').textContent   = val;
  document.getElementById('cadencia-label').textContent = val;
}

document.getElementById('cadencia-range').addEventListener('input', function() {
  updateSliderColor(this.value);
});

updateSliderColor(45);

/* ── UPLOAD ── */
document.getElementById('file-input').addEventListener('change', function(e) {
  var file = e.target.files[0];
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
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb   = XLSX.read(ev.target.result, { type: 'binary' });
        var ws   = wb.Sheets[wb.SheetNames[0]];
        var data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        contacts = [];
        for (var i = 0; i < data.length; i++) {
          var row = data[i];
          var tel = String(row['telefone'] || row['Telefone'] || row['TELEFONE'] || '').trim();
          if (tel) {
            contacts.push({
              nome:     String(row['nome'] || row['Nome'] || row['NOME'] || '').trim(),
              telefone: tel
            });
          }
        }
        addLog('ok', 'Importados ' + contacts.length + ' contatos de "' + file.name + '"');
      } catch(err) {
        addLog('err', 'Erro ao ler arquivo: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  } else {
    contacts = [{ nome: 'Teste', telefone: '11999999999' }];
    addLog('warn', 'SheetJS nao carregado — usando dados de demonstracao');
  }
});

function removeFile(e) {
  e.stopPropagation();
  uploadedFile = null;
  contacts     = [];
  document.getElementById('file-input').value                 = '';
  document.getElementById('upload-placeholder').style.display = 'block';
  document.getElementById('upload-filename').style.display    = 'none';
  document.getElementById('upload-size').style.display        = 'none';
  document.getElementById('upload-remove').style.display      = 'none';
  document.getElementById('upload-add').style.display         = 'flex';
  document.getElementById('upload-zone').classList.remove('has-file');
}

/* ── LOG ── */
function addLog(type, msg) {
  var block   = document.getElementById('log-block');
  var entries = document.getElementById('log-entries');
  block.style.display = 'block';
  var now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : 'log-warn';
  var div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = '<span class="log-time">[' + now + ']</span><span class="' + cls + '">' + msg + '</span>';
  entries.appendChild(div);
  block.scrollTop = block.scrollHeight;
}

/* ── STATS ── */
function updateStats() {
  document.getElementById('stat-env').textContent = statEnv;
  document.getElementById('stat-err').textContent = statErr;
  document.getElementById('stat-inv').textContent = statInv;
}

function resetStats() {
  statEnv = 0; statErr = 0; statInv = 0;
  updateStats();
}

/* ── HISTÓRICO ── */
function saveSession(date, total, cadencia) {
  sessionHistory.unshift({
    date: date, total: total, cadencia: cadencia,
    enviados: statEnv, erros: statErr, invalidos: statInv
  });
  renderHistory();
}

function renderHistory() {
  var c = document.getElementById('hist-container');
  if (!sessionHistory.length) {
    c.innerHTML = '<div class="empty-hist">// NENHUM DISPARO REGISTRADO AINDA</div>';
    return;
  }
  var rows = '';
  for (var i = 0; i < sessionHistory.length; i++) {
    var s = sessionHistory[i];
    rows += '<tr>' +
      '<td>' + s.date + '</td>' +
      '<td>' + s.total + '</td>' +
      '<td><span class="badge badge-ok">' + s.enviados + '</span></td>' +
      '<td><span class="badge badge-err">' + s.erros + '</span></td>' +
      '<td><span class="badge badge-inv">' + s.invalidos + '</span></td>' +
      '<td>' + s.cadencia + 's</td>' +
      '</tr>';
  }
  c.innerHTML =
    '<table class="hist-table">' +
      '<thead><tr>' +
        '<th>DATA/HORA</th><th>TOTAL</th><th>ENVIADOS</th><th>ERROS</th><th>INVÁLIDOS</th><th>CADÊNCIA</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
}

/* ── BOTÃO INICIAR ── */
document.getElementById('btn-iniciar').addEventListener('click', function() {
  if (running) return;

  var linhas = document.getElementById('frases-input').value.split('\n');
  var frases = [];
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i].trim();
    if (l) frases.push(l);
  }

  if (!frases.length) {
    alert('Configure ao menos uma frase de mensagem.');
    return;
  }

  if (!contacts.length) {
    contacts = [
      { nome: 'João',  telefone: '11999990001' },
      { nome: 'Maria', telefone: '11999990002' },
      { nome: 'Pedro', telefone: '11999990003' }
    ];
    addLog('warn', 'Nenhum arquivo importado — usando dados de demonstracao');
  }

  running = true;
  resetStats();

  var cadencia  = parseInt(document.getElementById('cadencia-range').value, 10);
  var total     = contacts.length;
  var current   = 0;
  var startDate = new Date().toLocaleString('pt-BR');

  document.getElementById('btn-iniciar').style.display    = 'none';
  document.getElementById('btn-parar').style.display      = 'inline-block';
  document.getElementById('progress-block').style.display = 'block';
  document.getElementById('log-block').style.display      = 'block';
  document.getElementById('log-entries').innerHTML        = '';
  document.getElementById('prog-bar').style.width         = '0%';

  addLog('warn', 'Iniciando ' + total + ' disparos | Cadencia: ' + cadencia + 's');

  function sendNext() {
    if (!running || current >= total) {
      running = false;
      addLog('ok', 'Concluido! ' + statEnv + ' enviados | ' + statErr + ' erros | ' + statInv + ' invalidos');
      document.getElementById('prog-label').textContent  = 'CONCLUÍDO ✓';
      document.getElementById('btn-iniciar').style.display = 'inline-block';
      document.getElementById('btn-parar').style.display   = 'none';
      saveSession(startDate, total, cadencia);
      return;
    }

    var contact = contacts[current];
    var frase   = frases[Math.floor(Math.random() * frases.length)];
    var msg     = frase.replace('{nome}', contact.nome || '');
    var rand    = Math.random();

    if (rand > 0.12) {
      addLog('ok', 'Enviado para ' + (contact.nome || contact.telefone));
      statEnv++;
    } else if (rand > 0.04) {
      addLog('err', 'Erro ao enviar para ' + (contact.nome || contact.telefone));
      statErr++;
    } else {
      addLog('warn', 'Numero invalido: ' + contact.telefone);
      statInv++;
    }

    updateStats();
    current++;

    var pct = Math.round((current / total) * 100);
    document.getElementById('prog-bar').style.width   = pct + '%';
    document.getElementById('prog-count').textContent = current + ' / ' + total;
    document.getElementById('prog-label').textContent = 'DISPARANDO... ' + pct + '%';

    opTimeout = setTimeout(sendNext, cadencia * 1000);
  }

  sendNext();
});

/* ── BOTÃO PARAR ── */
document.getElementById('btn-parar').addEventListener('click', function() {
  running = false;
  if (opTimeout) clearTimeout(opTimeout);
  addLog('err', 'Operacao interrompida pelo usuario');
  document.getElementById('btn-iniciar').style.display = 'inline-block';
  document.getElementById('btn-parar').style.display   = 'none';
});
