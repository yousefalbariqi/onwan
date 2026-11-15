import { JourneyGate } from '../components/JourneyGate';
import { JourneyBuilder } from './JourneyBuilder';
import { JourneyOnboarding } from './JourneyOnboarding';

export function StandardGate({ children }: { children: React.ReactNode }) { return <JourneyGate kind="standard">{children}</JourneyGate>; }
export function StandardBuilder() { return <StandardGate><JourneyBuilder kind="standard" /></StandardGate>; }
export function StandardOnboarding() { return <StandardGate><JourneyOnboarding kind="standard" /></StandardGate>; }
