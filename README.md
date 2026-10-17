# AM Investments mobile app

An Expo / React Native app for browsing **for-sale properties**, with separate
**Available**, **Under Contract**, and **Sold** sections. Targets iOS, Android, and
web from the same TypeScript app.

## Current state

The app includes 166 verified for-sale property records from the official website:
3 Available, 0 Under Contract, and 163 Sold at the time of import. It supports
address/city search, in-app property details, photo galleries, source listing
links, and a call action for available properties. The sold archive loads in
batches. Counts and empty sections come from the saved inventory.

This is a **dated, bundled website snapshot**, not a live feed. The import time is
visible in the app, and availability must be confirmed with AM Investments.
Unknown prices and property facts are omitted. Twelve older records have no
complete structured location; their exact published titles are retained and the
missing location is disclosed.

Public website access works. Property photos come from `image-cdn.carrot.com`;
this cloud session still rejects that host at the proxy. The app handles image
failure with a clearly labeled fallback. Required network additions are saved in
the environment draft; review/save them in environment settings and publish to
enable photo verification. The package registry (`registry.npmjs.org`) is also
included for repeatable dependency installation. Existing AM website domains are
preserved.

See [PROJECT_NOTES.md](PROJECT_NOTES.md) for source verification and limitations.

## Refresh the property inventory

```sh
cd /workspace/app
npm run sync:properties
npm run typecheck
npm test
npm run build
```

The importer uses Python 3 and curl, preserves TLS verification, and requests only
public pages from the official site. It follows all sale-filtered archive pages
with the `terms=sale` query retained, verifies each detail page, and writes
`src/data/properties.json` only after the complete import succeeds. A failed request
or unknown status leaves the last successful inventory intact. Known non-sale
terms are excluded; missing/unknown terms cause an error. Status mapping comes
from explicit property-header badges: For Sale → Available, Under Contract or
Pending → Under Contract, Sold → Sold. Generic Unavailable is never guessed to
mean Under Contract.

Carrot's public `/wp-json/` currently exposes no routes, and its property RSS feed
contains only the latest ten entries without complete listing fields. The app
does not rely on an invented API or on browser cross-origin access to HTML. Run
the import explicitly when updating inventory, then rebuild the app. No automatic
refresh service, scheduler, or remote backend has been deployed.

## Development

Use Node.js 24.3 or newer in the Node 24 release line; this environment was tested
with Node 24.19.0 and npm 11.9.0. Install the locked dependencies:

```sh
cd /workspace/app
npm ci --no-audit
```

The checked-in `.npmrc` places npm's cache in a writable temporary directory.
In this cloud environment, initialize writable Expo and tool cache directories
before using Expo commands:

```sh
export EXPO_NO_TELEMETRY=1
export __UNSAFE_EXPO_HOME_DIRECTORY=/tmp/am-investments-expo
export XDG_CACHE_HOME=/tmp/am-investments-cache
```

The Expo home override is a shell-only directory setting; do not put credentials
in project files. No application secrets are required for this initial app.

Start the web development workflow:

```sh
EXPO_OFFLINE=1 BROWSER=none npm run web -- --host localhost --port 8081 --max-workers 2
```

For an internal readiness check, request `/status` and the app page on the
development server and verify that the app's JavaScript bundle loads. No public
preview is configured. Offline mode avoids optional Expo service requests; it
does not prevent the app's website button from opening the official website.

For physical-device development outside this cloud environment, run `npm start`
and use a matching Expo Go client. `npm run ios` requires macOS and an iOS
simulator; `npm run android` requires an Android development setup. Native device
and simulator execution have not been verified here.

## Validation

After the shell initialization above:

```sh
npm run typecheck
npm test
npm run build
npm run test:ui
```

- Eight domain/snapshot tests and seven importer tests exercise status separation,
  rental exclusion, purchase inquiry eligibility, source validation, search,
  numeric parsing, pagination, missing fields, and preservation of the previous
  inventory after a failed import.
- The build exports web JavaScript and iOS/Android Hermes bundles. Successful
  exports do not substitute for testing on native devices.
- Browser checks use the actual imported records at 320, 390, 768, and 1280 pixels:
  status tabs, city/no-results search, details, gallery navigation, source links,
  sold purchase-action suppression, archive pagination, keyboard activation,
  layout overflow, and runtime errors. Image requests are deliberately failed to
  verify the fallback. These checks do not claim successful remote-photo loads or
  place telephone calls.
- UI tests require Chromium. This cloud machine provides `/usr/bin/chromium`;
  elsewhere, set `CHROMIUM_EXECUTABLE_PATH` or install Playwright's Chromium.
- The UI test starts its own local static server, stops it afterward, and saves
  `test-results/mobile.png`. Set `SMOKE_PORT` if port 8765 is occupied.

Cloud tasks already use isolated environments. Work in this checkout; do not
create Git worktrees unless explicitly requested. Live Expo processes must be
restarted in a restored task even when dependencies are retained.
