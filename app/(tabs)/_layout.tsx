import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TabBar } from '../../src/components/TabBar';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Animated cross-fade + shift between tabs.
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: { duration: theme.motion.base },
        },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
