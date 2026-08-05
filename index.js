/**
 * Custom entry point.
 * Order matters: the theme mode is applied BEFORE expo-router loads the
 * app (screen StyleSheets capture colors at import time), then the router
 * boots, then the Android widget task handler registers.
 */
const { bootTheme } = require('./src/themeBoot');
bootTheme();

require('expo-router/entry');

const { Platform } = require('react-native');
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/RoojifeelWidget');
  registerWidgetTaskHandler(widgetTaskHandler);
}
