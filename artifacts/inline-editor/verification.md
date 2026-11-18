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
