import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rideService } from '../../src/services/rideService';
import { Colors, Spacing, Radius } from '../../src/types/theme';
import { RideResponse } from '../../src/types/api';

export default function HistoryScreen() {
  const [rides, setRides] = useState<RideResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await rideService.getMyHistory(0, 20);
      setRides(Array.isArray(data) ? data : []);
    } catch { setRides([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  const RideCard = ({ item }: { item: RideResponse }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={Colors.white} />
        </View>
        <View style={styles.cardTopInfo}>
          <Text style={styles.cardDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date inconnue'}
          </Text>
          <View style={[styles.stateBadge, item.state === 'COMPLETED' ? styles.badgeGreen : styles.badgeRed]}>
            <Text style={[styles.stateText, item.state === 'COMPLETED' ? styles.textGreen : styles.textRed]}>
              {item.state}
            </Text>
          </View>
        </View>
        <Text style={styles.price}>{item.price} F</Text>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={styles.dotOrange} />
          <Text style={styles.routeText} numberOfLines={1}>{item.startPoint || '—'}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={styles.dotWhite} />
          <Text style={styles.routeText} numberOfLines={1}>{item.endPoint || '—'}</Text>
        </View>
      </View>

      {item.distance != null && (
        <View style={styles.footer}>
          <Ionicons name="car" size={13} color={Colors.orange} />
          <Text style={styles.footerText}>{item.distance.toFixed(1)} km</Text>
        </View>
      )}
    </View>
  );

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Mes Voyages</Text>
        <Text style={styles.pageTag}>HISTORIQUE COMPLET</Text>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item, i) => (item.id || item.rideId || String(i))}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Aucune course enregistrée</Text>
          </View>
        }
        renderItem={({ item }) => <RideCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textMuted, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  pageHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  pageTitle: { color: Colors.white, fontWeight: '900', fontSize: 30, letterSpacing: -0.5, fontStyle: 'italic' },
  pageTag: { color: Colors.textMuted, fontWeight: '900', fontSize: 10, letterSpacing: 3, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  cardTopInfo: { flex: 1 },
  cardDate: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  stateBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginTop: 4 },
  badgeGreen: { backgroundColor: Colors.greenBg },
  badgeRed: { backgroundColor: Colors.redBg },
  stateText: { fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  textGreen: { color: Colors.green },
  textRed: { color: Colors.red },
  price: { color: Colors.orange, fontWeight: '900', fontSize: 18, fontStyle: 'italic' },
  route: { backgroundColor: Colors.input, borderRadius: Radius.md, padding: 12, gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeLine: { width: 2, height: 12, backgroundColor: Colors.cardBorder, marginLeft: 4 },
  dotOrange: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.orange },
  dotWhite: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  routeText: { flex: 1, color: Colors.white, fontWeight: '600', fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14, fontStyle: 'italic' },
});
