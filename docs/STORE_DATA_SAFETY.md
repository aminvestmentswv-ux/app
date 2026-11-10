# Google Play Data safety preparation

Saved November 9, 2026 in Publishing overview, ready for review preparation.
No release was submitted. Scope: installed native property app, package
`com.aminvestmentswv.properties`, audited preview source `eb5b84e`.

| Form field | Saved answer |
| --- | --- |
| Collect or share required data types | Yes |
| Data type | Device or other IDs |
| Handling | Collected and shared |
| Ephemeral processing | No |
| Required or optional | Required |
| Collection/sharing purposes | App functionality; fraud prevention, security and compliance |
| Encryption in transit | Yes |
| Account creation / external-account login | Neither supported |
| Optional deletion-mechanism badge | No answer claimed |
| Privacy policy | https://app.aminvestmentswv.com/privacy.html |

## Evidence and interpretation

- Inventory uses HTTPS to `app.aminvestmentswv.com/properties.json`. Remote photos
  use `image-cdn.carrot.com`. Source search stays in memory. Maps and sharing open
  destinations selected by the user; there is no embedded native webview.
- The owner confirmed no separate app visitor tracking. The native source has no
  account, advertising or analytics integration. The APK declares Internet plus
  its internal signature-level receiver permission, with debugging disabled.
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)
  explicitly retains visitor IP addresses for security. The saved identifier
  category conservatively covers network IP/security metadata, not advertising
  identifiers. No service-provider sharing exemption was claimed.
- [Carrot's policy](https://carrot.com/privacy/) covers service provision and
  provider processing. Its general website tracking statements do not establish
  that tracking scripts run in the native image client.
- [Google's guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
  requires off-device and third-party processing to be considered, classifies IP
  data according to its use, and limits ephemeral processing to transient memory.
  No location inference, advertising or analytics purpose was asserted here.

This is an evidence-based preparation entry, not a completed runtime network
audit. Verify the exact store build's traffic and provider practices before
sending the release for review; update the form if SDKs or behavior change.
