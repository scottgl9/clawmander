import '../styles/globals.css';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../context/AuthContext';

const PUBLIC_PATHS = ['/login', '/register'];

function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(router.pathname);

  // Check if a token exists — if so, optimistically render children while
  // auth validates in the background.  This keeps the DOM mounted so scroll
  // position, form state, etc. are preserved across refresh.
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  if (loading && !hasToken) {
    // No stored token → show skeleton (first visit / logged out)
    return (
      <div className="h-screen flex flex-col bg-gray-950" style={{ height: '100dvh' }}>
        <div className="flex items-center justify-between px-3 md:px-6 py-3 bg-surface border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide">Clawmander</h1>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[4.5rem] bg-surface-light border-r border-gray-800 flex-shrink-0 hidden md:block" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // While loading with a token, render children optimistically (keeps scroll position)
  if (loading && hasToken) {
    return children;
  }

  if (!isAuthenticated && !isPublic) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  if (isAuthenticated && isPublic) {
    if (typeof window !== 'undefined') router.replace('/');
    return null;
  }

  return children;
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </AuthProvider>
  );
}
