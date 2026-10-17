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

Property photos use image-cdn.carrot.com. Proxy access to that domain remains
blocked in this session; its allowlist addition is saved for environment review.
Image-source URLs and alt text are preserved, and the app has a tested failure
fallback. Photo gallery navigation is tested; remote photo rendering is pending
network access. No photos were fabricated or substituted.

The connected GitHub repository was empty when inspected. No previous mobile
app code or project-specific build instructions were available in this checkout.

## Listing integration

The verified, bundled inventory is src/data/properties.json. It contains 166
for-sale records from 17 sale-filtered archive pages and their detail pages:
3 Available, 0 Under Contract, and 163 Sold. Each record retains its source URL
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
website changes, scraping proxy, fabricated API endpoint, live backend, or
scheduled refresh has been used. The Under Contract section remains present and
honestly empty until the source has records with explicit matching status.

## Implemented and validated

- Search by address, city, state, or ZIP within the selected status.
- In-app details, original listing links, and photo navigation with failure states.
- Verified company call action for available properties only. Sold and Under
  Contract details direct buyers to the Available collection.
- Progressive loading for the sold archive and clear search/empty states.
- Fifteen unit/importer tests and real browser interaction checks at four widths.
- TypeScript checking and iOS, Android, and web bundle exports.
- Native device/simulator behavior and remote photo rendering are not yet verified.
