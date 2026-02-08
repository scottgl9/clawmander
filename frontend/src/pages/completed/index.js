import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CompletedRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/completed/agent'); }, [router]);
  return null;
}
