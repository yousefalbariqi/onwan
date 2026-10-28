import { sessionOwner } from './session';

// A new association's first-time setup (notes 19–20) stays open until it is
// finished: going back to the home page, closing the tab or signing in again
// on this device returns to it, with the tiles and step already chosen.
// Kept per account in this browser; only finishing the setup closes it.
export type OnboardingProgress = { step: 1 | 2; chosen: string[] };

const key = () => `onwan_nonprofit_onboarding_${sessionOwner()}`;

function read(): OnboardingProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(key()) ?? 'null');
    return value && (value.step === 1 || value.step === 2) && Array.isArray(value.chosen) ? value : null;
  } catch {
    return null;
  }
}

function write(progress: OnboardingProgress | null) {
  try {
    if (progress) localStorage.setItem(key(), JSON.stringify(progress));
    else localStorage.removeItem(key());
  } catch {
    // Storage blocked: the setup still works, it just is not remembered.
  }
}

export const onboardingProgress = read;
export const onboardingPending = () => read() !== null;
export const startOnboarding = () => { if (!read()) write({ step: 1, chosen: [] }); };
export const saveOnboarding = (progress: OnboardingProgress) => write(progress);
export const finishOnboarding = () => write(null);
