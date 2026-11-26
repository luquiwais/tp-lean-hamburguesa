# Deploy (gratis): Vercel + Render + Supabase

```
navegador ──> Vercel (front estático)
                 └─ /api/*  ──rewrite──> Render (Express) ──> Supabase (Postgres + Storage)
```

**Por qué el rewrite:** para el navegador, el front y la API son el **mismo sitio**. Por eso:

- **Cookie:** la cookie `rt` (refresh token) sigue con `SameSite=Lax`.
- **Navegadores:** no la bloquean Safari ni el modo incógnito, que hoy bloquean las cookies de
  terceros.
- **CORS:** no hace falta.
- **Front:** no cambia nada, porque ya llama a `/api` relativo.

La base es la misma de Supabase que se usa en local: las migraciones, el seed y el usuario admin
ya están cargados.

## 1. Back en Render

1. Pusheá `main` a GitHub y esperá a que pase el CI (pestaña Actions).
2. En [render.com](https://render.com) entrá con GitHub y andá a **New > Blueprint**. Elegí el repo
   y Render lee `render.yaml`.
3. Te va a pedir las variables marcadas como `sync: false`. **Cargalas en el panel de Render; no
   las pegues en ningún chat.**

   | Variable                    | Valor                                                                                                          |
   | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
   | `SUPABASE_URL`              | la misma de `server/.env`                                                                                      |
   | `SUPABASE_SERVICE_ROLE_KEY` | la misma de `server/.env`                                                                                      |
   | `CORS_ORIGINS`              | la URL de Vercel (si no la sabés todavía, poné `https://tp-lean-hamburguesa.vercel.app` y la corregís después) |

   Los secretos `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` los genera Render solo.

4. Esperá a que termine el deploy y abrí `https://<tu-servicio>.onrender.com/api/health`. Tiene
   que decir `"database": "ok"`.
5. Si Render le puso otro nombre al servicio (por ejemplo, con un sufijo), cambiá la URL de
   `destination` en `vercel.json` y pusheá.

## 2. Front en Vercel

1. En [vercel.com](https://vercel.com) entrá con GitHub y andá a **Add New > Project**. Importá el
   repo.
2. Dejá **Root Directory** en la raíz del repo: `vercel.json` ya define install, build, salida y
   rewrites. **Deploy**.
3. Anotá la URL que te da (por ejemplo, `https://tp-lean-hamburguesa.vercel.app`). Si es distinta
   de la que pusiste en `CORS_ORIGINS`, corregila en Render: **Environment** y después **Save**,
   y se redeploya solo.

## 3. Verificar

- **API a través de Vercel:**
  - `https://<vercel>/api/health` responde el JSON del back.
  - `https://<vercel>/api/menu` devuelve el menú.
- **SPA:** al recargar en una ruta interna (`/menu/...`) no da 404.
- **IP real del cliente** (para el rate limit):
  1. Hacé un login con contraseña mal desde el navegador.
  2. En **Render > Logs**, buscá la línea `"msg":"request"` de `/api/auth/login`. El campo `ip`
     tiene que ser **tu IP pública** (la ves en <https://ifconfig.me>).
  3. Si aparece una IP de Vercel o de AWS, subí `TRUST_PROXY` a `3`. Si aparece algo raro o
     vacío, bajalo a `1`.

## A tener en cuenta

- **Render gratis se duerme** a los 15 minutos sin tráfico, y la primera request después tarda
  unos 50 s. **Antes de la demo, abrí `/api/health`** para despertarlo. Si la primera carga da
  error 504 mientras se despierta, recargá.
- **Supabase gratis pausa el proyecto** si pasa 7 días sin uso. Se reactiva desde el panel
  (Restore).
- **Front con mocks:** el front usa datos mock (`VITE_USE_MOCKS`) hasta que José termine la
  migración al contrato real (`docs/notas-jose.md`). Cuando esté:
  1. Borrar los mocks, o poner `VITE_USE_MOCKS=false` en **Vercel > Settings > Environment
     Variables**.
  2. Redeployar.
- **Auto-deploy:** cada push a `main` redeploya los dos solos.
