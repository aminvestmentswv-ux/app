# AM Investments mobile app

An Expo / React Native app for browsing **for-sale properties**, with separate
**Available**, **Coming Soon**, **Under Contract**, and **Sold** sections. Targets iOS, Android, and
web from the same TypeScript app.

## Current state

The app includes 173 verified for-sale property records from the official website:
4 Available, 6 Coming Soon, and 163 Sold at the latest manual import. It supports
address/city search, in-app property details, photo galleries, source listing
links, and a call action for available properties. The sold archive loads in
batches. Counts and empty sections come from the saved inventory.

Every property detail page has a **Property details** section for Bedrooms,
Bathrooms and Square footage, plus an always-visible **Description** heading.
Values and descriptions come from the website during the existing hourly refresh.
Unpublished figures show **Not published**; missing descriptions show a clear
message. Explicit structured figures on Coming Soon cards are also imported when
the website publishes them. Measurements for separate homes are not combined or
inferred from prose.

This is a **dated, bundled website snapshot**, not a live feed. The import time is
visible in the app, and availability must be confirmed with AM Investments.
Unknown prices and property facts are omitted. Twelve older records have no
complete structured location; their exact published titles are retained and the
missing location is disclosed.

Public website and property-photo access have been verified. Eleven representative
photos were downloaded and decoded, and all seven photos for the three available
properties were checked in a real browser. The app handles image failure with a
clearly labeled fallback. The company logo is bundled locally, so it does not
depend on an external image request. Network settings retain the Package managers
preset and the official website, photo, GitHub API, and Pages domains.

See [PROJECT_NOTES.md](PROJECT_NOTES.md) for source verification and limitations.

## Company branding and mobile web preview

The app uses the official A&M Investments logo from the company website, with
navy blue (`#133c7a`) and gold (`#e0ad2d`) sampled from that logo and selected by
the user. See [assets/README.md](assets/README.md) for the original asset source.

Public mobile app: https://app.aminvestmentswv.com/

The **Save to your Home Screen** section above the property search expands to
show iPhone/Safari and Android/Chrome steps, including guidance for visitors who
open the app inside Facebook or another app's browser. It is shown on the web
version; native apps are already installed. It explains the browser's own Add to
Home Screen action and does not promise offline access or automatic installation.

The home page's **Share app** button and each property's **Share this property**
button offer email, text, Facebook, WhatsApp, X, and a copyable link. Supported
devices also offer their system share menu through **More sharing options**.
Property links use the permanent domain with a `property` query parameter so
they load directly on GitHub Pages, survive a reload, and retain the property's
current availability status. Removed listings lead to a helpful message and the
current inventory. The app opens a composer or share menu; the user chooses the
recipient and confirms sending. It does not send messages automatically.

In a property's detail gallery, swipe left/right (or drag with a mouse) to change
photos. Vertical gestures still scroll the page. Previous/Next buttons remain
available for keyboard access and as an alternative to swiping.

Property details include an embedded Google map on the web and an **Open in
Google Maps** action (also available on native). Maps use the complete published
street address, city, state and postal code where present. Incomplete addresses
show an explanation instead of a guessed map. No Maps API key is required.

GoDaddy DNS uses CNAME Name `app`, Value `aminvestmentswv-ux.github.io`, with
the default TTL. GitHub Pages has the custom domain configured, its certificate
is approved, and Enforce HTTPS is enabled. Keep the apex, `www`, and mail records
unchanged. The original https://aminvestmentswv-ux.github.io/app/ address is the
legacy Pages address. Share the custom-domain HTTPS link above.

`scripts/pages_address.py` reads the currently activated Pages domain before each
build. Until activation it keeps the existing `/app/` preview working. After
activation it builds at `/`, writes the domain's `CNAME` into every deployment,
and retains it during hourly updates. An unexpected domain or a domain change
during a build blocks publication. Never publish a root export to the preview
address or activate a custom domain before its DNS record is ready.

GitHub Pages is published by the `Hourly property refresh` GitHub Actions workflow.
The workflow selects the active address automatically. For a manual custom-domain
build, use the domain root without changing local/native defaults:

```sh
AM_APP_WEB_BASE_PATH= npm run build:web -- --output-dir web-build --max-workers 2
AM_APP_WEB_DOMAIN=app.aminvestmentswv.com AM_APP_WEB_BASE_PATH= python3 scripts/pages_address.py --web-dir web-build
AM_APP_WEB_DOMAIN=app.aminvestmentswv.com AM_APP_WEB_BASE_PATH= python3 scripts/verify_refresh.py --web-dir web-build
```

`app.config.ts` applies that base path only when the build environment variable is
set. Publish the contents of `web-build/`, including `assets/`, `CNAME`, and
`.nojekyll`. The `/app` build is only for an explicitly reactivated legacy Pages
address; it breaks root assets on the custom domain. Verify the public
logo, JavaScript, and property photos after deployment. The earlier `gh-pages`
branch is retained as deployment history; the workflow publishes verified Pages
exports to that preview branch, preserving its previous commits. It does not push
bot commits into the source branch. The explicit Pages rebuild is necessary
because pushes made with GitHub Actions' token do not trigger a Pages build.

## Hourly automatic updates

`.github/workflows/hourly-refresh.yml` runs after source updates to `main`, at minute 17 of every hour, and can also
be started with **Run workflow** in GitHub Actions. GitHub schedules are best
effort and can be delayed. Public repositories can have schedules disabled after
60 days without repository activity; monitor the workflow and re-enable it in
GitHub Actions if GitHub pauses it.

Each run reads all sale-filtered archive pages, property details, and the dedicated
[Coming Soon page](https://www.aminvestmentswv.com/coming-soon-properties/), validates the
inventory, runs the type check and tests, builds for the active Pages address, checks the
bundled logo, and downloads/decodes all photos for Available, Coming Soon, and Under Contract
listings. Pillow is pinned in `.github/requirements-refresh.txt` for these CI-only
image checks. Publication starts only after every check passes; a failed run
leaves the last successful site available. No paid service or new secret is needed.

The workflow refreshes its own working copy and publishes the resulting web app;
it does not commit an hourly snapshot into `main`. The refresh date shown in the
app records the successful website import. Reopen or refresh a page that has been
left open to load the latest published version. Availability still requires
confirmation with AM Investments.

Workflow runs: https://github.com/aminvestmentswv-ux/app/actions/workflows/hourly-refresh.yml

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

The website is the source of truth for the app's Coming Soon section. Each refresh
replaces that section with the dedicated Coming Soon page's properties, in website
order, using its published addresses, cities, renovation descriptions and photos.
The source page explains that the photos show the homes before renovation. Missing
photos, prices, availability dates and property facts are not invented. Published
photos use the website's Carrot image service at mobile-friendly dimensions;
each image retains its original source URL. This avoids errors from oversized
original images without substituting a different photograph. Matching
archive records are deduplicated by address, city and state; obsolete archive
Coming Soon records do not remain in this section. Invalid or unavailable source
pages leave the last successful snapshot and publication intact.

Carrot's public `/wp-json/` currently exposes no routes, and its property RSS feed
contains only the latest ten entries without complete listing fields. The app
does not rely on an invented API or on browser cross-origin access to HTML. Run
the import explicitly when updating local inventory, then rebuild the app. The
GitHub Actions schedule performs these steps automatically for the public web app;
no separate application backend is required.

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
development server and verify that the app's JavaScript bundle loads. The public
preview is hosted separately on GitHub Pages. Offline mode avoids optional Expo service requests; it
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
