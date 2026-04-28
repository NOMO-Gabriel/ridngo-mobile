import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geocodeService } from '../services/userService';
import { Colors, Spacing, Radius } from '../types/theme';
import { Location } from '../types/api';
import * as ExpoLocation from 'expo-location';

interface Props {
  placeholder: string;
  value: string;
  onSelect: (loc: Location) => void;
  icon?: string;
  showGPS?: boolean;
}

export function LocationSearch({ placeholder, value, onSelect, icon = 'navigate', showGPS = false }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 3) { setResults([]); return; }
    setLoading(true);
    const data = await geocodeService.search(q);
    setResults(data);
    setLoading(false);
  }, []);

  const handleSelect = (loc: Location) => {
    setQuery(loc.name.split(',')[0]);
    setResults([]);
    setFocused(false);
    onSelect(loc);
  };

  const useGPS = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setLoading(true);
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
    const name = await geocodeService.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    setLoading(false);
    handleSelect({ name, lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  return (
    <View>
      <View style={[styles.row, focused && styles.rowFocused]}>
        <Ionicons name={icon as any} size={18} color={focused ? Colors.orange : Colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={search}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {loading && <ActivityIndicator size="small" color={Colors.orange} style={{ marginRight: 8 }} />}
        {showGPS && !loading && (
          <TouchableOpacity onPress={useGPS} style={styles.gpsBtn}>
            <Ionicons name="locate" size={18} color={Colors.orange} />
          </TouchableOpacity>
        )}
      </View>

      {focused && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                <Ionicons name="location" size={14} color={Colors.orange} />
                <Text style={styles.resultText} numberOfLines={2}>{item.name}</Text>
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
    backgroundColor: Colors.input, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: Spacing.md,
  },
  rowFocused: { borderColor: Colors.orange },
  icon: { marginRight: 8 },
  input: { flex: 1, color: Colors.white, fontWeight: '700', fontSize: 14, paddingVertical: 14 },
  gpsBtn: { padding: 6 },
  dropdown: {
    backgroundColor: '#1E1E1E', borderRadius: Radius.md, marginTop: 4,
    borderWidth: 1, borderColor: Colors.inputBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, elevation: 8,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.darkBorder,
  },
  resultText: { flex: 1, color: Colors.white, fontWeight: '600', fontSize: 13, lineHeight: 18 },
});
