import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { userService } from '../../src/services/userService';
import { Colors, Spacing, Radius } from '../../src/types/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [changingPass, setChangingPass] = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);
  const [passData, setPassData] = useState({ current: '', next: '', confirm: '' });

  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/'); }
      }
    ]);
  };

  const handleChangePassword = async () => {
    if (!passData.current || !passData.next || !passData.confirm) {
      Alert.alert('Erreur', 'Remplissez tous les champs'); return;
    }
    if (passData.next !== passData.confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return;
    }
    setChangingPass(true);
    try {
      await userService.changePassword(passData.current, passData.next);
      Alert.alert('✅', 'Mot de passe mis à jour');
      setShowPassForm(false);
      setPassData({ current: '', next: '', confirm: '' });
    } catch {
      Alert.alert('Erreur', 'Impossible de changer le mot de passe.');
    } finally {
      setChangingPass(false);
    }
  };

  const MenuItem = ({ icon, label, onPress, danger = false }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? Colors.red : Colors.orange} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: Colors.red }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.heroCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
          <View style={styles.roleBadge}>
            <Ionicons name="person" size={12} color={Colors.orange} />
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMPTE</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="key" label="Changer de mot de passe" onPress={() => setShowPassForm(!showPassForm)} />
            <MenuItem icon="notifications" label="Notifications" onPress={() => {}} />
            <MenuItem icon="shield-checkmark" label="Sécurité" onPress={() => {}} />
          </View>
        </View>

        {/* Password form */}
        {showPassForm && (
          <View style={styles.passForm}>
            {(['current', 'next', 'confirm'] as const).map((f, i) => (
              <TextInput
                key={f}
                style={styles.passInput}
                placeholder={['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer'][i]}
                placeholderTextColor={Colors.textMuted}
                value={passData[f]}
                onChangeText={v => setPassData(p => ({ ...p, [f]: v }))}
                secureTextEntry
              />
            ))}
            <TouchableOpacity
              style={[styles.btnPrimary, changingPass && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={changingPass}
            >
              {changingPass
                ? <ActivityIndicator color={Colors.dark} />
                : <Text style={styles.btnText}>Mettre à jour</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPLICATION</Text>
          <View style={styles.menuGroup}>
            <MenuItem icon="help-circle" label="Aide & Support" onPress={() => {}} />
            <MenuItem icon="document-text" label="Conditions d'utilisation" onPress={() => {}} />
            <MenuItem icon="log-out" label="Déconnexion" onPress={handleLogout} danger />
          </View>
        </View>

        <Text style={styles.version}>RidnGo v1.0.0 — Yowyob Inc. Ltd.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
  heroCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, elevation: 8,
  },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 32 },
  name: { color: Colors.white, fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  email: { color: Colors.textSecondary, fontSize: 13 },
  phone: { color: Colors.textMuted, fontSize: 13 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, marginTop: 4,
  },
  roleText: { color: Colors.orange, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  section: { gap: 8 },
  sectionLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 3, paddingLeft: 4 },
  menuGroup: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeBg,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: Colors.redBg },
  menuLabel: { flex: 1, color: Colors.white, fontWeight: '700', fontSize: 14 },
  passForm: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    gap: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  passInput: {
    backgroundColor: Colors.input, borderRadius: Radius.md, padding: 14,
    color: Colors.white, fontWeight: '700', fontSize: 14,
    borderWidth: 1, borderColor: Colors.inputBorder,
  },
  btnPrimary: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  version: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', fontStyle: 'italic' },
});
