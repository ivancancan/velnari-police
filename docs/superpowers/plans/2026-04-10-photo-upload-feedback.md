# Per-Photo Upload Feedback in Report Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the report screen (`report.tsx`), show per-photo upload status (uploading spinner, green check, or amber queue icon) during incident submission instead of a single combined count alert at the end, so officers know exactly which photos uploaded and which were queued.

**Architecture:** Replace the `photos: string[]` state with `PhotoItem[]` objects that carry `status: 'pending' | 'uploading' | 'done' | 'queued'`. During `handleSubmit`, update each photo's status in real time. Render status icons next to each photo thumbnail in the photo strip.

**Tech Stack:** React Native `useState`, `ActivityIndicator`, inline styles.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/app/(tabs)/report.tsx` | Modify | Add per-photo status state and render status icons |

---

### Task 1: Replace photo state with status-tracked items

**Files:**
- Modify: `apps/mobile/app/(tabs)/report.tsx`

- [ ] **Step 1: Read the current report.tsx**

Read `apps/mobile/app/(tabs)/report.tsx` to confirm current `photos` state, `pickPhoto`, `removePhoto`, `handleSubmit`, and photo thumbnail render code.

- [ ] **Step 2: Add PhotoItem interface and update state**

At the top of `ReportScreen()`, replace:

```typescript
const [photos, setPhotos] = useState<string[]>([]);
```

With:

```typescript
interface PhotoItem {
  uri: string;
  status: 'pending' | 'uploading' | 'done' | 'queued';
}
const [photos, setPhotos] = useState<PhotoItem[]>([]);
```

- [ ] **Step 3: Update pickPhoto to use PhotoItem**

In `pickPhoto()`, anywhere `setPhotos((prev) => [...prev, result.assets[0]!.uri])` is called, change to:

```typescript
setPhotos((prev) => [...prev, { uri: result.assets[0]!.uri, status: 'pending' }]);
```

And where multi-select is spread:
```typescript
setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, status: 'pending' as const }))]);
```

- [ ] **Step 4: Update removePhoto**

Change:
```typescript
function removePhoto(uri: string) {
  setPhotos((prev) => prev.filter((p) => p !== uri));
}
```

To:
```typescript
function removePhoto(uri: string) {
  setPhotos((prev) => prev.filter((p) => p.uri !== uri));
}
```

- [ ] **Step 5: Update handleSubmit to set per-photo status**

Replace the photo upload loop in `handleSubmit()`:

```typescript
// Old code:
let photosQueued = 0;
for (const uri of photos) {
  try {
    await incidentsApi.uploadPhoto(incidentId, uri);
  } catch {
    await enqueuePhoto(incidentId, uri);
    photosQueued++;
  }
}
```

With:

```typescript
for (let i = 0; i < photos.length; i++) {
  const photo = photos[i]!;
  // Mark as uploading
  setPhotos((prev) => prev.map((p, idx) =>
    idx === i ? { ...p, status: 'uploading' } : p
  ));
  try {
    await incidentsApi.uploadPhoto(incidentId, photo.uri);
    setPhotos((prev) => prev.map((p, idx) =>
      idx === i ? { ...p, status: 'done' } : p
    ));
  } catch {
    await enqueuePhoto(incidentId, photo.uri);
    setPhotos((prev) => prev.map((p, idx) =>
      idx === i ? { ...p, status: 'queued' } : p
    ));
  }
}
```

Also remove the `photosQueued` variable and the `if (photosQueued > 0)` Alert — status is now visual, not a modal.

- [ ] **Step 6: Update the photo strip render**

Find the photo thumbnail rendering in the JSX (look for `photos.map` rendering `<Image>`). Update it to:

```tsx
{photos.map((photo) => (
  <View key={photo.uri} style={styles.photoThumb}>
    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
    {/* Status overlay */}
    <View style={styles.photoStatusOverlay}>
      {photo.status === 'uploading' && (
        <ActivityIndicator size="small" color="#F8FAFC" />
      )}
      {photo.status === 'done' && (
        <Text style={styles.photoStatusDone}>✓</Text>
      )}
      {photo.status === 'queued' && (
        <Text style={styles.photoStatusQueued}>⏳</Text>
      )}
    </View>
    {/* Remove button — only when pending */}
    {photo.status === 'pending' && !submitting && (
      <TouchableOpacity
        style={styles.photoRemove}
        onPress={() => removePhoto(photo.uri)}
      >
        <Text style={styles.photoRemoveText}>✕</Text>
      </TouchableOpacity>
    )}
  </View>
))}
```

- [ ] **Step 7: Add the new styles**

In `StyleSheet.create({})`, add (or update existing photo styles):

```typescript
  photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#1E293B' },
  photoImage: { width: 80, height: 80 },
  photoStatusOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  photoStatusDone: { color: '#22C55E', fontSize: 24, fontWeight: '800' },
  photoStatusQueued: { fontSize: 20 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
```

- [ ] **Step 8: Reset photos state correctly after submission**

After the photo loop (and before `setSuccess`), reset:
```typescript
setPhotos([]);
```
This already exists — no change needed, just confirm it's still there.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "report\|PhotoItem" | head -10
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app/(tabs)/report.tsx
git commit -m "feat(mobile): per-photo upload status indicators in report screen"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Individual photo status shown ✓, uploading spinner ✓, done check ✓, queued indicator ✓
- [x] **No placeholders:** Full code for state, handler, JSX, and styles ✓
- [x] **Remove button disabled during upload:** Only shown when `status === 'pending' && !submitting` ✓
- [x] **Queued alert removed:** Replaced by visual queued indicator — less modal noise ✓
- [x] **State reset:** `setPhotos([])` still runs after loop to clear all on success ✓
- [x] **Index-based update:** Uses `idx === i` comparison — safe for concurrent state updates ✓
