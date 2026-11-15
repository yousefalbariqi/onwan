import { useSearchParams } from 'react-router';
import { AccountEntry } from '../components/AccountEntry';
export default function Login() { const [params] = useSearchParams(); return <AccountEntry mode="login" initialEmail={params.get('email') || ''} />; }
