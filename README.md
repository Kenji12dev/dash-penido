# Dashboard Penido

Dashboard de gestão comercial (leads, vendas, colaboradores e metas).

## Stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind CSS
- Supabase (auth, banco e edge functions)

## Desenvolvimento

```sh
npm install
npm run dev
```

A app sobe em `http://localhost:8080`.

## Variáveis de ambiente

Crie um `.env` na raiz com:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Build

```sh
npm run build
```

## Deploy

Deploy na Vercel (SPA — fallback configurado em `vercel.json`).
