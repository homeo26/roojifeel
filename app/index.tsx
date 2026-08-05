/**
 * Tab host — a true pager (Instagram-style): all four screens are mounted
 * side by side, swipes track the finger, and you can hold mid-swipe to see
 * two tabs at once. The tab bar drives the pager and vice versa.
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../src/screens/HomeScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { StatsScreen } from '../src/screens/StatsScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { TabPagerContext, TabName } from '../src/screens/TabPagerContext';
import { TabBar } from '../src/components/TabBar';
import { theme } from '../src/theme';

const TAB_ORDER: TabName[] = ['home', 'history', 'stats', 'settings'];

export default function TabsHost() {
  const { t } = useTranslation();
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);

  const goToTab = useCallback((tab: TabName) => {
    const idx = TAB_ORDER.indexOf(tab);
    if (idx >= 0) pagerRef.current?.setPage(idx);
  }, []);

  const labels = [t('tabs.home'), t('tabs.history'), t('tabs.stats'), t('tabs.settings')];

  return (
    <TabPagerContext.Provider value={{ goToTab }}>
      <View style={styles.root}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          offscreenPageLimit={3}
          onPageSelected={(e) => setPage(e.nativeEvent.position)}
        >
          <View key="home" style={styles.page}>
            <HomeScreen />
          </View>
          <View key="history" style={styles.page}>
            <HistoryScreen />
          </View>
          <View key="stats" style={styles.page}>
            <StatsScreen />
          </View>
          <View key="settings" style={styles.page}>
            <SettingsScreen />
          </View>
        </PagerView>
        <TabBar
          tabs={TAB_ORDER}
          labels={labels}
          activeIndex={page}
          onPress={(i) => pagerRef.current?.setPage(i)}
        />
      </View>
    </TabPagerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
