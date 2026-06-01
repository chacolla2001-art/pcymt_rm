# Deploy manual a Vercel

Los deploys **no** se disparan desde GitHub Actions. Ejecuta estos comandos en tu máquina.

## Requisitos (una vez)

```bash
npm install -g vercel@54
vercel login
```

En Vercel → Project Settings → **Root Directory** debe estar **vacío** (`.`).

## Backend (API)

```bash
cd apps/backend
vercel link          # proyecto: pcymt-rm-api
vercel pull --yes --environment=production
vercel deploy --prod --yes
```

URL: https://pcymt-rm-api.vercel.app

## Frontend (Web admin)

```bash
cd apps/web-admin
vercel link          # proyecto: pcymt-rm-web
vercel pull --yes --environment=production
vercel deploy --prod --yes
```

URL: https://pcymt-rm-web.vercel.app

## Verificar

```bash
curl https://pcymt-rm-api.vercel.app/health
curl -I https://pcymt-rm-web.vercel.app
```

## Tiempos normales

| Proyecto | Tiempo típico |
|----------|----------------|
| API      | ~25–40 s       |
| Web      | ~45–90 s       |

Si ves **Building** más de 5 minutos, cancela con `Ctrl+C` y revisa en [vercel.com/dashboard](https://vercel.com/dashboard) que no haya deploys duplicados en cola (suele pasar con CI + manual a la vez).

## Por qué tardaba antes

1. **GitHub Actions** lanzaba `vercel deploy` en cada push (monorepo + repos separados) → varios builds en cola.
2. Deploys en estado **BLOCKED** (protección / token CI) → el CLI esperaba ~15–20 min y fallaba con *Not authorized*.
3. Desde la **raíz del monorepo** se subían ~135 MB y fallaba el límite de 100 MB.

Solución: un solo deploy manual desde `apps/backend` o `apps/web-admin`.
