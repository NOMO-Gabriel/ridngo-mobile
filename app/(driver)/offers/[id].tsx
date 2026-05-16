/**
 * app/(driver)/offers/[id].tsx
 *
 * Page de détail d'une offre pour le chauffeur.
 * Design inspiré du screenshot : prix en gros, itinéraire, carte OSM, bouton ACCEPTER.
 *
 * Routes utilisées :
 *   GET  /api/v1/offers/{id}       → charger le détail
 *   POST /api/v1/offers/{id}/apply → postuler à l'offre
 *
 * Après postulation : polling sur GET /api/v1/offers/{id} toutes les 3s
 *   → state DRIVER_SELECTED + selectedDriverId == monId → bouton CONFIRMER
 *   → POST /api/v1/offers/{id}/accept?driverId={monId} → RideResponse
 *   → redirect /(driver)/ride/{rideId}
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { ThemeToggle } from '../../../src/components/ThemeToggle';
import { rideService } from '../../../src/services/rideService';
import { driverService } from '../../../src/services/userService';
import { Spacing, Radius } from '../../../src/types/theme';
import { OfferResponse, RideResponse } from '../../../src/types/api';

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_H * 0.38;

// ─── Types locaux ─────────────────────────────────────────────────────────────
type OfferState = 'PENDING' | 'BID_RECEIVED' | 'DRIVER_SELECTED' | 'VALIDATED' | 'CANCELLED';
type ViewState = 'idle' | 'applied' | 'selected' | 'confirmed' | 'error';

// ─── Carte OSM inline ─────────────────────────────────────────────────────────
function buildMapHTML(
  startLat?: number, startLon?: number,
  endLat?: number,   endLon?: number,
) {
  if (!startLat || !startLon) return '<html><body style="background:#0d0d0d"></body></html>';

  const hasEnd = endLat && endLon;
  const centerLat = hasEnd ? (startLat + endLat!) / 2 : startLat;
  const centerLon = hasEnd ? (startLon + endLon!) / 2 : startLon;

  const endMarker = hasEnd
    ? `L.marker([${endLat}, ${endLon}], { icon: destIcon }).addTo(map).bindPopup('Destination');`
    : '';

  const fitBounds = hasEnd
    ? `map.fitBounds([[${startLat},${startLon}],[${endLat},${endLon}]], { padding: [40,40] });`
    : `map.setView([${startLat},${startLon}], 14);`;

  // Tracé OSRM si possible (fallback: ligne droite)
  const osrmFetch = hasEnd ? `
fetch('https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson')
  .then(r => r.json())
  .then(d => {
    if (d.routes && d.routes[0]) {
      L.geoJSON(d.routes[0].geometry, { style: { color: '#FF8C00', weight: 5, opacity: 0.9 } }).addTo(map);
    } else {
      L.polyline([[${startLat},${startLon}],[${endLat},${endLon}]], { color:'#FF8C00', weight:4, dashArray:'8,6' }).addTo(map);
    }
  })
  .catch(() => {
    L.polyline([[${startLat},${startLon}],[${endLat},${endLon}]], { color:'#FF8C00', weight:4, dashArray:'8,6' }).addTo(map);
  });
` : '';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${centerLat},${centerLon}],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

var startIcon = L.divIcon({
  html:'<div style="width:14px;height:14px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
  iconSize:[14,14],iconAnchor:[7,7],className:''
});
var destIcon = L.divIcon({
  html:'<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #FF8C00;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
  iconSize:[14,14],iconAnchor:[7,7],className:''
});

L.marker([${startLat},${startLon}],{icon:startIcon}).addTo(map).bindPopup('Départ');
${endMarker}
${osrmFetch}
${fitBounds}
</script></body></html>`;
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { Colors } = useTheme();

  const [offer, setOffer]         = useState<OfferResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [applying, setApplying]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [driverId, setDriverId]   = useState<string | null>(null);
  const [mapKey, setMapKey]       = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Charger le driverId depuis le profil ─────────────────────────────────
  useEffect(() => {
    loadDriverId();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (id) loadOffer();
  }, [id]);

  const loadDriverId = async () => {
    try {
      const profile = await driverService.getDriverProfile();
      setDriverId(profile?.driver?.id || profile?.user?.id || null);
    } catch {
      // fallback sur user.id depuis le context
      setDriverId(user?.id || null);
    }
  };

  const loadOffer = async () => {
    try {
      setLoading(true);
      const data = await rideService.getOfferById(id!);
      setOffer(data);
      setMapKey(k => k + 1);
    } catch (e: any) {
      console.error('[OfferDetail] load error:', e?.message);
      Alert.alert('Erreur', "Impossible de charger l'offre.");
    } finally {
      setLoading(false);
    }
  };

  // ── Postulation ──────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      console.log('[OfferDetail] Postulation à:', id);
      await rideService.applyToOffer(id);
      setViewState('applied');
      startPolling();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur lors de la postulation.';
      console.error('[OfferDetail] apply error:', msg);
      Alert.alert('Erreur', msg);
    } finally {
      setApplying(false);
    }
  };

  // ── Polling — attente sélection par le passager ───────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await rideService.getOfferById(id!);
        setOffer(updated);

        const state = updated.state as OfferState;

        if (state === 'CANCELLED') {
          clearInterval(pollRef.current!);
          setViewState('error');
          Alert.alert('Offre annulée', 'Le passager a annulé sa demande.');
          return;
        }

        if (state === 'DRIVER_SELECTED') {
          const myId = driverId || user?.id;
          if (updated.selectedDriverId && myId && updated.selectedDriverId === myId) {
            clearInterval(pollRef.current!);
            setViewState('selected');
          }
        }

        if (state === 'VALIDATED') {
          clearInterval(pollRef.current!);
          setViewState('confirmed');
        }
      } catch { /* silent */ }
    }, 3000);
  }, [id, driverId, user?.id]);

  // ── Confirmation de la course ─────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!id || !driverId) {
      Alert.alert('Erreur', 'Identifiant chauffeur introuvable.');
      return;
    }
    setConfirming(true);
    try {
      console.log('[OfferDetail] Confirmation:', id, 'driverId:', driverId);
      const ride: RideResponse = await rideService.driverAccepts(id, driverId);
      await SecureStore.setItemAsync('activeRideId', ride.id);
      router.replace(`/(driver)/ride/${ride.id}` as any);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur lors de la confirmation.';
      console.error('[OfferDetail] confirm error:', msg);
      Alert.alert('Erreur', msg);
    } finally {
      setConfirming(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    try {
      return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const stateLabel = (state?: string): { label: string; color: string } => {
    switch (state) {
      case 'PENDING':         return { label: 'OFFRE PENDING',   color: Colors.orange };
      case 'BID_RECEIVED':    return { label: 'BID REÇU',        color: Colors.blue };
      case 'DRIVER_SELECTED': return { label: 'CHAUFFEUR CHOISI', color: Colors.green };
      case 'VALIDATED':       return { label: 'VALIDÉE',          color: Colors.green };
      case 'CANCELLED':       return { label: 'ANNULÉE',          color: Colors.red };
      default:                return { label: state || 'INCONNU', color: Colors.textMuted };
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={s.centered}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={[s.loadingTxt, { color: Colors.textMuted }]}>Chargement de l'offre...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red} />
          <Text style={[s.loadingTxt, { color: Colors.textMuted }]}>Offre introuvable</Text>
          <TouchableOpacity onPress={() => router.back()} style={[s.backFallback, { backgroundColor: Colors.card }]}>
            <Text style={{ color: Colors.text, fontWeight: '700' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { label: stLbl, color: stColor } = stateLabel(offer.state);
  const mapHTML = buildMapHTML(offer.startLat, offer.startLon, offer.endLat, offer.endLon);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
          <Text style={s.logoLetter}>R</Text>
        </View>
        <View style={s.headerSpacer} />
        <ThemeToggle />
        <TouchableOpacity style={[s.notifBtn, { backgroundColor: Colors.input }]}>
          <Ionicons name="notifications-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bloc prix + état ── */}
        <View style={[s.priceBanner, { backgroundColor: Colors.background }]}>
          <View style={s.priceBannerTop}>
            {/* Badge état */}
            <View style={[s.stateBadge, { borderColor: stColor }]}>
              <Text style={[s.stateBadgeTxt, { color: stColor }]}>{stLbl}</Text>
            </View>
            {/* Heure */}
            <View style={s.timeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
              <Text style={[s.timeTxt, { color: Colors.textMuted }]}>
                {formatTime(offer.departureTime)}
              </Text>
            </View>
          </View>

          {/* Grand prix */}
          <View style={s.priceRow}>
            <Text style={[s.priceMain, { color: Colors.text }]}>
              {offer.price?.toLocaleString()}
            </Text>
            <Text style={[s.priceCurrency, { color: Colors.textMuted }]}>FCFA</Text>
          </View>
        </View>

        {/* ── Itinéraire ── */}
        <View style={[s.routeCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          {/* Départ */}
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={[s.dotFilled, { backgroundColor: Colors.orange }]} />
              <View style={[s.routeVLine, { backgroundColor: Colors.cardBorder }]} />
            </View>
            <View style={s.routeTextCol}>
              <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DÉPART</Text>
              <Text style={[s.routePlace, { color: Colors.text }]}>{offer.startPoint}</Text>
            </View>
          </View>
          {/* Destination */}
          <View style={s.routeRow}>
            <View style={s.routeIconCol}>
              <View style={[s.dotOutline, { borderColor: Colors.text }]} />
            </View>
            <View style={s.routeTextCol}>
              <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DESTINATION</Text>
              <Text style={[s.routePlace, { color: Colors.text }]}>{offer.endPoint}</Text>
            </View>
          </View>
        </View>

        {/* ── Boutons action selon l'état ── */}
        <View style={s.actionBlock}>

          {/* État idle : ACCEPTER */}
          {viewState === 'idle' && (
            <TouchableOpacity
              style={[s.acceptBtn, { backgroundColor: Colors.orange }]}
              onPress={handleApply}
              disabled={applying}
              activeOpacity={0.85}
            >
              {applying
                ? <ActivityIndicator color="#0D0D0D" />
                : <>
                    <Text style={s.acceptBtnTxt}>ACCEPTER</Text>
                    <Ionicons name="chevron-forward" size={18} color="#0D0D0D" />
                  </>
              }
            </TouchableOpacity>
          )}

          {/* État applied : en attente */}
          {viewState === 'applied' && (
            <View style={[s.waitingBlock, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
              <ActivityIndicator color={Colors.orange} size="small" />
              <View style={{ flex: 1 }}>
                <Text style={[s.waitingTitle, { color: Colors.text }]}>Candidature envoyée</Text>
                <Text style={[s.waitingSub, { color: Colors.textMuted }]}>
                  En attente du choix du passager...
                </Text>
              </View>
            </View>
          )}

          {/* État selected : CONFIRMER LA COURSE */}
          {viewState === 'selected' && (
            <View style={s.selectedBlock}>
              <View style={[s.selectedBanner, { backgroundColor: Colors.greenBg }]}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.green} />
                <Text style={[s.selectedTitle, { color: Colors.green }]}>
                  Vous avez été choisi !
                </Text>
              </View>
              <TouchableOpacity
                style={[s.acceptBtn, { backgroundColor: Colors.green }]}
                onPress={handleConfirm}
                disabled={confirming}
                activeOpacity={0.85}
              >
                {confirming
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Text style={[s.acceptBtnTxt, { color: '#fff' }]}>CONFIRMER LA COURSE</Text>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* État error : offre annulée */}
          {viewState === 'error' && (
            <View style={[s.waitingBlock, { backgroundColor: Colors.redBg, borderColor: Colors.red }]}>
              <Ionicons name="close-circle" size={22} color={Colors.red} />
              <Text style={[s.waitingTitle, { color: Colors.red }]}>Offre annulée par le passager</Text>
            </View>
          )}

        </View>

        {/* ── Carte OSM ── */}
        <View style={[s.mapContainer, { height: MAP_HEIGHT }]}>
          <WebView
            key={mapKey}
            source={{ html: mapHTML }}
            style={s.map}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingTxt: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
  backFallback: { marginTop: 16, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn: { padding: 4 },
  logoBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontWeight: '900', fontSize: 17 },
  headerSpacer: { flex: 1 },
  notifBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Prix banner
  priceBanner: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 },
  priceBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  stateBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  stateBadgeTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeTxt: { fontSize: 13, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  priceMain: { fontSize: 64, fontWeight: '900', letterSpacing: -2, lineHeight: 68 },
  priceCurrency: { fontSize: 18, fontWeight: '700', marginBottom: 10 },

  // Itinéraire
  routeCard: {
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 0,
  },
  routeRow:     { flexDirection: 'row', gap: 12, minHeight: 52 },
  routeIconCol: { alignItems: 'center', paddingTop: 16, width: 14 },
  routeTextCol: { flex: 1, paddingTop: 10, paddingBottom: 10 },
  routeLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  routePlace:   { fontSize: 15, fontWeight: '700', marginTop: 2 },
  dotFilled:    { width: 12, height: 12, borderRadius: 6 },
  dotOutline:   { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  routeVLine:   { width: 2, flex: 1, minHeight: 20, marginTop: 4 },

  // Boutons action
  actionBlock: { marginHorizontal: Spacing.md, marginTop: Spacing.md, gap: 10 },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: Radius.xl, paddingVertical: 20,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, elevation: 6,
  },
  acceptBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 15, letterSpacing: 2 },
  waitingBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
  },
  waitingTitle: { fontWeight: '900', fontSize: 14 },
  waitingSub:   { fontWeight: '600', fontSize: 12, marginTop: 2 },
  selectedBlock: { gap: 10 },
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: Radius.md, padding: Spacing.md,
  },
  selectedTitle: { fontWeight: '900', fontSize: 15 },

  // Carte
  mapContainer: { marginTop: Spacing.md, overflow: 'hidden' },
  map:          { flex: 1 },
});

// import React, { useState, useEffect } from 'react';
// import {
//   View, Text, StyleSheet, SafeAreaView, ScrollView,
//   TouchableOpacity, ActivityIndicator, Alert
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { router, useLocalSearchParams } from 'expo-router';
// import { rideService } from '../../../src/services/rideService';
// import { Colors, Spacing, Radius } from '../../../src/types/theme';
// import { OfferResponse } from '../../../src/types/api';
// import * as SecureStore from 'expo-secure-store';

// export default function OfferDetailScreen() {
//   const { id } = useLocalSearchParams<{ id: string }>();
//   const [offer, setOffer] = useState<OfferResponse | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [applying, setApplying] = useState(false);
//   const [applied, setApplied] = useState(false);
//   const [accepting, setAccepting] = useState(false);
//   const [driverId, setDriverId] = useState<string | null>(null);

//   useEffect(() => {
//     loadOffer();
//     loadDriverId();
//   }, []);

//   const loadDriverId = async () => {
//     const raw = await SecureStore.getItemAsync('user');
//     if (raw) setDriverId(JSON.parse(raw).id);
//   };

//   const loadOffer = async () => {
//     try {
//       const data = await rideService.getOfferById(id!);
//       setOffer(data);
//     } catch {
//       Alert.alert('Erreur', 'Impossible de charger cette offre.', [{ text: 'OK', onPress: () => router.back() }]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleApply = async () => {
//     setApplying(true);
//     try {
//       await rideService.applyToOffer(id!);
//       setApplied(true);
//       Alert.alert('✅ Candidature envoyée', 'Le passager va choisir son chauffeur. Restez en ligne !');
//       await loadOffer();
//     } catch (e: any) {
//       Alert.alert('Erreur', e.response?.data?.message || "Impossible de postuler à cette offre.");
//     } finally {
//       setApplying(false);
//     }
//   };

//   const handleAccept = async () => {
//     if (!driverId) return;
//     setAccepting(true);
//     try {
//       const ride = await rideService.driverAccepts(id!, driverId);
//       Alert.alert('🚗 Course démarrée !', 'Rendez-vous chez le passager.', [
//         { text: 'Voir la course', onPress: () => router.replace(`/(driver)/ride/${ride.id}`) }
//       ]);
//     } catch (e: any) {
//       Alert.alert('Erreur', e.response?.data?.message || "Impossible d'accepter cette course.");
//     } finally {
//       setAccepting(false);
//     }
//   };

//   if (loading) return (
//     <SafeAreaView style={styles.safe}>
//       <View style={styles.centered}>
//         <ActivityIndicator color={Colors.orange} size="large" />
//       </View>
//     </SafeAreaView>
//   );

//   if (!offer) return null;

//   const isSelected = offer.state === 'DRIVER_SELECTED';

//   return (
//     <SafeAreaView style={styles.safe}>
//       <ScrollView contentContainerStyle={styles.scroll}>
//         {/* Header */}
//         <View style={styles.header}>
//           <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
//             <Ionicons name="arrow-back" size={22} color={Colors.white} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Détail de l'offre</Text>
//           <View style={styles.stateBadge}>
//             <Text style={styles.stateText}>{offer.state}</Text>
//           </View>
//         </View>

//         {/* Price hero */}
//         <View style={styles.priceHero}>
//           <Text style={styles.priceTag}>PRIX PROPOSÉ</Text>
//           <Text style={styles.priceValue}>{offer.price?.toLocaleString()} <Text style={styles.priceCurrency}>FCFA</Text></Text>
//           {offer.distance && <Text style={styles.priceDistance}>{offer.distance.toFixed(1)} km estimés</Text>}
//         </View>

//         {/* Route */}
//         <View style={styles.routeCard}>
//           <View style={styles.routeRow}>
//             <View style={styles.dotOrange} />
//             <View style={{ flex: 1 }}>
//               <Text style={styles.routeLabel}>DÉPART</Text>
//               <Text style={styles.routeText}>{offer.startPoint}</Text>
//             </View>
//           </View>
//           <View style={styles.routeDash} />
//           <View style={styles.routeRow}>
//             <View style={styles.dotWhite} />
//             <View style={{ flex: 1 }}>
//               <Text style={styles.routeLabel}>DESTINATION</Text>
//               <Text style={styles.routeText}>{offer.endPoint}</Text>
//             </View>
//           </View>
//         </View>

//         {/* Infos */}
//         {offer.passengerPhone && (
//           <View style={styles.infoCard}>
//             <Ionicons name="call" size={18} color={Colors.orange} />
//             <View>
//               <Text style={styles.infoLabel}>CONTACT PASSAGER</Text>
//               <Text style={styles.infoValue}>{offer.passengerPhone}</Text>
//             </View>
//           </View>
//         )}

//         {offer.createdAt && (
//           <View style={styles.infoCard}>
//             <Ionicons name="time" size={18} color={Colors.orange} />
//             <View>
//               <Text style={styles.infoLabel}>PUBLIÉ À</Text>
//               <Text style={styles.infoValue}>
//                 {new Date(offer.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
//               </Text>
//             </View>
//           </View>
//         )}

//         {/* Proposals count */}
//         {offer.proposals && (
//           <View style={styles.infoCard}>
//             <Ionicons name="people" size={18} color={Colors.orange} />
//             <View>
//               <Text style={styles.infoLabel}>CANDIDATURES</Text>
//               <Text style={styles.infoValue}>{offer.proposals.length} chauffeur(s) ont postulé</Text>
//             </View>
//           </View>
//         )}

//         {/* Notice if selected */}
//         {isSelected && (
//           <View style={styles.selectedNotice}>
//             <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
//             <Text style={styles.selectedText}>Le passager vous a sélectionné ! Confirmez la course.</Text>
//           </View>
//         )}
//       </ScrollView>

//       {/* Footer action */}
//       <View style={styles.footer}>
//         {isSelected ? (
//           <TouchableOpacity
//             style={[styles.btnAccept, accepting && { opacity: 0.6 }]}
//             onPress={handleAccept}
//             disabled={accepting}
//           >
//             {accepting
//               ? <ActivityIndicator color={Colors.dark} />
//               : <>
//                 <Ionicons name="checkmark-circle" size={20} color={Colors.dark} />
//                 <Text style={styles.btnText}>Accepter la course</Text>
//               </>
//             }
//           </TouchableOpacity>
//         ) : applied ? (
//           <View style={styles.appliedBanner}>
//             <Ionicons name="radio" size={18} color={Colors.orange} />
//             <Text style={styles.appliedText}>Candidature envoyée — en attente du passager</Text>
//           </View>
//         ) : (
//           <TouchableOpacity
//             style={[styles.btnApply, applying && { opacity: 0.6 }]}
//             onPress={handleApply}
//             disabled={applying}
//           >
//             {applying
//               ? <ActivityIndicator color={Colors.dark} />
//               : <>
//                 <Ionicons name="hand-right" size={20} color={Colors.dark} />
//                 <Text style={styles.btnText}>Postuler à cette course</Text>
//               </>
//             }
//           </TouchableOpacity>
//         )}
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: Colors.dark },
//   centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
//   scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },

//   header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
//   backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.input, alignItems: 'center', justifyContent: 'center' },
//   headerTitle: { flex: 1, color: Colors.white, fontWeight: '900', fontSize: 18 },
//   stateBadge: { backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
//   stateText: { color: Colors.orange, fontWeight: '900', fontSize: 10, letterSpacing: 1 },

//   priceHero: {
//     backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
//     alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, gap: 6,
//     shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, elevation: 4,
//   },
//   priceTag: { color: Colors.orange, fontWeight: '900', fontSize: 10, letterSpacing: 3 },
//   priceValue: { color: Colors.white, fontWeight: '900', fontSize: 48, letterSpacing: -1, fontStyle: 'italic' },
//   priceCurrency: { fontSize: 20, color: Colors.textMuted },
//   priceDistance: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },

//   routeCard: {
//     backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
//     borderWidth: 1, borderColor: Colors.cardBorder, gap: 4,
//   },
//   routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
//   routeDash: { width: 2, height: 20, backgroundColor: Colors.cardBorder, marginLeft: 3 },
//   dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange, marginTop: 14 },
//   dotWhite: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white, marginTop: 14 },
//   routeLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
//   routeText: { color: Colors.white, fontWeight: '700', fontSize: 14, lineHeight: 20 },

//   infoCard: {
//     backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     borderWidth: 1, borderColor: Colors.cardBorder,
//   },
//   infoLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2 },
//   infoValue: { color: Colors.white, fontWeight: '700', fontSize: 14 },

//   selectedNotice: {
//     flexDirection: 'row', alignItems: 'center', gap: 10,
//     backgroundColor: Colors.greenBg, borderRadius: Radius.lg, padding: Spacing.md,
//   },
//   selectedText: { flex: 1, color: Colors.green, fontWeight: '700', fontSize: 13 },

//   footer: {
//     position: 'absolute', bottom: 0, left: 0, right: 0,
//     padding: Spacing.lg, backgroundColor: Colors.dark,
//     borderTopWidth: 1, borderTopColor: Colors.cardBorder,
//   },
//   btnApply: {
//     backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
//     shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
//   },
//   btnAccept: {
//     backgroundColor: Colors.green, borderRadius: Radius.lg, paddingVertical: 18,
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
//     shadowColor: Colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
//   },
//   btnText: { color: Colors.dark, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
//   appliedBanner: {
//     flexDirection: 'row', alignItems: 'center', gap: 10,
//     backgroundColor: Colors.orangeBg, borderRadius: Radius.lg, padding: Spacing.md, justifyContent: 'center',
//   },
//   appliedText: { color: Colors.orange, fontWeight: '700', fontSize: 13 },
// });
