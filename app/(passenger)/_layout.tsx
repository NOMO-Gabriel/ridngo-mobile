import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/types/theme';

export default function PassengerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
        tabBarLabelStyle: { fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="ride"
        options={{
          title: 'Commander',
          tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Mes courses',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
