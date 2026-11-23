// Development-only UI verification: no authentication, network or real drafts.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PageProvider, mergeWithDefaults, type PageSource } from '../../src/app/context/PageContext';
import { InlinePageEditor } from '../../src/app/components/InlinePageEditor';
import { creationSample, creationTemplates } from '../../src/app/lib/creationTemplates';
import '../../src/styles/index.css';
const initial = mergeWithDefaults({ ...creationSample('personal'), ...creationTemplates('personal')[0].design });
let saved = initial;
const source: PageSource = {
  load: async () => ({ pageData: saved, savedDraftData: saved }),
  backupDraft: async () => {},
  saveDraft: async pageData => { await new Promise(resolve => setTimeout(resolve, 400)); saved = pageData; return { pageData }; },
  save: async pageData => ({ pageData }),
};
createRoot(document.getElementById('root')!).render(<PageProvider source={source}><InlinePageEditor localOnly onBack={() => {}} onAdvanced={() => {}} onContinue={() => {}} /></PageProvider>);
