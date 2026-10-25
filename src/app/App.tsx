import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ROOT_DOMAIN, getSubdomainUsername } from './lib/site';

// Note 75: a customer's subdomain is only their public page. Any other path
// there (/admin, /builder, /login…) belongs to the main site, so a visitor is
// never shown platform screens under a customer's address.
if (typeof window !== 'undefined' && getSubdomainUsername() && window.location.pathname !== '/') {
  window.location.replace(`https://${ROOT_DOMAIN}${window.location.pathname}${window.location.search}`);
}

export default function App() {
  return <RouterProvider router={router} />;
}
