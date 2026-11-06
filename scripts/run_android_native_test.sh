#!/usr/bin/env bash
set -euo pipefail

# Only an ephemeral GitHub-hosted test runner is supported by this harness.
test "${GITHUB_ACTIONS:-}" = true
test "${RUNNER_ENVIRONMENT:-}" = github-hosted
test "${AM_TEST_PACKAGE:-}" = com.aminvestments.nativeqatest
mkdir -p test-results/android
export ANDROID_SERIAL=emulator-5554
export ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-$HOME/.android/avd}"

# Use the runner's existing KVM access. If its user cannot access KVM, run only
# this disposable emulator under the runner's existing sudo privilege. Do not
# change KVM/udev permissions, groups, OS security settings or network settings.
emu=("$ANDROID_HOME/emulator/emulator" -avd am_native_qa -port 5554 -no-window
  -no-audio -no-boot-anim -no-snapshot -gpu swiftshader -camera-back none
  -camera-front none -memory 2048 -cores 2 -accel on)
if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  "${emu[@]}" >test-results/android/emulator.log 2>&1 &
else
  sudo -n env ANDROID_AVD_HOME="$ANDROID_AVD_HOME" ANDROID_HOME="$ANDROID_HOME" "${emu[@]}" >test-results/android/emulator.log 2>&1 &
fi
printf '%s\n' "$!" >/tmp/am-native-emulator.pid

adb start-server
deadline=$((SECONDS + 420))
while [ "$SECONDS" -lt "$deadline" ]; do
  boot="$(adb -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [ "$boot" = 1 ] && break
  sleep 5
done
test "${boot:-}" = 1 || { tail -80 test-results/android/emulator.log; echo 'Android emulator did not boot within seven minutes'; exit 1; }
adb -s "$ANDROID_SERIAL" shell input keyevent 82
adb -s "$ANDROID_SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
def prop(name):
    return subprocess.check_output(['adb', '-s', os.environ['ANDROID_SERIAL'], 'shell', 'getprop', name], text=True).strip()
Path('test-results/android/environment.json').write_text(json.dumps({
    'commit': os.environ['GITHUB_SHA'], 'branch': os.environ['GITHUB_REF'],
    'package': os.environ['AM_TEST_PACKAGE'], 'device': prop('ro.product.model'),
    'android_release': prop('ro.build.version.release'), 'api': prop('ro.build.version.sdk'),
    'abi': prop('ro.product.cpu.abi'), 'emulator': True,
    'build': 'Release-mode bundled APK with standard test signing; not a store release',
}, indent=2) + '\n')
PY
python3 scripts/android_native_smoke.py
