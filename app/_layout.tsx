import React, { useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { initI18n, loadSavedLanguage } from '../src/i18n';
import { loadHapticsPref } from '../src/haptics';
import i18next from 'i18next';
import { syncSmartReminders } from '../src/notifications';
import { runBackup } from '../src/backup';
import { theme } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    (async () => {
      const lang = await loadSavedLanguage();
      initI18n(lang);
      await loadHapticsPref();
      // Recompute the smart reminder schedule (skip-if-logged + nudge).
      syncSmartReminders({
        title: i18next.t('settings.notifTitle'),
        body: i18next.t('settings.notifBody'),
        nudgeTitle: i18next.t('settings.nudgeTitle'),
        nudgeBody: i18next.t('settings.nudgeBody'),
      }).catch(() => {});
      runBackup().catch(() => {});
      // Keep the NATIVE direction pinned to LTR on both platforms.
      // RTL is applied deterministically in JS via per-screen `direction`
      // styles and the custom tab bar, so iOS and Android behave the same
      // and language switches apply instantly without a restart.
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }
      setI18nReady(true);
    })();
  }, []);

  if (!fontsLoaded || !i18nReady) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="wrapped"
          options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 250 }}
        />
        <Stack.Screen
          name="log"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
      </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
