const pool = require('../db/pool');

// Categorías de ingreso y gasto (deben coincidir con lo que usan las vistas/formularios)
const SERVICIOS_INGRESO = {
  frappe: 'Venta de frappes/refrescos',
  masita: 'Venta de masitas/snacks',
  juego_cartas: 'Alquiler juego de cartas (por hora/juego)',
  juego_mesa_persona: 'Alquiler juego de mesa tipo Catan (por hora/persona)',
  otro_ingreso: 'Otros ingresos',
};

const SERVICIOS_GASTO = {
  insumos: 'Costo de insumos (café, leche, ingredientes)',
  sueldos: 'Sueldos',
  servicios: 'Servicios (luz, agua, internet)',
  financiero: 'Gastos financieros (intereses)',
  otro_gasto: 'Otros gastos',
};

function mesDeFecha(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function obtenerConfigEmpresa() {
  const r = await pool.query('SELECT * FROM empresa_config WHERE id = 1');
  return r.rows[0];
}

// Depreciación en línea recta, igual que en el Excel original
async function obtenerActivosConDepreciacion() {
  const r = await pool.query('SELECT * FROM activos_fijos WHERE activo = TRUE ORDER BY fecha_compra');
  const hoy = new Date();

  return r.rows.map((a) => {
    const costo = Number(a.costo);
    const residual = Number(a.valor_residual);
    const vidaUtil = Number(a.vida_util_anios);
    const depreciacionAnual = vidaUtil > 0 ? (costo - residual) / vidaUtil : 0;

    const fechaCompra = new Date(a.fecha_compra);
    const aniosTranscurridos = (hoy - fechaCompra) / (1000 * 60 * 60 * 24 * 365.25);
    let depreciacionAcumulada = depreciacionAnual * Math.max(aniosTranscurridos, 0);
    depreciacionAcumulada = Math.min(depreciacionAcumulada, costo - residual);

    const valorEnLibros = costo - depreciacionAcumulada;
    const depreciacionMensual = depreciacionAnual / 12;

    return {
      ...a,
      depreciacion_anual: depreciacionAnual,
      depreciacion_acumulada: depreciacionAcumulada,
      depreciacion_mensual: depreciacionMensual,
      valor_en_libros: valorEnLibros,
    };
  });
}

async function totalDepreciacionMensual() {
  const activos = await obtenerActivosConDepreciacion();
  return activos.reduce((sum, a) => sum + a.depreciacion_mensual, 0);
}

async function totalValorEnLibrosActivos() {
  const activos = await obtenerActivosConDepreciacion();
  return activos.reduce((sum, a) => sum + a.valor_en_libros, 0);
}

// Estado de resultados de un mes ('YYYY-MM'), calculado desde los movimientos diarios
async function obtenerEstadoResultados(mes) {
  const ingresosPorServicio = await pool.query(
    `SELECT servicio, COALESCE(SUM(monto),0) AS total
     FROM movimientos
     WHERE tipo = 'ingreso' AND to_char(fecha, 'YYYY-MM') = $1
     GROUP BY servicio`,
    [mes]
  );
  const gastosPorServicio = await pool.query(
    `SELECT servicio, COALESCE(SUM(monto),0) AS total
     FROM movimientos
     WHERE tipo = 'gasto' AND to_char(fecha, 'YYYY-MM') = $1
     GROUP BY servicio`,
    [mes]
  );

  const ingresos = {};
  Object.keys(SERVICIOS_INGRESO).forEach((k) => (ingresos[k] = 0));
  ingresosPorServicio.rows.forEach((r) => (ingresos[r.servicio] = Number(r.total)));

  const gastos = {};
  Object.keys(SERVICIOS_GASTO).forEach((k) => (gastos[k] = 0));
  gastosPorServicio.rows.forEach((r) => (gastos[r.servicio] = Number(r.total)));

  const totalIngresos = Object.values(ingresos).reduce((a, b) => a + b, 0);
  const depreciacionMes = await totalDepreciacionMensual();
  const totalGastosOperativos = Object.values(gastos).reduce((a, b) => a + b, 0);
  const totalEgresos = totalGastosOperativos + depreciacionMes;

  const utilidadVariada = totalIngresos - totalEgresos;

  const config = await obtenerConfigEmpresa();
  const alquiler = utilidadVariada * Number(config.pct_alquiler);
  const utilidadNeta = utilidadVariada - alquiler;

  const divisiones = {
    reinversion: utilidadNeta * Number(config.pct_reinversion),
    dividendos: utilidadNeta * Number(config.pct_dividendos),
    reserva: utilidadNeta * Number(config.pct_reserva),
    deudas: utilidadNeta * Number(config.pct_deudas),
    capital_trabajo: utilidadNeta * Number(config.pct_capital_trabajo),
  };

  return {
    mes,
    ingresos,
    gastos,
    depreciacionMes,
    totalIngresos,
    totalEgresos,
    utilidadVariada,
    alquiler,
    utilidadNeta,
    divisiones,
  };
}

// Historial mensual: uno o varios meses, calculado directamente (sin copiar/pegar)
async function obtenerHistorialMensual() {
  const meses = await pool.query(
    `SELECT DISTINCT to_char(fecha, 'YYYY-MM') AS mes FROM movimientos ORDER BY mes DESC`
  );
  const resultado = [];
  for (const { mes } of meses.rows) {
    resultado.push(await obtenerEstadoResultados(mes));
  }
  return resultado;
}

// Historial semanal: agrupa movimientos por semana (inicio lunes)
async function obtenerHistorialSemanal() {
  const r = await pool.query(`
    SELECT
      date_trunc('week', fecha)::date AS semana_inicio,
      to_char(fecha, 'YYYY-MM') AS mes,
      SUM(CASE WHEN tipo='ingreso' AND servicio='frappe' THEN monto ELSE 0 END) AS ingresos_frappes,
      SUM(CASE WHEN tipo='ingreso' AND servicio='masita' THEN monto ELSE 0 END) AS ingresos_masitas,
      SUM(CASE WHEN tipo='ingreso' AND servicio IN ('juego_cartas','juego_mesa_persona') THEN monto ELSE 0 END) AS ingresos_juegos,
      SUM(CASE WHEN tipo='ingreso' AND servicio='otro_ingreso' THEN monto ELSE 0 END) AS otros_ingresos,
      SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS total_ingresos,
      SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END) AS total_gastos_operativos
    FROM movimientos
    GROUP BY semana_inicio, mes
    ORDER BY semana_inicio DESC
  `);

  const depreciacionMes = await totalDepreciacionMensual();
  const config = await obtenerConfigEmpresa();
  const depreciacionSemanal = depreciacionMes / 4.345; // promedio de semanas por mes

  return r.rows.map((row) => {
    const totalEgresos = Number(row.total_gastos_operativos) + depreciacionSemanal;
    const utilidadVariada = Number(row.total_ingresos) - totalEgresos;
    const alquiler = utilidadVariada * Number(config.pct_alquiler);
    const utilidadNeta = utilidadVariada - alquiler;
    return {
      ...row,
      total_egresos: totalEgresos,
      utilidad_variada: utilidadVariada,
      alquiler,
      utilidad_neta: utilidadNeta,
      reinversion: utilidadNeta * Number(config.pct_reinversion),
      dividendos: utilidadNeta * Number(config.pct_dividendos),
      reserva: utilidadNeta * Number(config.pct_reserva),
      pago_deudas: utilidadNeta * Number(config.pct_deudas),
      capital_trabajo: utilidadNeta * Number(config.pct_capital_trabajo),
    };
  });
}

// Ganancia total de cada socio = suma de (utilidad neta de cada mes * % participación)
async function obtenerGananciasSocios() {
  const socios = await pool.query('SELECT * FROM socios WHERE activo = TRUE ORDER BY acciones DESC');
  const config = await obtenerConfigEmpresa();
  const historialMensual = await obtenerHistorialMensual();
  const utilidadNetaAcumulada = historialMensual.reduce((sum, m) => sum + m.utilidadNeta, 0);

  const cobros = await pool.query(
    `SELECT socio_id, COALESCE(SUM(monto),0) AS total_cobrado FROM cobros_dividendos GROUP BY socio_id`
  );
  const cobradoPorSocio = {};
  cobros.rows.forEach((c) => (cobradoPorSocio[c.socio_id] = Number(c.total_cobrado)));

  return socios.rows.map((s) => {
    const porcentaje = Number(config.total_acciones) > 0 ? Number(s.acciones) / Number(config.total_acciones) : 0;
    const gananciaTotal = utilidadNetaAcumulada * porcentaje;
    const cobrado = cobradoPorSocio[s.id] || 0;
    return {
      ...s,
      porcentaje,
      ganancia_total: gananciaTotal,
      cobrado,
      saldo_pendiente: gananciaTotal - cobrado,
    };
  });
}

module.exports = {
  SERVICIOS_INGRESO,
  SERVICIOS_GASTO,
  mesDeFecha,
  obtenerConfigEmpresa,
  obtenerActivosConDepreciacion,
  totalDepreciacionMensual,
  totalValorEnLibrosActivos,
  obtenerEstadoResultados,
  obtenerHistorialMensual,
  obtenerHistorialSemanal,
  obtenerGananciasSocios,
};
