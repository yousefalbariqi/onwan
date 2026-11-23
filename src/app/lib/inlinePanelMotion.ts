// Keep the exiting surface offscreen until the native dialog is hidden.
// Releasing the animation first exposes its untransformed position for a frame.
export async function closeInlinePanel(element: HTMLDialogElement | null, reduceMotion: boolean) {
  if (!element) return;
  const motion = !reduceMotion && element.animate
    ? element.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], {
      duration: 280, easing: 'cubic-bezier(.22, .68, 0, 1)', fill: 'forwards',
    })
    : null;
  if (motion) await motion.finished.catch(() => undefined);
  element.close();
  motion?.cancel();
}

// A cancelled Web Animation exposes a new, unresolved `finished` promise.
// Only wait for an animation that is actually progressing.
export async function settleInlinePageMotion(motion: Animation | null) {
  if (motion?.playState === 'running') await motion.finished.catch(() => undefined);
}
