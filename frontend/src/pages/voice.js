import { useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/layout/Layout';

const VoicePage = dynamic(() => import('../components/voice/VoicePage'), { ssr: false });

export default function VoicePageRoute() {
  const [connected, setConnected] = useState(false);

  return (
    <Layout connected={connected} noPadding>
      <VoicePage onConnectionChange={setConnected} />
    </Layout>
  );
}
