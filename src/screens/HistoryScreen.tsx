import React, { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCore, getSecondary, getTertiary } from '../data/feelings';
import { shareEntries } from '../share';
import * as haptics from '../haptics';
import { Pressy } from '../components/Pressy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FeelingEntry, deleteEntry, getAllEntries } from '../db';
import { EntryCard } from '../components/EntryCard';
import { theme, font } from '../theme';
import { formatDayLabel } from '../timeFormat';

interface DaySection {
  title: string;
  data: FeelingEntry[];
}

export function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [entries, setEntries] = useState<FeelingEntry[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);

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

  const enterSelection = (entry: FeelingEntry) => {
    haptics.selection();
    setSelectedIds(new Set([entry.id]));
  };

  const toggleSelect = (entry: FeelingEntry) => {
    setSelectedIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  };

  const exitSelection = () => setSelectedIds(null);

  const shareSelected = async () => {
    if (!selectedIds || selectedIds.size === 0) return;
    haptics.selection();
    const chosen = entries.filter((e) => selectedIds.has(e.id));
    await shareEntries(chosen, lang, t);
  };

  const deleteSelected = () => {
    if (!selectedIds || selectedIds.size === 0) return;
    Alert.alert(t('history.deleteTitle'), t('history.deleteMessage'), [
      { text: t('history.cancel'), style: 'cancel' },
      {
        text: t('history.delete'),
        style: 'destructive',
        onPress: async () => {
          for (const id of selectedIds) await deleteEntry(id);
          exitSelection();
          reload();
        },
      },
    ]);
  };

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
            {selectedIds != null ? (
              <View style={styles.selectionBar}>
                <Pressy hitSlop={10} scaleTo={0.85} onPress={exitSelection}>
                  <Ionicons name="close" size={20} color={theme.colors.inkSoft} />
                </Pressy>
                <Text style={[styles.selectionCount, { fontFamily: font(lang, 'bold') }]}>
                  {t('history.selectedCount', { count: selectedIds.size })}
                </Text>
                <Pressy
                  hitSlop={10}
                  scaleTo={0.85}
                  onPress={shareSelected}
                  disabled={selectedIds.size === 0}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={selectedIds.size > 0 ? theme.colors.purpleSoft : theme.colors.inkFaint}
                  />
                </Pressy>
                <Pressy
                  hitSlop={10}
                  scaleTo={0.85}
                  onPress={deleteSelected}
                  disabled={selectedIds.size === 0}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={selectedIds.size > 0 ? theme.colors.danger : theme.colors.inkFaint}
                  />
                </Pressy>
              </View>
            ) : (
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
            )}
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
          <EntryCard
            entry={item}
            index={index}
            selectionMode={selectedIds != null}
            selected={selectedIds?.has(item.id) ?? false}
            onToggleSelect={() => toggleSelect(item)}
            onLongPress={() => (selectedIds == null ? enterSelection(item) : undefined)}
          />
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
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderWidth: 1,
    borderColor: theme.colors.purple,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  selectionCount: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.ink,
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
