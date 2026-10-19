import { Navigate } from 'react-router';

// Keep bookmarked login URLs valid while showing the compact modal over the
// product landing page.
export default function Login() {
  return <Navigate to="/?auth=login" replace />;
}
