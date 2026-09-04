document.addEventListener('DOMContentLoaded', function () {
  const btnMenu = document.getElementById('btnMenu');
  const btnCerrarMenu = document.getElementById('btnCerrarMenu');
  const menuLateral = document.getElementById('menuLateral');
  const overlay = document.getElementById('overlayMenu');

  function abrirMenu() {
    menuLateral.classList.add('abierto');
    overlay.classList.add('visible');
    btnMenu.setAttribute('aria-expanded', 'true');
  }

  function cerrarMenu() {
    menuLateral.classList.remove('abierto');
    overlay.classList.remove('visible');
    btnMenu.setAttribute('aria-expanded', 'false');
  }

  if (btnMenu) btnMenu.addEventListener('click', abrirMenu);
  if (btnCerrarMenu) btnCerrarMenu.addEventListener('click', cerrarMenu);
  if (overlay) overlay.addEventListener('click', cerrarMenu);
});
