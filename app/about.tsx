/**
 * About — version, the privacy manifesto, and credits.
 */
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme, font, displayFont } from '../src/theme';
import { Pressy } from '../src/components/Pressy';
import * as haptics from '../src/haptics';

const REPO_URL = 'https://github.com/homeo26/roojifeel';

export default function AboutScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SafeAreaView
      style={[styles.safe, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressy onPress={() => router.back()} hitSlop={12} scaleTo={0.85} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.colors.ink} />
        </Pressy>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={require('../assets/logo-circle.png')} style={styles.logo} />
        <Text style={[styles.name, { fontFamily: displayFont(lang) }]}>Roojifeel</Text>
        <Text style={[styles.version, { fontFamily: font(lang, 'semibold') }]}>
          {t('about.version', { version })}
        </Text>

        <View style={styles.card}>
          <Text style={[styles.manifestoTitle, { fontFamily: font(lang, 'bold') }]}>
            {t('about.manifestoTitle')}
          </Text>
          <Text style={[styles.manifesto, { fontFamily: font(lang, 'regular') }]}>
            {t('about.manifesto')}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
          onPress={() => {
            haptics.selection();
            Linking.openURL(REPO_URL);
          }}
        >
          <Ionicons name="logo-github" size={20} color={theme.colors.inkSoft} />
          <Text style={[styles.linkText, { fontFamily: font(lang, 'semibold') }]}>
            {t('about.sourceCode')}
          </Text>
          <Ionicons name="open-outline" size={14} color={theme.colors.inkFaint} />
        </Pressable>

        <Text style={[styles.credits, { fontFamily: font(lang, 'regular') }]}>
          {t('about.credits')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  logo: {
    width: 96,
    height: 96,
  },
  name: {
    fontSize: 28,
    letterSpacing: -0.6,
    color: theme.colors.ink,
    marginTop: theme.spacing.md,
  },
  version: {
    fontSize: 12,
    color: theme.colors.inkFaint,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  manifestoTitle: {
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
    textAlign: 'left',
  },
  manifesto: {
    fontSize: 14,
    lineHeight: 23,
    color: theme.colors.inkSoft,
    textAlign: 'left',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  linkText: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
  credits: {
    fontSize: 11,
    lineHeight: 18,
    color: theme.colors.inkFaint,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
