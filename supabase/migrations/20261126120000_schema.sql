-- =====================================================================
-- Schema inicial — E-commerce hamburgueseria
--
-- Convenciones:
--   * Montos en INTEGER de pesos argentinos (sin centavos, sin floats).
--   * Enumerados como TEXT + CHECK (mas faciles de evolucionar que ENUM).
--   * RLS activado en todas las tablas y SIN policies: el unico acceso es
--     el backend con la secret/service_role key (que bypassea RLS).
--     anon y authenticated no pueden leer ni escribir nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: mantener updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories (id) on delete restrict,
  name          text not null check (char_length(name) between 1 and 80),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description   text not null default '' check (char_length(description) <= 500),
  base_price    integer not null check (base_price >= 0 and base_price <= 10000000),
  image_url     text check (image_url is null or char_length(image_url) <= 500),
  type          text not null default 'simple' check (type in ('simple', 'combo')),
  badges        text[] not null default '{}'
                check (badges <@ array['nuevo', 'picante', 'veggie', 'sin_tacc', 'popular']::text[]),
  sort_order    integer not null default 0,
  is_available  boolean not null default true,   -- "agotado" temporal
  is_active     boolean not null default true,   -- soft delete
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index products_category_idx on public.products (category_id, sort_order);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Grupos de modificadores: "Elegi tu pan" (min 1, max 1), "Extras" (min 0, max 4)...
create table public.modifier_groups (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]+$'),  -- clave interna estable
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  min_select  integer not null default 0 check (min_select >= 0),
  max_select  integer not null default 1 check (max_select >= 1),
  created_at  timestamptz not null default now(),
  check (min_select <= max_select)
);

create table public.modifiers (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.modifier_groups (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  price_delta   integer not null default 0 check (price_delta between -1000000 and 1000000),
  max_quantity  integer not null default 1 check (max_quantity between 1 and 10), -- "doble cheddar"
  is_default    boolean not null default false,
  is_available  boolean not null default true,
  sort_order    integer not null default 0,
  unique (group_id, name)
);

create index modifiers_group_idx on public.modifiers (group_id, sort_order);

create table public.product_modifier_groups (
  product_id  uuid not null references public.products (id) on delete cascade,
  group_id    uuid not null references public.modifier_groups (id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (product_id, group_id)
);

create index product_modifier_groups_group_idx on public.product_modifier_groups (group_id);

-- ---------------------------------------------------------------------
-- Usuarios y auth propia (JWT firmado por el backend)
-- ---------------------------------------------------------------------
create table public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash  text not null,
  name           text not null check (char_length(name) between 1 and 80),
  phone          text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  role           text not null default 'customer' check (role in ('customer', 'admin')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Email unico sin importar mayusculas
create unique index users_email_lower_key on public.users (lower(email));

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Refresh tokens: se guarda solo el hash. family_id permite detectar
-- reuso de un token ya rotado y revocar toda la familia.
create table public.refresh_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  family_id    uuid not null,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  replaced_by  uuid references public.refresh_tokens (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index refresh_tokens_user_idx on public.refresh_tokens (user_id);
create index refresh_tokens_family_idx on public.refresh_tokens (family_id);

create table public.addresses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  label            text check (label is null or char_length(label) <= 40),      -- "Casa", "Trabajo"
  street           text not null check (char_length(street) between 1 and 120),
  number           text not null check (char_length(number) between 1 and 10),
  apt              text check (apt is null or char_length(apt) <= 20),          -- piso / depto
  between_streets  text check (between_streets is null or char_length(between_streets) <= 120),
  notes            text check (notes is null or char_length(notes) <= 200),
  created_at       timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------
-- Configuracion del local (fila unica)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id                       smallint primary key default 1 check (id = 1),
  is_open                  boolean not null default true,
  delivery_fee             integer not null default 0 check (delivery_fee >= 0),
  min_order_delivery       integer not null default 0 check (min_order_delivery >= 0),
  free_delivery_threshold  integer check (free_delivery_threshold is null or free_delivery_threshold > 0),
  eta_min                  integer not null default 30 check (eta_min > 0),
  eta_max                  integer not null default 45 check (eta_max > 0),
  auto_advance             boolean not null default false,  -- avance automatico de estados (demo)
  updated_at               timestamptz not null default now(),
  check (eta_min <= eta_max)
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Cupones
-- ---------------------------------------------------------------------
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  type        text not null check (type in ('percent', 'fixed')),
  value       integer not null check (value > 0),
  min_total   integer not null default 0 check (min_total >= 0),
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0 check (used_count >= 0),
  expires_at  timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (type <> 'percent' or value <= 100),
  check (max_uses is null or used_count <= max_uses)
);

-- ---------------------------------------------------------------------
-- Pedidos (con snapshot de nombres y precios)
-- ---------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity unique,  -- "Pedido #1042"
  user_id           uuid references public.users (id) on delete set null,
  status            text not null default 'pending' check (status in (
                      'pending', 'confirmed', 'preparing', 'on_the_way',
                      'ready_for_pickup', 'delivered', 'cancelled', 'rejected')),
  fulfillment       text not null check (fulfillment in ('delivery', 'pickup')),
  customer_name     text not null check (char_length(customer_name) between 1 and 80),
  customer_phone    text not null check (customer_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  address_snapshot  jsonb,
  subtotal          integer not null check (subtotal >= 0),
  delivery_fee      integer not null default 0 check (delivery_fee >= 0),
  discount          integer not null default 0 check (discount >= 0),
  total             integer not null check (total >= 0),
  coupon_id         uuid references public.coupons (id) on delete set null,
  coupon_code       text,
  payment_method    text not null check (payment_method in ('cash', 'card')),
  payment_brand     text check (payment_brand is null or payment_brand in ('visa', 'mastercard', 'amex', 'other')),
  payment_last4     text check (payment_last4 is null or payment_last4 ~ '^[0-9]{4}$'),
  cash_amount       integer check (cash_amount is null or cash_amount > 0),
  notes             text check (notes is null or char_length(notes) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (total = subtotal + delivery_fee - discount),
  check (fulfillment = 'pickup' or address_snapshot is not null),
  check (payment_method = 'cash' or (payment_last4 is not null and payment_brand is not null))
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  product_name     text not null,
  unit_base_price  integer not null check (unit_base_price >= 0),
  quantity         integer not null check (quantity between 1 and 20),
  item_total       integer not null check (item_total >= 0),
  notes            text check (notes is null or char_length(notes) <= 200)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_item_modifiers (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items (id) on delete cascade,
  modifier_id    uuid references public.modifiers (id) on delete set null,
  group_name     text not null,
  modifier_name  text not null,
  price_delta    integer not null,
  quantity       integer not null default 1 check (quantity between 1 and 10)
);

create index order_item_modifiers_item_idx on public.order_item_modifiers (order_item_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  status      text not null,
  changed_by  uuid references public.users (id) on delete set null,  -- null = sistema
  note        text check (note is null or char_length(note) <= 200),
  changed_at  timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

-- ---------------------------------------------------------------------
-- Seguridad: RLS sin policies + permisos minimos
-- ---------------------------------------------------------------------
alter table public.categories              enable row level security;
alter table public.products                enable row level security;
alter table public.modifier_groups         enable row level security;
alter table public.modifiers               enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.users                   enable row level security;
alter table public.refresh_tokens          enable row level security;
alter table public.addresses               enable row level security;
alter table public.store_settings          enable row level security;
alter table public.coupons                 enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.order_item_modifiers    enable row level security;
alter table public.order_status_history    enable row level security;

-- anon / authenticated: sin acceso (defensa en profundidad, ademas de RLS)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

-- Lo mismo para tablas/funciones que se creen en migraciones futuras
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- service_role: solo lo que usa el backend
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- Storage: bucket publico de solo lectura para fotos de productos.
-- Las subidas las hace el backend con service_role (no hacen falta policies).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
