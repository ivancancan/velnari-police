import { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getRecentLogs } from '@/lib/log-buffer';

// In-app bug reporter accessible from the Profile tab. Captures:
//  - Free-text description from the officer
//  - Optional screenshot (taken via react-native-view-shot of the screen
//    they had open when they opened the report modal)
//  - Device context (OS, version, model, app version)
//  - Recent logs from the circular buffer
//
// All of this goes to POST /api/support/bug-reports where an admin triages
// them at /admin/bug-reports.

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  low: { label: 'Bajo', color: '#22C55E' },
  medium: { label: 'Medio', color: '#F59E0B' },
  high: { label: 'Alto', color: '#F97316' },
  critical: { label: 'Crítico', color: '#EF4444' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Ref to the root view to capture as screenshot — optional. */
  captureRootRef?: React.RefObject<ViewShot | null>;
}

export default function ReportIssueModal({ visible, onClose, captureRootRef }: Props) {
  const { user } = useAuthStore();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

  async function captureScreen(): Promise<void> {
    if (!captureRootRef?.current) return;
    try {
      const uri = await captureRef(captureRootRef.current, {
        format: 'jpg',
        quality: 0.7,
        result: 'tmpfile',
      });
      setScreenshotUri(uri);
    } catch {
      // Silent — user can submit without screenshot
    }
  }

  async function submit(): Promise<void> {
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Describe el problema', 'Escribe al menos 10 caracteres describiendo qué falló.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      formData.append('severity', severity);
      formData.append(
        'context',
        JSON.stringify({
          platform: Platform.OS,
          osVersion: Platform.Version,
          deviceModel: Device.modelName ?? 'unknown',
          deviceBrand: Device.brand ?? 'unknown',
          appVersion: Application.nativeApplicationVersion ?? 'unknown',
          buildVersion: Application.nativeBuildVersion ?? 'unknown',
          userRole: user?.role ?? 'unknown',
          unitCallSign: (user as unknown as { callSign?: string })?.callSign ?? null,
        }),
      );
      formData.append('logs', JSON.stringify(getRecentLogs()));

      if (screenshotUri) {
        formData.append('screenshot', {
          uri: screenshotUri,
          name: 'screenshot.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
      }

      await api.post('/support/bug-reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(
        'Reporte enviado',
        'Gracias. El equipo de Velnari revisará este reporte y lo contactará si necesita más detalles.',
      );
      setDescription('');
      setScreenshotUri(null);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reportar problema</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={submitting || description.trim().length < 10}
            style={styles.headerBtn}
          >
            {submitting ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text
                style={[
                  styles.headerBtnText,
                  { color: description.trim().length >= 10 ? '#3B82F6' : '#475569', fontWeight: '700' },
                ]}
              >
                Enviar
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.label}>¿Qué pasó?</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Ejemplo: al tocar Iniciar rastreo no pasa nada. Venía de cerrar un incidente."
            placeholderTextColor="#64748B"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.helperText}>
            {description.length}/1000 — mientras más detalle, más rápido lo arreglamos.
          </Text>

          <Text style={[styles.label, { marginTop: 20 }]}>Severidad</Text>
          <View style={styles.severityRow}>
            {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSeverity(s)}
                style={[
                  styles.severityChip,
                  severity === s && { backgroundColor: SEVERITY_META[s].color + '33', borderColor: SEVERITY_META[s].color },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.severityText,
                    severity === s && { color: SEVERITY_META[s].color, fontWeight: '700' },
                  ]}
                >
                  {SEVERITY_META[s].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Captura de pantalla (opcional)</Text>
          {screenshotUri ? (
            <View style={styles.screenshotCard}>
              <Text style={styles.screenshotText}>✓ Captura incluida</Text>
              <TouchableOpacity onPress={() => setScreenshotUri(null)}>
                <Text style={styles.screenshotRemove}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={captureScreen} style={styles.screenshotBtn} activeOpacity={0.7}>
              <Text style={styles.screenshotBtnText}>Capturar pantalla actual</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Qué incluye automáticamente</Text>
            <Text style={styles.infoLine}>• Modelo de dispositivo y versión del sistema</Text>
            <Text style={styles.infoLine}>• Versión de Velnari Field instalada</Text>
            <Text style={styles.infoLine}>• Últimos {getRecentLogs().length} eventos técnicos de la app</Text>
            <Text style={styles.infoLine}>• Tu rol y unidad asignada (no contraseñas)</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  headerBtn: { minWidth: 70 },
  headerBtnText: { color: '#94A3B8', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  label: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 14,
    fontSize: 15,
    minHeight: 140,
    lineHeight: 22,
  },
  helperText: { color: '#64748B', fontSize: 12, marginTop: 6 },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  severityText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  screenshotBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  screenshotBtnText: { color: '#3B82F6', fontSize: 14, fontWeight: '600' },
  screenshotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  screenshotText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  screenshotRemove: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  infoCard: {
    marginTop: 24,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  infoLine: { color: '#94A3B8', fontSize: 12, lineHeight: 20 },
});
