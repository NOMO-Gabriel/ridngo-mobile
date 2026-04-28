import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { rideService } from '../../../src/services/rideService';
import { Colors, Spacing, Radius } from '../../../src/types/theme';
import { OfferResponse } from '../../../src/types/api';
import * as SecureStore from 'expo-secure-store';

export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    loadOffer();
    loadDriverId();
  }, []);

  const loadDriverId = async () => {
    const raw = await SecureStore.getItemAsync('user');
    if (raw) setDriverId(JSON.parse(raw).id);
  };

  const loadOffer = async () => {
    try {
      const data = await rideService.getOfferById(id!);
      setOffer(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger cette offre.', [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await rideService.applyToOffer(id!);
      setApplied(true);
      Alert.alert('✅ Candidature envoyée', 'Le passager va choisir son chauffeur. Restez en ligne !');
      await loadOffer();
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || "Impossible de postuler à cette offre.");
    } finally {
      setApplying(false);
    }
  };

  const handleAccept = async () => {
    if (!driverId) return;
    setAccepting(true);
    try {
      const ride = await rideService.driverAccepts(id!, driverId);
      Alert.alert('🚗 Course démarrée !', 'Rendez-vous chez le passager.', [
        { text: 'Voir la course', onPress: () => router.replace(`/(driver)/ride/${ride.id}`) }
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || "Impossible d'accepter cette course.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    </SafeAreaView>
  );

  if (!offer) return null;

  const isSelected = offer.state === 'DRIVER_SELECTED';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détail de l'offre</Text>
          <View style={styles.stateBadge}>
            <Text style={styles.stateText}>{offer.state}</Text>
          </View>
        </View>

        {/* Price hero */}
        <View style={styles.priceHero}>
          <Text style={styles.priceTag}>PRIX PROPOSÉ</Text>
          <Text style={styles.priceValue}>{offer.price?.toLocaleString()} <Text style={styles.priceCurrency}>FCFA</Text></Text>
          {offer.distance && <Text style={styles.priceDistance}>{offer.distance.toFixed(1)} km estimés</Text>}
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.dotOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DÉPART</Text>
              <Text style={styles.routeText}>{offer.startPoint}</Text>
            </View>
          </View>
          <View style={styles.routeDash} />
          <View style={styles.routeRow}>
            <View style={styles.dotWhite} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DESTINATION</Text>
              <Text style={styles.routeText}>{offer.endPoint}</Text>
            </View>
          </View>
        </View>

        {/* Infos */}
        {offer.passengerPhone && (
          <View style={styles.infoCard}>
            <Ionicons name="call" size={18} color={Colors.orange} />
            <View>
              <Text style={styles.infoLabel}>CONTACT PASSAGER</Text>
              <Text style={styles.infoValue}>{offer.passengerPhone}</Text>
            </View>
          </View>
        )}

        {offer.createdAt && (
          <View style={styles.infoCard}>
            <Ionicons name="time" size={18} color={Colors.orange} />
            <View>
              <Text style={styles.infoLabel}>PUBLIÉ À</Text>
              <Text style={styles.infoValue}>
                {new Date(offer.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}

        {/* Proposals count */}
        {offer.proposals && (
          <View style={styles.infoCard}>
            <Ionicons name="people" size={18} color={Colors.orange} />
            <View>
              <Text style={styles.infoLabel}>CANDIDATURES</Text>
              <Text style={styles.infoValue}>{offer.proposals.length} chauffeur(s) ont postulé</Text>
            </View>
          </View>
        )}

        {/* Notice if selected */}
        {isSelected && (
          <View style={styles.selectedNotice}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
            <Text style={styles.selectedText}>Le passager vous a sélectionné ! Confirmez la course.</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer action */}
      <View style={styles.footer}>
        {isSelected ? (
          <TouchableOpacity
            style={[styles.btnAccept, accepting && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting
              ? <ActivityIndicator color={Colors.dark} />
              : <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.dark} />
                <Text style={styles.btnText}>Accepter la course</Text>
              </>
            }
          </TouchableOpacity>
        ) : applied ? (
          <View style={styles.appliedBanner}>
            <Ionicons name="radio" size={18} color={Colors.orange} />
            <Text style={styles.appliedText}>Candidature envoyée — en attente du passager</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btnApply, applying && { opacity: 0.6 }]}
            onPress={handleApply}
            disabled={applying}
          >
            {applying
              ? <ActivityIndicator color={Colors.dark} />
              : <>
                <Ionicons name="hand-right" size={20} color={Colors.dark} />
                <Text style={styles.btnText}>Postuler à cette course</Text>
              </>
            }
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.input, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: Colors.white, fontWeight: '900', fontSize: 18 },
  stateBadge: { backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  stateText: { color: Colors.orange, fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  priceHero: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, gap: 6,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, elevation: 4,
  },
  priceTag: { color: Colors.orange, fontWeight: '900', fontSize: 10, letterSpacing: 3 },
  priceValue: { color: Colors.white, fontWeight: '900', fontSize: 48, letterSpacing: -1, fontStyle: 'italic' },
  priceCurrency: { fontSize: 20, color: Colors.textMuted },
  priceDistance: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },

  routeCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, gap: 4,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDash: { width: 2, height: 20, backgroundColor: Colors.cardBorder, marginLeft: 3 },
  dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange, marginTop: 14 },
  dotWhite: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white, marginTop: 14 },
  routeLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  routeText: { color: Colors.white, fontWeight: '700', fontSize: 14, lineHeight: 20 },

  infoCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  infoLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2 },
  infoValue: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  selectedNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.greenBg, borderRadius: Radius.lg, padding: Spacing.md,
  },
  selectedText: { flex: 1, color: Colors.green, fontWeight: '700', fontSize: 13 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, backgroundColor: Colors.dark,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  btnApply: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
  },
  btnAccept: {
    backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
  appliedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.orangeBg, borderRadius: Radius.lg, padding: Spacing.md, justifyContent: 'center',
  },
  appliedText: { color: Colors.orange, fontWeight: '700', fontSize: 13 },
});
