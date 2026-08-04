/**
 * Custom entry point: boots expo-router and registers the Android
 * home-screen widget task handler (headless renderer).
 */
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/RoojifeelWidget');
  registerWidgetTaskHandler(widgetTaskHandler);
}
