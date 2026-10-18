import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.sync_properties import (
    BASE, COMING_SOON_URL, apply_owner_overrides, merge_coming_soon,
    parse_archive, parse_coming_soon, parse_detail, sync,
)

URL = BASE + '/property/example-house/'


def fixture(status='For Sale', terms='For Sale', address='123 Test Street<br>Test City, WV 25301', extra=''):
    return f'''<article class="property type-property"><header>
      <h1 class="property-title">Example House <span class="badge">{status}</span></h1>
      </header><div class="property-images"><div class="slider-for">
      <img src="https://image-cdn.carrot.com/uploads/example.webp" alt="Example exterior">
      </div></div><div class="property-content"><p>A published description.</p></div>
      <dl><dt>Address:</dt><dd>{address}</dd><dt>Terms:</dt><dd>{terms}</dd>{extra}</dl>
      </article>'''


def upcoming_card(address='2810 Washington Avenue', city='St. Albans, WV',
                  status='COMING SOON', image=True):
    photo = ('<img src="https://image-cdn.carrot.com/uploads/washington.jpeg" '
             'alt="Front exterior before renovation">') if image else (
             '<div>Front exterior photo coming soon</div>')
    return f'''<article>{photo}<div><p>{status}</p><h2>{address}</h2>
      <p>{city}</p><p>Renovation in progress.</p></div></article>'''


def upcoming_page(cards=None):
    if cards is None:
        cards = upcoming_card() + upcoming_card('859 Hanna Drive', 'Charleston, WV', image=False)
    return f'''<section aria-labelledby="upcoming-homes">
      <h1 id="upcoming-homes">Coming Soon Properties</h1>
      <p>Our upcoming renovation projects are under construction. Photos show the homes before renovation.
      Updated photos, pricing and availability will be posted when confirmed.</p>
      <div class="row">{cards}</div></section>'''


class ImportTests(unittest.TestCase):
    def test_hourly_import_retains_jonquil_owner_correction(self):
        url = BASE + '/property/4900-4904-jonquil-drive-charleston-wv/'
        archive = f'<article class="type-property"><a href="{url}">Jonquil</a></article>'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            def fetch_page(url, cache):
                if url == COMING_SOON_URL:
                    return upcoming_page()
                return archive if url.endswith('?terms=sale') else fixture(status='Pending')
            with patch('scripts.sync_properties.fetch', side_effect=fetch_page):
                sync(output)
                sync(output)
            property = json.loads(output.read_text())['properties'][0]
            self.assertEqual(property['status'], 'available')
            self.assertEqual(property['sourceStatus'], 'pending')
            self.assertEqual(property['statusOverride']['confirmedOn'], '2026-10-18')

    def test_owner_correction_does_not_override_future_sold_or_other_properties(self):
        for status in ['Sold', 'For Sale']:
            property = parse_detail(fixture(status), BASE + '/property/4900-4904-jonquil-drive-charleston-wv/')
            original = property.copy()
            self.assertEqual(apply_owner_overrides([property]), [original])
        other = parse_detail(fixture('Pending'), URL)
        original = other.copy()
        self.assertEqual(apply_owner_overrides([other]), [original])

    def test_owner_correction_removes_outdated_pending_description(self):
        property = parse_detail(fixture('Pending'), BASE + '/property/4900-4904-jonquil-drive-charleston-wv/')
        property['description'] = 'Listed price: $74,900. Zillow currently shows the property as pending. Contact Marie to confirm contract status and whether backup offers are being accepted.'
        apply_owner_overrides([property])
        self.assertIn('Available, as confirmed by AM Investments', property['description'])
        self.assertNotIn('pending', property['description'])

    def test_explicit_status_mapping(self):
        for raw, expected in [('For Sale', 'available'), ('Coming Soon', 'coming-soon'), ('Sold', 'sold'), ('Under Contract', 'under-contract'), ('Pending', 'under-contract')]:
            with self.subTest(raw=raw):
                result = parse_detail(fixture(raw), URL)
                self.assertEqual(result['status'], expected)
                self.assertEqual(result['address'], '123 Test Street')
                self.assertEqual(result['city'], 'Test City')
                self.assertEqual(result['postalCode'], '25301')

    def test_unknown_or_conflicting_status_never_becomes_available(self):
        for raw in ['Coming Later', '', 'Unavailable', 'Sold</span><span class="badge">For Sale']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_detail(fixture(raw), URL)

    def test_rentals_and_financing_terms_are_excluded(self):
        for terms in ['For Rent', 'Lease Option', 'Owner Finance', 'Assignment of Contract']:
            self.assertIsNone(parse_detail(fixture(terms=terms), URL))
        with self.assertRaises(ValueError):
            parse_detail(fixture(terms=''), URL)

    def test_missing_values_are_not_invented(self):
        for incomplete_address in ['', 'WV']:
            result = parse_detail(fixture(address=incomplete_address), URL)
            self.assertEqual(result['address'], 'Example House')
            self.assertEqual(result['city'], '')
            self.assertTrue(result['locationIncomplete'])
            for key in ['price', 'bedrooms', 'bathrooms', 'squareFeet']:
                self.assertNotIn(key, result)

    def test_price_and_fractional_bathrooms_are_preserved(self):
        result = parse_detail(fixture(extra='<dt>Price:</dt><dd>$190,000.00</dd><dt>Bathrooms:</dt><dd>2.5</dd>'), URL)
        self.assertEqual(result['price'], 190000)
        self.assertEqual(result['bathrooms'], 2.5)

    def test_archive_has_verified_property_and_next_page_urls(self):
        html = f'<link rel="next" href="{BASE}/property/page/2/"><article class="type-property"><a href="{URL}">House</a></article>'
        self.assertEqual(parse_archive(html), ([URL], BASE + '/property/page/2/'))
        with self.assertRaises(ValueError):
            parse_archive(html.replace(URL, 'https://example.com/property/house/'))

    def test_coming_soon_cards_preserve_published_facts_and_missing_photo(self):
        properties = parse_coming_soon(upcoming_page())
        self.assertEqual([(p['address'], p['city'], p['state']) for p in properties], [
            ('2810 Washington Avenue', 'St. Albans', 'WV'),
            ('859 Hanna Drive', 'Charleston', 'WV'),
        ])
        for property in properties:
            self.assertEqual(property['listingType'], 'sale')
            self.assertEqual(property['status'], 'coming-soon')
            self.assertEqual(property['sourceStatus'], 'coming soon')
            self.assertEqual(property['detailsUrl'], COMING_SOON_URL)
            self.assertTrue(property['id'].startswith('coming-soon-'))
            self.assertIn('Photos show the homes before renovation.', property['description'])
            self.assertIn('Renovation in progress.', property['description'])
            for key in ['price', 'bedrooms', 'bathrooms', 'squareFeet', 'postalCode']:
                self.assertNotIn(key, property)
        self.assertEqual(properties[0]['images'], [{
            'url': 'https://image-cdn.carrot.com/uploads/washington.jpeg',
            'alt': 'Front exterior before renovation',
        }])
        self.assertEqual(properties[0]['imageUrl'], properties[0]['images'][0]['url'])
        self.assertEqual(properties[1]['images'], [])
        self.assertNotIn('imageUrl', properties[1])
        self.assertIn('Front exterior photo coming soon', properties[1]['description'])

    def test_coming_soon_ids_survive_page_reordering(self):
        original = parse_coming_soon(upcoming_page())
        reordered = parse_coming_soon(upcoming_page(
            upcoming_card('859 Hanna Drive', 'Charleston, WV', image=False) + upcoming_card()))
        self.assertEqual({p['address']: p['id'] for p in original},
                         {p['address']: p['id'] for p in reordered})

    def test_unrecognized_or_incomplete_coming_soon_page_is_rejected(self):
        valid = upcoming_page()
        for html in [
            '<html><h1>Service unavailable</h1></html>',
            valid.replace('<h1 id="upcoming-homes">Coming Soon Properties</h1>', ''),
            upcoming_page(''),
            upcoming_page(upcoming_card(status='For Sale')),
            upcoming_page(upcoming_card(status='')),
            upcoming_page(upcoming_card(city='WV')),
            upcoming_page(upcoming_card(address='')),
            upcoming_page(upcoming_card().replace('https://image-cdn.carrot.com', 'https://example.com')),
        ]:
            with self.subTest(html=html), self.assertRaises(ValueError):
                parse_coming_soon(html)

    def test_duplicate_coming_soon_address_is_rejected_after_normalization(self):
        cards = upcoming_card() + upcoming_card('  2810   WASHINGTON Avenue  ', 'ST. ALBANS, WV')
        with self.assertRaises(ValueError):
            parse_coming_soon(upcoming_page(cards))

    def test_dedicated_coming_soon_list_replaces_matching_and_stale_archive_records(self):
        matching = parse_detail(fixture(address='2810 WASHINGTON Avenue<br>ST. ALBANS, WV'), URL)
        unrelated = parse_detail(fixture(address='999 Other Street<br>Charleston, WV'),
                                 BASE + '/property/other/')
        stale = parse_detail(fixture('Coming Soon', address='10 Old Street<br>Charleston, WV'),
                             BASE + '/property/old-coming-soon/')
        upcoming = parse_coming_soon(upcoming_page())
        merged = merge_coming_soon([matching, unrelated, stale], upcoming)
        self.assertEqual([p['id'] for p in merged], [unrelated['id']] + [p['id'] for p in upcoming])
        self.assertEqual(merged[1]['status'], 'coming-soon')
        self.assertEqual(matching['status'], 'available', 'Merging must not mutate archive records')

    def test_sync_tracks_dedicated_page_without_double_counting_or_importing_rentals(self):
        links = [BASE + '/property/matching/', BASE + '/property/other/', BASE + '/property/rental/']
        pages = {
            BASE + '/property/?terms=sale': ''.join(
                f'<article class="type-property"><a href="{link}">House</a></article>' for link in links),
            links[0]: fixture(address='2810 Washington Avenue<br>St. Albans, WV'),
            links[1]: fixture(address='999 Other Street<br>Charleston, WV'),
            links[2]: fixture(terms='For Rent'),
            COMING_SOON_URL: upcoming_page(),
        }
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            with patch('scripts.sync_properties.fetch', side_effect=lambda url, cache: pages[url]):
                sync(output)
            snapshot = json.loads(output.read_text())
        self.assertEqual([p['address'] for p in snapshot['properties']],
                         ['999 Other Street', '2810 Washington Avenue', '859 Hanna Drive'])
        self.assertIn(COMING_SOON_URL, snapshot['sourcePages'])
        self.assertEqual(snapshot['excludedNonSaleCount'], 1)
        self.assertEqual(snapshot['sourcePropertyCount'], 4)

    def test_coming_soon_fetch_or_parse_failure_preserves_previous_snapshot(self):
        archive = f'<article class="type-property"><a href="{URL}">House</a></article>'
        for failure in [RuntimeError('Website request failed'), '<html>Changed markup</html>']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                output = Path(temp) / 'properties.json'
                original = json.dumps({'previous': 'verified snapshot'})
                output.write_text(original)
                def fetch_page(url, cache):
                    if url == COMING_SOON_URL:
                        if isinstance(failure, Exception):
                            raise failure
                        return failure
                    return archive if url.endswith('?terms=sale') else fixture()
                with patch('scripts.sync_properties.fetch', side_effect=fetch_page), self.assertRaises((ValueError, RuntimeError)):
                    sync(output)
                self.assertEqual(output.read_text(), original)

    def test_failed_import_preserves_previous_snapshot(self):
        archive = f'<article class="type-property"><a href="{URL}">House</a></article>'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            original = json.dumps({'previous': 'verified snapshot'})
            output.write_text(original)
            def fetch_page(url, cache):
                if url == COMING_SOON_URL:
                    return upcoming_page()
                return archive if url.endswith('?terms=sale') else fixture(status='Unknown')
            with patch('scripts.sync_properties.fetch', side_effect=fetch_page), self.assertRaises(ValueError):
                sync(output)
            self.assertEqual(output.read_text(), original)


if __name__ == '__main__':
    unittest.main()
