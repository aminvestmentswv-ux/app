# AM Investments Property App — Rules and Working Guide

Compiled October 18, 2026, America/New_York. Newer explicit owner instructions
override older rules. Live property facts must always be rechecked.

## Find the right project

| Resource | Canonical location |
| --- | --- |
| Public property app | https://app.aminvestmentswv.com/ |
| Website supplying property information | https://www.aminvestmentswv.com/ |
| Authoritative Coming Soon collection | https://www.aminvestmentswv.com/coming-soon-properties/ |
| App source code | https://github.com/aminvestmentswv-ux/app |
| Saved ChatGPT project guide | https://chatgpt.com/space/page_6ad5790192448191bd458c0dd106b1aa |
| Existing publication workflow | https://github.com/aminvestmentswv-ux/app/actions/workflows/hourly-refresh.yml |

The Sites-based AM Investments Foreclosure Desk is a different application.
webuycharlestonwvhouses.com is the separate seller-acquisition website. Do not
change either while working on this app. The legacy address is
https://aminvestmentswv-ux.github.io/app/; share the custom-domain app link.

## Standing property and source rules

1. **The website is the source for the app.** The owner explicitly selected this
   direction. Do not make the website match app data or silently substitute guesses
   or unrelated third-party listings.
2. Show for-sale properties in distinct **Available, Coming Soon, Under Contract,
   and Sold** sections. Exclude rentals and unsupported terms. Use verified source
   badges; generic Unavailable does not establish a contract.
3. Match Coming Soon to the dedicated website page, preserving property order,
   addresses, cities, descriptions and matching photographs. Remove stale Coming
   Soon entries and deduplicate matching address/city/state records across sources.
   A historical roster or count is not a permanent rule.
4. Every property detail page shows **Bedrooms, Bathrooms, Square footage, and
   Description**. Import explicit structured figures and published descriptions
   during each refresh, including Coming Soon figures when supplied. Preserve
   fractional bathrooms and readable square-footage formatting.
5. Missing figures show **Not published**; missing descriptions get a clear
   message. Never invent addresses, ZIP codes, features, prices, dates, figures,
   contact information or integration endpoints. Preserve exact published titles
   and disclose incomplete locations instead of guessing an address.
6. Keep separate homes' measurements distinct. Do not combine bedroom/bathroom
   totals or floor areas from multiple buildings based on prose.
7. Use authentic matching property photographs. Preserve Coming Soon's
   before-renovation labels and renovation-in-progress descriptions. Missing photos
   receive clear fallbacks, never stock or generated substitutes. Preserve the
   website's deliberate photo removals.
8. Do not append a default listing agent. Preserve verified property-specific
   attribution published on the website. Researching and correcting website facts
   belongs to the companion property-website workflow, not an app-side guess.
9. Treat owner status corrections as dated, property-specific instructions.
   Preserve the existing guarded override mechanism when applicable; an old
   correction must not change a later Sold property back to Available.

## Existing product conventions to preserve

- Use the official A&M Investments logo and existing navy (`#133c7a`) and gold
  (`#e0ad2d`) branding. Keep mobile layouts readable, controls accessible, and
  touch targets usable.
- Preserve address/city search, status tabs/counts, progressive Sold loading,
  property details, original-listing links, gallery swipe/drag and Previous/Next
  controls. Vertical gestures should continue scrolling.
- Maps use the published complete address. Incomplete locations receive an
  explanation instead of a guessed map. Preserve Open in Google Maps.
- Retain Share app and Share this property, stable property query links,
  reload/back behavior, and a helpful message for removed properties. Sharing
  opens the user's composer/share menu; it does not send automatically.
- Keep the web-only **Save to your Home Screen** guide above property search,
  with expandable iPhone/Safari and Android/Chrome steps and help for in-app
  browsers. Do not promise offline availability or automatic installation.
- The company call button is currently restricted to **Coming Soon** details,
  using the verified number **(304) 250-9336**. Do not restore the old Available-only
  call behavior from outdated notes. Under Contract and Sold pages must not imply
  that those properties are available to purchase.
- Retain the website-check timestamp and availability-confirmation note.
  User-facing dates and schedules use America/New_York.

## Refreshing, validation and publishing

### Requested notification preferences

The owner requested four user-selectable property notification preferences:
**Available**, **Coming Soon**, **Both**, and **None**. **Both** is the default.
Remember a user's explicit choice; None opts out of property notifications.
Selecting the default is not itself permission to send push notifications: users
must explicitly enable notifications and grant their browser/device permission.
The controls and optional OneSignal integration are implemented. The owner has
no notification service yet; actual enrollment, credentials and device delivery
remain pending. Never describe saved preferences as active push delivery.
See [the setup guide](https://github.com/aminvestmentswv-ux/app/blob/main/docs/PUSH_NOTIFICATIONS.md). Newly added properties and changes
into selected statuses are the prepared delivery triggers; unchanged hourly
refreshes do not resend listings. Initial service setup establishes a baseline
without sending the existing inventory.

### Existing refresh and publication behavior

- The Expo/React Native app uses a dated bundled snapshot at
  `src/data/properties.json`. `scripts/sync_properties.py` reads sale-filtered
  archive pages, property details and the Coming Soon page; retains source URLs
  and statuses; and writes atomically only after successful collection.
- The existing GitHub workflow runs at minute 17 hourly, after pushes to `main`,
  and on manual dispatch. Scheduled runs can be delayed. A saved instruction is
  not proof of an active new automation.
- The workflow validates inventory/code, builds for the active Pages address,
  and verifies the logo and all Available, Coming Soon and Under Contract photos
  before publication. Failure leaves the last successful app in place. Never
  disable checks simply to get a deployment through.
- Coming Soon photos use the website's responsive Carrot image service, retaining
  original URLs as provenance. The current 1152-pixel WebP transform delivers the
  same source photos and avoids errors from oversized originals.
- Preserve the active custom domain, HTTPS and `CNAME`. `scripts/pages_address.py`
  selects the root or legacy `/app` build base. Do not change the apex website,
  `www`, mail records or unrelated DNS settings.
- Fetch and inspect the current repository before editing; preserve unrelated
  work. Check changes proportionately: product/importer edits need relevant tests,
  type checking and a web build. Use the established publication workflow for
  authorized app changes and verify the deployment and representative live pages.
  Report actual access or verification limits accurately.
- Keep credentials and private records out of code, guides, logs and Page content.
  Distinguish prepared, saved, published, verified and pending work.

## Companion website rules and native-store plans

The separate personal skill **am-investments-property-website** governs editing
aminvestmentswv.com. It retains upstream address, MLS/Zillow description,
verified-agent, Dropbox-photo and public-verification rules. Its saved daily
maintenance and Gmail-sale-evidence instructions are website workflows, not app
schedules. Do not claim they are active without checking their own setup.

Apple App Store and Google Play distribution has been discussed but not
implemented or submitted. It still needs company-owned developer accounts,
signed builds, listing assets, privacy disclosures, native-device testing and a
fresh-inventory strategy for installed apps. The hourly web publication does not
update installed native builds. Recheck current store requirements and fees;
prior advice is not approval or proof of developer-account enrollment.

## Retain future decisions

Read this guide and the README when resuming work. When the owner confirms new
rules, update this file and the linked ChatGPT Space, keeping scope and precedence
clear. Put dated release facts and limitations in PROJECT_NOTES.md. Do not claim
a globally installed skill or automatic loading in unrelated chats. Open the saved
Space or provide its link in a new chat and ask to use this guide. Root AGENTS.md
directs coding agents in this checkout to the repository copy.
