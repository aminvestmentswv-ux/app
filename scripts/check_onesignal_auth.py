"""Read-only OneSignal credential check. Never sends notifications or logs bodies."""
import http.client
import os

APP_ID = '19379a1e-b914-466b-a5c6-605dc290858d'
HOST = 'api.onesignal.com'
PATH = '/apps/' + APP_ID + '/segments?limit=1'


def check(connection_factory=http.client.HTTPSConnection):
    if os.environ.get('ONESIGNAL_APP_ID') != APP_ID:
        print('Authentication check blocked: app configuration mismatch.')
        return 1
    key = os.environ.get('ONESIGNAL_REST_API_KEY', '')
    if not key or any(c.isspace() for c in key):
        print('Authentication check blocked: missing or malformed credential.')
        return 1
    conn = None
    try:
        conn = connection_factory(HOST, timeout=20)
        conn.request('GET', PATH, headers={'Authorization': 'Key ' + key})
        response = conn.getresponse()
        status = response.status
        # Never read, store or print the response body. Never follow redirects.
        if status == 200:
            print('OneSignal authentication verified (HTTP 200). No notifications sent.')
            return 0
        print('OneSignal authentication check failed (HTTP ' + str(status) + '). No notifications sent.')
        return 1
    except Exception:
        print('OneSignal authentication check failed: transport error. No notifications sent.')
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == '__main__':
    raise SystemExit(check())
