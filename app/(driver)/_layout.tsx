import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/types/theme';

export default function DriverLayout() {
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
      {/* ── Tabs visibles ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-rides"
        options={{
          title: 'Mes offres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* ── Écrans cachés des tabs (naviguables via router.push) ── */}
      <Tabs.Screen
        name="offers/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="ride/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="history"
        options={{ href: null }}
      />
    </Tabs>
  );
}


// import { Tabs } from 'expo-router';
// import { Ionicons } from '@expo/vector-icons';
// import { Colors } from '../../src/types/theme';

// export default function DriverLayout() {
//   return (
//     <Tabs
//       screenOptions={{
//         headerShown: false,
//         tabBarStyle: {
//           backgroundColor: '#141414',
//           borderTopColor: 'rgba(255,255,255,0.07)',
//           borderTopWidth: 1,
//           paddingBottom: 8,
//           paddingTop: 8,
//           height: 65,
//         },
//         tabBarActiveTintColor: Colors.orange,
//         tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
//         tabBarLabelStyle: { fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
//       }}
//     >
//       <Tabs.Screen
//         name="dashboard"
//         options={{
//           title: 'Radar',
//           tabBarIcon: ({ color, size }) => <Ionicons name="radio" size={size} color={color} />,
//         }}
//       />
//       <Tabs.Screen
//         name="offers/[id]"
//         options={{
//           href: null, // hidden from tabs
//         }}
//       />
//       <Tabs.Screen
//         name="ride/[id]"
//         options={{
//           href: null, // hidden from tabs
//         }}
//       />
//       <Tabs.Screen
//         name="onboarding"
//         options={{
//           href: null,
//         }}
//       />
//       <Tabs.Screen
//         name="profile"
//         options={{
//           title: 'Profil',
//           tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
//         }}
//       />
//     </Tabs>
//   );
// }
