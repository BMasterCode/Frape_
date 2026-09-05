// Filtra filas de una o varias tablas según lo que se escriba en un buscador.
// Cada <tr> a filtrar debe tener el atributo data-nombre="texto en minúsculas".
function activarBuscador(inputId, ...tablaIds) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const tablas = tablaIds.map((id) => document.getElementById(id)).filter(Boolean);

  input.addEventListener('input', function () {
    const q = input.value.trim().toLowerCase();
    tablas.forEach(function (tabla) {
      tabla.querySelectorAll('tbody tr[data-nombre]').forEach(function (fila) {
        const nombre = fila.getAttribute('data-nombre') || '';
        fila.style.display = nombre.includes(q) ? '' : 'none';
      });
    });
  });
}
