import React, { useState } from 'react';
import { BudgetConfig, Transaction, BankAccount, CURRENCY_OPTIONS } from '../types';
import { ImportTransactionsModal } from './ImportTransactionsModal';
import { updateUserProfileName } from '../firebase';
import { getGeminiApiKey, setGeminiApiKey } from '../services/gemini';

interface ProfileViewProps {
  config: BudgetConfig;
  onUpdateConfig: (updated: Partial<BudgetConfig>) => void;
  transactions: Transaction[];
  onResetDemoData: () => void;
  onImportTransactions?: (imported: Transaction[], replaceAll?: boolean) => void;
  accounts?: BankAccount[];
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onLoginWithGoogle?: () => void;
  onLogoutGoogle?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  config,
  onUpdateConfig,
  transactions,
  onResetDemoData,
  onImportTransactions,
  accounts = [],
  currentUser,
  onLoginWithGoogle,
  onLogoutGoogle,
}) => {
  const sym = config.currencySymbol || '$';
  const currentCode = config.currencyCode || 'USD';

  const [monthlyTargetInput, setMonthlyTargetInput] = useState(config.monthlyTarget.toString());
  const [savedMsg, setSavedMsg] = useState('');
  const [currencySavedMsg, setCurrencySavedMsg] = useState('');
  const [customSymbolInput, setCustomSymbolInput] = useState(sym);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.displayName || config.userName || '');
  const [nameSavedMsg, setNameSavedMsg] = useState('');

  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey());
  const [geminiSavedMsg, setGeminiSavedMsg] = useState('');

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleInstalled = () => {
      setIsInstalledApp(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalledApp(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleTriggerPwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalledApp(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install Luminous Finance as a standalone app on your phone:\n\n' +
        '• Android (Chrome): Tap browser menu (⋮) -> "Install App" or "Add to Home screen"\n' +
        '• iPhone (iOS Safari): Tap Share button (⎋) -> "Add to Home Screen"'
      );
    }
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKeyInput);
    setGeminiSavedMsg('Gemini API key updated successfully!');
    setTimeout(() => setGeminiSavedMsg(''), 2500);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    onUpdateConfig({ userName: trimmed });
    if (currentUser) {
      await updateUserProfileName(trimmed);
    }
    setIsEditingName(false);
    setNameSavedMsg('User name updated successfully!');
    setTimeout(() => setNameSavedMsg(''), 2500);
  };

  const totalExpenseCount = transactions.filter((t) => t.type === 'expense').length;
  const totalIncomeCount = transactions.filter((t) => t.type === 'income').length;
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleSaveBudget = () => {
    const val = parseFloat(monthlyTargetInput);
    if (!isNaN(val) && val > 0) {
      onUpdateConfig({ monthlyTarget: val });
      setSavedMsg('Monthly target updated successfully!');
      setTimeout(() => setSavedMsg(''), 2500);
    }
  };

  const handleSelectCurrency = (code: string, symbol: string) => {
    onUpdateConfig({ currencyCode: code, currencySymbol: symbol });
    setCustomSymbolInput(symbol);
    setCurrencySavedMsg(`Currency updated to ${code} (${symbol})`);
    setTimeout(() => setCurrencySavedMsg(''), 2500);
  };

  const handleSaveCustomSymbol = () => {
    if (customSymbolInput.trim()) {
      onUpdateConfig({ currencySymbol: customSymbolInput.trim() });
      setCurrencySavedMsg(`Currency symbol updated to '${customSymbolInput.trim()}'`);
      setTimeout(() => setCurrencySavedMsg(''), 2500);
    }
  };

  const handleExportCSV = () => {
    const accList = accounts || [];
    const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Account', 'Memo', 'Payee'];
    const rows = transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${(accList.find((a) => a.id === t.accountId)?.name || t.accountId || '').replace(/"/g, '""')}"`,
      `"${(t.memo || '').replace(/"/g, '""')}"`,
      `"${(t.payee || t.person || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `luminous_finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 mt-2 flex flex-col gap-6 mb-16">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#5cb8fd] shadow-md shrink-0 bg-[#f0f4f8]">
          <img
            src={currentUser?.photoURL || config.userAvatar}
            alt="Profile"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          {isEditingName ? (
            <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md my-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                placeholder="Enter your name..."
                className="px-3.5 py-1.5 bg-[#f0f4f8] border border-[#006397]/40 rounded-xl text-base font-bold text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397] w-full"
                autoFocus
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleSaveName}
                  className="px-3.5 py-1.5 bg-[#006397] text-white text-xs font-bold rounded-xl hover:bg-[#00476e] transition-all shadow-2xs"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setNameInput(currentUser?.displayName || config.userName || '');
                    setIsEditingName(false);
                  }}
                  className="px-3.5 py-1.5 bg-[#f0f2f5] text-[#44474c] text-xs font-bold rounded-xl hover:bg-[#e1e3e4] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl font-bold text-[#191c1d] flex items-center gap-2 justify-center sm:justify-start">
                <span>{currentUser?.displayName || config.userName}</span>
                <button
                  onClick={() => {
                    setNameInput(currentUser?.displayName || config.userName || '');
                    setIsEditingName(true);
                  }}
                  className="p-1 rounded-lg text-[#006397] hover:bg-[#006397]/10 transition-all flex items-center justify-center shrink-0"
                  title="Edit user name"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#5cb8fd]/20 text-[#00476e] text-xs font-semibold self-center sm:self-auto flex items-center gap-1">
                {currentUser ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#00a656]"></span>
                    Cloud Synced
                  </>
                ) : (
                  'Local Device'
                )}
              </span>
            </div>
          )}
          {nameSavedMsg && (
            <p className="text-xs font-bold text-[#00a656] mt-1 animate-in fade-in flex items-center gap-1 justify-center sm:justify-start">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              {nameSavedMsg}
            </p>
          )}
          <p className="text-xs text-[#44474c] mt-1">
            {currentUser?.email ? `Gmail: ${currentUser.email} • ` : ''}Dynamic Pacing Engine • Payday Anchor: Day {config.paydayAnchorDay} • Currency: {currentCode} ({sym})
          </p>
        </div>
      </div>

      {/* Standalone Mobile PWA App Card (hidden if app is already installed) */}
      {!isInstalledApp && (
        <div className="bg-gradient-to-r from-[#00476e] via-[#006397] to-[#0082c4] rounded-2xl p-5 text-white shadow-lg border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <img
              src="/icon-192.png"
              alt="Luminous App Icon"
              className="w-14 h-14 rounded-2xl shadow-md border-2 border-white/30 shrink-0 mx-auto sm:mx-0"
            />
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight flex items-center gap-2 justify-center sm:justify-start">
                <span>Install Luminous App</span>
              </h3>
              <p className="text-xs text-[#92ccff] font-medium mt-0.5 max-w-md">
                Run as a standalone native app on Android & iOS without address bars or browser frames.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerPwaInstall}
            className="w-full sm:w-auto px-5 py-2.5 bg-white text-[#00476e] hover:bg-[#f0f4f8] font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-[#006397]">install_mobile</span>
            <span>Install Standalone App</span>
          </button>
        </div>
      )}

      {/* Gmail Login & Multi-Device Sync Card */}
      <div className="bg-gradient-to-br from-white via-[#f8fbfe] to-[#eef6fc] rounded-2xl p-6 shadow-ambient border border-[#006397]/20 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191c1d] flex items-center gap-2">
                Gmail & Multi-Device Sync
              </h3>
              <p className="text-xs text-[#44474c] mt-0.5 max-w-xl leading-relaxed">
                Log in with your Gmail account to save your financial data, accounts, budgets, and transactions in Firestore Cloud. Access your real-time financial ledger seamlessly on any phone, tablet, or laptop!
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {currentUser ? (
              <button
                onClick={onLogoutGoogle}
                className="px-4 py-2.5 bg-[#fce8e6] hover:bg-[#fad2cf] text-[#c5221f] font-bold text-xs sm:text-sm rounded-xl transition-all border border-[#f5c2c0] flex items-center gap-2 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out ({currentUser.email?.split('@')[0]})
              </button>
            ) : (
              <button
                onClick={onLoginWithGoogle}
                className="px-5 py-2.5 bg-[#006397] hover:bg-[#00476e] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-95"
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
                Sign In with Gmail
              </button>
            )}
          </div>
        </div>

        {currentUser && (
          <div className="bg-white/80 p-3 rounded-xl border border-[#006397]/15 flex items-center gap-2 text-xs text-[#006397] font-semibold">
            <span className="material-symbols-outlined text-[18px] text-[#00a656]">cloud_done</span>
            <span>Real-time Firestore synchronization active for <strong>{currentUser.email}</strong></span>
          </div>
        )}
      </div>

      {/* Gemini AI API Key Configuration Card */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#191c1d] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006397]">auto_awesome</span>
              Gemini AI Integration Key
            </h3>
            <p className="text-xs text-[#44474c] mt-0.5">
              Power automated receipt OCR scanning and natural language spending entry using Google Gemini 2.5 Flash.
            </p>
          </div>
          <span className={`whitespace-nowrap shrink-0 px-3 py-1 font-bold text-xs rounded-full self-start sm:self-auto flex items-center gap-1 ${
            getGeminiApiKey() ? 'bg-[#00a656]/15 text-[#00a656]' : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
          }`}>
            <span className="material-symbols-outlined text-[14px]">key</span>
            {getGeminiApiKey() ? 'Key Active' : 'Key Missing'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mt-1">
          <div className="relative flex-1">
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="Paste your Gemini API key (AIzaSy...)"
              className="w-full px-4 py-2.5 bg-[#f3f4f5] rounded-xl text-sm font-mono text-[#191c1d] border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397]"
            />
          </div>
          <button
            onClick={handleSaveGeminiKey}
            className="px-6 py-2.5 bg-[#006397] text-white font-semibold text-sm rounded-xl hover:bg-[#00476e] transition-colors shrink-0"
          >
            Save API Key
          </button>
        </div>

        {geminiSavedMsg && (
          <p className="text-xs text-[#00a656] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {geminiSavedMsg}
          </p>
        )}
      </div>

      {/* Currency Settings Card */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#191c1d] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006397]">payments</span>
              Currency Settings
            </h3>
            <p className="text-xs text-[#44474c] mt-0.5">
              Select your preferred global display currency across all ledger transactions, pacing indicators, and budget limits.
            </p>
          </div>
          <span className="whitespace-nowrap shrink-0 px-3 py-1 bg-[#006397]/10 text-[#006397] font-bold text-xs rounded-full self-start sm:self-auto">
            Active: {currentCode} ({sym})
          </span>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mt-1">
          <div className="relative flex-1">
            <select
              value={currentCode}
              onChange={(e) => {
                const opt = CURRENCY_OPTIONS.find((c) => c.code === e.target.value);
                if (opt) {
                  handleSelectCurrency(opt.code, opt.symbol);
                }
              }}
              className="w-full px-4 py-2.5 bg-[#f3f4f5] rounded-xl text-sm font-semibold text-[#191c1d] border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397] appearance-none cursor-pointer"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#74777d] pointer-events-none text-[20px]">
              expand_more
            </span>
          </div>

          {/* Custom Symbol Tweaker */}
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <span className="text-[10px] text-[#74777d] font-semibold absolute -top-2.5 left-2 bg-white px-1">
                Symbol
              </span>
              <input
                type="text"
                value={customSymbolInput}
                onChange={(e) => setCustomSymbolInput(e.target.value)}
                maxLength={4}
                className="w-full px-3 py-2 bg-[#f3f4f5] rounded-xl text-sm font-bold text-center border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397]"
              />
            </div>
            <button
              onClick={handleSaveCustomSymbol}
              className="px-4 py-2 bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] font-semibold text-xs rounded-xl border border-[#d2e4fb] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Popular Quick Select Chips */}
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="text-xs text-[#44474c] font-semibold flex items-center mr-1">Quick Select:</span>
          {CURRENCY_OPTIONS.slice(0, 8).map((c) => (
            <button
              key={c.code}
              onClick={() => handleSelectCurrency(c.code, c.symbol)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                currentCode === c.code && sym === c.symbol
                  ? 'bg-[#006397] text-white shadow-2xs'
                  : 'bg-[#f3f4f5] text-[#44474c] hover:bg-[#e1e3e4]'
              }`}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>

        {currencySavedMsg && (
          <p className="text-xs text-[#00a656] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {currencySavedMsg}
          </p>
        )}
      </div>

      {/* Target Budget Setting */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#191c1d]">Monthly Budget Goal</h3>
        <p className="text-xs text-[#44474c]">
          Set your overall monthly pacing target. Your daily allowance will adapt dynamically based on your remaining funds.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777d] font-bold">{sym}</span>
            <input
              type="number"
              value={monthlyTargetInput}
              onChange={(e) => setMonthlyTargetInput(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-[#f3f4f5] rounded-xl text-sm font-semibold text-[#191c1d] border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397]"
            />
          </div>
          <button
            onClick={handleSaveBudget}
            className="px-6 py-2.5 bg-[#006397] text-white font-semibold text-sm rounded-xl hover:bg-[#00476e] transition-colors"
          >
            Update Target
          </button>
        </div>

        {savedMsg && <p className="text-xs text-[#00a656] font-semibold">{savedMsg}</p>}
      </div>

      {/* Analytics Summary Card */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#e1e3e4]">
          <span className="text-xs text-[#44474c] block">Total Logged</span>
          <span className="text-xl font-bold text-[#191c1d]">{transactions.length} txs</span>
        </div>
        <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#e1e3e4]">
          <span className="text-xs text-[#44474c] block">Total Income</span>
          <span className="text-xl font-bold text-[#00a656]">+{sym}{totalIncome.toFixed(2)}</span>
        </div>
        <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#e1e3e4]">
          <span className="text-xs text-[#44474c] block">Total Spent</span>
          <span className="text-xl font-bold text-[#ba1a1a]">-{sym}{totalExpenses.toFixed(2)}</span>
        </div>
        <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#e1e3e4]">
          <span className="text-xs text-[#44474c] block">Net Savings</span>
          <span className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
            {sym}{(totalIncome - totalExpenses).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Data Operations */}
      <div className="bg-white rounded-2xl p-6 shadow-ambient border border-[#e1e3e4] flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#191c1d]">Data & Maintenance</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="py-3 px-4 bg-[#006397] text-white font-semibold text-sm rounded-xl hover:bg-[#00476e] transition-colors flex items-center justify-center gap-2 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            Import CSV
          </button>

          <button
            onClick={handleExportCSV}
            className="py-3 px-4 bg-[#f3f4f5] text-[#006397] font-semibold text-sm rounded-xl hover:bg-[#e1e3e4] transition-colors flex items-center justify-center gap-2 border border-[#c4c6cd]/20"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>

          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="py-3 px-4 bg-[#ffdad6]/60 text-[#ba1a1a] font-semibold text-sm rounded-xl hover:bg-[#ffdad6] transition-colors flex items-center justify-center gap-2 border border-[#ba1a1a]/20 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Reset All Data
          </button>
        </div>
      </div>

      {/* Import Transactions Modal */}
      <ImportTransactionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(imported, replaceAll) => {
          if (onImportTransactions) {
            onImportTransactions(imported, replaceAll);
          }
        }}
        accounts={accounts}
      />

      {/* Styled Reset Confirmation Popup Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#ffdad6] flex flex-col gap-5 text-center relative animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-[#ffdad6]/60 text-[#ba1a1a] flex items-center justify-center mx-auto shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-xl font-extrabold text-[#191c1d]">Reset All Financial Data?</h3>
              <p className="text-xs text-[#44474c] leading-relaxed">
                This action will permanently wipe all your logged transactions, custom income/expense entries, fixed bills, and reset accounts to zero balance.
              </p>
            </div>

            <div className="p-3 bg-[#fff8f6] rounded-xl border border-[#ffdad6] text-[11px] text-[#93000a] text-left flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#ba1a1a] shrink-0 mt-0.5">info</span>
              <span>Warning: This cannot be undone. Make sure to export a CSV backup first if you want to keep your record.</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl border border-[#c2c7cf] text-[#44474c] hover:bg-[#f0f4f8] font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  onResetDemoData();
                }}
                className="py-2.5 px-4 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Yes, Reset All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
