/**
 * CoreLegend — a compact color→feeling key shown under mood visualizations
 * so viewers can decode the core colors without memorizing emojis.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FEELINGS_WHEEL, label } from '../data/feelings';
import { theme, font } from '../theme';

interface Props {
  /** Restrict to these cores (e.g. only ones present in the data). */
  coreIds?: string[];
}

export function CoreLegend({ coreIds }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const cores = coreIds
    ? FEELINGS_WHEEL.filter((c) => coreIds.includes(c.id))
    : FEELINGS_WHEEL;
  if (cores.length === 0) return null;

  return (
    <View style={styles.row}>
      {cores.map((c) => (
        <View key={c.id} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <Text style={[styles.name, { fontFamily: font(lang, 'semibold') }]}>
            {label(c, lang)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 5,
    marginTop: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 3,
  },
  name: {
    fontSize: 10,
    color: theme.colors.inkSoft,
  },
});
