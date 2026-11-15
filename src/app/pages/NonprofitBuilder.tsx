import { JourneyBuilder, customerEditorConfig } from './JourneyBuilder';

// Compatibility exports for the association portal and existing imports.
export const nonprofitEditorConfig = customerEditorConfig;
export function NonprofitBuilderPage({ gate: Gate }: { gate: React.ComponentType<{ children: React.ReactNode }> }) {
  return <Gate><JourneyBuilder kind="nonprofit" /></Gate>;
}
