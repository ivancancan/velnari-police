# Velnari — CLAUDE.md

## Qué es Velnari

Startup de **Public Safety Tech / GovTech** que construye el sistema operativo de operaciones en campo para policías municipales y centros de mando en México. Unifica monitoreo en tiempo real, gestión de incidentes, despacho, supervisión táctica y analítica operativa en una sola plataforma.

**Tagline:** "Velnari: El sistema operativo de la seguridad municipal."
**Promesa:** "Claridad en el despliegue, precisión en la respuesta."

---

## Módulos del Producto

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| **Velnari Command** | Mapa en vivo, supervisión, centro de mando, estado de unidades (web) | En desarrollo |
| **Velnari Dispatch** | Creación, priorización, asignación y seguimiento de incidentes (web) | En desarrollo |
| **Velnari Field** | App móvil para policías y supervisores en campo | En desarrollo |
| **Velnari Insights** | Dashboards, métricas, reportes y análisis operativo | En desarrollo |
| **Velnari Signals** | Alertas, integraciones, sensores y eventos externos | Futuro |

---

## Objetivo del MVP (Fase 1)

Piloto de **8–12 semanas** en 1 municipio, 20–100 unidades. Éxito = reducir tiempo de despacho ≥30% y lograr trazabilidad completa de incidentes.

| Métrica | Baseline esperado | Meta Fase 1 |
|---------|-------------------|-------------|
| Tiempo de asignación | 4–8 min (radio manual) | < 2 min |
| Tiempo de arribo | Sin medición | Reducido 20%+ |
| Incidentes trazados end-to-end | <30% | >85% |
| Unidades conectadas activas | 0% digital | >90% del turno |
| Adopción por turno | N/A | >70% operadores |

---

## Usuarios Clave

- **Operador de cabina** — Asigna y da seguimiento rápido. Dolor: demasiadas fuentes, saturación de radio.
- **Policía en campo** — Recibe instrucciones y actualiza estados. Dolor: ambigüedad, carga administrativa.
- **Supervisor de turno** — Mantiene cobertura y balancea carga. Dolor: visión parcial, decisiones por intuición.
- **Comandante / director operativo** — Mide desempeño y toma decisiones tácticas. Dolor: reportes manuales.
- **Decisor político / ejecutivo** — Demuestra mejoras y justifica inversión. Dolor: poca evidencia operativa.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend Web | Next.js 14 + React 18 + Tailwind CSS |
| Mobile | React Native + Expo |
| Backend | NestJS + TypeScript (modular monolith) |
| Base de Datos | PostgreSQL 17 + PostGIS 3.6 |
| Real-time | Socket.IO (WebSockets) |
| Cache / Jobs | Redis + BullMQ |
| Cloud | AWS (ECS Fargate) |
| Storage | S3 |
| Observabilidad | Sentry + CloudWatch + OpenTelemetry |
| Maps | Mapbox GL JS (web) / MapLibre (actualmente) |
| Auth | JWT + Refresh tokens |
| Monorepo | Turborepo + pnpm workspaces |

---

## Arquitectura

- **Modular monolith** — no microservicios prematuros
- **Event-driven** en flujos críticos (despacho, ubicación)
- **Geoespacial nativo** — PostGIS, mapa como interfaz principal
- **Audit log desde día 1** — toda acción de escritura registrada
- **Multitenancy ligera** — planeada, no activada desde el arranque
- **RBAC fuerte** — decoradores a nivel de endpoint

---

## Estructura del Monorepo

```
apps/
  api/         — NestJS backend (puerto 3001)
  web/         — Next.js frontend (puerto 3000)
  mobile/      — Expo React Native app
packages/
  shared-types/ — DTOs y tipos compartidos entre api y web
  config/       — tsconfig base compartida
docs/
  superpowers/plans/ — planes de implementación feature por feature
scripts/
  simulate-gps.mjs  — simulador de GPS para pruebas
```

---

## Módulos del Backend (NestJS)

- `auth` — JWT, login, refresh tokens, RBAC guards
- `units` — CRUD, estados, ubicación GPS, historial, nearby (PostGIS)
- `incidents` — CRUD, timeline, eventos, stats, heatmap
- `dispatch` — asignación de unidades a incidentes
- `sectors` — zonas geográficas, geocercas, check de geofences
- `patrols` — turnos de patrullaje, cobertura GPS
- `attachments` — upload de archivos a incidentes
- `users` — gestión de usuarios y roles
- `realtime` — Socket.IO gateway, rooms por sector/incidente/comando

---

## Endpoints REST principales

```
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/units               — lista con filtros status/sector/shift
GET    /api/units/nearby        — unidades disponibles por distancia PostGIS
GET    /api/units/stats         — conteo por estado
PATCH  /api/units/:id/location  — actualiza GPS (guarda historial)
GET    /api/units/:id/history   — historial de ubicaciones por fecha
GET    /api/units/:id/incidents — incidentes atendidos por unidad

GET    /api/incidents           — lista con filtros
POST   /api/incidents           — crear incidente
GET    /api/incidents/stats     — KPIs (total, por prioridad, tipo, tiempos)
GET    /api/incidents/heatmap   — puntos para heatmap
POST   /api/incidents/:id/assign    — asignar unidad
POST   /api/incidents/:id/close     — cerrar con resolución
GET    /api/incidents/:id/events    — timeline del incidente

GET/POST /api/patrols
GET    /api/patrols/:id/coverage
DELETE /api/patrols/:id

GET    /api/sectors
GET/POST /api/sectors/:id/boundary

GET    /api/users
POST   /api/users
PATCH  /api/users/:id

GET/POST/DELETE /api/incidents/:id/attachments
```

---

## WebSocket Events (Socket.IO)

```
unit:location:changed   — nueva posición de unidad
unit:status:changed     — cambio de estado de unidad
incident:created        — nuevo incidente
incident:updated        — incidente modificado
incident:assigned       — incidente asignado a unidad
geofence:alert          — unidad entró/salió de sector
```

---

## Base de Datos

Migraciones en `apps/api/src/database/migrations/`:
- `001_initial_schema` — users, audit_logs
- `002_core_schema` — sectors, units, incidents, incident_events
- `003_unit_location_history` — historial GPS con índice GIST
- `004_attachments` — adjuntos a incidentes
- `005_patrols` — patrullajes

Seed: `pnpm --filter api db:seed` — crea 1 sector, 3 usuarios, 6 unidades (P-01 a P-06)

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
pnpm install

# Migraciones
pnpm --filter api db:migrate

# Seed
pnpm --filter api db:seed

# Dev (API en :3001, Web en :3000)
cd apps/api && node_modules/.bin/nest start --watch
cd apps/web && node_modules/.bin/next dev -p 3000

# Tests API
cd apps/api && TS_NODE_PROJECT=tsconfig.jest.json ./node_modules/.bin/jest --no-coverage

# Simulador GPS (requiere auth token)
API_TOKEN=<token> node scripts/simulate-gps.mjs
```

---

## Principios de Producto

1. **Map-first** — La interfaz principal es geoespacial
2. **Decision speed > feature count** — Menos clics, más claridad. <3 clics para despachar.
3. **Auditability by default** — Todo evento importante deja rastro
4. **Offline tolerance** — Contemplar conectividad imperfecta (campo con mala señal)
5. **Role-based simplicity** — Cada rol ve solo lo necesario

---

## Principios de Desarrollo

- TypeScript estricto en todo el proyecto
- El principio rector del MVP: **operativamente usable, no técnicamente impresionante**
- No sobrediseñar; construir lo mínimo que demuestre valor
- Seguridad como prioridad (RBAC, cifrado, auditoría)
- Tests en flujos críticos de despacho — un bug ahí puede costar vidas
- No microservicios prematuros
- Shared types entre api y web via `@velnari/shared-types`

---

## Branding y UI

- **Dark mode por defecto** — centros de mando operan a oscuras
- **Paleta:** Midnight Command `#0F172A` / Tactical Blue `#3B82F6` / Alert Amber `#F59E0B` / Slate Gray `#64748B` / Signal White `#F8FAFC`
- **Tipografía:** Inter/Roboto Mono (títulos) · JetBrains Mono (datos numéricos) · Satoshi (cuerpo)
- **Iconos:** Lucide o Phosphor (líneas finas y claras)
- **Mapas:** escala de grises/dark, solo resaltan unidades (azul) e incidentes (ámbar/rojo)
- **Principio rector de UI:** Reducción de carga cognitiva — en crisis, el operador no debe luchar contra la interfaz

---

## Fuera de Alcance (por ahora)

Reconocimiento facial, video analytics, predicción delictiva compleja, integraciones profundas con C4/C5 legados, workflow judicial, drones, multiagencia completa, IA generativa avanzada.
