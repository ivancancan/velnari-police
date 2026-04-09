import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHECKLIST_ITEMS = [
  { id: 'radio', label: 'Radio operativo', icon: '\uD83D\uDCFB' },
  { id: 'weapon', label: 'Arma de cargo verificada', icon: '\uD83D\uDD2B' },
  { id: 'vehicle', label: 'Veh\u00edculo revisado', icon: '\uD83D\uDE94' },
  { id: 'gps', label: 'GPS activado', icon: '\uD83D\uDCCD' },
  { id: 'uniform', label: 'Uniforme completo', icon: '\uD83D\uDC6E' },
  { id: 'bodycam', label: 'C\u00e1mara corporal activa', icon: '\uD83D\uDCF9' },
];

const STORAGE_KEY = 'shift_checklist';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ChecklistScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const data = JSON.parse(val);
          if (data.date === todayKey()) {
            setChecked(data.items ?? {});
            setCompleted(data.completed ?? false);
          }
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const toggle = (id: string) => {
    if (completed) return;
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    Vibration.vibrate(30);
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: todayKey(), items: next, completed: false }),
    );
  };

  const allChecked = CHECKLIST_ITEMS.every((item) => checked[item.id]);

  const confirmShift = () => {
    const data = { date: todayKey(), items: checked, completed: true };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setCompleted(true);
    Vibration.vibrate(200);
    Alert.alert('Turno iniciado', 'Checklist completado correctamente.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Checklist de Turno</Text>
      <Text style={styles.subtitle}>
        {completed
          ? 'Turno iniciado correctamente'
          : 'Verifica cada elemento antes de iniciar tu turno'}
      </Text>

      <View style={styles.list}>
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = !!checked[item.id];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.item, isChecked && styles.itemChecked]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
              disabled={completed}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={[styles.label, isChecked && styles.labelChecked]}>
                {item.label}
              </Text>
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {!completed && (
        <TouchableOpacity
          style={[styles.button, !allChecked && styles.buttonDisabled]}
          onPress={confirmShift}
          disabled={!allChecked}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Iniciar turno</Text>
        </TouchableOpacity>
      )}

      {completed && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedIcon}>{'\u2705'}</Text>
          <Text style={styles.completedText}>Checklist completado hoy</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  list: {
    gap: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 68,
  },
  itemChecked: {
    borderColor: '#22C55E',
    backgroundColor: '#0F2A1B',
  },
  icon: {
    fontSize: 28,
    marginRight: 16,
  },
  label: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  labelChecked: {
    color: '#22C55E',
  },
  checkbox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  completedBanner: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F2A1B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  completedIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  completedText: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '600',
  },
});
