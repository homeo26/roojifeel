/**
 * Config plugin: align androidx.work artifacts.
 *
 * expo-widgets/@expo/ui pulls androidx.work:work-runtime:2.8.1 while
 * another dependency pins work-runtime-ktx:2.7.1, which trips
 * checkReleaseDuplicateClasses (both ship the same Kt classes). Forcing
 * the ktx artifact to the same version resolves the duplicate classes.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withWorkManagerAlignment(config) {
  return withAppBuildGradle(config, (cfg) => {
    const marker = 'androidx.work:work-runtime-ktx';
    if (!cfg.modResults.contents.includes(marker)) {
      cfg.modResults.contents += `

// Added by plugins/withWorkManagerAlignment.js — align androidx.work versions
dependencies {
    implementation("androidx.work:work-runtime-ktx:2.8.1")
}
`;
    }
    return cfg;
  });
};
