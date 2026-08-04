import React, { useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { initI18n, loadSavedLanguage } from '../src/i18n';
import { theme } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    (async () => {
      const lang = await loadSavedLanguage();
      initI18n(lang);
      // Align native layout direction with the language.
      const wantRTL = lang === 'ar';
      if (I18nManager.isRTL !== wantRTL) {
        I18nManager.allowRTL(wantRTL);
        I18nManager.forceRTL(wantRTL);
        // Direction fully applies after next app restart; JS-side styles
        // (textAlign, logical margins) still follow immediately.
      }
      setI18nReady(true);
    })();
  }, []);

  if (!fontsLoaded || !i18nReady) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="log"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
