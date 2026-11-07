#!/usr/bin/env bash
set -euo pipefail
[[ $(uname -s) == Darwin ]] || { echo 'Requires macOS and Xcode'; exit 2; }
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]]
[[ "${GITHUB_REPOSITORY:-}" == aminvestmentswv-ux/app && "${GITHUB_REF:-}" == refs/heads/test/native-live-feed-2026-11-07 ]]
[[ "${AM_TEST_IOS_BUNDLE_ID:-}" == com.aminvestments.nativeqatest ]]
mkdir -p test-results/ios
xcodebuild -version | tee test-results/ios/xcode.txt
xcodebuild -version | python3 -c 'import re,sys; m=re.search(r"Xcode (\d+)\.(\d+)",sys.stdin.read()); assert m and tuple(map(int,m.groups())) >= (26,4)'
xcrun simctl list -j > test-results/ios/simulators.json
# Choose installed iPhone runtime/device; no downloading runtimes or accepting licenses.
SIMULATOR_UDID=$(python3 - <<'PY'
import json
j=json.load(open('test-results/ios/simulators.json'))
valid={x['identifier'] for x in j['runtimes'] if x.get('isAvailable') and x.get('name','').startswith('iOS')}
d=[x for r,ds in j['devices'].items() if r in valid for x in ds if x.get('isAvailable') and x['name'].startswith('iPhone')]
assert d, 'No installed available iPhone simulator'
print(d[0]['udid'])
PY
)
export SIMULATOR_UDID
npm run typecheck
npm test
node scripts/refresh_native_qa_snapshot.mjs
node scripts/prepare_native_qa.mjs --platform ios
node --input-type=module <<'JS'
import fs from 'node:fs';
const snapshot=JSON.parse(fs.readFileSync('test-results/native-live-snapshot.json'));
const p=snapshot.properties.find(p=>p.status==='available' && p.images?.length>=2);
if(!p) throw Error('Need available multi-photo property');
fs.writeFileSync('test-results/ios/fixture.json',JSON.stringify({checkedAt:snapshot.checkedAt,count:snapshot.properties.length,address:p.address,photoCount:p.images.length},null,2));
const swift=s=>JSON.stringify(s).replace(/\\u([0-9a-fA-F]{4})/g,'\\u{$1}');
fs.writeFileSync('scripts/ios-test-config.swift',`let qaAddress = ${swift(p.address)}\nlet qaPhotoCount = ${p.images.length}\n`);
JS
# Keep all test-only modifications in the ephemeral checkout and record them.
git diff -- app.json App.tsx index.ts > test-results/ios/test-only-injection.patch
npm run typecheck
./node_modules/.bin/expo prebuild --platform ios --no-install
(cd ios && pod install)
ruby scripts/ios-prepare-tests.rb
WORKSPACE=$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)
[[ -n "$WORKSPACE" ]]
STATE=$(xcrun simctl list devices -j | python3 -c 'import json,os,sys; print(next(d["state"] for ds in json.load(sys.stdin)["devices"].values() for d in ds if d["udid"]==os.environ["SIMULATOR_UDID"]))')
if [[ "$STATE" != Booted ]]; then xcrun simctl boot "$SIMULATOR_UDID"; fi
xcrun simctl bootstatus "$SIMULATOR_UDID" -b
xcodebuild -workspace "$WORKSPACE" -scheme AMNativeQA -configuration Release \
  -destination "platform=iOS Simulator,id=$SIMULATOR_UDID" -derivedDataPath "$RUNNER_TEMP/am-ios-derived" \
  -resultBundlePath test-results/ios/acceptance.xcresult \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO test 2>&1 | tee test-results/ios/xcode-test.log
xcrun simctl io "$SIMULATOR_UDID" screenshot test-results/ios/final.png
python3 - <<'PYHASH'
import hashlib, pathlib, plistlib
root=pathlib.Path(__import__('os').environ['RUNNER_TEMP'])/'am-ios-derived/Build/Products/Release-iphonesimulator'
found=False
with open('test-results/ios/app-hash.txt','w') as out:
 for app in root.glob('*.app'):
  info=plistlib.loads((app/'Info.plist').read_bytes())
  if info.get('CFBundleIdentifier')=='com.aminvestments.nativeqatest':
   binary=app/info['CFBundleExecutable']; out.write(hashlib.sha256(binary.read_bytes()).hexdigest()+' '+binary.name+'\n'); found=True
assert found, 'Expected test app executable not found'
PYHASH
