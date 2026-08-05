/**
 * Custom bottom tab bar.
 * - Direction follows the ACTIVE LANGUAGE (not the native RTL flag), so
 *   Arabic is right-to-left and English is left-to-right on both platforms.
 * - Bottom padding uses safe-area insets, so it never hides under the
 *   Android system navigation bar (back / home / recents) or the iOS
 *   home indicator.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import * as haptics from '../haptics';
import { theme, font } from '../theme';
import { Pressy } from './Pressy';

/** Minimal structural types — avoids coupling to expo-router's vendored
 * react-navigation type definitions. */
interface TabRoute {
  key: string;
  name: string;
}
interface TabBarProps {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'heart',
  history: 'book',
  stats: 'stats-chart',
  settings: 'settings-sharp',
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const lastNavRef = React.useRef(0);
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  // Explicit visual order derived from language — independent of the
  // native I18nManager flag, identical behavior on iOS and Android.
  const routes = lang === 'ar' ? [...state.routes].reverse() : state.routes;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {routes.map((route) => {
        const index = state.routes.indexOf(route);
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;

        return (
          <Pressy
            key={route.key}
            style={styles.item}
            scaleTo={0.9}
            onPress={() => {
              // Ignore presses while a transition is in flight — interrupted
              // shift transitions can freeze a blank scene on top.
              if (Date.now() - lastNavRef.current < 320) return;
              haptics.selection();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                lastNavRef.current = Date.now();
                navigation.navigate(route.name);
              }
            }}
          >
            <Ionicons
              name={ICONS[route.name] ?? 'ellipse'}
              size={22}
              color={focused ? theme.colors.purpleSoft : theme.colors.tabInactive}
            />
            <Text
              style={[
                styles.label,
                {
                  fontFamily: font(lang, 'semibold'),
                  color: focused ? theme.colors.purpleSoft : theme.colors.tabInactive,
                },
              ]}
            >
              {label}
            </Text>
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10.5,
  },
});
