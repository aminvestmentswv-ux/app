# Property alerts — delivery setup

## Current state

Users can select **Available**, **Coming Soon**, **Both**, or **None**. Both is the
default. Explicit choices are saved in browser storage on that device; private
browsing/storage restrictions may prevent persistence, which the app reports.
Push delivery is not active: the owner confirmed there is no existing service.
The app says notifications are not available yet and loads no push SDK or permission
prompt while unconfigured.

OneSignal Web SDK v16 and a post-publication sender are prepared. Actual service
enrollment, credentials and end-to-end device delivery remain unverified. No account
or paid plan has been created, no keys configured, and no notifications sent.

## Connect a company-owned service

1. Create an AM Investments-owned OneSignal app. Select Web Push / Custom Code
   Setup for **https://app.aminvestmentswv.com**. Preserve existing DNS. Review
   current pricing and verify the plan supports the two audience tags below.
2. Publish an accurate privacy disclosure covering OneSignal and push subscription
   data before activation. Use company branding and the exact HTTPS app origin.
   Turn off dashboard automatic prompts and welcome campaigns; the app controls opt-in.
3. In this repository's GitHub Actions settings, add the public App ID as the
   **repository variable** `ONESIGNAL_APP_ID`. Store the app-scoped API key in
   the **Actions secret** `ONESIGNAL_REST_API_KEY`. Never put that secret in chat,
   a Page, a source file or a public variable.
4. Run the existing Hourly property refresh workflow. It embeds only the public
   App ID in the client, publishes the manifest/Home Screen icons and official
   `/OneSignalSDKWorker.js`, then runs the sender after successful publication.
   The secret API key is used only server-side by the sender.
5. The first configured run records a baseline without sending existing inventory.
   Verify it before inviting subscribers. Test actual opt-in, category selection,
   reload, denied permission and None/opt-out on Android Chrome and an installed
   iPhone Home Screen web app. iPhone web push needs supported iOS (16.4+) and the
   Home Screen app. Verify a delivered alert's property link. Do not claim delivery
   is working until those checks pass.

## Consent and categories

After configuration, SDK initialization has automatic prompts, automatic
resubscription and welcome notifications disabled. Loading the page or leaving
Both selected never calls opt-in. Only **Enable notifications** can request browser
permission. Unsupported or denied permissions do not produce a success message.

| Choice | `am_available` | `am_coming_soon` |
| --- | --- | --- |
| Available | 1 | 0 |
| Coming Soon | 0 | 1 |
| Both (default) | 1 | 1 |
| None | 0 | 0 |

Subscribed users can change tags without another permission prompt. None calls
subscription opt-out and sets both tags to zero. Sync failures are reported, with
instructions for disabling browser notifications immediately. Subscription-change
events update the visible enabled state. Subscriber identities/endpoints remain
with OneSignal; they are not stored in the public repository or property website.

## Delivery and retries

Without both credentials, `scripts/send_property_notifications.py` exits without
contacting OneSignal or creating a state branch. With configuration, it compares
the newly published inventory against `property-notification-state`, a separate
Git branch containing only public property IDs/statuses.

New properties or changes into Available/Coming Soon alert only the selected topic.
Unchanged listings, price/photo/description edits, Under Contract and Sold changes
do not alert. The first run or a new OneSignal app records a baseline without an
inventory blast. State advances after successful sends; failed sends preserve the
old baseline for retry. Per-event UUID idempotency keys protect retried requests
within OneSignal's documented retention window (currently 30 days). Existing workflow
concurrency and fast-forward Git updates protect state; no force-push is used.
No credentials, subscriptions, recipients or private records go into that branch.
Each alert links to its property in the published app.

## Scope and verification

This prepares web push, not native App Store/Google Play notification delivery.
Native apps still need device/signing and provider setup. The manifest provides
standalone Home Screen presentation, not offline property availability.

Run type checking, tests, a current-domain web build, `prepare_web_push.py`, then
the existing asset/photo and publication checks. Use mocks locally; never send
test messages to all users.

Official references reviewed October 18, 2026:

- https://documentation.onesignal.com/docs/en/web-push-setup
- https://documentation.onesignal.com/docs/en/web-sdk-reference
- https://documentation.onesignal.com/reference/push-notification
- https://documentation.onesignal.com/reference/idempotent-notification-requests
