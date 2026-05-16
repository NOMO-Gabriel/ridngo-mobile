import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { rideService } from '../../src/services/rideService';
import { driverService } from '../../src/services/userService';
import { Spacing, Radius } from '../../src/types/theme';
import { OfferResponse } from '../../src/types/api';
import * as ExpoLocation from 'expo-location';
import api from '../../src/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Données fake pour le graphique revenus ───────────────────────────────────
const FAKE_REVENUE = [
  { label: 'Lun', value: 350 },
  { label: 'Mar', value: 800 },
  { label: 'Mer', value: 450 },
  { label: 'Jeu', value: 1250 },
  { label: 'Ven', value: 900 },
  { label: 'Sam', value: 1400 },
  { label: 'Dim', value: 600 },
];
const MAX_REV = Math.max(...FAKE_REVENUE.map(d => d.value));

// ─── Mini graphique barres (inline, pas de lib) ───────────────────────────────
function RevenueChart({ Colors }: { Colors: any }) {
  const [selected, setSelected] = useState<number | null>(5); // Sam par défaut

  return (
    <View style={chartStyles.wrap}>
      {FAKE_REVENUE.map((d, i) => {
        const pct = d.value / MAX_REV;
        const isSelected = selected === i;
        return (
          <TouchableOpacity
            key={i}
            style={chartStyles.col}
            onPress={() => setSelected(isSelected ? null : i)}
            activeOpacity={0.7}
          >
            {/* Tooltip */}
            {isSelected && (
              <View style={[chartStyles.tooltip, { backgroundColor: Colors.card }]}>
                <Text style={[chartStyles.tooltipDate, { color: Colors.orange }]}>
                  {d.label}
                </Text>
                <Text style={[chartStyles.tooltipVal, { color: Colors.text }]}>
                  {d.value.toLocaleString()} FCFA
                </Text>
              </View>
            )}
            {/* Barre */}
            <View style={[chartStyles.barBg, { backgroundColor: Colors.input }]}>
              <View
                style={[
                  chartStyles.barFill,
                  {
                    height: `${pct * 100}%` as any,
                    backgroundColor: isSelected ? Colors.orange : Colors.orangeBg,
                  },
                ]}
              />
              {isSelected && (
                <View style={[chartStyles.barDot, { backgroundColor: Colors.orange }]} />
              )}
            </View>
            <Text style={[chartStyles.barLabel, { color: Colors.textMuted }]}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const { Colors } = useTheme();

  const [profile, setProfile]       = useState<any>(null);
  const [vehicle, setVehicle]       = useState<any>(null);
  const [balance, setBalance]       = useState<number>(0);
  const [offers, setOffers]         = useState<OfferResponse[]>([]);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline]     = useState(false);
  const [toggling, setToggling]     = useState(false);
  const [sortBy, setSortBy]         = useState<'recent' | 'price_desc' | 'price_asc'>('recent');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (geoRef.current)  clearInterval(geoRef.current);
    };
  }, []);

  // ── Polling offres quand online ───────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (geoRef.current)  clearInterval(geoRef.current);
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
      const [profileRes, walletRes, vehicleRes] = await Promise.allSettled([
        driverService.getDriverProfile(),
        rideService.getMyWallet(),
        api.get('/api/v1/vehicles/me'),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value);
        setIsOnline(profileRes.value?.driver?.isOnline || false);
      }
      if (walletRes.status === 'fulfilled') {
        setBalance(walletRes.value?.balance ?? 0);
      }
      if (vehicleRes.status === 'fulfilled') {
        setVehicle(vehicleRes.value?.data);
      }

      // Course active ?
      try {
        const ride = await rideService.getCurrentPassengerRide();
        if (ride) setCurrentRide(ride);
      } catch { /* optional */ }

    } catch (e) {
      console.error('[Dashboard] loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  ////////
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    // Si l'API renvoie déjà "14:46" ou "14:46:00", on garde juste "HH:mm"
    if (/^\d{2}:\d{2}/.test(timeStr)) return timeStr.substring(0, 5);
    
    // Sinon on essaie de parser la date
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr; // Fallback si la date est illisible
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };


  const fetchOffers = async () => {
    try {
      const data = await rideService.getAvailableOffers(0, 100);
      const unique = Array.from(
        new Map(data.map((o: OfferResponse) => [o.id, o])).values()
      ) as OfferResponse[];
      setOffers(unique);
    } catch { /* silent */ }
  };

  const startGPS = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    geoRef.current = setInterval(async () => {
      try {
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        rideService.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      } catch { /* silent */ }
    }, 3000);
  };

  // ── Toggle GO / STOP ──────────────────────────────────────────────────────
  const toggleOnline = async () => {
    setToggling(true);
    try {
      const next = !isOnline;
      await driverService.toggleOnlineStatus(next);
      setIsOnline(next);
    } catch {
      Alert.alert('Erreur', 'Impossible de changer de statut. Vérifiez votre connexion.');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const sortedOffers = useMemo(() => {
    const list = [...offers];
    if (sortBy === 'price_desc') return list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortBy === 'price_asc')  return list.sort((a, b) => (a.price || 0) - (b.price || 0));
    return list.sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [offers, sortBy]);

  // ── Données dérivées ──────────────────────────────────────────────────────
  const driverFirstName = profile?.user?.firstName || user?.name?.split(' ')[0] || 'Chauffeur';
  const driverFullName  = profile?.user
    ? `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim()
    : user?.name || 'Chauffeur';
  const driverInitial   = driverFullName[0]?.toUpperCase() || 'C';
  const isValidated     = profile?.driver?.isProfileValidated || false;
  const totalReviews    = profile?.driver?.totalReviewsCount ?? 0;
  const rating          = profile?.driver?.averageRating ?? 5.0;

  const vehicleMake  = vehicle?.makeName  || vehicle?.vehicleMakeName  || '';
  const vehicleModel = vehicle?.modelName || vehicle?.vehicleModelName || '';
  const vehiclePlate = vehicle?.registrationNumber || '';
  const vehicleFuel  = vehicle?.fuelTypeName  || '';
  const vehicleSeats = vehicle?.totalSeatNumber;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={s.centered}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={[s.loadingText, { color: Colors.textMuted }]}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* ── Header fixe ── */}
      <View style={[s.header, { backgroundColor: Colors.background, borderBottomColor: Colors.cardBorder }]}>
        <View style={s.headerLeft}>
          <View style={[s.logoBox, { backgroundColor: Colors.orange }]}>
            <Text style={s.logoLetter}>R</Text>
          </View>
          <View>
            <Text style={[s.headerName, { color: Colors.text }]}>{driverFullName}</Text>
            <Text style={[s.headerRole, { color: Colors.textMuted }]}>CHAUFFEUR</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <ThemeToggle />
          <TouchableOpacity
            onPress={() => router.push('/(driver)/notifications' as any)}
            style={[s.iconBtn, { backgroundColor: Colors.input }]}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.avatarBtn, { backgroundColor: Colors.orange }]}
            onPress={() => router.push('/(driver)/profile' as any)}
          >
            <Text style={s.avatarText}>{driverInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.orange}
          />
        }
      >
        {/* ── Bandeau course active ── */}
        {currentRide && (
          <TouchableOpacity
            style={[s.activeBanner, { backgroundColor: Colors.green }]}
            onPress={() => router.push(`/(driver)/ride/${currentRide.id}` as any)}
            activeOpacity={0.85}
          >
            <View style={s.activeBannerLeft}>
              <View style={s.activeDot} />
              <Text style={s.activeBannerText}>Course en cours</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ═══════════════════════════════════════════
            CARTE IDENTITÉ + BOUTON GO/STOP
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          {/* Avatar + infos + badge online */}
          <View style={s.identityRow}>
            <View style={[s.bigAvatar, { backgroundColor: Colors.orange }]}>
              <Text style={s.bigAvatarText}>{driverInitial}</Text>
              {/* Point vert online */}
              <View style={[
                s.onlineDotBadge,
                { backgroundColor: isOnline ? Colors.green : Colors.textMuted }
              ]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.identityName, { color: Colors.text }]} numberOfLines={1}>
                {driverFullName.toLowerCase()}
              </Text>
              <Text style={[s.identityRole, { color: Colors.textMuted }]}>
                {isValidated ? 'VÉRIFIÉ' : 'EN ATTENTE DE VALIDATION'}
              </Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={13} color={Colors.orange} />
                <Text style={[s.ratingVal, { color: Colors.text }]}>{rating.toFixed(1)}</Text>
                <Text style={[s.ratingCount, { color: Colors.textMuted }]}>
                  {totalReviews} avis
                </Text>
              </View>
            </View>
          </View>

          {/* Bouton GO / STOP */}
          <TouchableOpacity
            style={[
              s.goStopBtn,
              isOnline
                ? { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1 }
                : { backgroundColor: Colors.text },
            ]}
            onPress={toggleOnline}
            disabled={toggling}
            activeOpacity={0.85}
          >
            {toggling ? (
              <ActivityIndicator color={isOnline ? Colors.text : Colors.background} size="small" />
            ) : (
              <>
                <Ionicons
                  name={isOnline ? 'shield-outline' : 'power'}
                  size={18}
                  color={isOnline ? Colors.text : Colors.background}
                />
                <Text style={[
                  s.goStopText,
                  { color: isOnline ? Colors.text : Colors.background },
                ]}>
                  {isOnline ? 'STOP' : 'GO'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════
            WALLET (SOLDE)
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.walletHeader}>
            <View style={[s.walletIconBox, { backgroundColor: Colors.orangeBg }]}>
              <Ionicons name="wallet-outline" size={20} color={Colors.orange} />
            </View>
            <Text style={[s.walletTag, { color: Colors.textMuted }]}>Premium</Text>
          </View>
          <Text style={[s.walletLabel, { color: Colors.textMuted }]}>SOLDE</Text>
          <Text style={[s.walletBalance, { color: Colors.text }]}>
            {balance.toLocaleString()}
            <Text style={[s.walletCurrency, { color: Colors.textMuted }]}> FCFA</Text>
          </Text>
          <TouchableOpacity
            style={[s.walletHistoryBtn, { borderColor: Colors.cardBorder }]}
            onPress={() => router.push('/(driver)/history' as any)}
          >
            <Text style={[s.walletHistoryText, { color: Colors.orange }]}>VOIR L'HISTORIQUE</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.orange} />
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════
            REVENUS (graphique fake)
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.sectionHeader}>
            <View>
              <View style={s.sectionTitleRow}>
                <Ionicons name="trending-up-outline" size={18} color={Colors.orange} />
                <Text style={[s.sectionTitle, { color: Colors.text }]}>Revenus</Text>
              </View>
              <Text style={[s.sectionSub, { color: Colors.textMuted }]}>
                BASÉ SUR VOS COURSES TERMINÉES
              </Text>
            </View>
            <View style={[s.periodBadge, { backgroundColor: Colors.orangeBg }]}>
              <Text style={[s.periodText, { color: Colors.orange }]}>7 DERNIERS{'\n'}JOURS</Text>
            </View>
          </View>
          <RevenueChart Colors={Colors} />
        </View>

        {/* ═══════════════════════════════════════════
            MON VÉHICULE
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.sectionHeader}>
            <View style={[s.vehicleIconBox, { backgroundColor: Colors.orangeBg }]}>
              <Ionicons name="car-outline" size={22} color={Colors.orange} />
            </View>
            {isValidated && (
              <View style={[s.verifiedBadge, { backgroundColor: Colors.greenBg }]}>
                <Ionicons name="shield-checkmark-outline" size={13} color={Colors.green} />
                <Text style={[s.verifiedText, { color: Colors.green }]}>VÉRIFIÉ</Text>
              </View>
            )}
          </View>

          <Text style={[s.vehicleName, { color: Colors.text }]}>
            {vehicle ? 'Mon Véhicule' : 'Aucun véhicule enregistré'}
          </Text>
          <Text style={[s.vehicleMake, { color: Colors.textMuted }]}>
            {vehicleMake || (vehicle ? '' : 'Enregistrez votre véhicule pour commencer')}
          </Text>

          {vehicle && (
            <>
              {/* Plaque */}
              <TouchableOpacity
                style={[s.plateRow, { backgroundColor: Colors.input }]}
                activeOpacity={0.7}
              >
                <Ionicons name="speedometer-outline" size={16} color={Colors.textMuted} />
                <Text style={[s.plateTxt, { color: Colors.text }]}>
                  {vehiclePlate || 'Plaque non définie'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 'auto' as any }} />
              </TouchableOpacity>

              {/* Chips carburant / places */}
              <View style={s.chipsRow}>
                {vehicleFuel ? (
                  <View style={[s.chip, { backgroundColor: Colors.input }]}>
                    <Text style={[s.chipText, { color: Colors.textMuted }]}>
                      {vehicleFuel.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {vehicleSeats ? (
                  <View style={[s.chip, { backgroundColor: Colors.input }]}>
                    <Text style={[s.chipText, { color: Colors.textMuted }]}>
                      {vehicleSeats} PLACES
                    </Text>
                  </View>
                ) : null}
                {vehicleModel ? (
                  <View style={[s.chip, { backgroundColor: Colors.input }]}>
                    <Text style={[s.chipText, { color: Colors.textMuted }]}>
                      {vehicleModel.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          )}

          {!vehicle && (
            <TouchableOpacity
              style={[s.addVehicleBtn, { backgroundColor: Colors.orangeBg }]}
              onPress={() => router.push('/(driver)/onboarding' as any)}
            >
              <Text style={[s.addVehicleTxt, { color: Colors.orange }]}>
                Enregistrer un véhicule
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ═══════════════════════════════════════════
            PERFORMANCE
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <View style={s.sectionHeader}>
            <View style={[s.vehicleIconBox, { backgroundColor: Colors.input }]}>
              <Ionicons name="time-outline" size={22} color={Colors.textMuted} />
            </View>
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={14} color={Colors.orange} />
              <Text style={[s.ratingBadgeVal, { color: Colors.orange }]}>
                {rating.toFixed(1)}
              </Text>
            </View>
          </View>
          <Text style={[s.vehicleName, { color: Colors.text }]}>Performance</Text>
          <Text style={[s.sectionSub, { color: Colors.textMuted }]}>ACTIVITÉ SUR LA PLATEFORME</Text>

          <View style={s.perfRow}>
            <View style={[s.perfItem, { backgroundColor: Colors.input }]}>
              <Text style={[s.perfLabel, { color: Colors.textMuted }]}>AVIS REÇUS</Text>
              <Text style={[s.perfVal, { color: Colors.text }]}>{totalReviews}</Text>
            </View>
            <View style={[s.perfItem, { backgroundColor: Colors.orangeBg }]}>
              <Text style={[s.perfLabel, { color: Colors.orange }]}>EXPÉRIENCE</Text>
              <Text style={[s.perfVal, { color: Colors.orange }]}>
                {totalReviews >= 50 ? 'EXPERT' : totalReviews >= 10 ? 'PRO' : 'JUNIOR'}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════
            SCANNING LIVE — OFFRES DISPONIBLES
        ═══════════════════════════════════════════ */}
        <View style={s.radarSection}>

          {/* Header Scanning Live */}
          <View style={[s.scanHeader, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
            <View style={[s.scanIconBox, { backgroundColor: Colors.orange }]}>
              <Ionicons name="options" size={22} color="#fff" />
              {/* Dot animé (live) */}
              {isOnline && (
                <View style={[s.scanLiveDot, { backgroundColor: Colors.green, borderColor: Colors.card }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.scanTitle, { color: Colors.text }]}>SCANNING LIVE</Text>
              <View style={s.scanSubRow}>
                <View style={[s.scanDot, { backgroundColor: isOnline ? Colors.green : Colors.textMuted }]} />
                <Text style={[s.scanSub, { color: isOnline ? Colors.green : Colors.textMuted }]}>
                  {isOnline
                    ? `${sortedOffers.length} DEMANDE${sortedOffers.length !== 1 ? 'S' : ''} À PROXIMITÉ`
                    : 'RADAR INACTIF'}
                </Text>
              </View>
            </View>
          </View>

          {/* Filtres tri */}
          {isOnline && (
            <View style={s.filterRow}>
              {[
                { key: 'recent',     icon: 'calendar-outline', label: 'Plus récents' },
                { key: 'price_desc', icon: 'location-outline', label: 'Prix haut' },
                { key: 'price_asc',  icon: 'funnel-outline',   label: 'Prix bas' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    s.filterChip,
                    { borderColor: Colors.cardBorder, backgroundColor: Colors.input },
                    sortBy === f.key && { backgroundColor: Colors.orangeBg, borderColor: Colors.orange },
                  ]}
                  onPress={() => setSortBy(f.key as any)}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={sortBy === f.key ? Colors.orange : Colors.textMuted}
                  />
                  <Text style={[
                    s.filterChipText,
                    { color: sortBy === f.key ? Colors.orange : Colors.textMuted },
                  ]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Offline */}
          {!isOnline && (
            <TouchableOpacity
              style={[s.seeDemandsBtn, { borderColor: Colors.cardBorder, backgroundColor: Colors.card }]}
              onPress={toggleOnline}
            >
              <Text style={[s.seeDemandsTxt, { color: Colors.text }]}>ACTIVER LE RADAR</Text>
              <Ionicons name="radio-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Empty */}
          {isOnline && sortedOffers.length === 0 && (
            <View style={[s.emptyRadar, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
              <Ionicons name="radio-outline" size={36} color={Colors.textMuted} />
              <Text style={[s.emptyText, { color: Colors.textMuted }]}>
                En attente de nouvelles demandes...
              </Text>
            </View>
          )}

          {/* Cartes offres — design OfferCard fidèle au screenshot */}
          {isOnline && sortedOffers.map(item => (
            <View
              key={item.id}
              style={[s.offerCard, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}
            >
              {/* Ligne client + prix */}
              <View style={s.offerTopRow}>
                <View style={[s.clientAvatar, { backgroundColor: Colors.input }]}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.clientLabel, { color: Colors.textMuted }]}>CLIENT</Text>
                  <Text style={[s.clientName, { color: Colors.text }]}>Anonyme</Text>
                </View>
                <View style={s.offerPriceBlock}>
                  <Text style={[s.offerPriceLabel, { color: Colors.textMuted }]}>OFFRE</Text>
                  <Text style={[s.offerPriceVal, { color: Colors.orange }]}>
                    {item.price?.toLocaleString()} F
                  </Text>
                </View>
              </View>

              {/* Heure de départ */}
              {item.departureTime && (
                <View style={[s.departRow, { backgroundColor: Colors.input }]}>
                  <Ionicons name="time-outline" size={14} color={Colors.orange} />
                  <Text style={[s.departTxt, { color: Colors.text }]}>
                    DÉPART : {formatTime(item.departureTime as string)}
                  </Text>
                </View>
              )}

              {/* Itinéraire */}
              <View style={s.routeBlock}>
                <View style={s.routeRowOffer}>
                  <View style={[s.dotOrange, { backgroundColor: Colors.orange }]} />
                  <View>
                    <Text style={[s.routeSubLabel, { color: Colors.textMuted }]}>DE</Text>
                    <Text style={[s.routeTxt, { color: Colors.text }]} numberOfLines={2}>
                      {item.startPoint}
                    </Text>
                  </View>
                </View>
                <View style={[s.routeVLine, { backgroundColor: Colors.cardBorder, marginLeft: 4 }]} />
                <View style={s.routeRowOffer}>
                  <View style={[s.dotWhite, { borderColor: Colors.text }]} />
                  <View>
                    <Text style={[s.routeSubLabel, { color: Colors.textMuted }]}>À</Text>
                    <Text style={[s.routeTxt, { color: Colors.text }]} numberOfLines={2}>
                      {item.endPoint}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bouton Consulter */}
              <TouchableOpacity
                style={[s.consultBtn, { backgroundColor: Colors.text }]}
                onPress={() => router.push(`/(driver)/offers/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <Text style={[s.consultBtnTxt, { color: Colors.background }]}>
                  CONSULTER L'OFFRE
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>


        {/* ═══════════════════════════════════════════
            MENU — Déconnexion
        ═══════════════════════════════════════════ */}
        <View style={[s.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder, marginTop: 8 }]}>
          <TouchableOpacity style={s.menuItem} onPress={handleLogout}>
            <View style={[s.menuIcon, { backgroundColor: Colors.redBg }]}>
              <Ionicons name="log-out-outline" size={18} color={Colors.red} />
            </View>
            <Text style={[s.menuLabel, { color: Colors.red }]}>Déconnexion</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.red} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontWeight: '700', fontSize: 13 },
  scroll:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter:  { color: '#fff', fontWeight: '900', fontSize: 18 },
  headerName:  { fontWeight: '900', fontSize: 14, letterSpacing: 0.2 },
  headerRole:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // Banner course active
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    marginBottom: 4,
  },
  activeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  activeBannerText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  // Card générique
  card: {
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md, gap: 12,
  },

  // Identité + GO/STOP
  identityRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bigAvatar: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bigAvatarText:  { color: '#fff', fontWeight: '900', fontSize: 26 },
  onlineDotBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#1C1C1C',
  },
  identityName:   { fontWeight: '900', fontSize: 18, letterSpacing: 0.2 },
  identityRole:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingVal:      { fontWeight: '900', fontSize: 13 },
  ratingCount:    { fontSize: 11, fontWeight: '600' },

  goStopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Radius.xl, paddingVertical: 16,
  },
  goStopText: { fontWeight: '900', fontSize: 15, letterSpacing: 2 },

  // Wallet
  walletHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  walletTag:        { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  walletLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  walletBalance:    { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  walletCurrency:   { fontSize: 14, fontWeight: '700' },
  walletHistoryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, borderTopWidth: 1, paddingTop: 10,
  },
  walletHistoryText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Section header générique
  sectionHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:   { fontWeight: '900', fontSize: 18 },
  sectionSub:     { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  periodBadge:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  periodText:     { fontSize: 10, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },

  // Véhicule
  vehicleIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedText:   { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  vehicleName:    { fontSize: 20, fontWeight: '900' },
  vehicleMake:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  plateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: Radius.md, padding: 14,
  },
  plateTxt:       { fontWeight: '700', fontSize: 15, flex: 1 },
  chipsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:       { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  addVehicleBtn:  { borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  addVehicleTxt:  { fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // Perf
  perfRow:  { flexDirection: 'row', gap: 10 },
  perfItem: { flex: 1, borderRadius: Radius.md, padding: 14, gap: 4 },
  perfLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  perfVal:  { fontSize: 22, fontWeight: '900' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingBadgeVal: { fontWeight: '900', fontSize: 16 },

  // Radar & Scanning Live
  radarSection:   { borderTopWidth: 1, paddingTop: Spacing.md, gap: 10 },
  scanHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md,
  },
  scanIconBox: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  scanLiveDot: {
    position: 'absolute', top: -2, right: -2,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  scanTitle:   { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  scanSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  scanDot:     { width: 8, height: 8, borderRadius: 4 },
  scanSub:     { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  filterRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  filterChipText: { fontSize: 11, fontWeight: '700' },

  seeDemandsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: Radius.xl, borderWidth: 1, paddingVertical: 16,
  },
  seeDemandsTxt:  { fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  emptyRadar: {
    borderRadius: Radius.lg, borderWidth: 1, padding: 32,
    alignItems: 'center', gap: 12,
  },
  emptyText:      { fontWeight: '600', fontSize: 13, textAlign: 'center' },

  // ═══════════════════════════════════════════
  // OFFER CARD (Design fidèle au Web)
  // ═══════════════════════════════════════════
  offerCard: {
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 12,
  },
  offerTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  clientLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  clientName:     { fontSize: 14, fontWeight: '900', marginTop: 2 },
  offerPriceBlock: { alignItems: 'flex-end' },
  offerPriceLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  offerPriceVal:  { fontSize: 22, fontWeight: '900' },

  departRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  departTxt: { fontSize: 12, fontWeight: '900' },

  routeBlock:     { gap: 4 },
  routeRowOffer:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeSubLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  routeTxt:       { fontSize: 13, fontWeight: '700', flex: 1 },
  
  // Alignement des points avec le texte
  dotOrange:      { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  dotWhite:       { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 4, flexShrink: 0 },
  routeVLine:     { width: 2, height: 20, marginLeft: 4, marginBottom: 2 },

  consultBtn: {
    borderRadius: Radius.xl, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  consultBtnTxt: { fontWeight: '900', fontSize: 12, letterSpacing: 2 },

  // Menu déconnexion
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontWeight: '700', fontSize: 14 },
});

// ─── Styles du graphique ──────────────────────────────────────────────────────
const BAR_HEIGHT = 100;

const chartStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_HEIGHT + 40,
    gap: 6,
    paddingTop: 40, // espace pour tooltip
  },
  col:  { flex: 1, alignItems: 'center', gap: 4, position: 'relative' },
  barBg: {
    width: '100%', height: BAR_HEIGHT,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barDot: {
    position: 'absolute', top: -6, alignSelf: 'center',
    width: 10, height: 10, borderRadius: 5,
  },
  barLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  tooltip: {
    position: 'absolute', top: -56, left: '50%',
    transform: [{ translateX: -50 }],
    borderRadius: 10, padding: 8, gap: 2, zIndex: 10,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
    minWidth: 100,
  },
  tooltipDate: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  tooltipVal:  { fontSize: 13, fontWeight: '900' },
});







// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import {
//   View, Text, StyleSheet, SafeAreaView, FlatList,
//   TouchableOpacity, ActivityIndicator, RefreshControl, Alert
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { router } from 'expo-router';
// import { useAuth } from '../../src/context/AuthContext';
// import { rideService } from '../../src/services/rideService';
// import { driverService } from '../../src/services/userService';
// import { Colors, Spacing, Radius } from '../../src/types/theme';
// import { OfferResponse } from '../../src/types/api';
// import * as ExpoLocation from 'expo-location';

// export default function DriverDashboard() {
//   const { user, logout } = useAuth();
//   const [profile, setProfile] = useState<any>(null);
//   const [offers, setOffers] = useState<OfferResponse[]>([]);
//   const [currentRide, setCurrentRide] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [isOnline, setIsOnline] = useState(false);
//   const [toggling, setToggling] = useState(false);
//   const [sortBy, setSortBy] = useState<'recent' | 'price_desc' | 'price_asc'>('recent');

//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const geoRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   useEffect(() => {
//     loadData();
//     return () => {
//       if (pollRef.current) clearInterval(pollRef.current);
//       if (geoRef.current) clearInterval(geoRef.current);
//     };
//   }, []);

//   useEffect(() => {
//     if (pollRef.current) clearInterval(pollRef.current);
//     if (geoRef.current) clearInterval(geoRef.current);
//     if (isOnline) {
//       fetchOffers();
//       pollRef.current = setInterval(fetchOffers, 5000);
//       startGPS();
//     } else {
//       setOffers([]);
//     }
//   }, [isOnline]);

//   const loadData = async () => {
//     try {
//       const [profileRes, ride] = await Promise.all([
//         driverService.getDriverProfile(),
//         rideService.getCurrentRide(),
//       ]);
//       setProfile(profileRes);
//       setIsOnline(profileRes?.driver?.isOnline || false);
//       setCurrentRide(ride);
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchOffers = async () => {
//     try {
//       const data = await rideService.getAvailableOffers(0, 100);
//       const unique = Array.from(new Map(data.map((o: OfferResponse) => [o.id, o])).values()) as OfferResponse[];
//       setOffers(unique);
//     } catch { /* silent */ }
//   };

//   const startGPS = async () => {
//     const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
//     if (status !== 'granted') return;
//     geoRef.current = setInterval(async () => {
//       const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
//       rideService.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
//     }, 3000);
//   };

//   const toggleOnline = async () => {
//     setToggling(true);
//     try {
//       const next = !isOnline;
//       await driverService.toggleOnlineStatus(next);
//       setIsOnline(next);
//     } catch {
//       Alert.alert('Erreur', 'Impossible de changer de statut.');
//     } finally {
//       setToggling(false);
//     }
//   };

//   const sortedOffers = useMemo(() => {
//     const list = [...offers];
//     if (sortBy === 'price_desc') return list.sort((a, b) => (b.price || 0) - (a.price || 0));
//     if (sortBy === 'price_asc') return list.sort((a, b) => (a.price || 0) - (b.price || 0));
//     return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
//   }, [offers, sortBy]);

//   if (loading) return (
//     <SafeAreaView style={styles.safe}>
//       <View style={styles.centered}>
//         <ActivityIndicator color={Colors.orange} size="large" />
//         <Text style={styles.loadingText}>Chargement du radar...</Text>
//       </View>
//     </SafeAreaView>
//   );

//   const driverName = profile?.user?.firstName || user?.name?.split(' ')[0] || 'Chauffeur';
//   const balance = profile?.wallet?.balance ?? 0;
//   const vehicle = profile?.vehicle;

//   return (
//     <SafeAreaView style={styles.safe}>
//       <FlatList
//         data={sortedOffers}
//         keyExtractor={item => item.id}
//         contentContainerStyle={styles.list}
//         refreshControl={
//           <RefreshControl refreshing={false} onRefresh={loadData} tintColor={Colors.orange} />
//         }
//         ListHeaderComponent={() => (
//           <View style={styles.header}>
//             {/* Top bar */}
//             <View style={styles.topBar}>
//               <View style={styles.logoRow}>
//                 <View style={styles.logoBox}><Text style={styles.logoLetter}>R</Text></View>
//                 <View>
//                   <Text style={styles.logoText}>RidnGo</Text>
//                   <Text style={styles.driverTag}>CHAUFFEUR</Text>
//                 </View>
//               </View>
//               <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
//                 <Ionicons name="log-out-outline" size={22} color={Colors.textMuted} />
//               </TouchableOpacity>
//             </View>

//             {/* Active ride banner */}
//             {currentRide && (
//               <TouchableOpacity
//                 style={styles.activeBanner}
//                 onPress={() => router.push(`/(driver)/ride/${currentRide.id}`)}
//               >
//                 <View style={styles.activeBannerLeft}>
//                   <View style={styles.navPulse}>
//                     <Ionicons name="navigate" size={20} color={Colors.white} />
//                   </View>
//                   <View>
//                     <Text style={styles.activeBannerTag}>COURSE ACTIVE</Text>
//                     <Text style={styles.activeBannerText}>
//                       {currentRide.state === 'CREATED' ? 'Client en attente' : 'Trajet en cours'}
//                     </Text>
//                   </View>
//                 </View>
//                 <Ionicons name="chevron-forward" size={20} color={Colors.white} />
//               </TouchableOpacity>
//             )}

//             {/* Identity + Wallet cards */}
//             <View style={styles.cardsRow}>
//               {/* Identity card */}
//               <View style={[styles.card, { flex: 2 }]}>
//                 <View style={styles.avatarRow}>
//                   <View style={styles.avatar}>
//                     <Text style={styles.avatarText}>{driverName[0]}</Text>
//                   </View>
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
//                     {vehicle && (
//                       <Text style={styles.vehicleInfo} numberOfLines={1}>
//                         {vehicle.makeName || vehicle.vehicleMakeName} {vehicle.modelName || vehicle.vehicleModelName}
//                       </Text>
//                     )}
//                   </View>
//                 </View>

//                 {/* Online toggle */}
//                 <TouchableOpacity
//                   style={[styles.toggleBtn, isOnline && styles.toggleBtnOnline]}
//                   onPress={toggleOnline}
//                   disabled={toggling}
//                 >
//                   {toggling
//                     ? <ActivityIndicator size="small" color={isOnline ? Colors.dark : Colors.white} />
//                     : <>
//                       <View style={[styles.toggleDot, isOnline && styles.toggleDotOnline]} />
//                       <Text style={[styles.toggleText, isOnline && styles.toggleTextOnline]}>
//                         {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
//                       </Text>
//                     </>
//                   }
//                 </TouchableOpacity>
//               </View>

//               {/* Wallet card */}
//               <View style={[styles.card, { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 }]}>
//                 <View style={styles.walletIcon}>
//                   <Ionicons name="wallet" size={20} color={Colors.orange} />
//                 </View>
//                 <Text style={styles.walletBalance}>{balance.toLocaleString()}</Text>
//                 <Text style={styles.walletCurrency}>FCFA</Text>
//               </View>
//             </View>

//             {/* Radar header + sort */}
//             <View style={styles.radarHeader}>
//               <View>
//                 <Text style={styles.radarTitle}>
//                   {isOnline ? `${sortedOffers.length} demandes` : 'Radar désactivé'}
//                 </Text>
//                 <Text style={styles.radarSub}>
//                   {isOnline ? 'Passez en ligne pour voir les offres' : 'Activez le radar pour voir les courses'}
//                 </Text>
//               </View>
//               {isOnline && (
//                 <TouchableOpacity
//                   style={styles.sortBtn}
//                   onPress={() => {
//                     if (sortBy === 'recent') setSortBy('price_desc');
//                     else if (sortBy === 'price_desc') setSortBy('price_asc');
//                     else setSortBy('recent');
//                   }}
//                 >
//                   <Ionicons name="funnel" size={14} color={Colors.orange} />
//                   <Text style={styles.sortText}>
//                     {sortBy === 'recent' ? 'Récent' : sortBy === 'price_desc' ? 'Prix ↓' : 'Prix ↑'}
//                   </Text>
//                 </TouchableOpacity>
//               )}
//             </View>
//           </View>
//         )}
//         ListEmptyComponent={
//           isOnline ? (
//             <View style={styles.emptyRadar}>
//               <Ionicons name="radio" size={48} color={Colors.textMuted} />
//               <Text style={styles.emptyText}>Radar actif — en attente de courses</Text>
//             </View>
//           ) : (
//             <View style={styles.emptyRadar}>
//               <Ionicons name="radio-button-off" size={48} color={Colors.textMuted} />
//               <Text style={styles.emptyText}>Activez le radar pour recevoir des courses</Text>
//             </View>
//           )
//         }
//         renderItem={({ item }: { item: OfferResponse }) => (
//           <TouchableOpacity
//             style={styles.offerCard}
//             onPress={() => router.push(`/(driver)/offers/${item.id}`)}
//             activeOpacity={0.8}
//           >
//             <View style={styles.offerTop}>
//               <View style={styles.offerRoute}>
//                 <View style={styles.routeRow}>
//                   <View style={styles.dotOrange} />
//                   <Text style={styles.routeText} numberOfLines={1}>{item.startPoint}</Text>
//                 </View>
//                 <View style={styles.routeLine} />
//                 <View style={styles.routeRow}>
//                   <View style={styles.dotWhite} />
//                   <Text style={styles.routeText} numberOfLines={1}>{item.endPoint}</Text>
//                 </View>
//               </View>
//               <View style={styles.offerPriceBox}>
//                 <Text style={styles.offerPrice}>{item.price?.toLocaleString()}</Text>
//                 <Text style={styles.offerPriceCurrency}>FCFA</Text>
//               </View>
//             </View>
//             <View style={styles.offerFooter}>
//               {item.distance && (
//                 <View style={styles.offerMeta}>
//                   <Ionicons name="navigate" size={12} color={Colors.textMuted} />
//                   <Text style={styles.offerMetaText}>{item.distance.toFixed(1)} km</Text>
//                 </View>
//               )}
//               {item.createdAt && (
//                 <Text style={styles.offerTime}>
//                   {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
//                 </Text>
//               )}
//               <View style={styles.applyBtn}>
//                 <Text style={styles.applyText}>Voir</Text>
//                 <Ionicons name="chevron-forward" size={14} color={Colors.orange} />
//               </View>
//             </View>
//           </TouchableOpacity>
//         )}
//       />
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: Colors.dark },
//   centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
//   loadingText: { color: Colors.textMuted, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
//   list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
//   header: { gap: Spacing.md, marginBottom: Spacing.sm },
//   topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
//   logoBox: { width: 38, height: 38, backgroundColor: Colors.orange, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
//   logoLetter: { color: Colors.white, fontWeight: '900', fontSize: 18, fontStyle: 'italic' },
//   logoText: { color: Colors.white, fontWeight: '900', fontSize: 18 },
//   driverTag: { color: Colors.orange, fontWeight: '900', fontSize: 9, letterSpacing: 2 },
//   logoutBtn: { padding: 6 },

//   activeBanner: {
//     backgroundColor: Colors.orange, borderRadius: Radius.lg, padding: Spacing.md,
//     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
//     shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, elevation: 6,
//   },
//   activeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   navPulse: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
//   activeBannerTag: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 9, letterSpacing: 2 },
//   activeBannerText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

//   cardsRow: { flexDirection: 'row', gap: Spacing.sm },
//   card: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
//   avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
//   avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
//   avatarText: { color: Colors.white, fontWeight: '900', fontSize: 18 },
//   driverName: { color: Colors.white, fontWeight: '900', fontSize: 14 },
//   vehicleInfo: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

//   toggleBtn: {
//     flexDirection: 'row', alignItems: 'center', gap: 8,
//     backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.full,
//     paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
//   },
//   toggleBtnOnline: { backgroundColor: Colors.greenBg },
//   toggleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
//   toggleDotOnline: { backgroundColor: Colors.green },
//   toggleText: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
//   toggleTextOnline: { color: Colors.green },

//   walletIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.orangeBg, alignItems: 'center', justifyContent: 'center' },
//   walletBalance: { color: Colors.white, fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
//   walletCurrency: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 2 },

//   radarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
//   radarTitle: { color: Colors.white, fontWeight: '900', fontSize: 18 },
//   radarSub: { color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
//   sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.orangeBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full },
//   sortText: { color: Colors.orange, fontWeight: '900', fontSize: 11 },

//   emptyRadar: { alignItems: 'center', gap: 12, paddingVertical: 60 },
//   emptyText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13, textAlign: 'center' },

//   offerCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12 },
//   offerTop: { flexDirection: 'row', gap: 12 },
//   offerRoute: { flex: 1, gap: 4 },
//   routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
//   routeLine: { width: 2, height: 10, backgroundColor: Colors.cardBorder, marginLeft: 3 },
//   dotOrange: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.orange },
//   dotWhite: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
//   routeText: { flex: 1, color: Colors.white, fontWeight: '600', fontSize: 13 },
//   offerPriceBox: { alignItems: 'flex-end', justifyContent: 'center' },
//   offerPrice: { color: Colors.orange, fontWeight: '900', fontSize: 20, fontStyle: 'italic' },
//   offerPriceCurrency: { color: Colors.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 1 },
//   offerFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
//   offerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
//   offerMetaText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
//   offerTime: { flex: 1, color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
//   applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
//   applyText: { color: Colors.orange, fontWeight: '900', fontSize: 12 },
// });
