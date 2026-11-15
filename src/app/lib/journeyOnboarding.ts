import type { JourneyKind } from './journey';
import { sessionOwner } from './session';

// Each new account's first-time setup stays open until it is
// finished: going back to the home page, closing the tab or signing in again
// on this device returns to it, with the tiles and step already chosen.
// Kept per account in this browser; only finishing the setup closes it.
export type OnboardingProgress = { step: 1 | 2 | 3; chosen: string[] };

const key = (kind: JourneyKind) => `onwan_${kind}_onboarding_${sessionOwner()}`;

function read(kind: JourneyKind = 'nonprofit'): OnboardingProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(kind)) ?? 'null');
    return value && (value.step === 1 || value.step === 2 || value.step === 3) && Array.isArray(value.chosen) ? value : null;
  } catch {
    return null;
  }
}

function write(progress: OnboardingProgress | null, kind: JourneyKind = 'nonprofit') {
  try {
    if (progress) localStorage.setItem(key(kind), JSON.stringify(progress));
    else localStorage.removeItem(key(kind));
  } catch {
    // Storage blocked: the setup still works, it just is not remembered.
  }
}

export const onboardingProgress = read;
export const onboardingPending = (kind: JourneyKind = 'nonprofit') => read(kind) !== null;
export const startOnboarding = (fresh = false, kind: JourneyKind = 'nonprofit') => { if (fresh || !read(kind)) write({ step: 1, chosen: [] }, kind); };
export const saveOnboarding = (progress: OnboardingProgress, kind: JourneyKind = 'nonprofit') => write(progress, kind);
export const finishOnboarding = (kind: JourneyKind = 'nonprofit') => write(null, kind);
