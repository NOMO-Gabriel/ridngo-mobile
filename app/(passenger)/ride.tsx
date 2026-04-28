import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { LocationSearch } from '../../src/components/LocationSearch';
import { rideService } from '../../src/services/rideService';
import { Spacing, Radius } from '../../src/types/theme';
import { Location, OfferResponse, Bid } from '../../src/types/api';

type Step = 'search' | 'price' | 'waiting' | 'active' | 'review';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// OSM WebView map HTML
const buildMapHTML = (
  pickup?: Location | null,
  dest?: Location | null,
  partnerLat?: number,
  partnerLon?: number
) => {
  const centerLat = pickup?.lat ?? 3.848;
  const centerLon = pickup?.lon ?? 11.502;
  const zoom = pickup ? 14 : 12;

  const pickupMarker = pickup
    ? `L.marker([${pickup.lat}, ${pickup.lon}], {icon: orangeIcon}).addTo(map).bindPopup("${pickup.name?.split(',')[0] || 'Départ'}");`
    : '';
  const destMarker = dest
    ? `L.marker([${dest.lat}, ${dest.lon}], {icon: blueIcon}).addTo(map).bindPopup("${dest.name?.split(',')[0] || 'Destination'}");`
    : '';
  const partnerMarker = partnerLat && partnerLon
    ? `L.marker([${partnerLat}, ${partnerLon}], {icon: carIcon}).addTo(map).bindPopup("Chauffeur");`
    : '';
  const fitBounds = pickup && dest
    ? `map.fitBounds([[${pickup.lat}, ${pickup.lon}], [${dest.lat}, ${dest.lon}]], {padding: [40, 40]});`
    : '';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#1a1a1a;}</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: false, attributionControl: false}).setView([${centerLat}, ${centerLon}], ${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var orangeIcon = L.divIcon({html:'<div style="width:16px;height:16px;border-radius:50%;background:#FF8C00;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',iconSize:[16,16],className:''});
var blueIcon = L.divIcon({html:'<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',iconSize:[16,16],className:''});
var carIcon = L.divIcon({html:'<div style="font-size:24px;line-height:1">🚗</div>',iconSize:[24,24],className:''});
${pickupMarker}
${destMarker}
${partnerMarker}
${fitBounds}
</script></body></html>`;
};

export default function RideScreen() {
  const { user, logout } = useAuth();
  const { Colors } = useTheme();
  const [step, setStep] = useState<Step>('search');
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dest, setDest] = useState<Location | null>(null);
  const [price, setPrice] = useState(500);
  const [loading, setLoading] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<OfferResponse | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkExistingRide();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Refresh map when locations change
  useEffect(() => { setMapKey(k => k + 1); }, [pickup?.lat, pickup?.lon, dest?.lat, dest?.lon, tracking?.latitude]);

  const checkExistingRide = async () => {
    const ride = await rideService.getCurrentPassengerRide();
    if (ride) { setActiveRideId(ride.id); setStep('active'); }
  };

  const handleEstimate = async () => {
    if (!pickup || !dest) return;
    setLoading(true);
    try {
      const fare = await rideService.estimateFare(pickup.name, dest.name);
      const raw = (fare as any).prix_moyen ?? fare.estimatedPrice ?? fare.price ?? 500;
      setPrice(Math.round(raw / 50) * 50);
      setStep('price');
    } catch {
      Alert.alert('Erreur', "Impossible d'estimer le prix.");
    } finally { setLoading(false); }
  };

  const handlePublishOffer = async () => {
    if (!pickup || !dest) return;
    setLoading(true);
    try {
      const offer = await rideService.createOffer({
        startPoint: pickup.name,
        endPoint: dest.name,
        price,
        startLat: pickup.lat,
        startLon: pickup.lon,
        endLat: dest.lat,
        endLon: dest.lon,
        passengerPhone: user?.phone,
      });
      setCurrentOffer(offer);
      setStep('waiting');
      startPolling(offer.id);
    } catch { Alert.alert('Erreur', "Impossible de publier l'offre."); }
    finally { setLoading(false); }
  };

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
          // start tracking polling
          startTrackingPolling(ride.id);
        }
      } catch { /* silent */ }
    }, 4000);
  };

  const startTrackingPolling = (rideId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const t = await rideService.getTrackingInfo(rideId);
        setTracking(t);
      } catch { /* silent */ }
    }, 4000);
  };

  const handleSelectDriver = async (driverId: string) => {
    if (!currentOffer) return;
    try {
      await rideService.selectDriver(currentOffer.id, driverId);
    } catch { Alert.alert('Erreur', 'Impossible de sélectionner ce chauffeur.'); }
  };

  const handleCancelOffer = () => {
    Alert.alert('Annuler', 'Voulez-vous annuler la recherche ?', [
      { text: 'Non' },
      { text: 'Oui', style: 'destructive', onPress: () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setCurrentOffer(null); setStep('search');
      }}
    ]);
  };

  const handleFinishRide = async () => {
    if (!activeRideId) return;
    setLoading(true);
    try {
      await rideService.completeRide(activeRideId);
      if (pollRef.current) clearInterval(pollRef.current);
      setStep('review');
    } catch { Alert.alert('Erreur', 'Impossible de terminer la course.'); }
    finally { setLoading(false); }
  };

  const handleSubmitReview = async () => {
    if (activeRideId) {
      try { await rideService.postReview(activeRideId, stars, comment); } catch { /* ignore */ }
    }
    setStep('search'); setPickup(null); setDest(null);
    setCurrentOffer(null); setActiveRideId(null); setTracking(null);
  };

  const mapHTML = buildMapHTML(
    pickup, dest,
    tracking?.latitude, tracking?.longitude
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]}>
      {/* FULL SCREEN MAP */}
      <View style={styles.mapContainer}>
        <WebView
          key={mapKey}
          source={{ html: mapHTML }}
          style={styles.map}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>

      {/* OVERLAY PANEL - bottom sheet style */}
      <View style={[styles.panel, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
        {/* Header */}
        <View style={styles.panelHeader}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}><Text style={styles.logoLetter}>R</Text></View>
            <View>
              <Text style={[styles.logoText, { color: Colors.text }]}>RidnGo</Text>
              <Text style={[styles.userTag, { color: Colors.orange }]}>{user?.name?.split(' ')[0]}</Text>
            </View>
          </View>
          <ThemeToggle />
        </View>

        {/* SEARCH STEP */}
        {step === 'search' && (
          <ScrollView
            style={{ overflow: 'visible' }}
            contentContainerStyle={[styles.stepContent, { paddingBottom: 8 }]}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
          >
            <Text style={[styles.stepTitle, { color: Colors.text }]}>Où allez-vous ?</Text>
            <View style={[styles.inputsWrap, { overflow: 'visible' }]}>
              <View style={styles.inputLine}>
                <View style={[styles.dot, { backgroundColor: Colors.orange }]} />
                <View style={{ flex: 1, zIndex: 10 }}>
                  <LocationSearch
                    placeholder="Point de départ"
                    value={pickup?.name || ''}
                    onSelect={setPickup}
                    icon="navigate"
                    showGPS
                    Colors={Colors}
                  />
                </View>
              </View>
              <View style={[styles.connector, { backgroundColor: Colors.cardBorder }]} />
              <View style={styles.inputLine}>
                <View style={[styles.dot, { backgroundColor: Colors.blue }]} />
                <View style={{ flex: 1, zIndex: 9 }}>
                  <LocationSearch
                    placeholder="Destination"
                    value={dest?.name || ''}
                    onSelect={setDest}
                    icon="location"
                    Colors={Colors}
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btnPrimary, (!pickup || !dest || loading) && styles.btnDisabled]}
              onPress={handleEstimate}
              disabled={!pickup || !dest || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#0D0D0D" /> : (
                <><Text style={styles.btnText}>Estimer le prix</Text><Ionicons name="arrow-forward" size={18} color="#0D0D0D" /></>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* PRICE STEP */}
        {step === 'price' && (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.backRow} onPress={() => setStep('search')}>
              <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
              <Text style={[styles.backText, { color: Colors.textMuted }]}>Modifier</Text>
            </TouchableOpacity>
            <View style={styles.tripMini}>
              <View style={styles.tripRow}>
                <View style={[styles.dot, { backgroundColor: Colors.orange }]} />
                <Text style={[styles.tripText, { color: Colors.text }]} numberOfLines={1}>{pickup?.name.split(',')[0]}</Text>
              </View>
              <View style={[styles.tripLine, { backgroundColor: Colors.cardBorder }]} />
              <View style={styles.tripRow}>
                <View style={[styles.dot, { backgroundColor: Colors.blue }]} />
                <Text style={[styles.tripText, { color: Colors.text }]} numberOfLines={1}>{dest?.name.split(',')[0]}</Text>
              </View>
            </View>
            <Text style={[styles.priceLabel, { color: Colors.textMuted }]}>PRIX ESTIMÉ</Text>
            <Text style={[styles.bigPrice, { color: Colors.text }]}>{price}<Text style={[styles.priceSuffix, { color: Colors.textMuted }]}> F</Text></Text>
            <View style={[styles.priceControl, { backgroundColor: Colors.input }]}>
              <TouchableOpacity style={[styles.priceBtn, { backgroundColor: Colors.card }]} onPress={() => setPrice(p => Math.max(100, p - 50))}>
                <Ionicons name="remove" size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={[styles.priceVal, { color: Colors.text }]}>{price} FCFA</Text>
              <TouchableOpacity style={[styles.priceBtn, { backgroundColor: Colors.orange }]} onPress={() => setPrice(p => p + 50)}>
                <Ionicons name="add" size={22} color="#0D0D0D" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={handlePublishOffer} disabled={loading}>
              {loading ? <ActivityIndicator color="#0D0D0D" /> : (
                <><Text style={styles.btnText}>Publier la demande</Text><Ionicons name="radio" size={18} color="#0D0D0D" /></>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* WAITING STEP */}
        {step === 'waiting' && (
          <View style={styles.stepContent}>
            <View style={styles.waitingHeader}>
              <ActivityIndicator color={Colors.orange} />
              <View>
                <Text style={[styles.stepTitle, { color: Colors.text }]}>Recherche...</Text>
                <Text style={[styles.stepSub, { color: Colors.textMuted }]}>{currentOffer?.proposals?.length || 0} chauffeur(s) disponible(s)</Text>
              </View>
              <Text style={[styles.waitPrice, { color: Colors.orange }]}>{price} F</Text>
            </View>

            {currentOffer?.proposals && currentOffer.proposals.length > 0 ? (
              <FlatList
                data={currentOffer.proposals}
                keyExtractor={item => item.id || item.driverId}
                scrollEnabled={false}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }: { item: Bid }) => (
                  <TouchableOpacity
                    style={[styles.driverCard, { backgroundColor: Colors.input, borderColor: Colors.cardBorder }]}
                    onPress={() => handleSelectDriver(item.driverId)}
                  >
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{item.driverName?.[0] || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.driverName, { color: Colors.text }]}>{item.driverName}</Text>
                      <Text style={[styles.driverMeta, { color: Colors.textMuted }]}>
                        {item.brand || 'Véhicule'} • <Ionicons name="star" size={11} color={Colors.orange} /> {item.rating?.toFixed(1) || '4.8'}
                      </Text>
                    </View>
                    <View style={styles.goBtn}>
                      <Text style={styles.goBtnText}>Go</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.emptyWait}>
                <Text style={[styles.emptyText, { color: Colors.textMuted }]}>Radar actif — les chauffeurs voient votre demande</Text>
              </View>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOffer}>
              <Text style={[styles.cancelText, { color: Colors.red }]}>Annuler la recherche</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIVE STEP */}
        {step === 'active' && (
          <View style={styles.stepContent}>
            <View style={[styles.activeBanner, { backgroundColor: Colors.greenBg }]}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.green} />
              <View>
                <Text style={[styles.activeTitle, { color: Colors.green }]}>Course acceptée !</Text>
                <Text style={[styles.activeSub, { color: Colors.textMuted }]}>Votre chauffeur est en route</Text>
              </View>
            </View>
            {pickup && dest && (
              <View style={styles.tripMini}>
                <View style={styles.tripRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.orange }]} />
                  <Text style={[styles.tripText, { color: Colors.text }]} numberOfLines={1}>{pickup.name.split(',')[0]}</Text>
                </View>
                <View style={[styles.tripLine, { backgroundColor: Colors.cardBorder }]} />
                <View style={styles.tripRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.blue }]} />
                  <Text style={[styles.tripText, { color: Colors.text }]} numberOfLines={1}>{dest.name.split(',')[0]}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={handleFinishRide} disabled={loading}>
              {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.btnText}>Confirmer l'arrivée</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && (
          <View style={styles.stepContent}>
            <View style={styles.reviewHead}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.green }]}>
                <Ionicons name="checkmark" size={32} color="white" />
              </View>
              <Text style={[styles.stepTitle, { color: Colors.text }]}>Vous êtes arrivé !</Text>
              <Text style={[styles.stepSub, { color: Colors.textMuted }]}>Notez votre chauffeur</Text>
            </View>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setStars(s)}>
                  <Ionicons name={s <= stars ? 'star' : 'star-outline'} size={34} color={Colors.orange} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.commentInput, { backgroundColor: Colors.input, color: Colors.text, borderColor: Colors.inputBorder }]}
              placeholder="Commentaire (optionnel)"
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmitReview}>
              <Text style={styles.btnText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  mapContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  map: { flex: 1 },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 12, paddingHorizontal: Spacing.lg, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, elevation: 20,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 34, height: 34, backgroundColor: '#FF8C00', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: 'white', fontWeight: '900', fontSize: 16, fontStyle: 'italic' },
  logoText: { fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
  userTag: { fontWeight: '900', fontSize: 9, letterSpacing: 2 },
  stepContent: { gap: Spacing.md, overflow: 'visible' },
  stepTitle: { fontWeight: '900', fontSize: 22, letterSpacing: -0.5 },
  stepSub: { fontWeight: '600', fontSize: 12 },
  inputsWrap: { gap: 4, overflow: 'visible' },
  inputLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  connector: { width: 2, height: 14, marginLeft: 4 },
  btnPrimary: {
    backgroundColor: '#FF8C00', borderRadius: Radius.lg, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 6,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontWeight: '700', fontSize: 12 },
  tripMini: { gap: 4 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripLine: { width: 2, height: 12, marginLeft: 4 },
  tripText: { flex: 1, fontWeight: '600', fontSize: 13 },
  priceLabel: { fontWeight: '900', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' },
  bigPrice: { fontWeight: '900', fontSize: 48, letterSpacing: -2, textAlign: 'center' },
  priceSuffix: { fontSize: 18 },
  priceControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: Radius.xl, padding: 8 },
  priceBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priceVal: { fontWeight: '900', fontSize: 16 },
  waitingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  waitPrice: { fontWeight: '900', fontSize: 16, marginLeft: 'auto' },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: 12, borderWidth: 1, marginBottom: 6 },
  driverAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FF8C00', alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { color: 'white', fontWeight: '900', fontSize: 16 },
  driverName: { fontWeight: '900', fontSize: 13 },
  driverMeta: { fontWeight: '600', fontSize: 11 },
  goBtn: { backgroundColor: '#FF8C00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  goBtnText: { color: '#0D0D0D', fontWeight: '900', fontSize: 13 },
  emptyWait: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontWeight: '700', fontSize: 12, textAlign: 'center' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: 12 },
  activeTitle: { fontWeight: '900', fontSize: 14 },
  activeSub: { fontWeight: '600', fontSize: 12 },
  reviewHead: { alignItems: 'center', gap: 8 },
  reviewIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  commentInput: { borderRadius: Radius.md, padding: 12, fontWeight: '600', fontSize: 13, minHeight: 60, textAlignVertical: 'top', borderWidth: 1 },
});