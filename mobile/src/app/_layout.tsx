import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { TabBarVisibilityProvider } from '@/context/TabBarVisibilityContext';
import { NotificationProvider } from '@/context/NotificationContext';
import WhatsAppNotificationBanner from '@/components/WhatsAppNotificationBanner';
import { useRouter, useSegments } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isReady, isAuthenticated, isOnboarded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboardingGroup = segments[0] === 'onboarding';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect unauthenticated user to login flow
      router.replace('/auth');
    } else if (isAuthenticated && !isOnboarded && !inOnboardingGroup) {
      // Redirect user to onboarding setup wizard
      router.replace('/onboarding');
    } else if (isAuthenticated && isOnboarded && (inAuthGroup || inOnboardingGroup)) {
      // Redirect onboarded user to main app feed
      router.replace('/');
    }
  }, [isReady, isAuthenticated, isOnboarded, segments]);

  return (
    <ThemeProvider value={colorScheme === 'light' ? DefaultTheme : DarkTheme}>
      <NotificationProvider>
        <TabBarVisibilityProvider>
          <AppTabs />
          <WhatsAppNotificationBanner />
        </TabBarVisibilityProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
