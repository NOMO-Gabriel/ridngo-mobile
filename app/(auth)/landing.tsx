import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { Spacing, Radius } from '../../src/types/theme';

export default function LandingScreen() {
  const { Colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.blob1, { backgroundColor: 'rgba(255,140,0,0.12)' }]} />
      <View style={[styles.blob2, { backgroundColor: 'rgba(59,130,246,0.08)' }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
            <Text style={[styles.logoText, { color: Colors.text }]}>RidnGo</Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.orangeBg }]}>
            <Ionicons name="car" size={64} color={Colors.orange} />
          </View>
          <Text style={[styles.tag, { color: Colors.orange }]}>AFRICA'S FREEDOM MOVE</Text>
          <Text style={[styles.headline, { color: Colors.text }]}>
            Votre course,{'\n'}vos règles.
          </Text>
          <Text style={[styles.subhead, { color: Colors.textSecondary }]}>
            Mise en relation directe avec des chauffeurs certifiés au Cameroun. Prix transparents, sécurité totale.
          </Text>

          <View style={styles.features}>
            {[
              { icon: 'shield-checkmark', label: 'Chauffeurs certifiés' },
              { icon: 'cash', label: 'Prix négociables' },
              { icon: 'flash', label: 'Rapide & fiable' },
            ].map((f, i) => (
              <View key={i} style={[styles.feature, { backgroundColor: Colors.orangeBg }]}>
                <Ionicons name={f.icon as any} size={16} color={Colors.orange} />
                <Text style={[styles.featureText, { color: Colors.orange }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/login')} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Se connecter</Text>
            <Ionicons name="arrow-forward" size={20} color="#0D0D0D" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnSecondary, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'passenger' } })}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnSecondaryText, { color: Colors.text }]}>Créer un compte passager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'driver' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="car-sport" size={16} color={Colors.orange} />
            <Text style={[styles.btnGhostText, { color: Colors.orange }]}>Devenir chauffeur</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: Colors.textMuted }]}>© 2026 Yowyob Inc. Ltd. — Yaoundé, Cameroun</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.lg },
  blob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -80, left: -80 },
  blob2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, bottom: -60, right: -60 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 40, height: 40, backgroundColor: '#FF8C00', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#FFFFFF', fontWeight: '900', fontSize: 20, fontStyle: 'italic' },
  logoText: { fontWeight: '900', fontSize: 24, letterSpacing: -0.5 },
  heroSection: { flex: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  iconContainer: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  tag: { fontWeight: '900', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: Spacing.sm },
  headline: { fontWeight: '900', fontSize: 38, lineHeight: 44, letterSpacing: -1, marginBottom: Spacing.md },
  subhead: { fontSize: 15, lineHeight: 22, fontWeight: '500', marginBottom: Spacing.xl },
  features: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full },
  featureText: { fontWeight: '700', fontSize: 12 },
  ctas: { gap: Spacing.md, paddingBottom: Spacing.lg },
  btnPrimary: {
    backgroundColor: '#FF8C00', borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnPrimaryText: { color: '#0D0D0D', fontWeight: '900', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' },
  btnSecondary: { borderRadius: Radius.lg, paddingVertical: 18, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontWeight: '900', fontSize: 14 },
  btnGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  btnGhostText: { fontWeight: '900', fontSize: 13 },
  footer: { fontSize: 9, textAlign: 'center', paddingBottom: Spacing.md },
});