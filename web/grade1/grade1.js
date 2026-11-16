var bus = { termo: '', fase: 'musica', token: '', carregando: false, fim: true, vistos: {}, rodada: 0, primeira: true, divisor: false, aoCarregar: null };
var sentinela = null, observador = null;
var resultados = [];

function jaCurtido(id) {
  return !!(window.bibDados && bibDados.curtidas.some(function (m) { return m.id === id; }));
}
function atualizarCoracoes() {
  document.querySelectorAll('.grade1-coracao, .g2-coracao').forEach(function (c) {
    c.textContent = jaCurtido(c.dataset.id) ? '♥' : '♡';
  });
}

function grade1Aviso(texto) {
  var lista = document.getElementById('grade1-lista');
  lista.innerHTML = '';
  var p = document.createElement('p');
  p.className = 'grade1-aviso';
  p.textContent = texto;
  lista.appendChild(p);
}

function grade1Fim(texto) {
  var lista = document.getElementById('grade1-lista');
  if (!sentinela) {
    sentinela = document.createElement('div');
    sentinela.className = 'grade1-aviso';
    observador = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) carregarMais();
    }, { rootMargin: '600px' });
    observador.observe(sentinela);
  }
  sentinela.textContent = texto;
  lista.appendChild(sentinela);
  if (!bus.fim) {
    observador.unobserve(sentinela);
    observador.observe(sentinela);
  }
}

function grade1Item(m) {
  var item = document.createElement('div');
  item.className = 'grade1-item';
  var img = document.createElement('img');
  img.src = m.miniatura;
  var texto = document.createElement('div');
  texto.className = 'grade1-texto';
  var t = document.createElement('div');
  t.className = 'grade1-titulo';
  t.textContent = m.titulo;
  var c = document.createElement('div');
  c.className = 'grade1-canal';
  c.textContent = m.canal;
  texto.appendChild(t);
  texto.appendChild(c);
  var cor = document.createElement('button');
  cor.className = 'grade1-coracao';
  cor.dataset.id = m.id;
  cor.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!window.bibApi) return;
    if (jaCurtido(m.id)) bibApi({ acao: 'descurtir', id: m.id });
    else bibApi({ acao: 'curtir', id: m.id, titulo: m.titulo, canal: m.canal, miniatura: m.miniatura, canalId: m.canalId });
  });
  item.appendChild(img);
  item.appendChild(texto);
  item.appendChild(cor);
  item.addEventListener('click', function () { tocarYT(resultados, resultados.indexOf(m)); });
  return item;
}

function pedirMaisResultados(aoCarregar) {
  if (bus.fim) return;
  bus.aoCarregar = aoCarregar;
  carregarMais();
}

function carregarMais() {
  if (bus.carregando || bus.fim) return;
  bus.carregando = true;
  var rodada = bus.rodada, fase = bus.fase;
  fetch('/buscar?q=' + encodeURIComponent(bus.termo) + '&fase=' + fase + '&token=' + encodeURIComponent(bus.token))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (rodada !== bus.rodada) return;
      bus.carregando = false;
      var lista = document.getElementById('grade1-lista');
      if (d.erro) {
        bus.fim = true;
        if (bus.primeira) grade1Aviso(d.erro); else grade1Fim(d.erro);
        return;
      }
      var novos = d.itens.filter(function (m) { return !bus.vistos[m.id]; });
      if (bus.primeira) lista.innerHTML = '';
      if (fase === 'outros' && novos.length && !bus.divisor) {
        var h = document.createElement('p');
        h.className = 'grade1-aviso';
        h.textContent = 'Outros vídeos';
        lista.appendChild(h);
        bus.divisor = true;
      }
      novos.forEach(function (m) {
        bus.vistos[m.id] = true;
        resultados.push(m);
        lista.appendChild(grade1Item(m));
      });
      bus.primeira = false;
      if (d.proxima) { bus.fase = d.proxima.fase; bus.token = d.proxima.token; }
      else bus.fim = true;
      atualizarCoracoes();
      if (!bus.fim) grade1Fim('Carregando mais...');
      else grade1Fim(Object.keys(bus.vistos).length ? 'Fim dos resultados' : 'Nada encontrado.');
      if (bus.aoCarregar) { var f = bus.aoCarregar; bus.aoCarregar = null; f(); }
    })
    .catch(function () {
      if (rodada !== bus.rodada) return;
      bus.carregando = false;
      bus.fim = true;
      if (bus.primeira) grade1Aviso('Erro ao buscar.'); else grade1Fim('Erro ao buscar.');
    });
}

function buscarMusica(termo) {
  termo = termo.trim();
  if (!termo) return;
  if (window.mostrarBusca) mostrarBusca();
  resultados = [];
  bus = { termo: termo, fase: 'musica', token: '', carregando: false, fim: false, vistos: {}, rodada: bus.rodada + 1, primeira: true, divisor: false, aoCarregar: null };
  grade1Aviso('Buscando...');
  carregarMais();
}
