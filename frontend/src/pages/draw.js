import { useState } from 'react';
import Layout from '../components/layout/Layout';
import DrawPage from '../components/drawings/DrawPage';

export default function DrawPageRoute() {
  const [connected, setConnected] = useState(false);

  return (
    <Layout connected={connected} noPadding>
      <DrawPage onConnectionChange={setConnected} />
    </Layout>
  );
}
