import { useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/layout/Layout';

const TerminalView = dynamic(() => import('../components/terminal/TerminalView'), { ssr: false });

export default function TerminalPage() {
  const [connected] = useState(true);

  return (
    <Layout connected={connected} noPadding>
      <TerminalView />
    </Layout>
  );
}
