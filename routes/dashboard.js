const express = require('express');
const pool = require('../db/pool');
const { requierePermisoVer, requierePermisoEditar } = require('../middleware/auth');
const calc = require('../lib/calculos');

const router = express.Router();

router.get('/', (req, res) => res.redirect('/ingresos-gastos'));

// ============================================================
// INGRESOS Y GASTOS DEL DÍA
// ============================================================
router.get('/ingresos-gastos', requierePermisoVer('ingresos_gastos'), async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  const mes = fecha.slice(0, 7);

  const movimientosDia = await pool.query(
    `SELECT m.*, u.nombre AS usuario_nombre FROM movimientos m
     LEFT JOIN usuarios u ON u.id = m.usuario_id
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

  res.render('dashboard/ingresos-gastos', {
    fecha,
    mes,
    movimientos: movimientosDia.rows,
    totalesDia: totalesDia.rows[0],
    totalesMes: totalesMes.rows[0],
    serviciosIngreso: calc.SERVICIOS_INGRESO,
    serviciosGasto: calc.SERVICIOS_GASTO,
  });
});

router.post('/ingresos-gastos', requierePermisoEditar('ingresos_gastos'), async (req, res) => {
  const { fecha, tipo, servicio, descripcion, horas, personas, tarifa, monto } = req.body;
  await pool.query(
    `INSERT INTO movimientos (fecha, tipo, servicio, descripcion, horas, personas, tarifa, monto, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      fecha,
      tipo,
      servicio,
      descripcion || null,
      horas || null,
      personas || null,
      tarifa || null,
      monto,
      req.session.usuario ? req.session.usuario.id : null,
    ]
  );
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
  res.render('dashboard/cobros', { socios, historial: historial.rows });
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
// BALANCE GENERAL
// ============================================================
router.get('/balance-general', requierePermisoVer('balance_general'), async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  let balance = await pool.query('SELECT * FROM balance_general WHERE mes = $1', [mes]);
  if (!balance.rows[0]) {
    balance = {
      rows: [
        {
          mes,
          caja_bancos: 0,
          cuentas_cobrar: 0,
          inventario: 0,
          cuentas_pagar: 0,
          sueldos_pagar: 0,
          impuestos_pagar: 0,
          prestamo_largo_plazo: 0,
          capital_social: 0,
          utilidades_retenidas: 0,
        },
      ],
    };
  }
  const valorActivosFijos = await calc.totalValorEnLibrosActivos();
  res.render('dashboard/balance-general', { b: balance.rows[0], mes, valorActivosFijos });
});

router.post('/balance-general', requierePermisoEditar('balance_general'), async (req, res) => {
  const {
    mes, caja_bancos, cuentas_cobrar, inventario, cuentas_pagar,
    sueldos_pagar, impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas,
  } = req.body;
  await pool.query(
    `INSERT INTO balance_general (mes, caja_bancos, cuentas_cobrar, inventario, cuentas_pagar,
       sueldos_pagar, impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (mes) DO UPDATE SET
       caja_bancos=$2, cuentas_cobrar=$3, inventario=$4, cuentas_pagar=$5,
       sueldos_pagar=$6, impuestos_pagar=$7, prestamo_largo_plazo=$8,
       capital_social=$9, utilidades_retenidas=$10, actualizado_en = now()`,
    [mes, caja_bancos, cuentas_cobrar, inventario, cuentas_pagar, sueldos_pagar,
      impuestos_pagar, prestamo_largo_plazo, capital_social, utilidades_retenidas]
  );
  res.redirect(`/balance-general?mes=${mes}`);
});

// ============================================================
// ESTADO DE RESULTADOS
// ============================================================
router.get('/estado-resultados', requierePermisoVer('estado_resultados'), async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
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
