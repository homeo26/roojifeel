/**
 * Custom bottom tab bar, pager edition.
 * - Direction follows the ACTIVE LANGUAGE (visual order flips for Arabic).
 * - Bottom padding uses safe-area insets (never hides under the Android
 *   system navigation bar or the iOS home indicator).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import * as haptics from '../haptics';
import { theme, font } from '../theme';
import { Pressy } from './Pressy';
import type { TabName } from '../screens/TabPagerContext';

const ICONS: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  home: 'heart',
  history: 'book',
  stats: 'stats-chart',
  settings: 'settings-sharp',
};

interface Props {
  tabs: TabName[];
  labels: string[];
  activeIndex: number;
  onPress: (index: number) => void;
}

export function TabBar({ tabs, labels, activeIndex, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  // Visual order follows the language; the pager order stays fixed.
  const order = lang === 'ar' ? [...tabs.keys()].reverse() : [...tabs.keys()];

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {order.map((index) => {
        const focused = activeIndex === index;
        return (
          <Pressy
            key={tabs[index]}
            style={styles.item}
            scaleTo={0.9}
            onPress={() => {
              if (!focused) {
                haptics.selection();
                onPress(index);
              }
            }}
          >
            <Ionicons
              name={ICONS[tabs[index]]}
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
              {labels[index]}
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
