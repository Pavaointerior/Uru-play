var campoBusca = document.getElementById('busca');
var pilulaBusca = document.getElementById('busca-pilula');

campoBusca.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    campoBusca.blur();
    buscarMusica(campoBusca.value);
  }
});

function mostrarPilula() {
  pilulaBusca.classList.remove('busca-oculta');
  campoBusca.focus();
}
function esconderPilula() {
  campoBusca.blur();
  pilulaBusca.classList.add('busca-oculta');
}
function pilulaEscondida() { return pilulaBusca.classList.contains('busca-oculta'); }
function limparBusca() { campoBusca.value = ''; }
