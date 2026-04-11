# Velnari — Manual de Demo para Municipio
### Guía paso a paso para Ivan durante la presentación

---

## Antes de empezar (15 min previos)

**Terminal 1 — API:**
```bash
cd apps/api && pnpm dev
```

**Terminal 2 — Web:**
```bash
cd apps/web && pnpm dev
```

**Terminal 3 — Simulador (arrancar 5 min antes del demo):**
```bash
node scripts/simulate-gps.mjs
```

**Checklist pre-demo:**
- [ ] Simulador corriendo — confirma que aparecen 6 unidades en mapa
- [ ] Hay al menos 2–3 incidentes activos en pantalla
- [ ] Pantalla a 1280px+ (o proyector en modo extendido)
- [ ] Modo oscuro del SO activado
- [ ] Notificaciones del sistema silenciadas
- [ ] URL abierta: `http://localhost:3000` (o URL de staging)
- [ ] Login listo: `admin@velnari.mx` / `Velnari2024!`

---

## Guión de Demo — 25 minutos

---

### PARTE 1: Apertura (2 min)

**Qué decir:**
> "Quiero mostrarles lo que pasa cuando un operador de cabina abre Velnari al inicio del turno."

**Acción:**
1. Abrir `http://localhost:3000` — aparece la pantalla de login
2. Ingresar credenciales → entrar al mapa principal

**Puntos de conversación:**
- "Esto es lo primero que ve el operador. Sin capacitación de horas, la interfaz habla sola."
- "El mapa es la interfaz principal — no listas, no tablas. Todo está geolocalizado."

---

### PARTE 2: Mapa en vivo — Visibilidad total (5 min)

**Qué mostrar:**
El mapa con unidades moviéndose en tiempo real.

**Acciones:**
1. Señalar las **unidades en el mapa** — explicar los colores:
   - 🟢 🚔 Verde = Disponible
   - 🔵 🚓 Azul pulsando = En ruta a incidente
   - 🟡 👮 Ámbar pulsando = En escena
   - ⛔ Gris = Fuera de servicio

2. **Clic en una unidad** → abre el panel lateral con:
   - Call sign, nombre del oficial
   - Estado actual
   - Nivel de batería del dispositivo
   - Historial de incidentes

3. **Mostrar el rastro** de la unidad → "Cada movimiento queda registrado."

4. **Cambiar estilo de mapa** (botones abajo a la izquierda):
   - Oscuro → Calles → volver a Oscuro

**Puntos de conversación:**
- "En este momento tienen X unidades activas. El comandante puede ver dónde está cada uno sin hacer una sola llamada de radio."
- "El rastro azul es el historial de los últimos minutos — si necesitan saber por dónde pasó una unidad, está aquí."
- "Esto es lo que tienen hoy vs. lo que tendrían con Velnari: cero visibilidad vs. visibilidad total."

---

### PARTE 3: Incidente en vivo — Del reporte al despacho (7 min)

**Setup:** El simulador habrá creado varios incidentes. Si no hay incidente crítico visible, crear uno manualmente.

**Crear incidente manualmente (si necesario):**
1. Clic en **"+ Nuevo Incidente"** (botón superior derecho)
2. Clic en el mapa para ubicar
3. Llenar:
   - Tipo: Robo
   - Prioridad: **CRÍTICO**
   - Descripción: "Asalto a mano armada en curso, presunto portando arma de fuego"
   - Dirección: "Av. Juárez 18, Centro Histórico, CDMX"
4. Guardar

**Acciones para mostrar:**
1. **Incidente nuevo** aparece en el mapa con marcador pulsando 🚨
2. Clic en el marcador → panel lateral del incidente:
   - Folio automático (INC-XXXX)
   - Prioridad con color
   - Timeline vacía
3. Ir a la pestaña **"Despacho"** (cuarta pestaña, badge naranja)
4. Ver la **cola de prioridad** — el incidente crítico está primero
5. Clic en **"Despachar"** → aparece sugerencia de unidad más cercana
   - "P-03 · 420m"
6. Clic en **"Confirmar"** → incidente asignado

**Puntos de conversación:**
- "Un operador que antes tardaba 4-8 minutos buscando quién estaba disponible, ahora lo hace en 2 clics."
- "El sistema sugiere la unidad disponible más cercana — no el operador con mejor memoria, el sistema con los datos más precisos."
- "¿Ven el folio? Todo queda trazado: quién creó el incidente, a qué hora, qué unidad fue asignada."

---

### PARTE 4: App móvil del oficial en campo (5 min)

**Qué decir antes:**
> "Ahora les muestro lo que ve el oficial en su teléfono."

**Si tienen un teléfono con la app instalada:**
1. Abrir app → Login como oficial (usar credenciales de supervisor o field officer)
2. Mostrar pantalla de inicio con incidentes activos
3. Mostrar el botón de actualizar estado: Disponible → En ruta → En escena

**Si solo tienen web:**
Mostrar desde otra ventana del navegador en modo móvil (DevTools → responsive, iPhone 12 Pro):
```
URL: http://localhost:3000 (versión móvil)
```

**Puntos de conversación:**
- "El oficial recibe la asignación aquí — sin radio, sin ambigüedad. Sabe exactamente adónde ir."
- "Si pierde señal — pasa mucho en campo — la app guarda la información y la sube cuando reconecta."
- "Sin instalar nada complejo. Es una app como cualquier otra del teléfono."

---

### PARTE 5: Dashboard — Evidencia de desempeño (4 min)

**Acción:**
1. Ir a la sección **"Insights"** o pestaña de estadísticas
2. Mostrar:
   - Tiempo promedio de despacho
   - Incidentes por prioridad (gráfica de barras)
   - Mapa de calor de incidentes (si tienen puntos)
   - Incidentes activos vs. cerrados

**Puntos de conversación:**
- "¿Cómo saben hoy si el turno fue bueno o malo? Con Velnari, estos datos están disponibles en tiempo real."
- "Fin del turno: el comandante ve exactamente cuántos incidentes se atendieron, tiempos, quién respondió más rápido."
- "Cuando el municipio necesite reportar al gobierno del estado, estos datos ya están aquí — sin capturar nada a mano."

---

### PARTE 6: Cierre y llamado a la acción (2 min)

**Qué decir:**
> "Lo que acaban de ver no es un prototipo. Está funcionando ahora mismo, con datos reales de movimiento, incidentes reales, despacho real."
>
> "El piloto propuesto es 8–12 semanas con 20 a 100 unidades. Al final del piloto, van a tener datos concretos de reducción en tiempo de despacho y trazabilidad de incidentes — métricas que pueden presentar ante cualquier autoridad."

**Propuesta concreta:**
1. Definir fecha de arranque
2. Identificar 20 unidades piloto
3. Nosotros instalamos, configuramos y capacitamos en 1 semana

---

## Preguntas frecuentes y respuestas

| Pregunta | Respuesta |
|----------|-----------|
| ¿Necesitan cambiar los radios? | No. Velnari complementa el radio — el radio queda para voz, Velnari para datos. |
| ¿Qué pasa si no hay internet en campo? | La app guarda todo offline y sincroniza cuando recupera señal. |
| ¿Qué dispositivos necesitan los oficiales? | Cualquier smartphone Android o iPhone. No hardware especial. |
| ¿Cuánto cuesta? | Piloto a costo de implementación. Pricing definitivo después de validar el piloto. |
| ¿Quién ve los datos? | Solo el municipio. Datos en servidores propios / nube privada. |
| ¿Qué pasa si el sistema cae? | El radio no se afecta. Y el sistema tiene redundancia en nube. |
| ¿En cuánto tiempo se capacita a los operadores? | 2 horas. La interfaz está diseñada para operadores bajo presión. |
| ¿Hay integración con C4/C5? | En el piloto no. Es una prioridad para Fase 2, ya lo tenemos mapeado. |

---

## Flujos de emergencia durante la demo

**Si el simulador se cae:**
```bash
# Ctrl+C y volver a correr:
node scripts/simulate-gps.mjs
```
Las unidades aparecerán en sus últimas posiciones conocidas.

**Si no hay incidentes activos:**
Crear uno manualmente desde la UI (ver Parte 3).

**Si el mapa no carga:**
- Verificar conexión a internet (el mapa usa tiles de CartoCDN)
- Cambiar estilo de mapa (botón abajo izquierda) — a veces uno de los estilos tiene problemas

**Si el login falla:**
```bash
# Correr seed nuevamente:
cd apps/api && pnpm db:seed
```

---

## Datos de acceso rápido

| Rol | Email | Password |
|-----|-------|----------|
| Admin / Demo | `admin@velnari.mx` | `Velnari2024!` |
| Supervisor | `supervisor@velnari.mx` | `Velnari2024!` |
| Oficial P-01 | `p01@velnari.mx` | `Velnari2024!` |

---

## Frases clave para repetir

- **"Claridad en el despliegue, precisión en la respuesta."**
- "De 4–8 minutos de despacho a menos de 2 minutos."
- "Trazabilidad completa — cada decisión queda registrada."
- "El operador no lucha contra la interfaz. La interfaz trabaja para él."
- "No es tecnología por la tecnología. Es tecnología que reduce el tiempo entre el reporte y la respuesta."

---

*Manual de demo v1.0 — Velnari, 2025*
