import { createBrowserRouter, Navigate, Outlet, useRouteError, useNavigate } from 'react-router';
import { PageProvider } from './context/PageContext';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Builder from './pages/Builder';
import PublicPage from './pages/PublicPage';
import PlanSelection from './pages/PlanSelection';
import AdminApp from './admin/AdminApp';
import { getSubdomainUsername } from './lib/site';
import { Home } from 'lucide-react';

// On name.onwan.link the root path is that entity's public page (ACCT-03);
// on the main domain it is the product landing page.
function RootPage() {
  return getSubdomainUsername() ? <PublicPage /> : <Landing />;
}

function ErrorBoundary() {
  const error = useRouteError() as Error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            عذراً، حدث خطأ
          </h1>
          <p className="text-gray-600 mb-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {error?.message || 'حدث خطأ غير متوقع'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-lime-500 to-emerald-500 text-white px-6 py-3 rounded-full font-bold hover:shadow-lg transition-all"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Home className="w-5 h-5" />
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          الصفحة غير موجودة
        </h1>
        <p className="text-gray-600 mb-6" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 bg-gradient-to-r from-lime-500 to-emerald-500 text-white px-6 py-3 rounded-full font-bold hover:shadow-lg transition-all mx-auto"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Home className="w-5 h-5" />
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <PageProvider>
        <Outlet />
      </PageProvider>
    ),
    children: [
      {
        index: true,
        element: <RootPage />,
      },
      {
        path: 'signup',
        element: <Signup />,
      },
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'reset-password',
        element: <ResetPassword />,
      },
      {
        // Old entry point, kept so existing links do not 404.
        path: 'phone',
        element: <Navigate to="/login" replace />,
      },
      {
        path: 'builder',
        element: <Builder />,
      },
      {
        path: 'preview',
        element: <PublicPage />,
      },
      {
        path: 'plan-selection',
        element: <PlanSelection />,
      },
      {
        path: 'admin',
        element: <AdminApp />,
      },
      {
        path: ':username',
        element: <PublicPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
