/**
 * src/components/AppSafeArea.tsx
 *
 * Remplacement global de SafeAreaView.
 * Gère correctement le padding haut sur Android (StatusBar non translucide)
 * et iOS (notch / Dynamic Island).
 *
 * Usage : remplacer <SafeAreaView style={[s.safe, {backgroundColor: ...}]}>
 *         par      <AppSafeArea style={[s.safe, {backgroundColor: ...}]}>
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

/**
 * AppSafeArea — wrapper autour de SafeAreaView de react-native-safe-area-context.
 * Par défaut expose tous les edges (top, bottom, left, right).
 * Passer edges={['bottom']} pour les modals qui n'ont pas besoin du padding top.
 */
export function AppSafeArea({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}: Props) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}