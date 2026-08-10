import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Transaction, CategoryTemplate, TransactionType, TabType, BudgetConfig, BankAccount } from '../types';
import { INITIAL_TRANSACTIONS } from '../data/initialData';
import { getCategoryBreakdown, getRollingDailyCategoryPacing } from '../utils/finance';
import { AddCategoryModal } from './AddCategoryModal';
import { CategorySettingsModal } from './CategorySettingsModal';
import { AiQuickLogModal } from './AiQuickLogModal';
import { ParsedAiTransaction } from '../services/gemini';

interface AddTransactionViewProps {
  categories: CategoryTemplate[];
  transactions?: Transaction[];
  accounts?: BankAccount[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction?: (id: string, updatedFields: Partial<Transaction>) => void;
  editingTransaction?: Transaction | null;
  onClearEditingTransaction?: () => void;
  setActiveTab: (tab: TabType) => void;
  config?: BudgetConfig;
  onAddCategory?: (category: CategoryTemplate) => void;
  onUpdateCategory?: (id: string, updated: Partial<CategoryTemplate>) => void;
  onDeleteCategory?: (id: string) => void;
  onReorderCategories?: (newCategories: CategoryTemplate[]) => void;
}

export const AddTransactionView: React.FC<AddTransactionViewProps> = ({
  categories,
  transactions,
  accounts = [],
  onAddTransaction,
  onUpdateTransaction,
  editingTransaction,
  onClearEditingTransaction,
  setActiveTab,
  config,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
}) => {
  const sym = config?.currencySymbol || '$';
  const isEditMode = Boolean(editingTransaction);

  const [txType, setTxType] = useState<TransactionType>(
    editingTransaction?.type || 'expense'
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    editingTransaction?.accountId || accounts[0]?.id || ''
  );
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>(
    editingTransaction?.toAccountId || accounts[1]?.id || accounts[0]?.id || ''
  );
  const [txDate, setTxDate] = useState<string>(
    editingTransaction?.date || 'Today'
  );
  const [displayExpr, setDisplayExpr] = useState<string>(
    editingTransaction
      ? editingTransaction.rawExpression || editingTransaction.amount.toString()
      : ''
  );
  const [memo, setMemo] = useState<string>(
    editingTransaction?.memo || ''
  );
  const [showMemoSuggestions, setShowMemoSuggestions] = useState(false);

  const [person, setPerson] = useState<string>(
    editingTransaction?.person || editingTransaction?.payee || editingTransaction?.tag || ''
  );
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

  // Extract previous unique memo and title entries for auto-suggestions (most recent first)
  const previousMemos = useMemo(() => {
    const set = new Set<string>();
    const source = (transactions && transactions.length > 0) ? transactions : INITIAL_TRANSACTIONS;
    
    // Sort transactions descending (most recent first)
    const sorted = [...source].sort((a, b) => {
      let timeA = new Date(a.date).getTime();
      let timeB = new Date(b.date).getTime();
      if (isNaN(timeA)) timeA = 0;
      if (isNaN(timeB)) timeB = 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    sorted.forEach((tx) => {
      if (tx.memo && tx.memo.trim()) set.add(tx.memo.trim());
      if (tx.title && tx.title.trim()) set.add(tx.title.trim());
    });
    return Array.from(set);
  }, [transactions]);

  // Extract previous unique person entries for auto-suggestions (most recent first)
  const previousPersons = useMemo(() => {
    const set = new Set<string>();
    const source = (transactions && transactions.length > 0) ? transactions : INITIAL_TRANSACTIONS;

    const sorted = [...source].sort((a, b) => {
      let timeA = new Date(a.date).getTime();
      let timeB = new Date(b.date).getTime();
      if (isNaN(timeA)) timeA = 0;
      if (isNaN(timeB)) timeB = 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    sorted.forEach((tx) => {
      const p = tx.person || tx.payee || tx.tag;
      if (p && p.trim()) set.add(p.trim());
    });
    return Array.from(set);
  }, [transactions]);

  // Filter similar memos based on current memo query
  const matchingMemos = useMemo(() => {
    const trimmed = memo.trim().toLowerCase();
    if (!trimmed) {
      // If memo is empty, show up to 5 recent memos when suggestions are active
      return previousMemos.slice(0, 5);
    }
    return previousMemos
      .filter((m) => m.toLowerCase().includes(trimmed) && m.toLowerCase() !== trimmed)
      .slice(0, 6);
  }, [memo, previousMemos]);

  // Filter similar persons based on current person query
  const matchingPersons = useMemo(() => {
    const trimmed = person.trim().toLowerCase();
    if (!trimmed) {
      return previousPersons.slice(0, 5);
    }
    return previousPersons
      .filter((p) => p.toLowerCase().includes(trimmed) && p.toLowerCase() !== trimmed)
      .slice(0, 6);
  }, [person, previousPersons]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    editingTransaction?.category || (categories.length > 0 ? categories[0].name : 'Groceries')
  );
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCatForModal, setEditingCatForModal] = useState<CategoryTemplate | null>(null);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [showCategorySettingsModal, setShowCategorySettingsModal] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [accountPickerTarget, setAccountPickerTarget] = useState<'from' | 'to' | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const handleApplyParsedAiTransaction = (parsed: ParsedAiTransaction) => {
    if (parsed.amount > 0) {
      setDisplayExpr(parsed.amount.toString());
    }
    if (parsed.type) {
      setTxType(parsed.type);
    }
    if (parsed.category) {
      // Find matching category case-insensitively
      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
      );
      if (matchedCat) {
        setSelectedCategory(matchedCat.name);
      } else if (categories.length > 0) {
        setSelectedCategory(parsed.category);
      }
    }
    if (parsed.memo || parsed.title) {
      setMemo(parsed.memo || parsed.title || '');
    }
    if (parsed.payee) {
      setPerson(parsed.payee);
    }
    if (parsed.date) {
      setTxDate(parsed.date);
    }
    if (parsed.accountName && accounts.length > 0) {
      const matchedAcc = accounts.find(
        (a) => a.name.toLowerCase().includes(parsed.accountName!.toLowerCase())
      );
      if (matchedAcc) {
        setSelectedAccountId(matchedAcc.id);
      }
    }
    if (parsed.toAccountName && accounts.length > 0) {
      const matchedToAcc = accounts.find(
        (a) => a.name.toLowerCase().includes(parsed.toAccountName!.toLowerCase())
      );
      if (matchedToAcc) {
        setSelectedToAccountId(matchedToAcc.id);
      }
    }
  };

  const selectedAcc = useMemo(() => accounts.find((a) => a.id === selectedAccountId), [accounts, selectedAccountId]);
  const selectedToAcc = useMemo(() => accounts.find((a) => a.id === selectedToAccountId), [accounts, selectedToAccountId]);

  const categoryBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Compute available budget for each category
  const categoryAvailableMap = useMemo(() => {
    const map = new Map<string, { available: number; isRolling: boolean; dailyRate?: number }>();
    const txs = transactions || [];
    const breakdown = getCategoryBreakdown(txs, categories);
    const paydayAnchor = config?.paydayAnchorDay || 1;

    categories.forEach((cat) => {
      const limit = cat.budgetLimit ?? 300;
      const rollover = cat.rolloverEnabled ?? true;
      const rolledOver = cat.rolledOverAmount ?? 0;
      const effectiveBudget = limit + (rollover ? rolledOver : 0);

      if (cat.rollingDailyEnabled) {
        const pacing = getRollingDailyCategoryPacing(cat.name, effectiveBudget, paydayAnchor, txs);
        map.set(cat.name.toLowerCase(), {
          available: pacing.availableToSpendToday,
          isRolling: true,
          dailyRate: pacing.dailyBaseRate,
        });
      } else {
        const catStats = breakdown.find((b) => b.category.toLowerCase() === cat.name.toLowerCase());
        const spent = catStats ? catStats.amount : 0;
        map.set(cat.name.toLowerCase(), {
          available: effectiveBudget - spent,
          isRolling: false,
        });
      }
    });

    return map;
  }, [categories, transactions, config?.paydayAnchorDay]);

  // Filter categories by transaction type (Expense vs Income)
  const displayCategories = categories.filter(
    (c) => (c.type || 'expense') === txType
  );

  // Auto-switch selected category if current one does not belong to txType
  useEffect(() => {
    if (displayCategories.length > 0) {
      const exists = displayCategories.some(
        (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
      );
      if (!exists) {
        setSelectedCategory(displayCategories[0].name);
      }
    }
  }, [txType, categories]);

  // Auto-scroll horizontal category bar when a category is selected
  useEffect(() => {
    if (!selectedCategory) return;
    const timer = setTimeout(() => {
      const btn = categoryBtnRefs.current.get(selectedCategory.toLowerCase());
      if (btn) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedCategory, showAllCategoriesModal]);

  const getFormattedDateValue = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const lower = dateStr.toLowerCase().trim();
    const now = new Date();
    if (lower === 'today') {
      return now.toISOString().split('T')[0];
    }
    if (lower === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return now.toISOString().split('T')[0];
  };

  const initialIso = getFormattedDateValue(txDate);
  const initialDateObj = new Date(initialIso + 'T00:00:00');

  const [calYear, setCalYear] = useState<number>(
    !isNaN(initialDateObj.getTime()) ? initialDateObj.getFullYear() : new Date().getFullYear()
  );
  const [calMonth, setCalMonth] = useState<number>(
    !isNaN(initialDateObj.getTime()) ? initialDateObj.getMonth() : new Date().getMonth()
  );
  const [datePickerMode, setDatePickerMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = useState<number>(calYear - 5);

  useEffect(() => {
    if (showDatePickerModal) {
      setDatePickerMode('days');
      setYearPageStart(calYear - 5);
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [showDatePickerModal, calYear]);

  useEffect(() => {
    if (showAllCategoriesModal) {
      const origBodyOverflow = document.body.style.overflow;
      const origHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origBodyOverflow;
        document.documentElement.style.overflow = origHtmlOverflow;
      };
    }
  }, [showAllCategoriesModal]);

  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr || dateStr === 'Today') return 'Today';
    if (dateStr === 'Yesterday') return 'Yesterday';
    const isoStr = getFormattedDateValue(dateStr);
    const parsed = new Date(isoStr + 'T00:00:00');
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return dateStr;
  };

  const handlePrev = () => {
    if (datePickerMode === 'days') {
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear((prev) => prev - 1);
      } else {
        setCalMonth((prev) => prev - 1);
      }
    } else if (datePickerMode === 'months') {
      setCalYear((prev) => prev - 1);
    } else if (datePickerMode === 'years') {
      setYearPageStart((prev) => prev - 12);
    }
  };

  const handleNext = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (datePickerMode === 'days') {
      if (calYear > currentYear || (calYear === currentYear && calMonth >= currentMonth)) return;
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear((prev) => prev + 1);
      } else {
        setCalMonth((prev) => prev + 1);
      }
    } else if (datePickerMode === 'months') {
      if (calYear >= currentYear) return;
      setCalYear((prev) => prev + 1);
    } else if (datePickerMode === 'years') {
      if (yearPageStart + 11 >= currentYear) return;
      setYearPageStart((prev) => prev + 12);
    }
  };

  const handleSelectDay = (day: number) => {
    const selectedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayIso = new Date().toISOString().split('T')[0];
    if (selectedIso > todayIso) return;

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayIso = yesterdayObj.toISOString().split('T')[0];

    if (selectedIso === todayIso) {
      setTxDate('Today');
    } else if (selectedIso === yesterdayIso) {
      setTxDate('Yesterday');
    } else {
      setTxDate(selectedIso);
    }
  };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const SHORT_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Fixed 42-cell array (6 rows x 7 days) to prevent modal height layout shifts/jumping
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

  // Safely evaluate math expression string e.g. "12.50 + 8.99"
  const calculateResult = (expr: string): number => {
    try {
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');
      const trimmed = sanitized.replace(/[+\-*/\s]+$/, '');
      if (!trimmed) return 0;
      
      // Simple math parser for + - * /
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${trimmed})`)();
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  };

  const calculatedValue = calculateResult(displayExpr);

  const handleResetAll = () => {
    setDisplayExpr('');
    setMemo('');
    setTxDate('Today');
    setTxType('expense');
    setSelectedCategory(categories.length > 0 ? categories[0].name : 'Groceries');
  };

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setDisplayExpr('');
      return;
    }

    if (key === 'backspace') {
      setDisplayExpr((prev) => prev.slice(0, -1));
      return;
    }

    if (key === '=') {
      const val = calculateResult(displayExpr);
      setDisplayExpr(val > 0 ? val.toFixed(2) : '');
      return;
    }

    if (['+', '−', '×', '÷'].includes(key)) {
      setDisplayExpr((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return '';
        if (['+', '−', '×', '÷'].some((op) => trimmed.endsWith(op))) {
          return trimmed.slice(0, -1) + ` ${key} `;
        }
        return `${trimmed} ${key} `;
      });
      return;
    }

    setDisplayExpr((prev) => prev + key);
  };

  const handleSave = () => {
    const finalAmount = calculatedValue > 0 ? calculatedValue : parseFloat(displayExpr) || 0;
    if (finalAmount <= 0) return;

    const memoText = memo.trim();
    const personText = person.trim();

    if (isEditMode && editingTransaction && onUpdateTransaction) {
      onUpdateTransaction(editingTransaction.id, {
        type: txType,
        category: txType === 'transfer' ? 'Transfer' : selectedCategory,
        title: txType === 'transfer' ? 'Account Transfer' : selectedCategory,
        amount: finalAmount,
        date: txDate,
        memo: memoText,
        person: personText || undefined,
        payee: personText || undefined,
        tag: personText || undefined,
        accountId: selectedAccountId || undefined,
        toAccountId: txType === 'transfer' ? selectedToAccountId : undefined,
        isTransfer: txType === 'transfer',
        rawExpression: displayExpr.trim() !== `${finalAmount}` ? displayExpr : undefined,
      });
      if (onClearEditingTransaction) {
        onClearEditingTransaction();
      }
    } else {
      onAddTransaction({
        type: txType,
        category: txType === 'transfer' ? 'Transfer' : selectedCategory,
        title: txType === 'transfer' ? 'Account Transfer' : selectedCategory,
        amount: finalAmount,
        date: txDate || 'Today',
        memo: memoText,
        person: personText || undefined,
        payee: personText || undefined,
        tag: personText || undefined,
        accountId: selectedAccountId || undefined,
        toAccountId: txType === 'transfer' ? selectedToAccountId : undefined,
        isTransfer: txType === 'transfer',
        rawExpression: displayExpr.trim() !== `${finalAmount}` ? displayExpr : undefined,
        isAutoParsed: true,
      });
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setActiveTab('ledger');
    }, 600);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between p-3 sm:p-4 gap-[clamp(6px,1.2vh,14px)] min-h-[460px] max-h-[calc(100dvh-170px)] md:max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar">
      {/* Header */}
      <header className="flex items-center justify-between w-full shrink-0 py-1">
        <button
          onClick={() => setActiveTab('ledger')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#e7e8e9] transition-colors active:scale-95 text-[#44474c]"
          title="Cancel"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Expense / Income / Transfer Segmented Switch */}
        <div className="flex bg-[#e8eaed] p-1 rounded-xl border border-[#c4c6cd]/20">
          <button
            type="button"
            onClick={() => setTxType('expense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              txType === 'expense'
                ? 'bg-[#006397] text-white shadow-xs'
                : 'text-[#44474c] hover:bg-[#d8dadf]'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setTxType('income')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              txType === 'income'
                ? 'bg-[#00a656] text-white shadow-xs'
                : 'text-[#44474c] hover:bg-[#d8dadf]'
            }`}
          >
            Income
          </button>
          {accounts.length > 0 && (
            <button
              type="button"
              onClick={() => setTxType('transfer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                txType === 'transfer'
                  ? 'bg-[#6b4ea2] text-white shadow-xs'
                  : 'text-[#44474c] hover:bg-[#d8dadf]'
              }`}
            >
              Transfer
            </button>
          )}
        </div>

        <button
          onClick={handleResetAll}
          className="px-3 py-1.5 text-xs font-bold text-[#44474c] hover:bg-[#e7e8e9] rounded-lg transition-colors active:scale-95"
          title="Reset all fields"
        >
          Clear
        </button>
      </header>

      {/* Gemini AI Smart Assist Trigger Banner */}
      <div className="w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="w-full py-2.5 px-3.5 bg-gradient-to-r from-[#00476e] via-[#006397] to-[#0082c4] text-white rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer active:scale-98 group border border-white/20"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px] text-[#92ccff]">auto_awesome</span>
            </div>
            <div className="text-left">
              <span className="text-xs font-extrabold block leading-tight">AI Quick Log & Receipt Scanner</span>
              <span className="text-[10px] text-[#92ccff] font-medium block">Parse text or scan receipt photo with Gemini</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-white/80 group-hover:translate-x-0.5 transition-transform">chevron_right</span>
        </button>
      </div>

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="px-3.5 py-2 bg-[#006397]/10 border border-[#006397]/20 rounded-xl flex items-center justify-between text-xs font-bold text-[#006397] shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Editing Transaction
          </span>
          <button
            onClick={() => setActiveTab('ledger')}
            className="text-[11px] underline hover:text-[#00476e]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Amount & Memo Display Card */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-[#c4c6cd]/20 flex flex-col gap-2 sm:gap-2.5 shrink-0">
        <div className="flex flex-col text-right">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#041627] tracking-tight overflow-x-auto no-scrollbar whitespace-nowrap leading-tight py-0.5 min-h-[36px]">
            {displayExpr || <span className="text-[#c4c6cd]">0</span>}
          </div>
          <div className="text-xs sm:text-sm font-semibold text-[#006397]">
            = {sym}{calculatedValue.toFixed(2)}
          </div>
        </div>

        {/* Bank Account Selector Row */}
        {accounts.length > 0 && (
          <div className="pt-2 border-t border-[#f0f1f2] flex flex-col gap-2 text-xs w-full">
            {txType === 'transfer' ? (
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between text-[#44474c] font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#6b4ea2] text-[18px]">sync_alt</span>
                    <span>Transfer Accounts:</span>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 w-full min-w-0">
                  {/* Source Account Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearchQuery('');
                      setAccountPickerTarget('from');
                    }}
                    className="flex items-center justify-between gap-1 px-2.5 py-1.5 bg-[#f0f2f5] hover:bg-[#e1e3e4] border border-[#c4c6cd]/30 rounded-xl font-extrabold text-xs text-[#041627] transition-all cursor-pointer min-w-0 w-full"
                    title={`From: ${selectedAcc?.name || 'Source Account'}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] shrink-0 font-bold"
                        style={{ backgroundColor: selectedAcc?.color || '#006397' }}
                      >
                        <span className="material-symbols-outlined text-[10px]">
                          {selectedAcc?.icon || 'account_balance'}
                        </span>
                      </div>
                      <span className="truncate text-[11px] font-extrabold">{selectedAcc?.name || 'Source'}</span>
                    </div>
                    <span className="material-symbols-outlined text-[14px] text-[#74777d] shrink-0">unfold_more</span>
                  </button>

                  {/* Transfer Arrow Icon */}
                  <div className="w-5 h-5 rounded-full bg-[#6b4ea2]/10 text-[#6b4ea2] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[12px] font-bold">arrow_forward</span>
                  </div>

                  {/* Target Account Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearchQuery('');
                      setAccountPickerTarget('to');
                    }}
                    className="flex items-center justify-between gap-1 px-2.5 py-1.5 bg-[#f0f2f5] hover:bg-[#e1e3e4] border border-[#c4c6cd]/30 rounded-xl font-extrabold text-xs text-[#041627] transition-all cursor-pointer min-w-0 w-full"
                    title={`To: ${selectedToAcc?.name || 'Destination Account'}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] shrink-0 font-bold"
                        style={{ backgroundColor: selectedToAcc?.color || '#006397' }}
                      >
                        <span className="material-symbols-outlined text-[10px]">
                          {selectedToAcc?.icon || 'account_balance'}
                        </span>
                      </div>
                      <span className="truncate text-[11px] font-extrabold">{selectedToAcc?.name || 'Destination'}</span>
                    </div>
                    <span className="material-symbols-outlined text-[14px] text-[#74777d] shrink-0">unfold_more</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs gap-2 w-full">
                <div className="flex items-center gap-1.5 text-[#44474c] font-semibold shrink-0">
                  <span className="material-symbols-outlined text-[#006397] text-[18px]">account_balance</span>
                  <span>Account:</span>
                </div>
                {/* Single Account Selector Button */}
                <button
                  type="button"
                  onClick={() => {
                    setAccountSearchQuery('');
                    setAccountPickerTarget('from');
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#f0f2f5] hover:bg-[#e1e3e4] border border-[#c4c6cd]/30 rounded-xl font-bold text-xs text-[#041627] transition-all cursor-pointer shadow-2xs max-w-[calc(100%-80px)] min-w-0 truncate"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 font-bold shadow-2xs"
                    style={{ backgroundColor: selectedAcc?.color || '#006397' }}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {selectedAcc?.icon || 'account_balance'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-extrabold text-[#041627] truncate">{selectedAcc?.name || 'Select Account'}</span>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#006397]/10 text-[#006397] shrink-0">
                      {selectedAcc?.type || 'Bank'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#74777d] ml-0.5 shrink-0">unfold_more</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Date Selector Row */}
        <div className="pt-2 border-t border-[#f0f1f2] flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 text-[#44474c] font-medium shrink-0">
            <span className="material-symbols-outlined text-[#006397] text-[18px]">calendar_today</span>
            <span>Date:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setTxDate('Today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                txDate === 'Today'
                  ? 'bg-[#006397] text-white shadow-xs'
                  : 'bg-[#f0f2f5] text-[#44474c] hover:bg-[#e4e7ec]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTxDate('Yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                txDate === 'Yesterday'
                  ? 'bg-[#006397] text-white shadow-xs'
                  : 'bg-[#f0f2f5] text-[#44474c] hover:bg-[#e4e7ec]'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => {
                const curIso = getFormattedDateValue(txDate);
                const curObj = new Date(curIso + 'T00:00:00');
                if (!isNaN(curObj.getTime())) {
                  setCalYear(curObj.getFullYear());
                  setCalMonth(curObj.getMonth());
                }
                setShowDatePickerModal(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 border ${
                txDate !== 'Today' && txDate !== 'Yesterday'
                  ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                  : 'bg-white text-[#006397] border-[#006397]/30 hover:bg-[#e3f2fd]'
              }`}
            >
              <span>
                {txDate !== 'Today' && txDate !== 'Yesterday'
                  ? formatDisplayDate(txDate)
                  : 'Pick Date'}
              </span>
              <span className="material-symbols-outlined text-[15px]">
                {txDate !== 'Today' && txDate !== 'Yesterday' ? 'edit_calendar' : 'calendar_month'}
              </span>
            </button>
          </div>
        </div>

        {/* Category Selection Bar (After Date - Only for Expense & Income) */}
        {txType !== 'transfer' && (
          <div className="pt-2 border-t border-[#f0f1f2] flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#44474c] uppercase tracking-wider">
                  Category: <span className="text-[#006397] font-extrabold capitalize">{selectedCategory}</span>
                </span>
                {(() => {
                  const selAvail = categoryAvailableMap.get(selectedCategory.toLowerCase());
                  if (!selAvail) return null;
                  return (
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                      selAvail.available >= 0 ? 'bg-[#00a656]/15 text-[#00a656]' : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
                    }`}>
                      {selAvail.isRolling ? 'Today: ' : 'Avail: '}
                      {selAvail.available >= 0 ? `+${sym}${selAvail.available.toFixed(2)}` : `-${sym}${Math.abs(selAvail.available).toFixed(2)}`}
                    </span>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategorySearchQuery('');
                  setShowAllCategoriesModal(true);
                }}
                className="text-xs font-extrabold text-[#006397] hover:text-[#00476e] transition-colors py-0.5 px-2 rounded-lg hover:bg-[#006397]/10 active:scale-95"
              >
                <span>Show All</span>
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
              {displayCategories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                const catColor = cat.color || '#006397';
                const availInfo = categoryAvailableMap.get(cat.name.toLowerCase());
                const availVal = availInfo ? availInfo.available : 0;

                return (
                  <button
                    key={cat.id}
                    ref={(el) => {
                      if (el) categoryBtnRefs.current.set(cat.name.toLowerCase(), el);
                    }}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      backgroundColor: isSelected ? catColor : '#ffffff',
                      borderColor: isSelected ? catColor : 'rgba(196, 198, 205, 0.3)',
                      color: isSelected ? '#ffffff' : '#44474c',
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs shrink-0 transition-all active:scale-95 shadow-2xs ${
                      isSelected ? 'font-bold shadow-xs' : 'hover:bg-[#f3f4f5] font-medium'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ color: isSelected ? '#ffffff' : catColor }}
                    >
                      {cat.icon || 'shopping_basket'}
                    </span>
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white font-extrabold'
                          : availVal >= 0
                          ? 'text-[#00a656] bg-[#00a656]/10 font-bold'
                          : 'text-[#ba1a1a] bg-[#ba1a1a]/10 font-bold'
                      }`}
                    >
                      {availVal >= 0 ? `+${sym}${availVal.toFixed(0)}` : `-${sym}${Math.abs(availVal).toFixed(0)}`}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => setShowAddCatModal(true)}
                className="flex items-center justify-center bg-white text-[#44474c] hover:text-[#006397] px-3 py-1.5 rounded-full border border-dashed border-[#c4c6cd]/80 hover:border-[#006397] hover:bg-[#f3f4f5] shrink-0 text-xs font-semibold gap-1 transition-all"
                title="Add new category with custom icon & color"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>New</span>
              </button>
            </div>
          </div>
        )}

        {/* Memo Input Row (Below Category) */}
        <div className="pt-2 border-t border-[#f0f1f2] flex flex-col gap-1.5 relative">
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[#74777d] text-[18px]">edit_note</span>
            <input
              type="text"
              value={memo}
              onChange={(e) => {
                setMemo(e.target.value);
                setShowMemoSuggestions(true);
              }}
              onFocus={() => setShowMemoSuggestions(true)}
              placeholder="Add memo (optional)..."
              className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-xs sm:text-sm text-[#191c1d] placeholder:text-[#94979e] py-0.5"
            />
            {memo && (
              <button
                type="button"
                onClick={() => setMemo('')}
                className="text-[#94979e] hover:text-[#44474c] p-0.5 rounded-full flex items-center justify-center shrink-0"
                title="Clear memo"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>

          {/* Similar Memos Suggestions Dropdown */}
          {showMemoSuggestions && matchingMemos.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2 pb-1.5 border-t border-[#e8eaed] bg-[#f8f9fa] rounded-xl p-2.5 shadow-2xs transition-all animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#74777d] uppercase tracking-wider px-0.5">
                <span>{memo.trim() ? 'Matching Memos' : 'Recent Memos'}</span>
                <button
                  type="button"
                  onClick={() => setShowMemoSuggestions(false)}
                  className="text-[#006397] hover:underline normal-case font-semibold text-[11px]"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
                {matchingMemos.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur before input update
                      setMemo(sug);
                      setShowMemoSuggestions(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#c4c6cd]/40 hover:border-[#006397] hover:bg-[#e3f2fd] active:scale-95 text-xs font-medium text-[#191c1d] transition-all shadow-2xs text-left"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#006397]">history</span>
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tag / Person / Purpose Input Row (Below Memo) */}
        <div className="pt-2 border-t border-[#f0f1f2] flex flex-col gap-1.5 relative">
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[#006397] text-[18px]">sell</span>
            <input
              type="text"
              value={person}
              onChange={(e) => {
                setPerson(e.target.value);
                setShowPersonSuggestions(true);
              }}
              onFocus={() => setShowPersonSuggestions(true)}
              placeholder="Tag / Person / Purpose (e.g. Mom, Vacation, Office)..."
              className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-xs sm:text-sm text-[#191c1d] placeholder:text-[#94979e] py-0.5 font-medium"
            />
            {person && (
              <button
                type="button"
                onClick={() => setPerson('')}
                className="text-[#94979e] hover:text-[#44474c] p-0.5 rounded-full flex items-center justify-center shrink-0"
                title="Clear tag/person"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>

          {/* Similar Persons & Tags Suggestions Dropdown */}
          {showPersonSuggestions && matchingPersons.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2 pb-1.5 border-t border-[#e8eaed] bg-[#f0f7fc] rounded-xl p-2.5 shadow-2xs transition-all animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#006397] uppercase tracking-wider px-0.5">
                <span>{person.trim() ? 'Matching Tags / Persons' : 'Recent Tags / Persons'}</span>
                <button
                  type="button"
                  onClick={() => setShowPersonSuggestions(false)}
                  className="text-[#006397] hover:underline normal-case font-semibold text-[11px]"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
                {matchingPersons.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPerson(sug);
                      setShowPersonSuggestions(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#006397]/30 hover:border-[#006397] hover:bg-[#e3f2fd] active:scale-95 text-xs font-semibold text-[#006397] transition-all shadow-2xs text-left"
                  >
                    <span className="material-symbols-outlined text-[14px]">sell</span>
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keypad Grid & Save Button */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {/* Row 1 */}
          <button
            onClick={() => handleKeyPress('C')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-sm text-[#44474c] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            C
          </button>
          <button
            onClick={() => handleKeyPress('÷')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-base text-[#006397] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            ÷
          </button>
          <button
            onClick={() => handleKeyPress('×')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-base text-[#006397] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            ×
          </button>
          <button
            onClick={() => handleKeyPress('backspace')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-sm text-[#44474c] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">backspace</span>
          </button>

          {/* Row 2 */}
          <button
            onClick={() => handleKeyPress('7')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            7
          </button>
          <button
            onClick={() => handleKeyPress('8')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            8
          </button>
          <button
            onClick={() => handleKeyPress('9')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            9
          </button>
          <button
            onClick={() => handleKeyPress('−')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-base text-[#006397] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            −
          </button>

          {/* Row 3 */}
          <button
            onClick={() => handleKeyPress('4')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            4
          </button>
          <button
            onClick={() => handleKeyPress('5')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            5
          </button>
          <button
            onClick={() => handleKeyPress('6')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            6
          </button>
          <button
            onClick={() => handleKeyPress('+')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-[#f0f2f5] border border-[#c4c6cd]/20 font-bold text-base text-[#006397] hover:bg-[#e4e7ec] active:scale-95 transition-all flex items-center justify-center"
          >
            +
          </button>

          {/* Row 4 */}
          <button
            onClick={() => handleKeyPress('1')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            1
          </button>
          <button
            onClick={() => handleKeyPress('2')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            2
          </button>
          <button
            onClick={() => handleKeyPress('3')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            3
          </button>
          <button
            onClick={() => handleKeyPress('=')}
            className="rounded-xl bg-[#e3f2fd] border border-[#006397]/20 font-bold text-base text-[#006397] hover:bg-[#bbdefb] active:scale-95 transition-all flex items-center justify-center row-span-2"
          >
            =
          </button>

          {/* Row 5 */}
          <button
            onClick={() => handleKeyPress('0')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center col-span-2"
          >
            0
          </button>
          <button
            onClick={() => handleKeyPress('.')}
            className="h-[clamp(34px,4.5vh,44px)] rounded-xl bg-white border border-[#c4c6cd]/20 font-bold text-base text-[#191c1d] hover:bg-[#f3f4f5] active:scale-95 transition-all flex items-center justify-center"
          >
            .
          </button>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={savedSuccess}
          className={`w-full h-[clamp(40px,5vh,48px)] rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
            savedSuccess
              ? 'bg-[#00a656] text-white'
              : txType === 'income'
              ? 'bg-[#00a656] text-white hover:bg-[#00a656]/90 shadow-[#00a656]/20'
              : 'bg-[#006397] text-white hover:bg-[#006397]/90 shadow-[#006397]/20'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {savedSuccess ? 'done_all' : 'check_circle'}
          </span>
          <span>
            {savedSuccess
              ? isEditMode
                ? 'Updated!'
                : 'Saved!'
              : isEditMode
              ? 'Update Transaction'
              : 'Save Transaction'}
          </span>
        </button>
      </div>

      {/* Add Custom Category Modal */}
      <AddCategoryModal
        isOpen={showAddCatModal}
        initialCategory={editingCatForModal}
        defaultType={txType}
        onClose={() => {
          setShowAddCatModal(false);
          setEditingCatForModal(null);
        }}
        onSaveCategory={(catData) => {
          if (editingCatForModal && onUpdateCategory) {
            onUpdateCategory(editingCatForModal.id, catData);
          } else if (onAddCategory) {
            onAddCategory(catData);
          }
          setSelectedCategory(catData.name);
          setShowAddCatModal(false);
          setEditingCatForModal(null);
        }}
        currencySymbol={sym}
      />

      {/* Category Settings Modal */}
      <CategorySettingsModal
        isOpen={showCategorySettingsModal}
        onClose={() => setShowCategorySettingsModal(false)}
        categories={categories}
        initialTab={txType}
        onEditCategory={(cat) => {
          setEditingCatForModal(cat);
          setShowAddCatModal(true);
        }}
        onDeleteCategory={onDeleteCategory}
        onReorderCategories={onReorderCategories}
        onAddNewCategory={() => {
          setEditingCatForModal(null);
          setShowAddCatModal(true);
        }}
      />

      {/* Show All Categories Popup Modal */}
      {showAllCategoriesModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#041627]/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 overscroll-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAllCategoriesModal(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#c4c6cd]/20 gap-3 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#f0f1f2] pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006397] text-[20px]">category</span>
                <h3 className="font-bold text-sm text-[#191c1d] capitalize">{txType} Categories</h3>
                <span className="text-[10px] font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-full">
                  {displayCategories.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllCategoriesModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f0f2f5] text-[#74777d] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Action Header Bar with Search, Category Settings & Add Category Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[#74777d] text-[18px] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder={`Search ${txType} categories...`}
                  className="w-full pl-8 pr-2 py-1.5 bg-[#f3f4f5] rounded-xl text-xs font-medium border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397] text-[#191c1d]"
                />
              </div>

              {/* Category Settings Button */}
              <button
                type="button"
                onClick={() => setShowCategorySettingsModal(true)}
                className="px-2.5 py-1.5 bg-[#f0f4f8] text-[#006397] border border-[#006397]/30 hover:bg-[#e2edf5] text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0 active:scale-95"
                title="Category Settings (Edit, Delete, Reorder)"
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                <span className="text-[11px]">Settings</span>
              </button>

              {/* Add Category Button in Modal */}
              <button
                type="button"
                onClick={() => {
                  setEditingCatForModal(null);
                  setShowAddCatModal(true);
                }}
                className="px-2.5 py-1.5 bg-[#006397] text-white text-xs font-bold rounded-xl hover:bg-[#00476e] transition-colors flex items-center gap-1 shadow-xs shrink-0 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add</span>
              </button>
            </div>

            {/* Categories List Grid */}
            <div className="overflow-y-auto max-h-[55vh] overscroll-contain pr-1 grid grid-cols-2 gap-2 my-1">
              {displayCategories
                .filter((cat) =>
                  cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase().trim())
                )
                .map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                  const catColor = cat.color || '#006397';
                  const availInfo = categoryAvailableMap.get(cat.name.toLowerCase());

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setShowAllCategoriesModal(false);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2 active:scale-95 ${
                        isSelected
                          ? 'border-2 shadow-xs bg-[#f0f4f8]'
                          : 'bg-[#f8f9fa] border-[#c4c6cd]/30 hover:border-[#006397]/50 hover:bg-white'
                      }`}
                      style={{
                        borderColor: isSelected ? catColor : undefined,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isSelected ? catColor : `${catColor}20`,
                          color: isSelected ? '#ffffff' : catColor,
                        }}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {cat.icon || 'shopping_cart'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-[#191c1d] block truncate">
                          {cat.name}
                        </span>
                        {availInfo && (
                          <span className={`text-[10px] font-bold font-mono block ${
                            availInfo.available >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                          }`}>
                            {availInfo.isRolling ? 'Today: ' : 'Avail: '}
                            {availInfo.available >= 0 ? `+${sym}${availInfo.available.toFixed(2)}` : `-${sym}${Math.abs(availInfo.available).toFixed(2)}`}
                          </span>
                        )}
                        {isSelected && !availInfo && (
                          <span className="text-[10px] font-extrabold text-[#006397] block">
                            Selected
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[#006397] text-[18px] shrink-0">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Picker Modal */}
      {showDatePickerModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041627]/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDatePickerModal(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl p-4 max-w-xs w-full max-h-[88vh] shadow-2xl border border-[#c4c6cd]/20 flex flex-col gap-3 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#f0f1f2] pb-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#191c1d]">
                <span className="material-symbols-outlined text-[#006397] text-[20px]">calendar_month</span>
                <span>Select Date</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f0f2f5] text-[#74777d]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setTxDate('Today');
                  const now = new Date();
                  setCalYear(now.getFullYear());
                  setCalMonth(now.getMonth());
                  setDatePickerMode('days');
                }}
                className={`py-1.5 px-2 rounded-xl text-center border transition-all ${
                  txDate === 'Today'
                    ? 'bg-[#006397] text-white font-bold border-[#006397]'
                    : 'bg-[#f8f9fa] text-[#44474c] border-[#c4c6cd]/20 hover:bg-[#f0f2f5]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxDate('Yesterday');
                  const yest = new Date();
                  yest.setDate(yest.getDate() - 1);
                  setCalYear(yest.getFullYear());
                  setCalMonth(yest.getMonth());
                  setDatePickerMode('days');
                }}
                className={`py-1.5 px-2 rounded-xl text-center border transition-all ${
                  txDate === 'Yesterday'
                    ? 'bg-[#006397] text-white font-bold border-[#006397]'
                    : 'bg-[#f8f9fa] text-[#44474c] border-[#c4c6cd]/20 hover:bg-[#f0f2f5]'
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Header Controls for Month / Year Mode Selection */}
            <div className="flex items-center justify-between pt-1 px-1">
              <button
                type="button"
                onClick={handlePrev}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f0f2f5] text-[#44474c] transition-colors"
                title="Previous"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>

              <div className="flex items-center gap-1.5">
                {/* Clickable Month Selector */}
                <button
                  type="button"
                  onClick={() => setDatePickerMode(datePickerMode === 'months' ? 'days' : 'months')}
                  className={`px-2 py-1 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1 ${
                    datePickerMode === 'months'
                      ? 'bg-[#006397] text-white shadow-2xs'
                      : 'bg-[#f3f4f5] hover:bg-[#e8eaed] text-[#191c1d] border border-[#c4c6cd]/30'
                  }`}
                >
                  <span>{SHORT_MONTHS[calMonth]}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {datePickerMode === 'months' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Clickable Year Selector */}
                <button
                  type="button"
                  onClick={() => {
                    if (datePickerMode !== 'years') {
                      setYearPageStart(calYear - 5);
                    }
                    setDatePickerMode(datePickerMode === 'years' ? 'days' : 'years');
                  }}
                  className={`px-2 py-1 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1 ${
                    datePickerMode === 'years'
                      ? 'bg-[#006397] text-white shadow-2xs'
                      : 'bg-[#f3f4f5] hover:bg-[#e8eaed] text-[#191c1d] border border-[#c4c6cd]/30'
                  }`}
                >
                  <span>{datePickerMode === 'years' ? `${yearPageStart}–${yearPageStart + 11}` : calYear}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {datePickerMode === 'years' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={
                  datePickerMode === 'days'
                    ? calYear > new Date().getFullYear() || (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth())
                    : datePickerMode === 'months'
                    ? calYear >= new Date().getFullYear()
                    : yearPageStart + 11 >= new Date().getFullYear()
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[#44474c] transition-colors ${
                  (
                    datePickerMode === 'days'
                      ? calYear > new Date().getFullYear() || (calYear === new Date().getFullYear() && calMonth >= new Date().getMonth())
                      : datePickerMode === 'months'
                      ? calYear >= new Date().getFullYear()
                      : yearPageStart + 11 >= new Date().getFullYear()
                  )
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-[#f0f2f5]'
                }`}
                title="Next"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>

            {/* Calendar View Container with Fixed Height Grid */}
            <div className="bg-[#f8f9fa] rounded-xl p-2.5 border border-[#c4c6cd]/15">
              {datePickerMode === 'days' && (
                <>
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#74777d] uppercase mb-1">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  {/* Day Cells - 42 fixed cells (6 rows x 7 days) to prevent row/height changes */}
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {daysArray.map((dayNum, idx) => {
                      if (dayNum === null) {
                        return <div key={`empty-${idx}`} className="h-8" />;
                      }

                      const currentIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const selectedIso = getFormattedDateValue(txDate);
                      const isSelected = currentIso === selectedIso;
                      const todayIso = new Date().toISOString().split('T')[0];
                      const isToday = currentIso === todayIso;
                      const isFuture = currentIso > todayIso;

                      return (
                        <button
                          key={`day-${dayNum}-${idx}`}
                          type="button"
                          disabled={isFuture}
                          onClick={() => !isFuture && handleSelectDay(dayNum)}
                          className={`h-8 w-full rounded-lg font-bold flex items-center justify-center transition-all ${
                            isFuture
                              ? 'opacity-30 cursor-not-allowed text-[#94979e] bg-transparent'
                              : isSelected
                              ? 'bg-[#006397] text-white shadow-xs scale-105'
                              : isToday
                              ? 'border-2 border-[#006397] text-[#006397] bg-white'
                              : 'text-[#191c1d] hover:bg-[#e8eaed]'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Months Selection View - Fixed height container matching days view */}
              {datePickerMode === 'months' && (
                <div className="grid grid-cols-3 gap-2 py-1 h-[216px] items-center">
                  {MONTH_NAMES.map((m, idx) => {
                    const isSelected = calMonth === idx;
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth();
                    const isFutureMonth = calYear > currentYear || (calYear === currentYear && idx > currentMonth);

                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isFutureMonth}
                        onClick={() => {
                          if (!isFutureMonth) {
                            setCalMonth(idx);
                            setDatePickerMode('days');
                          }
                        }}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                          isFutureMonth
                            ? 'opacity-30 cursor-not-allowed text-[#94979e] bg-transparent border-[#c4c6cd]/10'
                            : isSelected
                            ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                            : 'bg-white hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#c4c6cd]/20'
                        }`}
                      >
                        {SHORT_MONTHS[idx]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Years Selection View - Fixed height container matching days view */}
              {datePickerMode === 'years' && (
                <div className="grid grid-cols-3 gap-2 py-1 h-[216px] items-center">
                  {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                    const isSelected = calYear === y;
                    const currentYear = new Date().getFullYear();
                    const isFutureYear = y > currentYear;

                    return (
                      <button
                        key={y}
                        type="button"
                        disabled={isFutureYear}
                        onClick={() => {
                          if (!isFutureYear) {
                            setCalYear(y);
                            setDatePickerMode('months');
                          }
                        }}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                          isFutureYear
                            ? 'opacity-30 cursor-not-allowed text-[#94979e] bg-transparent border-[#c4c6cd]/10'
                            : isSelected
                            ? 'bg-[#006397] text-white border-[#006397] shadow-xs'
                            : 'bg-white hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#c4c6cd]/20'
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Date Indicator */}
            <div className="flex flex-col items-center justify-center text-center text-xs px-1 pt-1 border-t border-[#f0f1f2]">
              <span className="text-[10px] text-[#74777d] font-semibold">Selected Date</span>
              <span className="font-bold text-[#006397]">{formatDisplayDate(txDate)}</span>
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => setShowDatePickerModal(false)}
              className="w-full py-2 bg-[#006397] text-white font-bold text-xs rounded-xl hover:bg-[#00476e] transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Redesigned Custom Account Picker Modal */}
      {accountPickerTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setAccountPickerTarget(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full border border-[#e1e3e4] shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f1f2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#041627]">
                    {accountPickerTarget === 'to' ? 'Select Destination Account' : 'Select Source Account'}
                  </h3>
                  <p className="text-[11px] text-[#74777d]">Choose bank account for transaction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountPickerTarget(null)}
                className="w-7 h-7 rounded-full bg-[#f0f2f5] hover:bg-[#e1e3e4] text-[#44474c] flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Account Search Input if > 3 accounts */}
            {accounts.length > 3 && (
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#74777d]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search account..."
                  value={accountSearchQuery}
                  onChange={(e) => setAccountSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f0f4f8] border border-[#c4c6cd]/30 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#006397]"
                />
              </div>
            )}

            {/* Accounts List */}
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
              {accounts
                .filter((acc) => {
                  if (accountPickerTarget === 'to' && acc.id === selectedAccountId) return false;
                  if (!accountSearchQuery.trim()) return true;
                  return (
                    acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                    acc.institution?.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                    acc.type.toLowerCase().includes(accountSearchQuery.toLowerCase())
                  );
                })
                .map((acc) => {
                  const isSelected =
                    accountPickerTarget === 'to'
                      ? selectedToAccountId === acc.id
                      : selectedAccountId === acc.id;

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        if (accountPickerTarget === 'to') {
                          setSelectedToAccountId(acc.id);
                        } else {
                          setSelectedAccountId(acc.id);
                        }
                        setAccountPickerTarget(null);
                      }}
                      className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#006397]/10 border-[#006397] ring-1 ring-[#006397]'
                          : 'bg-[#f8fafc] hover:bg-[#f0f4f8] border-[#e1e3e4]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-2xs"
                          style={{ backgroundColor: acc.color || '#006397' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {acc.icon || 'account_balance'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-[#041627]">{acc.name}</span>
                            <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-white border border-[#c4c6cd]/30 text-[#006397]">
                              {acc.type}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#74777d]">
                            {acc.institution || 'Bank Account'}
                            {acc.excludeFromTotal ? ' • Excluded' : ''}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#006397] text-white flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI Quick-Log Modal */}
      <AiQuickLogModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        categories={categories}
        accounts={accounts}
        onApplyParsedTransaction={handleApplyParsedAiTransaction}
        currencySymbol={sym}
      />
    </div>
  );
};
