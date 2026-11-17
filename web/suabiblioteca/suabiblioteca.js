var bibDados = { curtidas: [], playlists: [] };
var bibAba = 'curtidas', bibAberta = null;

function bibAchar(id) { return bibDados.curtidas.filter(function (m) { return m.id === id; })[0]; }
function bibCapa(m) { return m.miniatura; }

var uruOff = {};      // ids que ja existem no aparelho
var uruLote = null;   // download em andamento: {total, feitos, erros, msg}

function uruAtualizarOff() {
  uruOff = {};
  if (!window.UruNativo) return;
  try { JSON.parse(UruNativo.listar()).forEach(function (id) { uruOff[id] = 1; }); } catch (e) {}
}
function uruFaltam() {
  return bibDados.curtidas.filter(function (m) { return !uruOff[m.id]; });
}
function uruRotulo() {
  var b = document.getElementById('bib-baixar');
  if (!b) return;
  if (!window.UruNativo) { b.style.display = 'none'; return; }
  b.style.display = '';
  var n = uruFaltam().length;
  b.textContent = uruLote ? 'Baixando ' + uruLote.feitos + '/' + uruLote.total
                : n ? '⬇ Baixar offline (' + n + ')' : '✓ Tudo offline';
}
function uruBaixarTudo() {
  if (uruLote) { alert('Já está baixando. Mantenha o app aberto.'); return; }
  var falta = uruFaltam();
  if (!falta.length) { alert('Todas as curtidas já estão offline.'); return; }
  if (!confirm('Baixar ' + falta.length + ' música(s) para ouvir offline? Usa internet e espaço no aparelho. Mantenha o app aberto.')) return;
  uruLote = { total: falta.length, feitos: 0, erros: 0, msg: '' };
  falta.forEach(function (m) { try { UruNativo.baixar(m.id); } catch (e) {} });
  uruRotulo();
}
/* O app chama isto quando termina cada download. */
window.uruBaixou = function (id, ok, msg) {
  if (ok) uruOff[id] = 1;
  if (uruLote) {
    uruLote.feitos++;
    if (!ok) { uruLote.erros++; if (!uruLote.msg) uruLote.msg = msg || ''; }
    if (uruLote.feitos >= uruLote.total) {
      var l = uruLote;
      uruLote = null;
      bibDesenhar();
      alert('Offline: ' + (l.total - l.erros) + ' baixada(s), ' + l.erros + ' falhou.' + (l.msg ? '\n\nErro: ' + l.msg : ''));
      return;
    }
  }
  bibDesenhar();
};

function bibApi(corpo) {
  return fetch('/biblioteca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    .then(function (r) { return r.json(); })
    .then(function (d) { bibDados = d; bibDesenhar(); return d; });
}
function bibCarregar() {
  return fetch('/biblioteca').then(function (r) { return r.json(); })
    .then(function (d) { bibDados = d; bibDesenhar(); return d; });
}

function bibAviso(texto) {
  var p = document.createElement('p');
  p.className = 'grade1-aviso';
  p.textContent = texto;
  document.getElementById('bib-lista').appendChild(p);
}
function bibBotao(texto, fn) {
  var b = document.createElement('button');
  b.className = 'bib-botao';
  b.textContent = texto;
  b.addEventListener('click', fn);
  return b;
}

function bibItem(m, aoClicar, acoes) {
  var item = document.createElement('div');
  item.className = 'grade1-item';
  var img = document.createElement('img');
  img.onerror = function () { img.onerror = null; img.src = m.miniatura; };
  img.src = bibCapa(m);
  var texto = document.createElement('div');
  texto.className = 'grade1-texto';
  var t = document.createElement('div');
  t.className = 'grade1-titulo';
  t.textContent = m.titulo;
  var c = document.createElement('div');
  c.className = 'grade1-canal';
  c.textContent = m.canal + (uruOff[m.id] ? ' · offline' : '');
  texto.appendChild(t);
  texto.appendChild(c);
  item.appendChild(img);
  item.appendChild(texto);
  var box = document.createElement('div');
  box.className = 'bib-acoes';
  acoes.forEach(function (ac) {
    var b = document.createElement('button');
    b.className = 'bib-icone';
    b.textContent = ac.t;
    b.addEventListener('click', function (e) { e.stopPropagation(); ac.f(); });
    box.appendChild(b);
  });
  item.appendChild(box);
  item.addEventListener('click', aoClicar);
  return item;
}

function bibAdicionar(m) {
  var pls = bibDados.playlists;
  if (!pls.length) { alert('Crie uma playlist primeiro (aba Playlists).'); return; }
  var txt = pls.map(function (p, i) { return (i + 1) + ') ' + p.nome; }).join('\n');
  var n = parseInt(prompt('Adicionar a qual playlist?\n' + txt), 10);
  if (n >= 1 && n <= pls.length) bibApi({ acao: 'addplaylist', playlist: pls[n - 1].nome, id: m.id });
}

function bibDesenhar() {
  var lista = document.getElementById('bib-lista');
  if (!lista) return;
  lista.innerHTML = '';
  document.getElementById('aba-curtidas').className = bibAba === 'curtidas' ? 'ativa' : '';
  document.getElementById('aba-playlists').className = bibAba === 'playlists' ? 'ativa' : '';
  if (window.atualizarCoracoes) atualizarCoracoes();
  uruAtualizarOff();
  uruRotulo();
  if (bibAba === 'curtidas') {
    if (!bibDados.curtidas.length) { bibAviso('Nenhuma música curtida ainda.'); return; }
    var ids = bibDados.curtidas.map(function (m) { return m.id; });
    bibDados.curtidas.forEach(function (m, i) {
      lista.appendChild(bibItem(m, function () { bibTocar(ids, i); }, [
        { t: '+', f: function () { bibAdicionar(m); } },
        { t: '♥', f: function () { bibApi({ acao: 'descurtir', id: m.id }); } }
      ]));
    });
    return;
  }
  if (bibAberta === null) {
    var topo = document.createElement('div');
    topo.className = 'bib-linha';
    topo.appendChild(bibBotao('+ Nova playlist', function () {
      var nome = prompt('Nome da playlist:');
      if (nome && nome.trim()) bibApi({ acao: 'criarplaylist', playlist: nome.trim() });
    }));
    lista.appendChild(topo);
    if (!bibDados.playlists.length) bibAviso('Nenhuma playlist ainda.');
    bibDados.playlists.forEach(function (p) {
      var linha = document.createElement('div');
      linha.className = 'grade1-item';
      var texto = document.createElement('div');
      texto.className = 'grade1-texto';
      var t = document.createElement('div');
      t.className = 'grade1-titulo';
      t.textContent = p.nome;
      var c = document.createElement('div');
      c.className = 'grade1-canal';
      c.textContent = p.ids.length + ' músicas';
      texto.appendChild(t);
      texto.appendChild(c);
      linha.appendChild(texto);
      linha.addEventListener('click', function () { bibAberta = p.nome; bibDesenhar(); });
      lista.appendChild(linha);
    });
    return;
  }
  var pl = bibDados.playlists.filter(function (x) { return x.nome === bibAberta; })[0];
  if (!pl) { bibAberta = null; bibDesenhar(); return; }
  var barra = document.createElement('div');
  barra.className = 'bib-linha';
  barra.appendChild(bibBotao('‹ Voltar', function () { bibAberta = null; bibDesenhar(); }));
  barra.appendChild(bibBotao('▶ Tocar tudo', function () {
    var i = pl.ids.findIndex(function (id) { var x = bibAchar(id); return x && x.estado === 'pronto'; });
    if (i >= 0) bibTocar(pl.ids, i); else alert('Nenhuma música pronta nessa playlist.');
  }));
  barra.appendChild(bibBotao('Apagar', function () {
    if (confirm('Apagar a playlist ' + pl.nome + '? As músicas continuam curtidas.')) {
      bibAberta = null;
      bibApi({ acao: 'apagarplaylist', playlist: pl.nome });
    }
  }));
  lista.appendChild(barra);
  bibAviso(pl.nome);
  pl.ids.forEach(function (id) {
    var m = bibAchar(id);
    if (m) lista.appendChild(bibItem(m, function () { bibTocar(pl.ids, pl.ids.indexOf(id)); }, [
      { t: '✕', f: function () { bibApi({ acao: 'tirarplaylist', playlist: pl.nome, id: id }); } }
    ]));
  });
}

function bibTocar(ids, pos) {
  var m = bibAchar(ids[pos]);
  if (!m) return;
  // Sem arquivo ainda? O player cai sozinho para o YouTube (ver player.js).
  var prontos = ids.map(bibAchar).filter(function (x) { return !!x; });
  var lista = prontos.map(function (x) {
    return { id: x.id, titulo: x.titulo, miniatura: x.miniatura, capa: bibCapa(x), audio: '/acervo/' + x.id + '.m4a' };
  });
  tocarLocal(lista, prontos.indexOf(m));
}

function mostrarBiblioteca() {
  trocarTela('biblioteca');
  bibCarregar();
}
function mostrarBusca() {
  trocarTela('busca');
}

(function () {
  document.getElementById('aba-curtidas').onclick = function () { bibAba = 'curtidas'; bibDesenhar(); };
  document.getElementById('aba-playlists').onclick = function () { bibAba = 'playlists'; bibAberta = null; bibDesenhar(); };
  document.getElementById('bib-baixar').onclick = uruBaixarTudo;
  setInterval(function () {
    if (bibDados.curtidas.some(function (m) { return m.estado === 'baixando'; })) bibCarregar();
  }, 3000);
  bibCarregar();
})();

function registrarToque(id) {
  fetch('/biblioteca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'tocou', id: id }) })
    .then(function (r) { return r.json(); })
    .then(function (d) { bibDados = d; });
}