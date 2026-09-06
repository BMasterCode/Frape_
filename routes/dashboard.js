const express = require('express');
const pool = require('../db/pool');
const { requierePermisoVer, requierePermisoEditar } = require('../middleware/auth');
const calc = require('../lib/calculos');
const { fechaHoyBolivia, mesActualBolivia } = require('../lib/fecha');

const router = express.Router();

router.get('/', (req, res) => res.redirect('/ingresos-gastos'));

// ============================================================
// INGRESOS Y GASTOS DEL DÍA
// ============================================================
router.get('/ingresos-gastos', requierePermisoVer('ingresos_gastos'), async (req, res) => {
  const fecha = req.query.fecha || fechaHoyBolivia();
  const mes = fecha.slice(0, 7);

  const movimientosDia = await pool.query(
    `SELECT m.*, u.nombre AS usuario_nombre, mp.nombre AS producto_nombre
     FROM movimientos m
     LEFT JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN menu_productos mp ON mp.id = m.producto_id
     WHERE m.fecha = $1 ORDER BY m.creado_en DESC`,
    [fecha]
  );

  const totalesDia = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) AS ingresos,
       COALESCE(SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END),0) AS gastos
     FROM movimientos WHERE fecha = $1`,
    [fecha]
  );

  const totalesMes = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) AS ingresos,
       COALESCE(SUM(CASE WHEN tipo='gasto' THEN monto ELSE 0 END),0) AS gastos
     FROM movimientos WHERE to_char(fecha,'YYYY-MM') = $1`,
    [mes]
  );

  const menu = await calc.obtenerMenu();

  res.render('dashboard/ingresos-gastos', {
    fecha,
    mes,
    movimientos: movimientosDia.rows,
    totalesDia: totalesDia.rows[0],
    totalesMes: totalesMes.rows[0],
    serviciosIngreso: calc.SERVICIOS_INGRESO,
    serviciosGasto: calc.SERVICIOS_GASTO,
    menu,
  });
});

router.post('/ingresos-gastos', requierePermisoEditar('ingresos_gastos'), async (req, res) => {
  const { fecha, tipo, servicio, producto_id, cantidad, descripcion, horas, personas, tarifa, monto } = req.body;

  const r = await pool.query(
    `INSERT INTO movimientos (fecha, tipo, servicio, producto_id, cantidad, descripcion, horas, personas, tarifa, monto, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      fecha,
      tipo,
      servicio,
      producto_id || null,
      cantidad || null,
      descripcion || null,
      horas || null,
      personas || null,
      tarifa || null,
      monto,
      req.session.usuario ? req.session.usuario.id : null,
    ]
  );

  // Si fue una venta de frappe/masita ligada a un producto del menú, descuenta inventario
  if (tipo === 'ingreso' && producto_id && cantidad) {
    await calc.descontarInventarioPorVenta(Number(producto_id), Number(cantidad));
  }

  res.redirect(`/ingresos-gastos?fecha=${fecha}`);
});

router.post('/ingresos-gastos/:id/eliminar', requierePermisoEditar('ingresos_gastos'), async (req, res) => {
  const r = await pool.query('SELECT fecha FROM movimientos WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM movimientos WHERE id = $1', [req.params.id]);
  const fecha = r.rows[0] ? r.rows[0].fecha.toISOString().slice(0, 10) : '';
  res.redirect(`/ingresos-gastos?fecha=${fecha}`);
});

// ============================================================
// ACTIVOS FIJOS
// ============================================================
router.get('/activos-fijos', requierePermisoVer('activos_fijos'), async (req, res) => {
  const activos = await calc.obtenerActivosConDepreciacion();
  const totales = activos.reduce(
    (acc, a) => ({
      costo: acc.costo + Number(a.costo),
      depreciacion_anual: acc.depreciacion_anual + a.depreciacion_anual,
      depreciacion_acumulada: acc.depreciacion_acumulada + a.depreciacion_acumulada,
      valor_en_libros: acc.valor_en_libros + a.valor_en_libros,
    }),
    { costo: 0, depreciacion_anual: 0, depreciacion_acumulada: 0, valor_en_libros: 0 }
  );
  res.render('dashboard/activos-fijos', { activos, totales });
});

router.post('/activos-fijos', requierePermisoEditar('activos_fijos'), async (req, res) => {
  const { nombre, fecha_compra, costo, vida_util_anios, valor_residual } = req.body;
  await pool.query(
    `INSERT INTO activos_fijos (nombre, fecha_compra, costo, vida_util_anios, valor_residual)
     VALUES ($1,$2,$3,$4,$5)`,
    [nombre, fecha_compra, costo, vida_util_anios, valor_residual || 0]
  );
  res.redirect('/activos-fijos');
});

router.post('/activos-fijos/:id/eliminar', requierePermisoEditar('activos_fijos'), async (req, res) => {
  await pool.query('UPDATE activos_fijos SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.redirect('/activos-fijos');
});

// ============================================================
// ACTIVOS CORRIENTES (INVENTARIO)
// ============================================================
router.get('/activos-corrientes', requierePermisoVer('activos_corrientes'), async (req, res) => {
  const inventario = await calc.obtenerInventario();
  const totalValor = inventario.reduce((sum, i) => sum + i.valor_total, 0);
  res.render('dashboard/activos-corrientes', { inventario, totalValor });
});

// Crear un producto/insumo nuevo: se indica cuánto costó en total esa compra
// y cuánta cantidad se compró; el precio por unidad se calcula solo.
router.post('/activos-corrientes', requierePermisoEditar('activos_corrientes'), async (req, res) => {
  const { nombre, unidad, costo_total, cantidad, stock_minimo } = req.body;
  const cant = Number(cantidad) || 0;
  const costo = Number(costo_total) || 0;
  const precioUnitario = cant > 0 ? costo / cant : 0;
  await pool.query(
    `INSERT INTO inventario (nombre, unidad, stock, precio_unitario, stock_minimo)
     VALUES ($1,$2,$3,$4,$5)`,
    [nombre, unidad, cant, precioUnitario, stock_minimo || 0]
  );
  res.redirect('/activos-corrientes');
});

// Registrar una nueva compra/reposición de un insumo ya existente:
// recalcula el precio por unidad como costo promedio ponderado.
router.post('/activos-corrientes/agregar-stock', requierePermisoEditar('activos_corrientes'), async (req, res) => {
  const { inventario_id, costo_total, cantidad } = req.body;
  const cantNueva = Number(cantidad) || 0;
  const costoNuevo = Number(costo_total) || 0;

  const actual = await pool.query('SELECT stock, precio_unitario FROM inventario WHERE id = $1', [inventario_id]);
  if (actual.rows[0]) {
    const stockActual = Number(actual.rows[0].stock);
    const precioActual = Number(actual.rows[0].precio_unitario);
    const nuevoStock = stockActual + cantNueva;
    const valorAcumulado = stockActual * precioActual + costoNuevo;
    const nuevoPrecioUnitario = nuevoStock > 0 ? valorAcumulado / nuevoStock : 0;
    await pool.query('UPDATE inventario SET stock = $1, precio_unitario = $2 WHERE id = $3', [
      nuevoStock,
      nuevoPrecioUnitario,
      inventario_id,
    ]);
  }
  res.redirect('/activos-corrientes');
});

router.post('/activos-corrientes/:id/stock-minimo', requierePermisoEditar('activos_corrientes'), async (req, res) => {
  await pool.query('UPDATE inventario SET stock_minimo = $1 WHERE id = $2', [
    req.body.stock_minimo || 0,
    req.params.id,
  ]);
  res.redirect('/activos-corrientes');
});

router.post('/activos-corrientes/:id/eliminar', requierePermisoEditar('activos_corrientes'), async (req, res) => {
  await pool.query('UPDATE inventario SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.redirect('/activos-corrientes');
});

// ============================================================
// MENÚ DE PRODUCTOS
// ============================================================
router.get('/menu', requierePermisoVer('menu'), async (req, res) => {
  const productos = await calc.obtenerMenu();
  const inventario = await calc.obtenerInventario();
  res.render('dashboard/menu', { productos, inventario });
});

router.post('/menu', requierePermisoEditar('menu'), async (req, res) => {
  const { nombre, categoria, modo, precio_venta, inventario_id_comprado } = req.body;
  const r = await pool.query(
    `INSERT INTO menu_productos (nombre, categoria, modo, precio_venta, inventario_id_comprado)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [nombre, categoria, modo, precio_venta || 0, modo === 'comprado' ? inventario_id_comprado || null : null]
  );
  const productoId = r.rows[0].id;

  // Si es 'elaborado', guarda la receta: insumo_1[], cantidad_1[] ...
  if (modo === 'elaborado' && req.body.insumo_id) {
    const insumos = Array.isArray(req.body.insumo_id) ? req.body.insumo_id : [req.body.insumo_id];
    const cantidades = Array.isArray(req.body.cantidad_necesaria)
      ? req.body.cantidad_necesaria
      : [req.body.cantidad_necesaria];
    for (let i = 0; i < insumos.length; i++) {
      if (!insumos[i] || !cantidades[i]) continue;
      await pool.query(
        `INSERT INTO menu_receta (producto_id, insumo_id, cantidad_necesaria) VALUES ($1,$2,$3)`,
        [productoId, insumos[i], cantidades[i]]
      );
    }
  }
  res.redirect('/menu');
});

router.post('/menu/:id/eliminar', requierePermisoEditar('menu'), async (req, res) => {
  await pool.query('UPDATE menu_productos SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.redirect('/menu');
});

// ============================================================
// PASIVOS (DEUDAS)
// ============================================================
router.get('/pasivos', requierePermisoVer('pasivos'), async (req, res) => {
  const pasivos = await calc.obtenerPasivos();
  const totales = await calc.totalesPasivosPendientes();
  res.render('dashboard/pasivos', { pasivos, totales });
});

router.post('/pasivos', requierePermisoEditar('pasivos'), async (req, res) => {
  const { descripcion, tipo, monto } = req.body;
  await pool.query(
    `INSERT INTO pasivos (descripcion, tipo, monto) VALUES ($1,$2,$3)`,
    [descripcion, tipo, monto]
  );
  res.redirect('/pasivos');
});

router.post('/pasivos/:id/pagado', requierePermisoEditar('pasivos'), async (req, res) => {
  await pool.query(
    `UPDATE pasivos SET pagado = TRUE, fecha_pago = CURRENT_DATE WHERE id = $1`,
    [req.params.id]
  );
  res.redirect('/pasivos');
});

router.post('/pasivos/:id/eliminar', requierePermisoEditar('pasivos'), async (req, res) => {
  await pool.query('DELETE FROM pasivos WHERE id = $1', [req.params.id]);
  res.redirect('/pasivos');
});

// ============================================================
// ACCIONISTAS
// ============================================================
router.get('/accionistas', requierePermisoVer('accionistas'), async (req, res) => {
  const socios = await calc.obtenerGananciasSocios();
  const config = await calc.obtenerConfigEmpresa();
  res.render('dashboard/accionistas', { socios, config });
});

router.post('/accionistas', requierePermisoEditar('accionistas'), async (req, res) => {
  const { nombre, acciones, monto_invertido, condicion_especial } = req.body;
  await pool.query(
    `INSERT INTO socios (nombre, acciones, monto_invertido, condicion_especial) VALUES ($1,$2,$3,$4)`,
    [nombre, acciones, monto_invertido || 0, condicion_especial || null]
  );
  res.redirect('/accionistas');
});

router.post('/accionistas/:id/eliminar', requierePermisoEditar('accionistas'), async (req, res) => {
  await pool.query('UPDATE socios SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.redirect('/accionistas');
});

router.post('/accionistas/config', requierePermisoEditar('accionistas'), async (req, res) => {
  const { pct_alquiler, pct_reinversion, pct_dividendos, pct_reserva, pct_deudas, pct_capital_trabajo } = req.body;
  await pool.query(
    `UPDATE empresa_config SET pct_alquiler=$1, pct_reinversion=$2, pct_dividendos=$3,
     pct_reserva=$4, pct_deudas=$5, pct_capital_trabajo=$6 WHERE id = 1`,
    [pct_alquiler, pct_reinversion, pct_dividendos, pct_reserva, pct_deudas, pct_capital_trabajo]
  );
  res.redirect('/accionistas');
});

// ============================================================
// COBROS DE DIVIDENDOS
// ============================================================
router.get('/cobros', requierePermisoVer('cobros'), async (req, res) => {
  const socios = await calc.obtenerGananciasSocios();
  const historial = await pool.query(
    `SELECT c.*, s.nombre AS socio_nombre FROM cobros_dividendos c
     JOIN socios s ON s.id = c.socio_id ORDER BY c.fecha DESC LIMIT 50`
  );
  res.render('dashboard/cobros', { socios, historial: historial.rows, hoy: fechaHoyBolivia() });
});

router.post('/cobros', requierePermisoEditar('cobros'), async (req, res) => {
  const { socio_id, fecha, monto, nota } = req.body;
  await pool.query(
    `INSERT INTO cobros_dividendos (socio_id, fecha, monto, nota, usuario_id) VALUES ($1,$2,$3,$4,$5)`,
    [socio_id, fecha, monto, nota || null, req.session.usuario ? req.session.usuario.id : null]
  );
  res.redirect('/cobros');
});

// ============================================================
// COBRO DE DISTRIBUCIÓN DE UTILIDAD (reinversión, reserva, deudas, capital de trabajo)
// Los dividendos se manejan aparte, en /cobros.
// ============================================================
router.get('/distribucion-utilidad', requierePermisoVer('distribucion_utilidad'), async (req, res) => {
  const categorias = await calc.obtenerAcumuladosDistribucion();
  const historial = await pool.query(
    `SELECT * FROM distribucion_usos ORDER BY fecha DESC, creado_en DESC LIMIT 50`
  );
  res.render('dashboard/distribucion-utilidad', { categorias, historial: historial.rows, hoy: fechaHoyBolivia() });
});

router.post('/distribucion-utilidad', requierePermisoEditar('distribucion_utilidad'), async (req, res) => {
  const { categoria, fecha, monto, nota } = req.body;
  await pool.query(
    `INSERT INTO distribucion_usos (categoria, fecha, monto, nota, usuario_id) VALUES ($1,$2,$3,$4,$5)`,
    [categoria, fecha, monto, nota || null, req.session.usuario ? req.session.usuario.id : null]
  );
  res.redirect('/distribucion-utilidad');
});

// ============================================================
// BALANCE GENERAL
// ============================================================
router.get('/balance-general', requierePermisoVer('balance_general'), async (req, res) => {
  const mes = req.query.mes || mesActualBolivia();
  let balance = await pool.query('SELECT * FROM balance_general WHERE mes = $1', [mes]);
  if (!balance.rows[0]) {
    balance = {
      rows: [
        {
          mes,
          caja_bancos: 0,
          cuentas_cobrar: 0,
          impuestos_pagar: 0,
          prestamo_largo_plazo: 0,
          capital_social: 0,
          utilidades_retenidas: 0,
        },
      ],
    };
  }
  const valorActivosFijos = await calc.totalValorEnLibrosActivos();
  const valorInventario = await calc.totalValorInventario();
  const pasivosPendientes = await calc.totalesPasivosPendientes();
  res.render('dashboard/balance-general', {
    b: balance.rows[0],
    mes,
    valorActivosFijos,
    valorInventario,
    pasivosPendientes,
  });
});

router.post('/balance-general', requierePermisoEditar('balance_general'), async (req, res) => {
  const {
    mes, caja_bancos, cuentas_cobrar,
    impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas,
  } = req.body;
  await pool.query(
    `INSERT INTO balance_general (mes, caja_bancos, cuentas_cobrar, impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (mes) DO UPDATE SET
       caja_bancos=$2, cuentas_cobrar=$3, impuestos_pagar=$4, prestamo_largo_plazo=$5,
       capital_social=$6, utilidades_retenidas=$7, actualizado_en = now()`,
    [mes, caja_bancos, cuentas_cobrar, impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas]
  );
  res.redirect(`/balance-general?mes=${mes}`);
});

// ============================================================
// ESTADO DE RESULTADOS
// ============================================================
router.get('/estado-resultados', requierePermisoVer('estado_resultados'), async (req, res) => {
  const mes = req.query.mes || mesActualBolivia();
  const estado = await calc.obtenerEstadoResultados(mes);
  res.render('dashboard/estado-resultados', {
    estado,
    mes,
    serviciosIngreso: calc.SERVICIOS_INGRESO,
    serviciosGasto: calc.SERVICIOS_GASTO,
  });
});

// ============================================================
// HISTORIAL (semanal / mensual) - calculado automáticamente
// ============================================================
router.get('/historial', requierePermisoVer('historial'), async (req, res) => {
  const semanal = await calc.obtenerHistorialSemanal();
  const mensual = await calc.obtenerHistorialMensual();
  res.render('dashboard/historial', { semanal, mensual });
});

module.exports = router;
