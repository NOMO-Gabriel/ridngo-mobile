/**
 * app/(driver)/my-rides.tsx
 * Onglet "Mes offres / Trips" du chauffeur.
 *
 * Section 1 — OFFRES SÉLECTIONNÉES (DRIVER_SELECTED)
 *   Bouton CONFIRMER → POST /api/v1/offers/{id}/accept?driverId={id}
 *   → retire l'offre, crée le trip, redirige vers ride/[id]
 *
 * Section 2 — TRIPS ACTIFS (CREATED / ONGOING)
 *   Récupérés depuis SecureStore 'activeTrips'
 *   → bouton REPRENDRE → ride/[id]
 *
 * Section 3 — HISTORIQUE (COMPLETED)
 *   GET /api/v1/trips/driver/{driverId}/history
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { rideService } from '../../src/services/rideService';
import { driverService } from '../../src/services/userService';
import { Spacing, Radius } from '../../src/types/theme';
import { OfferResponse, RideResponse } from '../../src/types/api';

function formatDateTime(iso?: string) {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--'; }
}

export default function MyRidesScreen() {
  const { user } = useAuth();
  const { Colors } = useTheme();

  const [selectedOffers, setSelectedOffers] = useState<OfferResponse[]>([]);
  const [activeTrips, setActiveTrips]       = useState<RideResponse[]>([]);
  const [history, setHistory]               = useState<RideResponse[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [confirming, setConfirming]         = useState<string | null>(null);
  const [driverId, setDriverId]             = useState<string | null>(null);
  const [tab, setTab]                       = useState<'offers' | 'trips' | 'history'>('offers');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDriverId();
    loadAll();
    pollRef.current = setInterval(loadAll, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const loadDriverId = async () => {
    try {
      const p = await driverService.getDriverProfile();
      const id = p?.driver?.id || p?.user?.id || user?.id || null;
      setDriverId(id);
      return id;
    } catch { return user?.id || null; }
  };

  const loadAll = useCallback(async () => {
    try {
      // 1. Offres postulées → filtrer DRIVER_SELECTED
      const stored = await SecureStore.getItemAsync('appliedOfferIds');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (ids.length > 0) {
        const results = await Promise.allSettled(ids.map(id => rideService.getOfferById(id)));
        const relevant: OfferResponse[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const o = r.value;
            // Nettoyer les offres terminées du SecureStore
            if (o.state === 'CANCELLED' || o.state === 'VALIDATED') {
              await (await import('../../src/services/rideService')).removeAppliedOffer(o.id);
            } else if (o.state === 'DRIVER_SELECTED') {
              relevant.push(o);
            }
            // BID_RECEIVED : on garde dans la liste mais on n'affiche pas ici
          }
        }
        setSelectedOffers(relevant);
      } else {
        setSelectedOffers([]);
      }

      // 2. Trips actifs depuis SecureStore
      const tripsStored = await SecureStore.getItemAsync('activeTrips');
      const tripIds: Array<{ tripId: string }> = tripsStored ? JSON.parse(tripsStored) : [];
      if (tripIds.length > 0) {
        const tripResults = await Promise.allSettled(
          tripIds.map(t => rideService.getRideDetails(t.tripId))
        );
        const active: RideResponse[] = [];
        for (const r of tripResults) {
          if (r.status === 'fulfilled') {
            const trip = r.value;
            if (trip.state === 'CREATED' || trip.state === 'ONGOING') {
              active.push(trip);
            } else {
              // Nettoyer le trip terminé
              await (await import('../../src/services/rideService')).removeActiveTrip(trip.id);
            }
          }
        }
        setActiveTrips(active);
      } else {
        setActiveTrips([]);
      }
    } catch (e) {
      console.error('[MyRides] loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadHistory = async () => {
    try {
      const myId = driverId || user?.id;
      if (!myId) return;
      const data = await rideService.getDriverHistory(myId);
      setHistory(data.filter(r => r.state === 'COMPLETED'));
    } catch { setHistory([]); }
  };

  useEffect(() => {
    if (tab === 'history' && history.length === 0) loadHistory();
  }, [tab]);

  // Confirmer le pickup → crée le Trip
  const handleConfirm = async (offer: OfferResponse) => {
    const myId = driverId || user?.id;
    if (!myId) { Alert.alert('Erreur', 'Identifiant chauffeur introuvable.'); return; }
    setConfirming(offer.id);
    try {
      const ride = await rideService.driverAccepts(offer.id, myId);
      // L'offre a été retirée et le trip ajouté par rideService.driverAccepts
      // Rafraîchir et naviguer
      await loadAll();
      router.push(`/(driver)/ride/${ride.id}` as any);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Impossible de confirmer.');
    } finally { setConfirming(null); }
  };

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const totalBadge = selectedOffers.length + activeTrips.length;

  // ─── Header tabs ──────────────────────────────────────────────────────────
  const tabs = [
    { key: 'offers',  label: 'Offres',   count: selectedOffers.length },
    { key: 'trips',   label: 'Trips',    count: activeTrips.length },
    { key: 'history', label: 'Historique', count: 0 },
  ] as const;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
        <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
          <Text style={s.logoLetter}>R</Text>
        </View>
        <Text style={[s.headerTitle, { color: Colors.text }]}>Mes offres / Trips</Text>
        {totalBadge > 0 && (
          <View style={[s.countBadge, { backgroundColor: Colors.orangeBg }]}>
            <Text style={[s.countTxt, { color: Colors.orange }]}>{totalBadge}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: Colors.card, borderBottomColor: Colors.cardBorder }]}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => setTab(t.key)}>
            <View style={s.tabLabelRow}>
              <Text style={[s.tabLabel,
                { color: tab === t.key ? Colors.orange : Colors.textMuted }]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[s.tabBadge, { backgroundColor: Colors.orange }]}>
                  <Text style={s.tabBadgeTxt}>{t.count}</Text>
                </View>
              )}
            </View>
            {tab === t.key && (
              <View style={[s.tabUnderline, { backgroundColor: Colors.orange }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}
          contentContainerStyle={[s.scroll,
            (tab === 'offers' && selectedOffers.length === 0) ||
            (tab === 'trips'  && activeTrips.length === 0) ||
            (tab === 'history' && history.length === 0)
              ? { flex: 1 } : {}]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={Colors.orange} />}>

          {/* ── TAB : OFFRES SÉLECTIONNÉES ── */}
          {tab === 'offers' && (
            selectedOffers.length === 0 ? (
              <View style={s.emptyBlock}>
                <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
                <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune offre sélectionnée</Text>
                <Text style={[s.hint, { color: Colors.textMuted }]}>
                  Vous apparaîtrez ici quand un passager vous choisit.
                </Text>
              </View>
            ) : (
              selectedOffers.map(offer => (
                <View key={offer.id}
                  style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.green }]}>
                  {/* Badge + heure */}
                  <View style={s.cardTop}>
                    <View style={[s.badge, { backgroundColor: Colors.greenBg }]}>
                      <View style={[s.badgeDot, { backgroundColor: Colors.green }]} />
                      <Text style={[s.badgeTxt, { color: Colors.green }]}>VOUS ÊTES SÉLECTIONNÉ</Text>
                    </View>
                    <Text style={[s.timeText, { color: Colors.textMuted }]}>
                      {formatDateTime(offer.departureTime)}
                    </Text>
                  </View>
                  {/* Prix */}
                  <View style={s.priceRow}>
                    <Text style={[s.priceVal, { color: Colors.text }]}>
                      {offer.price?.toLocaleString()}
                    </Text>
                    <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
                  </View>
                  {/* Route */}
                  <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
                    <View style={s.routeRow}>
                      <View style={[s.dot, { backgroundColor: Colors.orange }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.routeLbl, { color: Colors.textMuted }]}>DE</Text>
                        <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
                          {offer.startPoint}
                        </Text>
                      </View>
                    </View>
                    <View style={[s.vline, { backgroundColor: Colors.cardBorder }]} />
                    <View style={s.routeRow}>
                      <View style={[s.dotOut, { borderColor: Colors.text }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.routeLbl, { color: Colors.textMuted }]}>À</Text>
                        <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
                          {offer.endPoint}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Bouton confirmer */}
                  <TouchableOpacity
                    style={[s.confirmBtn, { backgroundColor: Colors.green }]}
                    onPress={() => handleConfirm(offer)}
                    disabled={confirming === offer.id}
                    activeOpacity={0.85}>
                    {confirming === offer.id
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                          <Text style={s.confirmBtnTxt}>CONFIRMER LA COURSE</Text>
                        </>}
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {/* ── TAB : TRIPS ACTIFS ── */}
          {tab === 'trips' && (
            activeTrips.length === 0 ? (
              <View style={s.emptyBlock}>
                <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
                <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucun trip actif</Text>
                <Text style={[s.hint, { color: Colors.textMuted }]}>
                  Les courses confirmées apparaîtront ici.
                </Text>
              </View>
            ) : (
              activeTrips.map(trip => {
                const isOngoing = trip.state === 'ONGOING';
                return (
                  <View key={trip.id}
                    style={[s.card, {
                      backgroundColor: Colors.card,
                      borderColor: isOngoing ? Colors.green : Colors.orange,
                    }]}>
                    <View style={s.cardTop}>
                      <View style={[s.badge, {
                        backgroundColor: isOngoing ? Colors.greenBg : Colors.orangeBg }]}>
                        <View style={[s.badgeDot, {
                          backgroundColor: isOngoing ? Colors.green : Colors.orange }]} />
                        <Text style={[s.badgeTxt, {
                          color: isOngoing ? Colors.green : Colors.orange }]}>
                          {isOngoing ? 'TRAJET EN COURS' : 'EN ROUTE VERS LE CLIENT'}
                        </Text>
                      </View>
                    </View>
                    <View style={s.priceRow}>
                      <Text style={[s.priceVal, { color: Colors.text }]}>
                        {trip.price?.toLocaleString()}
                      </Text>
                      <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
                    </View>
                    <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
                      <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
                        {trip.startPoint}
                      </Text>
                      <Text style={[s.routeLbl, { color: Colors.textMuted }]}>→</Text>
                      <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
                        {trip.endPoint}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.confirmBtn, { backgroundColor: Colors.orange }]}
                      onPress={() => router.push(`/(driver)/ride/${trip.id}` as any)}
                      activeOpacity={0.85}>
                      <Ionicons name="navigate" size={16} color="#0D0D0D" />
                      <Text style={[s.confirmBtnTxt, { color: '#0D0D0D' }]}>REPRENDRE LA COURSE</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )
          )}

          {/* ── TAB : HISTORIQUE ── */}
          {tab === 'history' && (
            history.length === 0 ? (
              <View style={s.emptyBlock}>
                <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
                <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune course terminée</Text>
                <Text style={[s.hint, { color: Colors.textMuted }]}>
                  Votre historique apparaîtra ici après vos premières courses.
                </Text>
                <TouchableOpacity
                  style={[s.refreshBtn, { backgroundColor: Colors.orangeBg }]}
                  onPress={loadHistory}>
                  <Text style={[s.refreshTxt, { color: Colors.orange }]}>Actualiser</Text>
                </TouchableOpacity>
              </View>
            ) : (
              history.map(trip => (
                <View key={trip.id}
                  style={[s.histCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
                  <View style={s.histTop}>
                    <View style={[s.badge, { backgroundColor: Colors.greenBg }]}>
                      <Text style={[s.badgeTxt, { color: Colors.green }]}>TERMINÉE</Text>
                    </View>
                    <Text style={[s.timeText, { color: Colors.textMuted }]}>
                      {formatDateTime(trip.createdAt)}
                    </Text>
                  </View>
                  <View style={s.histBody}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
                        {trip.startPoint}
                      </Text>
                      <Text style={[s.routeLbl, { color: Colors.textMuted }]}>
                        {trip.endPoint}
                      </Text>
                    </View>
                    <Text style={[s.histPrice, { color: Colors.text }]}>
                      {trip.price?.toLocaleString()} <Text style={{ fontSize: 11 }}>FCFA</Text>
                    </Text>
                  </View>
                </View>
              ))
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, gap: 10,
  },
  logoBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 17 },
  headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  countBadge:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  countTxt:    { fontSize: 12, fontWeight: '900' },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  tabBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabLabel:    { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  tabBadge:    { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },
  tabUnderline: { height: 2, width: '80%', borderRadius: 1 },
  scroll:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 40, gap: 12 },
  emptyBlock:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyTitle:  { fontSize: 18, fontWeight: '900' },
  hint:        { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  card:        { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDot:    { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:    { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  timeText:    { fontSize: 10, fontWeight: '700' },
  priceRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  priceVal:    { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 36 },
  priceCurr:   { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  routeBlock:  { borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  routeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeLbl:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  routePlace:  { fontSize: 13, fontWeight: '700', marginTop: 1 },
  dot:         { width: 10, height: 10, borderRadius: 5, marginTop: 11, flexShrink: 0 },
  dotOut:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 11, flexShrink: 0 },
  vline:       { width: 2, height: 12, marginLeft: 4, marginVertical: 2 },
  confirmBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: Radius.xl, paddingVertical: 16, elevation: 4,
  },
  confirmBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  histCard:    { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 8 },
  histTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histBody:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histPrice:   { fontSize: 18, fontWeight: '900' },
  refreshBtn:  { borderRadius: Radius.xl, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  refreshTxt:  { fontWeight: '900', fontSize: 13 },
});


// /**
//  * app/(driver)/my-rides.tsx
//  *
//  * Onglet "Mes offres" du chauffeur.
//  * Affiche les offres où le chauffeur a été sélectionné (DRIVER_SELECTED)
//  * et lui permet de confirmer la course.
//  *
//  * Routes :
//  *   GET  /api/v1/offers/available          → toutes les offres (filtrées localement)
//  *   GET  /api/v1/offers/{id}               → détail d'une offre
//  *   POST /api/v1/offers/{id}/accept        → confirmer le pickup → crée la course
//  *   GET  /api/v1/trips/driver/current      → course en cours éventuelle
//  */

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import {
//   View, Text, TouchableOpacity, StyleSheet,
//   ScrollView, ActivityIndicator, RefreshControl, Alert,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
// import { useAuth } from '../../src/context/AuthContext';
// import { useTheme } from '../../src/context/ThemeContext';
// import { rideService } from '../../src/services/rideService';
// import { driverService } from '../../src/services/userService';
// import { Spacing, Radius } from '../../src/types/theme';
// import { OfferResponse, RideResponse } from '../../src/types/api';

// type OfferState = 'PENDING' | 'BID_RECEIVED' | 'DRIVER_SELECTED' | 'VALIDATED' | 'CANCELLED';

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function formatTime(iso?: string) {
//   if (!iso) return '--:--';
//   try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
//   catch { return '--:--'; }
// }

// function formatDate(iso?: string) {
//   if (!iso) return '';
//   try {
//     return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
//   } catch { return ''; }
// }

// // ─── Composant principal ──────────────────────────────────────────────────────
// export default function MyRidesScreen() {
//   const { user } = useAuth();
//   const { Colors } = useTheme();

//   const [offers, setOffers]           = useState<OfferResponse[]>([]);
//   const [activeRide, setActiveRide]   = useState<RideResponse | null>(null);
//   const [loading, setLoading]         = useState(true);
//   const [refreshing, setRefreshing]   = useState(false);
//   const [confirming, setConfirming]   = useState<string | null>(null); // offerId en cours de confirmation
//   const [driverId, setDriverId]       = useState<string | null>(null);

//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   useEffect(() => {
//     loadDriverId();
//     loadData();
//     pollRef.current = setInterval(loadData, 5000);
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   const loadDriverId = async () => {
//     try {
//       const profile = await driverService.getDriverProfile();
//       setDriverId(profile?.driver?.id || profile?.user?.id || user?.id || null);
//     } catch {
//       setDriverId(user?.id || null);
//     }
//   };

//   const loadData = useCallback(async () => {
//     try {
//       // 1. Course active en cours
//       try {
//         const res = await rideService.getEnrichedHistory();
//         const active = (res as any[]).find((r: any) =>
//           r.state === 'CREATED' || r.state === 'ONGOING'
//         );
//         if (active) setActiveRide(active);
//       } catch { /* silent */ }

//       // 2. Offres where state = DRIVER_SELECTED ou BID_RECEIVED
//       // On appelle getAvailableOffers et on filtre sur selectedDriverId == moi
//       // + on récupère via SecureStore les offres auxquelles on a postulé
//       const stored = await SecureStore.getItemAsync('appliedOfferIds');
//       const appliedIds: string[] = stored ? JSON.parse(stored) : [];

//       if (appliedIds.length === 0) {
//         setOffers([]);
//         setLoading(false);
//         setRefreshing(false);
//         return;
//       }

//       const results = await Promise.allSettled(
//         appliedIds.map(id => rideService.getOfferById(id))
//       );

//       const relevant: OfferResponse[] = [];
//       results.forEach((res, i) => {
//         if (res.status === 'fulfilled') {
//           const o = res.value;
//           // Garder seulement les offres pertinentes
//           if (o.state !== 'CANCELLED' && o.state !== 'PENDING') {
//             relevant.push(o);
//           }
//         }
//       });

//       // Trier : DRIVER_SELECTED en premier
//       relevant.sort((a, b) => {
//         const priority = (s: string) =>
//           s === 'DRIVER_SELECTED' ? 0 : s === 'BID_RECEIVED' ? 1 : 2;
//         return priority(a.state) - priority(b.state);
//       });

//       setOffers(relevant);
//     } catch (e) {
//       console.error('[MyRides] loadData error:', e);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, []);

//   // ── Confirmer le pickup ───────────────────────────────────────────────────
//   const handleConfirm = async (offerId: string) => {
//     const myId = driverId || user?.id;
//     if (!myId) {
//       Alert.alert('Erreur', 'Identifiant chauffeur introuvable.');
//       return;
//     }
//     setConfirming(offerId);
//     try {
//       console.log('[MyRides] Confirm offer:', offerId, 'driverId:', myId);
//       const ride: RideResponse = await rideService.driverAccepts(offerId, myId);
//       await SecureStore.setItemAsync('activeRideId', ride.id);
//       router.push(`/(driver)/ride/${ride.id}` as any);
//     } catch (e: any) {
//       const msg = e?.response?.data?.message || e?.message || 'Impossible de confirmer la course.';
//       console.error('[MyRides] confirm error:', msg);
//       Alert.alert('Erreur', msg);
//     } finally {
//       setConfirming(null);
//     }
//   };

//   const onRefresh = () => {
//     setRefreshing(true);
//     loadData();
//   };

//   // ── Badges état ──────────────────────────────────────────────────────────
//   const stateInfo = (state: string): { label: string; color: string; bg: string } => {
//     switch (state) {
//       case 'BID_RECEIVED':     return { label: 'CANDIDATURE ENVOYÉE', color: Colors.orange,    bg: Colors.orangeBg };
//       case 'DRIVER_SELECTED':  return { label: 'VOUS ÊTES SÉLECTIONNÉ', color: Colors.green, bg: Colors.greenBg  };
//       case 'VALIDATED':        return { label: 'CONFIRMÉE',              color: Colors.green, bg: Colors.greenBg  };
//       default:                 return { label: state,                    color: Colors.textMuted, bg: Colors.input };
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────────────
//   // RENDU
//   // ─────────────────────────────────────────────────────────────────────────
//   return (
//     <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>

//       {/* Header */}
//       <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
//         <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
//           <Text style={s.logoLetter}>R</Text>
//         </View>
//         <Text style={[s.headerTitle, { color: Colors.text }]}>Mes offres</Text>
//         {offers.length > 0 && (
//           <View style={[s.countBadge, { backgroundColor: Colors.orangeBg }]}>
//             <Text style={[s.countTxt, { color: Colors.orange }]}>{offers.length}</Text>
//           </View>
//         )}
//       </View>

//       {loading ? (
//         <View style={s.centered}>
//           <ActivityIndicator color={Colors.orange} size="large" />
//           <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement...</Text>
//         </View>
//       ) : (
//         <ScrollView
//           style={{ flex: 1 }}
//           contentContainerStyle={[s.scroll, !offers.length && !activeRide && s.scrollEmpty]}
//           showsVerticalScrollIndicator={false}
//           refreshControl={
//             <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
//           }
//         >
//           {/* ── Course active en cours ── */}
//           {activeRide && (
//             <TouchableOpacity
//               style={[s.activeBanner, { backgroundColor: Colors.greenBg }]}
//               onPress={() => router.push(`/(driver)/ride/${activeRide.id}` as any)}
//               activeOpacity={0.85}
//             >
//               <View style={s.activeBannerLeft}>
//                 <View style={[s.activePulse, { backgroundColor: Colors.green }]} />
//                 <View>
//                   <Text style={[s.activeBannerTitle, { color: Colors.green }]}>
//                     Course en cours
//                   </Text>
//                   <Text style={[s.activeBannerSub, { color: Colors.green }]}>
//                     {activeRide.startPoint} → {activeRide.endPoint}
//                   </Text>
//                 </View>
//               </View>
//               <Ionicons name="chevron-forward" size={18} color={Colors.green} />
//             </TouchableOpacity>
//           )}

//           {/* ── Vide ── */}
//           {offers.length === 0 && !activeRide && (
//             <View style={s.emptyBlock}>
//               <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
//               <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune offre</Text>
//               <Text style={[s.hint, { color: Colors.textMuted }]}>
//                 Les offres auxquelles vous avez postulé apparaîtront ici.
//               </Text>
//               <TouchableOpacity
//                 style={[s.goRadarBtn, { backgroundColor: Colors.orangeBg }]}
//                 onPress={() => router.push('/(driver)/dashboard' as any)}
//               >
//                 <Text style={[s.goRadarTxt, { color: Colors.orange }]}>Voir le radar</Text>
//               </TouchableOpacity>
//             </View>
//           )}

//           {/* ── Liste des offres ── */}
//           {offers.map(offer => {
//             const { label, color, bg } = stateInfo(offer.state);
//             const isSelected = offer.state === 'DRIVER_SELECTED';
//             const isConfirming = confirming === offer.id;

//             return (
//               <View
//                 key={offer.id}
//                 style={[
//                   s.offerCard,
//                   { backgroundColor: Colors.card, borderColor: isSelected ? Colors.green : Colors.cardBorder },
//                 ]}
//               >
//                 {/* Haut : badge état + heure */}
//                 <View style={s.cardTop}>
//                   <View style={[s.stateBadge, { backgroundColor: bg }]}>
//                     {isSelected && (
//                       <View style={[s.selectedDot, { backgroundColor: color }]} />
//                     )}
//                     <Text style={[s.stateBadgeTxt, { color }]}>{label}</Text>
//                   </View>
//                   <View style={s.timeRow}>
//                     <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
//                     <Text style={[s.timeTxt, { color: Colors.textMuted }]}>
//                       {formatDate(offer.departureTime)} {formatTime(offer.departureTime)}
//                     </Text>
//                   </View>
//                 </View>

//                 {/* Prix */}
//                 <View style={s.priceRow}>
//                   <Text style={[s.priceVal, { color: Colors.text }]}>
//                     {offer.price?.toLocaleString()}
//                   </Text>
//                   <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
//                 </View>

//                 {/* Itinéraire */}
//                 <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
//                   <View style={s.routeRow}>
//                     <View style={[s.dotFilled, { backgroundColor: Colors.orange }]} />
//                     <View style={{ flex: 1 }}>
//                       <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DE</Text>
//                       <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
//                         {offer.startPoint}
//                       </Text>
//                     </View>
//                   </View>
//                   <View style={[s.routeVLine, { backgroundColor: Colors.cardBorder }]} />
//                   <View style={s.routeRow}>
//                     <View style={[s.dotOutline, { borderColor: Colors.text }]} />
//                     <View style={{ flex: 1 }}>
//                       <Text style={[s.routeLabel, { color: Colors.textMuted }]}>À</Text>
//                       <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={1}>
//                         {offer.endPoint}
//                       </Text>
//                     </View>
//                   </View>
//                 </View>

//                 {/* Bouton confirmer si sélectionné */}
//                 {isSelected && (
//                   <TouchableOpacity
//                     style={[s.confirmBtn, { backgroundColor: Colors.green }]}
//                     onPress={() => handleConfirm(offer.id)}
//                     disabled={isConfirming}
//                     activeOpacity={0.85}
//                   >
//                     {isConfirming
//                       ? <ActivityIndicator color="#fff" />
//                       : <>
//                           <Ionicons name="checkmark" size={18} color="#fff" />
//                           <Text style={s.confirmBtnTxt}>CONFIRMER LA COURSE</Text>
//                         </>
//                     }
//                   </TouchableOpacity>
//                 )}

//                 {/* Voir l'offre */}
//                 {!isSelected && (
//                   <TouchableOpacity
//                     style={[s.viewBtn, { borderColor: Colors.cardBorder }]}
//                     onPress={() => router.push(`/(driver)/offers/${offer.id}` as any)}
//                   >
//                     <Text style={[s.viewBtnTxt, { color: Colors.textMuted }]}>
//                       Consulter l'offre
//                     </Text>
//                     <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
//                   </TouchableOpacity>
//                 )}
//               </View>
//             );
//           })}
//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const s = StyleSheet.create({
//   safe:     { flex: 1 },
//   centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
//   hint:     { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },

//   header: {
//     flexDirection: 'row', alignItems: 'center',
//     paddingHorizontal: Spacing.md, paddingVertical: 14,
//     borderBottomWidth: 1, gap: 10,
//   },
//   logoBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
//   logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 17 },
//   headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
//   countBadge:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
//   countTxt:    { fontSize: 12, fontWeight: '900' },

//   scroll:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 40, gap: 12 },
//   scrollEmpty: { flex: 1 },

//   // Course active
//   activeBanner: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     borderRadius: Radius.lg, padding: Spacing.md,
//   },
//   activeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
//   activePulse:      { width: 10, height: 10, borderRadius: 5 },
//   activeBannerTitle: { fontWeight: '900', fontSize: 14 },
//   activeBannerSub:   { fontWeight: '600', fontSize: 11, marginTop: 2 },

//   // Vide
//   emptyBlock:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
//   emptyTitle:  { fontSize: 18, fontWeight: '900' },
//   goRadarBtn:  { borderRadius: Radius.xl, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
//   goRadarTxt:  { fontWeight: '900', fontSize: 13 },

//   // Offer card
//   offerCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
//   cardTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
//   stateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
//   selectedDot: { width: 6, height: 6, borderRadius: 3 },
//   stateBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
//   timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
//   timeTxt:   { fontSize: 10, fontWeight: '700' },

//   priceRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
//   priceVal:  { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 36 },
//   priceCurr: { fontSize: 12, fontWeight: '700', marginBottom: 4 },

//   routeBlock: { borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
//   routeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
//   routeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
//   routePlace: { fontSize: 13, fontWeight: '700', marginTop: 1 },
//   dotFilled:  { width: 10, height: 10, borderRadius: 5, marginTop: 11, flexShrink: 0 },
//   dotOutline: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 11, flexShrink: 0 },
//   routeVLine: { width: 2, height: 12, marginLeft: 4, marginVertical: 2 },

//   confirmBtn: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 8, borderRadius: Radius.xl, paddingVertical: 16,
//     shadowColor: '#22C55E', shadowOffset: { width: 0, height: 3 },
//     shadowOpacity: 0.25, elevation: 4,
//   },
//   confirmBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },

//   viewBtn: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 4, borderTopWidth: 1, paddingTop: 8,
//   },
//   viewBtnTxt: { fontWeight: '700', fontSize: 12 },
// });