const { withPodfile } = require('expo/config-plugins');

// GoogleSignIn 9.x pulls in Swift AppCheckCore. CocoaPods' static-library
// integration needs module maps for these two transitive ObjC dependencies.
// Scope the change to those pods; do not change linking for all React Native pods.
module.exports = function withGoogleSignInModules(config) {
  return withPodfile(config, (mod) => {
    const marker = '# Faroway Google Sign-In dependency modules';
    if (mod.modResults.contents.includes(marker)) return mod;
    const anchor = 'use_expo_modules!';
    if (!mod.modResults.contents.includes(anchor)) {
      throw new Error('Cannot configure Google Sign-In modules: Expo Podfile anchor missing.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      `${anchor}\n\n  ${marker}\n  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true`
    );
    return mod;
  });
};
