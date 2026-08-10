import React, { useState } from 'react';
import { TabType, BudgetConfig } from '../types';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  config: BudgetConfig;
  totalIncome: number;
  totalExpenses: number;
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onLoginWithGoogle?: () => void;
  onLogoutGoogle?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'error' | 'idle';
  lastSyncedAt?: string | null;
  onManualSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  totalIncome,
  totalExpenses,
  currentUser,
  onLoginWithGoogle,
  onLogoutGoogle,
  syncStatus = 'idle',
  lastSyncedAt,
  onManualSync,
}) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandaloneApp(true);
      setDeferredPrompt(null);
    };

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsStandaloneApp(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const activePrompt = (window as any).deferredInstallPrompt || deferredPrompt;
    if (activePrompt) {
      try {
        activePrompt.prompt();
        const { outcome } = await activePrompt.userChoice;
        if (outcome === 'accepted') {
          setIsStandaloneApp(true);
        }
        (window as any).deferredInstallPrompt = null;
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA install error:', err);
        setActiveTab('profile');
      }
    } else {
      setActiveTab('profile');
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-[#e1e3e4] shadow-xs transition-all">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col gap-2.5">
          {/* Top Row: Logo & User Info + Wallet Button + Gmail Auth */}
          <div className="flex justify-between items-center w-full shrink-0">
            {/* Leading: Avatar + Title */}
            <div
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
              onClick={() => setActiveTab('profile')}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#f0f4f8] overflow-hidden shadow-2xs border-2 border-[#006397]/20 flex-shrink-0 group-hover:border-[#006397] transition-all">
                <img
                  src={currentUser?.photoURL || config.userAvatar}
                  alt="User Profile Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-[#041627] tracking-tight leading-none flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                  <span className="material-symbols-outlined text-[#006397] text-[18px] sm:text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  <span>Luminous Finance</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#006397] uppercase tracking-wider mt-0.5 hidden sm:block">
                  Smart Pacing Engine
                </span>
              </div>
            </div>

            {/* Trailing: Wallet Icon Button & Google Login Button */}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <button
                  onClick={onManualSync}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all active:scale-95 text-xs font-bold shrink-0 ${
                    syncStatus === 'syncing'
                      ? 'bg-[#e0f2fe] border-[#38bdf8] text-[#0284c7]'
                      : syncStatus === 'error'
                      ? 'bg-[#ffebe9] border-[#ff8e88] text-[#c5221f]'
                      : 'bg-[#e6f4ea] border-[#ceead6] text-[#137333]'
                  }`}
                  title={lastSyncedAt ? `Last cloud sync at ${lastSyncedAt}. Click to force sync.` : 'Click to sync with cloud.'}
                >
                  <span className={`material-symbols-outlined text-[16px] ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}>
                    {syncStatus === 'syncing' ? 'sync' : syncStatus === 'error' ? 'sync_problem' : 'cloud_done'}
                  </span>
                  <span className="hidden sm:inline">
                    {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Issue' : 'Synced'}
                  </span>
                  {lastSyncedAt && syncStatus === 'synced' && (
                    <span className="text-[10px] font-mono opacity-80 hidden md:inline">({lastSyncedAt})</span>
                  )}
                </button>
              ) : (
                <button
                  onClick={onLoginWithGoogle}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#006397] hover:bg-[#00476e] text-white transition-all active:scale-95 shadow-2xs shrink-0 text-xs font-bold"
                  title="Sign in with Gmail to sync data across all devices"
                >
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Gmail Sync</span>
                  <span className="sm:hidden">Login</span>
                </button>
              )}

              {!isStandaloneApp && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00476e] to-[#006397] hover:from-[#003857] hover:to-[#00476e] text-white transition-all active:scale-95 shadow-2xs shrink-0 text-xs font-bold"
                  title="Install Luminous Finance as a standalone native app"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#92ccff]">install_mobile</span>
                  <span className="hidden sm:inline">Install App</span>
                </button>
              )}

              <button
                onClick={() => setShowWalletModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] border border-[#d2e4fb] transition-all active:scale-95 shadow-2xs shrink-0"
                title="Wallet summary"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  account_balance_wallet
                </span>
                <span className="text-xs font-bold text-[#041627]">
                  {config.currencySymbol || '$'}{(totalIncome - totalExpenses).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </button>
            </div>
          </div>

          {/* Dedicated Navigation Bar Row Below Top Header */}
          <nav className="hidden md:flex items-center justify-center gap-1.5 bg-[#f0f4f8] p-1.5 rounded-2xl border border-[#d2e4fb]/60 shadow-inner w-full overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              <span>Accounts</span>
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Ledger</span>
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'add'
                  ? 'bg-[#00a656] text-white shadow-sm'
                  : 'bg-[#00a656]/15 text-[#008243] hover:bg-[#00a656]/25'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Add</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">insights</span>
              <span>Reports</span>
            </button>
            <button
              onClick={() => setActiveTab('budgets')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'budgets'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">pie_chart</span>
              <span>Budgets</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-[#006397] text-white shadow-sm'
                  : 'text-[#44474c] hover:bg-white/80 hover:text-[#006397]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
              <span>Profile</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Wallet Quick Summary Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041627]/40 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full max-h-[88vh] shadow-2xl border border-[#c4c6cd]/20 relative overflow-y-auto my-auto">
            <button
              onClick={() => setShowWalletModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f3f4f5] flex items-center justify-center text-[#44474c] hover:bg-[#e1e3e4]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#5cb8fd]/20 text-[#006397] flex items-center justify-center">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[#041627]">Wallet Overview</h3>
                <p className="text-xs text-[#44474c]">Monthly Cashflow ({config.currencyCode || 'USD'})</p>
              </div>
            </div>

            <div className="space-y-3 bg-[#f8f9fa] p-4 rounded-xl border border-[#e1e3e4]/60 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-[#44474c]">Total Income:</span>
                <span className="font-semibold text-[#00a656]">+{config.currencySymbol || '$'}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#44474c]">Total Expenses:</span>
                <span className="font-semibold text-[#ba1a1a]">-{config.currencySymbol || '$'}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-[#e1e3e4] pt-2 flex justify-between text-sm font-bold">
                <span className="text-[#041627]">Net Cashflow:</span>
                <span className={totalIncome - totalExpenses >= 0 ? "text-[#00a656]" : "text-[#ba1a1a]"}>
                  {config.currencySymbol || '$'}{(totalIncome - totalExpenses).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowWalletModal(false);
                setActiveTab('add');
              }}
              className="w-full py-3 bg-[#006397] text-white font-medium rounded-xl hover:bg-[#00476e] transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Transaction
            </button>
          </div>
        </div>
      )}
    </>
  );
};
