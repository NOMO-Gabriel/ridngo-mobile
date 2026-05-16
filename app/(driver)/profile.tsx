import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { driverService } from '../../src/services/userService';
import { Colors, Spacing, Radius } from '../../src/types/theme';

export default function DriverProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await driverService.getDriverProfile();
      setProfile(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } }
    ]);
  };

  const vehicle = profile?.vehicle;
  const driver = profile?.driver;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.driverBadge}>
            <Ionicons name="car-sport" size={12} color={Colors.dark} />
            <Text style={styles.driverBadgeText}>CHAUFFEUR CERTIFIÉ</Text>
          </View>
          {driver?.isOnline !== undefined && (
            <View style={[styles.onlineBadge, driver.isOnline ? styles.onlineBadgeGreen : styles.onlineBadgeGray]}>
              <View style={[styles.onlineDot, driver.isOnline && styles.onlineDotGreen]} />
              <Text style={[styles.onlineText, driver.isOnline && { color: Colors.green }]}>
                {driver.isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
              </Text>
            </View>
          )}
        </View>

        {/* Vehicle info */}
        {vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MON VÉHICULE</Text>
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleIcon}>
                <Ionicons name="car" size={24} color={Colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>
                  {vehicle.makeName || vehicle.vehicleMakeName} {vehicle.modelName || vehicle.vehicleModelName}
                </Text>
                <Text style={styles.vehiclePlate}>
                  {vehicle.registrationNumber || 'Plaque non définie'}
                </Text>
              </View>
            </View>
            <View style={styles.vehicleDetails}>
              {[
                { icon: 'people', label: 'Sièges', val: vehicle.totalSeatNumber },
                { icon: 'flash', label: 'Carburant', val: vehicle.fuelTypeName || vehicle.fuelTypeName_ },
                { icon: 'settings', label: 'Transmission', val: vehicle.transmissionType || vehicle.transmissionTypeName },
              ].map((item, i) => item.val && (
                <View key={i} style={styles.detailChip}>
                  <Ionicons name={item.icon as any} size={14} color={Colors.orange} />
                  <Text style={styles.detailText}>{item.label}: {item.val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Wallet */}
        {profile?.wallet && (
          <View style={styles.walletCard}>
            <View style={styles.walletLeft}>
              <Ionicons name="wallet" size={20} color={Colors.orange} />
              <Text style={styles.walletLabel}>Solde du portefeuille</Text>
            </View>
            <Text style={styles.walletBalance}>{profile.wallet.balance?.toLocaleString()} FCFA</Text>
          </View>
        )}

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMPTE</Text>
          <View style={styles.menuGroup}>
            {[
              { icon: 'car', label: "Modifier le véhicule", onPress: () => router.push('/(driver)/onboarding') },
              { icon: 'notifications', label: 'Notifications', onPress: () => {} },
              { icon: 'help-circle', label: 'Aide & Support', onPress: () => {} },
              { icon: 'log-out', label: 'Déconnexion', onPress: handleLogout, danger: true },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress}>
                <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                  <Ionicons name={item.icon as any} size={18} color={item.danger ? Colors.red : Colors.orange} />
                </View>
                <Text style={[styles.menuLabel, item.danger && { color: Colors.red }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
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
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, elevation: 8,
  },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 32 },
  name: { color: Colors.white, fontWeight: '900', fontSize: 22 },
  email: { color: Colors.textSecondary, fontSize: 13 },
  driverBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orange, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  driverBadgeText: { color: Colors.dark, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.input, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  onlineBadgeGreen: { backgroundColor: Colors.greenBg },
  onlineBadgeGray: {},
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  onlineDotGreen: { backgroundColor: Colors.green },
  onlineText: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  section: { gap: 8 },
  sectionLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 3, paddingLeft: 4 },
  vehicleCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  vehicleIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { color: Colors.white, fontWeight: '900', fontSize: 15 },
  vehiclePlate: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
  vehicleDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.input, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
  },
  detailText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  walletCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletLabel: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  walletBalance: { color: Colors.orange, fontWeight: '900', fontSize: 20, fontStyle: 'italic' },
  menuGroup: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  menuIconDanger: { backgroundColor: Colors.redBg },
  menuLabel: { flex: 1, color: Colors.white, fontWeight: '700', fontSize: 14 },
  version: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', fontStyle: 'italic' },
});
