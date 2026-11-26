# tp-lean-hamburguesa

E-commerce de una hamburguesería (TP): menú, personalización de pedidos, carrito, compra simulada,
auth JWT y panel admin.

**Stack:** React + TypeScript + Tailwind v4 (client) · Node + Express + TypeScript en capas
(server) · Supabase (Postgres + Storage) · Zod compartido (shared).

## Estructura

```
client/   Vite + React + Tailwind v4 (+ shadcn/ui desde la Fase 4)
server/   Express por capas: routes -> controllers -> services -> repositories
shared/   Schemas Zod y tipos usados por client y server
docs/     Plan, decisiones y registro de prompts
```

## Cómo correrlo

Requiere Node 20.19+.

```bash
npm install
cp server/.env.example server/.env   # completar a partir de la Fase 1
npm run dev                          # server en :4000, client en :5173
```

| Script              | Qué hace                               |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Levanta server y client juntos         |
| `npm run build`     | Build de producción de server y client |
| `npm run typecheck` | Chequeo de tipos en los 3 paquetes     |
| `npm test`          | Tests (Vitest)                         |
| `npm run lint`      | ESLint en todo el repo                 |
| `npm run format`    | Prettier                               |

Por defecto el front usa un mock del catálogo (`client/src/mocks/catalog.ts`) con el mismo
contrato que la API, así se puede trabajar sin `server/.env`. Con el back corriendo:
`VITE_USE_MOCKS=false npm run dev`.

Ver [docs/plan.md](docs/plan.md) para el plan completo y las decisiones de diseño.
