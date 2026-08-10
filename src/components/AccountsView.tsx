import React, { useState } from 'react';
import { BankAccount, Transaction, BudgetConfig } from '../types';
import { getAccountBalances } from '../utils/finance';
import { TransferMoneyModal } from './TransferMoneyModal';

interface AccountsViewProps {
  accounts: BankAccount[];
  transactions: Transaction[];
  config: BudgetConfig;
  onAddAccount: (acc: Omit<BankAccount, 'id'>) => void;
  onUpdateAccount: (id: string, updated: Partial<BankAccount>) => void;
  onDeleteAccount: (id: string) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  setActiveTab: (tab: any) => void;
}

const PRESET_COLORS = [
  '#006397', // Primary Blue
  '#00a656', // Emerald Green
  '#e11d48', // Ruby Rose
  '#d97706', // Warm Amber
  '#6b4ea2', // Royal Purple
  '#475569', // Slate Gray
  '#0284c7', // Sky Blue
  '#059669', // Teal
];

const PRESET_ICONS = [
  { icon: 'account_balance', label: 'Bank' },
  { icon: 'savings', label: 'Savings' },
  { icon: 'credit_card', label: 'Credit Card' },
  { icon: 'payments', label: 'Cash' },
  { icon: 'account_balance_wallet', label: 'Wallet' },
  { icon: 'show_chart', label: 'Investment' },
  { icon: 'storefront', label: 'Business' },
  { icon: 'redeem', label: 'Vault' },
];

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  transactions,
  config,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddTransaction,
  setActiveTab,
}) => {
  const sym = config.currencySymbol || '$';
  const accountBalancesList = getAccountBalances(accounts, transactions);
  const balances: Record<string, number> = {};
  accountBalancesList.forEach((ab) => {
    balances[ab.id] = ab.currentBalance;
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedFromAccountId, setSelectedFromAccountId] = useState<string>('');

  // Account Modal Form State
  const [formName, setFormName] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formType, setFormType] = useState<BankAccount['type']>('checking');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formColor, setFormColor] = useState('#006397');
  const [formIcon, setFormIcon] = useState('account_balance');
  const [formExcludeFromTotal, setFormExcludeFromTotal] = useState(false);

  // Transfer Modal State
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [transferDate, setTransferDate] = useState('Today');

  // Open Add Account
  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setFormName('');
    setFormInstitution('');
    setFormType('checking');
    setFormAccountNumber('');
    setFormBalance('0');
    setFormColor('#006397');
    setFormIcon('account_balance');
    setFormExcludeFromTotal(false);
    setShowAddModal(true);
  };

  // Open Edit Account
  const handleOpenEditModal = (acc: BankAccount) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormInstitution(acc.institution || '');
    setFormType(acc.type);
    setFormAccountNumber(acc.accountNumber || '');
    setFormBalance(acc.balance.toString());
    setFormColor(acc.color || '#006397');
    setFormIcon(acc.icon || 'account_balance');
    setFormExcludeFromTotal(acc.excludeFromTotal || false);
    setShowAddModal(true);
  };

  // Save Account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const initialBal = parseFloat(formBalance) || 0;

    if (editingAccount) {
      onUpdateAccount(editingAccount.id, {
        name: formName.trim(),
        institution: formInstitution.trim() || undefined,
        type: formType,
        accountNumber: formAccountNumber.trim() || undefined,
        balance: initialBal,
        color: formColor,
        icon: formIcon,
        excludeFromTotal: formExcludeFromTotal,
      });
    } else {
      onAddAccount({
        name: formName.trim(),
        institution: formInstitution.trim() || undefined,
        type: formType,
        accountNumber: formAccountNumber.trim() || undefined,
        balance: initialBal,
        color: formColor,
        icon: formIcon,
        excludeFromTotal: formExcludeFromTotal,
      });
    }

    setShowAddModal(false);
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (fromAccId?: string) => {
    const defaultFrom = fromAccId || accounts[0]?.id || '';
    const defaultTo = accounts.find((a) => a.id !== defaultFrom)?.id || '';
    setTransferFromId(defaultFrom);
    setTransferToId(defaultTo);
    setTransferAmount('');
    setTransferMemo('');
    setTransferDate('Today');
    setShowTransferModal(true);
  };

  // Submit Transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0 || !transferFromId || !transferToId) return;
    if (transferFromId === transferToId) return;

    const fromAcc = accounts.find((a) => a.id === transferFromId);
    const toAcc = accounts.find((a) => a.id === transferToId);

    onAddTransaction({
      type: 'transfer',
      category: 'Transfer',
      title: `Transfer: ${fromAcc?.name || 'Account'} ➔ ${toAcc?.name || 'Account'}`,
      amount,
      date: transferDate || 'Today',
      memo: transferMemo.trim() || `Money transfer from ${fromAcc?.name} to ${toAcc?.name}`,
      accountId: transferFromId,
      toAccountId: transferToId,
    });

    setShowTransferModal(false);
  };

  // Total Liquid Assets (Assets minus credit debts, excluding opted-out accounts)
  const totalAssets = accounts
    .filter((a) => a.type !== 'credit' && !a.excludeFromTotal)
    .reduce((sum, a) => sum + (balances[a.id] ?? a.balance), 0);

  const totalCreditDebt = accounts
    .filter((a) => a.type === 'credit' && !a.excludeFromTotal)
    .reduce((sum, a) => sum + Math.abs(balances[a.id] ?? a.balance), 0);

  const netLiquidity = totalAssets - totalCreditDebt;
  const excludedAccountsCount = accounts.filter((a) => a.excludeFromTotal).length;

  // Filter transfers
  const transferTxs = transactions.filter((t) => t.type === 'transfer' || t.isTransfer);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#041627] via-[#003354] to-[#006397] rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 min-w-0">
          <div className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 text-[#92ccff] text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              <span>Net Bank Holdings & Liquidity</span>
              {excludedAccountsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ba1a1a]/30 text-[#ffb4ab] border border-[#ffb4ab]/30 text-[10px] font-bold normal-case tracking-normal flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">visibility_off</span>
                  Excludes {excludedAccountsCount} account{excludedAccountsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight truncate max-w-full">
              {sym}{netLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#c4c6cd]">
              <span>Assets: <strong className="text-[#00a656] font-mono">{sym}{totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
              <span>Liabilities: <strong className="text-[#ffb4ab] font-mono">{sym}{totalCreditDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              onClick={() => handleOpenTransferModal()}
              className="px-4 py-2.5 rounded-2xl bg-[#00a656] hover:bg-[#008243] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">sync_alt</span>
              <span>Transfer Funds</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all flex items-center gap-2 active:scale-95 backdrop-blur-md"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add Account</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-2xl" />
      </div>

      {/* Account Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006397]">credit_card</span>
            <span>Your Bank Accounts ({accounts.length})</span>
          </h3>
          <span className="text-xs text-[#74777d]">Balances update automatically with income, expenses & transfers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const currentBal = balances[acc.id] ?? acc.balance;
            const isCredit = acc.type === 'credit';
            const isExcluded = acc.excludeFromTotal;

            return (
              <div
                key={acc.id}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between group relative overflow-hidden ${
                  isExcluded
                    ? 'border-dashed border-[#94a3b8]/60 bg-[#f8fafc] opacity-80'
                    : 'bg-white border-[#e1e3e4] hover:shadow-md'
                }`}
              >
                {/* Accent Header Line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${isExcluded ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: acc.color || '#006397' }}
                />

                <div>
                  <div className="flex justify-between items-start pt-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs"
                        style={{ backgroundColor: acc.color || '#006397' }}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {acc.icon || 'account_balance'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[#041627] text-base leading-tight">
                          {acc.name}
                        </h4>
                        <p className="text-xs text-[#74777d]">
                          {acc.institution || acc.type.toUpperCase()} {acc.accountNumber ? `•••• ${acc.accountNumber}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Account Type Badge */}
                      <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-[#f0f4f8] text-[#006397]">
                        {acc.type}
                      </span>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="mt-5 mb-2">
                    <span className="text-[11px] font-semibold text-[#74777d] block uppercase tracking-wider">
                      {isCredit ? 'Current Balance / Debt' : 'Available Balance'}
                    </span>
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${
                        isCredit
                          ? currentBal < 0
                            ? 'text-[#ba1a1a]'
                            : 'text-[#00a656]'
                          : currentBal >= 0
                          ? 'text-[#041627]'
                          : 'text-[#ba1a1a]'
                      }`}
                    >
                      {sym}{Math.abs(currentBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {isCredit && currentBal < 0 ? ' Owed' : ''}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-[#f0f4f8] flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => handleOpenTransferModal(acc.id)}
                    className="flex-1 py-1.5 rounded-xl bg-[#f0f4f8] hover:bg-[#006397] hover:text-white font-bold text-[#006397] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                    <span>Transfer</span>
                  </button>

                  <button
                    onClick={() => onUpdateAccount(acc.id, { excludeFromTotal: !acc.excludeFromTotal })}
                    className={`p-1.5 rounded-xl transition-colors ${
                      isExcluded
                        ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] hover:bg-[#ba1a1a]/20'
                        : 'text-[#74777d] hover:text-[#006397] hover:bg-[#f0f4f8]'
                    }`}
                    title={isExcluded ? 'Include in total available balance' : 'Exclude from total available balance'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isExcluded ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(acc)}
                    className="p-1.5 rounded-xl text-[#74777d] hover:text-[#006397] hover:bg-[#f0f4f8] transition-colors"
                    title="Edit Account"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>

                  {accounts.length > 1 && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${acc.name}"?`)) {
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="p-1.5 rounded-xl text-[#74777d] hover:text-[#ba1a1a] hover:bg-[#ffb4ab]/20 transition-colors"
                      title="Delete Account"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Internal Transfers History */}
      <div className="bg-white rounded-2xl p-5 border border-[#e1e3e4] shadow-2xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-extrabold text-[#041627] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00a656]">swap_horiz</span>
            <span>Money Transfer History ({transferTxs.length})</span>
          </h3>
          <button
            onClick={() => handleOpenTransferModal()}
            className="text-xs font-bold text-[#006397] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Transfer
          </button>
        </div>

        {transferTxs.length === 0 ? (
          <div className="text-center py-8 text-[#74777d]">
            <span className="material-symbols-outlined text-4xl mb-2 text-[#c4c6cd]">swap_horiz</span>
            <p className="text-sm font-medium">No internal money transfers recorded yet.</p>
            <p className="text-xs mt-1">Use the "Transfer Funds" button to move money between accounts.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f4f8]">
            {transferTxs.map((tx) => {
              const fromAcc = accounts.find((a) => a.id === tx.accountId);
              const toAcc = accounts.find((a) => a.id === tx.toAccountId);

              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00a656]/15 text-[#00a656] flex items-center justify-center font-bold shrink-0">
                      <span className="material-symbols-outlined">sync_alt</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#041627] text-sm flex items-center gap-2">
                        <span>{fromAcc?.name || 'Account'}</span>
                        <span className="material-symbols-outlined text-[14px] text-[#74777d]">arrow_forward</span>
                        <span>{toAcc?.name || 'Account'}</span>
                      </h4>
                      <p className="text-xs text-[#74777d]">
                        {tx.date} {tx.memo ? `• ${tx.memo}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-[#006397] block">
                      {sym}{tx.amount.toFixed(2)}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#00a656]">Transfer</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#041627]/50 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#c4c6cd]/20 relative my-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f3f4f5] flex items-center justify-center text-[#44474c] hover:bg-[#e1e3e4]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <h3 className="text-lg font-black text-[#041627] mb-1">
              {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
            </h3>
            <p className="text-xs text-[#74777d] mb-4">
              Enter your account details to track balances and perform transfers.
            </p>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Primary Checking, Vault Savings"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e1e3e4] text-sm font-medium focus:ring-2 focus:ring-[#006397] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                    Account Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as BankAccount['type'])}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e1e3e4] text-sm font-medium focus:ring-2 focus:ring-[#006397] focus:outline-none bg-white"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit Card</option>
                    <option value="cash">Cash Wallet</option>
                    <option value="investment">Investment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Chase, Citi"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e1e3e4] text-sm font-medium focus:ring-2 focus:ring-[#006397] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                    Starting Balance ({sym})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formBalance}
                    onChange={(e) => setFormBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e1e3e4] text-sm font-mono font-bold focus:ring-2 focus:ring-[#006397] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e1e3e4] text-sm font-mono focus:ring-2 focus:ring-[#006397] focus:outline-none"
                  />
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                  Choose Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((item) => (
                    <button
                      key={item.icon}
                      type="button"
                      onClick={() => setFormIcon(item.icon)}
                      className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                        formIcon === item.icon
                          ? 'border-[#006397] bg-[#006397]/10 text-[#006397]'
                          : 'border-[#e1e3e4] text-[#74777d] hover:bg-[#f0f4f8]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="text-xs font-extrabold text-[#041627] uppercase tracking-wider block mb-1">
                  Accent Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        formColor === color ? 'scale-110 border-[#041627] shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Exclude From Total Toggle */}
              <div className="p-3.5 bg-[#f8fafc] border border-[#e1e3e4] rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${formExcludeFromTotal ? 'bg-[#ba1a1a]/15 text-[#ba1a1a]' : 'bg-[#006397]/10 text-[#006397]'}`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {formExcludeFromTotal ? 'visibility_off' : 'visibility'}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-[#041627] block cursor-pointer" onClick={() => setFormExcludeFromTotal(!formExcludeFromTotal)}>
                      Exclude from Total Balance
                    </label>
                    <p className="text-[11px] text-[#74777d] leading-tight">
                      Hide funds from Net Holdings & Total Available calculation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormExcludeFromTotal(!formExcludeFromTotal)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    formExcludeFromTotal ? 'bg-[#ba1a1a]' : 'bg-[#cbd5e1]'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      formExcludeFromTotal ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#e1e3e4] font-bold text-xs text-[#74777d] hover:bg-[#f0f4f8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#006397] hover:bg-[#00476e] font-bold text-xs text-white shadow-md transition-colors"
                >
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Money Transfer Modal */}
      <TransferMoneyModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        accounts={accounts}
        transactions={transactions}
        currencySymbol={sym}
        initialFromAccountId={transferFromId}
        onTransfer={({ fromAccountId, toAccountId, amount, date, memo }) => {
          const fromAcc = accounts.find((a) => a.id === fromAccountId);
          const toAcc = accounts.find((a) => a.id === toAccountId);
          onAddTransaction({
            type: 'transfer',
            isTransfer: true,
            category: 'Transfer',
            title: `Transfer: ${fromAcc?.name || 'Account'} ➔ ${toAcc?.name || 'Account'}`,
            amount,
            date,
            memo: memo || `Money transfer from ${fromAcc?.name} to ${toAcc?.name}`,
            accountId: fromAccountId,
            toAccountId: toAccountId,
          });
          setShowTransferModal(false);
        }}
      />
    </div>
  );
};
