import React, { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCore, getSecondary, getTertiary } from '../../src/data/feelings';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FeelingEntry, deleteEntry, getAllEntries } from '../../src/db';
import { EntryCard } from '../../src/components/EntryCard';
import { theme, font } from '../../src/theme';
import { formatDayLabel } from '../../src/timeFormat';

interface DaySection {
  title: string;
  data: FeelingEntry[];
}

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [query, setQuery] = useState('');

  const reload = useCallback(() => {
    getAllEntries().then(setEntries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.note?.toLowerCase().includes(q)) return true;
      if (e.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
      return e.feelings.some((f) => {
        const nodes = [
          getCore(f.coreId),
          getSecondary(f.coreId, f.secondaryId),
          getTertiary(f.coreId, f.secondaryId, f.tertiaryId),
        ];
        return nodes.some(
          (n) => n && (n.en.toLowerCase().includes(q) || n.ar.includes(q)),
        );
      });
    });
  }, [entries, query]);

  const sections: DaySection[] = useMemo(() => {
    const byDay = new Map<string, DaySection>();
    for (const entry of filtered) {
      const date = new Date(entry.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      let section = byDay.get(key);
      if (!section) {
        section = { title: formatDayLabel(date, t, lang), data: [] };
        byDay.set(key, section);
      }
      section.data.push(entry);
    }
    return Array.from(byDay.values());
  }, [filtered, t, lang]);

  const confirmDelete = (entry: FeelingEntry) => {
    Alert.alert(t('history.deleteTitle'), t('history.deleteMessage'), [
      { text: t('history.cancel'), style: 'cancel' },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry.id);
          reload();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { fontFamily: font(lang, 'extrabold') }]}>
              {t('history.title')}
            </Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={theme.colors.inkFaint} />
              <TextInput
                style={[styles.searchInput, { fontFamily: font(lang, 'regular') }]}
                placeholder={t('history.searchPlaceholder')}
                placeholderTextColor={theme.colors.inkFaint}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                textAlign={lang === 'ar' ? 'right' : 'left'}
              />
              {query !== '' ? (
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.colors.inkFaint}
                  onPress={() => setQuery('')}
                />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { fontFamily: font(lang, 'regular') }]}>
            {t('history.empty')}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.day, { fontFamily: font(lang, 'bold') }]}>{section.title}</Text>
        )}
        renderItem={({ item, index }) => (
          <EntryCard entry={item} index={index} onLongPress={() => confirmDelete(item)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    letterSpacing: -0.6,
    color: theme.colors.ink,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.ink,
  },
  day: {
    fontSize: 15,
    color: theme.colors.inkSoft,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  empty: {
    marginTop: theme.spacing.xl,
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.inkFaint,
    textAlign: 'center',
  },
});
