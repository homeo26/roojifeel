import React from 'react';
import { View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { TabBar } from '../../src/components/TabBar';
import { theme } from '../../src/theme';
import * as haptics from '../../src/haptics';

const TAB_PATHS = ['/', '/history', '/stats', '/settings'];

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const pathname = usePathname();

  const lastNavRef = React.useRef(0);

  const swipeTo = (dir: 1 | -1) => {
    if (Date.now() - lastNavRef.current < 320) return; // let the transition finish
    lastNavRef.current = Date.now();
    // Visual order is reversed in RTL, so flip the direction there.
    const step = lang === 'ar' ? (dir === 1 ? -1 : 1) : dir;
    const idx = TAB_PATHS.indexOf(pathname);
    if (idx === -1) return;
    const next = idx + step;
    if (next < 0 || next >= TAB_PATHS.length) return;
    haptics.selection();
    router.navigate(TAB_PATHS[next] as never);
  };

  // Instagram-style: swipe left/right anywhere on the scene to change tabs.
  // Horizontal child scrollers (e.g. the mood-orb row) activate first and win.
  const swipe = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX < -60 || e.velocityX < -800) runOnJS(swipeTo)(1);
      else if (e.translationX > 60 || e.velocityX > 800) runOnJS(swipeTo)(-1);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1 }}>
        <Tabs
          detachInactiveScreens={false}
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            freezeOnBlur: false,
            lazy: false,
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
      </View>
    </GestureDetector>
  );
}
