import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, RefreshControl, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { rideService } from '../../src/services/rideService';
import { useTheme } from '../../src/context/ThemeContext';
import { Spacing, Radius } from '../../src/types/theme';
import { RideResponse } from '../../src/types/api';

const { width: SW } = Dimensions.get('window');

const buildMiniMap = (startLat?: number, startLon?: number, endLat?: number, endLon?: number, dark = false) => {
  if (!startLat || !startLon) return null;
  const bg = dark ? '#1a1a1a' : '#f0f0f0';
  const endMarker = endLat && endLon
    ? `L.marker([${endLat},${endLon}],{icon:blueIcon}).addTo(map);`
    : '';
  const bounds = endLat && endLon
    ? `map.fitBounds([[${startLat},${startLon}],[${endLat},${endLon}]],{padding:[20,20]});`
    : `map.setView([${startLat},${startLon}],14);`;
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${bg};}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false}).setView([${startLat},${startLon}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var orangeIcon=L.divIcon({html:'<div style="width:10px;height:10px;border-radius:50%;background:#FF8C00;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',iconSize:[10,10],className:''});
var blueIcon=L.divIcon({html:'<div style="width:10px;height:10px;border-radius:50%;background:#3B82F6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',iconSize:[10,10],className:''});
L.marker([${startLat},${startLon}],{icon:orangeIcon}).addTo(map);
${endMarker}
${bounds}
</script></body></html>`;
};

export default function HistoryScreen() {
  const { Colors, isDark } = useTheme();
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

  if (loading) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    </SafeAreaView>
  );

  const RideCard = ({ item }: { item: RideResponse }) => {
    const mapHtml = buildMiniMap(
      item.startLat, item.startLon, item.endLat, item.endLon, isDark
    );
    const isCompleted = item.state === 'COMPLETED';

    return (
      <View style={[styles.card, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
        {/* Mini map */}
        {mapHtml && (
          <View style={styles.miniMapContainer}>
            <WebView
              source={{ html: mapHtml }}
              style={styles.miniMap}
              scrollEnabled={false}
              javaScriptEnabled
              pointerEvents="none"
            />
            <View style={[styles.stateBadgeOverlay, { backgroundColor: isCompleted ? Colors.greenBg : Colors.redBg }]}>
              <Text style={[styles.stateTextOverlay, { color: isCompleted ? Colors.green : Colors.red }]}>
                {isCompleted ? 'Terminée' : item.state}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: Colors.orange }]} />
              <Text style={[styles.routeText, { color: Colors.text }]} numberOfLines={1}>
                {item.startPoint || '—'}
              </Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: Colors.cardBorder }]} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: Colors.blue }]} />
              <Text style={[styles.routeText, { color: Colors.text }]} numberOfLines={1}>
                {item.endPoint || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={[styles.dateText, { color: Colors.textMuted }]}>
              {item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </Text>
            <Text style={[styles.priceText, { color: Colors.orange }]}>{item.price?.toLocaleString()} F</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: Colors.cardBorder }]}>
        <View>
          <Text style={[styles.title, { color: Colors.text }]}>Mes Voyages</Text>
          <Text style={[styles.tag, { color: Colors.textMuted }]}>{rides.length} COURSE(S)</Text>
        </View>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item, i) => item.id || item.rideId || String(i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
            <Text style={[styles.emptyText, { color: Colors.textMuted }]}>Aucune course enregistrée</Text>
          </View>
        }
        renderItem={({ item }) => <RideCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  title: { fontWeight: '900', fontSize: 28, letterSpacing: -0.5 },
  tag: { fontWeight: '900', fontSize: 10, letterSpacing: 3, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  miniMapContainer: { height: 130, position: 'relative' },
  miniMap: { height: 130 },
  stateBadgeOverlay: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  stateTextOverlay: { fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  cardBody: { padding: Spacing.md, gap: Spacing.sm },
  routeBlock: { gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 2, height: 10, marginLeft: 3 },
  routeText: { flex: 1, fontWeight: '600', fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontWeight: '700', fontSize: 12 },
  priceText: { fontWeight: '900', fontSize: 16, fontStyle: 'italic' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontWeight: '700', fontSize: 14 },
});