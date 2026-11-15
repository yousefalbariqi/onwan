import { useSearchParams } from 'react-router';
import { AccountEntry } from '../components/AccountEntry';
export default function Signup() {
  const [params] = useSearchParams();
  return <AccountEntry mode="signup" username={params.get('username') || undefined} />;
}
