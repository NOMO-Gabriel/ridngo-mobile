import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { router, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { LocationSearch } from '../../src/components/LocationSearch';
import { rideService, clearPassengerRideData } from '../../src/services/rideService';
import { Spacing, Radius } from '../../src/types/theme';
import { Location, OfferResponse, Bid } from '../../src/types/api';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type Step = 'search' | 'price' | 'waiting' | 'active' | 'review';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FareEstimate {
  prix_moyen: number;
  prix_min: number;
  prix_max: number;
  distance: number;
  duree: number;
}

// ─────────────────────────────────────────────
// POI DATA (40 points d'intérêt de Yaoundé)
// ─────────────────────────────────────────────
const POINTS_INTERET = [
  { nom: "Dispensaire Messassi", latitude: 3.9463, longitude: 11.5221 },
  { nom: "Hôpital Central de Yaoundé", latitude: 3.8681, longitude: 11.5135 },
  { nom: "Hôpital Gynéco-Obstétrique et Pédiatrique (Ngousso)", latitude: 3.9015, longitude: 11.5401 },
  { nom: "Centre Hospitalier Universitaire (CHU) de Yaoundé", latitude: 3.8628, longitude: 11.4961 },
  { nom: "Hôpital Jamot", latitude: 3.8824, longitude: 11.5303 },
  { nom: "Hôpital de District de Djoungolo", latitude: 3.8817, longitude: 11.5225 },
  { nom: "Monument de la Réunification", latitude: 3.8506, longitude: 11.5131 },
  { nom: "Statue de Charles Atangana", latitude: 3.8651, longitude: 11.5165 },
  { nom: "Monument J'aime mon pays (Éducation)", latitude: 3.8712, longitude: 11.5186 },
  { nom: "Musée National du Cameroun", latitude: 3.8633, longitude: 11.5175 },
  { nom: "Palais des Congrès de Yaoundé", latitude: 3.8936, longitude: 11.5039 },
  { nom: "Stade Ahmadou Ahidjo (Omnisports)", latitude: 3.8847, longitude: 11.5414 },
  { nom: "Palais Polyvalent des Sports (Warda)", latitude: 3.8739, longitude: 11.5119 },
  { nom: "Complexe Sportif d'Olembe", latitude: 3.9514, longitude: 11.5369 },
  { nom: "Parcours Vita", latitude: 3.9031, longitude: 11.4965 },
  { nom: "Université de Yaoundé I (Ngoa-Ekellé)", latitude: 3.8595, longitude: 11.5002 },
  { nom: "Université de Yaoundé II (Soa)", latitude: 3.9833, longitude: 11.6000 },
  { nom: "Hôtel de Ville de Yaoundé", latitude: 3.8617, longitude: 11.5208 },
  { nom: "Palais de l'Unité (Présidence)", latitude: 3.8961, longitude: 11.5136 },
  { nom: "Gare Voyageurs de Yaoundé (Camrail)", latitude: 3.8689, longitude: 11.5244 },
  { nom: "Aéroport de Yaoundé-Ville", latitude: 3.8364, longitude: 11.5208 },
  { nom: "Marché Central", latitude: 3.8647, longitude: 11.5233 },
  { nom: "Marché Mokolo", latitude: 3.8725, longitude: 11.4981 },
  { nom: "Carrefour Mvog Mbi", latitude: 3.8512, longitude: 11.5219 },
  { nom: "Carrefour Coron", latitude: 3.8471, longitude: 11.5207 },
  { nom: "Carrefour Carrière", latitude: 3.8852, longitude: 11.4919 },
  { nom: "Rond-point Warda (Palais des Sports)", latitude: 3.8739, longitude: 11.5119 },
  { nom: "Rond-point Poste Centrale", latitude: 3.8641, longitude: 11.5195 },
  { nom: "Carrefour Bastos", latitude: 3.8945, longitude: 11.5112 },
  { nom: "Carrefour Obili", latitude: 3.8614, longitude: 11.4915 },
  { nom: "Carrefour Biyem-Assi (Acacias)", latitude: 3.8415, longitude: 11.4884 },
  { nom: "Bastos (Quartier résidentiel/ambassades)", latitude: 3.8967, longitude: 11.5125 },
  { nom: "Mokolo (Grand marché)", latitude: 3.8725, longitude: 11.4981 },
  { nom: "Biyem-Assi", latitude: 3.8392, longitude: 11.4851 },
  { nom: "Etoudi (Quartier de la Présidence)", latitude: 3.9156, longitude: 11.5292 },
  { nom: "Ngoa-Ekellé (Cité universitaire)", latitude: 3.8595, longitude: 11.5002 },
  { nom: "Nsam", latitude: 3.8292, longitude: 11.5090 },
  { nom: "Messassi (Sortie Nord)", latitude: 3.9463, longitude: 11.5221 },
  { nom: "Essos", latitude: 3.8735, longitude: 11.5365 },
  { nom: "Mimboman", latitude: 3.8658, longitude: 11.5512 },
];

// ─────────────────────────────────────────────
// buildMapHTML — Carte Leaflet complète
// Inclut : POI, marqueurs départ/dest, tracé OSRM, fitBounds
// ─────────────────────────────────────────────
const buildMapHTML = (
  pickup?: Location | null,
  dest?: Location | null,
  partnerLat?: number,
  partnerLon?: number,
  routeGeoJson?: object | null
) => {
  const centerLat = pickup?.lat ?? 3.848;
  const centerLon = pickup?.lon ?? 11.502;
  const zoom = pickup ? 14 : 12;

  // Escape apostrophes pour éviter de casser le JS injecté
  const escapeName = (name?: string) =>
    (name || '').split(',')[0].replace(/'/g, "\\'").replace(/"/g, '\\"');

  const pickupMarker = pickup
    ? `L.marker([${pickup.lat}, ${pickup.lon}], {icon: orangeIcon})
        .addTo(map)
        .bindPopup('${escapeName(pickup.name)} (départ)');`
    : '';

  const destMarker = dest
    ? `L.marker([${dest.lat}, ${dest.lon}], {icon: blueIcon})
        .addTo(map)
        .bindPopup('${escapeName(dest.name)} (destination)');`
    : '';

  const partnerMarker = partnerLat && partnerLon
    ? `L.marker([${partnerLat}, ${partnerLon}], {icon: carIcon}).addTo(map).bindPopup('Chauffeur');`
    : '';

  // fitBounds sur le tracé si disponible, sinon sur les 2 marqueurs
  const fitBounds = routeGeoJson
    ? `var routeLine = L.geoJSON(${JSON.stringify(routeGeoJson)}, {
        style: { color: '#FF8C00', weight: 5, opacity: 0.9 }
       }).addTo(map);
       map.fitBounds(routeLine.getBounds(), {padding: [50, 50]});`
    : pickup && dest
      ? `map.fitBounds([[${pickup.lat}, ${pickup.lon}], [${dest.lat}, ${dest.lon}]], {padding: [60, 60]});`
      : '';

  // POI markers — icône distincte (carré violet avec épingle)
  const poiMarkersJS = POINTS_INTERET.map(poi =>
    `L.marker([${poi.latitude}, ${poi.longitude}], {icon: poiIcon})
      .addTo(map)
      .bindPopup('${poi.nom.replace(/'/g, "\\'").replace(/"/g, '\\"')}');`
  ).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map { margin:0; padding:0; width:100%; height:100%; background:#1a1a1a; }
  .poi-icon-inner {
    width: 12px; height: 12px;
    border-radius: 3px;
    background: #8B5CF6;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.6);
  }
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: false, attributionControl: false})
  .setView([${centerLat}, ${centerLon}], ${zoom});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Marqueur départ : cercle orange
var orangeIcon = L.divIcon({
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
  iconSize: [18,18], iconAnchor: [9,9], className: ''
});

// Marqueur destination : cercle bleu
var blueIcon = L.divIcon({
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
  iconSize: [18,18], iconAnchor: [9,9], className: ''
});

// Marqueur chauffeur : emoji voiture
var carIcon = L.divIcon({
  html: '<div style="font-size:24px;line-height:1">🚗</div>',
  iconSize: [24,24], iconAnchor: [12,12], className: ''
});

// Marqueur POI : carré violet distinctif
var poiIcon = L.divIcon({
  html: '<div class="poi-icon-inner"></div>',
  iconSize: [12,12], iconAnchor: [6,6], className: ''
});

// ── POI (chargés en premier, sous les autres marqueurs) ──
${poiMarkersJS}

// ── Marqueurs départ / destination ──
${pickupMarker}
${destMarker}
${partnerMarker}

// ── Tracé itinéraire OSRM ou fitBounds simple ──
${fitBounds}

// ── Message vers React Native au tap sur la carte ──
map.on('click', function(e) {
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'mapTap', lat: e.latlng.lat, lon: e.latlng.lng })
  );
});
</script></body></html>`;
};

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
export default function RideScreen() {
  const { user, logout } = useAuth();
  const { Colors } = useTheme();

  // ── États de navigation
  const [step, setStep] = useState<Step>('search');

  // ── Carte
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dest, setDest] = useState<Location | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [routeGeoJson, setRouteGeoJson] = useState<object | null>(null);
  const webviewRef = useRef<WebView>(null);

  // ── Estimation tarifaire
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [priceNum, setPriceNum] = useState(0);
  const [loadingFare, setLoadingFare] = useState(false);

  // ── Publication offre
  const [myPhone, setMyPhone] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [forTiers, setForTiers] = useState(false);
  const [departureTime, setDepartureTime] = useState(new Date().toISOString());
  const [loading, setLoading] = useState(false);

  // ── Course / attente
  const [currentOffer, setCurrentOffer] = useState<OfferResponse | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  useEffect(() => {
    loadPassengerPhone();
    checkExistingRide();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Rafraîchir la carte à chaque changement de coordonnées ou tracé
  useEffect(() => {
    setMapKey(k => k + 1);
  }, [pickup?.lat, pickup?.lon, dest?.lat, dest?.lon, tracking?.latitude, routeGeoJson]);

  const loadPassengerPhone = async () => {
    try {
      const stored = await SecureStore.getItemAsync('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setMyPhone(parsed.phone || parsed.telephone || '');
      }
    } catch { /* silent */ }
  };

  const checkExistingRide = async () => {
    try {
      // 1. activeRideId en SecureStore → vérifier l'état réel du trip
      const storedRideId = await SecureStore.getItemAsync('activeRideId');
      if (storedRideId) {
        try {
          const rideData = await rideService.getRideDetails(storedRideId);
          if (rideData.state === 'COMPLETED' || rideData.state === 'CANCELLED') {
            // Course déjà terminée → nettoyer et rester sur search
            await clearPassengerRideData();
            return;
          }
          // Course encore active → lancer le polling
          setActiveRideId(storedRideId);
          setStep('active');
          startTrackingPolling(storedRideId);
          return;
        } catch {
          await clearPassengerRideData();
        }
      }

      // 2. Offre en attente ?
      const storedOfferId = await SecureStore.getItemAsync('currentOfferId');
      if (storedOfferId) {
        try {
          const offerData = await rideService.getOfferBids(storedOfferId);
          if (offerData.state === 'CANCELLED') {
            await SecureStore.deleteItemAsync('currentOfferId');
          } else if (offerData.state === 'VALIDATED') {
            const rideData = await rideService.getRideByOffer(storedOfferId);
            if (rideData.state === 'COMPLETED' || rideData.state === 'CANCELLED') {
              await clearPassengerRideData();
            } else {
              await SecureStore.setItemAsync('activeRideId', rideData.id);
              setActiveRideId(rideData.id);
              setStep('active');
              startTrackingPolling(rideData.id);
            }
          }
        } catch { /* silent */ }
      }
    } catch { /* silent */ }
  };

  // Vérifier si une offre est en cours (pour afficher le badge)
  const [hasActiveOffer, setHasActiveOffer] = React.useState(false);
  React.useEffect(() => {
    SecureStore.getItemAsync('currentOfferId').then(id => setHasActiveOffer(!!id)).catch(() => {});
  }, []);

  // ─────────────────────────────────────────────
  // F2 — TRACÉ OSRM (dans le HTML WebView)
  // Fallback : ligne droite si OSRM inaccessible
  // ─────────────────────────────────────────────
  const fetchRoute = async (start: Location, end: Location) => {
    // Essai 1 : OSRM public
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.lon},${start.lat};${end.lon},${end.lat}` +
      `?overview=full&geometries=geojson`;

    try {
      console.log('[OSRM] Appel :', osrmUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();

      if (data?.routes?.[0]?.geometry) {
        console.log('[OSRM] Tracé reçu ✓');
        setRouteGeoJson(data.routes[0].geometry);
        return;
      }
      throw new Error('OSRM : geometry absent');
    } catch (e: any) {
      console.warn('[OSRM] Echec :', e?.message ?? e);
    }

    // Essai 2 : OSRM alternatif
    const osrmAlt =
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/` +
      `${start.lon},${start.lat};${end.lon},${end.lat}` +
      `?overview=full&geometries=geojson`;
    try {
      console.log('[OSRM-alt] Appel :', osrmAlt);
      const res2 = await fetch(osrmAlt);
      const data2 = await res2.json();
      if (data2?.routes?.[0]?.geometry) {
        console.log('[OSRM-alt] Tracé reçu ✓');
        setRouteGeoJson(data2.routes[0].geometry);
        return;
      }
    } catch (e2: any) {
      console.warn('[OSRM-alt] Echec :', e2?.message ?? e2);
    }

    // Fallback : ligne droite GeoJSON (toujours visible)
    console.log('[Route] Fallback ligne droite');
    setRouteGeoJson({
      type: 'LineString',
      coordinates: [
        [start.lon, start.lat],
        [end.lon, end.lat],
      ],
    });
  };

  // ─────────────────────────────────────────────
  // F3 — ESTIMATION TARIFAIRE
  // Utilise rideService.estimateFare (Axios, token auto)
  // ─────────────────────────────────────────────
  const handleEstimate = async () => {
    if (!pickup || !dest) return;
    setLoadingFare(true);
    try {
      console.log('[Estimate] Coords:', pickup.lat, pickup.lon, '->', dest.lat, dest.lon);

      // On envoie les coordonnées "lat,lon" pour une meilleure précision
      const raw = await rideService.estimateFare(
        `${pickup.lat},${pickup.lon}`,
        `${dest.lat},${dest.lon}`
      );
      console.log('[Estimate] Réponse brute:', JSON.stringify(raw));

      // Le type mobile FareResponse est incomplet — on cast en any pour lire tous les champs
      const data = raw as any;

      const fare: FareEstimate = {
        prix_moyen: data.prix_moyen ?? data.estimatedPrice ?? data.price ?? 0,
        prix_min:   data.prix_min   ?? Math.round((data.prix_moyen ?? 0) * 0.85),
        prix_max:   data.prix_max   ?? Math.round((data.prix_moyen ?? 0) * 1.15),
        distance:   data.distance   ?? 0,
        duree:      data.duree      ?? data.duration ?? 0,
      };

      console.log('[Estimate] Fare normalisé:', fare);

      if (!fare.prix_moyen) {
        throw new Error(`prix_moyen absent dans la réponse : ${JSON.stringify(data)}`);
      }

      setFareEstimate(fare);
      // Arrondir au multiple de 50 le plus proche
      setPriceNum(Math.round(fare.prix_moyen / 50) * 50);

      // Charger le tracé en parallèle (non bloquant)
      fetchRoute(pickup, dest).catch(console.warn);

      setStep('price');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error  ||
        e?.message                ||
        'Erreur inconnue';
      console.error('[Estimate] ERREUR:', msg, e);
      Alert.alert(
        'Erreur estimation',
        `Détail : ${msg}\n\nVérifiez votre connexion et réessayez.`
      );
    } finally {
      setLoadingFare(false);
    }
  };

  // ─────────────────────────────────────────────
  // F4 — PUBLICATION DE L'OFFRE
  // Utilise rideService.createOffer (Axios + token auto)
  // ─────────────────────────────────────────────
  const handlePublishOffer = async () => {
    if (!pickup || !dest || !priceNum) return;
    const phone = forTiers ? thirdPartyPhone : myPhone;
    if (!phone) {
      Alert.alert('Téléphone requis', 'Veuillez saisir un numéro de téléphone.');
      return;
    }
    setLoading(true);
    try {
      console.log('[Publish] Envoi offre via rideService.createOffer');
      const offer = await rideService.createOffer({
        startPoint: pickup.name,
        startLat: parseFloat(String(pickup.lat)),
        startLon: parseFloat(String(pickup.lon)),
        endPoint: dest.name,
        endLat: parseFloat(String(dest.lat)),
        endLon: parseFloat(String(dest.lon)),
        price: priceNum,
        passengerPhone: phone,
        departureTime: departureTime,
      });

      console.log('[Publish] Offre créée :', offer.id);
      await SecureStore.setItemAsync('currentOfferId', offer.id);
      setCurrentOffer(offer);
      setStep('waiting');
      startPolling(offer.id);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error  ||
        e?.message                ||
        "Impossible de publier l'offre.";
      console.error('[Publish] ERREUR:', msg);
      Alert.alert('Erreur publication', msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // POLLING — attente de validation
  // ─────────────────────────────────────────────
  const startPolling = (offerId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const updated = await rideService.getOfferBids(offerId);
        setCurrentOffer(updated);
        if (updated.state === 'VALIDATED') {
          clearInterval(pollRef.current!);
          const ride = await rideService.getRideByOffer(offerId);
          setActiveRideId(ride.id);
          setStep('active');
          startTrackingPolling(ride.id);
        }
      } catch { /* silent */ }
    }, 4000);
  };

  const startTrackingPolling = (rideId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        // Vérifier si la course est terminée (chauffeur a appuyé COMPLETED)
        const rideData = await rideService.getRideDetails(rideId);
        if (rideData.state === 'COMPLETED') {
          clearInterval(pollRef.current!);
          await clearPassengerRideData();
          setHasActiveOffer(false);
          setStep('review');
          return;
        }
        if (rideData.state === 'CANCELLED') {
          clearInterval(pollRef.current!);
          await clearPassengerRideData();
          setHasActiveOffer(false);
          setStep('search');
          return;
        }
        // Tracking GPS
        try {
          const t = await rideService.getTrackingInfo(rideId);
          setTracking(t);
        } catch { /* GPS peut être absent */ }
      } catch { /* silent */ }
    }, 4000);
  };

  const handleSelectDriver = async (driverId: string) => {
    if (!currentOffer) return;
    try {
      await rideService.selectDriver(currentOffer.id, driverId);
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner ce chauffeur.');
    }
  };

  const handleCancelOffer = () => {
    Alert.alert('Annuler', 'Voulez-vous annuler la recherche ?', [
      { text: 'Non' },
      {
        text: 'Oui', style: 'destructive', onPress: async () => {
          if (pollRef.current) clearInterval(pollRef.current);
          try { await SecureStore.deleteItemAsync('currentOfferId'); } catch { /* silent */ }
          setCurrentOffer(null);
          setRouteGeoJson(null);
          setFareEstimate(null);
          setStep('search');
        }
      },
    ]);
  };

  // Le passager ne termine pas la course — seul le chauffeur le fait.
  // Cette fonction est conservée pour compatibilité mais ne fait rien.
  const handleFinishRide = () => {};

  const handleSubmitReview = async () => {
    if (!activeRideId) return;
    try {
      await rideService.submitReview(activeRideId, stars, comment);
    } catch { /* silent */ }
    await clearPassengerRideData();
    setStep('search');
    setHasActiveOffer(false);
    setPickup(null);
    setDest(null);
    setRouteGeoJson(null);
    setFareEstimate(null);
    setPriceNum(0);
    setCurrentOffer(null);
    setActiveRideId(null);
  };

  // ─────────────────────────────────────────────
  // HANDLER — tap sur la carte (message WebView)
  // ─────────────────────────────────────────────
  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== 'mapTap') return;
      const { lat, lon } = msg;

      // Reverse geocoding Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      const name =
        [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town]
          .filter(Boolean).join(', ') ||
        data.display_name?.split(',').slice(0, 2).join(',') ||
        `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      const loc: Location = { name, lat, lon };

      if (!pickup) {
        setPickup(loc);
      } else if (!dest) {
        setDest(loc);
      }
      // Si les deux sont remplis → ne rien faire
    } catch { /* silent */ }
  }, [pickup, dest]);

  // ─────────────────────────────────────────────
  // HTML de la carte (mémoïsé)
  // ─────────────────────────────────────────────
  const mapHTML = buildMapHTML(
    pickup, dest,
    tracking?.latitude, tracking?.longitude,
    routeGeoJson
  );

  // ─────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]}>
      {/* ── CARTE EN FOND ── */}
      <View style={styles.mapContainer}>
        <WebView
          key={mapKey}
          ref={webviewRef}
          source={{ html: mapHTML }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleWebViewMessage}
          scrollEnabled={false}
        />
      </View>

      {/* ── PANEL BOTTOM-SHEET ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.panelWrapper}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={[styles.panel, { backgroundColor: Colors.card }]}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.panelHeader}>
            <View style={[styles.panelHandle, { backgroundColor: Colors.cardBorder }]} />
            <View style={styles.headerRow}>
              <Text style={[styles.panelTitle, { color: Colors.text }]}>
                {step === 'search' && 'Où allez-vous ?'}
                {step === 'price' && 'Votre tarif'}
                {step === 'waiting' && 'En attente…'}
                {step === 'active' && 'Course en cours'}
                {step === 'review' && 'Évaluation'}
              </Text>
              <ThemeToggle />
            </View>
          </View>

          {/* ══════════════════════════════════════
              STEP : SEARCH
          ══════════════════════════════════════ */}
          {step === 'search' && (
            <View style={styles.searchSection}>
              {/* Champ départ */}
              <LocationSearch
                placeholder="Lieu de départ (ex : Bastos)"
                value={pickup?.name || ''}
                onSelect={setPickup}
                icon="navigate"
                showGPS
                Colors={Colors}
              />

              {/* Champ destination */}
              <LocationSearch
                placeholder="Destination (ex : Marché Central)"
                value={dest?.name || ''}
                onSelect={setDest}
                icon="location"
                Colors={Colors}
              />

              {/* Info tap carte */}
              <Text style={[styles.tapHint, { color: Colors.textMuted }]}>
                Vous pouvez aussi taper directement sur la carte pour sélectionner un point.
              </Text>

              {/* Bouton discret "Mon offre en cours" */}
              {hasActiveOffer && (
                <TouchableOpacity
                  style={[styles.activeOfferBtn, { backgroundColor: Colors.orangeBg, borderColor: Colors.orange }]}
                  onPress={() => router.push('/(passenger)/my-offer' as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.activeOfferDot, { backgroundColor: Colors.orange }]} />
                  <Text style={[styles.activeOfferTxt, { color: Colors.orange }]}>
                    Offre en cours — voir les chauffeurs
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.orange} />
                </TouchableOpacity>
              )}

              {/* Bouton Estimer */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: pickup && dest ? '#FF8C00' : Colors.cardBorder },
                ]}
                onPress={handleEstimate}
                disabled={!pickup || !dest || loadingFare}
                activeOpacity={0.8}
              >
                {loadingFare
                  ? <ActivityIndicator color="#0D0D0D" />
                  : <Text style={styles.primaryBtnText}>Estimer le prix</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════
              STEP : PRICE — Finalisez votre offre
          ══════════════════════════════════════ */}
          {step === 'price' && (
            <View style={styles.priceSection}>

              {/* Titre */}
              <View style={styles.priceTitleBlock}>
                <Text style={[styles.priceTitleMain, { color: Colors.text }]}>Finalisez votre offre</Text>
                <Text style={[styles.priceTitleSub, { color: Colors.textMuted }]}>AJUSTEZ LE PRIX ET LE CONTACT</Text>
              </View>

              {/* Contrôle prix +/- */}
              <View style={[styles.priceControl, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
                <TouchableOpacity
                  style={[styles.priceBtn, { backgroundColor: Colors.input }]}
                  onPress={() => setPriceNum(p => Math.max(0, p - 50))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.priceBtnText, { color: Colors.text }]}>-</Text>
                </TouchableOpacity>
                <View style={styles.priceDisplay}>
                  <Text style={[styles.priceValue, { color: Colors.text }]}>{priceNum}</Text>
                  <Text style={[styles.priceCurrency, { color: Colors.textMuted }]}>FCFA</Text>
                </View>
                <TouchableOpacity
                  style={[styles.priceBtn, { backgroundColor: '#FF8C00' }]}
                  onPress={() => setPriceNum(p => p + 50)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.priceBtnText, { color: '#0D0D0D' }]}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Info min/distance/durée */}
              {fareEstimate && (
                <View style={[styles.fareInfoRow, { borderColor: Colors.cardBorder }]}>
                  <View style={styles.fareInfoItem}>
                    <Text style={[styles.fareInfoVal, { color: Colors.text }]}>
                      {fareEstimate.distance > 1000
                        ? `${(fareEstimate.distance / 1000).toFixed(1)} km`
                        : `${Math.round(fareEstimate.distance)} m`}
                    </Text>
                    <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Distance</Text>
                  </View>
                  <View style={[styles.fareInfoDiv, { backgroundColor: Colors.cardBorder }]} />
                  <View style={styles.fareInfoItem}>
                    <Text style={[styles.fareInfoVal, { color: Colors.text }]}>
                      {fareEstimate.duree > 0 ? `${Math.round(fareEstimate.duree / 60)} min` : '--'}
                    </Text>
                    <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Durée</Text>
                  </View>
                  <View style={[styles.fareInfoDiv, { backgroundColor: Colors.cardBorder }]} />
                  <View style={styles.fareInfoItem}>
                    <Text style={[styles.fareInfoVal, { color: Colors.text }]}>{fareEstimate.prix_min} F</Text>
                    <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Prix min</Text>
                  </View>
                </View>
              )}

              {/* Toggle Pour moi / Pour un tiers */}
              <View style={[styles.toggleRow, { backgroundColor: Colors.input }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !forTiers && { borderBottomWidth: 2, borderBottomColor: '#FF8C00' }]}
                  onPress={() => setForTiers(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-outline" size={14} color={!forTiers ? '#FF8C00' : Colors.textMuted} />
                  <Text style={[styles.toggleBtnText, { color: !forTiers ? '#FF8C00' : Colors.textMuted }]}>
                    POUR MOI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, forTiers && { borderBottomWidth: 2, borderBottomColor: '#FF8C00' }]}
                  onPress={() => setForTiers(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={14} color={forTiers ? '#FF8C00' : Colors.textMuted} />
                  <Text style={[styles.toggleBtnText, { color: forTiers ? '#FF8C00' : Colors.textMuted }]}>
                    POUR UN TIERS
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Numéro de téléphone */}
              <View style={[styles.phoneRow, { backgroundColor: Colors.input, borderColor: Colors.inputBorder }]}>
                <Ionicons name="call-outline" size={18} color="#FF8C00" style={{ marginRight: 8 }} />
                {forTiers ? (
                  <TextInput
                    style={[styles.phoneInput, { color: Colors.text }]}
                    value={thirdPartyPhone}
                    onChangeText={setThirdPartyPhone}
                    keyboardType="phone-pad"
                    placeholder="Numéro du bénéficiaire"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.phoneStatic, { color: Colors.text }]}>{myPhone || '---'}</Text>
                )}
              </View>

              {/* Heure de départ */}
              <View style={[styles.phoneRow, { backgroundColor: Colors.input, borderColor: Colors.inputBorder }]}>
                <Ionicons name="time-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.phoneInput, { color: Colors.text, flex: 1 }]}
                  value={departureTime.slice(0, 16).replace('T', ' ')}
                  onChangeText={v => {
                    try { setDepartureTime(new Date(v.replace(' ', 'T')).toISOString()); } catch {}
                  }}
                  placeholder="AAAA-MM-JJ HH:MM"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={[styles.toggleBtnText, { color: Colors.textMuted }]}>DÉPART</Text>
              </View>

              {/* Boutons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: Colors.cardBorder }]}
                  onPress={() => { setStep('search'); setRouteGeoJson(null); setFareEstimate(null); }}
                >
                  <Text style={[styles.secondaryBtnText, { color: Colors.text }]}>Retour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.publishBtn, { backgroundColor: priceNum > 0 ? '#FF8C00' : Colors.cardBorder }]}
                  onPress={handlePublishOffer}
                  disabled={!priceNum || loading}
                  activeOpacity={0.8}
                >
                  {loading
                    ? <ActivityIndicator color="#0D0D0D" />
                    : <Text style={styles.primaryBtnText}>LANCER LA RECHERCHE</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
          {/* ══════════════════════════════════════
              STEP : WAITING — en attente des chauffeurs
          ══════════════════════════════════════ */}
          {step === 'waiting' && currentOffer && (
            <View style={styles.waitingSection}>
              <ActivityIndicator size="large" color="#FF8C00" style={{ marginBottom: 12 }} />
              <Text style={[styles.waitingTitle, { color: Colors.text }]}>
                Votre offre est visible !
              </Text>
              <Text style={[styles.waitingSubtitle, { color: Colors.textMuted }]}>
                Les chauffeurs disponibles vont répondre…
              </Text>

              {/* Résumé offre */}
              <View style={[styles.offerSummary, { backgroundColor: Colors.background, borderColor: Colors.cardBorder }]}>
                <Text style={[styles.offerSummaryText, { color: Colors.text }]}>
                  De : {currentOffer.startPoint}
                </Text>
                <Text style={[styles.offerSummaryText, { color: Colors.text }]}>
                  Vers : {currentOffer.endPoint}
                </Text>
                <Text style={[styles.offerSummaryPrice, { color: '#FF8C00' }]}>
                  {currentOffer.price} FCFA
                </Text>
              </View>

              {/* Liste des bids */}
              {(currentOffer as any).bids?.length > 0 && (
                <>
                  <Text style={[styles.bidsTitle, { color: Colors.text }]}>
                    {(currentOffer as any).bids.length} chauffeur(s) intéressé(s)
                  </Text>
                  {((currentOffer as any).bids as Bid[]).map((bid: Bid) => (
                    <View key={bid.driverId} style={[styles.bidCard, { backgroundColor: Colors.background, borderColor: Colors.cardBorder }]}>
                      <View>
                        <Text style={[styles.bidName, { color: Colors.text }]}>
                          {bid.driverName || `Chauffeur #${bid.driverId.slice(-4)}`}
                        </Text>
                        {bid.proposedPrice && (
                          <Text style={[styles.bidPrice, { color: Colors.textMuted }]}>
                            Prix proposé : {bid.proposedPrice} FCFA
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.chooseBtn}
                        onPress={() => handleSelectDriver(bid.driverId)}
                      >
                        <Text style={styles.chooseBtnText}>Choisir</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: Colors.cardBorder }]}
                onPress={handleCancelOffer}
              >
                <Text style={[styles.cancelBtnText, { color: '#EF4444' }]}>
                  Annuler ma demande
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════
              STEP : ACTIVE — course en cours (le chauffeur termine)
          ══════════════════════════════════════ */}
          {step === 'active' && (
            <View style={styles.activeSection}>
              <View style={[styles.activeBadge, { backgroundColor: Colors.greenBg }]}>
                <View style={[styles.activePulse, { backgroundColor: Colors.green }]} />
                <Text style={{ color: Colors.green, fontWeight: '900', fontSize: 13 }}>
                  Course en cours
                </Text>
              </View>
              <Text style={[styles.activeHint, { color: Colors.textMuted }]}>
                

              </Text>
            </View>
          )}

          {/* ══════════════════════════════════════
              STEP : REVIEW — évaluation
          ══════════════════════════════════════ */}
          {step === 'review' && (
            <View style={styles.reviewSection}>
              <Text style={[styles.reviewTitle, { color: Colors.text }]}>
                Comment s'est passé le trajet ?
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setStars(s)}>
                    <Ionicons
                      name={s <= stars ? 'star' : 'star-outline'}
                      size={32}
                      color="#FF8C00"
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.commentInput, {
                  color: Colors.text,
                  backgroundColor: Colors.background,
                  borderColor: Colors.cardBorder,
                }]}
                value={comment}
                onChangeText={setComment}
                placeholder="Un commentaire… (optionnel)"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#FF8C00' }]}
                onPress={handleSubmitReview}
              >
                <Text style={styles.primaryBtnText}>Envoyer l'évaluation</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.52;

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Carte
  mapContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  map: { flex: 1 },

  // Panel
  panelWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: PANEL_HEIGHT,
  },
  panel: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  panelContent: { paddingBottom: 40 },

  panelHeader: { paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 8 },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  panelTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },

  // Search step
  searchSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  tapHint: { fontSize: 12, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },

  // Price step
  priceSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  routeCard: {
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLine: { width: 2, height: 16, marginLeft: 5, marginVertical: 2 },
  routeText: { flex: 1, fontSize: 13, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4,
  },
  statValue: { fontWeight: '900', fontSize: 14 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1 },

  priceInputBlock: { gap: 4 },
  priceInputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceRecoInfo: { fontSize: 11, fontStyle: 'italic' },
  priceInput: {
    borderRadius: Radius.md, borderWidth: 1, padding: 12,
    fontWeight: '700', fontSize: 16,
  },

  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  secondaryBtn: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 13 },
  publishBtn: {
    flex: 2, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
  },

  // Shared button
  primaryBtn: {
    borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },

  // Waiting step
  waitingSection: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  waitingTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  waitingSubtitle: { fontSize: 13, textAlign: 'center' },
  offerSummary: {
    width: '100%', borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, gap: 4,
  },
  offerSummaryText: { fontSize: 13, fontWeight: '600' },
  offerSummaryPrice: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  bidsTitle: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start', marginTop: 8 },
  bidCard: {
    width: '100%', borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bidName: { fontWeight: '700', fontSize: 13 },
  bidPrice: { fontSize: 11 },
  chooseBtn: {
    backgroundColor: '#FF8C00', borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8,
  },
  chooseBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 12 },
  cancelBtn: {
    width: '100%', borderRadius: Radius.md, borderWidth: 1,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  cancelBtnText: { fontWeight: '700', fontSize: 13 },

  // Active step
  activeSection: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  activeBadge: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },

  // Review step
  reviewSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  reviewTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  commentInput: {
    borderRadius: Radius.md, borderWidth: 1, padding: 12,
    fontWeight: '500', fontSize: 14, textAlignVertical: 'top', minHeight: 80,
  },
  // ── Step price styles ──
  priceTitleBlock: { alignItems: 'center', paddingVertical: Spacing.sm },
  priceTitleMain: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  priceTitleSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },

  priceControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, borderWidth: 1, padding: 8, marginVertical: 4,
  },
  priceBtn: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  priceBtnText: { fontSize: 28, fontWeight: '900', lineHeight: 34 },
  priceDisplay: { alignItems: 'center', flex: 1 },
  priceValue: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  priceCurrency: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: -4 },

  fareInfoRow: {
    flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden',
  },
  fareInfoItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  fareInfoVal: { fontWeight: '900', fontSize: 13 },
  fareInfoLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  fareInfoDiv: { width: 1 },

  toggleRow: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden', marginVertical: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  toggleBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    marginVertical: 2,
  },
  phoneInput: { flex: 1, fontWeight: '700', fontSize: 15, padding: 0 },
  phoneStatic: { flex: 1, fontWeight: '700', fontSize: 15 },

  activeOfferBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  activeOfferDot: { width: 7, height: 7, borderRadius: 4 },
  activeOfferTxt: { flex: 1, fontSize: 12, fontWeight: '700' },

  activePulse: { width: 8, height: 8, borderRadius: 4 },
  activeHint:  { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginTop: 8 },

});
// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import {
//   View, Text, TouchableOpacity, StyleSheet,
//   ScrollView, ActivityIndicator, Alert, TextInput,
//   FlatList, KeyboardAvoidingView, Platform, Dimensions
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { router, useRouter } from 'expo-router';
// import { WebView } from 'react-native-webview';
// import { Ionicons } from '@expo/vector-icons';
// import * as SecureStore from 'expo-secure-store';
// import { useAuth } from '../../src/context/AuthContext';
// import { useTheme } from '../../src/context/ThemeContext';
// import { ThemeToggle } from '../../src/components/ThemeToggle';
// import { LocationSearch } from '../../src/components/LocationSearch';
// import { rideService,clearPassengerRideData } from '../../src/services/rideService';
// import { Spacing, Radius } from '../../src/types/theme';
// import { Location, OfferResponse, Bid } from '../../src/types/api';

// // ─────────────────────────────────────────────
// // TYPES
// // ─────────────────────────────────────────────
// type Step = 'search' | 'price' | 'waiting' | 'active' | 'review';
// const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// interface FareEstimate {
//   prix_moyen: number;
//   prix_min: number;
//   prix_max: number;
//   distance: number;
//   duree: number;
// }

// // ─────────────────────────────────────────────
// // POI DATA (40 points d'intérêt de Yaoundé)
// // ─────────────────────────────────────────────
// const POINTS_INTERET = [
//   { nom: "Dispensaire Messassi", latitude: 3.9463, longitude: 11.5221 },
//   { nom: "Hôpital Central de Yaoundé", latitude: 3.8681, longitude: 11.5135 },
//   { nom: "Hôpital Gynéco-Obstétrique et Pédiatrique (Ngousso)", latitude: 3.9015, longitude: 11.5401 },
//   { nom: "Centre Hospitalier Universitaire (CHU) de Yaoundé", latitude: 3.8628, longitude: 11.4961 },
//   { nom: "Hôpital Jamot", latitude: 3.8824, longitude: 11.5303 },
//   { nom: "Hôpital de District de Djoungolo", latitude: 3.8817, longitude: 11.5225 },
//   { nom: "Monument de la Réunification", latitude: 3.8506, longitude: 11.5131 },
//   { nom: "Statue de Charles Atangana", latitude: 3.8651, longitude: 11.5165 },
//   { nom: "Monument J'aime mon pays (Éducation)", latitude: 3.8712, longitude: 11.5186 },
//   { nom: "Musée National du Cameroun", latitude: 3.8633, longitude: 11.5175 },
//   { nom: "Palais des Congrès de Yaoundé", latitude: 3.8936, longitude: 11.5039 },
//   { nom: "Stade Ahmadou Ahidjo (Omnisports)", latitude: 3.8847, longitude: 11.5414 },
//   { nom: "Palais Polyvalent des Sports (Warda)", latitude: 3.8739, longitude: 11.5119 },
//   { nom: "Complexe Sportif d'Olembe", latitude: 3.9514, longitude: 11.5369 },
//   { nom: "Parcours Vita", latitude: 3.9031, longitude: 11.4965 },
//   { nom: "Université de Yaoundé I (Ngoa-Ekellé)", latitude: 3.8595, longitude: 11.5002 },
//   { nom: "Université de Yaoundé II (Soa)", latitude: 3.9833, longitude: 11.6000 },
//   { nom: "Hôtel de Ville de Yaoundé", latitude: 3.8617, longitude: 11.5208 },
//   { nom: "Palais de l'Unité (Présidence)", latitude: 3.8961, longitude: 11.5136 },
//   { nom: "Gare Voyageurs de Yaoundé (Camrail)", latitude: 3.8689, longitude: 11.5244 },
//   { nom: "Aéroport de Yaoundé-Ville", latitude: 3.8364, longitude: 11.5208 },
//   { nom: "Marché Central", latitude: 3.8647, longitude: 11.5233 },
//   { nom: "Marché Mokolo", latitude: 3.8725, longitude: 11.4981 },
//   { nom: "Carrefour Mvog Mbi", latitude: 3.8512, longitude: 11.5219 },
//   { nom: "Carrefour Coron", latitude: 3.8471, longitude: 11.5207 },
//   { nom: "Carrefour Carrière", latitude: 3.8852, longitude: 11.4919 },
//   { nom: "Rond-point Warda (Palais des Sports)", latitude: 3.8739, longitude: 11.5119 },
//   { nom: "Rond-point Poste Centrale", latitude: 3.8641, longitude: 11.5195 },
//   { nom: "Carrefour Bastos", latitude: 3.8945, longitude: 11.5112 },
//   { nom: "Carrefour Obili", latitude: 3.8614, longitude: 11.4915 },
//   { nom: "Carrefour Biyem-Assi (Acacias)", latitude: 3.8415, longitude: 11.4884 },
//   { nom: "Bastos (Quartier résidentiel/ambassades)", latitude: 3.8967, longitude: 11.5125 },
//   { nom: "Mokolo (Grand marché)", latitude: 3.8725, longitude: 11.4981 },
//   { nom: "Biyem-Assi", latitude: 3.8392, longitude: 11.4851 },
//   { nom: "Etoudi (Quartier de la Présidence)", latitude: 3.9156, longitude: 11.5292 },
//   { nom: "Ngoa-Ekellé (Cité universitaire)", latitude: 3.8595, longitude: 11.5002 },
//   { nom: "Nsam", latitude: 3.8292, longitude: 11.5090 },
//   { nom: "Messassi (Sortie Nord)", latitude: 3.9463, longitude: 11.5221 },
//   { nom: "Essos", latitude: 3.8735, longitude: 11.5365 },
//   { nom: "Mimboman", latitude: 3.8658, longitude: 11.5512 },
// ];

// // ─────────────────────────────────────────────
// // buildMapHTML — Carte Leaflet complète
// // Inclut : POI, marqueurs départ/dest, tracé OSRM, fitBounds
// // ─────────────────────────────────────────────
// const buildMapHTML = (
//   pickup?: Location | null,
//   dest?: Location | null,
//   partnerLat?: number,
//   partnerLon?: number,
//   routeGeoJson?: object | null
// ) => {
//   const centerLat = pickup?.lat ?? 3.848;
//   const centerLon = pickup?.lon ?? 11.502;
//   const zoom = pickup ? 14 : 12;

//   // Escape apostrophes pour éviter de casser le JS injecté
//   const escapeName = (name?: string) =>
//     (name || '').split(',')[0].replace(/'/g, "\\'").replace(/"/g, '\\"');

//   const pickupMarker = pickup
//     ? `L.marker([${pickup.lat}, ${pickup.lon}], {icon: orangeIcon})
//         .addTo(map)
//         .bindPopup('${escapeName(pickup.name)} (départ)');`
//     : '';

//   const destMarker = dest
//     ? `L.marker([${dest.lat}, ${dest.lon}], {icon: blueIcon})
//         .addTo(map)
//         .bindPopup('${escapeName(dest.name)} (destination)');`
//     : '';

//   const partnerMarker = partnerLat && partnerLon
//     ? `L.marker([${partnerLat}, ${partnerLon}], {icon: carIcon}).addTo(map).bindPopup('Chauffeur');`
//     : '';

//   // fitBounds sur le tracé si disponible, sinon sur les 2 marqueurs
//   const fitBounds = routeGeoJson
//     ? `var routeLine = L.geoJSON(${JSON.stringify(routeGeoJson)}, {
//         style: { color: '#FF8C00', weight: 5, opacity: 0.9 }
//        }).addTo(map);
//        map.fitBounds(routeLine.getBounds(), {padding: [50, 50]});`
//     : pickup && dest
//       ? `map.fitBounds([[${pickup.lat}, ${pickup.lon}], [${dest.lat}, ${dest.lon}]], {padding: [60, 60]});`
//       : '';

//   // POI markers — icône distincte (carré violet avec épingle)
//   const poiMarkersJS = POINTS_INTERET.map(poi =>
//     `L.marker([${poi.latitude}, ${poi.longitude}], {icon: poiIcon})
//       .addTo(map)
//       .bindPopup('${poi.nom.replace(/'/g, "\\'").replace(/"/g, '\\"')}');`
//   ).join('\n');

//   return `<!DOCTYPE html><html><head>
// <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
// <style>
//   html,body,#map { margin:0; padding:0; width:100%; height:100%; background:#1a1a1a; }
//   .poi-icon-inner {
//     width: 12px; height: 12px;
//     border-radius: 3px;
//     background: #8B5CF6;
//     border: 2px solid white;
//     box-shadow: 0 2px 6px rgba(0,0,0,0.6);
//   }
// </style>
// </head><body>
// <div id="map"></div>
// <script>
// var map = L.map('map', {zoomControl: false, attributionControl: false})
//   .setView([${centerLat}, ${centerLon}], ${zoom});

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// // Marqueur départ : cercle orange
// var orangeIcon = L.divIcon({
//   html: '<div style="width:18px;height:18px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
//   iconSize: [18,18], iconAnchor: [9,9], className: ''
// });

// // Marqueur destination : cercle bleu
// var blueIcon = L.divIcon({
//   html: '<div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
//   iconSize: [18,18], iconAnchor: [9,9], className: ''
// });

// // Marqueur chauffeur : emoji voiture
// var carIcon = L.divIcon({
//   html: '<div style="font-size:24px;line-height:1">🚗</div>',
//   iconSize: [24,24], iconAnchor: [12,12], className: ''
// });

// // Marqueur POI : carré violet distinctif
// var poiIcon = L.divIcon({
//   html: '<div class="poi-icon-inner"></div>',
//   iconSize: [12,12], iconAnchor: [6,6], className: ''
// });

// // ── POI (chargés en premier, sous les autres marqueurs) ──
// ${poiMarkersJS}

// // ── Marqueurs départ / destination ──
// ${pickupMarker}
// ${destMarker}
// ${partnerMarker}

// // ── Tracé itinéraire OSRM ou fitBounds simple ──
// ${fitBounds}

// // ── Message vers React Native au tap sur la carte ──
// map.on('click', function(e) {
//   window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
//     JSON.stringify({ type: 'mapTap', lat: e.latlng.lat, lon: e.latlng.lng })
//   );
// });
// </script></body></html>`;
// };

// // ─────────────────────────────────────────────
// // COMPOSANT PRINCIPAL
// // ─────────────────────────────────────────────
// export default function RideScreen() {
//   const { user, logout } = useAuth();
//   const { Colors } = useTheme();

//   // ── États de navigation
//   const [step, setStep] = useState<Step>('search');

//   // ── Carte
//   const [pickup, setPickup] = useState<Location | null>(null);
//   const [dest, setDest] = useState<Location | null>(null);
//   const [mapKey, setMapKey] = useState(0);
//   const [routeGeoJson, setRouteGeoJson] = useState<object | null>(null);
//   const webviewRef = useRef<WebView>(null);

//   // ── Estimation tarifaire
//   const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
//   const [priceNum, setPriceNum] = useState(0);
//   const [loadingFare, setLoadingFare] = useState(false);

//   // ── Publication offre
//   const [myPhone, setMyPhone] = useState('');
//   const [thirdPartyPhone, setThirdPartyPhone] = useState('');
//   const [forTiers, setForTiers] = useState(false);
//   const [departureTime, setDepartureTime] = useState(new Date().toISOString());
//   const [loading, setLoading] = useState(false);

//   // ── Course / attente
//   const [currentOffer, setCurrentOffer] = useState<OfferResponse | null>(null);
//   const [activeRideId, setActiveRideId] = useState<string | null>(null);
//   const [tracking, setTracking] = useState<{ latitude: number; longitude: number } | null>(null);
//   const [stars, setStars] = useState(5);
//   const [comment, setComment] = useState('');

//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   // ─────────────────────────────────────────────
//   // INIT
//   // ─────────────────────────────────────────────
//   useEffect(() => {
//     loadPassengerPhone();
//     checkExistingRide();
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // Rafraîchir la carte à chaque changement de coordonnées ou tracé
//   useEffect(() => {
//     setMapKey(k => k + 1);
//   }, [pickup?.lat, pickup?.lon, dest?.lat, dest?.lon, tracking?.latitude, routeGeoJson]);

//   const loadPassengerPhone = async () => {
//     try {
//       const stored = await SecureStore.getItemAsync('user');
//       if (stored) {
//         const parsed = JSON.parse(stored);
//         setMyPhone(parsed.phone || parsed.telephone || '');
//       }
//     } catch { /* silent */ }
//   };

//   const checkExistingRide = async () => {
//     try {
//       // 1. Course active en cours ?
//       const ride = await rideService.getCurrentPassengerRide();
//       if (ride) { setActiveRideId(ride.id); setStep('active'); return; }

//       // 2. Offre en attente ? (stockée dans SecureStore après publication)
//       const storedOfferId = await SecureStore.getItemAsync('currentOfferId');
//       if (storedOfferId) {
//         try {
//           const offerData = await rideService.getOfferBids(storedOfferId);
//           if (offerData.state === 'CANCELLED') {
//             await SecureStore.deleteItemAsync('currentOfferId');
//           } else if (offerData.state === 'VALIDATED') {
//             const rideData = await rideService.getRideByOffer(storedOfferId);
//             setActiveRideId(rideData.id);
//             setStep('active');
//           }
//           // Sinon on reste sur search avec le bouton "Mon offre"
//         } catch { /* silent */ }
//       }
//     } catch { /* silent */ }
//   };

//   // Vérifier si une offre est en cours (pour afficher le badge)
//   const [hasActiveOffer, setHasActiveOffer] = React.useState(false);
//   React.useEffect(() => {
//     SecureStore.getItemAsync('currentOfferId').then(id => setHasActiveOffer(!!id)).catch(() => {});
//   }, []);

//   // ─────────────────────────────────────────────
//   // F2 — TRACÉ OSRM (dans le HTML WebView)
//   // Fallback : ligne droite si OSRM inaccessible
//   // ─────────────────────────────────────────────
//   const fetchRoute = async (start: Location, end: Location) => {
//     // Essai 1 : OSRM public
//     const osrmUrl =
//       `https://router.project-osrm.org/route/v1/driving/` +
//       `${start.lon},${start.lat};${end.lon},${end.lat}` +
//       `?overview=full&geometries=geojson`;

//     try {
//       console.log('[OSRM] Appel :', osrmUrl);
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 8000);
//       const res = await fetch(osrmUrl, { signal: controller.signal });
//       clearTimeout(timeout);

//       if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
//       const data = await res.json();

//       if (data?.routes?.[0]?.geometry) {
//         console.log('[OSRM] Tracé reçu ✓');
//         setRouteGeoJson(data.routes[0].geometry);
//         return;
//       }
//       throw new Error('OSRM : geometry absent');
//     } catch (e: any) {
//       console.warn('[OSRM] Echec :', e?.message ?? e);
//     }

//     // Essai 2 : OSRM alternatif
//     const osrmAlt =
//       `https://routing.openstreetmap.de/routed-car/route/v1/driving/` +
//       `${start.lon},${start.lat};${end.lon},${end.lat}` +
//       `?overview=full&geometries=geojson`;
//     try {
//       console.log('[OSRM-alt] Appel :', osrmAlt);
//       const res2 = await fetch(osrmAlt);
//       const data2 = await res2.json();
//       if (data2?.routes?.[0]?.geometry) {
//         console.log('[OSRM-alt] Tracé reçu ✓');
//         setRouteGeoJson(data2.routes[0].geometry);
//         return;
//       }
//     } catch (e2: any) {
//       console.warn('[OSRM-alt] Echec :', e2?.message ?? e2);
//     }

//     // Fallback : ligne droite GeoJSON (toujours visible)
//     console.log('[Route] Fallback ligne droite');
//     setRouteGeoJson({
//       type: 'LineString',
//       coordinates: [
//         [start.lon, start.lat],
//         [end.lon, end.lat],
//       ],
//     });
//   };

//   // ─────────────────────────────────────────────
//   // F3 — ESTIMATION TARIFAIRE
//   // Utilise rideService.estimateFare (Axios, token auto)
//   // ─────────────────────────────────────────────
//   const handleEstimate = async () => {
//     if (!pickup || !dest) return;
//     setLoadingFare(true);
//     try {
//       console.log('[Estimate] Coords:', pickup.lat, pickup.lon, '->', dest.lat, dest.lon);

//       // On envoie les coordonnées "lat,lon" pour une meilleure précision
//       const raw = await rideService.estimateFare(
//         `${pickup.lat},${pickup.lon}`,
//         `${dest.lat},${dest.lon}`
//       );
//       console.log('[Estimate] Réponse brute:', JSON.stringify(raw));

//       // Le type mobile FareResponse est incomplet — on cast en any pour lire tous les champs
//       const data = raw as any;

//       const fare: FareEstimate = {
//         prix_moyen: data.prix_moyen ?? data.estimatedPrice ?? data.price ?? 0,
//         prix_min:   data.prix_min   ?? Math.round((data.prix_moyen ?? 0) * 0.85),
//         prix_max:   data.prix_max   ?? Math.round((data.prix_moyen ?? 0) * 1.15),
//         distance:   data.distance   ?? 0,
//         duree:      data.duree      ?? data.duration ?? 0,
//       };

//       console.log('[Estimate] Fare normalisé:', fare);

//       if (!fare.prix_moyen) {
//         throw new Error(`prix_moyen absent dans la réponse : ${JSON.stringify(data)}`);
//       }

//       setFareEstimate(fare);
//       // Arrondir au multiple de 50 le plus proche
//       setPriceNum(Math.round(fare.prix_moyen / 50) * 50);

//       // Charger le tracé en parallèle (non bloquant)
//       fetchRoute(pickup, dest).catch(console.warn);

//       setStep('price');
//     } catch (e: any) {
//       const msg =
//         e?.response?.data?.message ||
//         e?.response?.data?.error  ||
//         e?.message                ||
//         'Erreur inconnue';
//       console.error('[Estimate] ERREUR:', msg, e);
//       Alert.alert(
//         'Erreur estimation',
//         `Détail : ${msg}\n\nVérifiez votre connexion et réessayez.`
//       );
//     } finally {
//       setLoadingFare(false);
//     }
//   };

//   // ─────────────────────────────────────────────
//   // F4 — PUBLICATION DE L'OFFRE
//   // Utilise rideService.createOffer (Axios + token auto)
//   // ─────────────────────────────────────────────
//   const handlePublishOffer = async () => {
//     if (!pickup || !dest || !priceNum) return;
//     const phone = forTiers ? thirdPartyPhone : myPhone;
//     if (!phone) {
//       Alert.alert('Téléphone requis', 'Veuillez saisir un numéro de téléphone.');
//       return;
//     }
//     setLoading(true);
//     try {
//       console.log('[Publish] Envoi offre via rideService.createOffer');
//       const offer = await rideService.createOffer({
//         startPoint: pickup.name,
//         startLat: parseFloat(String(pickup.lat)),
//         startLon: parseFloat(String(pickup.lon)),
//         endPoint: dest.name,
//         endLat: parseFloat(String(dest.lat)),
//         endLon: parseFloat(String(dest.lon)),
//         price: priceNum,
//         passengerPhone: phone,
//         departureTime: departureTime,
//       });

//       console.log('[Publish] Offre créée :', offer.id);
//       await SecureStore.setItemAsync('currentOfferId', offer.id);
//       setCurrentOffer(offer);
//       setStep('waiting');
//       startPolling(offer.id);
//     } catch (e: any) {
//       const msg =
//         e?.response?.data?.message ||
//         e?.response?.data?.error  ||
//         e?.message                ||
//         "Impossible de publier l'offre.";
//       console.error('[Publish] ERREUR:', msg);
//       Alert.alert('Erreur publication', msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ─────────────────────────────────────────────
//   // POLLING — attente de validation
//   // ─────────────────────────────────────────────
//   const startPolling = (offerId: string) => {
//     pollRef.current = setInterval(async () => {
//       try {
//         const updated = await rideService.getOfferBids(offerId);
//         setCurrentOffer(updated);
//         if (updated.state === 'VALIDATED') {
//           clearInterval(pollRef.current!);
//           const ride = await rideService.getRideByOffer(offerId);
//           setActiveRideId(ride.id);
//           setStep('active');
//           startTrackingPolling(ride.id);
//         }
//       } catch { /* silent */ }
//     }, 4000);
//   };

//   const startTrackingPolling = (rideId: string) => {
//     pollRef.current = setInterval(async () => {
//       try {
//         // Vérifier si la course est terminée (chauffeur a appuyé COMPLETED)
//         const rideData = await rideService.getRideDetails(rideId);
//         if (rideData.state === 'COMPLETED') {
//           clearInterval(pollRef.current!);
//           await clearPassengerRideData();
//           setStep('review');
//           return;
//         }
//         if (rideData.state === 'CANCELLED') {
//           clearInterval(pollRef.current!);
//           await clearPassengerRideData();
//           setStep('search');
//           return;
//         }
//         // Tracking GPS
//         try {
//           const t = await rideService.getTrackingInfo(rideId);
//           setTracking(t);
//         } catch { /* GPS peut être absent */ }
//       } catch { /* silent */ }
//     }, 4000);
//   };

//   const handleSelectDriver = async (driverId: string) => {
//     if (!currentOffer) return;
//     try {
//       await rideService.selectDriver(currentOffer.id, driverId);
//     } catch {
//       Alert.alert('Erreur', 'Impossible de sélectionner ce chauffeur.');
//     }
//   };

//   const handleCancelOffer = () => {
//     Alert.alert('Annuler', 'Voulez-vous annuler la recherche ?', [
//       { text: 'Non' },
//       {
//         text: 'Oui', style: 'destructive', onPress: async () => {
//           if (pollRef.current) clearInterval(pollRef.current);
//           try { await SecureStore.deleteItemAsync('currentOfferId'); } catch { /* silent */ }
//           setCurrentOffer(null);
//           setRouteGeoJson(null);
//           setFareEstimate(null);
//           setStep('search');
//         }
//       },
//     ]);
//   };

//   // Le passager ne termine pas la course — seul le chauffeur le fait.
//   // Cette fonction est conservée pour compatibilité mais ne fait rien.
//   const handleFinishRide = () => {};

//   const handleSubmitReview = async () => {
//     if (!activeRideId) return;
//     try {
//       await rideService.submitReview(activeRideId, stars, comment);
//     } catch { /* silent */ }
//     setStep('search');
//     setPickup(null);
//     setDest(null);
//     setRouteGeoJson(null);
//     setFareEstimate(null);
//     setPriceNum(0);
//     setCurrentOffer(null);
//     setActiveRideId(null);
//   };

//   // ─────────────────────────────────────────────
//   // HANDLER — tap sur la carte (message WebView)
//   // ─────────────────────────────────────────────
//   const handleWebViewMessage = useCallback(async (event: any) => {
//     try {
//       const msg = JSON.parse(event.nativeEvent.data);
//       if (msg.type !== 'mapTap') return;
//       const { lat, lon } = msg;

//       // Reverse geocoding Nominatim
//       const res = await fetch(
//         `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
//         { headers: { 'Accept-Language': 'fr' } }
//       );
//       const data = await res.json();
//       const addr = data.address || {};
//       const name =
//         [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town]
//           .filter(Boolean).join(', ') ||
//         data.display_name?.split(',').slice(0, 2).join(',') ||
//         `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

//       const loc: Location = { name, lat, lon };

//       if (!pickup) {
//         setPickup(loc);
//       } else if (!dest) {
//         setDest(loc);
//       }
//       // Si les deux sont remplis → ne rien faire
//     } catch { /* silent */ }
//   }, [pickup, dest]);

//   // ─────────────────────────────────────────────
//   // HTML de la carte (mémoïsé)
//   // ─────────────────────────────────────────────
//   const mapHTML = buildMapHTML(
//     pickup, dest,
//     tracking?.latitude, tracking?.longitude,
//     routeGeoJson
//   );

//   // ─────────────────────────────────────────────
//   // RENDU
//   // ─────────────────────────────────────────────
//   return (
//     <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
//       {/* ── CARTE EN FOND ── */}
//       <View style={styles.mapContainer}>
//         <WebView
//           key={mapKey}
//           ref={webviewRef}
//           source={{ html: mapHTML }}
//           style={styles.map}
//           javaScriptEnabled
//           domStorageEnabled
//           onMessage={handleWebViewMessage}
//           scrollEnabled={false}
//         />
//       </View>

//       {/* ── PANEL BOTTOM-SHEET ── */}
//       <KeyboardAvoidingView
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//         style={styles.panelWrapper}
//         keyboardVerticalOffset={0}
//       >
//         <ScrollView
//           style={[styles.panel, { backgroundColor: Colors.card }]}
//           contentContainerStyle={styles.panelContent}
//           keyboardShouldPersistTaps="handled"
//           showsVerticalScrollIndicator={false}
//         >
//           {/* ── Header ── */}
//           <View style={styles.panelHeader}>
//             <View style={[styles.panelHandle, { backgroundColor: Colors.cardBorder }]} />
//             <View style={styles.headerRow}>
//               <Text style={[styles.panelTitle, { color: Colors.text }]}>
//                 {step === 'search' && 'Où allez-vous ?'}
//                 {step === 'price' && 'Votre tarif'}
//                 {step === 'waiting' && 'En attente…'}
//                 {step === 'active' && 'Course en cours'}
//                 {step === 'review' && 'Évaluation'}
//               </Text>
//               <ThemeToggle />
//             </View>
//           </View>

//           {/* ══════════════════════════════════════
//               STEP : SEARCH
//           ══════════════════════════════════════ */}
//           {step === 'search' && (
//             <View style={styles.searchSection}>
//               {/* Champ départ */}
//               <LocationSearch
//                 placeholder="Lieu de départ (ex : Bastos)"
//                 value={pickup?.name || ''}
//                 onSelect={setPickup}
//                 icon="navigate"
//                 showGPS
//                 Colors={Colors}
//               />

//               {/* Champ destination */}
//               <LocationSearch
//                 placeholder="Destination (ex : Marché Central)"
//                 value={dest?.name || ''}
//                 onSelect={setDest}
//                 icon="location"
//                 Colors={Colors}
//               />

//               {/* Info tap carte */}
//               <Text style={[styles.tapHint, { color: Colors.textMuted }]}>
//                 Vous pouvez aussi taper directement sur la carte pour sélectionner un point.
//               </Text>

//               {/* Bouton discret "Mon offre en cours" */}
//               {hasActiveOffer && (
//                 <TouchableOpacity
//                   style={[styles.activeOfferBtn, { backgroundColor: Colors.orangeBg, borderColor: Colors.orange }]}
//                   onPress={() => router.push('/(passenger)/my-offer' as any)}
//                   activeOpacity={0.8}
//                 >
//                   <View style={[styles.activeOfferDot, { backgroundColor: Colors.orange }]} />
//                   <Text style={[styles.activeOfferTxt, { color: Colors.orange }]}>
//                     Offre en cours — voir les chauffeurs
//                   </Text>
//                   <Ionicons name="chevron-forward" size={14} color={Colors.orange} />
//                 </TouchableOpacity>
//               )}

//               {/* Bouton Estimer */}
//               <TouchableOpacity
//                 style={[
//                   styles.primaryBtn,
//                   { backgroundColor: pickup && dest ? '#FF8C00' : Colors.cardBorder },
//                 ]}
//                 onPress={handleEstimate}
//                 disabled={!pickup || !dest || loadingFare}
//                 activeOpacity={0.8}
//               >
//                 {loadingFare
//                   ? <ActivityIndicator color="#0D0D0D" />
//                   : <Text style={styles.primaryBtnText}>Estimer le prix</Text>
//                 }
//               </TouchableOpacity>
//             </View>
//           )}

//           {/* ══════════════════════════════════════
//               STEP : PRICE — Finalisez votre offre
//           ══════════════════════════════════════ */}
//           {step === 'price' && (
//             <View style={styles.priceSection}>

//               {/* Titre */}
//               <View style={styles.priceTitleBlock}>
//                 <Text style={[styles.priceTitleMain, { color: Colors.text }]}>Finalisez votre offre</Text>
//                 <Text style={[styles.priceTitleSub, { color: Colors.textMuted }]}>AJUSTEZ LE PRIX ET LE CONTACT</Text>
//               </View>

//               {/* Contrôle prix +/- */}
//               <View style={[styles.priceControl, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//                 <TouchableOpacity
//                   style={[styles.priceBtn, { backgroundColor: Colors.input }]}
//                   onPress={() => setPriceNum(p => Math.max(0, p - 50))}
//                   activeOpacity={0.7}
//                 >
//                   <Text style={[styles.priceBtnText, { color: Colors.text }]}>-</Text>
//                 </TouchableOpacity>
//                 <View style={styles.priceDisplay}>
//                   <Text style={[styles.priceValue, { color: Colors.text }]}>{priceNum}</Text>
//                   <Text style={[styles.priceCurrency, { color: Colors.textMuted }]}>FCFA</Text>
//                 </View>
//                 <TouchableOpacity
//                   style={[styles.priceBtn, { backgroundColor: '#FF8C00' }]}
//                   onPress={() => setPriceNum(p => p + 50)}
//                   activeOpacity={0.7}
//                 >
//                   <Text style={[styles.priceBtnText, { color: '#0D0D0D' }]}>+</Text>
//                 </TouchableOpacity>
//               </View>

//               {/* Info min/distance/durée */}
//               {fareEstimate && (
//                 <View style={[styles.fareInfoRow, { borderColor: Colors.cardBorder }]}>
//                   <View style={styles.fareInfoItem}>
//                     <Text style={[styles.fareInfoVal, { color: Colors.text }]}>
//                       {fareEstimate.distance > 1000
//                         ? `${(fareEstimate.distance / 1000).toFixed(1)} km`
//                         : `${Math.round(fareEstimate.distance)} m`}
//                     </Text>
//                     <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Distance</Text>
//                   </View>
//                   <View style={[styles.fareInfoDiv, { backgroundColor: Colors.cardBorder }]} />
//                   <View style={styles.fareInfoItem}>
//                     <Text style={[styles.fareInfoVal, { color: Colors.text }]}>
//                       {fareEstimate.duree > 0 ? `${Math.round(fareEstimate.duree / 60)} min` : '--'}
//                     </Text>
//                     <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Durée</Text>
//                   </View>
//                   <View style={[styles.fareInfoDiv, { backgroundColor: Colors.cardBorder }]} />
//                   <View style={styles.fareInfoItem}>
//                     <Text style={[styles.fareInfoVal, { color: Colors.text }]}>{fareEstimate.prix_min} F</Text>
//                     <Text style={[styles.fareInfoLbl, { color: Colors.textMuted }]}>Prix min</Text>
//                   </View>
//                 </View>
//               )}

//               {/* Toggle Pour moi / Pour un tiers */}
//               <View style={[styles.toggleRow, { backgroundColor: Colors.input }]}>
//                 <TouchableOpacity
//                   style={[styles.toggleBtn, !forTiers && { borderBottomWidth: 2, borderBottomColor: '#FF8C00' }]}
//                   onPress={() => setForTiers(false)}
//                   activeOpacity={0.8}
//                 >
//                   <Ionicons name="person-outline" size={14} color={!forTiers ? '#FF8C00' : Colors.textMuted} />
//                   <Text style={[styles.toggleBtnText, { color: !forTiers ? '#FF8C00' : Colors.textMuted }]}>
//                     POUR MOI
//                   </Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   style={[styles.toggleBtn, forTiers && { borderBottomWidth: 2, borderBottomColor: '#FF8C00' }]}
//                   onPress={() => setForTiers(true)}
//                   activeOpacity={0.8}
//                 >
//                   <Ionicons name="people-outline" size={14} color={forTiers ? '#FF8C00' : Colors.textMuted} />
//                   <Text style={[styles.toggleBtnText, { color: forTiers ? '#FF8C00' : Colors.textMuted }]}>
//                     POUR UN TIERS
//                   </Text>
//                 </TouchableOpacity>
//               </View>

//               {/* Numéro de téléphone */}
//               <View style={[styles.phoneRow, { backgroundColor: Colors.input, borderColor: Colors.inputBorder }]}>
//                 <Ionicons name="call-outline" size={18} color="#FF8C00" style={{ marginRight: 8 }} />
//                 {forTiers ? (
//                   <TextInput
//                     style={[styles.phoneInput, { color: Colors.text }]}
//                     value={thirdPartyPhone}
//                     onChangeText={setThirdPartyPhone}
//                     keyboardType="phone-pad"
//                     placeholder="Numéro du bénéficiaire"
//                     placeholderTextColor={Colors.textMuted}
//                     autoFocus
//                   />
//                 ) : (
//                   <Text style={[styles.phoneStatic, { color: Colors.text }]}>{myPhone || '---'}</Text>
//                 )}
//               </View>

//               {/* Heure de départ */}
//               <View style={[styles.phoneRow, { backgroundColor: Colors.input, borderColor: Colors.inputBorder }]}>
//                 <Ionicons name="time-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
//                 <TextInput
//                   style={[styles.phoneInput, { color: Colors.text, flex: 1 }]}
//                   value={departureTime.slice(0, 16).replace('T', ' ')}
//                   onChangeText={v => {
//                     try { setDepartureTime(new Date(v.replace(' ', 'T')).toISOString()); } catch {}
//                   }}
//                   placeholder="AAAA-MM-JJ HH:MM"
//                   placeholderTextColor={Colors.textMuted}
//                 />
//                 <Text style={[styles.toggleBtnText, { color: Colors.textMuted }]}>DÉPART</Text>
//               </View>

//               {/* Boutons */}
//               <View style={styles.btnRow}>
//                 <TouchableOpacity
//                   style={[styles.secondaryBtn, { borderColor: Colors.cardBorder }]}
//                   onPress={() => { setStep('search'); setRouteGeoJson(null); setFareEstimate(null); }}
//                 >
//                   <Text style={[styles.secondaryBtnText, { color: Colors.text }]}>Retour</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   style={[styles.publishBtn, { backgroundColor: priceNum > 0 ? '#FF8C00' : Colors.cardBorder }]}
//                   onPress={handlePublishOffer}
//                   disabled={!priceNum || loading}
//                   activeOpacity={0.8}
//                 >
//                   {loading
//                     ? <ActivityIndicator color="#0D0D0D" />
//                     : <Text style={styles.primaryBtnText}>LANCER LA RECHERCHE</Text>
//                   }
//                 </TouchableOpacity>
//               </View>
//             </View>
//           )}
//           {/* ══════════════════════════════════════
//               STEP : WAITING — en attente des chauffeurs
//           ══════════════════════════════════════ */}
//           {step === 'waiting' && currentOffer && (
//             <View style={styles.waitingSection}>
//               <ActivityIndicator size="large" color="#FF8C00" style={{ marginBottom: 12 }} />
//               <Text style={[styles.waitingTitle, { color: Colors.text }]}>
//                 Votre offre est visible !
//               </Text>
//               <Text style={[styles.waitingSubtitle, { color: Colors.textMuted }]}>
//                 Les chauffeurs disponibles vont répondre…
//               </Text>

//               {/* Résumé offre */}
//               <View style={[styles.offerSummary, { backgroundColor: Colors.background, borderColor: Colors.cardBorder }]}>
//                 <Text style={[styles.offerSummaryText, { color: Colors.text }]}>
//                   De : {currentOffer.startPoint}
//                 </Text>
//                 <Text style={[styles.offerSummaryText, { color: Colors.text }]}>
//                   Vers : {currentOffer.endPoint}
//                 </Text>
//                 <Text style={[styles.offerSummaryPrice, { color: '#FF8C00' }]}>
//                   {currentOffer.price} FCFA
//                 </Text>
//               </View>

//               {/* Liste des bids */}
//               {(currentOffer as any).bids?.length > 0 && (
//                 <>
//                   <Text style={[styles.bidsTitle, { color: Colors.text }]}>
//                     {(currentOffer as any).bids.length} chauffeur(s) intéressé(s)
//                   </Text>
//                   {((currentOffer as any).bids as Bid[]).map((bid: Bid) => (
//                     <View key={bid.driverId} style={[styles.bidCard, { backgroundColor: Colors.background, borderColor: Colors.cardBorder }]}>
//                       <View>
//                         <Text style={[styles.bidName, { color: Colors.text }]}>
//                           {bid.driverName || `Chauffeur #${bid.driverId.slice(-4)}`}
//                         </Text>
//                         {bid.proposedPrice && (
//                           <Text style={[styles.bidPrice, { color: Colors.textMuted }]}>
//                             Prix proposé : {bid.proposedPrice} FCFA
//                           </Text>
//                         )}
//                       </View>
//                       <TouchableOpacity
//                         style={styles.chooseBtn}
//                         onPress={() => handleSelectDriver(bid.driverId)}
//                       >
//                         <Text style={styles.chooseBtnText}>Choisir</Text>
//                       </TouchableOpacity>
//                     </View>
//                   ))}
//                 </>
//               )}

//               <TouchableOpacity
//                 style={[styles.cancelBtn, { borderColor: Colors.cardBorder }]}
//                 onPress={handleCancelOffer}
//               >
//                 <Text style={[styles.cancelBtnText, { color: '#EF4444' }]}>
//                   Annuler ma demande
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           )}

//           {/* ══════════════════════════════════════
//               STEP : ACTIVE — course en cours (le chauffeur termine)
//           ══════════════════════════════════════ */}
//           {step === 'active' && (
//             <View style={styles.activeSection}>
//               <View style={[styles.activeBadge, { backgroundColor: Colors.greenBg }]}>
//                 <View style={[styles.activePulse, { backgroundColor: Colors.green }]} />
//                 <Text style={{ color: Colors.green, fontWeight: '900', fontSize: 13 }}>
//                   Course en cours
//                 </Text>
//               </View>
//               <Text style={[styles.activeHint, { color: Colors.textMuted }]}>
                
//               </Text>
//             </View>
//           )}

//           {/* ══════════════════════════════════════
//               STEP : REVIEW — évaluation
//           ══════════════════════════════════════ */}
//           {step === 'review' && (
//             <View style={styles.reviewSection}>
//               <Text style={[styles.reviewTitle, { color: Colors.text }]}>
//                 Comment s'est passé le trajet ?
//               </Text>
//               <View style={styles.starsRow}>
//                 {[1, 2, 3, 4, 5].map(s => (
//                   <TouchableOpacity key={s} onPress={() => setStars(s)}>
//                     <Ionicons
//                       name={s <= stars ? 'star' : 'star-outline'}
//                       size={32}
//                       color="#FF8C00"
//                     />
//                   </TouchableOpacity>
//                 ))}
//               </View>
//               <TextInput
//                 style={[styles.commentInput, {
//                   color: Colors.text,
//                   backgroundColor: Colors.background,
//                   borderColor: Colors.cardBorder,
//                 }]}
//                 value={comment}
//                 onChangeText={setComment}
//                 placeholder="Un commentaire… (optionnel)"
//                 placeholderTextColor={Colors.textMuted}
//                 multiline
//                 numberOfLines={3}
//               />
//               <TouchableOpacity
//                 style={[styles.primaryBtn, { backgroundColor: '#FF8C00' }]}
//                 onPress={handleSubmitReview}
//               >
//                 <Text style={styles.primaryBtnText}>Envoyer l'évaluation</Text>
//               </TouchableOpacity>
//             </View>
//           )}

//         </ScrollView>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// // ─────────────────────────────────────────────
// // STYLES
// // ─────────────────────────────────────────────
// const PANEL_HEIGHT = SCREEN_HEIGHT * 0.52;

// const styles = StyleSheet.create({
//   safe: { flex: 1 },

//   // Carte
//   mapContainer: {
//     position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
//   },
//   map: { flex: 1 },

//   // Panel
//   panelWrapper: {
//     position: 'absolute', bottom: 0, left: 0, right: 0,
//     maxHeight: PANEL_HEIGHT,
//   },
//   panel: {
//     borderTopLeftRadius: 24, borderTopRightRadius: 24,
//     shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
//     shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
//   },
//   panelContent: { paddingBottom: 40 },

//   panelHeader: { paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 8 },
//   panelHandle: {
//     width: 40, height: 4, borderRadius: 2,
//     alignSelf: 'center', marginBottom: 12,
//   },
//   headerRow: {
//     flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
//   },
//   panelTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },

//   // Search step
//   searchSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
//   tapHint: { fontSize: 12, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },

//   // Price step
//   priceSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
//   routeCard: {
//     borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm,
//   },
//   routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
//   routeDot: { width: 12, height: 12, borderRadius: 6 },
//   routeLine: { width: 2, height: 16, marginLeft: 5, marginVertical: 2 },
//   routeText: { flex: 1, fontSize: 13, fontWeight: '600' },

//   statsRow: {
//     flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md,
//     overflow: 'hidden',
//   },
//   statItem: {
//     flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4,
//   },
//   statValue: { fontWeight: '900', fontSize: 14 },
//   statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
//   statDivider: { width: 1 },

//   priceInputBlock: { gap: 4 },
//   priceInputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
//   priceRecoInfo: { fontSize: 11, fontStyle: 'italic' },
//   priceInput: {
//     borderRadius: Radius.md, borderWidth: 1, padding: 12,
//     fontWeight: '700', fontSize: 16,
//   },

//   btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
//   secondaryBtn: {
//     flex: 1, borderRadius: Radius.md, borderWidth: 1,
//     paddingVertical: 14, alignItems: 'center',
//   },
//   secondaryBtnText: { fontWeight: '700', fontSize: 13 },
//   publishBtn: {
//     flex: 2, borderRadius: Radius.md,
//     paddingVertical: 14, alignItems: 'center',
//   },

//   // Shared button
//   primaryBtn: {
//     borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center',
//   },
//   primaryBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },

//   // Waiting step
//   waitingSection: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.sm },
//   waitingTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
//   waitingSubtitle: { fontSize: 13, textAlign: 'center' },
//   offerSummary: {
//     width: '100%', borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, gap: 4,
//   },
//   offerSummaryText: { fontSize: 13, fontWeight: '600' },
//   offerSummaryPrice: { fontSize: 18, fontWeight: '900', marginTop: 4 },
//   bidsTitle: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start', marginTop: 8 },
//   bidCard: {
//     width: '100%', borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm,
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//   },
//   bidName: { fontWeight: '700', fontSize: 13 },
//   bidPrice: { fontSize: 11 },
//   chooseBtn: {
//     backgroundColor: '#FF8C00', borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 8,
//   },
//   chooseBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 12 },
//   cancelBtn: {
//     width: '100%', borderRadius: Radius.md, borderWidth: 1,
//     paddingVertical: 12, alignItems: 'center', marginTop: 8,
//   },
//   cancelBtnText: { fontWeight: '700', fontSize: 13 },

//   // Active step
//   activeSection: { paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.sm },
//   activeBadge: {
//     paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
//   },

//   // Review step
//   reviewSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
//   reviewTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
//   starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
//   commentInput: {
//     borderRadius: Radius.md, borderWidth: 1, padding: 12,
//     fontWeight: '500', fontSize: 14, textAlignVertical: 'top', minHeight: 80,
//   },
//   // ── Step price styles ──
//   priceTitleBlock: { alignItems: 'center', paddingVertical: Spacing.sm },
//   priceTitleMain: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
//   priceTitleSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },

//   priceControl: {
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     borderRadius: 20, borderWidth: 1, padding: 8, marginVertical: 4,
//   },
//   priceBtn: {
//     width: 56, height: 56, borderRadius: 14,
//     alignItems: 'center', justifyContent: 'center',
//   },
//   priceBtnText: { fontSize: 28, fontWeight: '900', lineHeight: 34 },
//   priceDisplay: { alignItems: 'center', flex: 1 },
//   priceValue: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
//   priceCurrency: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: -4 },

//   fareInfoRow: {
//     flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden',
//   },
//   fareInfoItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
//   fareInfoVal: { fontWeight: '900', fontSize: 13 },
//   fareInfoLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
//   fareInfoDiv: { width: 1 },

//   toggleRow: {
//     flexDirection: 'row', borderRadius: 12, overflow: 'hidden', marginVertical: 4,
//   },
//   toggleBtn: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     gap: 6, paddingVertical: 12,
//   },
//   toggleBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

//   phoneRow: {
//     flexDirection: 'row', alignItems: 'center',
//     borderRadius: Radius.md, borderWidth: 1,
//     paddingHorizontal: Spacing.md, paddingVertical: 14,
//     marginVertical: 2,
//   },
//   phoneInput: { flex: 1, fontWeight: '700', fontSize: 15, padding: 0 },
//   phoneStatic: { flex: 1, fontWeight: '700', fontSize: 15 },

//   activeOfferBtn: {
//     flexDirection: 'row', alignItems: 'center', gap: 8,
//     borderRadius: Radius.md, borderWidth: 1,
//     paddingHorizontal: Spacing.md, paddingVertical: 11,
//   },
//   activeOfferDot: { width: 7, height: 7, borderRadius: 4 },
//   activeOfferTxt: { flex: 1, fontSize: 12, fontWeight: '700' },

//   activePulse: { width: 8, height: 8, borderRadius: 4 },
//   activeHint:  { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginTop: 8 },

// });
