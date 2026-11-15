import CreationAccount from './CreationAccount';
import { creationSession } from '../lib/creationCloud';
import CreationEmailSave from './CreationEmailSave';
import CreationTemplates from './CreationTemplates';
import CreationTrialEditor from './CreationTrialEditor';
import { useSearchParams, Navigate } from 'react-router';
import CreationStart from './CreationStart';
import { AccountEntry } from '../components/AccountEntry';
export default function Signup() {
  const [params] = useSearchParams();
  if (params.get('step') === 'templates') return <CreationTemplates />;
  if (params.get('step') === 'complete') return <CreationAccount />;
  if (params.get('step') === 'save') return <CreationEmailSave />;
  if (params.get('step') === 'edit') return creationSession() ? <CreationTrialEditor /> : <Navigate to="/signup?step=save" replace />;
  if (params.get('step') !== 'account') return <CreationStart />;
  return <AccountEntry mode="signup" username={params.get('username') || undefined} />;
}
