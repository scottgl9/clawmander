import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/authApi';
import ExecApprovals from '../components/settings/ExecApprovals';
import GatewaySettings from '../components/settings/GatewaySettings';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'gateway', label: 'Gateway' },
];

export default function SettingsPage() {
  const { user, updateUser, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      await updateUser({ name, email });
      setProfileMsg({ ok: true, text: 'Profile updated' });
    } catch (err) {
      setProfileMsg({ ok: false, text: err.message || 'Update failed' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) { setPwMsg({ ok: false, text: 'Passwords do not match' }); return; }
    setPwLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword }, getToken());
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ ok: true, text: 'Password changed. Other sessions have been signed out.' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message || 'Password change failed' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <Layout connected>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-white">Settings</h1>

        {/* Tab bar */}
        <div className="flex border-b border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'text-white border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <>
            {/* Profile section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Profile</h2>
              <form onSubmit={handleProfileSave} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
                {profileMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg border ${profileMsg.ok ? 'text-green-400 bg-green-950/30 border-green-900/50' : 'text-red-400 bg-red-950/30 border-red-900/50'}`}>
                    {profileMsg.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {profileLoading ? 'Saving...' : 'Save profile'}
                </button>
              </form>
            </div>

            {/* Password section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Change password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
                {pwMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg border ${pwMsg.ok ? 'text-green-400 bg-green-950/30 border-green-900/50' : 'text-red-400 bg-red-950/30 border-red-900/50'}`}>
                    {pwMsg.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {pwLoading ? 'Changing...' : 'Change password'}
                </button>
              </form>
            </div>

            {/* Account info */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Account</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Role</span>
                  <span className="text-gray-300">{user?.role || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Member since</span>
                  <span className="text-gray-300">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last login</span>
                  <span className="text-gray-300">{user?.last_login ? new Date(user.last_login).toLocaleString() : '—'}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Security tab */}
        {activeTab === 'security' && <ExecApprovals />}

        {/* Gateway tab */}
        {activeTab === 'gateway' && <GatewaySettings />}
      </div>
    </Layout>
  );
}
