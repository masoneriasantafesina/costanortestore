-- ==========================================================
-- ESQUEMA FASE 1 - Grido Store y Mayorista
-- Pegar todo este archivo en: Supabase > SQL Editor > New query > Run
-- ==========================================================

-- Extensión para generar IDs únicos
create extension if not exists "pgcrypto";

-- ---------- CLIENTES ----------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_apellido text not null,
  nombre_comercio text,
  direccion text,
  localidad text,
  maps_url text,
  telefono text,
  tipo_cliente text not null check (tipo_cliente in ('freezer_blanco', 'comodato_grido')),
  serie_freezer text,
  foto_url text,
  creado_en timestamptz not null default now()
);

-- ---------- PRODUCTOS ----------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  descripcion text,
  foto_url text,
  precio_normal numeric(10, 2) not null,
  precio_promo numeric(10, 2),
  unidad text default 'unidad', -- ej: 'kg', 'unidad', 'pack'
  stock integer,
  exhibir_catalogo boolean not null default true,
  destacado boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ---------- PEDIDOS ----------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  numero serial, -- número correlativo legible
  origen text not null default 'catalogo_web' check (origen in ('catalogo_web', 'carga_manual')),
  estado text not null default 'nuevo' check (
    estado in ('nuevo', 'preparacion', 'preparado', 'reparto', 'entregado', 'cancelado')
  ),
  cliente_id uuid references clientes(id), -- null hasta que un admin lo asigna
  nombre_contacto text not null, -- lo que tipeó el cliente en el catálogo
  telefono_contacto text not null,
  direccion_contacto text,
  notas text,
  descuento numeric(10, 2) default 0,
  recargo numeric(10, 2) default 0,
  metodo_pago text check (
    metodo_pago in ('efectivo', 'transferencia', 'cuenta_corriente', 'cheque', 'mixto')
  ),
  total numeric(10, 2) not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- ITEMS DE PEDIDO ----------
create table if not exists pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid references productos(id),
  nombre_producto text not null, -- copia del nombre al momento del pedido
  precio_unitario numeric(10, 2) not null,
  cantidad numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

create index if not exists idx_pedido_items_pedido on pedido_items(pedido_id);
create index if not exists idx_pedidos_estado on pedidos(estado);

-- ==========================================================
-- SEGURIDAD (Row Level Security)
-- Regla: cualquiera (sin login) puede VER productos del catálogo
-- y CREAR un pedido nuevo. Solo un admin logueado puede ver/editar
-- clientes, y solo un admin logueado puede editar productos y pedidos.
-- ==========================================================

alter table clientes enable row level security;
alter table productos enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;

-- Productos: lectura pública solo de los marcados para catálogo
create policy "productos_lectura_publica" on productos
  for select using (exhibir_catalogo = true);

-- Productos: lectura/escritura total para admins logueados
create policy "productos_admin_todo" on productos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Clientes: solo admins logueados
create policy "clientes_admin_todo" on clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Pedidos: cualquiera puede CREAR (insert) un pedido nuevo desde el catálogo
create policy "pedidos_insert_publico" on pedidos
  for insert with check (estado = 'nuevo' and origen = 'catalogo_web');

-- Pedidos: solo admins logueados pueden ver y modificar
create policy "pedidos_admin_select" on pedidos
  for select using (auth.role() = 'authenticated');

create policy "pedidos_admin_update" on pedidos
  for update using (auth.role() = 'authenticated');

create policy "pedidos_admin_delete" on pedidos
  for delete using (auth.role() = 'authenticated');

-- Items de pedido: mismo criterio, se insertan junto al pedido público
create policy "pedido_items_insert_publico" on pedido_items
  for insert with check (true);

create policy "pedido_items_admin_select" on pedido_items
  for select using (auth.role() = 'authenticated');

create policy "pedido_items_admin_update" on pedido_items
  for update using (auth.role() = 'authenticated');

create policy "pedido_items_admin_delete" on pedido_items
  for delete using (auth.role() = 'authenticated');

-- ==========================================================
-- STORAGE (fotos de productos y clientes)
-- Ejecutar esto también, crea un bucket público para imágenes.
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_lectura_publica" on storage.objects
  for select using (bucket_id = 'fotos');

create policy "fotos_subida_admin" on storage.objects
  for insert with check (bucket_id = 'fotos' and auth.role() = 'authenticated');
