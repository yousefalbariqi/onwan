# Google Wallet

The sharing panel issues a Generic Pass from the authenticated owner's saved database page. Unpublished editor changes are not read. The card contains the saved name, profile logo, page address, native QR code, and a website link. Google controls the layout and QR size; this is not an Apple Wallet replica.

`POST /api/google-wallet` requires the owner session and accepts only an optional hex color. The object ID derives from the page ID, so retries and username changes update the same card. Successful Google API acknowledgement is required before returning an RS256-signed save link. No service-account credentials or OAuth access tokens reach the browser.

`GET /api/google-wallet?username=...` returns a save redirect only for a published page whose card already exists. It never creates or updates an object. `?test=yaamur` opens the pre-existing technical test card, independent of any customer page; its destination is https://yaamur.onwan.link.

Configuration: issuer/class IDs in wrangler.jsonc, service-account JSON in Cloudflare secret GOOGLE_WALLET_SERVICE_ACCOUNT. GOOGLE_WALLET_CREDENTIALS is supported for local configuration. Never prefix these variables with VITE_. Local CLI checks also support GOOGLE_WALLET_CREDENTIALS_FILE.

Checks: `node --test tests/google-wallet.test.cjs tests/sharing-panel.test.cjs`, `npm run check:worker`, `npm run test:worker`. `node scripts/check-google-wallet.mjs` checks real authentication/class access. `node scripts/create-google-wallet-test.mjs --refresh-design` updates only the fixed technical test card. Saving into an actual Android Google account must still be verified on the phone; a successful API response does not prove that final interaction.
