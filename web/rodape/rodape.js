document.getElementById('rodape-inicio').addEventListener('click', function () {
  var lista = document.getElementById('grade1-lista');
  var tela = document.getElementById('bib-tela');
  var inicial = (!lista || !lista.firstChild)
    && (!tela || tela.classList.contains('bib-oculta'))
    && g2Escondida()
    && pilulaEscondida();
  if (inicial) { location.reload(); return; }
  if (window.bus) { bus.fim = true; bus.rodada++; }
  mostrarBusca();
  if (lista) lista.innerHTML = '';
  limparBusca();
  esconderPilula();
});

document.getElementById('rodape-biblioteca').addEventListener('click', function () {
  esconderPilula();
  mostrarBiblioteca();
});

document.getElementById('rodape-pesquisa').addEventListener('click', function () {
  mostrarBusca();
  mostrarPilula();
});

document.getElementById('rodape-descobertas').addEventListener('click', function () {
  esconderPilula();
  mostrarDescobertas();
});
