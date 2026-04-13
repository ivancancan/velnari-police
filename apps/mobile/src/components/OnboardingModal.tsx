// apps/mobile/src/components/OnboardingModal.tsx
import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const ONBOARDING_KEY = 'velnari_onboarding_done';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Step {
  key: string;
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    key: 'home',
    icon: '🏠',
    title: 'Tu centro de operaciones',
    body: 'En la pestaña Inicio verás tu unidad asignada, el incidente activo, y el botón de rastreo GPS. Mantén el GPS activo durante tu turno para que el centro de mando te ubique.',
  },
  {
    key: 'dispatch',
    icon: '📋',
    title: 'Reporta incidentes',
    body: 'Usa la pestaña Reporte para crear incidentes desde campo: selecciona tipo, prioridad y ubicación. Puedes adjuntar fotos y trabajar sin conexión — se sincronizarán automáticamente.',
  },
  {
    key: 'sos',
    icon: '🚨',
    title: 'Botón de pánico SOS',
    body: 'En la pantalla de Inicio, el botón rojo SOS envía tu ubicación al centro de mando de inmediato. Mantén presionado 1 segundo para activarlo. Funciona sin conexión.',
  },
];

export default function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const flatListRef = useRef<FlatList<Step>>(null);

  function goToStep(index: number) {
    setCurrentStep(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }

  async function handleDone() {
    setCompleting(true);
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    } catch {
      // If storage fails, still complete onboarding
    }
    onDone();
    setCompleting(false);
  }

  const isLast = currentStep === STEPS.length - 1;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>

        {/* Swiper */}
        <FlatList
          ref={flatListRef}
          data={STEPS}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStep ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, completing && styles.buttonDisabled]}
            onPress={() => {
              if (isLast) {
                void handleDone();
              } else {
                goToStep(currentStep + 1);
              }
            }}
            disabled={completing}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {completing ? 'Cargando...' : isLast ? 'Comenzar' : 'Continuar →'}
            </Text>
          </TouchableOpacity>

          {!isLast && (
            <Text style={styles.stepIndicator}>
              {currentStep + 1} de {STEPS.length}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  container: { flex: 1, backgroundColor: '#0F172A' },
  skipButton: { position: 'absolute', top: 56, right: 24, zIndex: 10, padding: 8 },
  skipText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 160,
  },
  icon: { fontSize: 80, marginBottom: 32 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 20, lineHeight: 34 },
  body: { color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 26 },
  dotsRow: { position: 'absolute', bottom: 140, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#3B82F6', width: 24 },
  dotInactive: { backgroundColor: '#334155' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, paddingBottom: 48 },
  button: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  stepIndicator: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 16 },
});
