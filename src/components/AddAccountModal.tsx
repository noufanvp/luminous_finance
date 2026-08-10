import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccount?: BankAccount | null;
  onSaveAccount: (account: BankAccount) => void;
  currencySymbol?: string;
}

const ACCOUNT_TYPE_PRESETS: { type: BankAccount['type']; label: string; icon: string; defaultColor: string }[] = [
  { type: 'checking', label: 'Checking', icon: 'account_balance', defaultColor: '#006397' },
  { type: 'savings', label: 'Savings', icon: 'savings', defaultColor: '#00a656' },
  { type: 'credit', label: 'Credit Card', icon: 'credit_card', defaultColor: '#e11d48' },
  { type: 'cash', label: 'Cash / Wallet', icon: 'payments', defaultColor: '#d97706' },
  { type: 'investment', label: 'Investment', icon: 'show_chart', defaultColor: '#6b4ea2' },
  { type: 'other', label: 'Other', icon: 'account_balance_wallet', defaultColor: '#475569' },
];

const ACCOUNT_ICONS = [
  'account_balance',
  'savings',
  'credit_card',
  'payments',
  'show_chart',
  'account_balance_wallet',
  'account_tree',
  'monetization_on',
  'euro_symbol',
  'currency_exchange',
];

const ACCOUNT_COLORS = [
  '#006397',
  '#00a656',
  '#e11d48',
  '#d97706',
  '#6b4ea2',
  '#0284c7',
  '#059669',
  '#475569',
];

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  initialAccount,
  onSaveAccount,
  currencySymbol = '$',
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(initialAccount);

  const [name, setName] = useState(initialAccount?.name || '');
  const [type, setType] = useState<BankAccount['type']>(initialAccount?.type || 'checking');
  const [balance, setBalance] = useState<string>(
    initialAccount !== undefined && initialAccount !== null ? initialAccount.balance.toString() : '1000'
  );
  const [accountNumber, setAccountNumber] = useState(initialAccount?.accountNumber || '');
  const [institution, setInstitution] = useState(initialAccount?.institution || '');
  const [icon, setIcon] = useState(initialAccount?.icon || 'account_balance');
  const [color, setColor] = useState(initialAccount?.color || '#006397');
  const [isDefault, setIsDefault] = useState(Boolean(initialAccount?.isDefault));
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialAccount) {
      setName(initialAccount.name);
      setType(initialAccount.type);
      setBalance(initialAccount.balance.toString());
      setAccountNumber(initialAccount.accountNumber || '');
      setInstitution(initialAccount.institution || '');
      setIcon(initialAccount.icon || 'account_balance');
      setColor(initialAccount.color || '#006397');
      setIsDefault(Boolean(initialAccount.isDefault));
    } else {
      setName('');
      setType('checking');
      setBalance('1000');
      setAccountNumber('');
      setInstitution('');
      setIcon('account_balance');
      setColor('#006397');
      setIsDefault(false);
    }
  }, [initialAccount, isOpen]);

  const handleTypeSelect = (preset: typeof ACCOUNT_TYPE_PRESETS[0]) => {
    setType(preset.type);
    setIcon(preset.icon);
    setColor(preset.defaultColor);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Account name is required.');
      return;
    }

    const parsedBalance = parseFloat(balance);
    if (isNaN(parsedBalance)) {
      setErrorMsg('Please enter a valid balance amount.');
      return;
    }

    const newAcc: BankAccount = {
      id: initialAccount ? initialAccount.id : `acc-${Date.now()}`,
      name: name.trim(),
      type,
      balance: parsedBalance,
      accountNumber: accountNumber.trim() || undefined,
      institution: institution.trim() || undefined,
      icon,
      color,
      isDefault,
    };

    onSaveAccount(newAcc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-[#041627]/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-[#c4c6cd]/20 flex flex-col gap-4 my-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f1f2]">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <span className="material-symbols-outlined text-[22px]">{icon}</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#191c1d]">
                {isEditing ? 'Edit Bank Account' : 'Add Bank Account'}
              </h3>
              <p className="text-xs text-[#74777d]">Track checking, savings, credit, or cash</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f2f5] text-[#74777d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3.5">
          {/* Account Type Presets Grid */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#191c1d]">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPE_PRESETS.map((preset) => {
                const isSel = type === preset.type;
                return (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() => handleTypeSelect(preset)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-left ${
                      isSel
                        ? 'border-[#006397] bg-[#e3f2fd] text-[#006397] shadow-2xs'
                        : 'border-[#c4c6cd]/40 bg-[#f8f9fa] text-[#44474c] hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0">
                      {preset.icon}
                    </span>
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name & Institution Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#191c1d]">Account Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chase Checking"
                className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-xs font-bold text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397]"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#191c1d]">Institution (Optional)</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Chase, Marcus"
                className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-xs font-medium text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397]"
              />
            </div>
          </div>

          {/* Starting Balance & Last 4 Digits Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#191c1d]">
                {type === 'credit' ? 'Current Balance (Debt -)' : 'Starting Balance'}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-[#006397]">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-xs font-bold text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397]"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#191c1d]">Last 4 Digits (Optional)</label>
              <input
                type="text"
                maxLength={4}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4321"
                className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-xs font-mono font-bold text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397]"
              />
            </div>
          </div>

          {/* Color & Icon Pickers Row */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#191c1d]">Color & Icon</label>
            <div className="flex items-center gap-3">
              {/* Color Circles */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full shrink-0 transition-transform ${
                      color === c ? 'ring-2 ring-offset-2 ring-[#006397] scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Default Account Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-[#006397] rounded border-[#c4c6cd] focus:ring-[#006397]"
            />
            <span className="text-xs font-semibold text-[#191c1d]">
              Set as primary / default account for new transactions
            </span>
          </label>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a] text-xs font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-[#006397] hover:bg-[#00476e] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all mt-1"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isEditing ? 'check' : 'add'}
            </span>
            <span>{isEditing ? 'Update Account' : 'Save Bank Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
