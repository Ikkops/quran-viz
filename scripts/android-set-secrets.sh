#!/usr/bin/env bash
# Upload the Android release signing key to this repo's GitHub Actions secrets.
# The key lives outside the repo in ~/.config/quran-viz-android/ — back it up:
# if it is lost, the tablet will refuse updates signed with a new key.
set -euo pipefail
d="${QURAN_VIZ_KEY_DIR:-$HOME/.config/quran-viz-android}"
# shellcheck source=/dev/null
. "$d/secrets.env"
base64 -w0 "$d/release.jks" | gh secret set ANDROID_KEYSTORE_BASE64
printf %s "$ANDROID_KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD
printf %s "$ANDROID_KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD
printf %s "$ANDROID_KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS
gh secret list
