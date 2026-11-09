import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sync_properties import listing_agent_contact, parse_detail

URL = 'https://www.aminvestmentswv.com/property/example/'
CALL = 'For more information or showings, please contact Example Agent, Realtor, 304-555-0123'
TEXT = 'Call/text Example Agent today at 304-555-0123 for details. Property marketed by Example Agent of Example Realty'

def html(description, footer=''):
    return '<article class="type-property"><h1 class="property-title">1 Example St <span class="badge">Sold</span></h1><dl><dt>Terms</dt><dd>For Sale</dd></dl><div class="property-content"><p>' + description + '</p></div></article><footer>' + footer + '</footer>'

class ListingContactTests(unittest.TestCase):
    def test_call_only_and_no_default(self):
        c = listing_agent_contact(CALL, URL)
        self.assertEqual(c['phone'], '+13045550123')
        self.assertNotIn('textEvidence', c)
        for text in ['', 'Call our office at 304-555-0123', 'Call/text Example at 304-555-0123', 'Property marketed by Example Agent']:
            self.assertIsNone(listing_agent_contact(text, URL))

    def test_same_property_full_name_text_evidence(self):
        self.assertEqual(listing_agent_contact(TEXT, URL)['textEvidence'], 'Call/text Example Agent today at 304-555-0123')
        self.assertIsNone(listing_agent_contact(TEXT.split(' Property marketed')[0], URL))
        self.assertIsNone(listing_agent_contact(TEXT.replace('marketed by Example Agent', 'marketed by Another Agent'), URL))

    def test_scope_and_ambiguity(self):
        self.assertNotIn('listingAgent', parse_detail(html('No contact published.', CALL), URL))
        self.assertEqual(parse_detail(html(CALL), URL)['listingAgent']['attribution'], CALL)
        self.assertIsNone(listing_agent_contact(CALL + '\n' + CALL.replace('Example Agent', 'Other Agent'), URL))
        self.assertIsNone(listing_agent_contact(CALL + '\n' + CALL.replace('555-0123', '555-0124'), URL))
        self.assertEqual(parse_detail(html(TEXT), URL)['status'], 'sold')
        for suffix in ['x123', ' ext 123', '-456', '9']:
            self.assertIsNone(listing_agent_contact(CALL + suffix, URL))
        self.assertIsNone(listing_agent_contact(TEXT.replace('marketed by Example Agent', 'marketed by Example Agent Jr'), URL))

if __name__ == '__main__':
    unittest.main()
