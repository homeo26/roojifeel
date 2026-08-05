/**
 * Lets any tab screen switch the pager page (replaces router.navigate
 * between tabs now that tabs live inside a PagerView).
 */
import { createContext, useContext } from 'react';

export type TabName = 'home' | 'history' | 'stats' | 'settings';

export const TabPagerContext = createContext<{ goToTab: (tab: TabName) => void }>({
  goToTab: () => {},
});

export const useTabPager = () => useContext(TabPagerContext);
