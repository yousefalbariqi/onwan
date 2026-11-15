import { useSearchParams, Navigate } from 'react-router';
import JourneyLanding from './JourneyLanding';
import AuthModal from '../components/AuthModal';

// Legacy start links enter the guest creation journey; login keeps its existing entry.
export default function Landing() {
  const [params] = useSearchParams();
  const mode = params.get('auth');
  const signup = mode === 'signup' || params.get('focus') === 'name';
  if (signup) return <Navigate to={params.get('username') ? `/signup?username=${encodeURIComponent(params.get('username')!)}` : '/signup'} replace />;
  return <><JourneyLanding kind="standard" />{mode === 'login' && <AuthModal mode="login" />}</>;
}
