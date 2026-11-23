// Local Vite verification harness for the actual checkout component.
// No login simulation, saved customer data, publication, or activation.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import PaddleSandboxCheckout from '../../src/app/components/PaddleSandboxCheckout';
import '../../src/styles/subscription-checkout.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter><PaddleSandboxCheckout ready features={[]} retry={() => {}} saveDraft={async () => {}} /></MemoryRouter>);
