# Grido Store y Mayorista — Fase 1 (MVP)

Guía paso a paso para poner esto en funcionamiento sin experiencia previa en programación.

Vas a usar dos servicios gratuitos:
- **Supabase**: guarda tu base de datos (clientes, productos, pedidos) y las fotos.
- **Vercel**: publica la página web para que cualquiera pueda entrar desde internet.

No vas a instalar nada en tu computadora para la puesta en producción (solo para probarlo localmente, que es opcional).

---

## Paso 1 — Crear el proyecto en Supabase

1. Andá a https://supabase.com y creá una cuenta gratuita (podés usar tu cuenta de Google).
2. Hacé clic en **New project**. Elegí un nombre (ej: `grido-store`) y una contraseña de base de datos (guardala en un lugar seguro).
3. Esperá 1-2 minutos a que el proyecto termine de crearse.
4. En el menú izquierdo, andá a **SQL Editor** → **New query**.
5. Abrí el archivo `supabase/schema.sql` de este proyecto, copiá TODO el contenido y pegalo ahí.
6. Hacé clic en **Run**. Esto crea las tablas (clientes, productos, pedidos) y las reglas de seguridad.
7. Andá a **Project Settings** (ícono de engranaje) → **API**. Ahí vas a ver dos datos que necesitás:
   - **Project URL**
   - **anon public key**
   Guardalos, los vas a usar en el Paso 3.

### Crear tu primer usuario administrador
1. En Supabase, andá a **Authentication** → **Users** → **Add user**.
2. Cargá tu email y una contraseña. Con eso vas a poder entrar al panel `/admin`.

---

## Paso 2 — Subir el código a GitHub

1. Creá una cuenta gratuita en https://github.com si no tenés.
2. Creá un repositorio nuevo (botón verde **New**), ponele de nombre `grido-store`.
3. Subí la carpeta completa de este proyecto a ese repositorio (GitHub te permite arrastrar y soltar los archivos desde la web, no hace falta usar comandos).

---

## Paso 3 — Publicar la web en Vercel

1. Andá a https://vercel.com y creá una cuenta gratuita usando tu cuenta de GitHub.
2. Hacé clic en **Add New** → **Project**, y elegí el repositorio `grido-store` que subiste.
3. Antes de darle a "Deploy", buscá la sección **Environment Variables** y agregá:
   - `NEXT_PUBLIC_SUPABASE_URL` → pegá la Project URL del Paso 1.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → pegá la anon public key del Paso 1.
4. Hacé clic en **Deploy**. Esperá 1-2 minutos.
5. Vercel te va a dar una dirección web (algo como `grido-store.vercel.app`). Esa es tu página en producción.

- El catálogo público queda en: `tuweb.vercel.app/catalogo`
- El panel de administración queda en: `tuweb.vercel.app/admin/login`

Cada vez que quieras hacer un cambio al código en el futuro (por ejemplo, cuando construyamos la Fase 2), subís los cambios a GitHub y Vercel actualiza la web automáticamente.

---

## Paso 4 — Cargar tus primeros productos

1. Entrá a `tuweb.vercel.app/admin/login` con el usuario que creaste en el Paso 1.
2. Andá a **Productos** → **Nuevo producto** y cargá tu catálogo real.
3. Marcá "Exhibir en catálogo público" en los que querés que vean tus clientes.
4. Para las fotos: subilas manualmente a Supabase (**Storage** → bucket `fotos` → **Upload**) y copiá la URL pública que te da, pegándola en el campo "URL de la foto" del producto.

---

## Cómo queda guardada la información

Tu base de datos vive en Supabase, en un centro de datos con copias de seguridad automáticas diarias (en el plan gratuito, con retención limitada — para un negocio en producción real, en algún momento van a querer pasar al plan pago de Supabase, que cuesta USD 25/mes y agrega backups de mayor retención). Nadie sin contraseña puede editar clientes, productos o pedidos: eso está controlado por las reglas de seguridad (RLS) que ejecutaste en el Paso 1.

---

## Qué falta para las siguientes fases

Este MVP cubre: catálogo público, carrito, envío de pedidos, gestión de pedidos por estado, asignación a cliente, y ABM de clientes y productos.

Quedan pendientes para fases siguientes (a propósito, para no construir todo de una vez sin haberlo probado primero):
- Roles diferenciados (Administrador / Encargado / Repartidor) con permisos distintos.
- Organización de pedidos por hoja de ruta / zona de reparto.
- Cuenta corriente y saldos pendientes por cliente.
- Dashboard de estadísticas y reportes.
- Envío automático del resumen del pedido por WhatsApp.
- Venta directa manual desde el panel (carga interna con buscador y descuentos).
