# ترتيب محرر الصفحة

راجعنا ست لقطات موزعة على الفيديو المرجعي (39.49 ثانية)، وتشمل المعاينة، تعديل الاسم مع لوحة المفاتيح، ولوحة الخطوط. اعتمد المستخدم تنظيم المعاينة كمساحة أساسية، وأدوات الهوية أسفلها، وزر إضافة واحد.

التعديل في InlinePageEditor الحالي، دون إنشاء رحلة تحرير بديلة:
- رأس مختصر: الرجوع، الهوية، المعاينة، والحفظ/المتابعة بنفس مسار الحفظ الحالي.
- أدوات التصميم في شريط أفقي RTL: الثيمات، الصورة والاسم، الخلفية، الخطوط، الأزرار، والألوان. تستخدم جميعها اللوحات القائمة.
- زر إضافة واحد يفتح LinkEditor الحالي ويضع المحتوى بعد آخر عنصر. ما زال ترتيب العناصر ممكنًا من محرر العنصر والمصمم المتقدم.
- إزالة أزرار الإضافة من بين عناصر المعاينة. تبقى عناصر الصفحة قابلة للضغط لتعديلها.
- التراجع والإعادة والمصمم المتقدم في صف الإجراءات السفلي. حفظ المسودة متاح من حالة الحفظ.
- حجز ارتفاع الشريطين ومناطق الأمان، مع تمرير الصفحة بينهما، وحركة قصيرة للوحة تحترم تقليل الحركة.

نجح بناء الإنتاج و13 اختبارًا للمحرر والتنقل، منها اختبارات إضافة عنصر، وضع المعاينة، العودة بعد حفظ المسودة، منع العودة عند فشل الحفظ، ومنع إكمال الرحلة عند وجود تغييرات أحدث.

الفحص البصري للمحرر المعدّل غير مكتمل: أداة التحكم أعادت Native pipe startup failed وBrowser access host unavailable. لذلك لم ندّعِ تحققًا على Safari/Chrome للجوال أو تجربة فعلية للوحة المفاتيح. يلزم هذا الفحص قبل اعتماد توزيع المساحات نهائيًا.

## 2026-11-17 — Identity panel and live preview

- Identity tools now use a non-modal bottom panel: no dimming over the live PageView.
- The same page renderer scales into the space above the panel; closing restores the large page.
- Panel contents scroll internally. A handle supports click, keyboard activation and vertical pointer swipe to switch heights.
- visualViewport resize/scroll updates available height and offset, including keyboard changes; bottom padding respects safe areas.
- Creation template covers now show background, Arabic type and a button sample in three columns, rather than six miniature full pages.
- Removed manual save/close footer and standalone save action. Existing automatic persistence remains; closing and navigation flush the draft. Journey completion remains behind “التالي”.
- Escape and close restore focus to the opener. The small page is inert while controls are open. Reduced motion disables entry/exit animations.
- Build passed. 14 editor/content-navigation tests passed, including panel expansion, close persistence and completion guards.
- Browser automation unavailable (native pipe startup and browser host errors). Actual mobile Safari/Chrome, keyboard layout and motion remain visually unverified; no device-testing claim is made.

## Return motion correction

Reviewed frames extracted from the user's 17.54-second iPhone comparison recording. The earlier close path animated only the sheet, then changed the page from fixed/scaled to normal flow afterward. The replacement captures the live page bounds and animates across that layout change while the sheet exits concurrently (280 ms). Expanded panel geometry stays stable until its exit ends. Reduced motion skips both animations. Build and 22 related tests pass; frame-by-frame browser verification of the new implementation is still outstanding.

## Exit flash correction

Examined extracted frames from the user's 16.39-second follow-up recording. Found that the exit animation had no fill mode and dialog visibility was managed after paint: finishing could expose the untranslated panel before React hid it. Exit now holds its last frame, closes the native dialog, and only then releases the animation. Dialog visibility is synchronized before paint. Page motion is allowed to finish before its effect is cleaned up. Added regression checks for hide-before-release ordering, reduced motion, and interrupted exits. Physical/mobile visual verification remains pending.

## 2026-11-18 — Explicit save and local working copy

The user replaced the earlier automatic-cloud-saving requirement. Identity edits now opt into manual draft synchronization in PageContext. Guest TrialWorkspace no longer calls the cloud saver after 650 ms; its recovery-only backup uses IndexedDB/session storage. Account identity mode disables scheduled cloud writes, background retry writes, and automatic draft deletion. Other existing standalone editors retain their prior policy unless identity mode has been activated in their provider.

The last acknowledged draft is separate from the published page and the local working copy. Save acknowledges the submitted snapshot, retains newer input if it arrives during a request, and does not navigate. Dirty headers show Save/Cancel in place of Next/Preview; clean headers restore Next. Cancel confirms, restores the acknowledged snapshot and updates recovery locally, without a cloud mutation. Panel closure, preview and advanced-editor switching do not implicitly save. Content forms are remounted after discard to prevent cancelled internal input being recommitted. Unfinished elements cannot advance to completion. Removed the visible saved-draft strip and its reserved space.

A development-only fixture at `/artifacts/inline-editor/manual-save.html` uses the real editor/provider with isolated fake persistence and no network or account credentials. Verified in native desktop Safari: edit name → Save/Cancel appear; close tool → changes remain local; Save → Next returns; another edit → Cancel confirmation → saved name restored. No iPhone/Chrome visual claim is made.

Automated checks include provider timer advancement without any draft requests, one explicit draft request, preserving the published snapshot, guest recovery without invoking the cloud writer, confirmed cancellation without cloud writes, failed saves retaining changes, and acknowledgement/newer-input races.

## Tap preview to dismiss tools

Added a keyboard-accessible transparent hit target over the small live page, outside the inert page content. It closes the current panel using the same exit animation, without saving or discarding. Hidden when expanded and disabled while saving/preparing media. Verified in native desktop Safari with the isolated fixture: select مدار → tap small preview → reopen الثيمات → مدار still selected and Save/Cancel still shown. 38 editor/persistence tests pass, including reopen and zero-mutation assertions. Worker is stopped before rebuilding and restarted to avoid stale asset bindings.

## Header editor reference adaptation

Photo/name controls are reorganized using the user's supplied screenshots, black selected states and no premium badges. Crop/position/zoom controls remain behind a disclosure; English fields remain optional. Name font is an optional independent typography.nameFont rendered only on the real page heading, with existing lazy-loaded built-in fonts. Title colour and formatted biography reuse existing page fields. Native Safari responsive UI review covered the new hierarchy and title font disclosure/selection; formal paired-image comparison is documented as blocked in design-qa.md. 48 related tests pass.

## Layout options and touch adjustment

Restored PROFILE_SHAPES directly in the new layout cards using unchanged identifiers and labels (circle, framed circle, rounded square, square, cover, inset photo), plus banner where supported. Removed the duplicate shape grid from crop controls while retaining fit options. Replaced position/zoom sliders in HeaderEditor with six 44px touch buttons using existing positionX/positionY/zoom fields, ±5 position steps and ±0.1 zoom steps; bounds remain 0–100 and the existing 0.3/1–3 zoom policy. Five focused shape/title/renderer tests pass; build succeeds. No database/schema changes.

## Horizontal layout rail containment fix

The native fieldset's automatic minimum inline size allowed the new flex rail to widen the whole panel. Set min-inline-size:0 and a bounded 100% width on the scroll fieldset, HeaderEditor wrappers and the rail. Native Safari responsive review at 383px showed the avatar, remove/crop actions, name, colour and biography fully contained, with only the layout rail horizontally clipped/scrollable. No persistence or rendering logic changed.

## Creation-session video uploads

The existing pre-account editor now supplies its scoped creation token for video upload. Both Stream and R2 handlers authorize that session via requireCreationDraft; missing, revoked and completed sessions remain rejected. R2 keeps existing file signatures, byte and storage limits. Stream creation validates declared size, reserves the existing upload quota conservatively at the per-file maximum, and preserves the 60-second processing limit; status also rejects oversized video metadata. No general anonymous account/API permission was introduced: this uses the email-verified creation session already required by the current edit route.

Video ownership after signup is recognized through the server-side creation_email_drafts.account_user_id link, never a caller-supplied owner. Stream cleanup now protects videos referenced by creation drafts, consistent with R2 references. Unsaved uploads remain under the existing abandoned-media cleanup rule. 68 tests pass, including scoped uploads, revoked/completed denial, byte/duration quota, owner isolation and cleanup retention; worker typecheck passes. No real cloud video was uploaded during verification.

## 2026-11-19 — Three-tab background panel

Inline identity now uses BackgroundSettings with only solid colour, image and video tabs. Removed themes/gradients entirely from this panel at the user's request; the standalone theme chooser and legacy editor remain available. Suggested colours, existing logo-extracted colours and validated HEX/native colour selection are separated. No AI-generation badge or unsupported opacity control is shown.

Image mode uses the existing compression/recovery/save pipeline and adds persisted cover/contain/tile rendering, zoom, vertical focus and dim controls; gallery/camera selection is contextual. File name/size and fit survive server normalization. Video mode reuses upload/auth/progress and presents a compact preview, automatic poster origin, actual-frame selection with a timeout/manual fallback, optional poster removal, position and dimming. Replacing a video now extracts its own first frame rather than reusing the old video's poster. Paused hidden thumbnails avoid background playback. Capture failures preserve the existing poster and expose retry/manual selection.

Five background-specific tests cover exactly three tabs/no secondary options, non-mutating tab navigation, colour/HEX handling, fitting/zoom, real render modes and actual-frame extraction/timeout. Fifty frontend/editor tests and 41 background/worker contract tests pass (overlapping suites); Worker typecheck and production build pass. Native iPhone camera, real-cloud frame CORS and cross-browser visual QA are not claimed as verified.

## Mobile dock section order

Reordered the mobile identity dock to Templates → Photo/name → Content → Style → Backgrounds → Sharing → Settings. Style reuses the existing full StyleEditor, consolidating font/button/colour tools. Content uses the existing LinkEditor. Signed-in sharing/settings reuse desktop SharingPanel and AccountPanel/NonprofitSettings; pre-account creation shows a completion prompt rather than invoking account APIs with creation credentials. Preview/advanced editing remain accessible within Style. Existing manual save/cancel policy is unchanged. 23 inline editor/navigation tests and build pass, including a requested-order assertion.

## Desktop/mobile header isolation — 2026-11-19
- Restored HeaderEditor.tsx to the repository version for the desktop builder; mobile now uses MobileHeaderEditor.tsx and its own stylesheet.
- Added a direct advanced-editor entry in the inline header, preserving the existing local state without an implicit draft write.
- Validation: 30 header/inline tests passed; production build passed. Restarted local worker safely; /signup returned HTTP 200 on port 8787.
- Physical mobile/browser visual verification was not repeated for this isolated change.

## Mobile content overview — 2026-11-19
- Opt-in mobileOverview reuses LinkEditor's existing forms, uploads, mutations and section-aware reorder operations. Desktop keeps its existing list/chooser.
- Added compact RTL shortcuts, type search and paste-to-link form with detected platform/title, real file metadata, explicit visibility switches, collapsible group membership, and a dedicated reorder mode (pointer handles plus arrow alternatives).
- Removed duplicate inline item move controls; existing preview/persistence behavior retained.
- Validation: 65 content/navigation/inline/API tests passed and production build passed. Updated legacy API test mocks for prior creation-session/video-ownership imports. Physical Safari/Chrome touch/keyboard QA not performed in this pass.

## Prelaunch sharing/settings — 2026-11-19
- Shared prelaunch panel offers Next when clean, Save and Continue when dirty. It awaits the existing saveDraft, preserves incomplete-form/media/conflict guards, and never navigates after a failed save.
- Settings now previews disabled account/page/subscription rows instead of the blank account-completion prompt. Sharing uses a properly generated illustrative QR matrix (not the future page URL).
- Validation: 26 inline tests passed, including both panels' successful/failed saves and clean continuation; production build passed. No physical mobile visual QA in this pass.
