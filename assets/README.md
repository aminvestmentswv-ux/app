# AM Investments brand assets

For the November 9, 2026 store preparation, the owner inspected and explicitly
selected the current repository image: circular navy/gold AM Investments artwork
with EST. 2014, on a square opaque background. Its PNG SHA-256 is
`c90c6e35f173645364c0a51877cb0e529a0b57d4f7a4507dc94c0a616fa75364`.
Older written guidance described a different square monogram; do not redraw or
substitute that artwork in this store listing. The owner authorized code resizing
and composition while preserving the existing logo. No source artwork was changed.

`am-investments-logo-house.png.base64` is the lossless PNG source, stored as
base64 text for repository transport. `npm ci` / `npm install` materializes
`am-investments-logo-house.png` using `scripts/prepare_brand_assets.mjs`.
Run that script manually after changing the encoded source in an existing checkout.
The decoded PNG is generated and ignored; do not edit it directly.
The same artwork supplies in-app branding, native configuration, web favicon,
and the 180/192/512-pixel Home Screen icons. Icon URLs include an artwork hash.

The earlier `am-investments-logo.png` and original website
`am-investments-logo.jpg` remain historical provenance only.
Original website: https://www.aminvestmentswv.com/
Original asset: https://image-cdn.carrot.com/uploads/sites/4396/2018/05/rsz_logo_final_72dpi.jpg

Existing app interface colors remain navy `#133c7a` and gold `#e0ad2d`.
