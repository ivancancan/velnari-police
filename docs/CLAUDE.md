# Velnari

## Proyecto

Velnari es una startup de Public Safety Tech / GovTech que construye el sistema operativo de operaciones en campo para policias municipales y centros de mando en Mexico. Unifica monitoreo en tiempo real, gestion de incidentes, despacho, supervision tactica y analitica operativa en una sola plataforma.

## Arquitectura de Producto

- **Velnari Command** — Mapa en vivo, supervision, centro de mando, estado de unidades (web)
- **Velnari Dispatch** — Creacion, priorizacion, asignacion y seguimiento de incidentes
- **Velnari Field** — App movil para policias y supervisores en campo
- **Velnari Insights** — Dashboards, metricas, reportes y analisis operativo
- **Velnari Signals** — (futuro) Alertas, integraciones, sensores y eventos externos

## Stack Tecnologico

- **Web:** Next.js + React
- **Mobile:** React Native
- **Backend:** NestJS + TypeScript
- **DB:** PostgreSQL + PostGIS
- **Realtime:** WebSockets / Socket.IO
- **Jobs:** Redis + BullMQ
- **Cloud:** AWS
- **Storage:** S3
- **Observability:** CloudWatch + OpenTelemetry + Sentry

## Principios de Arquitectura

- Modular monolith al inicio (no microservicios prematuros)
- Event-driven en flujos criticos
- Geoespacial nativo (PostGIS, mapa como interfaz principal)
- Audit log desde dia 1
- Multitenancy ligera planeada
- Seguridad y RBAC fuertes
- Cifrado en transito y reposo

## Principios de Producto

1. **Map-first** — La interfaz principal es geoespacial
2. **Decision speed > feature count** — Menos clics, mas claridad
3. **Auditability by default** — Todo evento importante deja rastro
4. **Offline tolerance** — Contemplar conectividad imperfecta
5. **Role-based simplicity** — Cada rol ve solo lo necesario

## Alcance MVP (P0)

- Autenticacion y roles
- Mapa en tiempo real de unidades
- Alta y seguimiento de incidentes
- Estados de unidad
- Asignacion manual de unidad
- Vista de incidente con timeline
- App movil para unidades
- Dashboard operativo basico
- Bitacora y auditoria minima
- Reportes basicos

## Alcance MVP (P1)

- Sugerencia de unidad mas cercana
- Filtros por sector, turno y prioridad
- Alertas de incidentes criticos
- Geocercas simples
- Exportacion de reportes

## Fuera de Alcance (por ahora)

Reconocimiento facial, video analytics, prediccion delictiva compleja, integraciones profundas con sistemas legados, workflow judicial, drones, multiagencia completa, IA generativa avanzada.

## Usuarios Clave

- **Operador de cabina** — Asigna y da seguimiento rapido
- **Policia en campo** — Recibe instrucciones y actualiza estados
- **Supervisor de turno** — Mantiene cobertura y balancea carga
- **Comandante / director operativo** — Mide desempeno y toma decisiones tacticas
- **Decisor politico / ejecutivo** — Demuestra mejoras y justifica inversion

## Branding y Diseno Visual

### ADN de Marca
- **Voz y tono:** Directo, asertivo, profesional, resiliente. Lenguaje de "mision", no decorativo.
- **Arquetipo:** El Guardian Sabio — vigila (Vela) y estructura (Sistema).
- **Promesa de marca:** "Claridad en el despliegue, precision en la respuesta."
- **Tagline principal:** "Velnari: El sistema operativo de la seguridad municipal."

### Paleta de Colores (Mission-Critical Palette)
| Color | Hex | Uso |
|-------|-----|-----|
| Midnight Command | `#0F172A` | Primario. Fondo dashboards, autoridad |
| Tactical Blue | `#3B82F6` | Secundario. Tecnologia, confianza |
| Alert Amber | `#F59E0B` | Acento. CTAs, incidentes criticos, alertas |
| Slate Gray | `#64748B` | Neutral. Textos secundarios, UI no-distractora |
| Signal White | `#F8FAFC` | Fondo/contraste. Legibilidad en campo |

### Tipografia
- **Titulos:** Inter o Roboto Mono (aire tecnico, limpio)
- **Datos numericos:** JetBrains Mono (legibilidad de tiempos, coordenadas)
- **Cuerpo:** Satoshi

### Principios de UI
- **Dark mode por defecto** — centros de mando operan a oscuras
- **Iconografia:** Lineas finas y claras (estilo Lucide o Phosphor Icons)
- **Mapas:** Escala de grises / dark mode, solo resaltan unidades (azul) e incidentes (ambar/rojo)
- **Principio rector:** "Reduccion de carga cognitiva" — en crisis, el operador no debe luchar contra la interfaz

## UX Referencia

Google Maps (claridad) + Uber Fleet (estados/despacho) + Datadog (observabilidad) + Figma/Linear (limpieza visual)

## Convenciones de Desarrollo

- TypeScript estricto en todo el proyecto
- El principio rector del MVP: **operativamente usable, no tecnicamente impresionante**
- No sobredisenar; construir lo minimo que demuestre valor
- Seguridad como prioridad (RBAC, cifrado, auditoria)
