import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../types/theme';
import { Location } from '../types/api';
import * as ExpoLocation from 'expo-location';

const OSM_URL = 'https://nominatim.openstreetmap.org';

const formatAddress = (addressObj: any): string => {
  if (!addressObj) return '';
  const road = addressObj.road || addressObj.pedestrian || addressObj.highway;
  const neighborhood = addressObj.suburb || addressObj.neighbourhood || addressObj.city_district;
  const city = addressObj.city || addressObj.town || addressObj.village;
  const parts: string[] = [];
  if (road) parts.push(road);
  if (neighborhood) parts.push(neighborhood);
  if (city && city !== neighborhood) parts.push(city);
  return parts.length > 0 ? parts.join(', ') : 'Ma position';
};

interface Props {
  placeholder: string;
  value: string;
  onSelect: (loc: Location) => void;
  icon?: string;
  showGPS?: boolean;
  Colors: typeof Colors;
}

export function LocationSearch({ placeholder, value, onSelect, icon = 'navigate', showGPS = false, Colors }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${OSM_URL}/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cm&limit=5&addressdetails=1&accept-language=fr`
        );
        const data = await res.json();
        setSuggestions(data);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 600);
  }, []);

  const handleSelect = (item: any) => {
    const name = formatAddress(item.address) || item.display_name.split(',')[0];
    setQuery(name);
    setSuggestions([]);
    setFocused(false);
    onSelect({ name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
  };

  const useGPS = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setLocating(true);
    try {
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
      const res = await fetch(
        `${OSM_URL}/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1&accept-language=fr`
      );
      const data = await res.json();
      const name = formatAddress(data.address) || 'Ma position';
      setQuery(name);
      setSuggestions([]);
      onSelect({ name, lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch { /* ignore */ }
    finally { setLocating(false); }
  };

  return (
    <View style={{ overflow: 'visible' }}>
      <View style={[styles.row, { backgroundColor: Colors.input, borderColor: focused ? Colors.orange : Colors.inputBorder }]}>
        <Ionicons name={icon as any} size={18} color={focused ? Colors.orange : Colors.textMuted} style={styles.icon} />
        <TextInput
          style={[styles.input, { color: Colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={search}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => { setFocused(false); setSuggestions([]); }, 250)}
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
        />
        {(loading || locating) && <ActivityIndicator size="small" color={Colors.orange} style={styles.loader} />}
        {showGPS && !loading && !locating && (
          <TouchableOpacity onPress={useGPS} style={styles.gpsBtn}>
            <Ionicons name="locate" size={18} color={Colors.orange} />
          </TouchableOpacity>
        )}
      </View>

      {focused && suggestions.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultItem, { borderBottomColor: Colors.darkBorder }]}
                onPress={() => handleSelect(item)}
              >
                <Ionicons name="location" size={14} color={Colors.orange} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultName, { color: Colors.text }]} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={[styles.resultSub, { color: Colors.textMuted }]} numberOfLines={1}>
                    {item.display_name.split(',').slice(1, 3).join(',')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontWeight: '700', fontSize: 14, paddingVertical: 14 },
  loader: { marginRight: 8 },
  gpsBtn: { padding: 6 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
    borderRadius: Radius.md, marginTop: 4,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 50,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultName: { fontWeight: '700', fontSize: 13 },
  resultSub: { fontWeight: '600', fontSize: 11, marginTop: 2 },
});