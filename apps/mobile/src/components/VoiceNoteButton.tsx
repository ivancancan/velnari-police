import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { incidentsApi } from '../lib/api';

// Long-press-to-record voice note button. Released = stop + upload.
// Audio files are uploaded through the existing /incidents/:id/attachments
// flow (presigned S3 PUT when available, multipart fallback) so the command
// center timeline shows them as regular attachments with mime type audio/m4a.
//
// Designed for officer-with-gloves context: one tap, one hold, one release.

interface Props {
  incidentId: string;
  onUploaded?: () => void;
}

export default function VoiceNoteButton({ incidentId, onUploaded }: Props) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recRef = useRef<Audio.Recording | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso al micrófono para grabar notas de voz.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recRef.current = rec;
      setRecording(true);
      setDurationMs(0);
      const started = Date.now();
      tickRef.current = setInterval(() => setDurationMs(Date.now() - started), 200);
      Vibration.vibrate(20);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar la grabación.');
    }
  }

  async function stopAndUpload() {
    const rec = recRef.current;
    if (!rec) return;
    if (tickRef.current) clearInterval(tickRef.current);

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recRef.current = null;
      setRecording(false);

      // Very short clicks are probably mis-taps — throw them away.
      if (!uri || durationMs < 600) {
        setDurationMs(0);
        return;
      }

      setUploading(true);
      await incidentsApi.uploadVoiceNote(incidentId, uri);
      onUploaded?.();
      Vibration.vibrate([0, 60, 40, 60]);
      Alert.alert('Nota de voz enviada', `Se adjuntó ${(durationMs / 1000).toFixed(1)}s al incidente.`);
    } catch {
      Alert.alert('Error', 'No se pudo subir la nota de voz. Intenta de nuevo.');
    } finally {
      setUploading(false);
      setDurationMs(0);
    }
  }

  const seconds = (durationMs / 1000).toFixed(1);

  return (
    <TouchableOpacity
      style={[styles.button, recording && styles.recording, uploading && styles.disabled]}
      onPressIn={startRecording}
      onPressOut={stopAndUpload}
      disabled={uploading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Grabar nota de voz"
      accessibilityHint="Mantén presionado para grabar, suelta para enviar"
    >
      <Text style={styles.icon}>{uploading ? '⏳' : recording ? '●' : '🎙'}</Text>
      <Text style={styles.label}>
        {uploading ? 'Subiendo...' : recording ? `Grabando ${seconds}s` : 'Mantener para grabar'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recording: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
});
