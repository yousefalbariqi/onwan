import { useSearchParams } from 'react-router';
import JourneyLanding from './JourneyLanding';
import AuthModal from '../components/AuthModal';

// Old campaign and authentication links still enter the shared account journey.
export default function Landing() {
  const [params] = useSearchParams();
  const mode = params.get('auth');
  const signup = mode === 'signup' || params.get('focus') === 'name';
  return <><JourneyLanding kind="standard" />{(signup || mode === 'login') && <AuthModal mode={signup ? 'signup' : 'login'} username={params.get('username') || undefined} />}</>;
}
