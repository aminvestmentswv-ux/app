# Full-width logo — review draft

Owner-requested visual draft, based on source commit 2b88a22cdb065cb1244d2e79be544c49d508f7dd.

The homepage logo extends edge to edge while retaining its 90-pixel image height and the same top position. Its white frame retains 6 pixels of vertical padding. The existing official artwork is stretched horizontally through layout styling; the source image is unchanged. The West Virginia label and For Sale badge sit in the row beneath it.

Mobile measurements at a 390-pixel viewport: current logo x=30, y=34, width=108, height=90; draft x=0, y=34, width=390, height=90.

The comparison screenshot shows the current header on the left and this draft on the right. This is a local visual preview using the repository's bundled inventory and unconfigured notification UI, not a claim of current inventory or live push delivery.

Validation: TypeScript check, web export, actual browser rendering, no browser runtime errors, and measured logo bounds passed. Existing compact logos in property-photo fallbacks retain their original layout.

This draft branch does not publish the production app or change its domain. The separate OneSignal startup fix remains on main and follows its existing deployment workflow.
