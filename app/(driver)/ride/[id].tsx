import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { rideService } from '../../../src/services/rideService';
import { Colors, Spacing, Radius } from '../../../src/types/theme';
import { RideResponse } from '../../../src/types/api';

export default function DriverRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<RideResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadRide();
    const interval = setInterval(loadRide, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRide = async () => {
    try {
      const data = await rideService.getRideDetails(id!);
      setRide(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'ONGOING' | 'COMPLETED' | 'CANCELLED') => {
    const labels = { ONGOING: 'démarrer', COMPLETED: 'terminer', CANCELLED: 'annuler' };
    Alert.alert(
      'Confirmer',
      `Voulez-vous ${labels[status]} cette course ?`,
      [
        { text: 'Annuler' },
        {
          text: 'Confirmer', onPress: async () => {
            setUpdating(true);
            try {
              await rideService.updateRideStatus(id!, status);
              await loadRide();
              if (status === 'COMPLETED' || status === 'CANCELLED') {
                Alert.alert('✅ Course terminée', 'Merci !', [
                  { text: 'Retour au radar', onPress: () => router.replace('/(driver)/dashboard') }
                ]);
              }
            } catch {
              Alert.alert('Erreur', 'Impossible de mettre à jour le statut.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}><ActivityIndicator color={Colors.orange} size="large" /></View>
    </SafeAreaView>
  );

  if (!ride) return null;

  const stateColor = ride.state === 'ONGOING' ? Colors.green : ride.state === 'COMPLETED' ? Colors.blue : Colors.orange;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(driver)/dashboard')}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Course Active</Text>
          <View style={[styles.stateBadge, { backgroundColor: `${stateColor}20` }]}>
            <Text style={[styles.stateText, { color: stateColor }]}>{ride.state}</Text>
          </View>
        </View>

        {/* Status banner */}
        <View style={[styles.statusBanner, ride.state === 'ONGOING' && styles.statusBannerGreen]}>
          <Ionicons
            name={ride.state === 'CREATED' ? 'navigate' : ride.state === 'ONGOING' ? 'car' : 'checkmark-circle'}
            size={24}
            color={ride.state === 'ONGOING' ? Colors.green : Colors.orange}
          />
          <View>
            <Text style={[styles.statusTitle, ride.state === 'ONGOING' && { color: Colors.green }]}>
              {ride.state === 'CREATED' ? 'En route vers le passager' :
               ride.state === 'ONGOING' ? 'Trajet en cours' : 'Course terminée'}
            </Text>
            <Text style={styles.statusSub}>
              {ride.state === 'CREATED' ? 'Rejoignez le point de départ' : 'Bon trajet !'}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <Text style={styles.cardLabel}>ITINÉRAIRE</Text>
          <View style={styles.routeRow}>
            <View style={styles.dotOrange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DÉPART</Text>
              <Text style={styles.routeText}>{ride.startPoint || '—'}</Text>
            </View>
          </View>
          <View style={styles.routeDash} />
          <View style={styles.routeRow}>
            <View style={styles.dotWhite} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DESTINATION</Text>
              <Text style={styles.routeText}>{ride.endPoint || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceCard}>
          <Text style={styles.cardLabel}>MONTANT</Text>
          <Text style={styles.priceValue}>{ride.price?.toLocaleString()} FCFA</Text>
        </View>

        {/* Actions */}
        {ride.state === 'CREATED' && (
          <TouchableOpacity
            style={[styles.btnOngoing, updating && { opacity: 0.6 }]}
            onPress={() => handleUpdateStatus('ONGOING')}
            disabled={updating}
          >
            {updating ? <ActivityIndicator color={Colors.dark} /> : (
              <>
                <Ionicons name="car" size={20} color={Colors.dark} />
                <Text style={styles.btnText}>Démarrer la course</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {ride.state === 'ONGOING' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btnComplete, updating && { opacity: 0.6 }]}
              onPress={() => handleUpdateStatus('COMPLETED')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color={Colors.dark} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.dark} />
                  <Text style={styles.btnText}>Terminer</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={() => handleUpdateStatus('CANCELLED')}
              disabled={updating}
            >
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.input, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: Colors.white, fontWeight: '900', fontSize: 18 },
  stateBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  stateText: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.orangeBg, borderRadius: Radius.lg, padding: Spacing.md,
  },
  statusBannerGreen: { backgroundColor: Colors.greenBg },
  statusTitle: { color: Colors.orange, fontWeight: '900', fontSize: 15 },
  statusSub: { color: Colors.textMuted, fontWeight: '600', fontSize: 12 },

  routeCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, gap: 4,
  },
  cardLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 3, marginBottom: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDash: { width: 2, height: 20, backgroundColor: Colors.cardBorder, marginLeft: 3 },
  dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange, marginTop: 14 },
  dotWhite: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white, marginTop: 14 },
  routeLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2 },
  routeText: { color: Colors.white, fontWeight: '700', fontSize: 14, lineHeight: 20 },

  priceCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center',
  },
  priceValue: { color: Colors.orange, fontWeight: '900', fontSize: 32, fontStyle: 'italic' },

  btnOngoing: {
    backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
  },
  btnComplete: {
    flex: 1, backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 4,
  },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  btnCancel: {
    backgroundColor: Colors.redBg, borderRadius: Radius.lg, paddingVertical: 18,
    paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { color: Colors.red, fontWeight: '900', fontSize: 13 },
});
