# Frape Club — Sistema Financiero

Sistema web para registrar ingresos y gastos diarios, activos fijos, accionistas,
cobros de dividendos, balance general, estado de resultados e historial —
construido a partir del Excel original del negocio.

## Stack

- Node.js + Express
- PostgreSQL en [Neon](https://neon.tech) (`pg`)
- Vistas server-side con EJS (rápidas, funcionan bien en celular)
- Sesiones guardadas en la base de datos (`connect-pg-simple`)
- CSS separado de los `.js` (`public/css/styles.css`)

## 1. Abrir en VS Code

1. Descomprime la carpeta `frape-club` y ábrela en VS Code.
2. Instala Node.js 18+ si no lo tienes: https://nodejs.org
3. En la terminal de VS Code:
   ```bash
   npm install
   ```

## 2. Crear la base de datos en Neon

1. Crea una cuenta gratis en https://neon.tech y un proyecto nuevo.
2. Copia el **Connection string** (algo como
   `postgresql://usuario:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
4. Pega tu connection string en `DATABASE_URL` dentro de `.env`.
5. Genera una contraseña segura para el admin:
   ```bash
   node db/hash-password.js "TuContraseñaSegura123"
   ```
   Copia el resultado en `ADMIN_PASSWORD_HASH` dentro de `.env`, y define
   `ADMIN_USERNAME` (por ejemplo `admin`).
6. Genera cualquier texto largo y aleatorio para `SESSION_SECRET`.
7. Crea las tablas (y opcionalmente carga los datos de tu Excel original):
   ```bash
   node db/init.js --seed
   ```
   Si prefieres empezar en blanco (sin los datos de ejemplo del Excel), usa
   `node db/init.js` sin `--seed`.

## 3. Correr en local

```bash
npm run dev
```

Abre http://localhost:3000

- Login de usuarios: `/login`
- Login del admin: `/admin/login` (con el usuario/contraseña que configuraste en `.env`)

Desde `/admin` puedes crear usuarios, asignarles contraseña, y decidir pestaña por
pestaña qué pueden **ver** y qué pueden **editar**.

## 4. Desplegar en Render

1. Sube este proyecto a un repositorio de GitHub.
2. En https://render.com crea un **New Web Service** apuntando a ese repo
   (el archivo `render.yaml` ya deja la configuración lista: build `npm install`,
   start `npm start`).
3. En la sección **Environment** de Render, agrega las variables:
   - `DATABASE_URL` (tu connection string de Neon)
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `NODE_ENV=production`
4. Antes de usarlo en producción, corre una vez `node db/init.js --seed` (puedes
   hacerlo desde tu máquina local apuntando al mismo `DATABASE_URL` de Neon, ya
   que Neon es accesible desde internet).
5. Deploy. Render te da una URL pública (`https://frape-club.onrender.com`).

## Estructura del proyecto

```
frape-club/
├── server.js               # Punto de entrada
├── db/
│   ├── schema.sql           # Estructura de las tablas
│   ├── seed.sql              # Datos iniciales tomados del Excel
│   ├── pool.js                # Conexión a Neon
│   ├── init.js                 # Script para crear tablas / cargar datos
│   └── hash-password.js        # Genera el hash de la contraseña del admin
├── middleware/
│   ├── auth.js               # Login, permisos por pestaña
│   └── protegerDashboard.js  # Exige sesión iniciada
├── lib/
│   └── calculos.js           # Depreciación, estado de resultados, ganancias
├── routes/
│   ├── auth.js               # /login, /admin/login
│   ├── admin.js               # Gestión de usuarios y permisos
│   └── dashboard.js           # Todas las pestañas del sistema
├── views/                   # Plantillas EJS (una por pestaña)
└── public/
    ├── css/styles.css        # Todos los estilos (responsive, mobile-first)
    └── js/menu.js             # Lógica del menú hamburguesa
```

## Cómo funciona el sistema de permisos

- El **admin** (`/admin/login`) es un único usuario definido por variables de
  entorno — no se crea desde la interfaz, por seguridad.
- El admin crea usuarios normales desde `/admin`, y para cada uno decide,
  pestaña por pestaña, si puede **ver** y/o **editar**.
- Un usuario sin permiso de "ver" una pestaña ni siquiera la ve en su menú.
- Un usuario con "ver" pero sin "editar" puede consultar la información pero
  no verá los formularios para agregar/eliminar datos.

## Pestañas incluidas

1. **Ingresos y Gastos del Día** — registra ventas de frappes, masitas y
   alquiler de juegos (cartas por hora/juego, tipo Catan por hora/persona) y
   gastos del día. Suma automática del día y del mes.
2. **Activos Fijos** — con depreciación en línea recta calculada sola.
3. **Accionistas** — % de participación y ganancia acumulada por socio,
   calculada automáticamente desde el Estado de Resultados.
4. **Cobros de Dividendos** — registro de cobros y saldo pendiente por socio.
5. **Balance General** — Activo/Pasivo/Patrimonio (el activo fijo se trae
   solo desde la pestaña de Activos Fijos).
6. **Estado de Resultados** — se calcula solo, mes a mes, a partir de los
   movimientos diarios (ya no hay que llenarlo a mano).
7. **Historial Semanal / Mensual** — se genera automáticamente; ya no hace
   falta copiar y pegar filas cada semana como en el Excel.

## Notas

- Todos los montos están en Bolivianos (Bs), igual que tu Excel original.
- Los % de distribución de la utilidad neta (alquiler, reinversión,
  dividendos, reserva, deudas, capital de trabajo) se pueden editar desde la
  pestaña de Accionistas.
- Los datos de `db/seed.sql` son los que ya tenías en el Excel (socios,
  activos, fondo inicial); edítalos o bórralos desde la app cuando quieras.
