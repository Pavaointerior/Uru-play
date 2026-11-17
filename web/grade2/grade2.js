var TEMAS = ['Cantos de medicina', 'Instrumental', 'Relaxar', 'MPB', 'Meditação'];
var g2Iniciado = false, g2LinhaTema = null;

function g2Escondida() {
  var t = document.getElementById('grade2-tela');
  return !t || t.classList.contains('g2-oculta');
}

function mostrarDescobertas() {
  trocarTela('descobertas');
  abrirDescobertas();
}

function g2Embaralhar(v) {
  for (var i = v.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = v[i]; v[i] = v[j]; v[j] = t;
  }
  return v;
}

function g2Pedir(fila, token, q) {
  var url = '/descobertas?fila=' + fila + '&token=' + encodeURIComponent(token || '') + (q ? '&q=' + encodeURIComponent(q) : '');
  return fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d.erro) throw new Error(d.erro); return d; });
}

function g2Cartao(m, aoClicar, capa, comCoracao) {
  var c = document.createElement('div');
  c.className = 'g2-cartao';
  var img = document.createElement('img');
  img.loading = 'lazy';
  img.onerror = function () { img.onerror = null; img.src = m.miniatura; };
  img.src = capa || m.miniatura;
  var t = document.createElement('div');
  t.className = 'g2-cartao-titulo';
  t.textContent = m.titulo;
  var canal = document.createElement('div');
  canal.className = 'g2-cartao-canal';
  canal.textContent = m.canal || '';
  c.appendChild(img);
  c.appendChild(t);
  c.appendChild(canal);
  if (comCoracao) {
    var cor = document.createElement('button');
    cor.className = 'g2-coracao';
    cor.dataset.id = m.id;
    cor.textContent = jaCurtido(m.id) ? '♥' : '♡';
    cor.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!window.bibApi) return;
      if (jaCurtido(m.id)) bibApi({ acao: 'descurtir', id: m.id });
      else bibApi({ acao: 'curtir', id: m.id, titulo: m.titulo, canal: m.canal, miniatura: m.miniatura, canalId: m.canalId });
    });
    c.appendChild(cor);
  }
  c.addEventListener('click', aoClicar);
  return c;
}

function g2Fileira(id, buscar) {
  var el = document.getElementById(id);
  el.innerHTML = '';
  var est = { token: '', fim: false, carregando: false, vistos: {}, itens: [], aoCarregar: null, parado: false };
  var fim = document.createElement('div');
  fim.className = 'g2-aviso';
  el.appendChild(fim);
  var obs = new IntersectionObserver(function (es) {
    if (es[0].isIntersecting) carregar();
  }, { root: el, rootMargin: '0px 300px 0px 0px' });
  obs.observe(fim);

  function carregar() {
    if (est.parado || est.carregando || est.fim) return;
    est.carregando = true;
    buscar(est.token).then(function (d) {
      if (est.parado) return;
      est.carregando = false;
      d.itens.forEach(function (m) {
        if (est.vistos[m.id]) return;
        est.vistos[m.id] = true;
        est.itens.push(m);
        el.insertBefore(g2Cartao(m, function () { tocarYT(est.itens, est.itens.indexOf(m)); }, null, true), fim);
      });
      est.token = d.proxima || '';
      est.fim = !d.proxima;
      fim.textContent = (est.fim && !est.itens.length) ? 'Nada por aqui ainda.' : '';
      if (window.atualizarCoracoes) atualizarCoracoes();
      if (est.aoCarregar) { var f = est.aoCarregar; est.aoCarregar = null; f(); }
      if (!est.fim) { obs.unobserve(fim); obs.observe(fim); }
    }).catch(function (e) {
      if (est.parado) return;
      est.carregando = false;
      est.fim = true;
      fim.textContent = e.message || 'Erro ao carregar.';
    });
  }

  est.itens.pedirMais = function (cb) {
    if (est.fim) return;
    est.aoCarregar = cb;
    carregar();
  };
  return { parar: function () { est.parado = true; obs.disconnect(); } };
}

function g2Acervo() {
  var el = document.getElementById('g2-acervo');
  el.innerHTML = '';
  var prontas = (window.bibDados ? bibDados.curtidas : []).filter(function (m) { return m.estado === 'pronto'; });
  if (!prontas.length) {
    var p = document.createElement('div');
    p.className = 'g2-aviso';
    p.textContent = 'Curta músicas e elas aparecem aqui.';
    el.appendChild(p);
    return;
  }
  prontas.sort(function (a, b) { return (a.tocada_em || a.curtida_em || 0) - (b.tocada_em || b.curtida_em || 0); });
  var fila = g2Embaralhar(prontas.slice(0, 30)).map(function (x) {
    return { id: x.id, titulo: x.titulo, canal: x.canal, miniatura: x.miniatura,
             capa: x.miniatura, audio: '/acervo/' + x.id + '.m4a' };
  });
  fila.forEach(function (m, i) {
    el.appendChild(g2Cartao(m, function () { tocarLocal(fila, i); }, m.capa, false));
  });
}

function g2Tema(nome) {
  document.querySelectorAll('.g2-pilula').forEach(function (b) {
    b.classList.toggle('ativa', b.textContent === nome);
  });
  if (g2LinhaTema) g2LinhaTema.parar();
  g2LinhaTema = g2Fileira('g2-tema', function (t) { return g2Pedir('tema', t, nome); });
}

function g2Pilulas() {
  var box = document.getElementById('g2-pilulas');
  box.innerHTML = '';
  TEMAS.forEach(function (nome) {
    var b = document.createElement('button');
    b.className = 'g2-pilula';
    b.textContent = nome;
    b.addEventListener('click', function () { g2Tema(nome); });
    box.appendChild(b);
  });
  g2Tema(TEMAS[0]);
}

function abrirDescobertas() {
  bibCarregar().then(g2Acervo, g2Acervo);
  if (g2Iniciado) return;
  g2Iniciado = true;
  g2Fileira('g2-novidades', function (t) { return g2Pedir('novidades', t); });
  g2Pilulas();
  g2Fileira('g2-descobertas', function (t) { return g2Pedir('descobertas', t); });
}
