/**
 * app/(driver)/ride/[id].tsx
 * Course active chauffeur.
 * CREATED  → bouton "J'ai récupéré le client" → PATCH ONGOING
 * ONGOING  → bouton "Terminer la course"       → PATCH COMPLETED
 * Seul le chauffeur appelle ces routes.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { useTheme } from '../../../src/context/ThemeContext';
import { rideService } from '../../../src/services/rideService';
import { Spacing, Radius } from '../../../src/types/theme';
import { RideResponse } from '../../../src/types/api';
import api from '../../../src/services/api';

const { height: SCREEN_H } = Dimensions.get('window');
type RideState = 'CREATED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

function buildMapHTML(
  passengerLat?: number, passengerLon?: number,
  driverLat?: number, driverLon?: number,
  endLat?: number, endLon?: number,
) {
  const lat = driverLat ?? passengerLat ?? 3.848;
  const lon = driverLon ?? passengerLon ?? 11.502;
  const pMarker = passengerLat && passengerLon
    ? `L.marker([${passengerLat},${passengerLon}],{icon:orangeIcon}).addTo(map).bindPopup('Passager');` : '';
  const dMarker = driverLat && driverLon
    ? `L.marker([${driverLat},${driverLon}],{icon:carIcon}).addTo(map).bindPopup('Vous');` : '';
  const eMarker = endLat && endLon
    ? `L.marker([${endLat},${endLon}],{icon:destIcon}).addTo(map).bindPopup('Destination');` : '';
  const fit = passengerLat && driverLat
    ? `map.fitBounds([[${passengerLat},${passengerLon}],[${driverLat},${driverLon}]],{padding:[60,60]});`
    : `map.setView([${lat},${lon}],14);`;
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lon}],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var orangeIcon=L.divIcon({html:'<div style="width:14px;height:14px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
var carIcon=L.divIcon({html:'<div style="width:32px;height:32px;border-radius:8px;background:#1C1C1C;border:2px solid #FF8C00;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:32px;text-align:center">&#128663;</div>',iconSize:[32,32],iconAnchor:[16,16],className:''});
var destIcon=L.divIcon({html:'<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #FF8C00;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
${pMarker}${dMarker}${eMarker}${fit}
</script></body></html>`;
}

export default function DriverRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { Colors } = useTheme();

  const [ride, setRide]             = useState<RideResponse | null>(null);
  const [passenger, setPassenger]   = useState<any>(null);
  const [driverPos, setDriverPos]   = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setAction]  = useState(false);
  const [mapKey, setMapKey]         = useState(0);
  const [rideState, setRideState]   = useState<RideState>('CREATED');

  const gpsRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (id) { loadRide(); startGPS(); }
    return () => {
      if (gpsRef.current)  clearInterval(gpsRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const loadRide = async () => {
    try {
      const data = await rideService.getRideDetails(id!);
      setRide(data);
      setRideState((data.state as RideState) || 'CREATED');
      if (data.passengerId) loadPassenger(data.passengerId);
    } catch { Alert.alert('Erreur', 'Impossible de charger la course.'); }
    finally { setLoading(false); }
  };

  const loadPassenger = async (passengerId: string) => {
    try {
      const res = await api.get(`/api/v1/users/${passengerId}`);
      setPassenger(res.data);
    } catch { }
  };

  const startGPS = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    gpsRef.current = setInterval(async () => {
      try {
        const pos = await ExpoLocation.getCurrentPositionAsync(
          { accuracy: ExpoLocation.Accuracy.High });
        const { latitude: lat, longitude: lon } = pos.coords;
        setDriverPos({ lat, lon });
        setMapKey(k => k + 1);
        rideService.updateLocation(lat, lon).catch(() => {});
      } catch { }
    }, 3000);
  };

  const startPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await rideService.getRideDetails(id!);
        setRideState((data.state as RideState) || 'CREATED');
        setRide(data);
        if (data.state === 'COMPLETED' || data.state === 'CANCELLED') {
          clearInterval(pollRef.current!);
          if (gpsRef.current) clearInterval(gpsRef.current);
        }
      } catch { }
    }, 4000);
  };

  // CREATED → ONGOING : chauffeur a récupéré le client
  const handlePickedUp = async () => {
    setAction(true);
    try {
      await rideService.startRide(id!);
      setRideState('ONGOING');
      startPoll();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Impossible de démarrer.');
    } finally { setAction(false); }
  };

  // ONGOING → COMPLETED : chauffeur termine
  const handleComplete = () => {
    Alert.alert('Terminer la course', 'Confirmez-vous la fin de la course ?', [
      { text: 'Non' },
      { text: 'Oui, terminer', onPress: async () => {
        setAction(true);
        try {
          await rideService.completeRide(id!);
          if (gpsRef.current)  clearInterval(gpsRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
          setRideState('COMPLETED');
        } catch (e: any) {
          Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Erreur.');
        } finally { setAction(false); }
      }},
    ]);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir le téléphone."));
  };

  const passengerName  = passenger
    ? `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || passenger.name || 'Passager'
    : 'Passager';
  const passengerPhone = passenger?.telephone || passenger?.phone || null;
  const passengerInit  = passengerName[0]?.toUpperCase() || 'P';

  const STATE_CFG: Record<RideState, { label: string; color: string; bg: string }> = {
    CREATED:   { label: 'EN ROUTE VERS LE PASSAGER', color: Colors.orange, bg: Colors.orangeBg },
    ONGOING:   { label: 'TRAJET EN COURS',            color: Colors.green,  bg: Colors.greenBg  },
    COMPLETED: { label: 'COURSE TERMINÉE',             color: Colors.green,  bg: Colors.greenBg  },
    CANCELLED: { label: 'COURSE ANNULÉE',              color: Colors.red,    bg: Colors.redBg    },
  };
  const cfg = STATE_CFG[rideState] ?? STATE_CFG.CREATED;
  const mapHTML = buildMapHTML(
    ride?.startLat, ride?.startLon,
    driverPos?.lat, driverPos?.lon,
    ride?.endLat, ride?.endLon);

  if (loading) return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  // Écran fin de course
  if (rideState === 'COMPLETED' || rideState === 'CANCELLED') return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.doneScreen}>
        <View style={[s.doneIcon, {
          backgroundColor: rideState === 'COMPLETED' ? Colors.greenBg : Colors.redBg }]}>
          <Ionicons
            name={rideState === 'COMPLETED' ? 'checkmark-circle' : 'close-circle'}
            size={64}
            color={rideState === 'COMPLETED' ? Colors.green : Colors.red}
          />
        </View>
        <Text style={[s.doneTitle, { color: Colors.text }]}>
          {rideState === 'COMPLETED' ? 'Course terminée' : 'Course annulée'}
        </Text>
        {rideState === 'COMPLETED' && (
          <Text style={[s.doneSub, { color: Colors.textMuted }]}>
            Montant : {ride?.price?.toLocaleString() ?? '--'} FCFA
          </Text>
        )}
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.orange }]}
          onPress={() => router.replace('/(driver)/dashboard')}
        >
          <Text style={s.doneBtnTxt}>RETOUR AU RADAR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* Carte */}
      <View style={{ height: SCREEN_H * 0.42, position: 'relative' }}>
        <WebView key={mapKey} source={{ html: mapHTML }}
          style={{ flex: 1 }} javaScriptEnabled domStorageEnabled scrollEnabled={false} />
        <View style={[s.statePill, { backgroundColor: cfg.bg }]}>
          <View style={[s.stateDot, { backgroundColor: cfg.color }]} />
          <Text style={[s.statePillTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>

        {/* Passager */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.row}>
            <View style={[s.avatar, { backgroundColor: Colors.orange }]}>
              <Text style={s.avatarTxt}>{passengerInit}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: Colors.textMuted }]}>PASSAGER</Text>
              <Text style={[s.name, { color: Colors.text }]}>{passengerName}</Text>
            </View>
            <View style={s.priceBlock}>
              <Text style={[s.priceVal, { color: Colors.text }]}>{ride?.price?.toLocaleString()}</Text>
              <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
            </View>
          </View>
          {passengerPhone && (
            <TouchableOpacity
              style={[s.phoneRow, { backgroundColor: Colors.input }]}
              onPress={() => handleCall(passengerPhone)}>
              <Ionicons name="call-outline" size={16} color={Colors.orange} />
              <Text style={[s.phoneTxt, { color: Colors.text }]}>{passengerPhone}</Text>
              <Text style={[s.phoneAction, { color: Colors.orange }]}>APPELER</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Itinéraire */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.routeRow}>
            <View style={[s.dot, { backgroundColor: Colors.orange }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: Colors.textMuted }]}>DÉPART</Text>
              <Text style={[s.place, { color: Colors.text }]} numberOfLines={2}>{ride?.startPoint}</Text>
            </View>
          </View>
          <View style={[s.vline, { backgroundColor: Colors.cardBorder }]} />
          <View style={s.routeRow}>
            <View style={[s.dotOutline, { borderColor: Colors.text }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: Colors.textMuted }]}>DESTINATION</Text>
              <Text style={[s.place, { color: Colors.text }]} numberOfLines={2}>{ride?.endPoint}</Text>
            </View>
          </View>
        </View>

        {/* Bouton CREATED : J'ai récupéré le client */}
        {rideState === 'CREATED' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: Colors.orange }]}
            onPress={handlePickedUp} disabled={actionLoading} activeOpacity={0.85}>
            {actionLoading
              ? <ActivityIndicator color="#0D0D0D" />
              : <>
                  <Ionicons name="person-add" size={18} color="#0D0D0D" />
                  <Text style={s.actionBtnTxt}>J'AI RÉCUPÉRÉ LE CLIENT</Text>
                </>}
          </TouchableOpacity>
        )}

        {/* Bouton ONGOING : Terminer */}
        {rideState === 'ONGOING' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: Colors.green }]}
            onPress={handleComplete} disabled={actionLoading} activeOpacity={0.85}>
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[s.actionBtnTxt, { color: '#fff' }]}>TERMINER LA COURSE</Text>
                </>}
          </TouchableOpacity>
        )}

        {/* GPS */}
        <View style={s.gpsRow}>
          <View style={[s.gpsDot, { backgroundColor: driverPos ? Colors.green : Colors.textMuted }]} />
          <Text style={[s.gpsTxt, { color: Colors.textMuted }]}>
            {driverPos ? `GPS actif · ${driverPos.lat.toFixed(4)}, ${driverPos.lon.toFixed(4)}`
              : 'Localisation en cours...'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint:     { fontWeight: '700', fontSize: 13 },
  statePill: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  stateDot:    { width: 7, height: 7, borderRadius: 4 },
  statePillTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  card:   { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '900', fontSize: 20 },
  label:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  name:   { fontSize: 16, fontWeight: '900', marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  priceVal:   { fontSize: 20, fontWeight: '900' },
  priceCurr:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11,
  },
  phoneTxt:    { flex: 1, fontWeight: '700', fontSize: 14 },
  phoneAction: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  routeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 48 },
  dot:        { width: 11, height: 11, borderRadius: 6, marginTop: 12, flexShrink: 0 },
  dotOutline: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, marginTop: 12, flexShrink: 0 },
  vline:      { width: 2, height: 16, marginLeft: 4, marginVertical: 2 },
  place:      { fontSize: 14, fontWeight: '700', marginTop: 2 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Radius.xl, paddingVertical: 18,
    elevation: 5,
  },
  actionBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  gpsDot: { width: 6, height: 6, borderRadius: 3 },
  gpsTxt: { fontSize: 10, fontWeight: '600' },
  doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  doneIcon:   { width: 120, height: 120, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  doneTitle:  { fontSize: 26, fontWeight: '900' },
  doneSub:    { fontSize: 15, fontWeight: '700' },
  doneBtn:    { borderRadius: Radius.xl, paddingHorizontal: 32, paddingVertical: 16 },
  doneBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});

// /**
//  * app/(driver)/ride/[id].tsx
//  *
//  * Écran de course active pour le chauffeur.
//  * États : CREATED → ONGOING → COMPLETED
//  *
//  * Routes :
//  *   GET   /api/v1/trips/{id}              → détails de la course
//  *   GET   /api/v1/users/me                → profil passager via passengerId
//  *   PATCH /api/v1/trips/{id}/status       → ONGOING / COMPLETED
//  *   POST  /api/v1/location                → envoi position GPS (toutes les 3s)
//  *   GET   /api/v1/trips/{id}/location     → position pour le passager (optionnel)
//  */

// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View, Text, TouchableOpacity, StyleSheet,
//   ScrollView, ActivityIndicator, Alert, Linking, Dimensions,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { WebView } from 'react-native-webview';
// import { Ionicons } from '@expo/vector-icons';
// import { router, useLocalSearchParams } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
// import * as ExpoLocation from 'expo-location';
// import { useTheme } from '../../../src/context/ThemeContext';
// import { rideService } from '../../../src/services/rideService';
// import { Spacing, Radius } from '../../../src/types/theme';
// import { RideResponse } from '../../../src/types/api';
// import api from '../../../src/services/api';

// const { height: SCREEN_H } = Dimensions.get('window');
// type RideState = 'CREATED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

// // ─── Carte OSM ────────────────────────────────────────────────────────────────
// function buildMapHTML(
//   passengerLat?: number, passengerLon?: number,
//   driverLat?: number,   driverLon?: number,
//   endLat?: number,      endLon?: number,
// ) {
//   const lat = driverLat ?? passengerLat ?? 3.848;
//   const lon = driverLon ?? passengerLon ?? 11.502;

//   const passengerMarker = passengerLat && passengerLon
//     ? `L.marker([${passengerLat},${passengerLon}],{icon:orangeIcon}).addTo(map).bindPopup('Passager');` : '';
//   const driverMarker = driverLat && driverLon
//     ? `L.marker([${driverLat},${driverLon}],{icon:carIcon}).addTo(map).bindPopup('Vous');` : '';
//   const destMarker = endLat && endLon
//     ? `L.marker([${endLat},${endLon}],{icon:destIcon}).addTo(map).bindPopup('Destination');` : '';

//   const fitBounds = passengerLat && driverLat
//     ? `map.fitBounds([[${passengerLat},${passengerLon}],[${driverLat},${driverLon}]],{padding:[60,60]});`
//     : `map.setView([${lat},${lon}],14);`;

//   return `<!DOCTYPE html><html><head>
// <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
// <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
// </head><body><div id="map"></div><script>
// var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lon}],14);
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// var orangeIcon = L.divIcon({
//   html:'<div style="width:14px;height:14px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
//   iconSize:[14,14],iconAnchor:[7,7],className:''
// });
// var carIcon = L.divIcon({
//   html:'<div style="width:36px;height:36px;border-radius:10px;background:#1C1C1C;border:2px solid #FF8C00;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:36px;text-align:center">&#x1F697;</div>',
//   iconSize:[36,36],iconAnchor:[18,18],className:''
// });
// var destIcon = L.divIcon({
//   html:'<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #FF8C00;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
//   iconSize:[14,14],iconAnchor:[7,7],className:''
// });

// ${passengerMarker}
// ${driverMarker}
// ${destMarker}
// ${fitBounds}
// </script></body></html>`;
// }

// // ─── Composant principal ──────────────────────────────────────────────────────
// export default function DriverRideScreen() {
//   const { id } = useLocalSearchParams<{ id: string }>();
//   const { Colors } = useTheme();

//   const [ride, setRide]               = useState<RideResponse | null>(null);
//   const [passenger, setPassenger]     = useState<any>(null);
//   const [driverPos, setDriverPos]     = useState<{ lat: number; lon: number } | null>(null);
//   const [loading, setLoading]         = useState(true);
//   const [actionLoading, setActionLoading] = useState(false);
//   const [mapKey, setMapKey]           = useState(0);
//   const [rideState, setRideState]     = useState<RideState>('CREATED');

//   const gpsRef  = useRef<ReturnType<typeof setInterval> | null>(null);
//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   useEffect(() => {
//     if (id) { loadRide(); startGPS(); }
//     return () => {
//       if (gpsRef.current)  clearInterval(gpsRef.current);
//       if (pollRef.current) clearInterval(pollRef.current);
//     };
//   }, [id]);

//   // ── Charger la course ────────────────────────────────────────────────────
//   const loadRide = async () => {
//     try {
//       setLoading(true);
//       const data = await rideService.getRideDetails(id!);
//       setRide(data);
//       setRideState((data.state as RideState) || 'CREATED');
//       // Charger profil passager
//       if (data.passengerId) loadPassenger(data.passengerId);
//     } catch (e: any) {
//       console.error('[DriverRide] load error:', e?.message);
//       Alert.alert('Erreur', 'Impossible de charger la course.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadPassenger = async (passengerId: string) => {
//     try {
//       const res = await api.get(`/api/v1/users/${passengerId}`);
//       setPassenger(res.data);
//     } catch { /* silent */ }
//   };

//   // ── GPS : envoyer position toutes les 3s ─────────────────────────────────
//   const startGPS = async () => {
//     const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
//     if (status !== 'granted') return;

//     gpsRef.current = setInterval(async () => {
//       try {
//         const pos = await ExpoLocation.getCurrentPositionAsync({
//           accuracy: ExpoLocation.Accuracy.High,
//         });
//         const { latitude: lat, longitude: lon } = pos.coords;
//         setDriverPos({ lat, lon });
//         setMapKey(k => k + 1);
//         // Envoyer au backend
//         await rideService.updateLocation(lat, lon);
//       } catch { /* silent */ }
//     }, 3000);
//   };

//   // ── Polling état course ───────────────────────────────────────────────────
//   const startPoll = () => {
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(async () => {
//       try {
//         const data = await rideService.getRideDetails(id!);
//         const state = (data.state as RideState) || 'CREATED';
//         setRideState(state);
//         setRide(data);
//         if (state === 'COMPLETED' || state === 'CANCELLED') {
//           clearInterval(pollRef.current!);
//         }
//       } catch { /* silent */ }
//     }, 4000);
//   };

//   // ── Démarrer la course (CREATED → ONGOING) ───────────────────────────────
//   const handleStart = async () => {
//     setActionLoading(true);
//     try {
//       console.log('[DriverRide] ONGOING:', id);
//       await rideService.updateRideStatus(id!, 'ONGOING');
//       setRideState('ONGOING');
//       startPoll();
//     } catch (e: any) {
//       const msg = e?.response?.data?.message || e?.message || 'Impossible de démarrer la course.';
//       Alert.alert('Erreur', msg);
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   // ── Terminer la course (ONGOING → COMPLETED) ─────────────────────────────
//   const handleComplete = () => {
//     Alert.alert(
//       'Terminer la course',
//       'Confirmez-vous la fin de la course ?',
//       [
//         { text: 'Non' },
//         {
//           text: 'Oui, terminer',
//           onPress: async () => {
//             setActionLoading(true);
//             try {
//               console.log('[DriverRide] COMPLETED:', id);
//               await rideService.updateRideStatus(id!, 'COMPLETED');
//               if (gpsRef.current)  clearInterval(gpsRef.current);
//               if (pollRef.current) clearInterval(pollRef.current);
//               await SecureStore.deleteItemAsync('activeRideId');
//               setRideState('COMPLETED');
//             } catch (e: any) {
//               const msg = e?.response?.data?.message || e?.message || 'Impossible de terminer la course.';
//               Alert.alert('Erreur', msg);
//             } finally {
//               setActionLoading(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   const handleCallPassenger = (phone: string) => {
//     Linking.openURL(`tel:${phone}`).catch(() =>
//       Alert.alert('Erreur', 'Impossible d\'ouvrir le téléphone.')
//     );
//   };

//   const handleBackToDashboard = () => {
//     router.replace('/(driver)/dashboard');
//   };

//   // ── Helpers ───────────────────────────────────────────────────────────────
//   const passengerName = passenger
//     ? `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || passenger.name || 'Passager'
//     : 'Passager';
//   const passengerPhone = passenger?.telephone || passenger?.phone || ride?.passengerPhone || null;
//   const passengerInitial = passengerName[0]?.toUpperCase() || 'P';

//   const passengerLat = ride?.startLat;
//   const passengerLon = ride?.startLon;
//   const endLat = ride?.endLat;
//   const endLon = ride?.endLon;

//   const stateConfig: Record<RideState, { label: string; color: string; bg: string }> = {
//     CREATED:   { label: 'EN ROUTE VERS LE PASSAGER', color: Colors.orange, bg: Colors.orangeBg },
//     ONGOING:   { label: 'TRAJET EN COURS',            color: Colors.green,  bg: Colors.greenBg  },
//     COMPLETED: { label: 'COURSE TERMINÉE',             color: Colors.green,  bg: Colors.greenBg  },
//     CANCELLED: { label: 'COURSE ANNULÉE',              color: Colors.red,    bg: Colors.redBg    },
//   };

//   const cfg = stateConfig[rideState] ?? stateConfig.CREATED;

//   const mapHTML = buildMapHTML(
//     passengerLat, passengerLon,
//     driverPos?.lat, driverPos?.lon,
//     endLat, endLon,
//   );

//   // ── Loading ───────────────────────────────────────────────────────────────
//   if (loading) {
//     return (
//       <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
//         <View style={s.centered}>
//           <ActivityIndicator color={Colors.orange} size="large" />
//           <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement de la course...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!ride) {
//     return (
//       <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
//         <View style={s.centered}>
//           <Ionicons name="alert-circle-outline" size={48} color={Colors.red} />
//           <Text style={[s.hint, { color: Colors.textMuted }]}>Course introuvable</Text>
//           <TouchableOpacity style={[s.backBtn2, { backgroundColor: Colors.card }]} onPress={handleBackToDashboard}>
//             <Text style={{ color: Colors.text, fontWeight: '700' }}>Retour au dashboard</Text>
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // RENDU COURSE TERMINÉE
//   // ─────────────────────────────────────────────────────────────────────────
//   if (rideState === 'COMPLETED' || rideState === 'CANCELLED') {
//     return (
//       <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
//         <View style={s.doneScreen}>
//           <View style={[s.doneIcon, {
//             backgroundColor: rideState === 'COMPLETED' ? Colors.greenBg : Colors.redBg,
//           }]}>
//             <Ionicons
//               name={rideState === 'COMPLETED' ? 'checkmark-circle' : 'close-circle'}
//               size={64}
//               color={rideState === 'COMPLETED' ? Colors.green : Colors.red}
//             />
//           </View>
//           <Text style={[s.doneTitle, { color: Colors.text }]}>
//             {rideState === 'COMPLETED' ? 'Course terminée' : 'Course annulée'}
//           </Text>
//           <Text style={[s.doneSub, { color: Colors.textMuted }]}>
//             {rideState === 'COMPLETED'
//               ? `Montant : ${ride.price?.toLocaleString() ?? '--'} FCFA`
//               : 'La course a été annulée.'}
//           </Text>
//           <TouchableOpacity
//             style={[s.doneBtn, { backgroundColor: Colors.orange }]}
//             onPress={handleBackToDashboard}
//           >
//             <Text style={s.doneBtnTxt}>RETOUR AU RADAR</Text>
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // RENDU COURSE ACTIVE
//   // ─────────────────────────────────────────────────────────────────────────
//   return (
//     <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>

//       {/* Carte plein écran */}
//       <View style={[s.mapFull, { height: SCREEN_H * 0.45 }]}>
//         <WebView
//           key={mapKey}
//           source={{ html: mapHTML }}
//           style={s.map}
//           javaScriptEnabled
//           domStorageEnabled
//           scrollEnabled={false}
//         />
//         {/* Badge état flottant */}
//         <View style={[s.statePill, { backgroundColor: cfg.bg }]}>
//           <View style={[s.stateDot, { backgroundColor: cfg.color }]} />
//           <Text style={[s.statePillTxt, { color: cfg.color }]}>{cfg.label}</Text>
//         </View>
//       </View>

//       {/* Panel bas */}
//       <ScrollView
//         style={[s.panel, { backgroundColor: Colors.background }]}
//         contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: 40 }}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Infos passager */}
//         <View style={[s.passengerCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//           <View style={s.passengerTop}>
//             <View style={[s.passengerAvatar, { backgroundColor: Colors.orange }]}>
//               <Text style={s.passengerAvatarTxt}>{passengerInitial}</Text>
//             </View>
//             <View style={{ flex: 1 }}>
//               <Text style={[s.passengerLabel, { color: Colors.textMuted }]}>PASSAGER</Text>
//               <Text style={[s.passengerName, { color: Colors.text }]}>{passengerName}</Text>
//             </View>
//             {/* Prix */}
//             <View style={s.priceBlock}>
//               <Text style={[s.priceVal, { color: Colors.text }]}>
//                 {ride.price?.toLocaleString()}
//               </Text>
//               <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
//             </View>
//           </View>

//           {/* Téléphone */}
//           {passengerPhone && (
//             <TouchableOpacity
//               style={[s.phoneRow, { backgroundColor: Colors.input }]}
//               onPress={() => handleCallPassenger(passengerPhone)}
//               activeOpacity={0.8}
//             >
//               <Ionicons name="call-outline" size={16} color={Colors.orange} />
//               <Text style={[s.phoneTxt, { color: Colors.text }]}>{passengerPhone}</Text>
//               <Text style={[s.phoneAction, { color: Colors.orange }]}>APPELER</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {/* Itinéraire */}
//         <View style={[s.routeCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//           <View style={s.routeRow}>
//             <View style={[s.dotFilled, { backgroundColor: Colors.orange }]} />
//             <View style={{ flex: 1 }}>
//               <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DÉPART</Text>
//               <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
//                 {ride.startPoint}
//               </Text>
//             </View>
//           </View>
//           <View style={[s.vLine, { backgroundColor: Colors.cardBorder }]} />
//           <View style={s.routeRow}>
//             <View style={[s.dotOutline, { borderColor: Colors.text }]} />
//             <View style={{ flex: 1 }}>
//               <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DESTINATION</Text>
//               <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
//                 {ride.endPoint}
//               </Text>
//             </View>
//           </View>
//         </View>

//         {/* ── Action buttons ── */}

//         {/* CREATED : Démarrer la course */}
//         {rideState === 'CREATED' && (
//           <TouchableOpacity
//             style={[s.actionBtn, { backgroundColor: Colors.orange }]}
//             onPress={handleStart}
//             disabled={actionLoading}
//             activeOpacity={0.85}
//           >
//             {actionLoading
//               ? <ActivityIndicator color="#0D0D0D" />
//               : <>
//                   <Ionicons name="play" size={18} color="#0D0D0D" />
//                   <Text style={s.actionBtnTxt}>DÉMARRER LA COURSE</Text>
//                 </>
//             }
//           </TouchableOpacity>
//         )}

//         {/* ONGOING : Terminer la course */}
//         {rideState === 'ONGOING' && (
//           <TouchableOpacity
//             style={[s.actionBtn, { backgroundColor: Colors.green }]}
//             onPress={handleComplete}
//             disabled={actionLoading}
//             activeOpacity={0.85}
//           >
//             {actionLoading
//               ? <ActivityIndicator color="#fff" />
//               : <>
//                   <Ionicons name="checkmark" size={18} color="#fff" />
//                   <Text style={[s.actionBtnTxt, { color: '#fff' }]}>TERMINER LA COURSE</Text>
//                 </>
//             }
//           </TouchableOpacity>
//         )}

//         {/* GPS status */}
//         <View style={s.gpsRow}>
//           <View style={[s.gpsDot, { backgroundColor: driverPos ? Colors.green : Colors.textMuted }]} />
//           <Text style={[s.gpsTxt, { color: Colors.textMuted }]}>
//             {driverPos
//               ? `GPS actif · ${driverPos.lat.toFixed(5)}, ${driverPos.lon.toFixed(5)}`
//               : 'Localisation en cours...'}
//           </Text>
//         </View>

//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const s = StyleSheet.create({
//   safe:     { flex: 1 },
//   centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
//   hint:     { fontWeight: '700', fontSize: 13, textAlign: 'center' },
//   backBtn2: { marginTop: 12, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },

//   // Carte
//   mapFull:  { position: 'relative', overflow: 'hidden' },
//   map:      { flex: 1 },
//   statePill: {
//     position: 'absolute', top: 12, left: 12,
//     flexDirection: 'row', alignItems: 'center', gap: 6,
//     borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
//   },
//   stateDot:    { width: 7, height: 7, borderRadius: 4 },
//   statePillTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },

//   // Panel
//   panel: { flex: 1 },

//   // Passager
//   passengerCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
//   passengerTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   passengerAvatar: {
//     width: 48, height: 48, borderRadius: 14,
//     alignItems: 'center', justifyContent: 'center',
//   },
//   passengerAvatarTxt: { color: '#fff', fontWeight: '900', fontSize: 20 },
//   passengerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
//   passengerName:  { fontSize: 16, fontWeight: '900', marginTop: 2 },
//   priceBlock:     { alignItems: 'flex-end' },
//   priceVal:       { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
//   priceCurr:      { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: -2 },
//   phoneRow: {
//     flexDirection: 'row', alignItems: 'center', gap: 8,
//     borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11,
//   },
//   phoneTxt:    { flex: 1, fontWeight: '700', fontSize: 14 },
//   phoneAction: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },

//   // Itinéraire
//   routeCard:  { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
//   routeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 48 },
//   routeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
//   routePlace: { fontSize: 14, fontWeight: '700', marginTop: 2 },
//   dotFilled:  { width: 11, height: 11, borderRadius: 6, marginTop: 12, flexShrink: 0 },
//   dotOutline: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, marginTop: 12, flexShrink: 0 },
//   vLine:      { width: 2, height: 16, marginLeft: 4, marginVertical: 2 },

//   // Bouton action
//   actionBtn: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 10, borderRadius: Radius.xl, paddingVertical: 18,
//     shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.25, elevation: 5,
//   },
//   actionBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 14, letterSpacing: 2 },

//   // GPS
//   gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
//   gpsDot: { width: 6, height: 6, borderRadius: 3 },
//   gpsTxt: { fontSize: 10, fontWeight: '600' },

//   // Done screen
//   doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
//   doneIcon:   { width: 120, height: 120, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
//   doneTitle:  { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
//   doneSub:    { fontSize: 15, fontWeight: '700', textAlign: 'center' },
//   doneBtn:    { borderRadius: Radius.xl, paddingHorizontal: 32, paddingVertical: 16, marginTop: 8 },
//   doneBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
// });



