import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.sync_properties import BASE, apply_owner_overrides, parse_archive, parse_detail, sync

URL = BASE + '/property/example-house/'


def fixture(status='For Sale', terms='For Sale', address='123 Test Street<br>Test City, WV 25301', extra=''):
    return f'''<article class="property type-property"><header>
      <h1 class="property-title">Example House <span class="badge">{status}</span></h1>
      </header><div class="property-images"><div class="slider-for">
      <img src="https://image-cdn.carrot.com/uploads/example.webp" alt="Example exterior">
      </div></div><div class="property-content"><p>A published description.</p></div>
      <dl><dt>Address:</dt><dd>{address}</dd><dt>Terms:</dt><dd>{terms}</dd>{extra}</dl>
      </article>'''


class ImportTests(unittest.TestCase):
    def test_hourly_import_retains_jonquil_owner_correction(self):
        url = BASE + '/property/4900-4904-jonquil-drive-charleston-wv/'
        archive = f'<article class="type-property"><a href="{url}">Jonquil</a></article>'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            def fetch_page(url, cache):
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

    def test_failed_import_preserves_previous_snapshot(self):
        archive = f'<article class="type-property"><a href="{URL}">House</a></article>'
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            original = json.dumps({'previous': 'verified snapshot'})
            output.write_text(original)
            def fetch_page(url, cache):
                return archive if url.endswith('?terms=sale') else fixture(status='Unknown')
            with patch('scripts.sync_properties.fetch', side_effect=fetch_page), self.assertRaises(ValueError):
                sync(output)
            self.assertEqual(output.read_text(), original)


if __name__ == '__main__':
    unittest.main()
