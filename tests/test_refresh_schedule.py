from datetime import datetime, timedelta, timezone
import unittest
from scripts.refresh_schedule import should_refresh, inventory_is_current
from scripts.check_health import check_timestamp, check_published_timestamp

def dt(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

class RefreshScheduleTests(unittest.TestCase):
    def test_boundaries_and_nonscheduled_events(self):
        for clock, expected in [('06:59', False), ('07:00', True), ('21:59', True), ('22:00', False)]:
            now = dt('2026-11-08T' + clock + ':00-05:00')
            self.assertEqual(should_refresh('schedule', now), expected)
            for event in ['push', 'workflow_dispatch']:
                self.assertTrue(should_refresh(event, now))

    def test_cron_union_yields_fifteen_local_slots_in_winter_summer_and_dst(self):
        for date in ['2026-01-15', '2026-07-15', '2027-03-14', '2027-11-07']:
            start = dt(date + 'T00:00:00Z')
            chosen = []
            for hour in range(48):
                candidate = start + timedelta(hours=hour, minutes=17)
                if candidate.hour in [0, 1, 2, *range(11, 24)] and should_refresh('schedule', candidate):
                    from scripts.refresh_schedule import ZONE
                    local = candidate.astimezone(ZONE)
                    if str(local.date()) == date:
                        chosen.append(local.hour)
            self.assertEqual(chosen, list(range(7, 22)))

    def test_overnight_and_missed_morning(self):
        for evening, deadline in [('2026-11-08T02:17:00Z', '2026-11-08T13:17:00Z'),
                                  ('2026-07-05T01:17:00Z', '2026-07-05T12:17:00Z'),
                                  ('2027-03-14T02:17:00Z', '2027-03-14T12:17:00Z'),
                                  ('2027-11-07T01:17:00Z', '2027-11-07T13:17:00Z')]:
            now = dt(deadline) - timedelta(microseconds=1)
            self.assertTrue(inventory_is_current(dt(evening), now))
            self.assertTrue(inventory_is_current(dt(evening) - timedelta(hours=1), now))
            self.assertFalse(inventory_is_current(dt(evening) - timedelta(hours=1, seconds=1), now))
            self.assertFalse(inventory_is_current(dt(evening), dt(deadline)))
            check_published_timestamp(evening, now)
            with self.assertRaises(ValueError):
                check_timestamp(evening, max_hours=1, now=now)

    def test_future_naive_and_daytime_outage_fail(self):
        now = dt('2026-11-08T18:00:00Z')
        for value in ['2026-11-08T13:59:59Z', '2026-11-08T18:06:00Z', '2026-11-08T17:00:00']:
            self.assertFalse(inventory_is_current(dt(value), now))
