# Plan de Implementación — Corrección del Audit monday-AI

> Generado a partir del audit completo del proyecto. Cubre **25 issues** (6 críticos, 7 rendimiento, 7 UX, 5 prioridad baja) en **7 fases** con verificación por fase.
>
> **Estado:** Pendiente de ejecución
> **Decisión de BD:** PostgreSQL como motor default (alineado con `schema.prisma` actual)
> **Estrategia de commits:** 1 commit por issue (o agrupado por sub-fase) — sin `--no-verify`, sin `--force`

---

## Convenciones

- Cada fase termina con **verificación obligatoria** (comandos listados). No pasar a la siguiente fase sin verificar.
- Prefix de commits: `fix:`, `perf:`, `ux:`, `chore:`, `refactor:` según naturaleza.
- No se eliminan archivos hasta que la fase de verificación pase.
- Si una fase introduce un breaking change en BD, generar migración Prisma.

---

# FASE 0 — Preparación (sin tocar código)

Objetivo: garantizar punto de retorno seguro.

- [ ] 0.1 Verificar working tree limpio: `git status`
- [ ] 0.2 Crear rama de trabajo: `git switch -c audit-fixes`
- [ ] 0.3 Snapshot del estado actual: `git tag pre-audit-snapshot`
- [ ] 0.4 Confirmar que `npm run lint` y `npx tsc --noEmit` (con `ignoreBuildErrors: true` aún activo) ejecutables — solo para baseline de warnings

**Verificación F0:** `git log --oneline -3` muestra la nueva rama.

---

# FASE 1 — Inconsistencia de base de datos (CRÍTICO)

> **Decisión tomada con el usuario:** PostgreSQL es el motor default.
> Esto impacta el chain Docker completo + `.env.example` + `schema.prisma`.

## 1.1 Actualizar `.env.example` a PostgreSQL

- [ ] Reemplazar `DATABASE_URL=file:/app/data/custom.db` por un ejemplo Neon/Vercel Postgres:
  ```
  DATABASE_URL="postgresql://user:password@host:5432/monday_ai?schema=public"
  ```
- [ ] Añadir nota explicando que se requiere un Postgres externo (Neon gratis recomendado).
- [ ] Eliminar referencia a "SQLite (ruta dentro del contenedor Docker)" en comentarios.

**Archivo:** `.env.example`
**Verificación:** diff presenta solo URL y comentarios cambiados.

## 1.2 Sincronizar `prisma/schema.prisma`

- [ ] Confirmar `provider = "postgresql"` (ya está).
- [ ] Actualizar comentario header (líneas 5-6) — eliminar mención a "SQLite (desarrollo)".
- [ ] Validar que no hay tipos SQLite-only en el schema (no debería haber).
- [ ] Generar migración base: `npx prisma migrate dev --name init --create-only` (si no existe `prisma/migrations/`).

**Archivo:** `prisma/schema.prisma`
**Verificación:** `npx prisma format && npx prisma validate` sin errores.

## 1.3 Actualizar cadena Docker a PostgreSQL

### 1.3.1 `Dockerfile`
- [ ] Line 41: eliminar `ENV DATABASE_URL=file:/app/data/custom.db` — la URL la provee el compose o `.env`.
- [ ] Line 47-49: reemplazar `sqlite3` (no se instala, pero el comentario lo sugiere) y comentar que se requiere Postgres externo.
- [ ] Linea 42: `ENV ZAI_API_KEY=""` puede quedarse.
- [ ] Line 52: mantener standalone build (ya correcta tras commit a16820b8).

### 1.3.2 `docker-compose.yml`
- [ ] Line 27: eliminar `DATABASE_URL=file:/app/data/custom.db` del `environment:`.
- [ ] Líneas 20-22: el volume `monday-ai-data:/app/data` ya no es necesario para la DB (Postgres es externo). Considerar eliminar el volume o comentar que es solo para logs/leansuploads.
- [ ] Añadir comentado un ejemplo de `DATABASE_URL` para Neon.
- [ ] Healthcheck: en linea 40 cambia el endpoint a `/api/health` (issue futuro de UX).

### 1.3.3 `docker-entrypoint.sh`
- [ ] Reescribir bloque línea 10-18: ya no se crea DB SQLite. Reemplazar por:
  - Si `DATABASE_URL` no seteada → salir con error claro.
  - `npx prisma migrate deploy` (aplica migraciones pendientes en el Postgres externo).
  - `npx prisma db seed` solo si hay seed script.
- [ ] Eliminar `--skip-generate` y `2>/dev/null` (silenciaba errores reales).

### 1.3.4 `.dockerignore` y `README-Docker.md`
- [ ] `README-Docker.md`: actualizar instrucciones para que el usuario provea `DATABASE_URL` de Postgres antes de hacer `docker-compose up`.
- [ ] `.dockerignore`: ya existe, pero confirmar que no se filtra el `.env.local` por error.

**Verificación F1:**
- `npx prisma validate` → ok
- `docker build -t monday-ai-test .` → ok (sin build errors)
- `docker-compose config` → ok (YAML válido)
- Build de Next: `npm run build` → ok

**Commit sugerido:** `fix(db): estandarizar a PostgreSQL en schema, env y Docker`

---

# FASE 2 — Bugs críticos en APIs de agentes

## 2.1 Reemplazar `new PrismaClient()` en `agent/run` por singleton `db` (Issue #2)

- [ ] `src/app/api/agent/run/route.ts` líneas 127-142:
  - Eliminar `const { PrismaClient } = await import("@prisma/client");` y `const prisma = new PrismaClient();`
  - Reemplazar por `import { db } from "@/lib/db";` al top del archivo.
  - Usar `db.agentExecution.create({ ... })`.
  - **Eliminar** `await prisma.$disconnect();` (el singleton lo gestiona el proceso).
- [ ] Mantener el bloque en `try/catch` no crítico.

**Archivo:** `src/app/api/agent/run/route.ts`
**Verificación:** `rg "new PrismaClient" src/` solo debe devolver `src/lib/db.ts:9`.

## 2.2 Arreglar `defaultGroqModel` inexistente (Issue #3)

- [ ] `src/app/api/agent/chat/route.ts` línea 48:
  - Reemplazar `"llama-3.3-70b-versatile"` por `"meta/llama-3.3-70b-instruct"`.
- [ ] Documentar por qué este default (balance calidad/velocidad en NVIDIA integrate API).

**Archivo:** `src/app/api/agent/chat/route.ts`

## 2.3 Limitar auto-promoción de modelo (Issue #4)

- [ ] `src/lib/groq-client.ts` líneas 342-345 en `chat()`:
  - Solo promover a Llama 3.3 si `modelId` está vacío, es `null`, `"default"`, o no está en `MODEL_CATALOG`.
  - Si el usuario seleccionó GLM-4.6 explícitamente, **respetar** su elección (usar Z.ai incluso con Groq key disponible).
  - Si seleccionó un modelo Groq (Llama/DeepSeek), usar ese.
- [ ] Añadir test rápido mental: usuario con Groq key y selección `deepseek-ai/deepseek-r1` debe llegar a R1, no a 70B.

**Archivo:** `src/lib/groq-client.ts`

## 2.4 Tipar y validar `createVision` (Issue #5)

- [ ] `src/app/api/agent/vision/route.ts` línea 60:
  - Antes de llamar `zai.chat.completions.createVision`, validar:
    ```ts
    if (typeof (zai as any).chat?.completions?.createVision !== "function") {
      return 503 con mensaje claro "Visión no disponible en este entorno"
    }
    ```
  - Si es posible, importar tipos del SDK y eliminar `any`.

**Archivo:** `src/app/api/agent/vision/route.ts`

## 2.5 Excel import — añadir `blankrows: false` (Issue #6)

- [ ] `src/app/api/excel/import/route.ts` línea 43:
  - Cambiar a `XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })`.
- [ ] Validar en el parser `parseMondayExcel` que filtra filas completamente vacías (defensa en profundidad).

**Archivo:** `src/app/api/excel/import/route.ts`, `src/lib/excel-parser.ts`

**Verificación F2:**
- `npm run typecheck` (debe pasar)
- `npm run lint` por lo menos sin errores nuevos
- Test manual: ejecutar `curl -X POST http://localhost:3000/api/agent/run` con mock agent → persiste en DB sin abrir nueva conexión

**Commit sugerido:** `fix(api): corrige modelo Groq inexistente, singleton Prisma y validación vision`

---

# FASE 3 — Rendimiento del store Zustand

## 3.1 Partialize del persist — no ensuciar localStorage (Issue #8)

- [ ] `src/lib/store.ts` añadir `partialize` al wrapper `persist`:
  ```ts
  partialize: (state) => ({
    boards: state.boards,
    agents: state.agents,
    settings: state.settings,
    favoriteBoardIds: state.favoriteBoardIds,
    recentBoardIds: state.recentBoardIds,
    activeBoardId: state.activeBoardId,
    activeViewId: state.activeViewId,
    mondayApiKey: state.mondayApiKey,
    mondayConnected: state.mondayConnected,
    mondayAccount: state.mondayAccount,
    // NO persistir: executions, updates, activities, notifications, files, sidekickMessages
  })
  ```
- [ ] Añadir `version: 2` y `migrate` para limpiar state legacy sin romper usuarios existentes.

**Archivo:** `src/lib/store.ts`

## 3.2 Selectores por board (Issue #7)

- [ ] No refactorizar a immer todavía (riesgo alto). En su lugar:
  - En `updateColumnValue` y similares, salir temprano si el item no está en ningún board visible.
  - Añadir un helper `updateItemsInBoard(boardId, updater)` que reduzca el map anidado.
- [ ] Para los callers de componentes, usar `useAppStore((s) => s.boards.find(b => b.id === boardId))` en vez de mapear todo.

**Archivo:** `src/lib/store.ts`
**Verificación:** React DevTools profiler — menos renders en `updateColumnValue`.

## 3.3 Eliminar streaming falso (Issue #9)

- [ ] `src/lib/groq-client.ts` `chatStream()` líneas 384-393:
  - Eliminar el bucle `for` con `setTimeout(12ms)`.
  - En su lugar, emitir todo el `result.content` en un único evento `delta` (o chunk por línea/simple slice sin delay).
- [ ] `src/app/api/agent/chat/route.ts` líneas 119-128: igual — eliminar `Sleep(15ms)`.
- [ ] `src/app/api/agent/run/route.ts` líneas 102-109: igual.
- [ ] Mantener el evento `delta`/`chunk` en SSE (el cliente ya lo maneja), simplemente sin delay.

**Archivos:** `src/lib/groq-client.ts`, `src/app/api/agent/chat/route.ts`, `src/app/api/agent/run/route.ts`

## 3.4 Simplificar `parseZaiResponse` (Issue #10)

- [ ] `src/lib/groq-client.ts`:
  - Eliminar el fallback regex en líneas 290-315. Si el parser O(n) no encontró el JSON, no reintentar.
  - El formato `Calling tool: name(args)` es del LLM improvisando; no confiable.
- [ ] Alternative: si se quiere mantener el fallback, ejecutarlo solo si `tool_call` no está presente en el contenido Y el contenido termina con `)`. Acota el regex.

**Archivo:** `src/lib/groq-client.ts`

## 3.5 Reactivar TypeScript check en build (Issue #11)

- [ ] `next.config.ts` línea 6: cambiar `ignoreBuildErrors: true` → `false`.
- [ ] Ejecutar `npx tsc --noEmit` para listado completo de errores tipográficos.
- [ ] Corregir los errores tipográficos bloqueantes (pueden ser muchos — aislar en subfase 3.5b).

### 3.5b Sub-fase — corrección de tipos (si falla el build)
- [ ] Iterar `tsc --noEmit` hasta limpio.
- [ ] Para `any` explícitos no-críticos, dejar `// TODO: tipar` y seguir.

**Archivo:** `next.config.ts`
**Verificación F3:** `npm run build` sin errores TypeScript.

## 3.6 Logger de Prisma condicional (Issue #12)

- [ ] `src/lib/db.ts` línea 10:
  ```ts
  log: process.env.NODE_ENV === 'development' ? ['query'] : ['error']
  ```

**Archivo:** `src/lib/db.ts`

## 3.7 `setState` en effects (Issue #13)

13 errores de `react-hooks/set-state-in-effect`. Patrón común: re-sync de estado local cuando cambian props del store.

### Corrección por archivo:
- [ ] `src/app/home-client.tsx:66` (`LazyMount`): pasar a `mounted = open || useState(open)` con derivación.
- [ ] `src/components/monday/board-view.tsx:489` y `:614`: usar `useMemo` o `key={JSON.stringify(filters)}` para resetear sin effect.
- [ ] `src/components/monday/command-palette.tsx:229` (`setSelectedIndex(0)` on query change): mover al `onChange` del input.
- [ ] `src/components/monday/command-palette.tsx:235` (focus input): válido, agregar `// eslint-disable-next-line` con justificación.
- [ ] Revisar el resto (líneas 26, 68, 98, 14 según el lint) y aplicar mismo patrón.

**Archivos:** múltiples en `src/components/monday/` y `src/app/home-client.tsx`
**Verificación F3.7:** `npm run lint` sin warnings `set-state-in-effect`.

**Verificación F3 total:**
- `npm run build` sin errores TS
- `npm run lint` sin warnings `set-state-in-effect`
- localStorage del navegador no excede 1MB tras sesión normal

**Commit sugerido:** `perf(store): partialize localStorage y elimina streaming falso`

---

# FASE 4 — Mejoras de UX

## 4.1 Estimación real de tokens y coste (Issue #14, #15)

- [ ] `src/lib/model-catalog.ts`: añadir `pricePerMillionTokens: { input: number, output: number }` a cada `ModelInfo`.
- [ ] `src/app/api/agent/run/route.ts:111`: usar `data.usage.total_tokens` del response del provider cuando exista, fallback a `content.length/4`.
- [ ] `src/hooks/use-agent-execution.ts:115`: calcular coste usando `MODEL_CATALOG.find(m => m.id === model).pricePerMillionTokens.output * tokens / 1e6`.

**Archivos:** `src/lib/model-catalog.ts`, `src/app/api/agent/run/route.ts`, `src/hooks/use-agent-execution.ts`

## 4.2 Recuperar errores de empty content (Issue #16)

- [ ] `src/app/api/agent/run/route.ts:93`:
  - Si `result.content === ""` PERO `result.toolCalls.length > 0` → seguir el flujo, no cerrar.
  - Si ambos vacíos → volver a intentar con `temperature + 0.1` (1 retry máximo).
  - Si sigue vacío → emitir `error` con mensaje acctionable.

**Archivo:** `src/app/api/agent/run/route.ts`

## 4.3 Cancelación real del backend (Issue #17)

- [ ] `src/lib/groq-client.ts` `chat()` línea 330:
  - Aceptar `opts.signal` y pasar a `callZai` (callGroq ya lo usa en línea 82).
  - En `callZai` línea 200, añadir `signal: opts.signal` al `zai.chat.completions.create` (sí lo soporta).
- [ ] `src/app/api/agent/run/route.ts`: ya pasa `req.signal`... verificar que `chat()` lo recibe correctamente.

**Archivo:** `src/lib/groq-client.ts`

## 4.4 Suspense y loading states (Issue #18)

- [ ] Crear `src/app/loading.tsx` con skeleton simple (mismo estilo del Splash de `HydrationGate`).
- [ ] Marcar componentes pesados como `dynamic(() => import('...'), { ssr: false, loading: () => <Skeleton />)`:
  - `BoardView`, `SidekickChat`, `OrchestratorVisualizer`.
- [ ] No marcar como dynamic nada que sea crítico para SEO.

**Archivos:** `src/app/loading.tsx` (nuevo), `src/app/home-client.tsx`

## 4.5 Cerrar modales con Escape consistente (Issue #19)

- [ ] Revisar componentes Radix `Dialog`/`AlertDialog` — Radix ya maneja Escape por defecto.
- [ ] Si hay modales custom (no-Radix) en `agent-builder.tsx` o `settings-dialog.tsx`, añadir `onKeyDown` handler.
- [ ] Verificar que al cerrar con Escape no se pierden cambios no guardados (añadir `onAbortConfirm` si aplica).

**Archivos:** `src/components/monday/agent-builder.tsx`, `src/components/monday/settings-dialog.tsx`

## 4.6 Undo para deletes destructivos (Issue #20)

- [ ] `src/lib/store.ts`:
  - `deleteGroup`, `deleteBoard`, `deleteWorkspace` → en vez de `filter`, marcar con `archivedAt: new Date().toISOString()` y filtrar en selectors.
  - Mantener `hardDelete` separado para cuando el usuario confirma.
- [ ] Exponer acción `undoDelete(id)` que remueve `archivedAt`.
- [ ] Toast de "Deshacer" visible 5s tras delete.

**Archivo:** `src/lib/store.ts`

## 4.7 HydrationGate robusto (Issue #25)

- [ ] `src/components/monday/hydration-gate.tsx`:
  - Añadir timeout de seguridad: si `_hasHydrated` no es `true` después de 5s, forzar `setHasHydrated(true)` y mostrar toast "Estado local corrupto, cargando datos seed".
  - Wrappear `api.rehydrate()` en try/catch más estricto.

**Archivo:** `src/components/monday/hydration-gate.tsx`

**Verificación F4:**
- Detener agente en ejecución y verificar que el backend deja de generar (logs del provider).
- Borrar localStorage manualmente → carga datos seed sin colgarse.
- Probar board con 100+ items → no jank en filtros.

**Commit sugerido:** `ux: undo deletes, skeletons, cost/cálculo real y robustez hidratación`

---

# FASE 5 — Limpieza y alineación de catálogo (Prioridad baja)

## 5.1 Actualizar catálogo de modelos (Issue #21)

- [ ] `src/lib/model-catalog.ts`:
  - Renombrar `provider: "groq"` → `"nvidia"` (ya estamos en NVIDIA integrate API tras commit 7285adce).
  - Actualizar `description` para reflejar el provider real.
  - Añadir el modelo GLM-4.6 confirmado y revisar GLM-4.5-air (¿soporta tools realmente?).
  - Verificar que todos los IDs están disponibles en la API de NVIDIA integrate.

**Archivo:** `src/lib/model-catalog.ts`

## 5.2 Reparar script `dev` (Issue #22)

- [ ] `package.json` línea 6:
  - Reemplazar `"next dev -p 3000 2>&1 | tee dev.log"` por `"next dev -p 3000"`.
  - Si se quiere logpersistente, usar `concurrently` + `cross-env` (añadir dep).

**Archivo:** `package.json`

## 5.3 Alinear script `start` (Issue #23)

- [ ] `package.json` línea 9:
  - Eliminar referencia a `.next/standalone/server.js` (eliminado en a16820b8).
  - Reemplazar por `next start -p ${PORT:-3000}`.
  - Mantener `tee` solo si se queda con logs.

**Archivo:** `package.json`

## 5.4 Activar React StrictMode (Issue #24)

- [ ] `next.config.ts` línea 8: `reactStrictMode: false` → `true`.
- [ ] Después de activar, ejecutar app en dev y revisar warnings de efectos dobles.
- [ ] Corregir efectos que se ejecutan 2 veces si rompen lógica (ej: listeners duplicados).

> ⚠️ **Esta issue está acoplada a Fase 3.7** — si los `setState en effect` no están arreglados, StrictMode reventará la app. Hacer 5.4 **después** de 3.7.

**Archivo:** `next.config.ts`

## 5.5 Eliminar `reactStrictMode: false` residuales

- [ ] Búsqueda `rg "reactStrictMode" src/` para detectar overrides manuales si los hay.

**Verificación F5:**
- `npm run dev` arranca sin errores en Windows ni Linux.
- `npm run build && npm start` arranca correctamente.
- Catálogo muestra los modelos reales disponibles.

**Commit sugerido:** `chore: alinea catálogo NVIDIA, scripts dev/start y activa strict mode`

---

# FASE 6 — Verificación final y rollback plan

## 6.1 Verification Suite

- [ ] `npm run lint` — 0 errores
- [ ] `npm run typecheck` (crear script si no existe: `"typecheck": "tsc --noEmit"`)
- [ ] `npm run build` — success en < 3 minutos
- [ ] `npm run dev` manual smoke test:
  - Cargar app, hacer login visual, crear board, añadir item, ejecutar agente.
  - Probar import desde Excel.
  - Probar cancel de agente en ejecución.
- [ ] `docker-compose up --build` end-to-end si aplica.
- [ ] Verificar `localStorage` no excede 1MB en sesión normal.

## 6.2 Documentación final

- [ ] Actualizar `README-Docker.md` con instrucciones Postgres.
- [ ] Actualizar `.env.example` con todos los variables finales.
- [ ] Anotar en `package.json` incrementar `version: 0.2.0` → `0.3.0`.
- [ ] Eliminar `prisma/dev.db` si todavía existe (ya no se usa).

## 6.3 Plan de rollback

Si algo crítico falla en producción:
1. `git revert <commit-hash>` por cada commit de FASE 1 y 2.
2. Si DB ya migrada a Postgres y necesita volver a SQLite: regenerar `prisma/schema.prisma` con `provider = "sqlite"` y `DATABASE_URL=file:./dev.db`, restaurar Dockerfile/Docker-compose from `pre-audit-snapshot`.
3. Restaurar tag `pre-audit-snapshot`: `git reset --hard pre-audit-snapshot` (solo en emergencia).

**Commit final sugerido:** `chore: bump 0.3.0 y docs post-audit`

---

# Resumen de issues cubiertos

| # | Severidad | Fase | Descripción |
|---|---|---|---|
| 1 | 🔴 | 1 | .env.example vs schema.prisma inconsistencia |
| 2 | 🔴 | 2.1 | `new PrismaClient()` por request en agent/run |
| 3 | 🔴 | 2.2 | `defaultGroqModel` inexistente |
| 4 | 🔴 | 2.3 | Auto-promoción rota de modelo |
| 5 | 🔴 | 2.4 | `createVision` sin tipar/validar |
| 6 | 🔴 | 2.5 | Excel import no filtra blank rows |
| 7 | 🟠 | 3.2 | Clónes gigantescos en store actions |
| 8 | 🟠 | 3.1 | localStorage sin partialize |
| 9 | 🟠 | 3.3 | Streaming falso con setTimeout |
| 10 | 🟠 | 3.4 | Parser O(n²) residual en parseZai |
| 11 | 🟠 | 3.5 | `ignoreBuildErrors: true` |
| 12 | 🟠 | 3.6 | `log: ['query']` en prod |
| 13 | 🟠 | 3.7 | `setState` en effects (13 errores lint) |
| 14 | 🟡 | 4.1 | Estimación tokens `length/4` |
| 15 | 🟡 | 4.1 | `costUsd` hardcodeado |
| 16 | 🟡 | 4.2 | Empty content sin retry |
| 17 | 🟡 | 4.3 | Cancelación no propagada a backend |
| 18 | 🟡 | 4.4 | No hay Suspense / loading.tsx |
| 19 | 🟡 | 4.5 | Escape inconsistente en modales |
| 20 | 🟡 | 4.6 | Deletes sin undo |
| 21 | 🟢 | 5.1 | Catálogo desactualizado (a NVIDIA) |
| 22 | 🟢 | 5.2 | `dev` script con `tee` (no Windows) |
| 23 | 🟢 | 5.3 | `start` referencia standalone eliminado |
| 24 | 🟢 | 5.4 | `reactStrictMode` desactivado |
| 25 | 🟡 | 4.7 | HydrationGate sin timeout de seguridad |

---

# Orden recomendado de ejecución

```
F0 → F1 → F2 → F3 → F4 → F5 → F6
                ↑
                └── 5.4 DEBE ir después de 3.7
```

**Tiempo estimado total:** 8-12 horas de implementación efectiva, distribuidas idealmente en 3-4 sesiones de trabajo.

**Sesión 1 recomendada:** F0 + F1 + F2 (críticos para arrancar)
**Sesión 2 recomendada:** F3 (rendimiento) — la más larga
**Sesión 3 recomendada:** F4 + F5 + F6 (UX + limpieza + verificación)

---

# Notas para el agente que ejecute este plan

1. **No usar `--no-verify`** en ningún commit. Si un hook falla, fixearlo.
2. **No hacer `git push --force`**. La rama `audit-fixes` se integra por PR o merge normal.
3. **Cada fase** debe terminar con un commit atómico. No mezclar issues de fases distintas en un solo commit.
4. **Si te bloqueas** en un issue (ej: 5b tiene 50 errores TS), atascarse no es opción — aislar en otro commit `wip:` y continuar con el siguiente issue.
5. **Verificación es obligatoria**. Un issue no se considera hecho hasta que su verificación específica pase.
6. **Reportar progreso**: ir marcando los `[ ]` como `[x]` en este archivo a medida que avanzas.
