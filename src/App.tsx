import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { TabType, Transaction, FixedBill, CategoryTemplate, BudgetConfig, BankAccount } from './types';
import {
  INITIAL_CONFIG,
  INITIAL_TRANSACTIONS,
  INITIAL_FIXED_BILLS,
  INITIAL_CATEGORIES,
  INITIAL_ACCOUNTS,
} from './data/initialData';
import { Header } from './components/Header';
import { BottomNavBar } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { LedgerView } from './components/LedgerView';
import { AddTransactionView } from './components/AddTransactionView';
import { BudgetsView } from './components/BudgetsView';
import { AccountsView } from './components/AccountsView';
import { ReportsView } from './components/ReportsView';
import { ProfileView } from './components/ProfileView';
import { LoginView } from './components/LoginView';

import { getCategoryBreakdown } from './utils/finance';
import {
  listenToAuth,
  loginWithGoogle,
  logoutGoogle,
  subscribeToUserAppData,
  saveUserAppData,
  getUserAppData,
} from './firebase';

function mergeTransactionsById(local: Transaction[], remote: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  if (Array.isArray(local)) {
    local.forEach((t) => {
      if (t && t.id) map.set(t.id, t);
    });
  }
  if (Array.isArray(remote)) {
    remote.forEach((t) => {
      if (t && t.id) map.set(t.id, t);
    });
  }
  return Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  // Scroll to top of the page when activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  // Load state from localStorage or initial defaults
  const [config, setConfig] = useState<BudgetConfig>(() => {
    const saved = localStorage.getItem('luminous_v2_config');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
    const saved = localStorage.getItem('luminous_v2_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('luminous_v2_txs');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [fixedBills, setFixedBills] = useState<FixedBill[]>(() => {
    const saved = localStorage.getItem('luminous_v2_bills');
    return saved ? JSON.parse(saved) : INITIAL_FIXED_BILLS;
  });

  const [categories, setCategories] = useState<CategoryTemplate[]>(() => {
    const saved = localStorage.getItem('luminous_v2_cats');
    if (!saved) return INITIAL_CATEGORIES;
    try {
      return JSON.parse(saved);
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = listenToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        setConfig((prevConfig) => ({
          ...prevConfig,
          userName: user.displayName || prevConfig.userName,
          userAvatar: user.photoURL || prevConfig.userAvatar,
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const isInitialMount = useRef(true);
  const lastSavedJsonRef = useRef('');
  const [syncQuotaNotice, setSyncQuotaNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Subscribe to real-time user data from Firestore when logged in
  useEffect(() => {
    if (!currentUser) {
      setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');

    const unsubscribe = subscribeToUserAppData(currentUser.uid, (data) => {
      const incomingPayload = {
        config: data.config || config,
        accounts: data.accounts || accounts,
        transactions: data.transactions || transactions,
        fixedBills: data.fixedBills || fixedBills,
        categories: data.categories || categories,
      };

      // Set lastSavedJsonRef to incoming payload to prevent snapshot feedback loops
      lastSavedJsonRef.current = JSON.stringify(incomingPayload);

      if (data.config) {
        setConfig({
          ...data.config,
          userName: currentUser.displayName || data.config.userName,
          userAvatar: currentUser.photoURL || data.config.userAvatar,
        });
      }
      if (data.accounts) setAccounts(data.accounts);
      if (data.transactions) setTransactions(data.transactions);
      if (data.fixedBills) setFixedBills(data.fixedBills);
      if (data.categories) setCategories(data.categories);

      setSyncStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSyncQuotaNotice(null);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Sync state changes to Firestore when logged in (debounced & diffed)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!currentUser) return;

    const payload = { config, accounts, transactions, fixedBills, categories };
    const payloadJson = JSON.stringify(payload);

    if (payloadJson === lastSavedJsonRef.current) {
      return;
    }

    setSyncStatus('syncing');

    const timer = setTimeout(async () => {
      lastSavedJsonRef.current = payloadJson;
      const res = await saveUserAppData(currentUser.uid, payload);
      if (res && !res.success && res.reason === 'quota') {
        setSyncQuotaNotice(res.message);
        setSyncStatus('error');
      } else if (res && res.success) {
        setSyncQuotaNotice(null);
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setSyncStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [config, accounts, transactions, fixedBills, categories, currentUser]);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('luminous_v2_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('luminous_v2_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('luminous_v2_txs', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('luminous_v2_bills', JSON.stringify(fixedBills));
  }, [fixedBills]);

  useEffect(() => {
    localStorage.setItem('luminous_v2_cats', JSON.stringify(categories));
  }, [categories]);

  // Login & Logout handlers with Cloud Merge logic
  const handleLoginWithGoogle = async (rememberMe: boolean = true) => {
    try {
      setSyncStatus('syncing');
      const user = await loginWithGoogle(rememberMe);
      if (user) {
        // Fetch existing remote Firestore data before saving local data
        const remoteData = await getUserAppData(user.uid);
        if (remoteData && (remoteData.transactions?.length || remoteData.accounts?.length)) {
          // Cloud has data! Merge local & cloud transactions by unique ID
          const mergedTransactions = mergeTransactionsById(transactions, remoteData.transactions || []);
          const mergedPayload = {
            config: remoteData.config || config,
            accounts: remoteData.accounts || accounts,
            transactions: mergedTransactions,
            fixedBills: remoteData.fixedBills || fixedBills,
            categories: remoteData.categories || categories,
          };
          lastSavedJsonRef.current = JSON.stringify(mergedPayload);
          if (remoteData.config) setConfig(remoteData.config);
          if (remoteData.accounts) setAccounts(remoteData.accounts);
          setTransactions(mergedTransactions);
          if (remoteData.fixedBills) setFixedBills(remoteData.fixedBills);
          if (remoteData.categories) setCategories(remoteData.categories);

          await saveUserAppData(user.uid, mergedPayload);
        } else {
          // New cloud document: seed local data to Firestore
          const initialPayload = { config, accounts, transactions, fixedBills, categories };
          lastSavedJsonRef.current = JSON.stringify(initialPayload);
          await saveUserAppData(user.uid, initialPayload);
        }
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Login failed:', err);
      setSyncStatus('error');
      throw err;
    }
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    try {
      setSyncStatus('syncing');
      const remoteData = await getUserAppData(currentUser.uid);
      if (remoteData) {
        const mergedTransactions = mergeTransactionsById(transactions, remoteData.transactions || []);
        const payload = {
          config: remoteData.config || config,
          accounts: remoteData.accounts || accounts,
          transactions: mergedTransactions,
          fixedBills: remoteData.fixedBills || fixedBills,
          categories: remoteData.categories || categories,
        };
        lastSavedJsonRef.current = JSON.stringify(payload);
        if (remoteData.config) setConfig(remoteData.config);
        if (remoteData.accounts) setAccounts(remoteData.accounts);
        setTransactions(mergedTransactions);
        if (remoteData.fixedBills) setFixedBills(remoteData.fixedBills);
        if (remoteData.categories) setCategories(remoteData.categories);

        await saveUserAppData(currentUser.uid, payload);
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setSyncQuotaNotice(null);
      } else {
        const payload = { config, accounts, transactions, fixedBills, categories };
        lastSavedJsonRef.current = JSON.stringify(payload);
        await saveUserAppData(currentUser.uid, payload);
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logoutGoogle();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Total income & expenses for header/summary
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Actions
  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const tx: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}`,
    };
    setTransactions((prev) => [tx, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTransaction = (id: string, updatedFields: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updatedFields } : t))
    );
  };

  const handleUpdateConfig = (updated: Partial<BudgetConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleStartEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setActiveTab('add');
  };

  const handleClearEditingTransaction = () => {
    setEditingTransaction(null);
  };

  const handleImportTransactions = (imported: Transaction[], replaceAll: boolean = false) => {
    setTransactions((prev) => (replaceAll ? imported : [...imported, ...prev]));
  };

  const handleToggleFixedBill = (id: string) => {
    setFixedBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b))
    );
  };

  const handleAddFixedBill = (bill: Omit<FixedBill, 'id'>) => {
    setFixedBills((prev) => [...prev, { ...bill, id: `bill-${Date.now()}` }]);
  };

  const handleAddCategory = (cat: CategoryTemplate) => {
    setCategories((prev) => [...prev, cat]);
  };

  const handleUpdateCategory = (id: string, updated: Partial<CategoryTemplate>) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, ...updated } : cat))
    );
  };

  const handleDeleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
  };

  const handleReorderCategories = (newCategories: CategoryTemplate[]) => {
    setCategories(newCategories);
  };

  const handleAddAccount = (acc: Omit<BankAccount, 'id'>) => {
    const newAcc: BankAccount = {
      ...acc,
      id: `acc-${Date.now()}`,
    };
    setAccounts((prev) => [...prev, newAcc]);
  };

  const handleUpdateAccount = (id: string, updated: Partial<BankAccount>) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updated } : a))
    );
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleResetDemoData = () => {
    setConfig(INITIAL_CONFIG);
    setAccounts(INITIAL_ACCOUNTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setFixedBills(INITIAL_FIXED_BILLS);
    setCategories(INITIAL_CATEGORIES);
    localStorage.clear();
  };

  if (!currentUser && !guestMode) {
    return (
      <LoginView
        onLoginWithGoogle={handleLoginWithGoogle}
        onGuestContinue={() => setGuestMode(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d] pt-[64px] md:pt-[112px] pb-[85px] landscape:pb-[70px] md:pb-8 flex flex-col antialiased">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        config={config}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        currentUser={currentUser}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogoutGoogle={handleLogoutGoogle}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onManualSync={handleManualSync}
      />

      {syncQuotaNotice && (
        <div className="bg-[#fff8f6] border-b border-[#ffdad6] px-4 py-2.5 text-xs font-medium text-[#93000a] flex items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] shrink-0">info</span>
            <span>{syncQuotaNotice}</span>
          </div>
          <button
            onClick={() => setSyncQuotaNotice(null)}
            className="text-[#ba1a1a] hover:underline text-xs font-bold shrink-0 px-2 py-0.5 rounded hover:bg-[#ffdad6]/30"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Screen Content with motion transitions */}
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            {activeTab === 'dashboard' && (
              <DashboardView
                transactions={transactions}
                categories={categories}
                config={config}
                accounts={accounts}
                fixedBills={fixedBills}
                setActiveTab={setActiveTab}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'ledger' && (
              <LedgerView
                transactions={transactions}
                accounts={accounts}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onStartEditTransaction={handleStartEditTransaction}
                categories={categories}
                setActiveTab={(tab) => {
                  if (tab !== 'add') handleClearEditingTransaction();
                  setActiveTab(tab);
                }}
                config={config}
                onImportTransactions={handleImportTransactions}
              />
            )}

            {activeTab === 'add' && (
              <AddTransactionView
                categories={categories}
                transactions={transactions}
                accounts={accounts}
                onAddTransaction={handleAddTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                editingTransaction={editingTransaction}
                onClearEditingTransaction={handleClearEditingTransaction}
                setActiveTab={(tab) => {
                  handleClearEditingTransaction();
                  setActiveTab(tab);
                }}
                config={config}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onReorderCategories={handleReorderCategories}
              />
            )}

            {activeTab === 'budgets' && (
              <BudgetsView
                config={config}
                onUpdateConfig={handleUpdateConfig}
                fixedBills={fixedBills}
                onToggleFixedBill={handleToggleFixedBill}
                onAddFixedBill={handleAddFixedBill}
                categories={categories}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                transactions={transactions}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsView
                accounts={accounts}
                transactions={transactions}
                config={config}
                onAddAccount={handleAddAccount}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
                onAddTransaction={handleAddTransaction}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                config={config}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                config={config}
                onUpdateConfig={handleUpdateConfig}
                transactions={transactions}
                onResetDemoData={handleResetDemoData}
                onImportTransactions={handleImportTransactions}
                accounts={accounts}
                currentUser={currentUser}
                onLoginWithGoogle={handleLoginWithGoogle}
                onLogoutGoogle={handleLogoutGoogle}
                syncStatus={syncStatus}
                lastSyncedAt={lastSyncedAt}
                onManualSync={handleManualSync}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
