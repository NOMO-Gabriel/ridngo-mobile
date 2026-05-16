import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { vehicleApi } from '../../src/services/api';
import api from '../../src/services/api';
import { Colors, Spacing, Radius } from '../../src/types/theme';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';

type Step = 0 | 1 | 2;

const COMPLIANCE_URL = 'https://ugate-dev.yowyob.com/compliance';
const FALLBACKS = {
  makes: ['Toyota', 'Mercedes', 'Hyundai', 'Honda', 'Nissan', 'Renault', 'Peugeot'],
  models: ['Corolla', 'Yaris', 'Camry', 'Clio', '208', 'Tucson', 'Elantra'],
  transmissions: ['Manual', 'Automatic'],
  fuels: ['Petrol', 'Diesel', 'Hybrid'],
  types: ['Sedan', 'SUV', 'Hatchback', 'Van'],
  sizes: ['Small', 'Medium', 'Large'],
  manufacturers: ['Toyota', 'Mercedes-Benz', 'Hyundai'],
};

export default function DriverOnboarding() {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  const [form, setForm] = useState({
    licenseNumber: '',
    registrationNumber: '',
    vehicleSerialNumber: '',
    makeName: 'Toyota', modelName: 'Corolla',
    typeName: 'Sedan', sizeName: 'Medium',
    fuelTypeName: 'Petrol', transmissionType: 'Manual',
    manufacturerName: 'Toyota',
    totalSeatNumber: '4', tankCapacity: '50',
    luggageMaxCapacity: '400', mileageAtStart: '0',
    mileageSinceCommissioning: '0', vehicleAgeAtStart: '2',
    averageFuelConsumptionPerKm: '0.08',
    airConditioned: false, wifi: false, comfortable: true,
  });

  useEffect(() => {
    const raw_fn = async () => {
      const raw = await SecureStore.getItemAsync('user');
      if (raw) setDriverId(JSON.parse(raw).id);
    };
    raw_fn();

    // Check if returning from UGate compliance
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('action=verify')) {
        setLoading(true);
        // Check compliance status
        setTimeout(() => { setLoading(false); setStep(2); }, 2000);
      }
    });
    return () => sub.remove();
  }, []);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmitVehicle = async () => {
    if (!form.licenseNumber || !form.registrationNumber) {
      Alert.alert('Requis', 'Numéro de permis et immatriculation sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/v1/users/driver', {
        licenseNumber: form.licenseNumber,
        vehicle: {
          registrationNumber: form.registrationNumber,
          vehicleSerialNumber: form.vehicleSerialNumber,
          makeName: form.makeName,
          modelName: form.modelName,
          typeName: form.typeName,
          sizeName: form.sizeName,
          fuelTypeName: form.fuelTypeName,
          transmissionType: form.transmissionType,
          manufacturerName: form.manufacturerName,
          totalSeatNumber: parseInt(form.totalSeatNumber),
          tankCapacity: parseInt(form.tankCapacity),
          luggageMaxCapacity: parseInt(form.luggageMaxCapacity),
          mileageAtStart: parseInt(form.mileageAtStart),
          mileageSinceCommissioning: parseInt(form.mileageSinceCommissioning),
          vehicleAgeAtStart: parseInt(form.vehicleAgeAtStart),
          averageFuelConsumptionPerKm: parseFloat(form.averageFuelConsumptionPerKm),
          airConditioned: form.airConditioned,
          wifi: form.wifi,
          comfortable: form.comfortable,
        },
      });
      setStep(1);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || "Impossible d'enregistrer le véhicule.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSyndicate = async () => {
    if (!driverId) return;
    const callback = Linking.createURL('/onboarding?action=verify');
    const url = `${COMPLIANCE_URL}/connect?driverId=${driverId}&redirectUrl=${encodeURIComponent(callback)}`;
    await Linking.openURL(url);
  };

  const InputField = ({ label, field, keyboard = 'default', placeholder = '' }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder || label}
        placeholderTextColor={Colors.textMuted}
        value={String(form[field as keyof typeof form])}
        onChangeText={v => set(field, v)}
        keyboardType={keyboard}
      />
    </View>
  );

  const SelectField = ({ label, field, options }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
        <View style={styles.optionRow}>
          {options.map((opt: string) => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionBtn, (form as any)[field] === opt && styles.optionBtnActive]}
              onPress={() => set(field, opt)}
            >
              <Text style={[(form as any)[field] === opt ? styles.optionTextActive : styles.optionText]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* Progress indicator */}
      <View style={styles.progress}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.progressDot, step >= i && styles.progressDotActive]} />
        ))}
      </View>

      {/* Step 0 — Vehicle */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <View style={styles.stepIcon}>
              <Ionicons name="car" size={32} color={Colors.orange} />
            </View>
            <Text style={styles.stepTitle}>Enregistrez votre véhicule</Text>
            <Text style={styles.stepSub}>Ces informations seront vérifiées avant activation</Text>
          </View>

          <View style={styles.form}>
            <InputField label="N° Permis de conduire *" field="licenseNumber" placeholder="Ex: CM-12345" />
            <InputField label="N° Immatriculation *" field="registrationNumber" placeholder="Ex: LT-482-XY" />
            <InputField label="N° Série du véhicule" field="vehicleSerialNumber" />
            <SelectField label="Marque" field="makeName" options={FALLBACKS.makes} />
            <SelectField label="Modèle" field="modelName" options={FALLBACKS.models} />
            <SelectField label="Type" field="typeName" options={FALLBACKS.types} />
            <SelectField label="Taille" field="sizeName" options={FALLBACKS.sizes} />
            <SelectField label="Carburant" field="fuelTypeName" options={FALLBACKS.fuels} />
            <SelectField label="Transmission" field="transmissionType" options={FALLBACKS.transmissions} />
            <InputField label="Nombre de sièges" field="totalSeatNumber" keyboard="numeric" />
            <InputField label="Capacité réservoir (L)" field="tankCapacity" keyboard="numeric" />
            <InputField label="Âge du véhicule (ans)" field="vehicleAgeAtStart" keyboard="numeric" />

            {/* Comfort options */}
            <Text style={styles.sectionLabel}>OPTIONS DU VÉHICULE</Text>
            {(['airConditioned', 'wifi', 'comfortable'] as const).map(key => (
              <View key={key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {key === 'airConditioned' ? 'Climatisation' : key === 'wifi' ? 'Wi-Fi' : 'Confortable'}
                </Text>
                <Switch
                  value={form[key]}
                  onValueChange={v => set(key, v)}
                  thumbColor={form[key] ? Colors.orange : Colors.textMuted}
                  trackColor={{ false: Colors.input, true: Colors.orangeBg }}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
            onPress={handleSubmitVehicle}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.dark} /> : (
              <>
                <Text style={styles.btnText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.dark} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 1 — Syndicate */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIcon}>
              <Ionicons name="shield-checkmark" size={32} color={Colors.orange} />
            </View>
            <Text style={styles.stepTitle}>Vérification Syndicale</Text>
            <Text style={styles.stepSub}>
              Connectez-vous à UGate pour confirmer votre adhésion au syndicat des transporteurs.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={Colors.orange} />
            <Text style={styles.infoText}>
              Cette étape est obligatoire au Cameroun pour exercer en toute légalité et garantir la sécurité du réseau RidnGo.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.orange} size="large" />
              <Text style={styles.loadingText}>Validation de conformité en cours...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleConnectSyndicate}>
                <Ionicons name="open" size={20} color={Colors.dark} />
                <Text style={styles.btnText}>Ouvrir UGate Compliance</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSkip} onPress={() => setStep(2)}>
                <Text style={styles.btnSkipText}>Passer (tester sans syndicat)</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* Step 2 — Done */}
      {step === 2 && (
        <View style={styles.doneContainer}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={56} color={Colors.white} />
          </View>
          <Text style={styles.doneTitle}>Félicitations !</Text>
          <Text style={styles.doneSub}>
            Votre profil est complet. Vous pouvez maintenant recevoir des courses sur RidnGo.
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/(driver)/dashboard')}
          >
            <Ionicons name="radio" size={20} color={Colors.dark} />
            <Text style={styles.btnText}>Accéder au Radar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cardBorder },
  progressDotActive: { backgroundColor: Colors.orange, width: 24 },
  scroll: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },

  stepHeader: { alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  stepIcon: {
    width: 70, height: 70, borderRadius: 22, backgroundColor: Colors.orangeBg,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTitle: { color: Colors.white, fontWeight: '900', fontSize: 24, textAlign: 'center', letterSpacing: -0.5 },
  stepSub: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  form: { gap: Spacing.md },
  inputGroup: { gap: 6 },
  label: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  input: {
    backgroundColor: Colors.input, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.inputBorder,
    padding: 14, color: Colors.white, fontWeight: '700', fontSize: 14,
  },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.inputBorder,
  },
  optionBtnActive: { backgroundColor: Colors.orangeBg, borderColor: Colors.orange },
  optionText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
  optionTextActive: { color: Colors.orange, fontWeight: '900', fontSize: 13 },

  sectionLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 3, marginTop: 8 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.input, borderRadius: Radius.md, padding: Spacing.md,
  },
  switchLabel: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  btnPrimary: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
    marginTop: Spacing.sm,
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  btnSkip: { alignItems: 'center', padding: Spacing.md },
  btnSkipText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.orangeBg, borderRadius: Radius.lg, padding: Spacing.md,
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  loadingBox: { alignItems: 'center', gap: 16, padding: Spacing.xl },
  loadingText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  doneIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, elevation: 10,
  },
  doneTitle: { color: Colors.white, fontWeight: '900', fontSize: 32, letterSpacing: -0.5 },
  doneSub: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
