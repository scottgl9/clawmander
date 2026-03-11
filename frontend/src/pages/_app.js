import '../styles/globals.css';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../context/AuthContext';

const PUBLIC_PATHS = ['/login', '/register'];

function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(router.pathname);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
