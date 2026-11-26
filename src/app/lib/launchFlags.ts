// Launch scope (owner decision, 26 Nov 2026): these services stay hidden from
// customers at launch. Their code, admin screens and server actions are kept;
// set a flag to false to bring the service back.
export const LAUNCH_HIDDEN = {
  designService: true, // «صمّم لي»
  nfc: true,
  customDomain: true,
  nonprofit: true, // the «جمعية أو جهة غير ربحية» choice when creating a page
} as const;
