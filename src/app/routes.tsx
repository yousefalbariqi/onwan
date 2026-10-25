import { NonprofitAuth, NonprofitAccount, NonprofitBuilder, NonprofitQuote, NonprofitGate } from './pages/NonprofitPortal';
import { NonprofitOnboarding } from './pages/NonprofitOnboarding';
import PartnerOrderEditor from './partner/PartnerOrderEditor';
import PartnerSale from './partner/PartnerSale';
import PartnerStorefront from './partner/PartnerStorefront';
import { createBrowserRouter, Navigate, Outlet, useRouteError, useNavigate } from 'react-router';
import { PageProvider } from './context/PageContext';
import Landing from './pages/Landing';
import NonprofitLanding from './pages/NonprofitLanding';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Builder from './pages/Builder';
import PublicPage from './pages/PublicPage';
import PlanSelection from './pages/PlanSelection';
import { DemoPayment, DemoPaymentSuccess } from './pages/DemoPayment';
import Renewal from './pages/Renewal';
import AdminApp from './admin/AdminApp';
import StaffPageEditor from './admin/StaffPageEditor';
import PartnerPortal from './partner/PartnerPortal';
import { PartnerApply, PayOrder, Welcome } from './partner/PartnerPublic';
import { getCustomHost, getSubdomainUsername, isNonprofitHost } from './lib/site';
import { Home } from 'lucide-react';

// On name.onwan.link — or on the entity's own domain (DOMAIN-03) — the root
// path is that entity's public page; on the main domain it is the landing page.
function RootPage() {
  if (isNonprofitHost()) return <NonprofitLanding />;
  return getSubdomainUsername() || getCustomHost() ? <PublicPage /> : <Landing />;
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

export const router = createBrowserRouter(isNonprofitHost() ? [
  { path: '/', element: <PageProvider><Outlet /></PageProvider>, errorElement: <ErrorBoundary />, children: [
    { index: true, element: <NonprofitLanding /> },
    { path: 'signup', element: <NonprofitAuth mode="signup" /> },
    { path: 'login', element: <NonprofitAuth mode="login" /> },
    { path: 'reset-password', element: <ResetPassword /> },
    { path: 'account', element: <NonprofitAccount /> },
    { path: 'builder', element: <NonprofitBuilder /> },
    { path: 'onboarding', element: <NonprofitGate><NonprofitOnboarding /></NonprofitGate> },
    { path: 'quote', element: <NonprofitQuote /> },
  ] },
  { path: '*', element: <Navigate to="/" replace /> },
] : [
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
        path: 'nonprofit',
        element: <NonprofitLanding />,
      },
      {
        path: 'nonprofit/signup', element: <NonprofitAuth mode="signup" />,
      }, { path: 'nonprofit/login', element: <NonprofitAuth mode="login" />,
      }, { path: 'nonprofit/account', element: <NonprofitAccount />,
      }, { path: 'nonprofit/builder', element: <NonprofitBuilder />,
      }, { path: 'nonprofit/onboarding', element: <NonprofitGate><NonprofitOnboarding /></NonprofitGate>,
      }, { path: 'nonprofit/quote', element: <NonprofitQuote />,
      }, { path: 'nonprofit/reset-password', element: <ResetPassword />,
      }, {
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
        path: 'payment/demo',
        element: <DemoPayment />,
      },
      {
        path: 'payment/success',
        element: <DemoPaymentSuccess />,
      },
      {
        path: 'renewal',
        element: <Renewal />,
      },
      {
        path: 'admin',
        element: <AdminApp />,
      },
      {
        path: 'admin/edit/:userId',
        element: <StaffPageEditor />,
      },
      {
        path: 'partners',
        element: <PartnerApply />,
      },
      {
        path: 'partner',
        element: <PartnerPortal />,
      },
      {
        path: 'partner/new',
        element: <PartnerSale />,
      },
      {
        path: 'partner/edit/:orderId',
        element: <PartnerOrderEditor />,
      },
      {
        path: 'via/:partnerId',
        element: <PartnerStorefront />,
      },
      {
        path: 'pay/:token',
        element: <PayOrder />,
      },
      {
        path: 'welcome/:token',
        element: <Welcome />,
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
