import { PILOT_THEMES as seeds } from '../../../shared/themePilot';
import { mergeWithDefaults } from '../context/PageContext';
import { extractDesign } from './pageDesign';
export const PILOT_THEMES = seeds.map(seed => ({ ...seed, design: extractDesign(mergeWithDefaults(seed.design as Parameters<typeof mergeWithDefaults>[0])) }));

import { LIBRARY_THEMES as library } from '../../../shared/themeLibrary';
export const LIBRARY_THEMES = library.map(seed => ({ ...seed, design: extractDesign(mergeWithDefaults(seed.design as Parameters<typeof mergeWithDefaults>[0])) }));
