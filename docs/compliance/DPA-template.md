# Data Processing Agreement (DPA) — Template

**Entre:**
- **Responsable del tratamiento:** [NOMBRE DEL MUNICIPIO] (el "Municipio")
- **Encargado del tratamiento:** Velnari, S.A. de C.V. (el "Proveedor")

Fecha: ___________________
Vigencia: [inicio piloto] a [fin de contrato]

---

## 1. Objeto

El Proveedor tratará datos personales de policías, supervisores y
funcionarios del Municipio conforme a los términos de la prestación
del servicio Velnari (Command + Dispatch + Field + Insights), descrito
en el contrato de servicios fechado ___________.

## 2. Categorías de datos y titulares

El tratamiento incluye los datos descritos en
`docs/compliance/LFPDPPP.md` §1, limitado a:

- Funcionarios policiales activos del Municipio (usuarios operadores).
- Ciudadanos cuyos reportes de incidentes sean registrados por los
  operadores (nombre opcional, dirección, descripción del evento).

## 3. Finalidades autorizadas

- Coordinación operativa de despacho policial.
- Registro de incidentes y su resolución.
- Auditoría y reporte de desempeño.
- Análisis agregado para mejora del servicio.

**Usos prohibidos:**
- Cesión a terceros no listados en §6.
- Perfilado con propósito comercial.
- Uso fuera del ámbito del contrato.

## 4. Medidas de seguridad

El Proveedor se obliga a mantener las medidas administrativas, técnicas
y físicas descritas en `docs/compliance/LFPDPPP.md` §4. Cualquier cambio
material debe notificarse con 30 días de anticipación.

## 5. Subencargados

El Proveedor contrata los siguientes subencargados con el consentimiento
general del Municipio:

| Subencargado | Servicio | País |
|--------------|----------|------|
| Supabase Inc. | Base de datos PostgreSQL | EE.UU. |
| Railway Corp. | Hosting de API | EE.UU. |
| Vercel Inc. | Hosting de interfaz web | EE.UU. |
| Upstash Inc. | Cache Redis | Multi-región |
| Expo (650 Industries, Inc.) | Push notifications | EE.UU. |
| Mapbox Inc. | Tiles de mapa | EE.UU. |
| Functional Software, Inc. (Sentry) | Observabilidad de errores | EE.UU. |

La sustitución de subencargados o adición de nuevos requiere
notificación al Municipio con 15 días de anticipación; el Municipio
podrá objetar por motivos razonables.

## 6. Transferencias internacionales

Los datos residen principalmente en **Estados Unidos**. El Proveedor
confirma que cada subencargado mantiene garantías equivalentes a la
LFPDPPP conforme a SOC 2 Type II y, donde aplicable, GDPR (DPF/SCCs).

## 7. Derechos ARCO

- Solicitudes recibidas por el Municipio serán canalizadas a Velnari en
  un plazo máximo de 2 días hábiles.
- Velnari procesará y responderá al Municipio en 15 días naturales.
- Velnari asistirá al Municipio en respuestas a titulares.

## 8. Notificación de incidentes de seguridad

Obligación del Proveedor:

- Notificación al Municipio: **dentro de 48 horas** del conocimiento
  confirmado de un incidente.
- Reporte inicial: naturaleza, datos afectados, acciones de contención.
- Reporte final: 30 días post-contención, con causa raíz y remediación.

Canal de notificación: correo electrónico certificado al contacto
designado por el Municipio + llamada telefónica dentro de las primeras
4 horas para incidentes CRÍTICOS (fuga de credenciales, exposición
masiva de datos).

## 9. Devolución / supresión al término

Al término del contrato, el Proveedor:

1. Devolverá al Municipio un export completo en formato SQL + archivos
   originales dentro de 30 días naturales.
2. Confirmará la supresión de todos los datos en sistemas productivos
   dentro de 60 días naturales post-devolución.
3. Retendrá únicamente la mínima información necesaria para defensa
   legal (logs de auditoría por 2 años post-término; contrato y facturas
   por período fiscal aplicable).

## 10. Auditoría

El Municipio podrá auditar al Proveedor una vez por año natural con
aviso de 30 días, limitado a:

- Revisión de controles técnicos y administrativos.
- Entrevistas con personal de operaciones.
- Revisión de logs de acceso a sus datos específicos.

Auditorías adicionales en caso de incidente de seguridad documentado.

## 11. Responsabilidad

El Proveedor responde por daños causados por incumplimiento del DPA
conforme al Art. 63 LFPDPPP. Limitación de responsabilidad al monto
pagado en el año anterior al incidente, salvo casos de dolo o culpa
grave.

## 12. Vigencia y terminación

Este DPA subsiste mientras el Proveedor trate datos del Municipio.
La terminación del contrato de servicios detona la cláusula 9.

---

**Firmas**

| | |
|---|---|
| ___________________ | ___________________ |
| Por el Municipio | Por Velnari |
| Nombre: | Ivan Cantú |
| Cargo: | Director Ejecutivo |
| Fecha: | Fecha: |
