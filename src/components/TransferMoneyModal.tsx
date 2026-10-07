import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BankAccount, Transaction } from '../types';
import { getAccountBalances, normalizeTransactionDate } from '../utils/finance';

interface TransferMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  transactions: Transaction[];
  currencySymbol?: string;
  onTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    memo?: string;
  }) => void;
  initialFromAccountId?: string;
  initialToAccountId?: string;
}

const MEMO_PRESETS = [
  { icon: 'savings', text: 'Savings deposit' },
  { icon: 'credit_card', text: 'Credit card payment' },
  { icon: 'shield', text: 'Emergency reserve' },
  { icon: 'account_balance_wallet', text: 'Budget rebalance' },
  { icon: 'flag', text: 'Goal funding' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatPrettyDate(dateStr: string): string {
  if (!dateStr) return 'Select date';
  if (dateStr === 'Today') {
    const d = new Date();
    return `Today (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }
  if (dateStr === 'Yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `Yesterday (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return dateStr;
}

function getIsoFromDateType(dateType: string): string {
  const now = new Date();
  if (dateType === 'Today') {
    return now.toISOString().split('T')[0];
  }
  if (dateType === 'Yesterday') {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return prev.toISOString().split('T')[0];
  }
  return dateType;
}

/* Custom Account Dropdown Component with App Styling */
interface CustomAccountSelectProps {
  label: string;
  labelColorClass: string;
  selectedAccountId: string;
  disabledAccountId?: string;
  accountBalances: Array<{ id: string; name: string; currentBalance: number; institution?: string; type?: string; color?: string }>;
  currencySymbol: string;
  onSelect: (accId: string) => void;
}

const CustomAccountSelect: React.FC<CustomAccountSelectProps> = ({
  label,
  labelColorClass,
  selectedAccountId,
  disabledAccountId,
  accountBalances,
  currencySymbol,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedAcc = accountBalances.find((a) => a.id === selectedAccountId);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
      <div className="flex items-center justify-between px-1">
        <label className={`text-[11px] font-extrabold ${labelColorClass} uppercase tracking-wider flex items-center gap-1.5`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {label}
        </label>
        {selectedAcc && (
          <span className="text-[11px] font-semibold text-[#44474c]">
            Avail: <strong className="text-[#006397] font-mono font-bold">{currencySymbol}{selectedAcc.currentBalance.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-[#c4c6cd]/40 hover:border-[#006397]/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left shadow-2xs transition-all cursor-pointer group"
      >
        {selectedAcc ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs text-[14px]"
              style={{ backgroundColor: selectedAcc.color || '#006397' }}
            >
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-extrabold text-[#191c1d] truncate">
                {selectedAcc.name}
              </span>
              <span className="text-[10px] text-[#74777d] truncate font-medium">
                {selectedAcc.institution || selectedAcc.type || 'Account'} • {currencySymbol}{selectedAcc.currentBalance.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#74777d]">Select Account...</span>
        )}
        <span className={`material-symbols-outlined text-[20px] text-[#74777d] group-hover:text-[#006397] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#006397]' : ''}`}>
          keyboard_arrow_down
        </span>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white border border-[#c4c6cd]/30 rounded-2xl shadow-xl p-1.5 flex flex-col gap-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          {accountBalances.map((acc) => {
            const isDisabled = acc.id === disabledAccountId;
            const isSelected = acc.id === selectedAccountId;
            return (
              <button
                key={acc.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onSelect(acc.id);
                    setIsOpen(false);
                  }
                }}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed bg-[#f8fafc]'
                    : isSelected
                    ? 'bg-[#006397]/10 border border-[#006397]/30 text-[#006397]'
                    : 'hover:bg-[#f1f5f9] text-[#191c1d]'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-[14px]"
                    style={{ backgroundColor: acc.color || '#006397' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{acc.name}</span>
                      {isDisabled && (
                        <span className="text-[9px] font-bold text-[#ba1a1a] bg-[#ba1a1a]/10 px-1.5 py-0.2 rounded">
                          Selected as Source
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#64748b] truncate">
                      {acc.institution || acc.type || 'Account'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <span className="text-xs font-mono font-extrabold text-[#006397]">
                    {currencySymbol}{acc.currentBalance.toFixed(2)}
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-[#006397]">
                      check_circle
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* Custom Interactive Calendar Modal Component matching app standard */
interface CustomCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDateIso: string;
  onSelectDate: (iso: string) => void;
}

const CustomCalendarModal: React.FC<CustomCalendarModalProps> = ({
  isOpen,
  onClose,
  selectedDateIso,
  onSelectDate,
}) => {
  if (!isOpen) return null;

  const initialObj = useMemo(() => {
    if (selectedDateIso) {
      const d = new Date(selectedDateIso + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [selectedDateIso]);

  const [calYear, setCalYear] = useState<number>(initialObj.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(initialObj.getMonth());
  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = useState<number>(initialObj.getFullYear() - 5);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }
  while (daysArray.length < 42) {
    daysArray.push(null);
  }

  const handlePrev = () => {
    if (pickerMode === 'days') {
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear(calYear - 1);
      } else {
        setCalMonth(calMonth - 1);
      }
    } else if (pickerMode === 'months') {
      setCalYear(calYear - 1);
    } else if (pickerMode === 'years') {
      setYearPageStart(yearPageStart - 12);
    }
  };

  const handleNext = () => {
    if (pickerMode === 'days') {
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear(calYear + 1);
      } else {
        setCalMonth(calMonth + 1);
      }
    } else if (pickerMode === 'months') {
      setCalYear(calYear + 1);
    } else if (pickerMode === 'years') {
      setYearPageStart(yearPageStart + 12);
    }
  };

  const handleDaySelect = (dayNum: number) => {
    const yStr = calYear.toString();
    const mStr = String(calMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const iso = `${yStr}-${mStr}-${dStr}`;
    onSelectDate(iso);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#041627]/60 backdrop-blur-xs p-3 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-[#c4c6cd]/25 flex flex-col gap-3 my-auto animate-in zoom-in-95 duration-150 text-[#191c1d]">
        {/* Calendar Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006397] text-[20px]">calendar_month</span>
            <h4 className="font-extrabold text-sm text-[#191c1d]">Select Custom Date</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f3f4f5] hover:bg-[#e4e7ec] flex items-center justify-center text-[#74777d] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Quick Date Presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { label: 'Today', iso: new Date().toISOString().split('T')[0] },
            {
              label: 'Yesterday',
              iso: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            },
            {
              label: '1st of Month',
              iso: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
            },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onSelectDate(preset.iso);
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#f1f5f9] text-[#006397] hover:bg-[#006397]/10 transition-colors shrink-0 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Month & Year Controls */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrev}
            className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] text-[#44474c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPickerMode(pickerMode === 'months' ? 'days' : 'months')}
              className={`px-2.5 py-1 rounded-lg font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer ${
                pickerMode === 'months'
                  ? 'bg-[#006397] text-white shadow-2xs'
                  : 'bg-[#f1f5f9] text-[#191c1d] hover:bg-[#e2e8f0]'
              }`}
            >
              <span>{MONTH_NAMES[calMonth]}</span>
              <span className="material-symbols-outlined text-[14px]">
                {pickerMode === 'months' ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pickerMode !== 'years') setYearPageStart(calYear - 5);
                setPickerMode(pickerMode === 'years' ? 'days' : 'years');
              }}
              className={`px-2.5 py-1 rounded-lg font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer ${
                pickerMode === 'years'
                  ? 'bg-[#006397] text-white shadow-2xs'
                  : 'bg-[#f1f5f9] text-[#191c1d] hover:bg-[#e2e8f0]'
              }`}
            >
              <span>{pickerMode === 'years' ? `${yearPageStart}-${yearPageStart + 11}` : calYear}</span>
              <span className="material-symbols-outlined text-[14px]">
                {pickerMode === 'years' ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] text-[#44474c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Days View */}
        {pickerMode === 'days' && (
          <div className="bg-[#f8fafc] rounded-2xl p-2 border border-[#e2e8f0]">
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#64748b] uppercase mb-1">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {daysArray.map((dayNum, idx) => {
                if (dayNum === null) return <div key={`empty-${idx}`} className="h-8" />;
                const currentIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = currentIso === selectedDateIso;
                const todayIso = new Date().toISOString().split('T')[0];
                const isToday = currentIso === todayIso;

                return (
                  <button
                    key={`day-${dayNum}-${idx}`}
                    type="button"
                    onClick={() => handleDaySelect(dayNum)}
                    className={`h-8 w-full rounded-lg font-bold flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#006397] text-white shadow-xs scale-105'
                        : isToday
                        ? 'border-2 border-[#006397] text-[#006397] bg-white'
                        : 'text-[#191c1d] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Months View */}
        {pickerMode === 'months' && (
          <div className="grid grid-cols-3 gap-2 py-1 h-[216px] items-center bg-[#f8fafc] rounded-2xl p-2 border border-[#e2e8f0]">
            {MONTH_NAMES.map((m, idx) => {
              const isSelected = calMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCalMonth(idx);
                    setPickerMode('days');
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                      : 'bg-white hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#cbd5e1]'
                  }`}
                >
                  {SHORT_MONTHS[idx]}
                </button>
              );
            })}
          </div>
        )}

        {/* Years View */}
        {pickerMode === 'years' && (
          <div className="grid grid-cols-3 gap-2 py-1 h-[216px] items-center bg-[#f8fafc] rounded-2xl p-2 border border-[#e2e8f0]">
            {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
              const isSelected = calYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCalYear(y);
                    setPickerMode('months');
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                      : 'bg-white hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#cbd5e1]'
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Selected Readout & Close */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748b] font-semibold">Selected</span>
            <span className="text-xs font-bold text-[#006397]">
              {formatPrettyDate(selectedDateIso)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#006397] text-white font-bold text-xs rounded-xl hover:bg-[#00476e] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const TransferMoneyModal: React.FC<TransferMoneyModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions,
  currencySymbol = '$',
  onTransfer,
  initialFromAccountId,
  initialToAccountId,
}) => {
  if (!isOpen || accounts.length < 2) return null;

  const accountBalances = useMemo(
    () => getAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const defaultFrom = initialFromAccountId || accounts[0]?.id || '';
  const defaultTo =
    initialToAccountId || (accounts.find((a) => a.id !== defaultFrom)?.id || '');

  const [fromAccountId, setFromAccountId] = useState<string>(defaultFrom);
  const [toAccountId, setToAccountId] = useState<string>(defaultTo);
  const [amount, setAmount] = useState<string>('');
  
  // Date state: 'Today' | 'Yesterday' | ISO date string (YYYY-MM-DD)
  const [dateType, setDateType] = useState<string>('Today');
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);

  const [memo, setMemo] = useState<string>('');
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  useEffect(() => {
    if (initialFromAccountId) setFromAccountId(initialFromAccountId);
    if (initialToAccountId) setToAccountId(initialToAccountId);
  }, [initialFromAccountId, initialToAccountId]);

  useEffect(() => {
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      const alternative = accounts.find((a) => a.id !== fromAccountId);
      if (alternative) setToAccountId(alternative.id);
    }
  }, [fromAccountId, accounts]);

  const fromAcc = accountBalances.find((a) => a.id === fromAccountId);
  const toAcc = accountBalances.find((a) => a.id === toAccountId);

  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficient = fromAcc ? parsedAmount > fromAcc.currentBalance : false;

  const handleSwap = () => {
    setIsSwapping(true);
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
    setTimeout(() => setIsSwapping(false), 300);
  };

  const handlePresetAmount = (val: number) => {
    setAmount(val.toString());
    setErrorMsg('');
  };

  const handleMaxAmount = () => {
    if (fromAcc && fromAcc.currentBalance > 0) {
      setAmount(fromAcc.currentBalance.toFixed(2));
      setErrorMsg('');
    }
  };

  const handleSelectMemoPreset = (presetText: string) => {
    setMemo(presetText);
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid transfer amount greater than zero.');
      return;
    }

    if (!fromAccountId || !toAccountId) {
      setErrorMsg('Please select both source and destination accounts.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setErrorMsg('Source and destination accounts must be different.');
      return;
    }

    onTransfer({
      fromAccountId,
      toAccountId,
      amount: parsedAmount,
      date: normalizeTransactionDate(dateType),
      memo: memo.trim() || undefined,
    });

    setTransferSuccess(true);
    setTimeout(() => {
      setTransferSuccess(false);
      setAmount('');
      setMemo('');
      onClose();
    }, 700);
  };

  const selectedIsoForCalendar = useMemo(() => {
    return getIsoFromDateType(dateType);
  }, [dateType]);

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-[#041627]/60 backdrop-blur-md p-3 sm:p-4 transition-all duration-200 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-[#c4c6cd]/25 flex flex-col gap-4 my-auto relative animate-in fade-in zoom-in-95 duration-200 text-[#191c1d]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#f0f2f5]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#006397] to-[#0284c7] flex items-center justify-center text-white shadow-md shadow-[#006397]/20">
                <span className="material-symbols-outlined text-[24px]">sync_alt</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-[#191c1d]">Transfer Money</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#006397]/10 text-[#006397] text-[10px] font-bold uppercase tracking-wider">
                    Internal
                  </span>
                </div>
                <p className="text-xs text-[#74777d]">Move funds instantly between your accounts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f3f4f5] hover:bg-[#e4e7ec] text-[#44474c] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleSaveTransfer} className="flex flex-col gap-4">
            {/* Redesigned Custom Account Dropdowns Section */}
            <div className="bg-[#f8fafc] rounded-2xl p-3.5 border border-[#e2e8f0] flex flex-col gap-3 relative">
              {/* FROM ACCOUNT CUSTOM SELECT */}
              <CustomAccountSelect
                label="From (Source Account)"
                labelColorClass="text-[#006397]"
                selectedAccountId={fromAccountId}
                disabledAccountId={toAccountId}
                accountBalances={accountBalances}
                currencySymbol={currencySymbol}
                onSelect={(accId) => setFromAccountId(accId)}
              />

              {/* Source Balance Projection */}
              {fromAcc && parsedAmount > 0 && (
                <div
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center justify-between transition-all ${
                    isInsufficient
                      ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] font-bold border border-[#ba1a1a]/20'
                      : 'bg-[#006397]/5 text-[#006397]'
                  }`}
                >
                  <span>
                    {isInsufficient ? '⚠️ Transfer exceeds available balance' : 'Balance after transfer:'}
                  </span>
                  <span className="font-mono font-bold">
                    {currencySymbol}{(fromAcc.currentBalance - parsedAmount).toFixed(2)}
                  </span>
                </div>
              )}

              {/* SWAP CONNECTOR & BUTTON */}
              <div className="relative flex items-center justify-center my-0.5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-dashed border-[#cbd5e1]" />
                </div>
                <button
                  type="button"
                  onClick={handleSwap}
                  className={`relative z-10 w-9 h-9 rounded-full bg-white text-[#006397] border border-[#006397]/30 flex items-center justify-center shadow-md hover:bg-[#006397] hover:text-white active:scale-90 transition-all cursor-pointer ${
                    isSwapping ? 'rotate-180 scale-110' : ''
                  }`}
                  title="Swap From and To Accounts"
                >
                  <span className="material-symbols-outlined text-[20px]">swap_vert</span>
                </button>
              </div>

              {/* TO ACCOUNT CUSTOM SELECT */}
              <CustomAccountSelect
                label="To (Destination Account)"
                labelColorClass="text-[#00a656]"
                selectedAccountId={toAccountId}
                disabledAccountId={fromAccountId}
                accountBalances={accountBalances}
                currencySymbol={currencySymbol}
                onSelect={(accId) => setToAccountId(accId)}
              />

              {/* Destination Balance Projection */}
              {toAcc && parsedAmount > 0 && (
                <div className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#00a656]/10 text-[#008243] flex items-center justify-between">
                  <span>New balance after transfer:</span>
                  <span className="font-mono font-bold">
                    {currencySymbol}{(toAcc.currentBalance + parsedAmount).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Transfer Amount Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-extrabold text-[#191c1d]">Transfer Amount</label>
                {fromAcc && (
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="text-[11px] font-bold text-[#006397] hover:underline cursor-pointer"
                  >
                    Transfer Full Balance ({currencySymbol}{fromAcc.currentBalance.toFixed(2)})
                  </button>
                )}
              </div>

              <div className="relative flex items-center bg-[#f8fafc] border-2 border-[#006397]/25 rounded-2xl p-3 focus-within:border-[#006397] focus-within:bg-white transition-all shadow-xs">
                <span className="text-2xl sm:text-3xl font-black text-[#006397] mr-2">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="0.00"
                  className="w-full bg-transparent text-2xl sm:text-3xl font-black text-[#191c1d] focus:outline-none placeholder:text-[#c4c6cd]"
                  autoFocus
                />
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="w-6 h-6 rounded-full bg-[#e2e8f0] text-[#64748b] hover:bg-[#cbd5e1] flex items-center justify-center transition-colors text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Amount Preset Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[25, 50, 100, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetAmount(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${
                      parsedAmount === preset
                        ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                        : 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    +{currencySymbol}{preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer bg-[#00a656]/15 text-[#008243] hover:bg-[#00a656]/25 border border-[#00a656]/30"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Redesigned Custom Transfer Date Selector with App Calendar Modal */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-[#191c1d] px-1">Transfer Date</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDateType('Today')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    dateType === 'Today'
                      ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                      : 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0] hover:bg-[#f1f5f9]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateType('Yesterday')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    dateType === 'Yesterday'
                      ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                      : 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0] hover:bg-[#f1f5f9]'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setShowCalendarModal(true)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                    dateType !== 'Today' && dateType !== 'Yesterday'
                      ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                      : 'bg-[#f8fafc] text-[#006397] border-[#006397]/30 hover:bg-[#e3f2fd]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                  <span className="truncate">
                    {dateType !== 'Today' && dateType !== 'Yesterday'
                      ? formatPrettyDate(dateType)
                      : 'Custom Date'}
                  </span>
                </button>
              </div>

              {/* Display chosen custom date badge if custom */}
              {dateType !== 'Today' && dateType !== 'Yesterday' && (
                <div className="flex items-center justify-between px-2 py-1.5 bg-[#006397]/10 rounded-xl border border-[#006397]/20 text-xs font-semibold text-[#006397]">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">event</span>
                    <span>Selected Date: <strong>{formatPrettyDate(dateType)}</strong></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCalendarModal(true)}
                    className="hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Memo / Purpose Tag Suggestions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-[#191c1d] px-1">Memo / Purpose (Optional)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Monthly savings contribution, Rent split..."
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#006397] placeholder:text-[#94a3b8]"
              />

              {/* Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 pb-1 scrollbar-none">
                {MEMO_PRESETS.map((p) => (
                  <button
                    key={p.text}
                    type="button"
                    onClick={() => handleSelectMemoPreset(p.text)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 border cursor-pointer transition-colors ${
                      memo === p.text
                        ? 'bg-[#006397]/15 text-[#006397] border-[#006397]/40 font-bold'
                        : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{p.icon}</span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 text-[#ba1a1a] text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-2xl border border-[#cbd5e1] font-bold text-xs text-[#64748b] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferSuccess}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                  transferSuccess
                    ? 'bg-[#00a656] shadow-[#00a656]/20'
                    : 'bg-gradient-to-r from-[#006397] to-[#0284c7] hover:from-[#00476e] hover:to-[#006397] shadow-[#006397]/25'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {transferSuccess ? 'task_alt' : 'swap_horiz'}
                </span>
                <span>
                  {transferSuccess
                    ? 'Transfer Complete!'
                    : parsedAmount > 0
                    ? `Execute ${currencySymbol}${parsedAmount.toFixed(2)} Transfer`
                    : 'Transfer Funds'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Render Custom Calendar Picker Modal */}
      <CustomCalendarModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        selectedDateIso={selectedIsoForCalendar}
        onSelectDate={(iso) => {
          setDateType(iso);
        }}
      />
    </>
  );
};
