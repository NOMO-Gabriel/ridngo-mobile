import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { userService } from '../../src/services/userService';
import { Spacing, Radius } from '../../src/types/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { Colors, isDark, toggleTheme } = useTheme();
  const [showPassForm, setShowPassForm] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passData, setPassData] = useState({ current: '', next: '', confirm: '' });
  const [notifCount, setNotifCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await userService.getMe();
      setProfileData(data);
      // Load unread notifications count
      const notifs = await userService.getNotifications(0, 20);
      const unread = Array.isArray(notifs) ? notifs.filter((n: any) => !n.read).length : 0;
      setNotifCount(unread);
    } catch { /* ignore */ }
    finally { setLoadingProfile(false); }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } }
    ]);
  };

  const handleChangePassword = async () => {
    if (!passData.current || !passData.next || !passData.confirm) {
      Alert.alert('Erreur', 'Remplissez tous les champs'); return;
    }
    if (passData.next !== passData.confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return;
    }
    if (passData.next.length < 6) {
      Alert.alert('Erreur', 'Minimum 6 caractères'); return;
    }
    setChangingPass(true);
    try {
      await userService.changePassword(passData.current, passData.next);
      Alert.alert('✅', 'Mot de passe mis à jour avec succès');
      setShowPassForm(false);
      setPassData({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de changer le mot de passe.');
    } finally { setChangingPass(false); }
  };

  const displayName = profileData
    ? `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.username
    : user?.name || '—';
  const displayEmail = profileData?.email || user?.email || '—';
  const displayPhone = profileData?.telephone || user?.phone || '—';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Avatar hero */}
        <View style={[styles.heroCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={[styles.name, { color: Colors.text }]}>{displayName}</Text>
          <Text style={[styles.email, { color: Colors.textSecondary }]}>{displayEmail}</Text>
          {displayPhone !== '—' && (
            <Text style={[styles.phone, { color: Colors.textMuted }]}>{displayPhone}</Text>
          )}
          <View style={[styles.roleBadge, { backgroundColor: Colors.orangeBg }]}>
            <Ionicons name="person" size={12} color={Colors.orange} />
            <Text style={[styles.roleText, { color: Colors.orange }]}>PASSAGER</Text>
          </View>
        </View>

        {/* Apparence */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: Colors.textMuted }]}>APPARENCE</Text>
          <View style={[styles.menuGroup, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            <View style={[styles.menuItem, { borderBottomColor: Colors.cardBorder }]}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.orangeBg }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={Colors.orange} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>
                {isDark ? 'Mode sombre' : 'Mode clair'}
              </Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                thumbColor={isDark ? Colors.orange : Colors.textMuted}
                trackColor={{ false: Colors.input, true: Colors.orangeBg }}
              />
            </View>
          </View>
        </View>

        {/* Compte */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: Colors.textMuted }]}>MON COMPTE</Text>
          <View style={[styles.menuGroup, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: Colors.cardBorder }]}
              onPress={() => setShowPassForm(!showPassForm)}
            >
              <View style={[styles.menuIcon, { backgroundColor: Colors.orangeBg }]}>
                <Ionicons name="key" size={18} color={Colors.orange} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Changer le mot de passe</Text>
              <Ionicons name={showPassForm ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            {showPassForm && (
              <View style={[styles.passForm, { borderTopColor: Colors.cardBorder }]}>
                {([
                  { key: 'current', label: 'Mot de passe actuel' },
                  { key: 'next', label: 'Nouveau mot de passe' },
                  { key: 'confirm', label: 'Confirmer' },
                ] as const).map(f => (
                  <TextInput
                    key={f.key}
                    style={[styles.passInput, { backgroundColor: Colors.input, color: Colors.text, borderColor: Colors.inputBorder }]}
                    placeholder={f.label}
                    placeholderTextColor={Colors.textMuted}
                    value={passData[f.key]}
                    onChangeText={v => setPassData(p => ({ ...p, [f.key]: v }))}
                    secureTextEntry
                    autoCorrect={false}
                  />
                ))}
                <TouchableOpacity
                  style={[styles.passBtn, changingPass && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={changingPass}
                >
                  {changingPass ? <ActivityIndicator color="#0D0D0D" size="small" /> : (
                    <Text style={styles.passBtnText}>Mettre à jour</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: Colors.cardBorder }]}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.orangeBg }]}>
                <Ionicons name="notifications" size={18} color={Colors.orange} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Notifications</Text>
              {notifCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notifCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: Colors.cardBorder }]}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.orangeBg }]}>
                <Ionicons name="help-circle" size={18} color={Colors.orange} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Aide & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: 'transparent' }]} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.redBg }]}>
                <Ionicons name="log-out" size={18} color={Colors.red} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.red }]}>Déconnexion</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.version, { color: Colors.textMuted }]}>RidnGo v1.0.0 — Yowyob Inc. Ltd.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
  heroCard: {
    borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#FF8C00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, elevation: 8,
  },
  avatarText: { color: 'white', fontWeight: '900', fontSize: 30 },
  name: { fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  email: { fontSize: 13, fontWeight: '500' },
  phone: { fontSize: 13, fontWeight: '500' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  roleText: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  section: { gap: 8 },
  sectionLabel: { fontWeight: '900', fontSize: 10, letterSpacing: 3, paddingLeft: 4 },
  menuGroup: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md, borderBottomWidth: 1 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontWeight: '700', fontSize: 14 },
  badge: { backgroundColor: '#FF8C00', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: 'white', fontWeight: '900', fontSize: 10 },
  passForm: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1 },
  passInput: { borderRadius: Radius.md, padding: 14, fontWeight: '700', fontSize: 14, borderWidth: 1 },
  passBtn: { backgroundColor: '#FF8C00', borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  passBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  version: { fontSize: 11, textAlign: 'center', fontStyle: 'italic' },
});