var ytPlayer = null, ytPronto = false, ytPendente = null;
var modo = null;
var filaYT = [], posYT = -1, filaLocal = [], posLocal = -1;

function plEl(id) { return document.getElementById(id); }
function plFmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

function plModo(m) {
  modo = m;
  var f = plEl('pl-faixa');
  f.classList.remove('pl-oculta', 'pl-yt', 'pl-local');
  f.classList.add(m === 'local' ? 'pl-local' : 'pl-yt');
}
function plIcone(tocando) {
  plEl('pl-play-ico').setAttribute('d', tocando
    ? 'M22 18 H28 V42 H22 Z M32 18 H38 V42 H32 Z'
    : 'M24 18 L24 42 L44 30 Z');
}
function plProgresso(atual, total) {
  plEl('pl-prog').style.width = (total ? atual / total * 100 : 0) + '%';
  plEl('pl-tempo').textContent = plFmt(atual);
}

/* ---------- YouTube ---------- */
(function () {
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.body.appendChild(s);
})();

function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('pl-yt-api', {
    width: '100%',
    height: '100%',
    playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, iv_load_policy: 3 },
    events: {
      onReady: function () {
        ytPronto = true;
        if (ytPendente) { ytPlayer.loadVideoById(ytPendente.id); ytPendente = null; }
      },
      onStateChange: function (e) {
        if (modo !== 'yt') return;
        if (e.data === 1) plIcone(true);
        else if (e.data === 2) plIcone(false);
        else if (e.data === 0) { plIcone(false); tocarProximo(); }
      },
      onError: function () { if (modo === 'yt') tocarProximo(); }
    }
  });
}

function tocarYT(lista, pos) {
  if (modo === 'local') pararLocal();
  filaYT = lista;
  posYT = pos;
  plModo('yt');
  var m = lista[pos];
  plEl('pl-titulo').textContent = m.titulo;
  plProgresso(0, 0);
  if (!ytPronto) { ytPendente = m; return; }
  ytPlayer.loadVideoById(m.id);
}

function tocarOuPausar() {
  if (!ytPronto) return;
  if (ytPlayer.getPlayerState() === 1) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
}

/* ---------- Áudio baixado (curtidas e playlists) ---------- */
function tocarLocal(lista, pos) {
  if (ytPronto) ytPlayer.pauseVideo();
  filaLocal = lista;
  plModo('local');
  localIr(pos);
}

function localIr(pos) {
  if (pos < 0 || pos >= filaLocal.length) { pararLocal(); return; }
  posLocal = pos;
  var m = filaLocal[pos];
  if (window.registrarToque) registrarToque(m.id);
  var capa = plEl('pl-capa');
  capa.onerror = function () { capa.onerror = null; capa.src = m.miniatura || ''; };
  capa.src = m.capa || m.miniatura || '';
  plEl('pl-titulo').textContent = m.titulo;
  plProgresso(0, 0);
  var a = plEl('pl-audio');
  a.src = m.audio;
  var p = a.play();
  if (p && p.catch) p.catch(function () {});
}

function pararLocal() {
  plEl('pl-audio').pause();
  modo = null;
  plEl('pl-faixa').classList.add('pl-oculta');
  plIcone(false);
}

function tocarOuPausarLocal() {
  var a = plEl('pl-audio');
  if (a.paused) a.play(); else a.pause();
}

/* ---------- Controles comuns ---------- */
function tocarProximo() {
  if (modo === 'yt') {
    if (posYT + 1 < filaYT.length) { tocarYT(filaYT, posYT + 1); return; }
    var mais = (filaYT === window.resultados) ? window.pedirMaisResultados : filaYT.pedirMais;
    if (mais) {
      mais(function () {
        if (modo === 'yt' && posYT + 1 < filaYT.length) tocarYT(filaYT, posYT + 1);
      });
    }
  } else if (modo === 'local') {
    if (posLocal + 1 < filaLocal.length) localIr(posLocal + 1);
    else pararLocal();
  }
}

function tocarAnterior() {
  if (modo === 'yt') {
    if (ytPronto && ytPlayer.getCurrentTime() > 3) { ytPlayer.seekTo(0, true); return; }
    if (posYT > 0) tocarYT(filaYT, posYT - 1);
  } else if (modo === 'local') {
    var a = plEl('pl-audio');
    if (a.currentTime > 3) a.currentTime = 0;
    else localIr(Math.max(0, posLocal - 1));
  }
}

(function () {
  var a = plEl('pl-audio');
  a.addEventListener('play', function () { if (modo === 'local') plIcone(true); });
  a.addEventListener('pause', function () { if (modo === 'local') plIcone(false); });
  a.addEventListener('ended', function () { if (modo === 'local') tocarProximo(); });
  a.addEventListener('error', function () {
    if (modo !== 'local') return;
    var falhou = filaLocal[posLocal];
    if (falhou && falhou.id) {
      tocarYT([{ id: falhou.id, titulo: falhou.titulo }], 0);
      return;
    }
    tocarProximo();
  });
  a.addEventListener('timeupdate', function () {
    if (modo === 'local') plProgresso(a.currentTime, a.duration);
  });

  plEl('pl-play').addEventListener('click', function () {
    if (modo === 'local') tocarOuPausarLocal(); else tocarOuPausar();
  });
  plEl('pl-ant').addEventListener('click', tocarAnterior);
  plEl('pl-prox').addEventListener('click', tocarProximo);

  plEl('pl-barra').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    var f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (modo === 'yt' && ytPronto) {
      var d = ytPlayer.getDuration();
      if (d) { ytPlayer.seekTo(f * d, true); plProgresso(f * d, d); }
    } else if (modo === 'local' && isFinite(a.duration)) {
      a.currentTime = f * a.duration;
    }
  });

  setInterval(function () {
    if (modo === 'yt' && ytPronto && ytPlayer.getPlayerState() === 1) {
      plProgresso(ytPlayer.getCurrentTime(), ytPlayer.getDuration());
    }
  }, 500);
})();
