import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children, connected }) {
  return (
    <div className="h-screen flex flex-col">
      <Header connected={connected} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
