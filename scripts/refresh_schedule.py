"""New York daytime collection and overnight freshness; no external writes."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import argparse
import os

ZONE = ZoneInfo('America/New_York')


def should_refresh(event, now=None):
    if event != 'schedule':
        return True
    local = (now or datetime.now(timezone.utc)).astimezone(ZONE)
    return 7 <= local.hour <= 21


def inventory_is_current(timestamp, now=None):
    now = now or datetime.now(timezone.utc)
    if timestamp.tzinfo is None or now.tzinfo is None:
        return False
    age = (now - timestamp).total_seconds()
    if age < -300:
        return False
    if age <= 4 * 3600:
        return True
    slot = now.astimezone(timezone.utc).replace(minute=17, second=0, microsecond=0)
    if slot > now:
        slot -= timedelta(hours=1)
    morning = None
    for offset in range(37):
        candidate = slot - timedelta(hours=offset)
        hour = candidate.astimezone(ZONE).hour
        if hour == 7 and morning is None:
            morning = candidate
        if hour == 21:
            return timestamp >= candidate - timedelta(hours=1) and (morning is None or now < morning + timedelta(hours=1))
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event', required=True)
    args = parser.parse_args()
    allowed = should_refresh(args.event)
    value = 'true' if allowed else 'false'
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'run={value}\n')
    print(f'Refresh permitted: {value} (America/New_York 07:00–21:59 scheduled window)')


if __name__ == '__main__':
    main()
