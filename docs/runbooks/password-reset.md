# Velnari — Password Reset Procedure

> **Who can reset passwords:** Admin and Supervisor roles only.  
> There is no self-service "forgot password" flow in the pilot.  
> All resets are admin-driven and leave an audit trail.

---

## Standard reset (operator forgot password)

**Time required:** < 2 minutes  
**Requires:** Admin or Supervisor account

1. Log in at `https://app.velnari.mx/command`
2. Navigate to **Admin → Usuarios** (or go directly to `/admin`)
3. Find the operator by name or email
4. Click the operator row → "Restablecer contraseña"
5. Enter a new temporary password meeting the policy:
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 number
   - At least 1 special character (`!@#$%^&*`)
6. Click "Guardar"
7. Communicate the temporary password to the operator via a secure channel (in person or encrypted message — **never via radio or plain SMS**)
8. Ask the operator to log in and verify they can access the system

**Audit trail:** The password change is recorded in the audit log under the admin's actor ID. The operator's previous session tokens are invalidated within 15 minutes (next JWT expiry).

---

## Admin account locked out

If the only admin is locked out:

1. Contact on-call engineer (see [oncall.md](oncall.md))
2. Engineer connects to the production database via secure tunnel
3. Engineer generates a new bcrypt hash:
   ```bash
   node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TempPass1!', 10).then(console.log)"
   ```
4. Engineer updates the admin's `password_hash` directly:
   ```sql
   UPDATE users SET password_hash = '$2b$10$...' WHERE email = 'admin@municipio.mx';
   ```
5. Admin logs in with the temporary password immediately
6. Admin changes password via Admin → Mi cuenta (if available) or the engineer resets via the API
7. Document the incident in Sentry or a ticket

---

## Password policy (enforced by API)

| Rule | Requirement |
|------|-------------|
| Minimum length | 8 characters |
| Uppercase | At least 1 |
| Number | At least 1 |
| Special character | At least 1 from `!@#$%^&*()_+-=[]{};':"\\|,.<>/?` |
| Maximum length | No hard limit (bcrypt truncates at 72 bytes) |
| Reuse | Not enforced in pilot phase |
| Expiry | Not enforced in pilot phase — add for commercial launch |

---

## API endpoint (for engineers)

```http
PATCH /api/users/:id/password
Authorization: Bearer <admin_or_supervisor_token>
Content-Type: application/json

{
  "password": "NewSecurePass1!"
}
```

Response: `200 OK` with updated user object, or `400` if password fails policy.

**Roles allowed:** `admin`, `supervisor`  
**Audit logged:** Yes (actor, timestamp, IP, entity ID)
