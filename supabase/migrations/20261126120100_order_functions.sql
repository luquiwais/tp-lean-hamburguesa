-- =====================================================================
-- Funciones transaccionales de pedidos (se llaman via supabase.rpc()).
--
-- IMPORTANTE: estas funciones NO calculan precios ni validan reglas de
-- negocio complejas; eso lo hace el service del backend leyendo la DB.
-- Su trabajo es escribir todo de forma ATOMICA (o todo o nada).
-- Solo service_role puede ejecutarlas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_order: inserta pedido + items + modificadores + historial y
-- consume el cupon (si hay) en una sola transaccion.
--
-- p_order: { user_id, fulfillment, customer_name, customer_phone,
--            address_snapshot, subtotal, delivery_fee, discount, total,
--            coupon_id, coupon_code, payment_method, payment_brand,
--            payment_last4, cash_amount, notes }
-- p_items: [{ product_id, product_name, unit_base_price, quantity,
--             item_total, notes,
--             modifiers: [{ modifier_id, group_name, modifier_name,
--                           price_delta, quantity }] }]
-- Devuelve: { id, order_number }
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id      uuid;
  v_order_number  bigint;
  v_user_id       uuid := nullif(p_order ->> 'user_id', '')::uuid;
  v_coupon_id     uuid := nullif(p_order ->> 'coupon_id', '')::uuid;
  v_item          jsonb;
  v_item_id       uuid;
  v_mod           jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) > 30 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'P0001';
  end if;

  -- Consumir el cupon de forma atomica (evita que dos pedidos simultaneos
  -- superen max_uses).
  if v_coupon_id is not null then
    update public.coupons c
       set used_count = c.used_count + 1
     where c.id = v_coupon_id
       and c.is_active
       and (c.expires_at is null or c.expires_at > now())
       and (c.max_uses is null or c.used_count < c.max_uses);

    if not found then
      raise exception 'COUPON_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    user_id, status, fulfillment, customer_name, customer_phone, address_snapshot,
    subtotal, delivery_fee, discount, total, coupon_id, coupon_code,
    payment_method, payment_brand, payment_last4, cash_amount, notes
  ) values (
    v_user_id,
    'pending',
    p_order ->> 'fulfillment',
    p_order ->> 'customer_name',
    p_order ->> 'customer_phone',
    case when jsonb_typeof(p_order -> 'address_snapshot') = 'object'
         then p_order -> 'address_snapshot' end,
    (p_order ->> 'subtotal')::integer,
    coalesce((p_order ->> 'delivery_fee')::integer, 0),
    coalesce((p_order ->> 'discount')::integer, 0),
    (p_order ->> 'total')::integer,
    v_coupon_id,
    nullif(p_order ->> 'coupon_code', ''),
    p_order ->> 'payment_method',
    nullif(p_order ->> 'payment_brand', ''),
    nullif(p_order ->> 'payment_last4', ''),
    nullif(p_order ->> 'cash_amount', '')::integer,
    nullif(p_order ->> 'notes', '')
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product_id, product_name, unit_base_price, quantity, item_total, notes
    ) values (
      v_order_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      v_item ->> 'product_name',
      (v_item ->> 'unit_base_price')::integer,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'item_total')::integer,
      nullif(v_item ->> 'notes', '')
    )
    returning id into v_item_id;

    for v_mod in
      select value from jsonb_array_elements(coalesce(v_item -> 'modifiers', '[]'::jsonb))
    loop
      insert into public.order_item_modifiers (
        order_item_id, modifier_id, group_name, modifier_name, price_delta, quantity
      ) values (
        v_item_id,
        nullif(v_mod ->> 'modifier_id', '')::uuid,
        v_mod ->> 'group_name',
        v_mod ->> 'modifier_name',
        (v_mod ->> 'price_delta')::integer,
        coalesce((v_mod ->> 'quantity')::integer, 1)
      );
    end loop;
  end loop;

  insert into public.order_status_history (order_id, status, changed_by)
  values (v_order_id, 'pending', v_user_id);

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
end;
$$;

-- ---------------------------------------------------------------------
-- change_order_status: cambia el estado SOLO si el pedido sigue en el
-- estado esperado (control de concurrencia optimista) y registra el
-- historial. El mapa de transiciones permitidas vive en el service del
-- backend; aca se garantiza atomicidad y que nadie lo cambio en el medio.
-- Devuelve true si se aplico, false si el estado ya no era p_from.
-- ---------------------------------------------------------------------
create or replace function public.change_order_status(
  p_order_id    uuid,
  p_from        text,
  p_to          text,
  p_changed_by  uuid default null,
  p_note        text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.orders o
     set status = p_to
   where o.id = p_order_id
     and o.status = p_from;

  if not found then
    return false;
  end if;

  insert into public.order_status_history (order_id, status, changed_by, note)
  values (p_order_id, p_to, p_changed_by, p_note);

  return true;
end;
$$;

-- Solo el backend (service_role) puede ejecutarlas.
revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.change_order_status(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
grant execute on function public.change_order_status(uuid, text, text, uuid, text) to service_role;
