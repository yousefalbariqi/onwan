import { Navigate, useSearchParams } from 'react-router';

// Keep old links working while making the landing page the single focused
// registration surface.
export default function Signup() {
  const [searchParams] = useSearchParams();
  const username = (searchParams.get('username') || '').toLowerCase();
  return <Navigate to={username ? `/?auth=signup&username=${encodeURIComponent(username)}` : '/?focus=name'} replace />;
}
