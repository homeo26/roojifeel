/**
 * Config plugin: build Android native libraries for arm64-v8a only.
 *
 * The default template compiles every ABI (armeabi-v7a, arm64-v8a, x86,
 * x86_64), quadrupling the native-library payload of the APK. Virtually all
 * physical Android devices since ~2015 are arm64-v8a; x86 variants exist
 * only for emulators. This survives `expo prebuild` regeneration.
 */
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === 'property' && p.key === 'reactNativeArchitectures',
    );
    if (existing) {
      existing.value = 'arm64-v8a';
    } else {
      props.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' });
    }
    return cfg;
  });
};
