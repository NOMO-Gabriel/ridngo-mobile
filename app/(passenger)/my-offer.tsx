/**
 * app/(passenger)/my-offer.tsx
 *
 * Page dédiée à l'offre en cours du passager.
 * Affiche la liste des chauffeurs ayant postulé (bids),
 * permet au passager de choisir un chauffeur, puis attend
 * la confirmation du chauffeur choisi.
 *
 * Routes :
 *   GET  /api/v1/offers/{id}/bids          → polling des candidatures
 *   PATCH /api/v1/offers/{id}/select-driver → sélection du chauffeur
 *   GET  /api/v1/users/drivers/{driverId}   → profil enrichi du chauffeur
 *   POST /api/v1/offers/{id}/cancel         → annulation de l'offre
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { rideService } from '../../src/services/rideService';
import { Spacing, Radius } from '../../src/types/theme';
import { OfferResponse, Bid } from '../../src/types/api';
import api from '../../src/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type PageState = 'loading' | 'no_offer' | 'waiting_bids' | 'has_bids' | 'driver_selected' | 'validated' | 'cancelled';

interface DriverProfile {
  id: string;
  name: string;
  rating: number;
  totalTrips: number;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  isValidated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso?: string) {
  if (!iso) return '--:--';
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function stateLabel(state?: string): { label: string; color: string } {
  switch (state) {
    case 'PENDING':          return { label: 'EN ATTENTE',        color: '#FF8C00' };
    case 'BID_RECEIVED':     return { label: 'CANDIDATURES REÇUES', color: '#3B82F6' };
    case 'DRIVER_SELECTED':  return { label: 'CHAUFFEUR SÉLECTIONNÉ', color: '#22C55E' };
    case 'VALIDATED':        return { label: 'CONFIRMÉE',          color: '#22C55E' };
    case 'CANCELLED':        return { label: 'ANNULÉE',            color: '#EF4444' };
    default:                 return { label: state || 'INCONNU',   color: '#9CA3AF' };
  }
}

// ─── Composant card chauffeur ─────────────────────────────────────────────────
interface DriverCardProps {
  bid: Bid;
  profile: DriverProfile | null;
  isSelected: boolean;
  isSelecting: boolean;
  onSelect: () => void;
  Colors: any;
}

function DriverCard({ bid, profile, isSelected, isSelecting, onSelect, Colors }: DriverCardProps) {
  const name    = profile?.name    || bid.driverName || `Chauffeur #${bid.driverId.slice(-4)}`;
  const rating  = profile?.rating  ?? bid.rating  ?? 0;
  const trips   = profile?.totalTrips ?? bid.totalTrips ?? 0;
  const make    = profile?.vehicleMake    || bid.brand  || '';
  const model   = profile?.vehicleModel   || bid.model  || '';
  const plate   = profile?.licensePlate   || bid.licensePlate || '';
  const initial = name[0]?.toUpperCase() || 'C';

  return (
    <View style={[card.wrap, { backgroundColor: Colors.card, borderColor: isSelected ? Colors.orange : Colors.cardBorder }]}>
      {/* En-tête : avatar + infos */}
      <View style={card.top}>
        <View style={[card.avatar, { backgroundColor: Colors.orange }]}>
          <Text style={card.avatarTxt}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[card.name, { color: Colors.text }]} numberOfLines={1}>{name}</Text>
          {/* Note + courses */}
          <View style={card.metaRow}>
            {rating > 0 && (
              <View style={card.metaItem}>
                <Ionicons name="star" size={12} color={Colors.orange} />
                <Text style={[card.metaTxt, { color: Colors.textMuted }]}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {trips > 0 && (
              <View style={card.metaItem}>
                <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
                <Text style={[card.metaTxt, { color: Colors.textMuted }]}>{trips} course{trips > 1 ? 's' : ''}</Text>
              </View>
            )}
            {profile?.isValidated && (
              <View style={[card.verifiedChip, { backgroundColor: Colors.greenBg }]}>
                <Ionicons name="shield-checkmark-outline" size={11} color={Colors.green} />
                <Text style={[card.verifiedTxt, { color: Colors.green }]}>VÉRIFIÉ</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Véhicule */}
      {(make || plate) ? (
        <View style={[card.vehicleRow, { backgroundColor: Colors.input }]}>
          <Ionicons name="car-outline" size={14} color={Colors.textMuted} />
          <Text style={[card.vehicleTxt, { color: Colors.textMuted }]} numberOfLines={1}>
            {[make, model].filter(Boolean).join(' ')}{plate ? `  ·  ${plate}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Bouton */}
      {isSelected ? (
        <View style={[card.selectedBanner, { backgroundColor: Colors.greenBg }]}>
          <ActivityIndicator size="small" color={Colors.green} />
          <Text style={[card.selectedTxt, { color: Colors.green }]}>
            En attente de confirmation...
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[card.chooseBtn, { backgroundColor: Colors.text }]}
          onPress={onSelect}
          disabled={isSelecting}
          activeOpacity={0.85}
        >
          {isSelecting
            ? <ActivityIndicator color={Colors.background} size="small" />
            : <Text style={[card.chooseBtnTxt, { color: Colors.background }]}>
                CHOISIR CE CHAUFFEUR
              </Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  wrap:        { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  top:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { color: '#fff', fontWeight: '900', fontSize: 20 },
  name:        { fontSize: 15, fontWeight: '900' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt:     { fontSize: 11, fontWeight: '600' },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  vehicleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10 },
  vehicleTxt:  { fontSize: 12, fontWeight: '600', flex: 1 },
  selectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 12 },
  selectedTxt:    { fontWeight: '700', fontSize: 13 },
  chooseBtn:   { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  chooseBtnTxt: { fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
});

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MyOfferScreen() {
  const { user } = useAuth();
  const { Colors } = useTheme();

  const [pageState, setPageState]           = useState<PageState>('loading');
  const [offer, setOffer]                   = useState<OfferResponse | null>(null);
  const [driverProfiles, setDriverProfiles] = useState<Record<string, DriverProfile>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectingId, setSelectingId]       = useState<string | null>(null);
  const [cancelling, setCancelling]         = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerId    = useRef<string | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────────
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
      startPolling(stored);
    } catch {
      setPageState('no_offer');
    }
  };

  // ── Rafraîchir l'offre et ses bids ───────────────────────────────────────
  const refreshOffer = async (id: string) => {
    try {
      const data = await rideService.getOfferBids(id);
      setOffer(data);

      const state = data.state as string;

      if (state === 'CANCELLED') {
        setPageState('cancelled');
        if (pollRef.current) clearInterval(pollRef.current);
        await SecureStore.deleteItemAsync('currentOfferId');
        return;
      }

      if (state === 'VALIDATED') {
        setPageState('validated');
        if (pollRef.current) clearInterval(pollRef.current);
        // Naviguer vers la course active
        try {
          const ride = await rideService.getRideByOffer(id);
          await SecureStore.setItemAsync('activeRideId', ride.id);
        } catch { /* silent */ }
        return;
      }

      if (state === 'DRIVER_SELECTED') {
        setPageState('driver_selected');
        setSelectedDriverId(data.selectedDriverId || null);
      } else if ((data.bids?.length || 0) > 0) {
        setPageState('has_bids');
        loadDriverProfiles(data.bids || []);
      } else {
        setPageState('waiting_bids');
      }
    } catch (e) {
      console.error('[MyOffer] refreshOffer error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Charger les profils chauffeurs ────────────────────────────────────────
  const loadDriverProfiles = useCallback(async (bids: Bid[]) => {
    const toLoad = bids.filter(b => b.driverId && !driverProfiles[b.driverId]);
    if (!toLoad.length) return;

    const results = await Promise.allSettled(
      toLoad.map(b => api.get(`/api/v1/users/drivers/${b.driverId}`))
    );

    const newProfiles: Record<string, DriverProfile> = {};
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        const d = res.value.data;
        const u = d.user || d;
        const dr = d.driver || {};
        const v = d.vehicle || dr.vehicle || {};
        newProfiles[toLoad[i].driverId] = {
          id:           toLoad[i].driverId,
          name:         `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '',
          rating:       dr.averageRating ?? 0,
          totalTrips:   dr.totalTrips    ?? 0,
          vehicleMake:  v.makeName  || v.vehicleMakeName  || '',
          vehicleModel: v.modelName || v.vehicleModelName || '',
          licensePlate: v.registrationNumber || '',
          isValidated:  dr.isProfileValidated || false,
        };
      }
    });
    setDriverProfiles(prev => ({ ...prev, ...newProfiles }));
  }, [driverProfiles]);

  // ── Polling ───────────────────────────────────────────────────────────────
  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshOffer(id), 3500);
  };

  // ── Sélection d'un chauffeur ──────────────────────────────────────────────
  const handleSelectDriver = async (driverId: string) => {
    if (!offerId.current) return;
    setSelectingId(driverId);
    try {
      await rideService.selectDriver(offerId.current, driverId);
      setSelectedDriverId(driverId);
      setPageState('driver_selected');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Impossible de sélectionner ce chauffeur.';
      Alert.alert('Erreur', msg);
    } finally {
      setSelectingId(null);
    }
  };

  // ── Annulation de l'offre ─────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      'Annuler la demande',
      'Voulez-vous vraiment annuler votre demande de course ?',
      [
        { text: 'Non' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            if (!offerId.current) return;
            setCancelling(true);
            try {
              await rideService.cancelOffer(offerId.current);
              await SecureStore.deleteItemAsync('currentOfferId');
              if (pollRef.current) clearInterval(pollRef.current);
              setPageState('cancelled');
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || "Impossible d'annuler l'offre.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (offerId.current) refreshOffer(offerId.current);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
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
        <View style={{ flex: 1 }} />
        <ThemeToggle />
      </View>

      {/* ── Loading ── */}
      {pageState === 'loading' && (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={[s.hint, { color: Colors.textMuted }]}>Chargement de votre offre...</Text>
        </View>
      )}

      {/* ── Aucune offre ── */}
      {pageState === 'no_offer' && (
        <View style={s.centered}>
          <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
          <Text style={[s.emptyTitle, { color: Colors.text }]}>Aucune offre en cours</Text>
          <Text style={[s.hint, { color: Colors.textMuted }]}>
            Publiez une offre depuis l'onglet Commander.
          </Text>
          <TouchableOpacity
            style={[s.goSearchBtn, { backgroundColor: Colors.orange }]}
            onPress={() => router.back()}
          >
            <Text style={s.goSearchTxt}>Créer une offre</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Offre annulée ── */}
      {pageState === 'cancelled' && (
        <View style={s.centered}>
          <Ionicons name="close-circle-outline" size={48} color={Colors.red} />
          <Text style={[s.emptyTitle, { color: Colors.text }]}>Offre annulée</Text>
          <Text style={[s.hint, { color: Colors.textMuted }]}>Votre demande a été annulée.</Text>
          <TouchableOpacity
            style={[s.goSearchBtn, { backgroundColor: Colors.orange }]}
            onPress={() => router.back()}
          >
            <Text style={s.goSearchTxt}>Nouvelle recherche</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Offre validée → course démarrée ── */}
      {pageState === 'validated' && (
        <View style={s.centered}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Colors.green} />
          <Text style={[s.emptyTitle, { color: Colors.text }]}>Course confirmée</Text>
          <Text style={[s.hint, { color: Colors.textMuted }]}>
            Le chauffeur est en route.
          </Text>
          <TouchableOpacity
            style={[s.goSearchBtn, { backgroundColor: Colors.green }]}
            onPress={() => router.back()}
          >
            <Text style={s.goSearchTxt}>Voir la course</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Contenu principal (offre active) ── */}
      {(pageState === 'waiting_bids' || pageState === 'has_bids' || pageState === 'driver_selected') && offer && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
          }
        >
          {/* ── Résumé de l'offre ── */}
          <View style={[s.offerSummary, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            {/* Badge état */}
            {(() => {
              const { label, color } = stateLabel(offer.state);
              return (
                <View style={s.summaryTop}>
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

            {/* Prix */}
            <View style={s.priceRow}>
              <Text style={[s.priceMain, { color: Colors.text }]}>{offer.price?.toLocaleString()}</Text>
              <Text style={[s.priceCurrency, { color: Colors.textMuted }]}>FCFA</Text>
            </View>

            {/* Itinéraire */}
            <View style={[s.routeBlock, { backgroundColor: Colors.input }]}>
              <View style={s.routeRow}>
                <View style={[s.dotFilled, { backgroundColor: Colors.orange }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DÉPART</Text>
                  <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
                    {offer.startPoint}
                  </Text>
                </View>
              </View>
              <View style={[s.routeVLine, { backgroundColor: Colors.cardBorder }]} />
              <View style={s.routeRow}>
                <View style={[s.dotOutline, { borderColor: Colors.text }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeLabel, { color: Colors.textMuted }]}>DESTINATION</Text>
                  <Text style={[s.routePlace, { color: Colors.text }]} numberOfLines={2}>
                    {offer.endPoint}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Section bids ── */}
          <View style={s.bidsSection}>

            {/* Waiting */}
            {pageState === 'waiting_bids' && (
              <View style={[s.waitingBlock, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
                <ActivityIndicator color={Colors.orange} size="small" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.waitingTitle, { color: Colors.text }]}>Radar actif</Text>
                  <Text style={[s.waitingSub, { color: Colors.textMuted }]}>
                    Les chauffeurs disponibles vont répondre...
                  </Text>
                </View>
              </View>
            )}

            {/* Chauffeur sélectionné en attente de confirmation */}
            {pageState === 'driver_selected' && (
              <View style={[s.selectedBlock, { backgroundColor: Colors.greenBg }]}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.green} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.waitingTitle, { color: Colors.green }]}>Chauffeur sélectionné</Text>
                  <Text style={[s.waitingSub, { color: Colors.green }]}>
                    En attente de sa confirmation...
                  </Text>
                </View>
                <ActivityIndicator size="small" color={Colors.green} />
              </View>
            )}

            {/* Liste des bids */}
            {(pageState === 'has_bids' || pageState === 'driver_selected') &&
              (offer.bids || []).map(bid => (
                <DriverCard
                  key={bid.driverId}
                  bid={bid}
                  profile={driverProfiles[bid.driverId] || null}
                  isSelected={selectedDriverId === bid.driverId}
                  isSelecting={selectingId === bid.driverId}
                  onSelect={() => handleSelectDriver(bid.driverId)}
                  Colors={Colors}
                />
              ))
            }

            {/* Nombre de candidatures */}
            {pageState === 'has_bids' && (
              <Text style={[s.bidsCount, { color: Colors.textMuted }]}>
                {(offer.bids || []).length} chauffeur{(offer.bids || []).length > 1 ? 's' : ''} disponible{(offer.bids || []).length > 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {/* ── Annuler ── */}
          <TouchableOpacity
            style={[s.cancelBtn, { borderColor: Colors.cardBorder }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator size="small" color={Colors.red} />
              : <Text style={[s.cancelTxt, { color: Colors.red }]}>Annuler ma demande</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 12 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn:     { padding: 4 },
  logoBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 17 },
  headerTitle: { fontSize: 16, fontWeight: '900' },

  // États vides
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  hint:       { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  goSearchBtn: { borderRadius: Radius.xl, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  goSearchTxt: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // Résumé offre
  offerSummary: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 10 },
  summaryTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateBadge:   { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  stateBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  timeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeTxt:      { fontSize: 12, fontWeight: '700' },
  priceRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  priceMain:    { fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
  priceCurrency: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  routeBlock:   { borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  routeRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  routePlace:   { fontSize: 14, fontWeight: '700', marginTop: 1 },
  dotFilled:    { width: 10, height: 10, borderRadius: 5, marginTop: 13, flexShrink: 0 },
  dotOutline:   { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 13, flexShrink: 0 },
  routeVLine:   { width: 2, height: 14, marginLeft: 4, marginVertical: 2 },

  // Bids
  bidsSection:  { gap: 10 },
  bidsCount:    { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  waitingBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
  },
  waitingTitle: { fontWeight: '900', fontSize: 14 },
  waitingSub:   { fontWeight: '600', fontSize: 12, marginTop: 2 },
  selectedBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Radius.lg, padding: Spacing.md,
  },

  // Annuler
  cancelBtn: {
    borderRadius: Radius.xl, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  cancelTxt: { fontWeight: '700', fontSize: 13 },
});