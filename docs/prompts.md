# Prompts del usuario

Registro textual de los prompts usados durante el desarrollo del TP.

## Prompt 1
> que haces claude, cucha, tengo que hacer un tp que es basicamente armar una pagina web tipo ecomerce que sea una hamburgueseria en donte tengas un menu, carrito, compras simuladas, personalizacion de pedidos, etc. para buscar que fetures necesitamos y que diseño aplicar manda a dos agentes de investigacion. para la parte tecnica queremos usar node.js, react.js, typescript, tailwind, jwt como metodo de autenticacion, el metodo de las capas de routes, controllers, services, etc para el backend, y tiene que estar conectado a una base de datos de supabase. estaria bueno tambien (siempre y cuando no involucre costos) meter un servicio para guradar metadata tipo imagenes. no quiero que sea un oneshoteo asi que manda los agentes a investigar y proponeme un plan con todas las decisiones por tomar

## Prompt 2
> che y deja todos mis prompts en un archivo, ademas, busca modelos de negocio que ya funcionan bien como pedidos ya, dordash u ese tipo de aplicaciones como inspiracion para el ux/ui

## Prompt 3
> me gusta estilo shake shack, ademas por lo de supabase no pasa nada porque es para un tp nd mas

## Prompt 4
> dale vamos con la fase 0, y tenes anotado para el back el tema de las capas no?

## Prompt 5
> pongo rls automatico en supabase?

## Prompt 6
> commitea lo que ya tenemos y ahi estoy trallendo las credenciales de la base de datos

## Decisiones tomadas por cuestionario
- Auth: navegar como invitado, login al confirmar el pedido.
- Tokens: access token en memoria + refresh token en cookie httpOnly con rotación.
- Acceso a DB: supabase-js (solo backend) + funciones RPC de Postgres.
- Extras: cupones + barra de envío gratis.
- Auth propia (bcrypt + jsonwebtoken).
- Estados del pedido: manual desde admin + toggle de auto-avance.
- UI: shadcn/ui + Tailwind v4.
- Deploy gratis al final (Vercel + Render).
