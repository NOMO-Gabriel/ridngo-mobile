/**
 * LocationSearch.tsx — Composant de saisie géolocalisée avec autocomplétion
 *
 * Améliorations v2 :
 *  - Dropdown rendu dans un Modal natif → zIndex garanti au-dessus de la WebView
 *  - Suggestions POI locaux (Yaoundé) instantanées dès 2 caractères
 *  - Nominatim comme fallback après 600ms de debounce
 *  - Icône ⭐ pour les POI locaux, 📍 pour Nominatim
 *  - Bouton GPS (expo-location + reverse geocoding)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Modal, Platform,
  KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { Spacing, Radius } from '../types/theme';
import { Location } from '../types/api';

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const OSM_URL = 'https://nominatim.openstreetmap.org';

// POI locaux de Yaoundé — suggestions instantanées
const POI_LOCAUX: Array<{ nom: string; latitude: number; longitude: number }> = [
  { nom: "Dispensaire Messassi", latitude: 3.9463, longitude: 11.5221 },
  { nom: "Hôpital Central de Yaoundé", latitude: 3.8681, longitude: 11.5135 },
  { nom: "Hôpital Gynéco-Obstétrique (Ngousso)", latitude: 3.9015, longitude: 11.5401 },
  { nom: "CHU de Yaoundé", latitude: 3.8628, longitude: 11.4961 },
  { nom: "Hôpital Jamot", latitude: 3.8824, longitude: 11.5303 },
  { nom: "Hôpital de District de Djoungolo", latitude: 3.8817, longitude: 11.5225 },
  { nom: "Monument de la Réunification", latitude: 3.8506, longitude: 11.5131 },
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
  { nom: "Carrefour Bastos", latitude: 3.8945, longitude: 11.5112 },
  { nom: "Carrefour Obili", latitude: 3.8614, longitude: 11.4915 },
  { nom: "Carrefour Biyem-Assi", latitude: 3.8415, longitude: 11.4884 },
  { nom: "Bastos (Ambassades)", latitude: 3.8967, longitude: 11.5125 },
  { nom: "Biyem-Assi", latitude: 3.8392, longitude: 11.4851 },
  { nom: "Etoudi (Quartier Présidence)", latitude: 3.9156, longitude: 11.5292 },
  { nom: "Nsam", latitude: 3.8292, longitude: 11.5090 },
  { nom: "Messassi (Sortie Nord)", latitude: 3.9463, longitude: 11.5221 },
  { nom: "Essos", latitude: 3.8735, longitude: 11.5365 },
  { nom: "Mimboman", latitude: 3.8658, longitude: 11.5512 },
  { nom: "Rond-point Poste Centrale", latitude: 3.8641, longitude: 11.5195 },
  { nom: "Carrefour Carrière", latitude: 3.8852, longitude: 11.4919 },
];

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type SuggestionItem =
  | { type: 'poi'; nom: string; latitude: number; longitude: number }
  | { type: 'osm'; display_name: string; address: any; lat: string; lon: string };

interface Props {
  placeholder: string;
  value: string;
  onSelect: (loc: Location) => void;
  icon?: string;
  showGPS?: boolean;
  Colors: any; // typeof Colors depuis ThemeContext
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatAddress(address: any): string {
  if (!address) return '';
  const road = address.road || address.pedestrian || address.highway || '';
  const suburb = address.suburb || address.neighbourhood || address.city_district || '';
  const city = address.city || address.town || address.village || '';
  const parts = [road, suburb, city !== suburb ? city : ''].filter(Boolean);
  return parts.join(', ');
}

function normStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // retire les accents
    .trim();
}

// ─────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────
export function LocationSearch({
  placeholder, value, onSelect,
  icon = 'navigate', showGPS = false, Colors,
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync valeur externe (ex: tap carte → reverse geocode)
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ── Recherche combinée POI locaux + Nominatim ──
  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }

    // 1. Filtre instantané sur les POI locaux (dès 2 caractères)
    const norm = normStr(q);
    const poiResults: SuggestionItem[] = POI_LOCAUX
      .filter(p => normStr(p.nom).includes(norm))
      .slice(0, 4)
      .map(p => ({ type: 'poi' as const, ...p }));

    setSuggestions(poiResults);

    // 2. Nominatim après debounce 600ms (min 3 caractères)
    if (q.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `${OSM_URL}/search?format=json&q=${encodeURIComponent(q)},+Yaound%C3%A9&countrycodes=cm&limit=5&addressdetails=1&accept-language=fr`,
            { headers: { 'Accept-Language': 'fr' } }
          );
          const data = await res.json();

          // Dédupliquer : exclure résultats OSM dont le nom est déjà dans les POI locaux
          const osmItems: SuggestionItem[] = (data as any[])
            .filter((item: any) => {
              const dispNorm = normStr(item.display_name.split(',')[0]);
              return !poiResults.some(p =>
                p.type === 'poi' &&
                (normStr(p.nom).includes(dispNorm) || dispNorm.includes(normStr(p.nom)))
              );
            })
            .slice(0, 5 - poiResults.length)
            .map((item: any) => ({ type: 'osm' as const, ...item }));

          setSuggestions([...poiResults, ...osmItems]);
        } catch {
          // Garder les POI locaux si Nominatim échoue
          setSuggestions(poiResults);
        } finally {
          setLoading(false);
        }
      }, 600);
    }
  }, []);

  // ── Sélection d'une suggestion ──
  const handleSelect = (item: SuggestionItem) => {
    let loc: Location;

    if (item.type === 'poi') {
      loc = { name: item.nom, lat: item.latitude, lon: item.longitude };
    } else {
      const name = formatAddress(item.address) || item.display_name.split(',')[0];
      loc = { name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
    }

    setQuery(loc.name);
    setSuggestions([]);
    setModalVisible(false);
    onSelect(loc);
  };

  // ── Bouton GPS ──
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
      setModalVisible(false);
      onSelect({ name, lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch { /* ignore */ }
    finally { setLocating(false); }
  };

  // ── Ouverture modal de recherche ──
  const openModal = () => {
    setModalVisible(true);
    // Focus le TextInput dans le modal après rendu
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // ─────────────────────────────────────────────
  // RENDU — Champ de saisie "fantôme" (ouvre le modal)
  // ─────────────────────────────────────────────
  return (
    <>
      {/* ── Champ visible dans le panel (ouvre le modal au tap) ── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openModal}
        style={[
          styles.fieldRow,
          { backgroundColor: Colors.input, borderColor: Colors.inputBorder },
        ]}
      >
        <Ionicons name={icon as any} size={18} color={Colors.orange} style={styles.fieldIcon} />
        <Text
          style={[
            styles.fieldText,
            { color: query ? Colors.text : Colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {query || placeholder}
        </Text>
        {showGPS && (
          <TouchableOpacity
            onPress={useGPS}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {locating
              ? <ActivityIndicator size="small" color={Colors.orange} />
              : <Ionicons name="locate" size={18} color={Colors.orange} />
            }
          </TouchableOpacity>
        )}
        {query ? (
          <TouchableOpacity
            onPress={() => { setQuery(''); onSelect({ name: '', lat: 0, lon: 0 }); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 6 }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* ── Modal de recherche — flotte au-dessus de tout ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Header modal */}
            <View style={[styles.modalHeader, { borderBottomColor: Colors.border ?? Colors.cardBorder }]}>
              <TouchableOpacity onPress={closeModal} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.text} />
              </TouchableOpacity>
              <View style={[styles.searchBar, { backgroundColor: Colors.input, borderColor: Colors.inputBorder }]}>
                <Ionicons name={icon as any} size={18} color={Colors.orange} style={{ marginRight: 8 }} />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: Colors.text }]}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textMuted}
                  value={query}
                  onChangeText={search}
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {loading && <ActivityIndicator size="small" color={Colors.orange} style={{ marginLeft: 6 }} />}
                {query.length > 0 && !loading && (
                  <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Hint POI locaux vides */}
            {suggestions.length === 0 && query.length < 2 && (
              <View style={styles.hintBlock}>
                <Text style={[styles.hintTitle, { color: Colors.text }]}>
                  📍 Lieux populaires à Yaoundé
                </Text>
                <FlatList
                  data={POI_LOCAUX.slice(0, 8)}
                  keyExtractor={(_, i) => `popular-${i}`}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.resultItem, { borderBottomColor: Colors.border ?? Colors.cardBorder }]}
                      onPress={() => handleSelect({ type: 'poi', ...item })}
                    >
                      <Text style={styles.resultIcon}>⭐</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultName, { color: Colors.text }]} numberOfLines={1}>
                          {item.nom}
                        </Text>
                        <Text style={[styles.resultSub, { color: Colors.textMuted }]} numberOfLines={1}>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Résultats de recherche */}
            {suggestions.length > 0 && (
              <FlatList
                data={suggestions}
                keyExtractor={(_, i) => `sug-${i}`}
                keyboardShouldPersistTaps="always"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const isPoi = item.type === 'poi';
                  const mainText = isPoi
                    ? item.nom
                    : item.display_name.split(',')[0];
                  const subText = isPoi
                    ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                    : item.display_name.split(',').slice(1, 3).join(',').trim();

                  return (
                    <TouchableOpacity
                      style={[styles.resultItem, { borderBottomColor: Colors.border ?? Colors.cardBorder }]}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resultIcon}>{isPoi ? '⭐' : '📍'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultName, { color: Colors.text }]} numberOfLines={1}>
                          {mainText}
                        </Text>
                        {subText ? (
                          <Text style={[styles.resultSub, { color: Colors.textMuted }]} numberOfLines={1}>
                            {subText}
                          </Text>
                        ) : null}
                      </View>
                      {isPoi && (
                        <View style={styles.poiBadge}>
                          <Text style={styles.poiBadgeText}>POI</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Aucun résultat */}
            {suggestions.length === 0 && query.length >= 2 && !loading && (
              <View style={styles.emptyBlock}>
                <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
                  Aucun résultat pour "{query}"
                </Text>
                <Text style={[styles.emptyHint, { color: Colors.textMuted }]}>
                  Essayez un nom de quartier, marché ou monument
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  // Champ fantôme dans le panel
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    gap: 8,
  },
  fieldIcon: { flexShrink: 0 },
  fieldText: { flex: 1, fontWeight: '700', fontSize: 14 },

  // Modal
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, gap: 10,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 10,
  },
  backBtn: { padding: 6 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontWeight: '700', fontSize: 15, padding: 0 },

  // Lieux populaires
  hintBlock: { paddingTop: 16 },
  hintTitle: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.md, marginBottom: 8 },

  // Items suggestions
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, gap: 10,
  },
  resultIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  resultName: { fontWeight: '700', fontSize: 14 },
  resultSub: { fontWeight: '500', fontSize: 11, marginTop: 2 },
  poiBadge: {
    backgroundColor: '#8B5CF620', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  poiBadgeText: { color: '#8B5CF6', fontWeight: '900', fontSize: 10 },

  // Aucun résultat
  emptyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyText: { fontWeight: '700', fontSize: 14, textAlign: 'center' },
  emptyHint: { fontWeight: '500', fontSize: 12, textAlign: 'center' },
});

// import React, { useState, useCallback, useRef } from 'react';
// import {
//   View, Text, TextInput, TouchableOpacity, FlatList,
//   StyleSheet, ActivityIndicator
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { Colors, Spacing, Radius } from '../types/theme';
// import { Location } from '../types/api';
// import * as ExpoLocation from 'expo-location';

// const OSM_URL = 'https://nominatim.openstreetmap.org';

// const formatAddress = (addressObj: any): string => {
//   if (!addressObj) return '';
//   const road = addressObj.road || addressObj.pedestrian || addressObj.highway;
//   const neighborhood = addressObj.suburb || addressObj.neighbourhood || addressObj.city_district;
//   const city = addressObj.city || addressObj.town || addressObj.village;
//   const parts: string[] = [];
//   if (road) parts.push(road);
//   if (neighborhood) parts.push(neighborhood);
//   if (city && city !== neighborhood) parts.push(city);
//   return parts.length > 0 ? parts.join(', ') : 'Ma position';
// };

// interface Props {
//   placeholder: string;
//   value: string;
//   onSelect: (loc: Location) => void;
//   icon?: string;
//   showGPS?: boolean;
//   Colors: typeof Colors;
// }

// export function LocationSearch({ placeholder, value, onSelect, icon = 'navigate', showGPS = false, Colors }: Props) {
//   const [query, setQuery] = useState(value);
//   const [suggestions, setSuggestions] = useState<any[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [locating, setLocating] = useState(false);
//   const [focused, setFocused] = useState(false);
//   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

//   const search = useCallback((q: string) => {
//     setQuery(q);
//     if (debounceRef.current) clearTimeout(debounceRef.current);
//     if (!q || q.length < 3) { setSuggestions([]); return; }
//     debounceRef.current = setTimeout(async () => {
//       setLoading(true);
//       try {
//         const res = await fetch(
//           `${OSM_URL}/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cm&limit=5&addressdetails=1&accept-language=fr`
//         );
//         const data = await res.json();
//         setSuggestions(data);
//       } catch { setSuggestions([]); }
//       finally { setLoading(false); }
//     }, 600);
//   }, []);

//   const handleSelect = (item: any) => {
//     const name = formatAddress(item.address) || item.display_name.split(',')[0];
//     setQuery(name);
//     setSuggestions([]);
//     setFocused(false);
//     onSelect({ name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
//   };

//   const useGPS = async () => {
//     const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
//     if (status !== 'granted') return;
//     setLocating(true);
//     try {
//       const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
//       const res = await fetch(
//         `${OSM_URL}/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1&accept-language=fr`
//       );
//       const data = await res.json();
//       const name = formatAddress(data.address) || 'Ma position';
//       setQuery(name);
//       setSuggestions([]);
//       onSelect({ name, lat: pos.coords.latitude, lon: pos.coords.longitude });
//     } catch { /* ignore */ }
//     finally { setLocating(false); }
//   };

//   return (
//     <View style={{ overflow: 'visible' }}>
//       <View style={[styles.row, { backgroundColor: Colors.input, borderColor: focused ? Colors.orange : Colors.inputBorder }]}>
//         <Ionicons name={icon as any} size={18} color={focused ? Colors.orange : Colors.textMuted} style={styles.icon} />
//         <TextInput
//           style={[styles.input, { color: Colors.text }]}
//           placeholder={placeholder}
//           placeholderTextColor={Colors.textMuted}
//           value={query}
//           onChangeText={search}
//           onFocus={() => setFocused(true)}
//           onBlur={() => setTimeout(() => { setFocused(false); setSuggestions([]); }, 250)}
//           autoCorrect={false}
//           autoCapitalize="none"
//           blurOnSubmit={false}
//         />
//         {(loading || locating) && <ActivityIndicator size="small" color={Colors.orange} style={styles.loader} />}
//         {showGPS && !loading && !locating && (
//           <TouchableOpacity onPress={useGPS} style={styles.gpsBtn}>
//             <Ionicons name="locate" size={18} color={Colors.orange} />
//           </TouchableOpacity>
//         )}
//       </View>

//       {focused && suggestions.length > 0 && (
//         <View style={[styles.dropdown, { backgroundColor: Colors.card, borderColor: Colors.cardBorder }]}>
//           <FlatList
//             data={suggestions}
//             keyExtractor={(_, i) => String(i)}
//             scrollEnabled={false}
//             keyboardShouldPersistTaps="always"
//             renderItem={({ item }) => (
//               <TouchableOpacity
//                 style={[styles.resultItem, { borderBottomColor: Colors.darkBorder }]}
//                 onPress={() => handleSelect(item)}
//               >
//                 <Ionicons name="location" size={14} color={Colors.orange} style={{ marginTop: 2 }} />
//                 <View style={{ flex: 1 }}>
//                   <Text style={[styles.resultName, { color: Colors.text }]} numberOfLines={1}>
//                     {item.display_name.split(',')[0]}
//                   </Text>
//                   <Text style={[styles.resultSub, { color: Colors.textMuted }]} numberOfLines={1}>
//                     {item.display_name.split(',').slice(1, 3).join(',')}
//                   </Text>
//                 </View>
//               </TouchableOpacity>
//             )}
//           />
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   row: {
//     flexDirection: 'row', alignItems: 'center',
//     borderRadius: Radius.md, borderWidth: 1,
//     paddingHorizontal: Spacing.md,
//   },
//   icon: { marginRight: 8 },
//   input: { flex: 1, fontWeight: '700', fontSize: 14, paddingVertical: 14 },
//   loader: { marginRight: 8 },
//   gpsBtn: { padding: 6 },
//   dropdown: {
//     position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
//     borderRadius: Radius.md, marginTop: 4,
//     borderWidth: 1,
//     shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 50,
//   },
//   resultItem: {
//     flexDirection: 'row', alignItems: 'flex-start', gap: 8,
//     paddingHorizontal: Spacing.md, paddingVertical: 12,
//     borderBottomWidth: 1,
//   },
//   resultName: { fontWeight: '700', fontSize: 13 },
//   resultSub: { fontWeight: '600', fontSize: 11, marginTop: 2 },
// });