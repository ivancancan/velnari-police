// apps/mobile/src/components/IncidentDetailModal.tsx
import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Image, Linking, Alert,
} from 'react-native';
import { incidentsApi, type IncidentDetail, type IncidentEvent, type IncidentAttachment } from '../lib/api';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#22C55E',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'CRÍTICO', high: 'ALTO', medium: 'MEDIO', low: 'BAJO',
};

const TYPE_LABELS: Record<string, string> = {
  robbery: 'Robo', assault: 'Agresión', traffic: 'Tráfico', noise: 'Ruido',
  domestic: 'Doméstico', missing_person: 'Extraviado', other: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', assigned: 'Asignado', en_route: 'En ruta',
  on_scene: 'En escena', closed: 'Cerrado',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Incidente creado',
  assigned: 'Unidad asignada',
  status_changed: 'Estado actualizado',
  note_added: 'Nota agregada',
  attachment_added: 'Archivo adjunto',
  closed: 'Incidente cerrado',
  reopened: 'Reabierto',
};

interface Props {
  incidentId: string | null;
  onClose: () => void;
}

export default function IncidentDetailModal({ incidentId, onClose }: Props) {
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [attachments, setAttachments] = useState<IncidentAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) {
      setIncident(null);
      setEvents([]);
      setAttachments([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      incidentsApi.getById(incidentId),
      incidentsApi.getEvents(incidentId).catch(() => ({ data: [] })),
      incidentsApi.getAttachments(incidentId).catch(() => ({ data: [] })),
    ])
      .then(([detailRes, eventsRes, attachRes]) => {
        if (cancelled) return;
        setIncident(detailRes.data);
        setEvents(eventsRes.data ?? []);
        setAttachments(attachRes.data ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? 'No se pudo cargar el incidente');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [incidentId]);

  const open = incidentId !== null;

  const openInMaps = () => {
    if (!incident) return;
    const url = `http://maps.apple.com/?daddr=${incident.lat},${incident.lng}&dirflg=d`;
    Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el mapa'));
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Detalle de incidente</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}

        {error && !loading && (
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}

        {!loading && !error && incident && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Folio + priority */}
            <View style={[styles.heroCard, { borderLeftColor: PRIORITY_COLORS[incident.priority] ?? '#F59E0B' }]}>
              <View style={styles.heroRow}>
                <Text style={styles.folio}>{incident.folio}</Text>
                <View style={[styles.badge, { backgroundColor: (PRIORITY_COLORS[incident.priority] ?? '#F59E0B') + '22' }]}>
                  <Text style={[styles.badgeText, { color: PRIORITY_COLORS[incident.priority] ?? '#F59E0B' }]}>
                    {PRIORITY_LABELS[incident.priority] ?? incident.priority}
                  </Text>
                </View>
              </View>
              <Text style={styles.type}>{TYPE_LABELS[incident.type] ?? incident.type}</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Estado:</Text>
                <Text style={styles.statusValue}>{STATUS_LABELS[incident.status] ?? incident.status}</Text>
              </View>
            </View>

            {/* Address + navigate */}
            {(incident.address || (incident.lat && incident.lng)) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Ubicación</Text>
                {incident.address && <Text style={styles.body}>📍 {incident.address}</Text>}
                <TouchableOpacity style={styles.navButton} onPress={openInMaps} activeOpacity={0.7}>
                  <Text style={styles.navButtonText}>Abrir en Mapas →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Description */}
            {incident.description && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Descripción</Text>
                <Text style={styles.body}>{incident.description}</Text>
              </View>
            )}

            {/* Resolution */}
            {incident.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Resolución</Text>
                <Text style={styles.body}>{incident.resolution}</Text>
                {incident.closedAt && (
                  <Text style={styles.muted}>Cerrado {new Date(incident.closedAt).toLocaleString('es-MX')}</Text>
                )}
              </View>
            )}

            {/* Attachments */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Adjuntos ({attachments.length})</Text>
              {attachments.length === 0 ? (
                <Text style={styles.muted}>Sin archivos adjuntos</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachRow}>
                  {attachments.map((a) => {
                    const isImage = (a.mimeType ?? '').startsWith('image/');
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={styles.attachCard}
                        onPress={() => a.url && Linking.openURL(a.url).catch(() => {})}
                        activeOpacity={0.7}
                      >
                        {isImage && a.url ? (
                          <Image source={{ uri: a.url }} style={styles.attachImage} />
                        ) : (
                          <View style={styles.attachIcon}>
                            <Text style={styles.attachIconText}>📎</Text>
                          </View>
                        )}
                        <Text style={styles.attachDate} numberOfLines={1}>
                          {new Date(a.createdAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Timeline */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Línea de tiempo ({events.length})</Text>
              {events.length === 0 ? (
                <Text style={styles.muted}>Sin eventos registrados</Text>
              ) : (
                <View style={styles.timeline}>
                  {events.map((ev, idx) => (
                    <View key={ev.id} style={styles.timelineItem}>
                      <View style={styles.timelineDotCol}>
                        <View style={styles.timelineDot} />
                        {idx < events.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>{EVENT_LABELS[ev.type] ?? ev.type}</Text>
                        <Text style={styles.timelineTime}>
                          {new Date(ev.createdAt).toLocaleString('es-MX', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                        {ev.payload && Object.keys(ev.payload).length > 0 && (
                          <Text style={styles.timelinePayload} numberOfLines={3}>
                            {Object.entries(ev.payload)
                              .filter(([, v]) => v != null && v !== '')
                              .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                              .join(' · ')}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  closeBtnText: { color: '#94A3B8', fontSize: 18 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  heroCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    borderLeftWidth: 4,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  folio: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', fontFamily: 'Menlo' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  type: { color: '#CBD5E1', fontSize: 15, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { color: '#64748B', fontSize: 12 },
  statusValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  section: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14,
  },
  sectionLabel: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  body: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  muted: { color: '#64748B', fontSize: 13, fontStyle: 'italic' },
  navButton: {
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  navButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  attachRow: { gap: 10, paddingVertical: 4 },
  attachCard: { width: 100, alignItems: 'center', gap: 4 },
  attachImage: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#0F172A' },
  attachIcon: {
    width: 100, height: 100, borderRadius: 8, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  attachIconText: { fontSize: 36 },
  attachDate: { color: '#64748B', fontSize: 10, fontFamily: 'Menlo' },
  timeline: { marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineDotCol: { alignItems: 'center', width: 12 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6',
    marginTop: 4,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#334155', minHeight: 20 },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  timelineTime: { color: '#64748B', fontSize: 11, fontFamily: 'Menlo', marginTop: 2 },
  timelinePayload: { color: '#94A3B8', fontSize: 12, marginTop: 4, lineHeight: 16 },
});
