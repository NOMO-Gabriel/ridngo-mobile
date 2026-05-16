import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, Radius } from '../../src/types/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    const result = await login(identifier.trim(), password);
    setLoading(false);
    if (result.success) {
      router.replace('/');
    } else {
      Alert.alert('Erreur de connexion', result.message || 'Identifiants invalides.');
    }
  };

  const onChangeIdentifier = useCallback((v: string) => setIdentifier(v), []);
  const onChangePassword = useCallback((v: string) => setPassword(v), []);
  const togglePass = useCallback(() => setShowPass(p => !p), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
            <Text style={styles.logoText}>RidnGo</Text>
          </View>

          <Text style={styles.title}>Bon retour 👋</Text>
          <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email / Téléphone / Pseudo</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Votre identifiant"
                  placeholderTextColor={Colors.textMuted}
                  value={identifier}
                  onChangeText={onChangeIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Votre mot de passe"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={onChangePassword}
                  secureTextEntry={!showPass}
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={togglePass} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.dark} />
              ) : (
                <>
                  <Text style={styles.btnText}>Se connecter</Text>
                  <Ionicons name="arrow-forward" size={20} color={Colors.dark} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'passenger' } })}>
              <Text style={styles.footerLink}>S'inscrire</Text>
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
  back: { marginBottom: Spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.xl },
  logoBox: { width: 36, height: 36, backgroundColor: Colors.orange, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: Colors.white, fontWeight: '900', fontSize: 18, fontStyle: 'italic' },
  logoText: { color: Colors.white, fontWeight: '900', fontSize: 20 },
  title: { color: Colors.white, fontWeight: '900', fontSize: 32, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginBottom: Spacing.xl },
  form: { gap: Spacing.md },
  inputGroup: { gap: 6 },
  label: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.input, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: Colors.white, fontWeight: '700', fontSize: 15, paddingVertical: 16 },
  eyeBtn: { padding: 4 },
  forgotRow: { alignItems: 'flex-end' },
  forgotText: { color: Colors.orange, fontWeight: '700', fontSize: 13 },
  btnPrimary: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: Spacing.sm,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.orange, fontWeight: '900', fontSize: 14 },
});