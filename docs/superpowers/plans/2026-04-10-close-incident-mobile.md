# Close Incident from Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a field officer close their assigned incident directly from the mobile app (Velnari Field) with a resolution code, eliminating the need to call dispatch to close it.

**Architecture:** The backend already has `POST /incidents/:id/close` accepting `CloseIncidentDto { resolution: string; notes?: string }` — it is guarded with `FIELD_UNIT` role allowed. We only need: (1) add `incidentsApi.close()` to `api.ts`, (2) add a "Cerrar incidente" button in `home.tsx` inside the `assignedIncident` card (shown only when `assignedIncident.status` is `'assigned'` or `'on_scene'`), (3) show a confirmation Alert with a resolution picker (3 options: `'resolved'`, `'false_alarm'`, `'transferred'`), (4) call `close()`, then `setAssignedIncident(null)`.

**Tech Stack:** Axios (`api.ts`), React Native `Alert`, Zustand `unit.store`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/src/lib/api.ts` | Modify | Add `incidentsApi.close(id, resolution, notes?)` |
| `apps/mobile/app/(tabs)/home.tsx` | Modify | Add close button + resolution alert to incident card |

---

### Task 1: Add incidentsApi.close() to api.ts

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`

- [ ] **Step 1: Read api.ts incidentsApi section**

Read `apps/mobile/src/lib/api.ts` lines 156–192 to confirm the current shape of `incidentsApi`.

- [ ] **Step 2: Add close method**

Inside the `incidentsApi` object, after `uploadPhoto`, add:

```typescript
  close: (incidentId: string, resolution: string, notes?: string) =>
    api.post(`/incidents/${incidentId}/close`, { resolution, ...(notes ? { notes } : {}) }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "api\|close" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/api.ts
git commit -m "feat(mobile): add incidentsApi.close() for field officer incident closure"
```

---

### Task 2: Add close button to incident card in home.tsx

**Files:**
- Modify: `apps/mobile/app/(tabs)/home.tsx`

The incident card is rendered inside `{assignedIncident ? ( ... ) : ( ... )}` (around line 423). After the note actions section (the `noteActions` View containing the camera button and "Enviar" button), add a "Cerrar incidente" button.

- [ ] **Step 1: Add closingIncident state and handleCloseIncident function**

At the top of `HomeScreen()`, after the existing state declarations, add:

```typescript
const [closingIncident, setClosingIncident] = useState(false);
```

After `handleSendNote`, add:

```typescript
const RESOLUTION_OPTIONS = [
  { label: 'Resuelto', value: 'resolved' },
  { label: 'Falsa alarma', value: 'false_alarm' },
  { label: 'Transferido a otra unidad', value: 'transferred' },
];

async function handleCloseIncident() {
  if (!assignedIncident) return;

  // Show resolution picker via Alert
  Alert.alert(
    'Cerrar incidente',
    `¿Cómo se resolvió ${assignedIncident.folio}?`,
    [
      ...RESOLUTION_OPTIONS.map((opt) => ({
        text: opt.label,
        onPress: async () => {
          setClosingIncident(true);
          try {
            await incidentsApi.close(assignedIncident.id, opt.value);
            setAssignedIncident(null);
            Vibration.vibrate(100);
            Alert.alert('Incidente cerrado', `${assignedIncident.folio} marcado como "${opt.label}".`);
          } catch {
            Alert.alert('Error', 'No se pudo cerrar el incidente. Intenta de nuevo.');
          } finally {
            setClosingIncident(false);
          }
        },
      })),
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
```

- [ ] **Step 2: Add the close button below the note actions**

Find the closing `</>` of the incident section (after the `noteContainer` View, before the `) : (` of the ternary). Add the close button immediately after the `noteContainer` View:

```tsx
        {/* Close incident button */}
        {(assignedIncident.status === 'assigned' || assignedIncident.status === 'on_scene') && (
          <TouchableOpacity
            style={[styles.closeIncidentButton, closingIncident && styles.closeIncidentButtonDisabled]}
            onPress={handleCloseIncident}
            disabled={closingIncident}
            activeOpacity={0.7}
          >
            <Text style={styles.closeIncidentButtonText}>
              {closingIncident ? 'Cerrando...' : '✓ Cerrar incidente'}
            </Text>
          </TouchableOpacity>
        )}
```

- [ ] **Step 3: Add the button styles**

In the `StyleSheet.create({...})` at the bottom of `home.tsx`, add:

```typescript
  closeIncidentButton: {
    backgroundColor: '#134E4A',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 52,
  },
  closeIncidentButtonDisabled: {
    opacity: 0.5,
  },
  closeIncidentButtonText: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "home\|closeIncident" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/home.tsx
git commit -m "feat(mobile): close incident button for field officers with resolution picker"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Close button visible ✓, resolution required ✓, assignedIncident cleared on success ✓
- [x] **No placeholders:** Full code shown for state, handler, JSX, and styles ✓
- [x] **Status guard:** Button only renders when status is `'assigned'` or `'on_scene'` ✓ (not for `'open'` incidents the officer isn't actively attending)
- [x] **Resolution values match backend:** `CloseIncidentDto.resolution` is `@MaxLength(50)` — all three values are under 50 chars ✓
- [x] **Backend already allows FIELD_UNIT:** Endpoint guarded, no backend changes needed ✓
- [x] **Vibration on success:** Confirms closure to officer ✓
