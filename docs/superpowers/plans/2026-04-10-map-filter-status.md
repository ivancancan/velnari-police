# Map Filter by Unit Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a status filter row on the mobile map tab so officers can toggle to see only AVAILABLE, EN_ROUTE, or ON_SCENE units — reducing clutter when the sector has many units.

**Architecture:** Add `statusFilter: string | null` state to `MapScreen`. A horizontal row of filter chips sits above the map (or overlaid at the top). `nearbyUnits` is already in Zustand store — filter it to only render markers matching the selected status. "Todos" chip clears the filter.

**Tech Stack:** React Native `ScrollView`, Zustand `unit.store` (already used), `react-native-maps` `Marker`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/app/(tabs)/map.tsx` | Modify | Add filter state, filter chips UI, apply filter to marker render |

---

### Task 1: Add status filter to map.tsx

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`

- [ ] **Step 1: Read current map.tsx**

Read `apps/mobile/app/(tabs)/map.tsx` to confirm the current state declarations, marker render, and the overlay/showOverlay area where filter chips should go.

- [ ] **Step 2: Add statusFilter state**

At the top of `MapScreen()`, after existing `useState` declarations, add:

```typescript
const [statusFilter, setStatusFilter] = useState<string | null>(null);
```

- [ ] **Step 3: Define filter options**

After the `STATUS_MARKER_COLORS` and `PRIORITY_COLORS` constants (at module level, above the component), add:

```typescript
const FILTER_OPTIONS = [
  { value: null, label: 'Todas' },
  { value: 'available', label: 'Disponibles' },
  { value: 'en_route', label: 'En ruta' },
  { value: 'on_scene', label: 'En escena' },
];
```

- [ ] **Step 4: Filter nearbyUnits before rendering**

In the render, compute `filteredUnits` from `nearbyUnits`:

```typescript
const filteredUnits = statusFilter
  ? nearbyUnits.filter((u) => u.status === statusFilter)
  : nearbyUnits;
```

Replace the `nearbyUnits.map(...)` calls in the `<Marker>` section with `filteredUnits.map(...)`.

- [ ] **Step 5: Add filter chips UI**

Find the overlay section in the JSX — there is a `showOverlay` flag controlling a top overlay with speed/timer info. Add the filter chips just below the overlay inside the `<View style={styles.rootContainer}>` (as a positioned overlay row):

```tsx
{/* Filter chips — fixed at top below overlay */}
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.filterRow}
  contentContainerStyle={styles.filterRowContent}
  pointerEvents="box-none"
>
  {FILTER_OPTIONS.map((opt) => {
    const isActive = statusFilter === opt.value;
    const chipColor = opt.value
      ? STATUS_MARKER_COLORS[opt.value] ?? '#64748B'
      : '#3B82F6';
    return (
      <TouchableOpacity
        key={opt.label}
        style={[
          styles.filterChip,
          isActive && { backgroundColor: chipColor + '33', borderColor: chipColor },
        ]}
        onPress={() => setStatusFilter(isActive ? null : opt.value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterChipText, isActive && { color: chipColor }]}>
          {opt.label}
          {opt.value && isActive && ` (${filteredUnits.length})`}
        </Text>
      </TouchableOpacity>
    );
  })}
</ScrollView>
```

Place this just before the `{/* Overlay */}` block (or after it, above the MapView).

- [ ] **Step 6: Add filter styles**

In `StyleSheet.create({})`, add:

```typescript
  filterRow: {
    position: 'absolute',
    top: 56,        // below status bar
    left: 0,
    right: 0,
    zIndex: 20,
    maxHeight: 48,
  },
  filterRowContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  filterChip: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "map\|statusFilter" | head -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/(tabs)/map.tsx
git commit -m "feat(mobile): status filter chips on map tab for unit visibility control"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Filter by status ✓, "Todas" clears filter ✓, affects marker render ✓
- [x] **No placeholders:** Full code for state, constants, JSX, and styles ✓
- [x] **Active chip shows count:** `(${filteredUnits.length})` helps officer know how many match ✓
- [x] **Tap active chip to clear:** `isActive ? null : opt.value` toggles off if already selected ✓
- [x] **No filter impacts incidents:** `openIncidents` markers are not filtered — incidents always shown ✓
- [x] **zIndex:** `zIndex: 20` puts chips above map tiles but below modals ✓
