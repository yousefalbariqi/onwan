# Email save screen — design QA

final result: blocked

Reference: the user's attached Linktree email screen and requested Onwan copy/brand. The reference supplies visual guidance only.

Implementation: `/signup?step=save`, after choosing a design. One email input, centered logo, prominent Arabic heading, orange CTA, login/terms/privacy links and a saving-only note. Subsequent states reuse the screen for verification code, resend cooldown, network error, save retry and verified existing-account recovery.

Targets: 320 × 568, 390 × 844 mobile and 1440 × 900 desktop, including keyboard-open and long-email states. Screenshots and browser console inspection remain unavailable: the in-app browser host was unavailable during this task sequence. No pixel comparison or visual pass is claimed. Native Chrome was not taken over while the user was using it.

Production build and Worker typecheck pass. Automated behavior checks cover the email screen, scoped authentication, conflicts and retry behavior. Database migration and real email delivery still require a configured test environment. Broad frontend typing is not a passing check: the repo lacks a root tsconfig, and ad-hoc checks include existing declaration/admin/color extraction errors.

Before visual approval, capture initial, invalid email, code, save error and existing-account states at the target sizes; check spacing, Arabic wrapping, contrast, focus visibility, keyboard scrolling, safe-area clearance and correspondence with the supplied reference. Prior inline-editor QA is retained in `docs/inline-editor-design-qa.md`.


## Account completion follow-up

Added `/signup?step=complete`, using the same quiet Onwan layout. Inspect the verified email summary/change-code state, password visibility and live rules, mobile number validation, editable name and link, server availability/error/retry states, consent, and account-saving errors. Back navigation must retain the design. Success must open plan selection without payment or publication.

Status remains blocked for visual approval: no rendered screenshot comparison is available. Functional tests include account transfer, reservation rollback, lost-response retry and verified mailbox replacement. Phase33 schema migration has not been applied to a real database by this task.

Final automated run: 118 tests passed, production build passed and Worker typecheck passed. No visual pass or real database/email integration pass is claimed.

## Annual subscription checkout

Source: user's final attached subscription/payment/publication brief, with explicit clarification that VAT is included, renewal is automatic and Apple Pay/other payment methods are not active.

Implemented: `/plan-selection` single annual card, server-derived price, feature list, tax-inclusive total, inactive payment explanation and disabled CTA. `/payment/success` renders only server-confirmed results, with actual account link sharing, pending verification and publication-failure handling. Existing extra-service carts remain outside this creation view.

Visual approval remains blocked: no rendered implementation screenshots or same-viewport comparison were available. Inspect 320×568, 390×844 and 1440×900 targets, long feature wrapping, unavailable-price/error/active-subscription states, safe-area scrolling and button/legal text clearance. No live payment gateway, automatic collection or real publication triggered by payment was tested or enabled.

Annual checkout final checks: 124 automated tests passed; production build and Worker typecheck passed. Visual approval and real-gateway integration remain unavailable.

## Manual publication launch override

Latest approved flow replaces the disabled payment CTA with “انشر صفحتي”, explains contact for invoice/payment link, and displays a distinct server-confirmed `published_pending_payment` result with sharing. Admin customer carts allow HTTPS invoice/payment links, visible in customer settings. No payment success or active subscription is asserted before staff settlement.

Fresh in-app browser attempt returned “The browser access host is unavailable”. Visual approval remains blocked. The backend now has a successful isolated PostgreSQL integration test proving full draft publication, public retrieval, unpaid state, idempotent retry and later settlement, without real customer data or live cache effects. External-database publication testing was rejected by automatic review and replaced with the isolated test.

Manual-launch final checks: 130 automated tests plus one isolated PostgreSQL integration test passed. Production build and Worker typecheck passed. Phase34/35 were applied to the configured application database; visual approval is still unavailable and application code was not deployed.

## 2026-11-18 — Photo and name reference adaptation

final result: blocked (formal pixel comparison only)

Implemented the attached two reference images' hierarchy within the existing HeaderEditor: three layout families; photo card with add/crop/remove; name; optional title-only font; title colour; formatted biography. User-requested differences: black selection/switch accents, no paid badges or plan gating, existing Onwan typography/content and original media adjustment controls retained. Biography keeps the existing 300-character contract rather than lowering it to the reference's 160.

Visual evidence: native Safari Responsive Design Mode at 383 CSS px, 852 and 1200 CSS px tall (2× device ratio, browser display scaled to 59%/42%). Observed actual controls and selected Amiri after enabling the title-font switch. Found and corrected an avatar flex minimum-size issue (oval frame), duplicate outer padding, and an unnecessary image-shape row between photo and name. A later capture showed the corrected round avatar, three black selected/unselected layout cards, photo actions, name, switch, colour control and biography. Source-specific icons are replaced by the existing product image renderer/Lucide controls.

No formal side-by-side pixel pass is claimed: source images are conversation attachments without a standalone local artifact for normalized paired-image comparison. The current implementation was visually inspected but the strict paired-image gate remains blocked. Native scrolling also returned noWindowsAvailable; a taller responsive viewport was used to inspect the complete content instead. Physical iPhone keyboard/upload and Chrome remain unverified.

48 targeted editor, persistence, media, formatting and title-font checks pass; production build passes. Title font tests prove the name uses its independent family while body typography stays unchanged. Regression coverage also ensures a cancelled/idle Web Animation cannot hold panel closure indefinitely.
