# Velnari — Guion de Demo (15 minutos)

## Preparacion previa
- API corriendo en localhost:3001
- Web corriendo en localhost:3000
- Simulador GPS corriendo: `node scripts/simulate-gps.mjs`
- Browser abierto en http://localhost:3000
- Segunda ventana en modo incognito (para mostrar reporte ciudadano)

## Minuto 0-2: Introduccion + Landing
**Narracion:** "Velnari es el sistema operativo de la seguridad municipal. Unifica monitoreo, despacho y supervision en una sola plataforma."

**Acciones:**
1. Mostrar landing page (http://localhost:3000)
2. Senalar las metricas: "<2 min despacho, 85%+ trazabilidad"
3. Click "Ver demo" -> login automatico

## Minuto 2-5: Command Center
**Narracion:** "Este es el centro de mando. El operador ve todo en tiempo real."

**Acciones:**
1. Senalar unidades moviendose en el mapa (P-01 a P-06)
2. Senalar trails azules (rutas de patrullaje)
3. Senalar pins verdes de "INICIO" (donde empezo cada unidad)
4. Click en una unidad -> mostrar panel de detalle
5. Mostrar indicador "En vivo" (punto verde)
6. Cambiar estilo de mapa: Oscuro -> Calles -> Claro
7. Activar "Mapa de calor" -> senalar zonas con mas incidentes
8. Activar "Cobertura" -> senalar huecos sin patrullas
9. Desactivar ambos

## Minuto 5-8: Flujo de incidente completo
**Narracion:** "Llega una llamada al 911. El operador crea el incidente en 3 clicks."

**Acciones:**
1. Click "+ Nuevo" en la lista de incidentes
2. Seleccionar tipo: "Robo"
3. Seleccionar prioridad: "Alta"
4. Click en el mapa para ubicacion
5. Escribir direccion y descripcion
6. Click "Crear incidente" -> aparece en el mapa
7. Click en el incidente -> detalle
8. Click "Asignar unidad" -> senalar seccion "Sugeridas"
9. **Narracion:** "El sistema analiza distancia y carga de trabajo para sugerir la mejor unidad."
10. Seleccionar la sugerida -> "Despachar"
11. **Narracion:** "La unidad cambia a 'En ruta'. El tiempo total: menos de 30 segundos."

## Minuto 8-10: Funciones avanzadas
**Narracion:** "El sistema trabaja solo cuando nadie esta mirando."

**Acciones:**
1. Mostrar toast de alerta (esperar a que el simulador genere uno)
2. Click campana de notificaciones -> historial
3. **Narracion:** "Si una unidad sale de su zona asignada: alerta. Si deja de moverse 5 minutos: alerta. Si un incidente lleva 5 minutos sin atender: se escala automaticamente."
4. Activar "Modo crisis" -> senalar banner rojo + filtro automatico
5. Desactivar crisis
6. Abrir Chat (tab 3) -> enviar un mensaje
7. **Narracion:** "Chat integrado entre operadores y unidades. Todo queda en bitacora."

## Minuto 10-12: Admin + Reportes
**Narracion:** "El comandante configura todo desde el panel administrativo."

**Acciones:**
1. Click "Usuarios" -> ir a /admin
2. Mostrar sidebar: Usuarios, Unidades, Sectores, Turnos, Tipos de Incidente
3. Click "Sectores" -> mostrar mapa con geocercas dibujadas
4. Click "Desempeno" -> mostrar scorecard de unidades
5. Click "Entrega de Turno" -> resumen de pendientes
6. Click "Constructor de Reportes" -> mostrar el builder
7. **Narracion:** "Cada municipio tiene formatos distintos. El admin disena los templates que los operadores llenan."
8. Crear un template rapido: agregar 2-3 campos
9. Volver al command -> click incidente -> "Llenar reporte" -> mostrar el form dinamico

## Minuto 12-13: App movil
**Narracion:** "El policia en campo tiene su propia app."

**Acciones:** (mostrar screenshots o Expo en simulador)
1. Tab Servicio: GPS activo, estado de unidad, incidente asignado
2. Tab Mapa: ruta en tiempo real con pin de inicio
3. Tab Reportar: crear incidente desde el campo con GPS
4. Boton SOS: mantener presionado -> alerta de panico
5. Tab Checklist: verificacion de turno

## Minuto 13-14: Reporte ciudadano
**Narracion:** "Los ciudadanos tambien pueden reportar directamente."

**Acciones:**
1. En ventana incognito, abrir http://localhost:3000/reportar
2. Seleccionar tipo, escribir descripcion, obtener ubicacion
3. Click "Enviar reporte" -> mostrar folio
4. Volver al command -> senalar que el incidente aparecio con tag "[Reporte ciudadano]"

## Minuto 14-15: Cierre
**Narracion:** "Con Velnari, un municipio puede:"
- Reducir tiempo de despacho de 8 a menos de 2 minutos
- Tener trazabilidad del 85%+ de incidentes
- Conectar el 90%+ de sus unidades
- Tomar decisiones basadas en datos, no en intuicion

"Preguntas?"

## Respuestas a preguntas frecuentes
- **"Cuanto cuesta?"** -> Modelo SaaS mensual por unidad conectada
- **"Cuanto tarda la implementacion?"** -> 2-4 semanas piloto
- **"Funciona offline?"** -> La app movil encola acciones y sincroniza al reconectar
- **"Se integra con nuestro sistema?"** -> API REST + webhooks disponibles
- **"Donde se almacenan los datos?"** -> Cloud privada, cumple con regulaciones mexicanas
