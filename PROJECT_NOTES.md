# AM Investments mobile app

## Confirmed requirements

- Website: https://www.aminvestmentswv.com.
- Properties are offered for sale only.
- Provide distinct Available, Under Contract, and Sold sections.
- Do not invent property addresses, prices, photos, company contact details, or website integration endpoints.
- Under Contract and Sold properties must not offer actions suggesting that they are available to purchase.

## Current source access

Both aminvestmentswv.com and www.aminvestmentswv.com now return HTTP 200, with the
root redirecting to www. The actual homepage, property archive, filtered sale
archive, and property details were retrieved successfully. The official company
telephone number is (304) 250-9336, verified on the homepage and property pages.

Property photos use image-cdn.carrot.com. Full downloads and image decoding passed
for eleven representative photos, including all seven photos for the three
available properties. The actual cards and galleries rendered in Chromium with
TLS verification enabled. Chromium needs writable access to its existing NSS
certificate database in this cloud sandbox. Image-source URLs and alt text are
preserved, and the app has a tested failure fallback. No photos were fabricated
or substituted; the entire sold archive and native devices remain unverified.

The connected GitHub repository was empty when inspected. No previous mobile
app code or project-specific build instructions were available in this checkout.

## Listing integration

### Coming Soon source of truth — October 18, 2026

The owner confirmed that https://www.aminvestmentswv.com/coming-soon-properties/
controls the app's Coming Soon section. The importer now reads that public page
on each existing hourly refresh, preserving its order, addresses, cities,
renovation descriptions, before-renovation photos and missing-photo state. It
replaces archive Coming Soon records and deduplicates matching addresses. Changes
to `main` also run the existing verified publication workflow. No additional
monitoring schedule was created.

The live page lists 2810 Washington Avenue (St. Albans), 859 Hanna Drive
(Charleston), 2802 Chesterfield Avenue (Charleston), 1016 Cove Way (South
Charleston), 107 Bel-Aire Drive (Tornado), and 204 Monarch Drive (Charleston).
All are renovation projects, with five photos and no published prices or dates.
859 Hanna Drive has no published photo. Recheck the source on future updates;
this dated list is evidence, not a permanent property roster.

The verified, bundled inventory is src/data/properties.json. It contains 173
for-sale records from 17 sale-filtered archive pages, their detail pages, and the
dedicated Coming Soon page: 4 Available, 6 Coming Soon, and 163 Sold at the latest
manual import. Each record retains its source URL
and source status; the snapshot retains its import timestamp and archive URLs.
The app presents the snapshot date and asks buyers to confirm availability.

Run npm run sync:properties to rebuild this snapshot from the public website.
The importer preserves terms=sale on pagination, rejects unknown statuses and
terms, and writes atomically after successful completion. Twelve legacy records
have incomplete structured addresses; the exact source titles are displayed
instead, with an explicit incomplete-location note. Missing prices and property
facts are not supplied by inference.

The public wp-json root returns an empty routes list. The RSS feed exposes only
the latest ten properties and lacks complete inventory/status data. The importer
therefore parses verified public HTML at build time. No authenticated editor,
website changes, scraping proxy, or fabricated API endpoint has been used.
The Under Contract section is populated only
from explicit matching source badges; the latest refresh includes one such listing.

The hourly GitHub Actions workflow now refreshes a working snapshot, validates it
and the active-property photos, and publishes the verified web export to the
existing Pages branch followed by an explicit Pages build. It leaves the last successful deployment in place on failure and
does not add hourly source commits. Native installed apps are outside this web
publication schedule.

## Implemented and validated

- Search by address, city, state, or ZIP within the selected status.
- In-app details, original listing links, and photo navigation with failure states.
- Verified company call action for available properties only. Sold and Under
  Contract details direct buyers to the Available collection.
- Progressive loading for the sold archive and clear search/empty states.
- Fifteen unit/importer tests and real browser interaction checks at four widths.
- TypeScript checking and iOS, Android, and web bundle exports.
- Actual remote photo rendering is verified for the available-property collection.
- Native device/simulator behavior is not yet verified.
