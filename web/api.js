/* api.js — faz o papel do servidor.py dentro do APK.
   Carregado antes dos módulos; troca as rotas antigas por chamadas diretas. */
(function () {
  'use strict';

  var BIB = 'uru.biblioteca';
  var KEY = 'uru.chave';
  var CACHE = 'uru.cache';
  var TTL = 12 * 60 * 60 * 1000;

  var fetchOriginal = window.fetch.bind(window);

  function lerJSON(k, padrao) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v === null ? padrao : v; }
    catch (e) { return padrao; }
  }
  function gravarJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function lerBib() {
    var d = lerJSON(BIB, null);
    if (!d) d = { curtidas: [], playlists: [] };
    if (!d.curtidas) d.curtidas = [];
    if (!d.playlists) d.playlists = [];
    d.curtidas.forEach(function (m) {
      if (m.estado === 'baixando' || m.estado === 'erro') m.estado = 'pronto';
    });
    return d;
  }
  function gravarBib(d) { gravarJSON(BIB, d); return d; }

  function migrar() {
    if (lerJSON(BIB, null)) return Promise.resolve(lerBib());
    return fetchOriginal('suabiblioteca/dados.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.curtidas) d = { curtidas: [], playlists: [] };
        return gravarBib(d);
      })
      .catch(function () { return lerBib(); });
  }

  function chave() {
    var k = localStorage.getItem(KEY);
    if (!k) {
      k = window.prompt('Cole a chave da API do YouTube (Google Cloud):');
      if (k) { k = k.trim(); localStorage.setItem(KEY, k); }
    }
    return k || '';
  }
  window.uruTrocarChave = function () { localStorage.removeItem(KEY); location.reload(); };

  function ytGet(recurso, params) {
    var k = chave();
    if (!k) return Promise.reject(new Error('Chave do YouTube não configurada'));

    var ordenado = Object.keys(params).sort().map(function (n) {
      return n + '=' + encodeURIComponent(params[n]);
    }).join('&');
    var ck = recurso + '?' + ordenado;

    var cache = lerJSON(CACHE, {});
    if (cache[ck] && Date.now() - cache[ck].t < TTL) return Promise.resolve(cache[ck].d);

    var url = 'https://www.googleapis.com/youtube/v3/' + recurso + '?' + ordenado +
              '&key=' + encodeURIComponent(k);

    return fetchOriginal(url).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (texto) {
          var msg = 'YouTube recusou (' + r.status + ')';
          try {
            var j = JSON.parse(texto);
            if (j.error && j.error.message) msg += ': ' + j.error.message;
          } catch (e) {}
          throw new Error(msg);
        });
      }
      return r.json();
    }).then(function (d) {
      var agora = Date.now(), novo = {};
      Object.keys(cache).forEach(function (n) {
        if (agora - cache[n].t < 2 * TTL) novo[n] = cache[n];
      });
      novo[ck] = { t: agora, d: d };
      gravarJSON(CACHE, novo);
      return d;
    });
  }

  function itemDe(s, vid, cid) {
    var mini = s.thumbnails || {};
    mini = (mini.medium || mini.default || {}).url || '';
    return {
      id: vid,
      titulo: s.title || '',
      canal: s.channelTitle || s.videoOwnerChannelTitle || '',
      canalId: cid || s.channelId || '',
      miniatura: mini
    };
  }

  /* ---------- busca ---------- */
  function buscar(termo, fase, token) {
    if (!termo) return Promise.resolve({ erro: 'Busca vazia' });
    var p = { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '25', q: termo };
    if (fase === 'musica') p.videoCategoryId = '10';
    if (token) p.pageToken = token;

    return ytGet('search', p).then(function (d) {
      var itens = (d.items || []).map(function (i) { return itemDe(i.snippet, i.id.videoId); });
      if (fase === 'musica') {
        itens.sort(function (a, b) {
          var ta = /- Topic$/.test(a.canal) ? 0 : 1;
          var tb = /- Topic$/.test(b.canal) ? 0 : 1;
          return ta - tb;
        });
      }
      var prox = d.nextPageToken ? { fase: fase, token: d.nextPageToken }
               : (fase === 'musica' ? { fase: 'outros', token: '' } : null);
      return { itens: itens, proxima: prox };
    });
  }

  /* ---------- descobertas ---------- */
  function canais() {
    var d = lerBib(), vistos = {}, lista = [];
    d.curtidas.slice().reverse().forEach(function (m) {
      if (m.canalId && !vistos[m.canalId]) { vistos[m.canalId] = 1; lista.push(m.canalId); }
    });
    return lista.slice(0, 8);
  }

  function novidades() {
    var ids = canais();
    if (!ids.length) return Promise.resolve({ itens: [], proxima: null });

    return Promise.all(ids.map(function (cid) {
      return ytGet('playlistItems', {
        part: 'snippet', maxResults: '20', playlistId: 'UU' + cid.slice(2)
      }).then(function (d) {
        return (d.items || []).map(function (i) {
          var s = i.snippet, vid = s.resourceId && s.resourceId.videoId;
          return vid ? { quando: s.publishedAt || '', item: itemDe(s, vid, cid) } : null;
        }).filter(Boolean);
      }).catch(function () { return []; });
    })).then(function (listas) {
      var todos = [];
      listas.forEach(function (l) { todos = todos.concat(l); });
      todos.sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
      return { itens: todos.slice(0, 20).map(function (x) { return x.item; }), proxima: null };
    });
  }

  function sementes() {
    var nomes = [], guardado = lerJSON('uru.sementes', null);
    if (guardado && Date.now() - guardado.t < TTL) nomes = guardado.n || [];

    if (!nomes.length) {
      lerBib().curtidas.forEach(function (m) {
        var n = (m.canal || '').replace(/\s*-\s*Topic$/, '').trim();
        if (n && nomes.indexOf(n) < 0) nomes.push(n);
      });
      nomes.sort(function () { return Math.random() - 0.5; });
      nomes = nomes.slice(0, 3);
      gravarJSON('uru.sementes', { t: Date.now(), n: nomes });
    }
    if (!nomes.length) return Promise.resolve({ itens: [], proxima: null });

    return Promise.all(nomes.map(function (nome) {
      return ytGet('search', {
        part: 'snippet', type: 'video', videoCategoryId: '10',
        videoEmbeddable: 'true', maxResults: '10', q: nome
      }).then(function (r) {
        return (r.items || []).map(function (i) { return itemDe(i.snippet, i.id.videoId); });
      }).catch(function () { return []; });
    })).then(function (listas) {
      var todos = [];
      listas.forEach(function (l) { todos = todos.concat(l); });
      todos.sort(function () { return Math.random() - 0.5; });
      return { itens: todos, proxima: null };
    });
  }

  function descobertas(fila, token, q) {
    if (fila === 'alta') {
      var p = { part: 'snippet', chart: 'mostPopular', regionCode: 'BR',
                videoCategoryId: '10', maxResults: '24' };
      if (token) p.pageToken = token;
      return ytGet('videos', p).then(function (d) {
        return {
          itens: (d.items || []).map(function (v) { return itemDe(v.snippet, v.id); }),
          proxima: d.nextPageToken || null
        };
      });
    }
    if (fila === 'tema' && q) {
      var p2 = { part: 'snippet', type: 'video', videoCategoryId: '10',
                 videoEmbeddable: 'true', maxResults: '20', q: q };
      if (token) p2.pageToken = token;
      return ytGet('search', p2).then(function (d) {
        return {
          itens: (d.items || []).map(function (i) { return itemDe(i.snippet, i.id.videoId); }),
          proxima: d.nextPageToken || null
        };
      });
    }
    if (fila === 'novidades') return novidades();
    if (fila === 'descobertas') return sementes();
    return Promise.resolve({ erro: 'Fila desconhecida' });
  }

  /* ---------- biblioteca ---------- */
  function aplicarBiblioteca(a) {
    a = a || {};
    var d = lerBib();
    var vid = String(a.id || '');
    var nome = String(a.playlist || '').trim().slice(0, 80);
    var achada = d.curtidas.filter(function (m) { return m.id === vid; })[0];
    var idOk = /^[A-Za-z0-9_-]{11}$/.test(vid);

    if (a.acao === 'curtir' && idOk) {
      if (!achada) {
        d.curtidas.push({
          id: vid,
          titulo: String(a.titulo || '').slice(0, 200),
          canal: String(a.canal || '').slice(0, 100),
          miniatura: String(a.miniatura || '').slice(0, 300),
          canalId: String(a.canalId || '').slice(0, 40),
          curtida_em: Date.now() / 1000,
          estado: 'pronto'
        });
      }
    } else if (a.acao === 'tocou' && achada) {
      achada.tocada_em = Date.now() / 1000;
    } else if (a.acao === 'descurtir' && achada) {
      if (window.UruNativo) { try { UruNativo.apagar(vid); } catch (e) {} }
      d.curtidas = d.curtidas.filter(function (m) { return m.id !== vid; });
      d.playlists.forEach(function (p) {
        p.ids = p.ids.filter(function (x) { return x !== vid; });
      });
    } else if (a.acao === 'criarplaylist' && nome) {
      if (!d.playlists.some(function (p) { return p.nome === nome; })) {
        d.playlists.push({ nome: nome, ids: [] });
      }
    } else if (a.acao === 'addplaylist' || a.acao === 'tirarplaylist' || a.acao === 'apagarplaylist') {
      var p = d.playlists.filter(function (x) { return x.nome === nome; })[0];
      if (p) {
        if (a.acao === 'addplaylist' && achada && p.ids.indexOf(vid) < 0) p.ids.push(vid);
        else if (a.acao === 'tirarplaylist') {
          p.ids = p.ids.filter(function (x) { return x !== vid; });
        } else if (a.acao === 'apagarplaylist') {
          d.playlists = d.playlists.filter(function (x) { return x !== p; });
        }
      }
    }
    return gravarBib(d);
  }

  function resp(p) {
    return Promise.resolve(p).then(function (d) {
      return { ok: true, json: function () { return Promise.resolve(d); } };
    }, function (e) {
      var d = { erro: (e && e.message) || 'Falha na rede' };
      return { ok: false, json: function () { return Promise.resolve(d); } };
    });
  }

  window.fetch = function (entrada, init) {
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    var metodo = ((init && init.method) || 'GET').toUpperCase();

    if (url === '/biblioteca' || url === 'biblioteca') {
      if (metodo === 'POST') {
        var corpo = {};
        try { corpo = JSON.parse((init && init.body) || '{}'); } catch (e) {}
        return resp(aplicarBiblioteca(corpo));
      }
      return resp(migrar());
    }
    if (url.indexOf('/buscar?') === 0 || url.indexOf('buscar?') === 0) {
      var q1 = new URLSearchParams(url.split('?')[1]);
      return resp(buscar(q1.get('q') || '', q1.get('fase') || 'musica', q1.get('token') || ''));
    }
    if (url.indexOf('/descobertas?') === 0 || url.indexOf('descobertas?') === 0) {
      var q2 = new URLSearchParams(url.split('?')[1]);
      return resp(descobertas(q2.get('fila') || '', q2.get('token') || '', q2.get('q') || ''));
    }
    return fetchOriginal(entrada, init);
  };
})();
