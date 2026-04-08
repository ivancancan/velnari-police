# Velnari — Fase 1 Product Blueprint
### AI Product Development Squad Output
**Fecha:** 2026-04-06
**Version:** 1.0

---

## Alineamiento Inicial del Equipo

**PM Principal:** "Tenemos un business case solido con un wedge claro: despacho y supervision operativa para policia municipal. Nuestro norte para Fase 1 es un piloto pagado de 8-12 semanas en 1 municipio, 20-100 unidades. El exito se mide en reduccion de tiempo de despacho y adopcion por turno. No construimos una plataforma, construimos una solucion operativa que demuestra valor en semanas."

**Architect:** "Modular monolith con NestJS, PostGIS nativo, WebSockets para real-time. No microservicios prematuros. La base de datos es la fuente de verdad geoespacial. Audit log desde dia 1."

**Staff Engineer:** "Monorepo con Turborepo. API REST + WebSocket events. Mobile con React Native compartiendo tipos con el backend. CI/CD simple: GitHub Actions + AWS."

**UX/UI Lead:** "Dark mode por defecto para centros de mando. Mapa como interfaz principal. Menos de 3 clics para despachar. La app movil debe funcionar con una mano, bajo presion, con guantes."

**Copywriter:** "Tono directo, tipo mision militar moderna. Nada decorativo. Cada palabra en la UI debe reducir ambiguedad, no agregarla."

**Tech Writer:** "Documentacion por rol. El operador de cabina no necesita saber lo mismo que el comandante. Guias cortas, visuales, accionables."

**QA Manager:** "Testing critico en flujos de despacho — un bug ahi puede costar vidas. Automatizacion desde el sprint 1. Edge cases de conectividad y concurrencia."

---

## 1. Resumen Ejecutivo

Velnari Fase 1 entrega tres productos funcionales — **Command** (web), **Dispatch** (web), y **Field** (mobile) — para un piloto de 8-12 semanas con una corporacion municipal. El objetivo es demostrar que una policia municipal puede reducir su tiempo de despacho en al menos 30% y lograr trazabilidad completa de incidentes usando una plataforma unificada.

### Metricas de exito del piloto

| Metrica | Baseline esperado | Meta Fase 1 |
|---------|-------------------|-------------|
| Tiempo de asignacion (despacho) | 4-8 min (radio manual) | < 2 min |
| Tiempo de arribo promedio | Sin medicion confiable | Medido y reducido 20%+ |
| Incidentes trazados end-to-end | < 30% | > 85% |
| Unidades conectadas activas | 0% digital | > 90% del turno |
| Adopcion por turno | N/A | > 70% de operadores usando la plataforma |
| Incidentes sin cierre formal | ~50% | < 15% |

### Entregables de Fase 1
- Velnari Command (web) — Mapa en vivo + supervision
- Velnari Dispatch (web) — Gestion de incidentes + asignacion
- Velnari Field (mobile) — App para unidades en campo
- Dashboard operativo basico (parte de Command)
- Bitacora y auditoria minima
- Reportes basicos exportables

---

## 2. Definicion de Fase 1 (MVP)

### 2.1 Product Vision Statement

> "Velnari convierte la operacion dispersa de una policia municipal en una operacion visible, coordinada y medible — en semanas, no en anos."

### 2.2 MVP Scope — Lo que entra (P0)

#### Modulo: Autenticacion y Roles
- Login seguro (email + password, 2FA opcional)
- Roles: Admin, Operador de Cabina, Supervisor, Unidad de Campo, Comandante
- RBAC: cada rol ve solo sus funciones
- Sesiones con timeout configurable
- Audit log de accesos

#### Modulo: Velnari Command (Mapa en Vivo)
- Mapa full-screen como interfaz principal
- Posicion en tiempo real de todas las unidades activas
- Estado visual de cada unidad (Disponible, En ruta, En escena, Fuera de servicio)
- Filtros basicos: por sector, por estado
- Indicadores de cobertura por zona
- Capas: sectores/cuadrantes del municipio
- Click en unidad → detalle rapido (estado, ultimo incidente, tiempo en estado)

#### Modulo: Velnari Dispatch (Incidentes)
- Crear incidente (tipo, prioridad, ubicacion, descripcion)
- Tipos de incidente configurables (robo, accidente, riña, etc.)
- Prioridades: Critica, Alta, Media, Baja
- Asignacion manual de unidad(es) a incidente
- Timeline del incidente (creado → asignado → en ruta → en escena → cerrado)
- Vista de lista de incidentes activos con filtros
- Vista de incidente individual con mapa + timeline + notas
- Cierre de incidente con resolucion
- Reasignacion de unidad

#### Modulo: Velnari Field (App Movil)
- Login por credenciales
- Vista de mapa con incidente asignado
- Notificacion push de nuevo incidente asignado
- Cambio de estado con un tap (Disponible → En ruta → En escena → Disponible)
- Ver detalle del incidente asignado
- Agregar notas al incidente
- Envio continuo de ubicacion GPS (background)
- Modo degradado: cola de acciones offline que sincroniza al reconectar

#### Modulo: Dashboard Operativo
- Incidentes activos por prioridad
- Unidades por estado (pie chart / barras)
- Tiempo promedio de despacho (ultimas 24h)
- Tiempo promedio de arribo (ultimas 24h)
- Incidentes abiertos vs cerrados
- Cobertura por sector (unidades activas / sector)

#### Modulo: Bitacora y Auditoria
- Log automatico de todo cambio de estado (unidad e incidente)
- Log de quien hizo que y cuando
- Exportable como CSV
- Retencion minima: 12 meses

#### Modulo: Reportes Basicos
- Reporte de turno (incidentes atendidos, tiempos, unidades)
- Reporte de incidente individual (timeline completa)
- Exportacion PDF y CSV

### 2.3 P1 — Post-piloto inmediato
- Sugerencia de unidad mas cercana (algoritmo de proximidad PostGIS)
- Filtros avanzados: por turno, sector, prioridad, tipo
- Alertas push de incidentes criticos a supervisores
- Geocercas simples (alertar si unidad sale de zona asignada)
- Exportacion avanzada de reportes

### 2.4 Fuera de alcance (explicito)
- Reconocimiento facial
- Video analytics
- Prediccion delictiva
- Integraciones con C4/C5 legados
- Workflow judicial
- Drones
- Multiagencia
- IA generativa

---

## 3. Arquitectura y Stack Tecnologico

### 3.1 Stack Definitivo

| Capa | Tecnologia | Justificacion |
|------|-----------|---------------|
| Frontend Web | Next.js 14 + React 18 | SSR para carga inicial rapida, React ecosystem maduro |
| Mobile | React Native + Expo | Shared TypeScript, hot updates via OTA, iOS + Android |
| Backend | NestJS + TypeScript | Modular monolith, decorators para RBAC, DI nativo |
| Base de Datos | PostgreSQL 16 + PostGIS 3.4 | Geoespacial nativo, queries de proximidad, madurez |
| Real-time | Socket.IO sobre WebSockets | Rooms por sector, namespaces por tipo de evento |
| Cache + Jobs | Redis + BullMQ | Cache de posiciones, jobs de reportes, rate limiting |
| Cloud | AWS (ECS Fargate) | Sin servidores que administrar, auto-scaling |
| Storage | S3 | Reportes generados, adjuntos futuros |
| CDN | CloudFront | Assets estaticos, mapas tiles si se necesitan |
| Maps | Mapbox GL JS (web) + React Native Mapbox | Dark mode nativo, customizacion completa, rendimiento |
| Auth | JWT + Refresh tokens | Stateless, rotacion de tokens |
| Observabilidad | Sentry + CloudWatch + OpenTelemetry | Errores, metricas, trazas distribuidas |
| CI/CD | GitHub Actions | Build, test, deploy automatizado |
| IaC | AWS CDK (TypeScript) | Infra as code, mismo lenguaje que el producto |

### 3.2 Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Command Web  │  │ Dispatch Web │  │    Field Mobile App      │  │
│  │ (Next.js)    │  │ (Next.js)    │  │    (React Native)        │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
└─────────┼─────────────────┼────────────────────────┼────────────────┘
          │                 │                        │
          ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / LOAD BALANCER                       │
│                    (AWS ALB + CloudFront)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS Modular Monolith)                │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │   Auth     │ │  Incidents │ │  Units   │ │    Dispatch       │  │
│  │   Module   │ │  Module    │ │  Module  │ │    Module         │  │
│  └────────────┘ └────────────┘ └──────────┘ └───────────────────┘  │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │   Geo      │ │  Audit     │ │ Reports  │ │    Realtime       │  │
│  │   Module   │ │  Module    │ │  Module  │ │    Gateway (WS)   │  │
│  └────────────┘ └────────────┘ └──────────┘ └───────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Shared: RBAC, Logging, Config, DTOs             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────┬──────────────────┬───────────────────┬───────────────────┘
           │                  │                   │
           ▼                  ▼                   ▼
┌──────────────────┐ ┌──────────────┐  ┌─────────────────┐
│  PostgreSQL +    │ │   Redis      │  │   S3            │
│  PostGIS         │ │   + BullMQ   │  │   (Storage)     │
│                  │ │              │  │                 │
│  - Users         │ │  - Position  │  │  - Reportes PDF │
│  - Incidents     │ │    cache     │  │  - Exports      │
│  - Units         │ │  - Job queue │  │                 │
│  - Audit logs    │ │  - Sessions  │  │                 │
│  - Geo data      │ │              │  │                 │
└──────────────────┘ └──────────────┘  └─────────────────┘
```

### 3.3 Modelo de Datos Principal

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│     users        │     │     incidents         │     │     units        │
├──────────────────┤     ├──────────────────────┤     ├──────────────────┤
│ id: uuid PK      │     │ id: uuid PK           │     │ id: uuid PK      │
│ email: varchar   │     │ folio: varchar UNIQUE  │     │ call_sign: varchar│
│ password_hash    │     │ type: enum             │     │ status: enum     │
│ role: enum       │     │ priority: enum         │     │ sector_id: uuid  │
│ name: varchar    │     │ status: enum           │     │ shift: enum      │
│ badge_number     │     │ title: varchar         │     │ current_location │
│ sector_id: uuid  │     │ description: text      │     │   : geography    │
│ shift: enum      │     │ location: geography    │     │ last_location_at │
│ is_active: bool  │     │ address: varchar       │     │   : timestamp    │
│ created_at       │     │ reported_at: timestamp │     │ assigned_user_id │
│ updated_at       │     │ assigned_at: timestamp │     │   : uuid FK      │
└──────────────────┘     │ arrived_at: timestamp  │     │ is_active: bool  │
                         │ closed_at: timestamp   │     │ created_at       │
┌──────────────────┐     │ resolution: text       │     │ updated_at       │
│    sectors       │     │ created_by: uuid FK    │     └──────────────────┘
├──────────────────┤     │ assigned_unit_id: uuid │
│ id: uuid PK      │     │ sector_id: uuid FK     │     ┌──────────────────┐
│ name: varchar    │     │ created_at             │     │  audit_logs      │
│ boundary:        │     │ updated_at             │     ├──────────────────┤
│   geography      │     └──────────────────────┘     │ id: uuid PK      │
│ color: varchar   │                                   │ entity_type      │
│ is_active: bool  │     ┌──────────────────────┐     │ entity_id: uuid  │
└──────────────────┘     │  incident_events      │     │ action: varchar  │
                         ├──────────────────────┤     │ actor_id: uuid   │
┌──────────────────┐     │ id: uuid PK           │     │ changes: jsonb   │
│ unit_assignments │     │ incident_id: uuid FK  │     │ ip_address       │
├──────────────────┤     │ type: enum             │     │ created_at       │
│ id: uuid PK      │     │ description: text      │     └──────────────────┘
│ incident_id: FK  │     │ created_by: uuid FK   │
│ unit_id: FK      │     │ metadata: jsonb        │
│ assigned_at      │     │ created_at             │
│ unassigned_at    │     └──────────────────────┘
│ assigned_by: FK  │
└──────────────────┘
```

### 3.4 Decisiones Tecnicas Clave

| Decision | Eleccion | Alternativa descartada | Justificacion |
|----------|----------|----------------------|---------------|
| Arquitectura | Modular monolith | Microservicios | Velocidad de desarrollo, menos overhead operativo, suficiente para 1-5 clientes |
| Mapa | Mapbox GL JS | Google Maps, Leaflet | Dark mode nativo, rendimiento con 200+ markers, customizacion de estilos, pricing predecible |
| Real-time | Socket.IO | Server-Sent Events, GraphQL Subscriptions | Bidireccional, rooms nativas, fallback automatico, maduro en produccion |
| Mobile | React Native + Expo | Flutter, nativo | TypeScript compartido con backend, OTA updates sin App Store review, comunidad amplia |
| Auth | JWT + refresh tokens | Sessions en DB | Stateless, escala sin sesion en servidor, compatible con mobile |
| Geoespacial | PostGIS nativo | App-level geo calculations | Queries de proximidad optimizados, indices espaciales, estandar de la industria |
| Hosting | ECS Fargate | EC2, Lambda | Sin administrar servidores, auto-scaling, costo predecible a esta escala |
| IaC | AWS CDK | Terraform, CloudFormation raw | Mismo lenguaje (TypeScript), abstracciones de alto nivel, type-safe |

### 3.5 Flujo de Datos Real-time

```
Field App (GPS)                    Command Web (Mapa)
     │                                  ▲
     │ WS: unit:location:update         │ WS: unit:location:changed
     ▼                                  │
┌─────────────────────────────────────────────┐
│            Realtime Gateway (Socket.IO)      │
│                                             │
│  Rooms:                                     │
│    sector:{id}     → unidades del sector    │
│    incident:{id}   → seguimiento incidente  │
│    command          → todos los operadores   │
│    supervisor:{id} → vista de supervisor     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌──────────────────────────┐
│  Redis (position cache)   │
│  unit:{id}:position       │
│  TTL: 30s                 │
│  + Write-through to PG    │
│    cada 30s (batch)       │
└──────────────────────────┘
```

### 3.6 Seguridad

- **Cifrado en transito:** TLS 1.3 en todas las conexiones
- **Cifrado en reposo:** AWS RDS encryption + S3 encryption
- **Autenticacion:** JWT con expiracion corta (15 min) + refresh token (7 dias)
- **RBAC:** Decoradores a nivel de endpoint, verificacion en middleware
- **Rate limiting:** Redis-based, por IP y por usuario
- **Audit log:** Toda accion de escritura registrada con actor, timestamp, cambios
- **Secrets:** AWS Secrets Manager, nunca en codigo
- **Dependencias:** Dependabot + npm audit en CI
- **Headers:** Helmet.js (HSTS, CSP, X-Frame-Options)

---

## 4. Diseno UX/UI

### 4.1 Principios de Diseno

1. **Reduccion de carga cognitiva** — En crisis, el operador no debe luchar contra la interfaz
2. **3-click rule para despacho** — De incidente nuevo a unidad asignada en maximo 3 clics
3. **Glanceability** — Estado completo visible sin interaccion (el mapa habla solo)
4. **Role-based views** — Cada rol tiene su pantalla optimizada, sin ruido
5. **Dark mode por defecto** — Centros de mando operan a oscuras, fatiga visual reducida
6. **Touch-first en mobile** — Botones grandes, gestos simples, operable con una mano

### 4.2 Sistema Visual

#### Paleta operativa
| Token | Hex | Uso |
|-------|-----|-----|
| `--bg-primary` | `#0F172A` | Fondo principal (Midnight Command) |
| `--bg-surface` | `#1E293B` | Cards, paneles, modales |
| `--bg-elevated` | `#334155` | Hover states, seleccion |
| `--accent-blue` | `#3B82F6` | Unidades, acciones principales (Tactical Blue) |
| `--accent-amber` | `#F59E0B` | Alertas, incidentes medios (Alert Amber) |
| `--accent-red` | `#EF4444` | Incidentes criticos, errores |
| `--accent-green` | `#22C55E` | Unidad disponible, exito |
| `--text-primary` | `#F8FAFC` | Texto principal (Signal White) |
| `--text-secondary` | `#94A3B8` | Texto secundario |
| `--text-muted` | `#64748B` | Labels, placeholders (Slate Gray) |

#### Tipografia
| Uso | Fuente | Peso |
|-----|--------|------|
| Titulos (H1-H3) | Inter | 600-700 |
| Cuerpo | Satoshi | 400-500 |
| Datos numericos (tiempos, coords) | JetBrains Mono | 400-500 |
| Labels / captions | Inter | 500 |

#### Iconografia
- Lucide Icons (linea fina, consistente, open source)
- Tamano minimo: 20px en web, 24px en mobile
- Color: hereda del contexto (text-primary o accent)

#### Mapa
- Estilo base: Mapbox Dark (escala de grises)
- Unidades: circulos azules con call sign
- Incidentes: triangulos/diamantes con color por prioridad
- Sectores: poligonos con borde sutil, fill semi-transparente
- Cluster cuando >50 unidades en zoom out

### 4.3 User Journeys

#### Journey 1: Operador de Cabina — Despachar incidente

```
[1. Pantalla principal]              [2. Crear incidente]
┌─────────────────────────┐         ┌─────────────────────────┐
│ MAPA (80% pantalla)     │         │ Modal: Nuevo Incidente  │
│                         │  Click  │                         │
│  ● ● ●  (unidades)     │ ──────► │ Tipo: [Robo ▼]          │
│  ▲ (incidente activo)   │  en     │ Prioridad: [Alta ▼]     │
│                         │  mapa   │ Ubicacion: [auto/manual] │
│─────────────────────────│  o      │ Descripcion: [_________]│
│ Panel: Incidentes (20%) │  btn    │                         │
│ ┌─ IC-001 Robo ■■■    │         │ [Crear y Asignar →]     │
│ ┌─ IC-002 Riña ■■     │         └─────────────────────────┘
└─────────────────────────┘

[3. Asignar unidad]                  [4. Confirmacion]
┌─────────────────────────┐         ┌─────────────────────────┐
│ Asignar a IC-003        │         │ ✓ Incidente IC-003      │
│                         │         │   creado y asignado     │
│ Unidades cercanas:      │         │                         │
│ ┌─ P-14  ● 0.8km 2min │ Click   │ Unidad P-14 notificada  │
│ ┌─ P-07  ● 1.2km 3min │ ──────► │ Estado: En Ruta          │
│ ┌─ P-22  ● 2.1km 5min │         │                         │
│                         │         │ [Ver en mapa]           │
│ [Asignar seleccionada]  │         └─────────────────────────┘
└─────────────────────────┘
```

**Flujo critico: 3 clics**
1. Click "Nuevo Incidente" (o click en mapa)
2. Llenar tipo + prioridad + ubicacion → "Crear y Asignar"
3. Seleccionar unidad → "Asignar"

#### Journey 2: Policia en Campo — Atender incidente

```
[1. Notificacion]     [2. Detalle]          [3. En Escena]        [4. Cierre]
┌──────────────┐    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ PUSH NOTIF   │    │ IC-003       │     │ IC-003       │     │ Cerrar IC-003│
│              │    │ Robo a       │     │              │     │              │
│ Nuevo        │    │ transeúnte   │     │ Estado:      │     │ Resolucion:  │
│ incidente    │ →  │              │  →  │ [EN ESCENA]  │  →  │ [Detencion ▼]│
│ asignado     │    │ Av. Juarez   │     │              │     │              │
│              │    │ #142         │     │ + Nota:      │     │ Notas:       │
│ [VER]        │    │              │     │ [________]   │     │ [________]   │
│              │    │ ████████████ │     │              │     │              │
│              │    │   [MAPA]     │     │ [Agregar]    │     │ [Cerrar ✓]   │
│              │    │              │     │              │     │              │
│              │    │ [EN RUTA →]  │     │ [CERRAR →]   │     │              │
└──────────────┘    └──────────────┘     └──────────────┘     └──────────────┘
```

**Cada transicion = 1 tap.** Botones grandes (min 48px), colores claros.

#### Journey 3: Supervisor — Monitoreo de turno

```
┌──────────────────────────────────────────────────────────┐
│ MAPA (70%)                    │ PANEL DERECHO (30%)      │
│                               │                          │
│  Sector Norte                 │ TURNO: Vespertino        │
│  ┌─────────────┐              │ ── Resumen ──            │
│  │ ● P-14      │              │ Unidades activas: 12/15  │
│  │    ● P-07   │              │ Incidentes abiertos: 4   │
│  │  ▲ IC-003   │              │ Tiempo prom despacho: 1m │
│  │       ● P-22│              │ Cobertura: 80%           │
│  └─────────────┘              │                          │
│                               │ ── Alertas ──            │
│  Sector Sur                   │ ⚠ P-09 sin reportar 20m │
│  ┌─────────────┐              │ ⚠ Sector Sur: 1 unidad  │
│  │    ● P-09   │              │                          │
│  │             │              │ ── Incidentes ──         │
│  └─────────────┘              │ ■■■ IC-003 Robo (Alta)   │
│                               │ ■■  IC-004 Riña (Media)  │
│                               │ ■   IC-005 Ruido (Baja)  │
└──────────────────────────────────────────────────────────┘
```

#### Journey 4: Comandante — Dashboard operativo

```
┌──────────────────────────────────────────────────────────┐
│ DASHBOARD OPERATIVO                    Turno: Vespertino │
│                                                          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│ │  Incidentes  │ │  Tiempo      │ │  Cobertura   │      │
│ │  Activos     │ │  Despacho    │ │  Territorial │      │
│ │     12       │ │   1m 42s     │ │    82%       │      │
│ │  ↓ 3 vs ayer │ │  ↓ 30% mejora│ │  ↑ 5% mejora │      │
│ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                          │
│ ┌─────────────────────┐ ┌────────────────────────────┐   │
│ │ Incidentes por hora │ │ Unidades por estado        │   │
│ │ ████                │ │ ████████ Disponible (8)    │   │
│ │ ██████              │ │ ████ En ruta (4)           │   │
│ │ ████████            │ │ ██ En escena (2)           │   │
│ │ ██████████          │ │ █ Fuera de servicio (1)    │   │
│ └─────────────────────┘ └────────────────────────────┘   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Mapa de calor: Incidentes ultimas 24h             │   │
│ │ [mapa con heat overlay]                            │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 4.4 Pantallas clave — Inventario

| # | Pantalla | Plataforma | Rol principal |
|---|----------|-----------|---------------|
| 1 | Login | Web + Mobile | Todos |
| 2 | Mapa principal (Command) | Web | Operador, Supervisor |
| 3 | Panel de incidentes | Web | Operador |
| 4 | Modal: Crear incidente | Web | Operador |
| 5 | Modal: Asignar unidad | Web | Operador |
| 6 | Detalle de incidente + timeline | Web | Operador, Supervisor |
| 7 | Lista de unidades | Web | Supervisor |
| 8 | Dashboard operativo | Web | Comandante |
| 9 | Reportes | Web | Comandante |
| 10 | Home (incidente activo o estado) | Mobile | Unidad de campo |
| 11 | Detalle de incidente asignado | Mobile | Unidad de campo |
| 12 | Cambio de estado | Mobile | Unidad de campo |
| 13 | Historial de incidentes | Mobile | Unidad de campo |
| 14 | Perfil / configuracion | Web + Mobile | Todos |

---

## 5. Copy Clave de Producto

### 5.1 Voice & Tone Guide

**Voz de marca:** Directa, profesional, confiable. Como un compañero operativo experimentado que habla claro.

**Principios de copy:**
1. **Claridad sobre creatividad** — "Incidente asignado" no "¡Tu siguiente mision te espera!"
2. **Accion sobre descripcion** — Botones con verbos: "Asignar", "Cerrar", "Reportar"
3. **Urgencia calibrada** — Solo usar lenguaje de urgencia en incidentes criticos
4. **Sin jerga tech** — "Ubicacion" no "coordenadas GPS". "Tiempo de respuesta" no "latencia de despacho"
5. **Respeto al usuario** — Son profesionales operando bajo presion. Nada condescendiente.

**Lo que SI suena como Velnari:**
- "Incidente IC-042 asignado a P-14. En ruta."
- "3 unidades disponibles en Sector Norte."
- "Tiempo de despacho: 1m 32s. 45% mejor que el promedio del turno."

**Lo que NO suena como Velnari:**
- "¡Genial! Acabas de crear un incidente exitosamente 🎉"
- "Oops, algo salio mal. Intenta de nuevo."
- "¿Sabias que puedes filtrar por sector? ¡Descubre mas funciones!"

### 5.2 Copy de Pantallas Clave

#### Login
- Titulo: **"Velnari"**
- Subtitulo: **"Sistema operativo de seguridad municipal"**
- Placeholder email: **"correo@corporacion.gob.mx"**
- Placeholder password: **"Contraseña"**
- Boton: **"Iniciar sesion"**
- Error: **"Credenciales incorrectas. Verifica e intenta de nuevo."**
- Sesion expirada: **"Tu sesion expiro por seguridad. Inicia sesion de nuevo."**

#### Mapa principal
- Header: **"[Nombre Corporacion] — Centro de Mando"**
- Estados de unidad:
  - **"Disponible"** (verde)
  - **"En ruta"** (azul pulsante)
  - **"En escena"** (ambar)
  - **"Fuera de servicio"** (gris)
- Tooltip de unidad: **"P-14 · Disponible · Sector Norte · 2h en turno"**
- Sin unidades: **"No hay unidades activas en esta vista."**

#### Crear incidente
- Titulo modal: **"Nuevo incidente"**
- Tipo: **"Tipo de incidente"**
- Prioridad: **"Prioridad"** (Critica / Alta / Media / Baja)
- Ubicacion: **"Ubicacion"** con placeholder **"Buscar direccion o marcar en mapa"**
- Descripcion: **"Descripcion"** con placeholder **"Detalle breve del reporte"**
- Boton principal: **"Crear incidente"**
- Boton secundario: **"Crear y asignar"**

#### Asignar unidad
- Titulo: **"Asignar unidad"**
- Subtitulo: **"Unidades disponibles cerca de [direccion]"**
- Cada unidad: **"P-14 · 0.8 km · ~2 min"**
- Boton: **"Asignar"**
- Confirmacion: **"P-14 asignada a IC-003. Unidad notificada."**

#### Notificacion push (Field App)
- Titulo: **"Nuevo incidente asignado"**
- Cuerpo: **"Robo — Av. Juarez #142, Sector Norte. Prioridad Alta."**
- Accion: **"Ver detalles"**

#### Cierre de incidente
- Titulo: **"Cerrar incidente IC-003"**
- Label: **"Resolucion"**
- Opciones: Detencion / Infraccion / Mediacion / Remision / Sin novedad / Otro
- Notas: **"Notas de cierre"** con placeholder **"Descripcion breve del resultado"**
- Boton: **"Cerrar incidente"**
- Confirmacion: **"Incidente IC-003 cerrado. Tiempo total: 42 min."**

#### Mensajes de estado (Field App)
- Cambio a En ruta: **"En ruta a IC-003."**
- Cambio a En escena: **"Llegaste a la escena. IC-003 actualizado."**
- Cambio a Disponible: **"Disponible. Listo para asignacion."**
- Sin conexion: **"Sin conexion. Tus acciones se enviaran al reconectar."**
- Reconexion: **"Conexion restablecida. Datos sincronizados."**

#### Dashboard
- Header: **"Operacion del turno"**
- Metricas: **"Incidentes activos" · "Tiempo de despacho" · "Cobertura" · "Unidades activas"**
- Mejora: **"↓ 30% vs promedio"** (verde)
- Empeora: **"↑ 15% vs promedio"** (rojo)

#### Errores genericos
- Error de servidor: **"Error del sistema. Intenta de nuevo en unos segundos."**
- Sin permisos: **"No tienes permisos para esta accion."**
- Sesion expirada: **"Sesion expirada. Inicia sesion de nuevo."**

### 5.3 Onboarding (Primera vez)

**Operador de cabina (3 pantallas):**

1. **"Tu centro de mando"**
   "Aqui ves todas las unidades en tiempo real. El mapa es tu interfaz principal."

2. **"Despacho en 3 pasos"**
   "Crea el incidente, selecciona la unidad, asigna. Asi de simple."

3. **"Todo queda registrado"**
   "Cada accion genera un registro automatico. Tiempos, decisiones, resultados."

**Policia en campo (2 pantallas):**

1. **"Tu herramienta de campo"**
   "Recibe incidentes, actualiza tu estado y reporta desde aqui."

2. **"Un tap, un cambio"**
   "Cambia tu estado con un solo toque. En ruta, en escena, disponible."

---

## 6. Plan Tecnico de Desarrollo

### 6.1 Estructura del Monorepo

```
velnari/
├── apps/
│   ├── web/                    # Next.js (Command + Dispatch + Dashboard)
│   │   ├── src/
│   │   │   ├── app/            # App router pages
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities, API client
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── types/          # Frontend-specific types
│   │   └── public/
│   │
│   ├── mobile/                 # React Native (Field App)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── navigation/
│   │   │   ├── services/
│   │   │   └── stores/
│   │   └── app.json
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── units/
│       │   │   ├── incidents/
│       │   │   ├── dispatch/
│       │   │   ├── geo/
│       │   │   ├── audit/
│       │   │   ├── reports/
│       │   │   └── realtime/
│       │   ├── shared/
│       │   │   ├── guards/
│       │   │   ├── decorators/
│       │   │   ├── interceptors/
│       │   │   ├── filters/
│       │   │   └── pipes/
│       │   └── config/
│       └── test/
│
├── packages/
│   ├── shared-types/           # DTOs, enums, interfaces compartidos
│   ├── ui/                     # Componentes UI compartidos (web)
│   └── config/                 # ESLint, TSConfig, Prettier compartidos
│
├── infra/                      # AWS CDK
│   ├── lib/
│   └── bin/
│
├── turbo.json
├── package.json
└── docker-compose.yml          # Dev: Postgres + Redis
```

### 6.2 Endpoints API — Core

#### Auth
```
POST   /api/auth/login              → { accessToken, refreshToken }
POST   /api/auth/refresh            → { accessToken }
POST   /api/auth/logout             → 204
GET    /api/auth/me                 → User profile
```

#### Users
```
GET    /api/users                   → Lista de usuarios (admin)
POST   /api/users                   → Crear usuario (admin)
PATCH  /api/users/:id               → Actualizar usuario
GET    /api/users/:id               → Detalle de usuario
```

#### Units
```
GET    /api/units                   → Lista de unidades (filtros: status, sector, shift)
GET    /api/units/:id               → Detalle de unidad
PATCH  /api/units/:id/status        → Cambiar estado de unidad
GET    /api/units/nearby            → Unidades cercanas a punto (lat, lng, radius)
```

#### Incidents
```
GET    /api/incidents               → Lista (filtros: status, priority, sector, dateRange)
POST   /api/incidents               → Crear incidente
GET    /api/incidents/:id           → Detalle con timeline
PATCH  /api/incidents/:id           → Actualizar incidente
POST   /api/incidents/:id/assign    → Asignar unidad
POST   /api/incidents/:id/close     → Cerrar incidente
GET    /api/incidents/:id/events    → Timeline de eventos
POST   /api/incidents/:id/notes     → Agregar nota
```

#### Sectors
```
GET    /api/sectors                 → Lista de sectores con geometria
GET    /api/sectors/:id/stats       → Estadisticas del sector
```

#### Dashboard
```
GET    /api/dashboard/overview      → Metricas resumen del turno
GET    /api/dashboard/timeline      → Incidentes por hora
GET    /api/dashboard/coverage      → Cobertura por sector
```

#### Reports
```
GET    /api/reports/shift           → Reporte de turno
GET    /api/reports/incident/:id    → Reporte de incidente
GET    /api/reports/export          → Exportar CSV/PDF
```

#### Audit
```
GET    /api/audit                   → Log de auditoria (admin, filtros)
```

#### WebSocket Events
```
# Client → Server
unit:location:update        → { lat, lng, timestamp }
unit:status:update          → { status }
incident:note:add           → { incidentId, text }

# Server → Client
unit:location:changed       → { unitId, lat, lng, timestamp }
unit:status:changed         → { unitId, status, previousStatus }
incident:created            → { incident }
incident:assigned           → { incidentId, unitId }
incident:status:changed     → { incidentId, status }
incident:closed             → { incidentId, resolution }
alert:critical              → { type, message, incidentId }
```

### 6.3 Estrategia de Desarrollo

#### Environments
| Env | Proposito | Infra |
|-----|-----------|-------|
| Local | Desarrollo | Docker Compose (PG + Redis) |
| Staging | QA + demos | AWS (misma arquitectura, escala minima) |
| Production | Piloto | AWS (con backups, monitoring, alerts) |

#### CI/CD Pipeline (GitHub Actions)
```
Push to any branch:
  → Lint (ESLint + Prettier check)
  → Type check (tsc --noEmit)
  → Unit tests (Jest)
  → Build check

Push to main:
  → Todo lo anterior
  → Integration tests
  → Build Docker image
  → Deploy to staging (auto)

Tag release (v*):
  → Todo lo anterior
  → Deploy to production (manual approval)
```

#### Sprint Plan (8 sprints de 2 semanas = 16 semanas)

| Sprint | Foco | Entregables |
|--------|------|-------------|
| 1 | Foundation | Repo, CI/CD, Docker, DB schema, auth module, login web |
| 2 | Units Core | CRUD unidades, mapa basico con posiciones, estados |
| 3 | Incidents Core | CRUD incidentes, timeline, crear desde mapa |
| 4 | Dispatch | Asignacion manual, notificaciones, flujo completo web |
| 5 | Field App v1 | Login mobile, recibir incidente, cambiar estado, GPS |
| 6 | Real-time | WebSockets, posiciones en vivo, actualizaciones push |
| 7 | Dashboard + Reports | Metricas, graficas, reportes, exportacion |
| 8 | Polish + Hardening | Audit log, seguridad, performance, bugs, deploy prod |

### 6.4 Estandares de Codigo

- **TypeScript strict** en todo el proyecto (`strict: true`, `noUncheckedIndexedAccess: true`)
- **ESLint** con config compartida (extends: recommended + typescript)
- **Prettier** con config compartida
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`
- **Branch strategy**: `main` → `staging` → `feature/xxx` (trunk-based con feature branches cortos)
- **PR required**: Al menos 1 review (cuando haya equipo)
- **Tests**: Unit tests para logica de negocio, integration tests para endpoints criticos

---

## 7. Estrategia de QA

### 7.1 Filosofia de QA

> "En software de mision critica, un bug en despacho puede significar minutos perdidos en una emergencia real. QA no es un gate, es una cultura."

### 7.2 Niveles de Testing

| Nivel | Herramienta | Cobertura objetivo | Que cubre |
|-------|-------------|--------------------|----|
| Unit | Jest | >80% logica de negocio | Funciones puras, validaciones, transformaciones |
| Integration | Jest + Supertest | Todos los endpoints | API contracts, DB queries, auth guards |
| E2E | Playwright (web), Detox (mobile) | Flujos criticos | Journeys completos de usuario |
| Performance | k6 | Flujos criticos | Carga de WebSockets, queries geo |
| Security | npm audit + OWASP ZAP | Cada release | Vulnerabilidades, headers, auth |

### 7.3 Test Plan MVP — Casos Criticos

#### Flujo de Despacho (CRITICO — cobertura 100%)

| # | Caso | Precondicion | Accion | Resultado esperado |
|---|------|-------------|--------|-------------------|
| D1 | Crear incidente completo | Operador logueado | Llenar todos los campos, crear | Incidente en DB, aparece en mapa y lista |
| D2 | Crear incidente con campos minimos | Operador logueado | Solo tipo + prioridad + ubicacion | Incidente creado correctamente |
| D3 | Asignar unidad disponible | Incidente creado, unidad disponible | Seleccionar unidad, asignar | Unidad cambia a "En ruta", notificacion enviada |
| D4 | Asignar unidad ya ocupada | Unidad en escena | Intentar asignar | Error: "Unidad no disponible" |
| D5 | Reasignar unidad | Incidente con unidad asignada | Reasignar a otra | Primera unidad liberada, segunda asignada |
| D6 | Recibir incidente en mobile | Unidad asignada | Push notification | Notificacion recibida, incidente visible |
| D7 | Cambiar estado: En ruta | Unidad asignada a incidente | Tap "En ruta" | Estado actualizado en mobile y web simultaneamente |
| D8 | Cambiar estado: En escena | Unidad en ruta | Tap "En escena" | Timestamp de arribo registrado |
| D9 | Cerrar incidente | Unidad en escena | Seleccionar resolucion, cerrar | Incidente cerrado, timeline completa |
| D10 | Despacho concurrente | 2 operadores, 1 unidad | Ambos intentan asignar | Solo 1 exitoso, otro recibe error |

#### Mapa y Real-time

| # | Caso | Resultado esperado |
|---|------|----|
| R1 | Posicion se actualiza en mapa | Movimiento de unidad visible en <2s |
| R2 | 100 unidades simultaneas | Mapa renderiza sin lag perceptible |
| R3 | Desconexion y reconexion WS | Reconexion automatica, estado sincronizado |
| R4 | Unidad pierde GPS | Ultima posicion conocida con indicador visual |

#### Autenticacion y Seguridad

| # | Caso | Resultado esperado |
|---|------|----|
| S1 | Login con credenciales correctas | Acceso concedido, redireccion por rol |
| S2 | Login con credenciales incorrectas | Error generico (no revelar que fallo) |
| S3 | Acceso a ruta sin permiso | 403 Forbidden |
| S4 | Token expirado | 401, redirect a login |
| S5 | Refresh token | Nuevo access token sin re-login |
| S6 | Inyeccion SQL en campos | Input sanitizado, query segura |
| S7 | XSS en descripcion de incidente | HTML escapado en render |

#### Offline / Degraded Mode (Mobile)

| # | Caso | Resultado esperado |
|---|------|----|
| O1 | Cambiar estado sin conexion | Accion en cola, se envia al reconectar |
| O2 | Multiples acciones offline | Cola preserva orden, todas se envian |
| O3 | App en background 30 min | GPS sigue enviando, sesion activa |

### 7.4 Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|-----------|
| Perdida de datos de posicion | Media | Alto | Write-through cache, batch persistence, alarma si gap >60s |
| Concurrencia en asignacion | Alta | Medio | Optimistic locking en DB, validacion pre-asignacion |
| Latencia en mapa con muchas unidades | Media | Medio | Clustering, throttle de updates, virtualizacion |
| App mobile crashea en background | Media | Alto | Watchdog service, auto-restart GPS tracking |
| Sesion expira durante operacion critica | Baja | Alto | Refresh token silencioso, grace period |
| Datos geoespaciales incorrectos | Baja | Alto | Validacion de coordenadas (bounds Mexico), sanity checks |

### 7.5 Definition of Done (para cada feature)

- [ ] Codigo con TypeScript strict sin errores
- [ ] Unit tests para logica de negocio
- [ ] Integration test para endpoint (si aplica)
- [ ] Funciona en dark mode
- [ ] Responsive (web) o adaptado a pantallas comunes (mobile)
- [ ] RBAC verificado (solo roles permitidos acceden)
- [ ] Audit log registra la accion
- [ ] Sin warnings en consola
- [ ] PR revisado y aprobado

---

## 8. Guia Inicial para Usuarios

### 8.1 Estructura del Help Center

```
Velnari — Centro de Ayuda
│
├── Inicio Rapido
│   ├── Para Operadores de Cabina
│   ├── Para Policias en Campo
│   ├── Para Supervisores
│   └── Para Comandantes
│
├── Guias por Funcion
│   ├── Mapa y Unidades
│   │   ├── Entender el mapa
│   │   ├── Estados de unidad
│   │   └── Filtrar por sector
│   │
│   ├── Incidentes
│   │   ├── Crear un incidente
│   │   ├── Asignar una unidad
│   │   ├── Seguimiento en tiempo real
│   │   └── Cerrar un incidente
│   │
│   ├── App Movil
│   │   ├── Instalar y configurar
│   │   ├── Recibir incidentes
│   │   ├── Cambiar tu estado
│   │   └── Modo sin conexion
│   │
│   └── Reportes
│       ├── Reporte de turno
│       └── Exportar datos
│
├── Preguntas Frecuentes
│
└── Soporte
    └── Contacto
```

### 8.2 Guia Rapida — Operador de Cabina

**Tu rol:** Eres el enlace entre los reportes ciudadanos y las unidades en campo. Velnari te da visibilidad completa para tomar mejores decisiones de despacho.

**Lo esencial:**

**1. Tu pantalla principal es el mapa.**
Al iniciar sesion, veras todas las unidades activas en su posicion actual. Los colores indican su estado:
- Verde = Disponible
- Azul (pulsante) = En ruta a un incidente
- Ambar = En escena
- Gris = Fuera de servicio

**2. Para crear un incidente:**
- Opcion A: Click en el boton "+ Incidente" arriba del mapa
- Opcion B: Click derecho en el mapa en la ubicacion del incidente
- Llena tipo, prioridad y ubicacion. Descripcion es opcional pero recomendada.
- Click en "Crear y asignar" para ir directo a seleccionar unidad.

**3. Para asignar una unidad:**
- Velnari te muestra las unidades disponibles ordenadas por cercania.
- Selecciona la unidad y click en "Asignar".
- La unidad recibe una notificacion inmediata en su celular.

**4. Para dar seguimiento:**
- En el panel lateral izquierdo ves todos los incidentes activos.
- Click en cualquier incidente para ver su timeline completa.
- Los cambios de estado de la unidad se actualizan en tiempo real.

**5. Para cerrar un incidente:**
- Desde el detalle del incidente, click en "Cerrar".
- Selecciona la resolucion y agrega notas si es necesario.

### 8.3 Guia Rapida — Policia en Campo

**Tu rol:** Atender incidentes y mantener tu estado actualizado para que el centro de mando sepa donde estas y que estas haciendo.

**Lo esencial:**

**1. Inicia sesion al comenzar tu turno.**
Abre la app Velnari, ingresa tus credenciales. Tu GPS se activa automaticamente.

**2. Cuando te asignen un incidente:**
Recibiras una notificacion. Abrela para ver los detalles: tipo, direccion, prioridad.

**3. Actualiza tu estado:**
- Toca **"En ruta"** cuando salgas hacia el incidente.
- Toca **"En escena"** cuando llegues.
- Toca **"Disponible"** cuando termines.

Cada toque es un solo tap. No necesitas escribir nada.

**4. Agrega notas si es necesario:**
En la pantalla del incidente, puedes agregar notas con informacion relevante.

**5. Si pierdes conexion:**
La app guarda tus acciones y las envia cuando se restablezca la señal. Sigue trabajando normal.

### 8.4 Preguntas Frecuentes

**¿Que pasa si la app se cierra en mi celular?**
Tu ubicacion sigue enviandose en segundo plano. Al abrir la app, todo estara sincronizado.

**¿Puedo ver incidentes de otros sectores?**
Depende de tu rol. Supervisores ven todos los sectores a su cargo. Unidades de campo ven solo sus incidentes asignados.

**¿Que significa el circulo gris en una unidad?**
La unidad esta fuera de servicio. No esta disponible para asignacion.

**¿Como se si mi ubicacion se esta enviando?**
En la app movil, veras un indicador verde en la esquina superior. Si esta rojo, revisa tu señal GPS.

**¿Quien puede ver mi ubicacion?**
Solo operadores, supervisores y comandantes de tu corporacion. La informacion no se comparte fuera del sistema.

**¿Puedo usar la app con datos moviles?**
Si. La app esta optimizada para funcionar con conexiones lentas (3G/4G). Consume menos de 50MB al mes.

**¿Como reporto un problema con la app?**
Contacta a tu administrador de sistema o usa la opcion "Reportar problema" en el menu de configuracion.

---

## 9. Roadmap Post-MVP

### 9.1 Horizonte de 12 meses post-piloto

#### Q1 Post-piloto: Consolidacion (P1 features)
- Sugerencia de unidad mas cercana (PostGIS proximity query)
- Filtros avanzados (turno, sector, prioridad, tipo, rango de fechas)
- Alertas push de incidentes criticos
- Geocercas simples (unidad sale de zona → alerta)
- Exportacion avanzada de reportes (Excel, PDF con graficas)
- Mejoras UX basadas en feedback del piloto
- Hardening de seguridad y observabilidad

#### Q2 Post-piloto: Inteligencia Operativa
- Heat maps de incidencia historica
- Comparativas por turno/sector/periodo
- Tiempos de respuesta por tipo de incidente
- Patrones de actividad por hora/dia
- Dashboard ejecutivo para presentaciones a cabildo
- API publica (read-only) para transparencia

#### Q3 Post-piloto: Escalamiento
- Multitenancy (segundo municipio)
- Roles y permisos granulares (custom roles)
- Notificaciones configurables por rol
- Integracion con sistemas de video (CCTV feed link)
- App para supervisor con funcionalidades avanzadas
- Bitacora electronica completa (sustituye papel)

#### Q4 Post-piloto: Plataforma
- Velnari Signals v1: integracion con fuentes externas (911, C5 basico)
- Reglas automaticas simples (auto-asignar por zona, escalar por tiempo)
- Analisis predictivo basico (hot zones por horario)
- SDK/API para integradores
- White-labeling para partners

### 9.2 Vision a 3 anos

```
Año 1: Mejor despacho y supervision para 1-3 municipios
Año 2: Plataforma operativa completa para 10-15 municipios, expansion a Colombia/Chile
Año 3: Sistema operativo de seguridad urbana con integraciones, analytics e IA operativa
```

### 9.3 Lo que no cambia

Independientemente de la expansion, estos principios se mantienen:

1. El mapa es la interfaz principal
2. Cada accion se audita
3. La UX prioriza velocidad de decision
4. El producto funciona sin internet perfecto
5. Cada rol ve solo lo que necesita
6. El valor se demuestra en semanas, no en meses

---

## Apendice A: Glosario Operativo

| Termino Velnari | Significado |
|----------------|-------------|
| Unidad | Patrulla o elemento policial con la app Field |
| Incidente | Evento que requiere atencion (reporte ciudadano, avistamiento, etc.) |
| Despacho | Accion de asignar una unidad a un incidente |
| Folio | Identificador unico del incidente (ej. IC-003) |
| Call sign | Identificador de la unidad (ej. P-14) |
| Sector | Division territorial del municipio |
| Turno | Periodo operativo (matutino, vespertino, nocturno) |
| Timeline | Secuencia cronologica de eventos de un incidente |
| Cobertura | Relacion entre unidades activas y zonas del municipio |

---

**Documento generado por el AI Product Development Squad de Velnari.**
**Version 1.0 — Abril 2026**
