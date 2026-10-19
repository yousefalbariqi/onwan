# Mobile editor redesign QA

**Comparison target**

- Source visual truth: user-supplied Apple wallpaper picker references, especially `/tmp/codex-remote-attachments/01a13971-1e6b-73d0-ad53-611ff9fdd4e9/2E4DB00E-94F3-4D33-94AF-671114AFBF7B/3-صورة-3.jpg` and `4-صورة-4.jpg`.
- Implementation: `/builder` at a 393 × 852 CSS-pixel mobile viewport in the local in-app browser.
- State: guest/onboarding preview (`/builder?onboarding=signup&username=demo`).
- Density normalization: the source is an iPhone screenshot; the implementation was checked at its native 393 × 852 CSS viewport. The browser capture is held in the active in-app browser session rather than a filesystem path.

**Visible comparison**

- The implementation intentionally does not copy Apple branding or its wallpaper content. It carries over the intended interaction language: a quiet mobile canvas, large visual headings, horizontally browsable wallpaper cards, concise category cards, and settings that open as a bottom sheet.
- Typography: the existing Cairo/Tajawal Arabic type system is retained and has clear title, label, and helper-text hierarchy.
- Layout rhythm: the mobile screen uses consistent 12–28px spacing, 22–30px radii, and one-column touch targets.
- Colors: neutral iOS-like grays are paired with the existing emerald product accent; selected visual groups have restrained contextual color.
- Images/assets: the user did not request copied Apple wallpaper art. The cards are previews of product-supported colors, gradients, and uploaded images.
- Copy: labels now describe the user task directly: `معلومات الصفحة`, `الخلفيات`, and `الثيمات`.

**Findings**

- [P2] The authenticated editor state could not be captured in the in-app browser. The available local preview correctly renders the new mobile layout, but the signup dialog intentionally sits over it; opening and exercising the editor sheets needs an authenticated account session.
  - Evidence: the captured local route displays the redesigned page underneath the signup dialog.
  - Impact: visual layout is verified, but the sheet-open interaction is not browser-verified in the authenticated state.
  - Fix: sign in to a local test account and exercise identity, wallpaper, theme, and close-sheet controls at the same viewport.

**Implementation checklist**

- [x] Replace mobile fixed tab bar with a scrollable visual customization home.
- [x] Put identity, links, and button appearance in concise icon-led cards.
- [x] Move background discovery below information, with a browseable visual rail.
- [x] Open detailed editors in a touch-friendly bottom sheet.
- [x] Preserve desktop editor behavior and existing save/publish flow.
- [x] Run `npm run build` successfully.

**Follow-up polish**

- Add optional curated image wallpaper collections once the product has licensed or owned image assets.

final result: blocked

---

# Owner design ideas not in the requirements (15 Oct 2026)

Ideas the owner gave for the mobile `/builder` that the requirements document (`../onwan_requirements_reference.docx` v1.0) does not cover. They are built, but they are **not requirements** until the owner adds them to the docx/xlsx. Requirements that *are* covered and were only restyled: live preview before save (PAGE-07), ready themes and wallpapers (PAGE-02), «صمّم لي» (NEW-06).

| # | Idea | What was built | Open question for the requirements |
|---|---|---|---|
| D-01 | Apple wallpaper-picker layout | Round shortcut row (الهوية، الروابط، الأزرار، الخلفية، الثيمات، الحساب), «مميزة» themes and «الخلفيات المقترحة» as sideways-scrolling phone-shaped cards. | — (presentation only) |
| D-02 | Previous designs («الأشكال السابقة») | Each save adds the version before it to a list (max 10). The latest one sits beside the current phone; «السابقة (n)» opens a sheet with all of them; tapping one puts it back in the draft, still needing «حفظ». Grey placeholder «لا توجد تصاميم سابقة» when empty. | Stored **in the browser only** (localStorage, `onwan_design_history_<username>`), not on the server, so it is lost on another device or when site data is cleared. Should it be kept in the database, how many versions, and for how long (relates to P-09 retention)? Should staff and the administration see it? |
| D-03 | «رجوع» button | Drops the unsaved changes and returns to the last saved version, after confirmation. | Not to be confused with PAGE-08 (restore the *default* design). |
| D-04 | Share from inside the editor | «مشاركة» opens the device share sheet or copies the link, shown only once the page is published (before that the button is «نشر»). SHARE-01 covers visitors only. | Confirm it belongs in the beneficiary's editor. |
| D-05 | Action column beside the preview | حفظ، رجوع، مشاركة، الإعدادات as 48px round buttons between the current and previous phones. | — |
| D-06 | Header clean-up | The full-width «صمّم لي» banner became a compact gradient header button; the header «حفظ» is hidden on phone (kept on desktop, which has no other save); the header publish button is labelled «التالي» and sized like «صمّم لي»; all header buttons are 40px tall. | — |
| D-07 | Removed from the phone layout | The «صفحتك، بطريقتك» title bar and the status card with the «باقي لك» completion hint (name, short description, one link). | Was the completion hint wanted anywhere else? |

| D-08 | Apple Settings-style editor panels | Shared controls in `components/ios.tsx` (grouped lists, segmented controls, switches, one row of colour dots). Sections are now 4: «الهوية» (content only), «الروابط», «الأسلوب» (buttons, text, profile shape, colours — moved out of «الهوية»), «الخلفية» (themes merged in as a segment). «الإعدادات» opens from the action column. One «لون النص» sets name, description and link together; separate colours stay behind «ألوان كل نص على حدة». | — (presentation only; every option that existed is still there) |

| D-09 | 16 page fonts in 5 categories | حديث (Cairo, Tajawal, Almarai, IBM Plex Arabic, Readex Pro), كلاسيكي (Amiri, Noto Naskh, Markazi), كوفي (Noto Kufi, Reem Kufi, Changa), أنيق (El Messiri, Alexandria), عناوين (Lalezar, Lemonada, Aref Ruqaa). Self-hosted; each card shows the entity's own name in that font. | PAGE-02 says "تخصيص الخط" without a list; confirm the set. |
| D-10 | Separate size for name and description, with a − / + pixel stepper | Name 16–56px, description 11–24px; picking صغير/متوسط/كبير clears the exact size. | Limits were chosen by the designer, not the owner. |

| D-11 | Own icon for general buttons | موقع إلكتروني، رابط مخصص، صورة، ملف PDF get a «الأيقونة» picker: default, an uploaded image (cropped square, 128 px, inline) or one of 38 library icons. Needs migration `phase13-link-icons`. | Uploaded icons are stored inline until file storage is decided (P-02). |
| D-12 | Logo colour and contrast | Logos keep their brand colour unless the WCAG contrast with the button is below 2:1, then they take the button text colour. «لون الشعارات: ملوّنة / بلون النص» in «الأسلوب». | — |
| D-13 | WhatsApp and email fields | WhatsApp takes a Saudi mobile number (+966 fixed) and builds `wa.me`; email takes an address and builds `mailto:`. A green confirmation line appears once valid. | Other country codes for WhatsApp? |

Verification: `npm run build` passes after each change. Not yet checked in a browser with a signed-in account.
