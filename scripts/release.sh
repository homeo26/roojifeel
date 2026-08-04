#!/usr/bin/env bash
# Roojifeel release builder.
# Produces three versioned artifacts in ./release-out:
#   Roojifeel-vX.Y.Z.apk            — slim arm64-v8a (recommended)
#   Roojifeel-vX.Y.Z-universal.apk  — all ABIs (old 32-bit devices, emulators)
#   Roojifeel-vX.Y.Z.ipa            — unsigned iOS device build (sideload)
#
# Usage:  ./scripts/release.sh
# Then:   gh release create vX.Y.Z release-out/* --title "..." --notes "..."
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./app.json').expo.version")
OUT="release-out"
echo "==> Building Roojifeel v${VERSION}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

echo "==> Prebuild (both platforms)"
npx expo prebuild --no-install >/dev/null
(cd ios && pod install >/dev/null)

rm -rf "$OUT" && mkdir -p "$OUT"

echo "==> Android slim APK (arm64-v8a)"
(cd android && ./gradlew assembleRelease -q)
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/Roojifeel-v${VERSION}.apk"

echo "==> Android universal APK (all ABIs)"
(cd android && ./gradlew assembleRelease -q \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64)
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/Roojifeel-v${VERSION}-universal.apk"

echo "==> iOS unsigned device IPA"
DERIVED="/tmp/roojifeel-release-derived"
(cd ios && xcodebuild -workspace Roojifeel.xcworkspace -scheme Roojifeel \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED" build CODE_SIGNING_ALLOWED=NO >/dev/null)
STAGE=$(mktemp -d)
mkdir -p "$STAGE/Payload"
cp -R "$DERIVED/Build/Products/Release-iphoneos/Roojifeel.app" "$STAGE/Payload/"
(cd "$STAGE" && zip -qr ipa.zip Payload)
mv "$STAGE/ipa.zip" "$OUT/Roojifeel-v${VERSION}.ipa"
rm -rf "$STAGE"

echo "==> Done:"
ls -lh "$OUT"
