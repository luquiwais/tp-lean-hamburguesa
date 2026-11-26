-- =====================================================================
-- Seed: menu de ejemplo. Idempotente (se puede correr mas de una vez).
-- Precios en pesos argentinos (ficticios).
-- Las imagenes se cargan desde el panel admin (Fase 6).
-- El usuario admin se crea con `npm run create-admin -w server` (Fase 3),
-- porque el hash de la contrasena lo genera el backend con bcrypt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuracion del local
-- ---------------------------------------------------------------------
insert into public.store_settings
  (id, is_open, delivery_fee, min_order_delivery, free_delivery_threshold, eta_min, eta_max)
values
  (1, true, 2500, 12000, 35000, 30, 45)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Hamburguesas', 'hamburguesas', 1),
  ('Combos',       'combos',       2),
  ('Papas y más',  'papas',        3),
  ('Bebidas',      'bebidas',      4),
  ('Postres',      'postres',      5)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Grupos de modificadores
-- ---------------------------------------------------------------------
insert into public.modifier_groups (code, name, description, min_select, max_select) values
  ('pan',            'Elegí tu pan',            '',                             1, 1),
  ('extras_burger',  'Sumale extras',           'Podés elegir hasta 4',         0, 4),
  ('quitar',         'Quitar ingredientes',     'Sin costo',                    0, 6),
  ('acomp_combo',    'Elegí tu acompañamiento', '',                             1, 1),
  ('bebida_combo',   'Elegí tu bebida',         '',                             1, 1),
  ('tamano_papas',   'Tamaño',                  '',                             1, 1),
  ('dips',           'Dips',                    'Podés elegir hasta 3',         0, 3),
  ('sabor_gaseosa',  'Sabor',                   '',                             1, 1)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Modificadores
-- ---------------------------------------------------------------------
insert into public.modifiers (group_id, name, price_delta, max_quantity, is_default, sort_order)
select g.id, m.name, m.price_delta, m.max_quantity, m.is_default, m.sort_order
from (values
  ('pan',           'Pan de papa',             0,    1, true,  1),
  ('pan',           'Pan sin TACC',            1500, 1, false, 2),

  ('extras_burger', 'Cheddar extra',           1200, 2, false, 1),
  ('extras_burger', 'Bacon',                   1500, 2, false, 2),
  ('extras_burger', 'Medallón extra',          3500, 1, false, 3),
  ('extras_burger', 'Huevo a la plancha',      1000, 1, false, 4),
  ('extras_burger', 'Cebolla caramelizada',    900,  1, false, 5),
  ('extras_burger', 'Jalapeños',               700,  1, false, 6),

  ('quitar',        'Sin cebolla',             0,    1, false, 1),
  ('quitar',        'Sin pepinos',             0,    1, false, 2),
  ('quitar',        'Sin tomate',              0,    1, false, 3),
  ('quitar',        'Sin lechuga',             0,    1, false, 4),
  ('quitar',        'Sin salsa de la casa',    0,    1, false, 5),
  ('quitar',        'Sin cheddar',             0,    1, false, 6),

  ('acomp_combo',   'Papas clásicas',          0,    1, true,  1),
  ('acomp_combo',   'Papas con cheddar y bacon', 2500, 1, false, 2),
  ('acomp_combo',   'Aros de cebolla',         1500, 1, false, 3),

  ('bebida_combo',  'Gaseosa cola 500 ml',     0,    1, true,  1),
  ('bebida_combo',  'Gaseosa lima-limón 500 ml', 0,  1, false, 2),
  ('bebida_combo',  'Agua sin gas 500 ml',     0,    1, false, 3),
  ('bebida_combo',  'Limonada de la casa',     1200, 1, false, 4),

  ('tamano_papas',  'Mediana',                 0,    1, true,  1),
  ('tamano_papas',  'Grande',                  1800, 1, false, 2),

  ('dips',          'Ketchup',                 0,    1, false, 1),
  ('dips',          'Mayo de ajo',             500,  1, false, 2),
  ('dips',          'Barbacoa',                500,  1, false, 3),
  ('dips',          'Salsa de la casa',        500,  1, false, 4),

  ('sabor_gaseosa', 'Cola',                    0,    1, true,  1),
  ('sabor_gaseosa', 'Lima-limón',              0,    1, false, 2),
  ('sabor_gaseosa', 'Naranja',                 0,    1, false, 3)
) as m(group_code, name, price_delta, max_quantity, is_default, sort_order)
join public.modifier_groups g on g.code = m.group_code
on conflict (group_id, name) do nothing;

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
insert into public.products (category_id, name, slug, description, base_price, type, badges, sort_order)
select c.id, p.name, p.slug, p.description, p.base_price, p.type, p.badges::text[], p.sort_order
from (values
  -- Hamburguesas
  ('hamburguesas', 'Clásica',          'clasica',
   'Medallón smash de 110 g, cheddar, pepinos, cebolla y salsa de la casa en pan de papa.',
   10900, 'simple', '{popular}', 1),
  ('hamburguesas', 'Doble Cheddar',    'doble-cheddar',
   'Dos medallones smash, doble cheddar, cebolla picada y salsa de la casa.',
   13900, 'simple', '{popular}', 2),
  ('hamburguesas', 'Triple Smash',     'triple-smash',
   'Tres medallones, triple cheddar y pepinos. Para cuando hay hambre en serio.',
   16900, 'simple', '{}', 3),
  ('hamburguesas', 'Bacon Crispy',     'bacon-crispy',
   'Doble medallón, cheddar, bacon crocante y barbacoa ahumada.',
   15400, 'simple', '{}', 4),
  ('hamburguesas', 'La Criolla',       'la-criolla',
   'Medallón de 180 g, provoleta grillada, chimichurri, tomate y rúcula.',
   15900, 'simple', '{nuevo}', 5),
  ('hamburguesas', 'Picante',          'picante',
   'Doble medallón, pepper jack, jalapeños, cebolla crispy y mayo picante.',
   14900, 'simple', '{picante}', 6),
  ('hamburguesas', 'Pollo Crispy',     'pollo-crispy',
   'Pechuga rebozada crocante, lechuga, tomate y mayo de limón.',
   13400, 'simple', '{}', 7),
  ('hamburguesas', 'Veggie',           'veggie',
   'Medallón de garbanzos y quinoa, cheddar, tomate, lechuga y mayo de ajo.',
   12900, 'simple', '{veggie}', 8),

  -- Combos (hamburguesa + acompañamiento + bebida)
  ('combos', 'Combo Clásica',          'combo-clasica',
   'Clásica + papas + bebida. Elegí el acompañamiento y la bebida.',
   15900, 'combo', '{popular}', 1),
  ('combos', 'Combo Doble Cheddar',    'combo-doble-cheddar',
   'Doble Cheddar + papas + bebida.',
   18900, 'combo', '{}', 2),
  ('combos', 'Combo Bacon Crispy',     'combo-bacon-crispy',
   'Bacon Crispy + papas + bebida.',
   20400, 'combo', '{}', 3),

  -- Papas y mas
  ('papas', 'Papas clásicas',          'papas-clasicas',
   'Papas bastón con cáscara, crocantes y con sal marina.',
   5400, 'simple', '{sin_tacc}', 1),
  ('papas', 'Papas cheddar y bacon',   'papas-cheddar-bacon',
   'Papas bastón bañadas en cheddar fundido con bacon crocante y verdeo.',
   7900, 'simple', '{}', 2),
  ('papas', 'Aros de cebolla',         'aros-de-cebolla',
   'Aros rebozados en cerveza, con dip a elección.',
   6400, 'simple', '{}', 3),

  -- Bebidas
  ('bebidas', 'Gaseosa 500 ml',        'gaseosa',
   'Bien fría.',
   3200, 'simple', '{}', 1),
  ('bebidas', 'Agua sin gas 500 ml',   'agua',
   'Agua mineral.',
   2500, 'simple', '{}', 2),
  ('bebidas', 'Limonada de la casa',   'limonada',
   'Limón exprimido, menta y jengibre.',
   4200, 'simple', '{nuevo}', 3),

  -- Postres
  ('postres', 'Brownie con helado',    'brownie',
   'Brownie tibio con bocha de helado de crema americana.',
   5900, 'simple', '{}', 1),
  ('postres', 'Milkshake de dulce de leche', 'milkshake-ddl',
   'Helado de dulce de leche batido con leche, con crema y salsa.',
   6900, 'simple', '{popular}', 2)
) as p(category_slug, name, slug, description, base_price, type, badges, sort_order)
join public.categories c on c.slug = p.category_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Grupos por producto
-- ---------------------------------------------------------------------
-- Hamburguesas: pan + extras + quitar
insert into public.product_modifier_groups (product_id, group_id, sort_order)
select p.id, g.id, x.sort_order
from public.products p
join public.categories c on c.id = p.category_id and c.slug = 'hamburguesas'
cross join (values ('pan', 1), ('extras_burger', 2), ('quitar', 3)) as x(code, sort_order)
join public.modifier_groups g on g.code = x.code
on conflict do nothing;

-- Combos: pan + acompañamiento + bebida + extras + quitar
insert into public.product_modifier_groups (product_id, group_id, sort_order)
select p.id, g.id, x.sort_order
from public.products p
join public.categories c on c.id = p.category_id and c.slug = 'combos'
cross join (values ('pan', 1), ('acomp_combo', 2), ('bebida_combo', 3),
                   ('extras_burger', 4), ('quitar', 5)) as x(code, sort_order)
join public.modifier_groups g on g.code = x.code
on conflict do nothing;

-- Papas: tamaño + dips (los aros solo dips)
insert into public.product_modifier_groups (product_id, group_id, sort_order)
select p.id, g.id, x.sort_order
from public.products p
cross join (values ('tamano_papas', 1), ('dips', 2)) as x(code, sort_order)
join public.modifier_groups g on g.code = x.code
where p.slug in ('papas-clasicas', 'papas-cheddar-bacon')
on conflict do nothing;

insert into public.product_modifier_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
from public.products p
join public.modifier_groups g on g.code = 'dips'
where p.slug = 'aros-de-cebolla'
on conflict do nothing;

-- Gaseosa: sabor
insert into public.product_modifier_groups (product_id, group_id, sort_order)
select p.id, g.id, 1
from public.products p
join public.modifier_groups g on g.code = 'sabor_gaseosa'
where p.slug = 'gaseosa'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Cupones de ejemplo
-- ---------------------------------------------------------------------
insert into public.coupons (code, type, value, min_total, max_uses, expires_at) values
  ('BIENVENIDA10', 'percent', 10,   15000, null, null),
  ('BURGER2000',   'fixed',   2000, 20000, 100,  now() + interval '90 days')
on conflict (code) do nothing;
