# Cumplimiento LFPDPPP — Velnari

**Ley Federal de Protección de Datos Personales en Posesión de los Particulares**
(DOF, 05-07-2010; Reglamento DOF 21-12-2011)

Este documento describe cómo Velnari cumple con la LFPDPPP aplicable al
procesamiento de datos personales de policías municipales y funcionarios
operando en el sistema. NO sustituye revisión legal — es un registro
interno para diligencia debida con el municipio y futuros auditores.

---

## 1. Datos personales tratados

| Categoría | Campo | Base legal |
|-----------|-------|------------|
| Identificativo | nombre, email, número de placa | Relación laboral (LFPDPPP Art. 10.II) |
| Autenticación | hash de contraseña (bcrypt), token biométrico local | Consentimiento expreso + seguridad |
| Operativo | ubicación GPS en turno, estado de unidad, incidentes atendidos | Ejercicio de funciones de seguridad pública (Art. 10.IV) |
| Dispositivo | token Expo push notification | Consentimiento para comunicaciones operativas |
| Multimedia | fotografías de incidentes, notas de voz | Necesidad pública + consentimiento |
| Diagnóstico | nivel de batería, latencia GPS | Interés legítimo (operación del servicio) |

**No se tratan** datos sensibles según Art. 3.VI (origen racial, salud,
genéticos, creencias religiosas/políticas, vida sexual, biometría facial).
La biometría (huella/FaceID) reside localmente en el dispositivo y nunca
se transmite al servidor.

## 2. Aviso de privacidad

El aviso de privacidad simplificado se muestra a cada usuario en el
**primer ingreso a Velnari Field** (mobile) en un modal bloqueante que
requiere consentimiento afirmativo antes de usar la aplicación.

- Código: `apps/mobile/src/components/PrivacyConsentModal.tsx`
- Persistencia del consentimiento: `SecureStore` con clave
  `velnari_privacy_consent` = timestamp ISO.
- Versión completa: https://velnari.mx/privacidad

Toda actualización material al tratamiento requiere re-consentimiento;
implementar bumping de la clave (p.ej. `velnari_privacy_consent_v2`) para
forzar que usuarios re-acepten.

## 3. Derechos ARCO (Art. 28)

Los titulares pueden ejercer derechos de **Acceso, Rectificación,
Cancelación y Oposición** vía:

1. Solicitud a su administrador municipal (primer contacto).
2. Correo a `privacidad@velnari.mx` si el municipio no responde en 20 días.
3. Queja ante INAI si Velnari no responde en 30 días.

Actualmente **no hay portal self-service** para ARCO — los requests se
procesan manualmente por el equipo de operaciones. Documentar esto en
el DPA con el municipio.

### Implementación técnica del derecho de cancelación

Soft-delete en `UserEntity.deletedAt` (migración 017). La cancelación NO
destruye:
- Eventos de auditoría (`audit_logs`) — retenidos 365 días como requiere
  el principio de responsabilidad demostrable (Art. 14).
- Eventos en incidentes atribuidos al usuario — parte del expediente
  operativo y no constituyen "datos personales en posesión" tras
  cancelación (exención Art. 37.III).

Retención por defecto configurable vía `AUDIT_RETENTION_DAYS`.

## 4. Medidas de seguridad (Art. 19)

### Administrativas
- Política de acceso por roles (RBAC): admin, supervisor, commander,
  operator, field_unit.
- Ivan Cantú es el **responsable oficial** del tratamiento (designado).
- Plan de respuesta a incidentes de seguridad documentado en
  `docs/runbooks/oncall.md`.

### Técnicas
- **Cifrado en tránsito**: TLS 1.2+ obligatorio (Railway + Vercel).
- **Cifrado en reposo**: PostgreSQL en Supabase (encriptación transparente
  AES-256 a nivel de disco).
- **Autenticación**: JWT (HS256) de 15 min + refresh de 7 días; bcrypt
  rounds=10; account lockout tras 10 fallos.
- **Auditoría**: todas las operaciones de escritura registradas con actor,
  IP, timestamp y payload redactado (passwords/tokens removidos).
- **Biometría**: Face ID / Touch ID local en mobile con lock-out por
  inactividad de 60s.
- **MFA**: pendiente (post-MVP). Documentar timeline en DPA.

### Físicas
- Infraestructura en centros de datos certificados (AWS ISO 27001 vía
  Railway/Vercel/Supabase).

## 5. Residencia de datos

**Estado actual (pre-pilot):**
- PostgreSQL (Supabase) → región `us-east-1` (AWS N. Virginia)
- Object storage (S3) → `us-east-1`
- Compute (Railway) → `us-east4` (GCP)
- Cache (Upstash) → multi-region

**Riesgo**: LFPDPPP no exige residencia en México, pero la transferencia
internacional requiere:
1. Identificación de país destino: EE.UU.
2. Garantías equivalentes: los providers son SOC 2 Type II + GDPR-aligned.
3. Notificación en aviso de privacidad (cumplido — el aviso menciona
   "servidores ubicados en México" — **desalineado con realidad, corregir
   al siguiente push de privacy policy**).

**Acción pendiente (post-pilot):**
- Actualizar aviso de privacidad: "servidores en EE.UU. con garantías
  equivalentes SOC 2 Type II".
- Evaluar migración a Supabase región `sa-east-1` (São Paulo — menor
  latencia para MX) o Railway región `us-west2` si el cliente exige.

## 6. Transferencias de datos a terceros

| Destinatario | Propósito | Finalidad | Consentimiento |
|--------------|-----------|-----------|----------------|
| Supabase (AWS) | Almacenamiento DB | Operación esencial | Aviso de privacidad |
| Railway (GCP) | Hosting API | Operación esencial | Aviso de privacidad |
| Vercel | Hosting web | Operación esencial | Aviso de privacidad |
| Expo (Push service) | Entrega de notificaciones | Despacho operativo | Consentimiento expreso |
| Mapbox | Tiles de mapa | Visualización | Interés legítimo |
| Sentry (cuando wired) | Error reporting | Mantenimiento | Interés legítimo |

Ningún tercero recibe datos personales completos para propósitos propios
— todos son encargados (procesadores) bajo la figura Art. 50 RLFPDPPP.

## 7. Retención y supresión

| Dato | Retención | Justificación |
|------|-----------|---------------|
| Usuarios activos | Indefinida mientras el usuario sea operador | Finalidad activa |
| Usuarios cancelados (soft-delete) | 2 años post-cancelación | Art. 11.II — defensa de reclamaciones |
| Audit logs | 365 días (configurable) | Responsabilidad demostrable |
| Historial de ubicación GPS | 30 días | Operación táctica; innecesario retener más |
| Incidentes cerrados | Indefinido | Expediente operativo del municipio |
| Fotos de incidentes | Indefinido | Expediente operativo del municipio |
| Tokens push device | Mientras el dispositivo esté activo | Operación |

Cron automatizado en `apps/api/src/modules/cleanup/cleanup.service.ts`.

## 8. Responsables

| Rol | Persona | Contacto |
|-----|---------|----------|
| Responsable del tratamiento | Ivan Cantú (Velnari) | ivan@velnari.mx |
| Oficial de Privacidad | Ivan Cantú | privacidad@velnari.mx |
| Encargado técnico (data access) | Ivan Cantú | — |
| Municipio | Corresponsable por datos operativos | variable por contrato |

**Single point of failure**: recomendación urgente de designar segundo
oficial de privacidad antes del primer piloto.

## 9. Acciones pendientes antes del piloto

- [ ] Revisión legal externa del aviso de privacidad (sección residencia).
- [ ] Firmar DPA (`docs/compliance/DPA-template.md`) con el municipio.
- [ ] Designar segundo oficial de privacidad.
- [ ] Publicar aviso de privacidad versión larga en https://velnari.mx/privacidad.
- [ ] Implementar portal ARCO self-service (post-MVP).
