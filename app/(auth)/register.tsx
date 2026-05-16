import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../../src/services/auth';
import { Colors, Spacing, Radius } from '../../src/types/theme';

export default function RegisterScreen() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const isDriver = role === 'driver';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photo, setPhoto] = useState<any>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const handleRegister = async () => {
    if (!username || !email || !password || !firstName || !lastName || !phone) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      const result = await authService.register({
        username, email, password, phone, firstName, lastName,
        role: isDriver ? 'RIDE_AND_GO_DRIVER' : 'RIDE_AND_GO_PASSENGER',
        photo,
      });
      if (result.success) {
        if (isDriver) router.replace('/(driver)/onboarding');
        else router.replace('/(passenger)/ride');
      } else {
        Alert.alert('Erreur inscription', result.message || "Erreur lors de l'inscription.");
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Une erreur inattendue s'est produite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.badge, isDriver && styles.badgeDriver]}>
              <Ionicons name={isDriver ? 'car-sport' : 'person'} size={14} color={isDriver ? Colors.dark : Colors.white} />
              <Text style={[styles.badgeText, isDriver && { color: Colors.dark }]}>
                {isDriver ? 'CHAUFFEUR' : 'PASSAGER'}
              </Text>
            </View>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              {isDriver ? 'Rejoignez le réseau de chauffeurs RidnGo' : 'Réservez vos courses facilement'}
            </Text>
          </View>

          {/* Photo picker */}
          <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={28} color={Colors.textMuted} />
                <Text style={styles.photoText}>Photo (optionnel)</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Fields */}
          <View style={styles.form}>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prénom *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jean"
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nom *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dupont"
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Pseudo *</Text>
              <TextInput
                style={styles.input}
                placeholder="jean.dupont"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="jean@email.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text style={styles.label}>Téléphone *</Text>
              <TextInput
                style={styles.input}
                placeholder="+237 6XX XXX XXX"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                blurOnSubmit={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text style={styles.label}>Mot de passe *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="Min. 6 caractères"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Confirmer *</Text>
              <TextInput
                style={styles.input}
                placeholder="Répétez le mot de passe"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.dark} />
            ) : (
              <>
                <Text style={styles.btnText}>Créer mon compte</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.dark} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  back: { marginBottom: Spacing.md },
  header: { marginBottom: Spacing.lg, gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  badgeDriver: { backgroundColor: Colors.orange },
  badgeText: { color: Colors.white, fontWeight: '900', fontSize: 10, letterSpacing: 2 },
  title: { color: Colors.white, fontWeight: '900', fontSize: 28, letterSpacing: -0.5 },
  subtitle: { color: Colors.textSecondary, fontSize: 14 },
  photoPicker: { alignSelf: 'center', marginBottom: Spacing.lg },
  photoPreview: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.orange },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.input,
    borderWidth: 2, borderColor: Colors.inputBorder, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoText: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  form: { gap: Spacing.md, marginBottom: Spacing.lg },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  label: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.input, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: Spacing.md,
  },
  input: {
    backgroundColor: Colors.input, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: Colors.white, fontWeight: '700', fontSize: 14,
  },
  eyeBtn: { padding: 8 },
  btnPrimary: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    marginBottom: Spacing.lg,
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.orange, fontWeight: '900', fontSize: 14 },
});