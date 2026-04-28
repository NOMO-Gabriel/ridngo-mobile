import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Animated, Modal,
  TextInput, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { rideService } from '../../src/services/rideService';
import { LocationSearch } from '../../src/components/LocationSearch';
import { Colors, Spacing, Radius } from '../../src/types/theme';
import { Location, OfferResponse, Bid } from '../../src/types/api';

type Step = 'search' | 'price' | 'searching' | 'active' | 'review';

export default function RideScreen() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState<Step>('search');
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dest, setDest] = useState<Location | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState(500);
  const [price, setPrice] = useState(500);
  const [loading, setLoading] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<OfferResponse | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for existing active ride on mount
  useEffect(() => {
    checkExistingRide();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkExistingRide = async () => {
    const ride = await rideService.getCurrentPassengerRide();
    if (ride) {
      setActiveRideId(ride.id);
      setStep('active');
    }
  };

  const handleEstimate = async () => {
    if (!pickup || !dest) return;
    setLoading(true);
    try {
      const fare = await rideService.estimateFare(pickup.name, dest.name);
      const p = fare.estimatedPrice || fare.price || 500;
      setEstimatedPrice(p);
      setPrice(p);
      setStep('price');
    } catch {
      Alert.alert('Erreur', "Impossible d'estimer le prix. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
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
      setStep('searching');
      startPolling(offer.id);
    } catch {
      Alert.alert('Erreur', "Impossible de publier l'offre.");
    } finally {
      setLoading(false);
    }
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
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 4000);
  };

  const handleSelectDriver = async (driverId: string) => {
    if (!currentOffer) return;
    setLoading(true);
    try {
      await rideService.selectDriver(currentOffer.id, driverId);
      Alert.alert('✅ Chauffeur sélectionné', 'En attente de confirmation du chauffeur...');
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner ce chauffeur.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOffer = async () => {
    Alert.alert('Annuler', 'Voulez-vous annuler la recherche ?', [
      { text: 'Non' },
      {
        text: 'Oui, annuler', style: 'destructive', onPress: () => {
          if (pollRef.current) clearInterval(pollRef.current);
          setCurrentOffer(null);
          setStep('search');
        }
      }
    ]);
  };

  const handleFinishRide = async () => {
    if (!activeRideId) return;
    setLoading(true);
    try {
      await rideService.completeRide(activeRideId);
      setStep('review');
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la course.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!activeRideId) return;
    try {
      await rideService.postReview(activeRideId, stars, comment);
    } catch { /* ignore */ }
    setStep('search');
    setPickup(null);
    setDest(null);
    setCurrentOffer(null);
    setActiveRideId(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}><Text style={styles.logoLetter}>R</Text></View>
            <Text style={styles.logoText}>RidnGo</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.userBadge}>
              <Ionicons name="person" size={14} color={Colors.orange} />
              <Text style={styles.userName} numberOfLines={1}>{user?.name?.split(' ')[0]}</Text>
            </View>
            <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== STEP: SEARCH ===== */}
        {step === 'search' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Où allez-vous ?</Text>
            <Text style={styles.cardSub}>Saisissez vos adresses pour obtenir une estimation</Text>
            <View style={styles.inputsContainer}>
              <View style={styles.inputLine}>
                <View style={styles.dotOrange} />
                <View style={{ flex: 1 }}>
                  <LocationSearch
                    placeholder="Lieu de départ"
                    value={pickup?.name || ''}
                    onSelect={setPickup}
                    icon="navigate"
                    showGPS
                  />
                </View>
              </View>
              <View style={styles.dashedLine} />
              <View style={styles.inputLine}>
                <View style={styles.dotWhite} />
                <View style={{ flex: 1 }}>
                  <LocationSearch
                    placeholder="Destination finale"
                    value={dest?.name || ''}
                    onSelect={setDest}
                    icon="location"
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btnPrimary, (!pickup || !dest || loading) && styles.btnDisabled]}
              onPress={handleEstimate}
              disabled={!pickup || !dest || loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.dark} />
                : <><Text style={styles.btnText}>Voir les prix</Text><Ionicons name="arrow-forward" size={20} color={Colors.dark} /></>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ===== STEP: PRICE ===== */}
        {step === 'price' && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backRow} onPress={() => setStep('search')}>
              <Ionicons name="arrow-back" size={18} color={Colors.textMuted} />
              <Text style={styles.backText}>Modifier l'itinéraire</Text>
            </TouchableOpacity>

            {/* Trip summary */}
            <View style={styles.tripSummary}>
              <View style={styles.tripRow}>
                <View style={styles.dotOrange} />
                <Text style={styles.tripText} numberOfLines={1}>{pickup?.name.split(',')[0]}</Text>
              </View>
              <View style={styles.tripArrow}><Ionicons name="arrow-down" size={14} color={Colors.textMuted} /></View>
              <View style={styles.tripRow}>
                <View style={styles.dotWhite} />
                <Text style={styles.tripText} numberOfLines={1}>{dest?.name.split(',')[0]}</Text>
              </View>
            </View>

            <Text style={styles.sectionTag}>ESTIMATION CONSEILLÉE</Text>
            <Text style={styles.bigPrice}>{price} <Text style={styles.priceUnit}>F</Text></Text>
            <Text style={styles.priceHint}>Vous pouvez ajuster ce montant</Text>

            <View style={styles.priceControl}>
              <TouchableOpacity
                style={styles.priceBtnMinus}
                onPress={() => setPrice(p => Math.max(100, p - 50))}
              >
                <Ionicons name="remove" size={24} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.priceDisplay}>{price} F</Text>
              <TouchableOpacity
                style={styles.priceBtnPlus}
                onPress={() => setPrice(p => p + 50)}
              >
                <Ionicons name="add" size={24} color={Colors.dark} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={handlePublishOffer}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.dark} />
                : <><Text style={styles.btnText}>Publier la demande</Text><Ionicons name="radio" size={20} color={Colors.dark} /></>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ===== STEP: SEARCHING ===== */}
        {step === 'searching' && (
          <View style={styles.card}>
            <View style={styles.searchingHeader}>
              <View style={styles.pulseDot} />
              <View style={styles.pulseDot2} />
              <Text style={styles.searchingLabel}>Recherche en cours...</Text>
              <Text style={styles.priceTag}>{price} F</Text>
            </View>

            {/* Trip mini summary */}
            {pickup && dest && (
              <View style={styles.miniSummary}>
                <Ionicons name="navigate" size={12} color={Colors.orange} />
                <Text style={styles.miniText} numberOfLines={1}>{pickup.name.split(',')[0]}</Text>
                <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />
                <Text style={styles.miniText} numberOfLines={1}>{dest.name.split(',')[0]}</Text>
              </View>
            )}

            {/* Drivers list */}
            {!currentOffer?.proposals?.length ? (
              <View style={styles.emptyRadar}>
                <ActivityIndicator color={Colors.orange} size="large" />
                <Text style={styles.emptyText}>Radar actif — en attente de chauffeurs</Text>
              </View>
            ) : (
              <FlatList
                data={currentOffer.proposals}
                keyExtractor={item => item.id || item.driverId}
                scrollEnabled={false}
                renderItem={({ item }: { item: Bid }) => (
                  <TouchableOpacity
                    style={styles.driverCard}
                    onPress={() => handleSelectDriver(item.driverId)}
                  >
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{item.driverName?.[0] || '?'}</Text>
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>{item.driverName}</Text>
                      <Text style={styles.driverMeta}>
                        {item.brand || 'Véhicule'} • {item.eta ? `${item.eta} min` : '~5 min'} •{' '}
                        <Ionicons name="star" size={11} color={Colors.orange} /> {item.rating?.toFixed(1) || '4.8'}
                      </Text>
                    </View>
                    <View style={styles.selectBtn}>
                      <Text style={styles.selectBtnText}>Go</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOffer}>
              <Text style={styles.cancelText}>Annuler la recherche</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===== STEP: ACTIVE RIDE ===== */}
        {step === 'active' && (
          <View style={styles.card}>
            <View style={styles.activeHeader}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.green} />
              <View>
                <Text style={styles.activeTitle}>Course Acceptée !</Text>
                <Text style={styles.activeSub}>Votre chauffeur est en route</Text>
              </View>
            </View>

            <View style={styles.rideInfo}>
              <View style={styles.rideInfoRow}>
                <Text style={styles.rideInfoLabel}>STATUT</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>En cours</Text>
                </View>
              </View>
              {pickup && dest && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.tripMini}>
                    <View style={styles.tripRow}>
                      <View style={styles.dotOrange} />
                      <Text style={styles.tripText} numberOfLines={1}>{pickup.name.split(',')[0]}</Text>
                    </View>
                    <View style={styles.tripArrow}><Ionicons name="arrow-down" size={14} color={Colors.textMuted} /></View>
                    <View style={styles.tripRow}>
                      <View style={styles.dotWhite} />
                      <Text style={styles.tripText} numberOfLines={1}>{dest.name.split(',')[0]}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={handleFinishRide}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.dark} />
                : <Text style={styles.btnText}>Simuler "Arrivée"</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ===== STEP: REVIEW ===== */}
        {step === 'review' && (
          <View style={styles.card}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewIcon}>
                <Ionicons name="checkmark" size={40} color={Colors.white} />
              </View>
              <Text style={styles.reviewTitle}>Vous êtes arrivé !</Text>
              <Text style={styles.reviewSub}>Notez votre chauffeur</Text>
            </View>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setStars(s)}>
                  <Ionicons name={s <= stars ? 'star' : 'star-outline'} size={36} color={Colors.orange} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="Laissez un commentaire (optionnel)"
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmitReview}>
              <Text style={styles.btnText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, padding: Spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 36, height: 36, backgroundColor: Colors.orange, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: Colors.white, fontWeight: '900', fontSize: 18, fontStyle: 'italic' },
  logoText: { color: Colors.white, fontWeight: '900', fontSize: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    maxWidth: 120,
  },
  userName: { color: Colors.orange, fontWeight: '900', fontSize: 12 },
  logoutBtn: { padding: 6 },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  cardTitle: { color: Colors.white, fontWeight: '900', fontSize: 26, letterSpacing: -0.5 },
  cardSub: { color: Colors.textSecondary, fontSize: 13 },

  inputsContainer: { gap: 4 },
  inputLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange },
  dotWhite: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  dashedLine: { width: 2, height: 16, backgroundColor: Colors.cardBorder, marginLeft: 4 },

  btnPrimary: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: Colors.dark, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },

  tripSummary: { backgroundColor: Colors.input, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripArrow: { paddingLeft: 5 },
  tripText: { flex: 1, color: Colors.white, fontWeight: '600', fontSize: 13 },

  sectionTag: { color: Colors.orange, fontWeight: '900', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  bigPrice: { color: Colors.white, fontWeight: '900', fontSize: 56, letterSpacing: -2, textAlign: 'center' },
  priceUnit: { fontSize: 22, color: Colors.textMuted },
  priceHint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '700' },

  priceControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.input, borderRadius: Radius.xl, padding: 8,
  },
  priceBtnMinus: {
    width: 56, height: 56, backgroundColor: Colors.darkCard,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  priceBtnPlus: {
    width: 56, height: 56, backgroundColor: Colors.orange,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  priceDisplay: { color: Colors.white, fontWeight: '900', fontSize: 20 },

  searchingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange },
  pulseDot2: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.orange, opacity: 0.4 },
  searchingLabel: { flex: 1, color: Colors.white, fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  priceTag: { color: Colors.orange, fontWeight: '900', fontSize: 16 },

  miniSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.input, padding: 10, borderRadius: Radius.md,
  },
  miniText: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },

  emptyRadar: { alignItems: 'center', gap: 12, paddingVertical: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.input, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: 8,
  },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { color: Colors.dark, fontWeight: '900', fontSize: 18 },
  driverInfo: { flex: 1 },
  driverName: { color: Colors.white, fontWeight: '900', fontSize: 14 },
  driverMeta: { color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
  selectBtn: {
    backgroundColor: Colors.orange, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.md,
  },
  selectBtnText: { color: Colors.dark, fontWeight: '900', fontSize: 13 },

  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: Colors.red, fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },

  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.greenBg, borderRadius: Radius.md, padding: Spacing.md },
  activeTitle: { color: Colors.green, fontWeight: '900', fontSize: 16 },
  activeSub: { color: Colors.textMuted, fontSize: 13 },

  rideInfo: { backgroundColor: Colors.input, borderRadius: Radius.md, padding: Spacing.md },
  rideInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideInfoLabel: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.greenBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  statusText: { color: Colors.green, fontWeight: '900', fontSize: 11 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 10 },
  tripMini: { gap: 4 },

  reviewHeader: { alignItems: 'center', gap: 12 },
  reviewIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, elevation: 8,
  },
  reviewTitle: { color: Colors.white, fontWeight: '900', fontSize: 28, letterSpacing: -0.5 },
  reviewSub: { color: Colors.textSecondary, fontSize: 14 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  commentInput: {
    backgroundColor: Colors.input, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.white, fontWeight: '600', fontSize: 14, minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.inputBorder,
  },
});
