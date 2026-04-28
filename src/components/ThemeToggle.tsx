import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme, Colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[styles.btn, { backgroundColor: Colors.input, borderColor: Colors.cardBorder }]}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={18}
        color={Colors.orange}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
});