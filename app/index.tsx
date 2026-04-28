import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/types/theme';

export default function Index() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/landing');
    } else if (user.role === 'DRIVER') {
      router.replace('/(driver)/dashboard');
    } else if (user.role === 'ADMIN') {
      router.replace('/(passenger)/ride');
    } else {
      router.replace('/(passenger)/ride');
    }
  }, [user, isLoading]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={Colors.orange} size="large" />
    </View>
  );
}
