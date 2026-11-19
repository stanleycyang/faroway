const { withAndroidManifest } = require('expo/config-plugins');

function removeOtherEnvironmentLinks(manifest, qa) {
  const excluded = new Set(
    qa ? ['faroway', 'ai.faroway.app'] : ['faroway-qa', 'ai.faroway.app.qa']
  );
  for (const application of manifest.manifest.application ?? []) {
    for (const activity of application.activity ?? []) {
      for (const filter of activity['intent-filter'] ?? []) {
        if (filter.data) {
          filter.data = filter.data.filter((data) => !excluded.has(data.$?.['android:scheme']));
        }
      }
    }
  }
  return manifest;
}

// Expo adds new schemes during incremental prebuild but retains old schemes.
// Remove only Faroway's opposite-environment links, preserving OAuth and HTTPS.
module.exports = function withIsolatedAppLinks(config) {
  const qa = config.android?.package === 'ai.faroway.app.qa';
  return withAndroidManifest(config, (mod) => {
    mod.modResults = removeOtherEnvironmentLinks(mod.modResults, qa);
    return mod;
  });
};
module.exports.removeOtherEnvironmentLinks = removeOtherEnvironmentLinks;
