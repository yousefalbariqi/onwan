-- Custom icon of a link button (owner decision, 15 Oct 2026; design-qa D-11).
-- Either 'icon:<id>' from the built-in library (src/app/lib/linkIcons.tsx) or a
-- small uploaded image stored inline as a data URL, like the other images
-- until real storage is decided (P-02). NULL = the platform's default icon.
alter table page_links add column if not exists custom_icon text;
