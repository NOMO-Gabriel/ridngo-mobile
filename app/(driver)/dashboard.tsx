import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { rideService } from '../../src/services/rideService';
import { driverService } from '../../src/services/userService';
import { Colors, Spacing, Radius } from '../../src/types/theme';
import { OfferResponse } from '../../src/types/api';
import * as ExpoLocation from 'expo-location';

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'price_desc' | 'price_asc'>('recent');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (geoRef.current) clearInterval(geoRef.current);
    };
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (geoRef.current) clearInterval(geoRef.current);
    if (isOnline) {
      fetchOffers();
      pollRef.current = setInterval(fetchOffers, 5000);
      startGPS();
    } else {
      setOffers([]);
    }
  }, [isOnline]);

  const loadData = async () => {
    try {
      const [profileRes, ride] = await Promise.all([
        driverService.getDriverProfile(),
        rideService.getCurrentRide(),
      ]);
      setProfile(profileRes);
      setIsOnline(profileRes?.driver?.isOnline || false);
      setCurrentRide(ride);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const data = await rideService.getAvailableOffers(0, 100);
      const unique = Array.from(new Map(data.map((o: OfferResponse) => [o.id, o])).values()) as OfferResponse[];
      setOffers(unique);
    } catch { /* silent */ }
  };

  const startGPS = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    geoRef.current = setInterval(async () => {
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      rideService.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
    }, 3000);
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const next = !isOnline;
      await driverService.toggleOnlineStatus(next);
      setIsOnline(next);
    } catch {
      Alert.alert('Erreur', 'Impossible de changer de statut.');
    } finally {
      setToggling(false);
    }
  };

  const sortedOffers = useMemo(() => {
    const list = [...offers];
    if (sortBy === 'price_desc') return list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortBy === 'price_asc') return list.sort((a, b) => (a.price || 0) - (b.price || 0));
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [offers, sortBy]);

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Chargement du radar...</Text>
      </View>
    </SafeAreaView>
  );

  const driverName = profile?.user?.firstName || user?.name?.split(' ')[0] || 'Chauffeur';
  const balance = profile?.wallet?.balance ?? 0;
  const vehicle = profile?.vehicle;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={sortedOffers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadData} tintColor={Colors.orange} />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <View style={styles.logoRow}>
                <View style={styles.logoBox}><Text style={styles.logoLetter}>R</Text></View>
                <View>
                  <Text style={styles.logoText}>RidnGo</Text>
                  <Text style={styles.driverTag}>CHAUFFEUR</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Active ride banner */}
            {currentRide && (
              <TouchableOpacity
                style={styles.activeBanner}
                onPress={() => router.push(`/(driver)/ride/${currentRide.id}`)}
              >
                <View style={styles.activeBannerLeft}>
                  <View style={styles.navPulse}>
                    <Ionicons name="navigate" size={20} color={Colors.white} />
                  </View>
                  <View>
                    <Text style={styles.activeBannerTag}>COURSE ACTIVE</Text>
                    <Text style={styles.activeBannerText}>
                      {currentRide.state === 'CREATED' ? 'Client en attente' : 'Trajet en cours'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            )}

            {/* Identity + Wallet cards */}
            <View style={styles.cardsRow}>
              {/* Identity card */}
              <View style={[styles.card, { flex: 2 }]}>
                <View style={styles.avatarRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{driverName[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
                    {vehicle && (
                      <Text style={styles.vehicleInfo} numberOfLines={1}>
                        {vehicle.makeName || vehicle.vehicleMakeName} {vehicle.modelName || vehicle.vehicleModelName}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Online toggle */}
                <TouchableOpacity
                  style={[styles.toggleBtn, isOnline && styles.toggleBtnOnline]}
                  onPress={toggleOnline}
                  disabled={toggling}
                >
                  {toggling
                    ? <ActivityIndicator size="small" color={isOnline ? Colors.dark : Colors.white} />
                    : <>
                      <View style={[styles.toggleDot, isOnline && styles.toggleDotOnline]} />
                      <Text style={[styles.toggleText, isOnline && styles.toggleTextOnline]}>
                        {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                      </Text>
                    </>
                  }
                </TouchableOpacity>
              </View>

              {/* Wallet card */}
              <View style={[styles.card, { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }]}>
                <View style={styles.walletIcon}>
                  <Ionicons name="wallet" size={20} color={Colors.orange} />
                </View>
                <Text style={styles.walletBalance}>{balance.toLocaleString()}</Text>
                <Text style={styles.walletCurrency}>FCFA</Text>
              </View>
            </View>

            {/* Radar header + sort */}
            <View style={styles.radarHeader}>
              <View>
                <Text style={styles.radarTitle}>
                  {isOnline ? `${sortedOffers.length} demandes` : 'Radar désactivé'}
                </Text>
                <Text style={styles.radarSub}>
                  {isOnline ? 'Passez en ligne pour voir les offres' : 'Activez le radar pour voir les courses'}
                </Text>
              </View>
              {isOnline && (
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() => {
                    if (sortBy === 'recent') setSortBy('price_desc');
                    else if (sortBy === 'price_desc') setSortBy('price_asc');
                    else setSortBy('recent');
                  }}
                >
                  <Ionicons name="funnel" size={14} color={Colors.orange} />
                  <Text style={styles.sortText}>
                    {sortBy === 'recent' ? 'Récent' : sortBy === 'price_desc' ? 'Prix ↓' : 'Prix ↑'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          isOnline ? (
            <View style={styles.emptyRadar}>
              <Ionicons name="radio" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Radar actif — en attente de courses</Text>
            </View>
          ) : (
            <View style={styles.emptyRadar}>
              <Ionicons name="radio-button-off" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Activez le radar pour recevoir des courses</Text>
            </View>
          )
        }
        renderItem={({ item }: { item: OfferResponse }) => (
          <TouchableOpacity
            style={styles.offerCard}
            onPress={() => router.push(`/(driver)/offers/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.offerTop}>
              <View style={styles.offerRoute}>
                <View style={styles.routeRow}>
                  <View style={styles.dotOrange} />
                  <Text style={styles.routeText} numberOfLines={1}>{item.startPoint}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                  <View style={styles.dotWhite} />
                  <Text style={styles.routeText} numberOfLines={1}>{item.endPoint}</Text>
                </View>
              </View>
              <View style={styles.offerPriceBox}>
                <Text style={styles.offerPrice}>{item.price?.toLocaleString()}</Text>
                <Text style={styles.offerPriceCurrency}>FCFA</Text>
              </View>
            </View>
            <View style={styles.offerFooter}>
              {item.distance && (
                <View style={styles.offerMeta}>
                  <Ionicons name="navigate" size={12} color={Colors.textMuted} />
                  <Text style={styles.offerMetaText}>{item.distance.toFixed(1)} km</Text>
                </View>
              )}
              {item.createdAt && (
                <Text style={styles.offerTime}>
                  {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              <View style={styles.applyBtn}>
                <Text style={styles.applyText}>Voir</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.orange} />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textMuted, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  header: { gap: Spacing.md, marginBottom: Spacing.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 38, height: 38, backgroundColor: Colors.orange, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: Colors.white, fontWeight: '900', fontSize: 18, fontStyle: 'italic' },
  logoText: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  driverTag: { color: Colors.orange, fontWeight: '900', fontSize: 9, letterSpacing: 2 },
  logoutBtn: { padding: 6 },

  activeBanner: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
  },
  activeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navPulse: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  activeBannerTag: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 9, letterSpacing: 2 },
  activeBannerText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

  cardsRow: { flexDirection: 'row', gap: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  driverName: { color: Colors.white, fontWeight: '900', fontSize: 14 },
  vehicleInfo: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  toggleBtnOnline: { backgroundColor: Colors.greenBg },
  toggleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  toggleDotOnline: { backgroundColor: Colors.green },
  toggleText: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  toggleTextOnline: { color: Colors.green },

  walletIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
  walletBalance: { color: Colors.white, fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
  walletCurrency: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2 },

  radarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  radarTitle: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  radarSub: { color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full },
  sortText: { color: Colors.orange, fontWeight: '900', fontSize: 11 },

  emptyRadar: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13, textAlign: 'center' },

  offerCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12 },
  offerTop: { flexDirection: 'row', gap: 12 },
  offerRoute: { flex: 1, gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeLine: { width: 2, height: 10, backgroundColor: Colors.cardBorder, marginLeft: 3 },
  dotOrange: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.orange },
  dotWhite: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  routeText: { flex: 1, color: Colors.white, fontWeight: '600', fontSize: 13 },
  offerPriceBox: { alignItems: 'flex-end', justifyContent: 'center' },
  offerPrice: { color: Colors.orange, fontWeight: '900', fontSize: 20, fontStyle: 'italic' },
  offerPriceCurrency: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  offerFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerMetaText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
  offerTime: { flex: 1, color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applyText: { color: Colors.orange, fontWeight: '900', fontSize: 12 },
});
