import { useState } from 'react';
import Layout from '../components/layout/Layout';
import ChatPage from '../components/chat/ChatPage';

export default function ChatPageRoute() {
  const [connected, setConnected] = useState(false);

  return (
    <Layout connected={connected}>
      <div className="h-full -m-3 md:-m-6">
        <ChatPage onConnectionChange={setConnected} />
      </div>
    </Layout>
  );
}
