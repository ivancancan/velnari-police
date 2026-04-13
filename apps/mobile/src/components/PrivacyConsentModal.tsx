// apps/mobile/src/components/PrivacyConsentModal.tsx
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const CONSENT_KEY = 'velnari_privacy_consent';

export default function PrivacyConsentModal({ onAccept }: { onAccept: () => void }) {
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      await SecureStore.setItemAsync(CONSENT_KEY, new Date().toISOString());
      onAccept();
    } catch {
      onAccept();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Velnari Field</Text>
          <Text style={styles.title}>Aviso de Privacidad</Text>
          <Text style={styles.subtitle}>Conforme a la LFPDPPP</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>¿Qué datos recopilamos?</Text>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>📍</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Ubicación GPS en tiempo real</Text>
              <Text style={styles.itemDesc}>Tu posición se transmite al centro de mando durante el turno para coordinar despachos y registrar rutas de patrullaje.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>🔒</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Autenticación biométrica</Text>
              <Text style={styles.itemDesc}>La biometría (huella/Face ID) se usa localmente en el dispositivo para desbloquear la app. No se transmite a nuestros servidores.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>📋</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Reportes e imágenes de incidentes</Text>
              <Text style={styles.itemDesc}>Los informes que crees y las fotos que adjuntes se almacenan cifrados en servidores de Velnari ubicados en México.</Text>
            </View>
          </View>

          <View style={styles.item}>
            <Text style={styles.itemIcon}>🔔</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Notificaciones push</Text>
              <Text style={styles.itemDesc}>El identificador de notificaciones de tu dispositivo se almacena para enviarte alertas de despacho.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Tus derechos ARCO</Text>
          <Text style={styles.body}>
            Tienes derecho de Acceso, Rectificación, Cancelación y Oposición (ARCO) sobre tus datos personales. Para ejercerlos, contacta a tu administrador municipal o escríbenos a{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('mailto:privacidad@velnari.mx')}>
              privacidad@velnari.mx
            </Text>
            .
          </Text>

          <Text style={styles.body}>
            Al usar esta aplicación en el cumplimiento de tus funciones, el tratamiento de tus datos se realiza con base en la relación laboral y en la Ley General de Seguridad Pública.
          </Text>

          <TouchableOpacity onPress={() => Linking.openURL('https://velnari.mx/privacidad')}>
            <Text style={styles.policyLink}>Ver aviso de privacidad completo →</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptText}>{accepting ? 'Registrando...' : 'Acepto y continuar'}</Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Al aceptar, confirmas haber leído este aviso. Este registro se guarda en tu dispositivo.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  logo: { color: '#3B82F6', fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 14, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  item: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  itemIcon: { fontSize: 22, marginTop: 2 },
  itemText: { flex: 1 },
  itemTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemDesc: { color: '#94A3B8', fontSize: 13, lineHeight: 19 },
  body: { color: '#94A3B8', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  link: { color: '#3B82F6', textDecorationLine: 'underline' },
  policyLink: { color: '#3B82F6', fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#1E293B' },
  acceptButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  acceptButtonDisabled: { opacity: 0.5 },
  acceptText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  footerNote: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
