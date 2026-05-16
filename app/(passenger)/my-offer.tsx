/**
 * app/(passenger)/my-offer.tsx
 * Page "Mon offre en cours" côté passager.
 *
 * - Polling GET /api/v1/offers/{id}/bids toutes les 3s
 * - Quand DRIVER_SELECTED → affiche nom + téléphone du chauffeur
 *   via GET /api/v1/users/drivers/{driverId}
 * - Quand VALIDATED → récupère le trip, poll GET /api/v1/trips/{id}
 *   jusqu'à COMPLETED → ouvre modal de notation
 * - Seul le chauffeur termine la course (pas de bouton ici)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, RefreshControl, Modal,
  Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../src/context/ThemeContext';
import { rideService, clearPassengerRideData } from '../../src/services/rideService';
import { Spacing, Radius } from '../../src/types/theme';
import { OfferResponse, RideResponse } from '../../src/types/api';
import api from '../../src/services/api';

type PageState =
  | 'loading' | 'no_offer' | 'waiting_bids' | 'has_bids'
  | 'driver_selected' | 'ride_active' | 'completed' | 'cancelled';

function formatTime(iso?: string) {
  if (!iso) return '--:--';
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
}

function stateLabel(state?: string): { label: string; color: string } {
  switch (state) {
    case 'PENDING':         return { label: 'EN ATTENTE',            color: '#FF8C00' };
    case 'BID_RECEIVED':    return { label: 'CANDIDATURES REÇUES',   color: '#3B82F6' };
    case 'DRIVER_SELECTED': return { label: 'CHAUFFEUR SÉLECTIONNÉ', color: '#22C55E' };
    case 'VALIDATED':       return { label: 'CONFIRMÉE',             color: '#22C55E' };
    case 'CANCELLED':       return { label: 'ANNULÉE',               color: '#EF4444' };
    default:                return { label: state || 'INCONNU',      color: '#9CA3AF' };
  }
}

export default function MyOfferScreen() {
  const { Colors } = useTheme();

  const [pageState, setPageState]     = useState<PageState>('loading');
  const [offer, setOffer]             = useState<OfferResponse | null>(null);
  const [ride, setRide]               = useState<RideResponse | null>(null);
  const [driver, setDriver]           = useState<any>(null);
  const [driverProfiles, setDriverProfiles] = useState<Record<string, any>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [cancelling, setCancelling]   = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  // Notation
  const [showReview, setShowReview]   = useState(false);
  const [stars, setStars]             = useState(5);
  const [comment, setComment]         = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerId  = useRef<string | null>(null);
  const rideId   = useRef<string | null>(null);

  useEffect(() => {
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const init = async () => {
    try {
      const stored = await SecureStore.getItemAsync('currentOfferId');
      if (!stored) { setPageState('no_offer'); return; }
      offerId.current = stored;
      await refreshOffer(stored);
      startOfferPolling(stored);
    } catch { setPageState('no_offer'); }
  };

  // Charger le profil d'un chauffeur
  const loadDriverProfile = useCallback(async (dId: string) => {
    if (driverProfiles[dId]) return;
    try {
      const res = await api.get(`/api/v1/users/drivers/${dId}`);
      const d = res.data;
      const u = d.user || d;
      const dr = d.driver || {};
      const v = d.vehicle || dr.vehicle || {};
      const profile = {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'Chauffeur',
        phone: u.telephone || u.phone || '',
        rating: dr.averageRating ?? 0,
        totalTrips: dr.totalTrips ?? 0,
        vehicleMake: v.makeName || '',
        vehicleModel: v.modelName || '',
        licensePlate: v.registrationNumber || '',
        isValidated: dr.isProfileValidated || false,
      };
      setDriverProfiles(prev => ({ ...prev, [dId]: profile }));
      return profile;
    } catch { return null; }
  }, [driverProfiles]);

  const refreshOffer = async (id: string) => {
    try {
      const data = await rideService.getOfferBids(id);
      setOffer(data);
      const state = data.state as string;

      if (state === 'CANCELLED') {
        if (pollRef.current) clearInterval(pollRef.current);
        await clearPassengerRideData();
        setPageState('cancelled');
        return;
      }

      if (state === 'VALIDATED') {
        // Récupérer le trip
        try {
          const tripData = await rideService.getRideByOffer(id);
          setRide(tripData);
          rideId.current = tripData.id;
          await SecureStore.setItemAsync('activeRideId', tripData.id);
          if (tripData.state === 'COMPLETED') {
            if (pollRef.current) clearInterval(pollRef.current);
            await clearPassengerRideData();
            setPageState('completed');
            setShowReview(true);
            return;
          }
          // Charger le profil du chauffeur
          if (data.selectedDriverId) {
            setSelectedDriverId(data.selectedDriverId);
            const p = await loadDriverProfile(data.selectedDriverId);
            if (p) setDriver(p);
          }
          setPageState('ride_active');
          startRidePolling(tripData.id);
        } catch { setPageState('ride_active'); }
        return;
      }

      if (state === 'DRIVER_SELECTED') {
        setPageState('driver_selected');
        setSelectedDriverId(data.selectedDriverId || null);
        if (data.selectedDriverId) {
          const p = await loadDriverProfile(data.selectedDriverId);
          if (p) setDriver(p);
        }
        if ((data.bids?.length || 0) > 0) loadBidProfiles(data.bids || []);
        return;
      }

      if ((data.bids?.length || 0) > 0) {
        setPageState('has_bids');
        loadBidProfiles(data.bids || []);
      } else {
        setPageState('waiting_bids');
      }
    } catch (e) {
      console.error('[MyOffer] refreshOffer error:', e);
    } finally { setRefreshing(false); }
  };

  const loadBidProfiles = (bids: any[]) => {
    bids.forEach(b => { if (b.driverId) loadDriverProfile(b.driverId); });
  };

  // Polling offre
  const startOfferPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshOffer(id), 3500);
  };

  // Polling trip (après VALIDATED)
  const startRidePolling = (tripId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await rideService.getRideDetails(tripId);
        setRide(data);
        if (data.state === 'COMPLETED') {
          clearInterval(pollRef.current!);
          await clearPassengerRideData();
          setPageState('completed');
          setShowReview(true);
        }
      } catch { }
    }, 3500);
  };

  const handleSelectDriver = async (driverId: string) => {
    if (!offerId.current) return;
    setSelectingId(driverId);
    try {
      await rideService.selectDriver(offerId.current, driverId);
      setSelectedDriverId(driverId);
      setPageState('driver_selected');
      const p = await loadDriverProfile(driverId);
      if (p) setDriver(p);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || e?.message || 'Impossible de sélectionner.');
    } finally { setSelectingId(null); }
  };

  const handleCancel = () => {
    Alert.alert('Annuler', 'Voulez-vous vraiment annuler votre demande ?', [
      { text: 'Non' },
      { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
        if (!offerId.current) return;
        setCancelling(true);
        try {
          await rideService.cancelOffer(offerId.current);
          if (pollRef.current) clearInterval(pollRef.current);
          setPageState('cancelled');
        } catch (e: any) {
          Alert.alert('Erreur', e?.message || "Impossible d'annuler.");
        } finally { setCancelling(false); }
      }},
    ]);
  };

  const handleSubmitReview = async () => {
    const tripId = rideId.current;
    if (!tripId) { router.back(); return; }
    setSubmittingReview(true);
    try {
      await rideService.submitReview(tripId, stars, comment);
    } catch { /* silent — ne pas bloquer si l'avis échoue */ }
    finally {
      setSubmittingReview(false);
      setShowReview(false);
      router.back();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (offerId.current) refreshOffer(offerId.current);
  };

  // ── Rendu états simples ────────────────────────────────────────────────────
  if (pageState === 'loading') return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  if (pageState === 'no_offer') return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: Colors.text }]}>Mon offre en cours</Text>
      </View>
      <View style={s.centered}>
        <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
        <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune offre en cours</Text>
        <Text style={[s.hint, { color: Colors.textMuted }]}>
          Publiez une offre depuis l'onglet Commander.
        </Text>
        <TouchableOpacity style={[s.goBtn, { backgroundColor: Colors.orange }]} onPress={() => router.back()}>
          <Text style={s.goBtnTxt}>Créer une offre</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (pageState === 'cancelled') return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.centered}>
        <Ionicons name="close-circle-outline" size={56} color={Colors.red} />
        <Text style={[s.emptyTitle, { color: Colors.text }]}>Offre annulée</Text>
        <TouchableOpacity style={[s.goBtn, { backgroundColor: Colors.orange }]} onPress={() => router.back()}>
          <Text style={s.goBtnTxt}>Nouvelle recherche</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
          <Text style={s.logoLetter}>R</Text>
        </View>
        <Text style={[s.headerTitle, { color: Colors.text }]}>Mon offre en cours</Text>
      </View>

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
        }>

        {/* ── Résumé offre ── */}
        {offer && (
          <View style={[s.offerCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            {(() => {
              const { label, color } = stateLabel(offer.state);
              return (
                <View style={s.offerTop}>
                  <View style={[s.stateBadge, { borderColor: color }]}>
                    <Text style={[s.stateBadgeTxt, { color }]}>{label}</Text>
                  </View>
                  {offer.departureTime && (
                    <View style={s.timeRow}>
                      <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                      <Text style={[s.timeTxt, { color: Colors.textMuted }]}>
                        {formatTime(offer.departureTime)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
            <View style={s.priceRow}>
              <Text style={[s.priceMain, { color: Colors.text }]}>{offer.price?.toLocaleString()}</Text>
              <Text style={[s.priceCurr, { color: Colors.textMuted }]}>FCFA</Text>
            </View>
            <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
              <View style={s.routeRow}>
                <View style={[s.dot, { backgroundColor: Colors.orange }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeLbl, { color: Colors.textMuted }]}>DÉPART</Text>
                  <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
                    {offer.startPoint}
                  </Text>
                </View>
              </View>
              <View style={[s.vline, { backgroundColor: Colors.cardBorder }]} />
              <View style={s.routeRow}>
                <View style={[s.dotOut, { borderColor: Colors.text }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeLbl, { color: Colors.textMuted }]}>DESTINATION</Text>
                  <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
                    {offer.endPoint}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── État : en attente ── */}
        {pageState === 'waiting_bids' && (
          <View style={[s.stateBlock, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            <ActivityIndicator color={Colors.orange} size="small" />
            <View style={{ flex: 1 }}>
              <Text style={[s.stateTitle, { color: Colors.text }]}>Radar actif</Text>
              <Text style={[s.stateSub, { color: Colors.textMuted }]}>
                Les chauffeurs disponibles vont répondre...
              </Text>
            </View>
          </View>
        )}

        {/* ── État : bids reçus ── */}
        {pageState === 'has_bids' && (
          <>
            <Text style={[s.sectionTitle, { color: Colors.text }]}>
              {(offer?.bids || []).length} chauffeur{(offer?.bids || []).length > 1 ? 's' : ''} disponible{(offer?.bids || []).length > 1 ? 's' : ''}
            </Text>
            {(offer?.bids || []).map(bid => {
              const p = driverProfiles[bid.driverId];
              const name = p?.name || bid.driverName || `Chauffeur #${bid.driverId.slice(-4)}`;
              const initial = name[0]?.toUpperCase() || 'C';
              return (
                <View key={bid.driverId}
                  style={[s.driverCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
                  <View style={s.driverTop}>
                    <View style={[s.driverAvatar, { backgroundColor: Colors.orange }]}>
                      <Text style={s.driverAvatarTxt}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.driverName, { color: Colors.text }]}>{name}</Text>
                      <View style={s.driverMeta}>
                        {p?.rating > 0 && (
                          <View style={s.metaItem}>
                            <Ionicons name="star" size={12} color={Colors.orange} />
                            <Text style={[s.metaTxt, { color: Colors.textMuted }]}>
                              {p.rating.toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {p?.totalTrips > 0 && (
                          <Text style={[s.metaTxt, { color: Colors.textMuted }]}>
                            {p.totalTrips} courses
                          </Text>
                        )}
                        {p?.isValidated && (
                          <View style={[s.verifiedChip, { backgroundColor: Colors.greenBg }]}>
                            <Ionicons name="shield-checkmark-outline" size={10} color={Colors.green} />
                            <Text style={[s.verifiedTxt, { color: Colors.green }]}>VÉRIFIÉ</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {(p?.vehicleMake || p?.licensePlate) && (
                    <View style={[s.vehicleRow, { backgroundColor: Colors.input }]}>
                      <Ionicons name="car-outline" size={13} color={Colors.textMuted} />
                      <Text style={[s.vehicleTxt, { color: Colors.textMuted }]} numberOfLines={1}>
                        {[p.vehicleMake, p.vehicleModel].filter(Boolean).join(' ')}
                        {p.licensePlate ? `  ·  ${p.licensePlate}` : ''}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.chooseBtn, { backgroundColor: Colors.text }]}
                    onPress={() => handleSelectDriver(bid.driverId)}
                    disabled={selectingId === bid.driverId}
                    activeOpacity={0.85}>
                    {selectingId === bid.driverId
                      ? <ActivityIndicator color={Colors.background} size="small" />
                      : <Text style={[s.chooseBtnTxt, { color: Colors.background }]}>
                          CHOISIR CE CHAUFFEUR
                        </Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {/* ── État : chauffeur sélectionné — afficher ses infos ── */}
        {(pageState === 'driver_selected' || pageState === 'ride_active') && driver && (
          <View style={[s.selectedDriverCard, {
            backgroundColor: Colors.card,
            borderColor: pageState === 'ride_active' ? Colors.green : Colors.orange,
          }]}>
            <View style={[s.selectedBanner, {
              backgroundColor: pageState === 'ride_active' ? Colors.greenBg : Colors.orangeBg }]}>
              <Ionicons
                name={pageState === 'ride_active' ? 'car' : 'checkmark-circle'}
                size={18}
                color={pageState === 'ride_active' ? Colors.green : Colors.orange}
              />
              <Text style={[s.selectedBannerTxt, {
                color: pageState === 'ride_active' ? Colors.green : Colors.orange }]}>
                {pageState === 'ride_active'
                  ? ride?.state === 'ONGOING' ? 'Chauffeur en route vers vous' : 'Course en cours'
                  : 'Chauffeur sélectionné — en attente de confirmation'}
              </Text>
            </View>
            {/* Profil chauffeur */}
            <View style={s.driverTop}>
              <View style={[s.driverAvatar, { backgroundColor: Colors.orange }]}>
                <Text style={s.driverAvatarTxt}>
                  {driver.name[0]?.toUpperCase() || 'C'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.driverName, { color: Colors.text }]}>{driver.name}</Text>
                <View style={s.driverMeta}>
                  {driver.rating > 0 && (
                    <View style={s.metaItem}>
                      <Ionicons name="star" size={12} color={Colors.orange} />
                      <Text style={[s.metaTxt, { color: Colors.textMuted }]}>
                        {driver.rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {driver.isValidated && (
                    <View style={[s.verifiedChip, { backgroundColor: Colors.greenBg }]}>
                      <Ionicons name="shield-checkmark-outline" size={10} color={Colors.green} />
                      <Text style={[s.verifiedTxt, { color: Colors.green }]}>VÉRIFIÉ</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            {/* Téléphone chauffeur — visible dès que sélectionné */}
            {driver.phone ? (
              <TouchableOpacity
                style={[s.phoneRow, { backgroundColor: Colors.input }]}
                onPress={() => Linking.openURL(`tel:${driver.phone}`).catch(() => {})}>
                <Ionicons name="call-outline" size={16} color={Colors.orange} />
                <Text style={[s.phoneTxt, { color: Colors.text }]}>{driver.phone}</Text>
                <Text style={[s.phoneAction, { color: Colors.orange }]}>APPELER</Text>
              </TouchableOpacity>
            ) : null}
            {/* Véhicule */}
            {(driver.vehicleMake || driver.licensePlate) && (
              <View style={[s.vehicleRow, { backgroundColor: Colors.input }]}>
                <Ionicons name="car-outline" size={13} color={Colors.textMuted} />
                <Text style={[s.vehicleTxt, { color: Colors.textMuted }]}>
                  {[driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ')}
                  {driver.licensePlate ? `  ·  ${driver.licensePlate}` : ''}
                </Text>
              </View>
            )}
            {/* Message attente si CREATED */}
            {pageState === 'ride_active' && ride?.state === 'CREATED' && (
              <View style={[s.waitRow, { backgroundColor: Colors.orangeBg }]}>
                <ActivityIndicator size="small" color={Colors.orange} />
                <Text style={[s.waitTxt, { color: Colors.orange }]}>
                  Le chauffeur vient vous récupérer...
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Attente confirmation chauffeur */}
        {pageState === 'driver_selected' && !driver && (
          <View style={[s.stateBlock, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            <ActivityIndicator color={Colors.green} size="small" />
            <View style={{ flex: 1 }}>
              <Text style={[s.stateTitle, { color: Colors.text }]}>Chauffeur sélectionné</Text>
              <Text style={[s.stateSub, { color: Colors.textMuted }]}>
                En attente de sa confirmation...
              </Text>
            </View>
          </View>
        )}

        {/* Bouton annuler — masqué si course active */}
        {pageState !== 'ride_active' && pageState !== 'completed' && (
          <TouchableOpacity
            style={[s.cancelBtn, { borderColor: Colors.cardBorder }]}
            onPress={handleCancel} disabled={cancelling}>
            {cancelling
              ? <ActivityIndicator size="small" color={Colors.red} />
              : <Text style={[s.cancelTxt, { color: Colors.red }]}>Annuler ma demande</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal de notation ── */}
      <Modal visible={showReview} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: Colors.card }]}>
            <Text style={[s.modalTitle, { color: Colors.text }]}>Course terminée</Text>
            <Text style={[s.modalSub, { color: Colors.textMuted }]}>
              Comment s'est passé votre trajet ?
            </Text>
            {/* Étoiles */}
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}>
                  <Ionicons
                    name={n <= stars ? 'star' : 'star-outline'}
                    size={36} color={Colors.orange}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {/* Commentaire */}
            <TextInput
              style={[s.commentInput, {
                color: Colors.text, backgroundColor: Colors.input,
                borderColor: Colors.cardBorder,
              }]}
              value={comment}
              onChangeText={setComment}
              placeholder="Un commentaire... (optionnel)"
              placeholderTextColor={Colors.textMuted}
              multiline numberOfLines={3}
            />
            <TouchableOpacity
              style={[s.reviewBtn, { backgroundColor: Colors.orange }]}
              onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview
                ? <ActivityIndicator color="#0D0D0D" />
                : <Text style={s.reviewBtnTxt}>ENVOYER MON AVIS</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowReview(false); router.back(); }}>
              <Text style={[s.skipTxt, { color: Colors.textMuted }]}>Passer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  scroll:  { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn:     { padding: 4 },
  logoBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 17 },
  headerTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  hint:        { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyTitle:  { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  goBtn:       { borderRadius: Radius.xl, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  goBtnTxt:    { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  offerCard:   { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  offerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateBadge:  { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  stateBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeTxt:     { fontSize: 12, fontWeight: '700' },
  priceRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  priceMain:   { fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
  priceCurr:   { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  routeBlock:  { borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  routeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeLbl:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  routePlace:  { fontSize: 14, fontWeight: '700', marginTop: 1 },
  dot:         { width: 10, height: 10, borderRadius: 5, marginTop: 13, flexShrink: 0 },
  dotOut:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 13, flexShrink: 0 },
  vline:       { width: 2, height: 14, marginLeft: 4, marginVertical: 2 },
  stateBlock:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  stateTitle:  { fontWeight: '900', fontSize: 14 },
  stateSub:    { fontWeight: '600', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontWeight: '900', fontSize: 14 },
  driverCard:  { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  driverTop:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  driverAvatarTxt: { color: '#fff', fontWeight: '900', fontSize: 20 },
  driverName:  { fontSize: 15, fontWeight: '900' },
  driverMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt:     { fontSize: 11, fontWeight: '600' },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedTxt: { fontSize: 9, fontWeight: '900' },
  vehicleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10 },
  vehicleTxt:  { fontSize: 12, fontWeight: '600', flex: 1 },
  chooseBtn:   { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  chooseBtnTxt: { fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
  selectedDriverCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  selectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10 },
  selectedBannerTxt: { fontWeight: '700', fontSize: 13, flex: 1 },
  phoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  phoneTxt:    { flex: 1, fontWeight: '700', fontSize: 14 },
  phoneAction: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  waitRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10 },
  waitTxt:     { fontWeight: '700', fontSize: 12, flex: 1 },
  cancelBtn:   { borderRadius: Radius.xl, borderWidth: 1, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelTxt:   { fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 16 },
  modalTitle:  { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  modalSub:    { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  starsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  commentInput: { borderRadius: Radius.md, borderWidth: 1, padding: 12, fontWeight: '500', fontSize: 14, textAlignVertical: 'top', minHeight: 80 },
  reviewBtn:   { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  reviewBtnTxt: { color: '#0D0D0D', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  skipTxt:     { textAlign: 'center', fontWeight: '700', fontSize: 13, paddingVertical: 8 },
});

// /**
//  * app/(passenger)/my-offer.tsx
//  *
//  * Page dédiée à l'offre en cours du passager.
//  * Affiche la liste des chauffeurs ayant postulé (bids),
//  * permet au passager de choisir un chauffeur, puis attend
//  * la confirmation du chauffeur choisi.
//  *
//  * Routes :
//  *   GET  /api/v1/offers/{id}/bids          → polling des candidatures
//  *   PATCH /api/v1/offers/{id}/select-driver → sélection du chauffeur
//  *   GET  /api/v1/users/drivers/{driverId}   → profil enrichi du chauffeur
//  *   POST /api/v1/offers/{id}/cancel         → annulation de l'offre
//  */

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import {
//   View, Text, TouchableOpacity, StyleSheet,
//   ScrollView, ActivityIndicator, Alert, RefreshControl,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
// import { useAuth } from '../../src/context/AuthContext';
// import { useTheme } from '../../src/context/ThemeContext';
// import { ThemeToggle } from '../../src/components/ThemeToggle';
// import { rideService } from '../../src/services/rideService';
// import { Spacing, Radius } from '../../src/types/theme';
// import { OfferResponse, Bid } from '../../src/types/api';
// import api from '../../src/services/api';

// // ─── Types ────────────────────────────────────────────────────────────────────
// type PageState = 'loading' | 'no_offer' | 'waiting_bids' | 'has_bids' | 'driver_selected' | 'validated' | 'cancelled';

// interface DriverProfile {
//   id: string;
//   name: string;
//   rating: number;
//   totalTrips: number;
//   vehicleMake: string;
//   vehicleModel: string;
//   licensePlate: string;
//   isValidated: boolean;
// }

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function formatTime(iso?: string) {
//   if (!iso) return '--:--';
//   try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
//   catch { return iso; }
// }

// function stateLabel(state?: string): { label: string; color: string } {
//   switch (state) {
//     case 'PENDING':          return { label: 'EN ATTENTE',        color: '#FF8C00' };
//     case 'BID_RECEIVED':     return { label: 'CANDIDATURES REÇUES', color: '#3B82F6' };
//     case 'DRIVER_SELECTED':  return { label: 'CHAUFFEUR SÉLECTIONNÉ', color: '#22C55E' };
//     case 'VALIDATED':        return { label: 'CONFIRMÉE',          color: '#22C55E' };
//     case 'CANCELLED':        return { label: 'ANNULÉE',            color: '#EF4444' };
//     default:                 return { label: state || 'INCONNU',   color: '#9CA3AF' };
//   }
// }

// // ─── Composant card chauffeur ─────────────────────────────────────────────────
// interface DriverCardProps {
//   bid: Bid;
//   profile: DriverProfile | null;
//   isSelected: boolean;
//   isSelecting: boolean;
//   onSelect: () => void;
//   Colors: any;
// }

// function DriverCard({ bid, profile, isSelected, isSelecting, onSelect, Colors }: DriverCardProps) {
//   const name    = profile?.name    || bid.driverName || `Chauffeur #${bid.driverId.slice(-4)}`;
//   const rating  = profile?.rating  ?? bid.rating  ?? 0;
//   const trips   = profile?.totalTrips ?? bid.totalTrips ?? 0;
//   const make    = profile?.vehicleMake    || bid.brand  || '';
//   const model   = profile?.vehicleModel   || bid.model  || '';
//   const plate   = profile?.licensePlate   || bid.licensePlate || '';
//   const initial = name[0]?.toUpperCase() || 'C';

//   return (
//     <View style={[card.wrap, { backgroundColor: Colors.card, borderColor: isSelected ? Colors.orange : Colors.cardBorder }]}>
//       {/* En-tête : avatar + infos */}
//       <View style={card.top}>
//         <View style={[card.avatar, { backgroundColor: Colors.orange }]}>
//           <Text style={card.avatarTxt}>{initial}</Text>
//         </View>
//         <View style={{ flex: 1 }}>
//           <Text style={[card.name, { color: Colors.text }]} numberOfLines={1}>{name}</Text>
//           {/* Note + courses */}
//           <View style={card.metaRow}>
//             {rating > 0 && (
//               <View style={card.metaItem}>
//                 <Ionicons name="star" size={12} color={Colors.orange} />
//                 <Text style={[card.metaTxt, { color: Colors.textMuted }]}>{rating.toFixed(1)}</Text>
//               </View>
//             )}
//             {trips > 0 && (
//               <View style={card.metaItem}>
//                 <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
//                 <Text style={[card.metaTxt, { color: Colors.textMuted }]}>{trips} course{trips > 1 ? 's' : ''}</Text>
//               </View>
//             )}
//             {profile?.isValidated && (
//               <View style={[card.verifiedChip, { backgroundColor: Colors.greenBg }]}>
//                 <Ionicons name="shield-checkmark-outline" size={11} color={Colors.green} />
//                 <Text style={[card.verifiedTxt, { color: Colors.green }]}>VÉRIFIÉ</Text>
//               </View>
//             )}
//           </View>
//         </View>
//       </View>

//       {/* Véhicule */}
//       {(make || plate) ? (
//         <View style={[card.vehicleRow, { backgroundColor: Colors.input }]}>
//           <Ionicons name="car-outline" size={14} color={Colors.textMuted} />
//           <Text style={[card.vehicleTxt, { color: Colors.textMuted }]} numberOfLines={1}>
//             {[make, model].filter(Boolean).join(' ')}{plate ? `  ·  ${plate}` : ''}
//           </Text>
//         </View>
//       ) : null}

//       {/* Bouton */}
//       {isSelected ? (
//         <View style={[card.selectedBanner, { backgroundColor: Colors.greenBg }]}>
//           <ActivityIndicator size="small" color={Colors.green} />
//           <Text style={[card.selectedTxt, { color: Colors.green }]}>
//             En attente de confirmation...
//           </Text>
//         </View>
//       ) : (
//         <TouchableOpacity
//           style={[card.chooseBtn, { backgroundColor: Colors.text }]}
//           onPress={onSelect}
//           disabled={isSelecting}
//           activeOpacity={0.85}
//         >
//           {isSelecting
//             ? <ActivityIndicator color={Colors.background} size="small" />
//             : <Text style={[card.chooseBtnTxt, { color: Colors.background }]}>
//                 CHOISIR CE CHAUFFEUR
//               </Text>
//           }
//         </TouchableOpacity>
//       )}
//     </View>
//   );
// }

// const card = StyleSheet.create({
//   wrap:        { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
//   top:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   avatar:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
//   avatarTxt:   { color: '#fff', fontWeight: '900', fontSize: 20 },
//   name:        { fontSize: 15, fontWeight: '900' },
//   metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
//   metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
//   metaTxt:     { fontSize: 11, fontWeight: '600' },
//   verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
//   verifiedTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
//   vehicleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10 },
//   vehicleTxt:  { fontSize: 12, fontWeight: '600', flex: 1 },
//   selectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 12 },
//   selectedTxt:    { fontWeight: '700', fontSize: 13 },
//   chooseBtn:   { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
//   chooseBtnTxt: { fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
// });

// // ─── Composant principal ──────────────────────────────────────────────────────
// export default function MyOfferScreen() {
//   const { user } = useAuth();
//   const { Colors } = useTheme();

//   const [pageState, setPageState]           = useState<PageState>('loading');
//   const [offer, setOffer]                   = useState<OfferResponse | null>(null);
//   const [driverProfiles, setDriverProfiles] = useState<Record<string, DriverProfile>>({});
//   const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
//   const [selectingId, setSelectingId]       = useState<string | null>(null);
//   const [cancelling, setCancelling]         = useState(false);
//   const [refreshing, setRefreshing]         = useState(false);

//   const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
//   const offerId    = useRef<string | null>(null);

//   // ── Init ─────────────────────────────────────────────────────────────────
//   useEffect(() => {
//     init();
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   const init = async () => {
//     try {
//       const stored = await SecureStore.getItemAsync('currentOfferId');
//       if (!stored) { setPageState('no_offer'); return; }
//       offerId.current = stored;
//       await refreshOffer(stored);
//       startPolling(stored);
//     } catch {
//       setPageState('no_offer');
//     }
//   };

//   // ── Rafraîchir l'offre et ses bids ───────────────────────────────────────
//   const refreshOffer = async (id: string) => {
//     try {
//       const data = await rideService.getOfferBids(id);
//       setOffer(data);

//       const state = data.state as string;

//       if (state === 'CANCELLED') {
//         setPageState('cancelled');
//         if (pollRef.current) clearInterval(pollRef.current);
//         await SecureStore.deleteItemAsync('currentOfferId');
//         return;
//       }

//       if (state === 'VALIDATED') {
//         setPageState('validated');
//         if (pollRef.current) clearInterval(pollRef.current);
//         // Naviguer vers la course active
//         try {
//           const ride = await rideService.getRideByOffer(id);
//           await SecureStore.setItemAsync('activeRideId', ride.id);
//         } catch { /* silent */ }
//         return;
//       }

//       if (state === 'DRIVER_SELECTED') {
//         setPageState('driver_selected');
//         setSelectedDriverId(data.selectedDriverId || null);
//       } else if ((data.bids?.length || 0) > 0) {
//         setPageState('has_bids');
//         loadDriverProfiles(data.bids || []);
//       } else {
//         setPageState('waiting_bids');
//       }
//     } catch (e) {
//       console.error('[MyOffer] refreshOffer error:', e);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   // ── Charger les profils chauffeurs ────────────────────────────────────────
//   const loadDriverProfiles = useCallback(async (bids: Bid[]) => {
//     const toLoad = bids.filter(b => b.driverId && !driverProfiles[b.driverId]);
//     if (!toLoad.length) return;

//     const results = await Promise.allSettled(
//       toLoad.map(b => api.get(`/api/v1/users/drivers/${b.driverId}`))
//     );

//     const newProfiles: Record<string, DriverProfile> = {};
//     results.forEach((res, i) => {
//       if (res.status === 'fulfilled') {
//         const d = res.value.data;
//         const u = d.user || d;
//         const dr = d.driver || {};
//         const v = d.vehicle || dr.vehicle || {};
//         newProfiles[toLoad[i].driverId] = {
//           id:           toLoad[i].driverId,
//           name:         `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '',
//           rating:       dr.averageRating ?? 0,
//           totalTrips:   dr.totalTrips    ?? 0,
//           vehicleMake:  v.makeName  || v.vehicleMakeName  || '',
//           vehicleModel: v.modelName || v.vehicleModelName || '',
//           licensePlate: v.registrationNumber || '',
//           isValidated:  dr.isProfileValidated || false,
//         };
//       }
//     });
//     setDriverProfiles(prev => ({ ...prev, ...newProfiles }));
//   }, [driverProfiles]);

//   // ── Polling ───────────────────────────────────────────────────────────────
//   const startPolling = (id: string) => {
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => refreshOffer(id), 3500);
//   };

//   // ── Sélection d'un chauffeur ──────────────────────────────────────────────
//   const handleSelectDriver = async (driverId: string) => {
//     if (!offerId.current) return;
//     setSelectingId(driverId);
//     try {
//       await rideService.selectDriver(offerId.current, driverId);
//       setSelectedDriverId(driverId);
//       setPageState('driver_selected');
//     } catch (e: any) {
//       const msg = e?.response?.data?.message || e?.message || 'Impossible de sélectionner ce chauffeur.';
//       Alert.alert('Erreur', msg);
//     } finally {
//       setSelectingId(null);
//     }
//   };

//   // ── Annulation de l'offre ─────────────────────────────────────────────────
//   const handleCancel = () => {
//     Alert.alert(
//       'Annuler la demande',
//       'Voulez-vous vraiment annuler votre demande de course ?',
//       [
//         { text: 'Non' },
//         {
//           text: 'Oui, annuler',
//           style: 'destructive',
//           onPress: async () => {
//             if (!offerId.current) return;
//             setCancelling(true);
//             try {
//               await rideService.cancelOffer(offerId.current);
//               await SecureStore.deleteItemAsync('currentOfferId');
//               if (pollRef.current) clearInterval(pollRef.current);
//               setPageState('cancelled');
//             } catch (e: any) {
//               Alert.alert('Erreur', e?.message || "Impossible d'annuler l'offre.");
//             } finally {
//               setCancelling(false);
//             }
//           },
//         },
//       ]
//     );
//   };

//   const onRefresh = () => {
//     setRefreshing(true);
//     if (offerId.current) refreshOffer(offerId.current);
//   };

//   // ─────────────────────────────────────────────────────────────────────────
//   // RENDU
//   // ─────────────────────────────────────────────────────────────────────────
//   return (
//     <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>

//       {/* Header */}
//       <View style={[s.header, { borderBottomColor: Colors.cardBorder }]}>
//         <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
//           <Ionicons name="arrow-back" size={22} color={Colors.text} />
//         </TouchableOpacity>
//         <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
//           <Text style={s.logoLetter}>R</Text>
//         </View>
//         <Text style={[s.headerTitle, { color: Colors.text }]}>Mon offre en cours</Text>
//         <View style={{ flex: 1 }} />
//         <ThemeToggle />
//       </View>

//       {/* ── Loading ── */}
//       {pageState === 'loading' && (
//         <View style={s.centered}>
//           <ActivityIndicator color={Colors.orange} size="large" />
//           <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement de votre offre...</Text>
//         </View>
//       )}

//       {/* ── Aucune offre ── */}
//       {pageState === 'no_offer' && (
//         <View style={s.centered}>
//           <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
//           <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune offre en cours</Text>
//           <Text style={[s.hint, { color: Colors.textMuted }]}>
//             Publiez une offre depuis l'onglet Commander.
//           </Text>
//           <TouchableOpacity
//             style={[s.goSearchBtn, { backgroundColor: Colors.orange }]}
//             onPress={() => router.back()}
//           >
//             <Text style={s.goSearchTxt}>Créer une offre</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       {/* ── Offre annulée ── */}
//       {pageState === 'cancelled' && (
//         <View style={s.centered}>
//           <Ionicons name="close-circle-outline" size={48} color={Colors.red} />
//           <Text style={[s.emptyTitle, { color: Colors.text }]}>Offre annulée</Text>
//           <Text style={[s.hint, { color: Colors.textMuted }]}>Votre demande a été annulée.</Text>
//           <TouchableOpacity
//             style={[s.goSearchBtn, { backgroundColor: Colors.orange }]}
//             onPress={() => router.back()}
//           >
//             <Text style={s.goSearchTxt}>Nouvelle recherche</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       {/* ── Offre validée → course démarrée ── */}
//       {pageState === 'validated' && (
//         <View style={s.centered}>
//           <Ionicons name="checkmark-circle-outline" size={48} color={Colors.green} />
//           <Text style={[s.emptyTitle, { color: Colors.text }]}>Course confirmée</Text>
//           <Text style={[s.hint, { color: Colors.textMuted }]}>
//             Le chauffeur est en route.
//           </Text>
//           <TouchableOpacity
//             style={[s.goSearchBtn, { backgroundColor: Colors.green }]}
//             onPress={() => router.back()}
//           >
//             <Text style={s.goSearchTxt}>Voir la course</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       {/* ── Contenu principal (offre active) ── */}
//       {(pageState === 'waiting_bids' || pageState === 'has_bids' || pageState === 'driver_selected') && offer && (
//         <ScrollView
//           style={{ flex: 1 }}
//           contentContainerStyle={[s.scroll, { paddingBottom: 40 }]}
//           showsVerticalScrollIndicator={false}
//           refreshControl={
//             <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
//           }
//         >
//           {/* ── Résumé de l'offre ── */}
//           <View style={[s.offerSummary, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//             {/* Badge état */}
//             {(() => {
//               const { label, color } = stateLabel(offer.state);
//               return (
//                 <View style={s.summaryTop}>
//                   <View style={[s.stateBadge, { borderColor: color }]}>
//                     <Text style={[s.stateBadgeTxt, { color }]}>{label}</Text>
//                   </View>
//                   {offer.departureTime && (
//                     <View style={s.timeRow}>
//                       <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
//                       <Text style={[s.timeTxt, { color: Colors.textMuted }]}>
//                         {formatTime(offer.departureTime)}
//                       </Text>
//                     </View>
//                   )}
//                 </View>
//               );
//             })()}

//             {/* Prix */}
//             <View style={s.priceRow}>
//               <Text style={[s.priceMain, { color: Colors.text }]}>{offer.price?.toLocaleString()}</Text>
//               <Text style={[s.priceCurrency, { color: Colors.textMuted }]}>FCFA</Text>
//             </View>

//             {/* Itinéraire */}
//             <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
//               <View style={s.routeRow}>
//                 <View style={[s.dotFilled, { backgroundColor: Colors.orange }]} />
//                 <View style={{ flex: 1 }}>
//                   <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DÉPART</Text>
//                   <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
//                     {offer.startPoint}
//                   </Text>
//                 </View>
//               </View>
//               <View style={[s.routeVLine, { backgroundColor: Colors.cardBorder }]} />
//               <View style={s.routeRow}>
//                 <View style={[s.dotOutline, { borderColor: Colors.text }]} />
//                 <View style={{ flex: 1 }}>
//                   <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DESTINATION</Text>
//                   <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
//                     {offer.endPoint}
//                   </Text>
//                 </View>
//               </View>
//             </View>
//           </View>

//           {/* ── Section bids ── */}
//           <View style={s.bidsSection}>

//             {/* Waiting */}
//             {pageState === 'waiting_bids' && (
//               <View style={[s.waitingBlock, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//                 <ActivityIndicator color={Colors.orange} size="small" />
//                 <View style={{ flex: 1 }}>
//                   <Text style={[s.waitingTitle, { color: Colors.text }]}>Radar actif</Text>
//                   <Text style={[s.waitingSub, { color: Colors.textMuted }]}>
//                     Les chauffeurs disponibles vont répondre...
//                   </Text>
//                 </View>
//               </View>
//             )}

//             {/* Chauffeur sélectionné en attente de confirmation */}
//             {pageState === 'driver_selected' && (
//               <View style={[s.selectedBlock, { backgroundColor: Colors.greenBg }]}>
//                 <Ionicons name="checkmark-circle" size={24} color={Colors.green} />
//                 <View style={{ flex: 1 }}>
//                   <Text style={[s.waitingTitle, { color: Colors.green }]}>Chauffeur sélectionné</Text>
//                   <Text style={[s.waitingSub, { color: Colors.green }]}>
//                     En attente de sa confirmation...
//                   </Text>
//                 </View>
//                 <ActivityIndicator size="small" color={Colors.green} />
//               </View>
//             )}

//             {/* Liste des bids */}
//             {(pageState === 'has_bids' || pageState === 'driver_selected') &&
//               (offer.bids || []).map(bid => (
//                 <DriverCard
//                   key={bid.driverId}
//                   bid={bid}
//                   profile={driverProfiles[bid.driverId] || null}
//                   isSelected={selectedDriverId === bid.driverId}
//                   isSelecting={selectingId === bid.driverId}
//                   onSelect={() => handleSelectDriver(bid.driverId)}
//                   Colors={Colors}
//                 />
//               ))
//             }

//             {/* Nombre de candidatures */}
//             {pageState === 'has_bids' && (
//               <Text style={[s.bidsCount, { color: Colors.textMuted }]}>
//                 {(offer.bids || []).length} chauffeur{(offer.bids || []).length > 1 ? 's' : ''} disponible{(offer.bids || []).length > 1 ? 's' : ''}
//               </Text>
//             )}
//           </View>

//           {/* ── Annuler ── */}
//           <TouchableOpacity
//             style={[s.cancelBtn, { borderColor: Colors.cardBorder }]}
//             onPress={handleCancel}
//             disabled={cancelling}
//           >
//             {cancelling
//               ? <ActivityIndicator size="small" color={Colors.red} />
//               : <Text style={[s.cancelTxt, { color: Colors.red }]}>Annuler ma demande</Text>
//             }
//           </TouchableOpacity>

//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const s = StyleSheet.create({
//   safe:    { flex: 1 },
//   scroll:  { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 12 },
//   centered: {
//     flex: 1, alignItems: 'center', justifyContent: 'center',
//     gap: 12, paddingHorizontal: 32,
//   },

//   // Header
//   header: {
//     flexDirection: 'row', alignItems: 'center',
//     paddingHorizontal: Spacing.md, paddingVertical: 12,
//     borderBottomWidth: 1, gap: 10,
//   },
//   backBtn:     { padding: 4 },
//   logoBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
//   logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 17 },
//   headerTitle: { fontSize: 16, fontWeight: '900' },

//   // États vides
//   emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
//   hint:       { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
//   goSearchBtn: { borderRadius: Radius.xl, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
//   goSearchTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

//   // Résumé offre
//   offerSummary: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
//   summaryTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
//   stateBadge:   { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
//   stateBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
//   timeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
//   timeTxt:      { fontSize: 12, fontWeight: '700' },
//   priceRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
//   priceMain:    { fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
//   priceCurrency: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
//   routeBlock:   { borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
//   routeRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
//   routeLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
//   routePlace:   { fontSize: 14, fontWeight: '700', marginTop: 1 },
//   dotFilled:    { width: 10, height: 10, borderRadius: 5, marginTop: 13, flexShrink: 0 },
//   dotOutline:   { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 13, flexShrink: 0 },
//   routeVLine:   { width: 2, height: 14, marginLeft: 4, marginVertical: 2 },

//   // Bids
//   bidsSection:  { gap: 10 },
//   bidsCount:    { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },
//   waitingBlock: {
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
//   },
//   waitingTitle: { fontWeight: '900', fontSize: 14 },
//   waitingSub:   { fontWeight: '600', fontSize: 12, marginTop: 2 },
//   selectedBlock: {
//     flexDirection: 'row', alignItems: 'center', gap: 12,
//     borderRadius: Radius.lg, padding: Spacing.md,
//   },

//   // Annuler
//   cancelBtn: {
//     borderRadius: Radius.xl, borderWidth: 1,
//     paddingVertical: 14, alignItems: 'center', marginTop: 8,
//   },
//   cancelTxt: { fontWeight: '700', fontSize: 13 },
// });