import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isDark, Colors } = useTheme();
  useEffect(() => { SplashScreen.hideAsync(); }, []);

  return (
    <>
      {/*
        translucent={false} → Android respecte la SafeArea correctement.
        backgroundColor aligné sur le thème → pas de barre noire résiduelle.
      */}
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={Colors.background}
        translucent={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(passenger)" />
        <Stack.Screen name="(driver)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SafeAreaProvider requis par useSafeAreaInsets dans toute l'app */}
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// import { useEffect } from 'react';
// import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import * as SplashScreen from 'expo-splash-screen';
// import { AuthProvider } from '../src/context/AuthContext';
// import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

// SplashScreen.preventAutoHideAsync();

// function AppContent() {
//   const { isDark, Colors } = useTheme();
//   useEffect(() => { SplashScreen.hideAsync(); }, []);

//   return (
//     <>
//       <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={Colors.background} />
//       <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
//         <Stack.Screen name="index" />
//         <Stack.Screen name="(auth)" />
//         <Stack.Screen name="(passenger)" />
//         <Stack.Screen name="(driver)" />
//       </Stack>
//     </>
//   );
// }

// export default function RootLayout() {
//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <ThemeProvider>
//         <AuthProvider>
//           <AppContent />
//         </AuthProvider>
//       </ThemeProvider>
//     </GestureHandlerRootView>
//   );
// }