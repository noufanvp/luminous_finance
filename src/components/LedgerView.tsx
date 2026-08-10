import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Transaction, TabType, BudgetConfig, CategoryTemplate, TransactionType, BankAccount } from '../types';
import { CustomDateRangePicker } from './CustomDateRangePicker';
import { ImportTransactionsModal } from './ImportTransactionsModal';

interface LedgerViewProps {
  transactions: Transaction[];
  accounts?: BankAccount[];
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (id: string, updatedFields: Partial<Transaction>) => void;
  onStartEditTransaction?: (tx: Transaction) => void;
  categories?: CategoryTemplate[];
  setActiveTab: (tab: TabType) => void;
  config: BudgetConfig;
  onImportTransactions?: (imported: Transaction[], replaceAll?: boolean) => void;
}

// Helper to safely parse any transaction date string into a Date object
const parseTxDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const lower = dateStr.toLowerCase().trim();
  const now = new Date();
  
  if (lower === 'today') return now;
  if (lower === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const daysAgoMatch = lower.match(/^(\d+)\s*days?\s*ago$/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  }

  // Handle ISO format YYYY-MM-DD specifically to avoid UTC shift
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  return now;
};

const formatDisplayDateHeader = (dateStr: string, txDate: Date): string => {
  const lower = dateStr.toLowerCase().trim();
  if (lower === 'today' || lower === 'yesterday') {
    const dateFormatted = txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return lower === 'today' ? `Today (${dateFormatted})` : `Yesterday (${dateFormatted})`;
  }
  if (lower.includes('days ago')) {
    return txDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return txDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const getExactDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const lower = trimmed.toLowerCase();
  const now = new Date();

  let targetDate = new Date();

  if (lower === 'today') {
    targetDate = new Date(now);
  } else if (lower === 'yesterday') {
    targetDate = new Date(now);
    targetDate.setDate(now.getDate() - 1);
  } else {
    const daysAgoMatch = lower.match(/^(\d+)\s*days?\s*ago$/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1], 10);
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() - days);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return '';
    }
  }

  return targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDisplayDateString = (dateStr: string) => {
  if (!dateStr) return '';
  const exact = getExactDateDisplay(dateStr);
  if (!exact) return dateStr;
  if (dateStr.toLowerCase().includes(exact.toLowerCase())) {
    return dateStr;
  }
  return `${dateStr} (${exact})`;
};

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  accounts = [],
  onDeleteTransaction,
  onUpdateTransaction,
  onStartEditTransaction,
  categories = [],
  setActiveTab,
  config,
  onImportTransactions,
}) => {
  const sym = config?.currencySymbol || '$';
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Filter & Sort state
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [periodPreset, setPeriodPreset] = useState<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Tag selection modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Extract unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.category && tx.category.trim()) set.add(tx.category.trim());
    });
    categories?.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    return Array.from(set).sort();
  }, [transactions, categories]);

  // Map of category -> count
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.category && tx.category.trim()) {
        const key = tx.category.trim();
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [transactions]);

  // Extract unique tags/persons for filter dropdown
  const uniquePersons = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      const p = tx.person || tx.payee || tx.tag;
      if (p && p.trim()) set.add(p.trim());
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Map of tag/person -> count
  const personCounts = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((tx) => {
      const p = tx.person || tx.payee || tx.tag;
      if (p && p.trim()) {
        const key = p.trim();
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [transactions]);
  
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // Calendar breakdown modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'list'>('grid');
  const [showCalendarInfo, setShowCalendarInfo] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const dayDetailsRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom month and year dropdown popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setShowMonthDropdown(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setShowYearDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smooth scroll to top of day details when a date is selected in the daily ledger calendar
  useEffect(() => {
    if (selectedCalendarDay !== null) {
      // Small timeout ensures DOM layout and details panel element have mounted
      const timer = setTimeout(() => {
        if (dayDetailsRef.current) {
          dayDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedCalendarDay]);

  // Edit transaction state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    type: TransactionType;
    category: string;
    amount: string;
    title: string;
    memo: string;
    person: string;
    date: string;
  }>({
    type: 'expense',
    category: '',
    amount: '',
    title: '',
    memo: '',
    person: '',
    date: '',
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedTx || showCalendarModal) {
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [selectedTx, showCalendarModal]);

  const handlePrevCalendarMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
    setSelectedCalendarDay(null);
  };

  const handleNextCalendarMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
    setSelectedCalendarDay(null);
  };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calendar month data computation
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun
    const monthlyTarget = config?.monthlyTarget || 0;
    const dailyAllowed = daysInMonth > 0 ? monthlyTarget / daysInMonth : 0;

    const daysList = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTxs = transactions.filter((tx) => {
        const d = parseTxDate(tx.date);
        return (
          d.getFullYear() === calendarYear &&
          d.getMonth() === calendarMonth &&
          d.getDate() === day
        );
      });

      const totalExpense = dayTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalIncome = dayTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalAllowed = dailyAllowed;
      const diff = totalAllowed - totalExpense;

      daysList.push({
        day,
        txs: dayTxs,
        totalExpense,
        totalIncome,
        totalAllowed,
        diff,
      });
    }

    const monthTotalExp = daysList.reduce((acc, d) => acc + d.totalExpense, 0);
    const monthTotalInc = daysList.reduce((acc, d) => acc + d.totalIncome, 0);
    const monthTotalAllowed = dailyAllowed * daysInMonth;
    const monthTotalDiff = monthTotalAllowed - monthTotalExp;

    return {
      daysInMonth,
      firstDayIndex,
      dailyAllowed,
      daysList,
      monthTotalExp,
      monthTotalInc,
      monthTotalAllowed,
      monthTotalDiff,
    };
  }, [transactions, calendarYear, calendarMonth, config?.monthlyTarget]);

  const handleStartEditing = (tx: Transaction) => {
    setEditForm({
      type: tx.type,
      category: tx.category,
      amount: tx.amount.toString(),
      title: tx.title || '',
      memo: tx.memo || '',
      person: tx.person || tx.payee || tx.tag || '',
      date: tx.date || '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTx || !onUpdateTransaction) return;
    const parsedAmount = parseFloat(editForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const personText = editForm.person.trim();

    const updated: Partial<Transaction> = {
      type: editForm.type,
      category: editForm.category.trim() || 'General',
      amount: parsedAmount,
      title: editForm.category.trim() || 'General',
      memo: editForm.memo.trim(),
      person: personText || undefined,
      payee: personText || undefined,
      tag: personText || undefined,
      date: editForm.date.trim() || 'Today',
    };

    onUpdateTransaction(selectedTx.id, updated);
    setSelectedTx((prev) => (prev ? { ...prev, ...updated } : null));
    setIsEditing(false);
  };

  const availableCategoryList = useMemo(() => {
    const filteredCats = categories.filter((c) => c.type === editForm.type).map((c) => c.name);
    const baseList = filteredCats.length > 0
      ? filteredCats
      : editForm.type === 'income'
      ? ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other Income']
      : [
          'Groceries',
          'Food',
          'Transport',
          'Utilities',
          'Entertainment',
          'Shopping',
          'Education',
          'Health',
          'Travel',
          'Beauty',
          'General',
        ];
    if (editForm.category && !baseList.includes(editForm.category)) {
      return [editForm.category, ...baseList];
    }
    return baseList;
  }, [categories, editForm.type, editForm.category]);

  // Filtering transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Transaction Type Filter
      if (filterType !== 'all' && tx.type !== filterType) return false;

      // 2. Category Filter
      if (selectedCategoryFilter !== 'all') {
        const cat = (tx.category || '').toLowerCase();
        if (cat !== selectedCategoryFilter.toLowerCase()) return false;
      }

      // 2b. Bank Account Filter
      if (selectedAccountFilter !== 'all') {
        const matchesSource = tx.accountId === selectedAccountFilter;
        const matchesDest = tx.toAccountId === selectedAccountFilter;
        if (!matchesSource && !matchesDest) return false;
      }

      // 3. Person / Payee Filter
      if (selectedPersonFilter !== 'all') {
        const p = (tx.person || tx.payee || '').toLowerCase();
        if (p !== selectedPersonFilter.toLowerCase()) return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = tx.title ? tx.title.toLowerCase().includes(q) : false;
        const matchesCat = tx.category.toLowerCase().includes(q);
        const matchesMemo = tx.memo && tx.memo.toLowerCase().includes(q);
        const matchesPerson = (tx.person || tx.payee || '').toLowerCase().includes(q);
        const matchesDate = tx.date.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat && !matchesMemo && !matchesPerson && !matchesDate) return false;
      }

      const txDate = parseTxDate(tx.date);

      // 4. Period Filter (Week, Month, Year, Custom)
      if (periodPreset !== 'all') {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (periodPreset === 'week') {
          const startOfWeek = new Date(todayStart);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          startOfWeek.setDate(diff);
          if (txDate < startOfWeek || txDate > todayEnd) return false;
        } else if (periodPreset === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          if (txDate < startOfMonth || txDate > endOfMonth) return false;
        } else if (periodPreset === 'year') {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          if (txDate < startOfYear || txDate > endOfYear) return false;
        } else if (periodPreset === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate + 'T00:00:00');
            if (txDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate + 'T23:59:59');
            if (txDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [transactions, filterType, selectedCategoryFilter, selectedPersonFilter, searchQuery, periodPreset, customStartDate, customEndDate]);

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const dateA = parseTxDate(a.date).getTime();
      const dateB = parseTxDate(b.date).getTime();

      if (sortOrder === 'date_desc') return dateB - dateA;
      if (sortOrder === 'date_asc') return dateA - dateB;
      if (sortOrder === 'amount_desc') return b.amount - a.amount;
      if (sortOrder === 'amount_asc') return a.amount - b.amount;
      return dateB - dateA;
    });
  }, [filteredTransactions, sortOrder]);

  // Calculate totals for currently displayed/filtered transactions
  const displayedTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    });

    const net = income - expense;

    return { income, expense, net };
  }, [filteredTransactions]);

  // Group sorted transactions by Date Group for section headers
  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    const groupMap = new Map<string, Transaction[]>();

    sortedTransactions.forEach((tx) => {
      const parsed = parseTxDate(tx.date);
      const groupKey = formatDisplayDateHeader(tx.date, parsed);
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(tx);
    });

    groupMap.forEach((items, label) => {
      groups.push({ label, items });
    });

    return groups;
  }, [sortedTransactions]);

  const hasActiveFilters =
    filterType !== 'all' ||
    periodPreset !== 'all' ||
    selectedCategoryFilter !== 'all' ||
    selectedPersonFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    sortOrder !== 'date_desc';

  const resetAllFilters = () => {
    setFilterType('all');
    setPeriodPreset('all');
    setSelectedCategoryFilter('all');
    setSelectedPersonFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortOrder('date_desc');
    setSearchQuery('');
  };

  const getCategoryIcon = (category: string, type: 'expense' | 'income') => {
    if (type === 'income') return 'payments';
    const map: Record<string, string> = {
      'Dining': 'restaurant',
      'Dining Out': 'local_dining',
      'Groceries': 'shopping_cart',
      'Transport': 'local_gas_station',
      'Health': 'monitor_heart',
      'Rent': 'home',
      'Clothing': 'checkroom'
    };
    return map[category] || 'receipt_long';
  };

  const handleExportCSV = () => {
    const accList = accounts || [];
    const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Account', 'Memo', 'Payee'];
    const rows = sortedTransactions.map((t) => [
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
    <div className="max-w-7xl mx-auto px-4 md:px-8 mt-2 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">Ledger</h1>
          <p className="text-xs md:text-sm text-[#44474c] mt-0.5">Review, filter, and sort your financial transactions.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00a656] hover:bg-[#008243] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
            title="Import Transactions from CSV"
          >
            <span className="material-symbols-outlined text-[16px]">file_upload</span>
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] font-bold text-xs border border-[#d2e4fb] transition-all cursor-pointer"
            title="Export Current Transactions as CSV"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCalendarModal(true);
              setSelectedCalendarDay(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#006397] hover:bg-[#004e78] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
            title="Open Daily Calendar Breakdown"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>Daily Overview</span>
          </button>

          <span className="text-xs font-bold text-[#006397] bg-[#006397]/10 px-3 py-1.5 rounded-full border border-[#006397]/20">
            {sortedTransactions.length} {sortedTransactions.length === 1 ? 'Transaction' : 'Transactions'}
          </span>
        </div>
      </div>

      {/* Unified Filter & Sort Control Bar */}
      <div className="bg-white rounded-2xl border border-[#e1e3e4] shadow-2xs p-4 flex flex-col gap-3.5">
        {/* Top Row: Search & Type Toggle & Sort */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777d] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by title, category, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#f3f4f5] rounded-xl text-xs sm:text-sm font-medium border border-[#c4c6cd]/20 focus:outline-none focus:ring-2 focus:ring-[#006397] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777d] hover:text-[#191c1d] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-between sm:justify-end">
            {/* Type Filter Pills */}
            <div className="flex items-center p-1 bg-[#f3f4f5] rounded-xl border border-[#c4c6cd]/20 shadow-inner shrink-0">
              {(['all', 'expense', 'income'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    filterType === type
                      ? 'bg-white shadow-2xs text-[#006397]'
                      : 'text-[#44474c] hover:text-[#191c1d]'
                  }`}
                >
                  {type === 'all' ? 'All Types' : type === 'expense' ? 'Expenses' : 'Income'}
                </button>
              ))}
            </div>

            {/* Category Filter Selector */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                selectedCategoryFilter !== 'all'
                  ? 'bg-[#006397] text-white border-[#006397] shadow-2xs'
                  : 'bg-[#f3f4f5] border-[#c4c6cd]/20'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${selectedCategoryFilter !== 'all' ? 'text-white' : 'text-[#006397]'}`}>
                category
              </span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                  selectedCategoryFilter !== 'all' ? 'text-white [&>option]:text-[#191c1d]' : 'text-[#191c1d]'
                }`}
              >
                <option value="all">
                  All Categories {uniqueCategories.length > 0 ? `(${uniqueCategories.length})` : ''}
                </option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} {categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}
                  </option>
                ))}
              </select>
              {selectedCategoryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className="material-symbols-outlined text-[15px] hover:text-red-200 ml-0.5 cursor-pointer"
                  title="Clear category filter"
                >
                  close
                </button>
              )}
            </div>

            {/* Bank Account Filter Selector */}
            {accounts.length > 0 && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                  selectedAccountFilter !== 'all'
                    ? 'bg-[#006397] text-white border-[#006397] shadow-2xs'
                    : 'bg-[#f3f4f5] border-[#c4c6cd]/20'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${selectedAccountFilter !== 'all' ? 'text-white' : 'text-[#006397]'}`}>
                  account_balance
                </span>
                <select
                  value={selectedAccountFilter}
                  onChange={(e) => setSelectedAccountFilter(e.target.value)}
                  className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                    selectedAccountFilter !== 'all' ? 'text-white [&>option]:text-[#191c1d]' : 'text-[#191c1d]'
                  }`}
                >
                  <option value="all">All Accounts ({accounts.length})</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                {selectedAccountFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedAccountFilter('all')}
                    className="material-symbols-outlined text-[15px] hover:text-red-200 ml-0.5 cursor-pointer"
                    title="Clear account filter"
                  >
                    close
                  </button>
                )}
              </div>
            )}

            {/* Sort Order Selector */}
            <div className="flex items-center gap-1.5 bg-[#f3f4f5] px-3 py-1.5 rounded-xl border border-[#c4c6cd]/20 shrink-0">
              <span className="material-symbols-outlined text-[#006397] text-[16px]">sort</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-[#191c1d] focus:outline-none cursor-pointer"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="amount_desc">Amount: High → Low</option>
                <option value="amount_asc">Amount: Low → High</option>
              </select>
            </div>

            {/* Tag / Person Filter Icon Button (Right-most side, icon only) */}
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ml-auto shrink-0 ${
                selectedPersonFilter !== 'all'
                  ? 'bg-[#006397] text-white border-[#006397] shadow-2xs'
                  : 'bg-[#f3f4f5] text-[#44474c] border-[#c4c6cd]/20 hover:bg-[#e1e3e4] hover:text-[#191c1d]'
              }`}
              title={selectedPersonFilter !== 'all' ? `Filter by Tag (Active: ${selectedPersonFilter})` : 'Filter by Tag / Person / Purpose'}
            >
              <span className="material-symbols-outlined text-[18px]">sell</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Period Quick Filter Pills & Custom Date Range */}
        <div className="pt-3 border-t border-[#e1e3e4] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-[#74777d] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006397]">calendar_month</span>
                Period:
              </span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriodPreset(p.id as any);
                    if (p.id === 'custom') {
                      setShowDatePickerModal(true);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                    periodPreset === p.id
                      ? 'bg-[#006397] text-white shadow-2xs'
                      : 'bg-[#f3f4f5] text-[#44474c] hover:bg-[#e1e3e4] hover:text-[#191c1d]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Badge & Trigger */}
            {periodPreset === 'custom' && (
              <button
                onClick={() => setShowDatePickerModal(true)}
                className="flex items-center gap-2 bg-[#006397]/10 hover:bg-[#006397]/20 border border-[#006397]/30 text-[#006397] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 group"
              >
                <span className="material-symbols-outlined text-[16px]">date_range</span>
                <span>
                  {customStartDate || customEndDate
                    ? `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
                    : 'Select Date Range...'}
                </span>
                <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">
                  edit_calendar
                </span>
              </button>
            )}
          </div>

          {/* Reset Filter Button directly below period selection - only visible when filters are applied */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2.5 border-t border-[#e1e3e4]/60">
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all bg-[#ba1a1a]/10 hover:bg-[#ba1a1a] text-[#ba1a1a] hover:text-white border border-[#ba1a1a]/30 shadow-2xs cursor-pointer"
                title="Reset all filters and period selections"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Reset Filters</span>
              </button>
              <span className="text-[11px] font-semibold text-[#006397] bg-[#006397]/10 px-2.5 py-0.5 rounded-full border border-[#006397]/20">
                Filters Applied
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Displayed Transactions Summary Container */}
      <div className="bg-white rounded-2xl border border-[#e1e3e4] shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">analytics</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#191c1d]">Filtered Ledger Totals</h3>
                {hasActiveFilters && (
                  <span className="text-[10px] font-bold text-[#006397] bg-[#e0f2fe] px-2 py-0.5 rounded-full border border-[#006397]/20">
                    Filtered
                  </span>
                )}
              </div>
              <p className="text-xs text-[#44474c]">
                Showing totals for {sortedTransactions.length} {sortedTransactions.length === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
            {/* Total Income */}
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#e6f4ea] border border-[#146c2e]/20 min-w-[150px]">
              <div className="w-8 h-8 rounded-lg bg-[#146c2e]/10 text-[#146c2e] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#146c2e] uppercase tracking-wider">Total Income</span>
                <span className="text-sm font-extrabold text-[#146c2e]">
                  +{sym}{displayedTotals.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#ffdad6] border border-[#ba1a1a]/20 min-w-[150px]">
              <div className="w-8 h-8 rounded-lg bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider">Total Expenses</span>
                <span className="text-sm font-extrabold text-[#ba1a1a]">
                  -{sym}{displayedTotals.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Net Balance */}
            <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border min-w-[150px] ${
              displayedTotals.net >= 0
                ? 'bg-[#f0f7fc] border-[#006397]/20 text-[#006397]'
                : 'bg-[#fff5f5] border-[#ba1a1a]/20 text-[#ba1a1a]'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                displayedTotals.net >= 0 ? 'bg-[#006397]/10 text-[#006397]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
              }`}>
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">Net Balance</span>
                <span className="text-sm font-extrabold">
                  {displayedTotals.net >= 0 ? '+' : '-'}{sym}{Math.abs(displayedTotals.net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker Modal */}
      {showDatePickerModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDatePickerModal(false);
            }
          }}
        >
          <CustomDateRangePicker
            startDate={customStartDate}
            endDate={customEndDate}
            onChange={(start, end) => {
              setCustomStartDate(start);
              setCustomEndDate(end);
              if (start || end) {
                setPeriodPreset('custom');
              }
            }}
            onClose={() => setShowDatePickerModal(false)}
          />
        </div>
      )}

      {/* Transaction List Card */}
      <div className="bg-white rounded-2xl shadow-ambient border border-[#c4c6cd]/10 overflow-hidden flex flex-col mb-12">
        {sortedTransactions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-[#74777d]">filter_list_off</span>
            <p className="text-base font-medium text-[#191c1d]">No matching transactions</p>
            <p className="text-xs text-[#44474c]">Try adjusting your month, date filter, or search keywords.</p>
            {hasActiveFilters ? (
              <button
                onClick={resetAllFilters}
                className="mt-2 px-4 py-2 bg-[#006397] text-white text-xs font-semibold rounded-xl hover:bg-[#00476e] transition-colors"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('add')}
                className="mt-2 px-4 py-2 bg-[#006397] text-white text-xs font-semibold rounded-xl hover:bg-[#00476e] transition-colors"
              >
                + Add Transaction
              </button>
            )}
          </div>
        ) : (
          groupedTransactions.map(({ label, items }) => (
            <div key={label}>
              <div className="px-4 md:px-6 py-2.5 bg-[#f3f4f5] border-b border-[#c4c6cd]/10 flex justify-between items-center">
                <span className="text-xs font-bold text-[#44474c] uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[11px] font-semibold text-[#74777d]">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="flex flex-col">
                {items.slice(0, visibleCount).map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-[#c4c6cd]/10 hover:bg-[#f3f4f5]/60 transition-colors cursor-pointer group min-h-[72px]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          tx.type === 'income'
                            ? 'bg-[#4ae183]/20 text-[#00a656] group-hover:bg-[#4ae183]/30'
                            : 'bg-[#edeeef] text-[#191c1d] group-hover:bg-[#e1e3e4]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {getCategoryIcon(tx.category, tx.type)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#191c1d]">
                          {tx.category}
                        </span>
                        {tx.memo ? (
                          <span className="text-xs text-[#44474c]">
                            {tx.memo}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className={`text-sm md:text-base font-bold ${
                          tx.type === 'income' ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}{sym}{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {sortedTransactions.length > visibleCount && (
          <div className="p-4 flex justify-center border-t border-[#c4c6cd]/10 bg-[#f8f9fa]">
            <button
              onClick={() => setVisibleCount((prev) => prev + 10)}
              className="text-xs font-semibold text-[#006397] hover:text-[#00476e] py-2 px-6 rounded-xl hover:bg-[#e7e8e9] transition-colors"
            >
              Load More Transactions
            </button>
          </div>
        )}
      </div>

      {/* Transaction Detail & Edit / Delete Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041627]/40 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTx(null);
              setIsEditing(false);
              setShowDeleteConfirm(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-[#c4c6cd]/20 relative max-h-[88vh] overflow-y-auto my-auto">
            <button
              onClick={() => {
                setSelectedTx(null);
                setIsEditing(false);
                setShowDeleteConfirm(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f3f4f5] flex items-center justify-center text-[#44474c] hover:bg-[#e1e3e4] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {showDeleteConfirm ? (
              <div className="space-y-4 text-center py-2 animate-fade-in">
                <div className="w-14 h-14 bg-[#ffdad6] text-[#ba1a1a] rounded-full flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[30px]">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#191c1d]">Delete Transaction?</h3>
                  <p className="text-xs text-[#44474c] mt-1">
                    Are you sure you want to delete this <span className="font-semibold text-[#191c1d]">{selectedTx.category}</span> transaction ({sym}{selectedTx.amount.toFixed(2)})? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      onDeleteTransaction(selectedTx.id);
                      setSelectedTx(null);
                      setIsEditing(false);
                      setShowDeleteConfirm(false);
                    }}
                    className="flex-1 py-2.5 bg-[#ba1a1a] text-white font-bold text-sm rounded-xl hover:bg-[#93000a] transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 bg-[#f3f4f5] text-[#191c1d] font-semibold text-sm rounded-xl hover:bg-[#e1e3e4] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : !isEditing ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedTx.type === 'income' ? 'bg-[#4ae183]/20 text-[#00a656]' : 'bg-[#edeeef] text-[#006397]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {getCategoryIcon(selectedTx.category, selectedTx.type)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#191c1d]">{selectedTx.category}</h3>
                    <p className="text-xs text-[#44474c] capitalize">{selectedTx.type}</p>
                  </div>
                </div>

                <div className="bg-[#f8f9fa] p-4 rounded-xl space-y-2 mb-6 border border-[#e1e3e4]">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#44474c]">Date:</span>
                    <span className="font-medium text-[#191c1d]">{getDisplayDateString(selectedTx.date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#44474c]">Type:</span>
                    <span className="font-bold capitalize text-[#191c1d]">{selectedTx.type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#44474c]">Amount:</span>
                    <span
                      className={`font-bold ${
                        selectedTx.type === 'income' ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                      }`}
                    >
                      {selectedTx.type === 'income' ? '+' : '-'}{sym}{selectedTx.amount.toFixed(2)}
                    </span>
                  </div>
                  {(selectedTx.person || selectedTx.payee || selectedTx.tag) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#44474c]">Tag / Person / Purpose:</span>
                      <span className="font-bold text-[#006397] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">sell</span>
                        {selectedTx.person || selectedTx.payee || selectedTx.tag}
                      </span>
                    </div>
                  )}
                  {selectedTx.memo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#44474c]">Memo:</span>
                      <span className="font-medium text-[#191c1d]">{selectedTx.memo}</span>
                    </div>
                  )}
                  {selectedTx.rawExpression && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#44474c]">Math Expression:</span>
                      <span className="font-mono text-xs text-[#006397]">{selectedTx.rawExpression}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (onStartEditTransaction) {
                        onStartEditTransaction(selectedTx);
                        setSelectedTx(null);
                      } else {
                        handleStartEditing(selectedTx);
                      }
                      setShowDeleteConfirm(false);
                    }}
                    className="flex-1 py-2.5 bg-[#006397] text-white font-semibold text-sm rounded-xl hover:bg-[#00476e] transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 py-2.5 bg-[#ffdad6] text-[#ba1a1a] font-semibold text-sm rounded-xl hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#e1e3e4]">
                  <span className="material-symbols-outlined text-[#006397] text-[22px]">edit_note</span>
                  <h3 className="font-bold text-base text-[#191c1d]">Edit Transaction</h3>
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Transaction Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, type: 'expense' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        editForm.type === 'expense'
                          ? 'bg-[#ba1a1a] text-white shadow-2xs'
                          : 'bg-[#f3f4f5] text-[#44474c] hover:bg-[#e1e3e4]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, type: 'income' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        editForm.type === 'income'
                          ? 'bg-[#00a656] text-white shadow-2xs'
                          : 'bg-[#f3f4f5] text-[#44474c] hover:bg-[#e1e3e4]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                      Income
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Amount ({sym})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#74777d] font-bold text-sm">
                      {sym}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full pl-8 pr-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-sm font-bold text-[#191c1d] focus:outline-none focus:border-[#006397]"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Category Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-sm font-medium text-[#191c1d] focus:outline-none focus:border-[#006397]"
                  >
                    {availableCategoryList.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="text"
                    value={editForm.date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                    placeholder="YYYY-MM-DD or Today"
                    className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-sm font-medium text-[#191c1d] focus:outline-none focus:border-[#006397]"
                  />
                </div>

                {/* Tag / Person / Purpose */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Tag / Person / Purpose
                  </label>
                  <input
                    type="text"
                    value={editForm.person}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, person: e.target.value }))}
                    placeholder="e.g. Mom, Vacation, Office, John"
                    className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-sm font-medium text-[#191c1d] focus:outline-none focus:border-[#006397]"
                  />
                </div>

                {/* Memo */}
                <div>
                  <label className="block text-xs font-bold text-[#44474c] uppercase tracking-wider mb-1.5">
                    Memo
                  </label>
                  <input
                    type="text"
                    value={editForm.memo}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, memo: e.target.value }))}
                    placeholder="Optional memo"
                    className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#c4c6cd]/50 rounded-xl text-sm font-medium text-[#191c1d] focus:outline-none focus:border-[#006397]"
                  />
                </div>

                {/* Edit Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex-1 py-2.5 bg-[#006397] text-white font-semibold text-sm rounded-xl hover:bg-[#00476e] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2.5 bg-[#f3f4f5] text-[#191c1d] font-semibold text-sm rounded-xl hover:bg-[#e1e3e4] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Breakdown Modal */}
      {showCalendarModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041627]/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCalendarModal(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cd]/20 max-w-5xl w-full max-h-[88vh] my-auto flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#f0f1f2] bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#191c1d]">Daily Ledger Calendar</h3>
                    <button
                      type="button"
                      onClick={() => setShowCalendarInfo(!showCalendarInfo)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        showCalendarInfo
                          ? 'bg-[#006397] text-white ring-2 ring-[#006397]/30 shadow-xs'
                          : 'bg-[#006397]/10 text-[#006397] hover:bg-[#006397]/20'
                      }`}
                      title="Click for explanation of terms and Net Diff"
                    >
                      i
                    </button>
                  </div>
                  <p className="text-xs text-[#74777d]">Total Expense, Income, Allowed Budget, & Net Difference per day</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#74777d] hover:bg-[#f0f2f5] hover:text-[#191c1d] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Explanation Card (Shown when info 'i' button is clicked) */}
            {showCalendarInfo && (
              <div className="mx-4 mt-3 p-3.5 bg-[#e8f3ff] rounded-2xl border border-[#006397]/30 text-xs text-[#191c1d] flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150 shadow-2xs shrink-0">
                <div className="flex items-center justify-between border-b border-[#006397]/15 pb-1.5 font-extrabold text-[#006397]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    <span>Ledger Terms & Monthly Net Difference Explained</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCalendarInfo(false)}
                    className="text-[#74777d] hover:text-[#191c1d] text-[11px] font-bold underline"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-medium">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#006397]/15 shadow-2xs">
                    <span className="font-extrabold text-[#006397] block mb-0.5">Daily Target / Allowed:</span>
                    Your calculated daily budget allowance (Monthly Target ÷ Total Days in Month).
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#ba1a1a]/15 shadow-2xs">
                    <span className="font-extrabold text-[#ba1a1a] block mb-0.5">Month Exp (Expense):</span>
                    Total expenses incurred so far during the selected month.
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#00a656]/15 shadow-2xs">
                    <span className="font-extrabold text-[#00a656] block mb-0.5">Month Inc (Income):</span>
                    Total income or earnings recorded for the selected month.
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-[#008844]/15 shadow-2xs">
                    <span className="font-extrabold text-[#008844] block mb-0.5">Net Diff (Net Difference):</span>
                    Calculated as <span className="font-bold text-[#006397]">(Total Allowed Budget) − (Total Expense)</span>. 
                    A <span className="font-bold text-[#008844]">positive (+) figure</span> means you stayed under budget and saved money. 
                    A <span className="font-bold text-[#ba1a1a]">negative (−) figure</span> means you spent more than your allocated budget target.
                  </div>
                </div>
              </div>
            )}

            {/* Controls Bar & Monthly Summary */}
            <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#f0f1f2] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
              {/* Left Column: Month & Year line + Quick Bubbles & View Mode line */}
              <div className="flex flex-col gap-2.5 flex-1">
                {/* Line 1: Month and Year Selectors in One Line */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevCalendarMonth}
                    className="w-8 h-8 rounded-full bg-white border border-[#c4c6cd]/30 flex items-center justify-center text-[#191c1d] hover:bg-[#e8eaed] transition-colors shadow-2xs cursor-pointer shrink-0"
                    title="Previous Month"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>

                  {/* Month & Year Dropdowns in One Line */}
                  <div className="flex items-center gap-2">
                    {/* Custom Month Selector */}
                    <div className="relative" ref={monthDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMonthDropdown(!showMonthDropdown);
                          setShowYearDropdown(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          showMonthDropdown
                            ? 'bg-[#006397] text-white border-[#006397] ring-2 ring-[#006397]/30'
                            : 'bg-white hover:bg-[#006397]/5 text-[#041627] border-[#c4c6cd]/30'
                        }`}
                        title="Select Month"
                      >
                        <span>{MONTH_NAMES[calendarMonth]}</span>
                        <span className={`material-symbols-outlined text-[16px] transition-transform ${showMonthDropdown ? 'rotate-180 text-white' : 'text-[#006397]'}`}>
                          expand_more
                        </span>
                      </button>

                      {showMonthDropdown && (
                        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-[#e1e3e4] p-3 w-60 max-w-[calc(100vw-3rem)] animate-in fade-in-50 zoom-in-95 duration-100">
                          <div className="text-[11px] font-extrabold text-[#74777d] uppercase tracking-wider px-1 pb-2 mb-2 border-b border-[#f0f4f8] flex items-center justify-between">
                            <span>Select Month</span>
                            <span className="text-[10px] text-[#006397] font-bold">{MONTH_NAMES[calendarMonth]}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {MONTH_NAMES.map((mName, idx) => {
                              const isSelected = calendarMonth === idx;
                              const shortName = mName.substring(0, 3);
                              return (
                                <button
                                  key={mName}
                                  type="button"
                                  onClick={() => {
                                    setCalendarMonth(idx);
                                    setSelectedCalendarDay(null);
                                    setShowMonthDropdown(false);
                                  }}
                                  className={`py-2 px-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#006397] text-white shadow-2xs font-black'
                                      : 'bg-[#f8f9fa] hover:bg-[#006397]/10 hover:text-[#006397] text-[#041627]'
                                  }`}
                                >
                                  {shortName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Year Selector */}
                    <div className="relative" ref={yearDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowYearDropdown(!showYearDropdown);
                          setShowMonthDropdown(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          showYearDropdown
                            ? 'bg-[#006397] text-white border-[#006397] ring-2 ring-[#006397]/30'
                            : 'bg-white hover:bg-[#006397]/5 text-[#041627] border-[#c4c6cd]/30'
                        }`}
                        title="Select Year"
                      >
                        <span>{calendarYear}</span>
                        <span className={`material-symbols-outlined text-[16px] transition-transform ${showYearDropdown ? 'rotate-180 text-white' : 'text-[#006397]'}`}>
                          expand_more
                        </span>
                      </button>

                      {showYearDropdown && (
                        <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-[#e1e3e4] p-3 w-60 max-w-[calc(100vw-3rem)] animate-in fade-in-50 zoom-in-95 duration-100">
                          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#74777d] uppercase tracking-wider px-1 pb-2 mb-2 border-b border-[#f0f4f8]">
                            <span>Select Year</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarYear(new Date().getFullYear());
                                setSelectedCalendarDay(null);
                                setShowYearDropdown(false);
                              }}
                              className="text-[10px] text-[#006397] hover:underline normal-case font-bold cursor-pointer"
                            >
                              Current ({new Date().getFullYear()})
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map((yr) => {
                              const isSelected = calendarYear === yr;
                              return (
                                <button
                                  key={yr}
                                  type="button"
                                  onClick={() => {
                                    setCalendarYear(yr);
                                    setSelectedCalendarDay(null);
                                    setShowYearDropdown(false);
                                  }}
                                  className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#006397] text-white shadow-2xs font-black'
                                      : 'bg-[#f8f9fa] hover:bg-[#006397]/10 hover:text-[#006397] text-[#041627]'
                                  }`}
                                >
                                  {yr}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextCalendarMonth}
                    className="w-8 h-8 rounded-full bg-white border border-[#c4c6cd]/30 flex items-center justify-center text-[#191c1d] hover:bg-[#e8eaed] transition-colors shadow-2xs cursor-pointer shrink-0"
                    title="Next Month"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>

                {/* Line 2: Quick Bubbles ("Today") & View Options ("Grid" / "List") */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Quick Bubbles */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCalendarYear(now.getFullYear());
                        setCalendarMonth(now.getMonth());
                        setSelectedCalendarDay(now.getDate());
                      }}
                      className="px-3 py-1 text-xs font-bold rounded-full bg-white border border-[#006397]/30 text-[#006397] hover:bg-[#006397] hover:text-white transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      title="Jump to Today"
                    >
                      <span className="material-symbols-outlined text-[14px]">today</span>
                      <span>Today</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCalendarYear(now.getFullYear());
                        setCalendarMonth(now.getMonth());
                        setSelectedCalendarDay(null);
                      }}
                      className="px-3 py-1 text-xs font-bold rounded-full bg-white border border-[#c4c6cd]/30 text-[#44474c] hover:bg-[#f0f2f5] transition-all shadow-2xs cursor-pointer"
                      title="Show Current Month"
                    >
                      <span>Current Month</span>
                    </button>
                  </div>

                  {/* Grid / List Mode Switch */}
                  <div className="flex items-center bg-white border border-[#c4c6cd]/30 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('grid')}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        calendarViewMode === 'grid'
                          ? 'bg-[#006397] text-white shadow-2xs'
                          : 'text-[#44474c] hover:bg-[#f0f2f5]'
                      }`}
                      title="Calendar Grid View"
                    >
                      <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarViewMode('list')}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        calendarViewMode === 'list'
                          ? 'bg-[#006397] text-white shadow-2xs'
                          : 'text-[#44474c] hover:bg-[#f0f2f5]'
                      }`}
                      title="Daily List View"
                    >
                      <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Monthly Overview Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-white px-2.5 py-1 rounded-lg border border-[#c4c6cd]/30 shadow-2xs">
                  <span className="text-[#74777d] text-[10px] uppercase font-bold block">Daily Target</span>
                  <span className="font-extrabold text-[#006397]">{sym}{calendarData.dailyAllowed.toFixed(2)}</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded-lg border border-[#c4c6cd]/30 shadow-2xs">
                  <span className="text-[#74777d] text-[10px] uppercase font-bold block">Month Exp</span>
                  <span className="font-extrabold text-[#ba1a1a]">{sym}{calendarData.monthTotalExp.toFixed(2)}</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded-lg border border-[#c4c6cd]/30 shadow-2xs">
                  <span className="text-[#74777d] text-[10px] uppercase font-bold block">Month Inc</span>
                  <span className="font-extrabold text-[#00a656]">{sym}{calendarData.monthTotalInc.toFixed(2)}</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded-lg border border-[#c4c6cd]/30 shadow-2xs">
                  <span className="text-[#74777d] text-[10px] uppercase font-bold block">Net Diff</span>
                  <span className={`font-extrabold ${calendarData.monthTotalDiff >= 0 ? 'text-[#008844]' : 'text-[#ba1a1a]'}`}>
                    {calendarData.monthTotalDiff >= 0 ? '+' : ''}{sym}{calendarData.monthTotalDiff.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Calendar Body */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 min-h-0 flex flex-col gap-4 pb-6">
              {/* Selected Day Details Panel (Positioned ABOVE the calendar grid for immediate visibility upon clicking) */}
              {selectedCalendarDay !== null && (
                <div ref={dayDetailsRef} className="bg-[#f0f4f8] rounded-2xl p-3.5 border border-[#006397]/25 shadow-sm flex flex-col gap-3 animate-in slide-in-from-top-2 duration-150">
                  {(() => {
                    const dayData = calendarData.daysList.find((d) => d.day === selectedCalendarDay);
                    if (!dayData) return null;

                    return (
                      <>
                        <div className="flex items-center justify-between border-b border-[#006397]/15 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#006397] text-[20px]">event</span>
                            <span className="font-extrabold text-sm text-[#191c1d]">
                              {MONTH_NAMES[calendarMonth]} {selectedCalendarDay}, {calendarYear} Details
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCalendarDay(null)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-white border border-[#c4c6cd]/30 text-[#006397] hover:bg-[#006397]/10 font-extrabold transition-colors"
                          >
                            Close Details
                          </button>
                        </div>

                        {/* 4 Summary Cards for Selected Day */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20 shadow-2xs">
                            <span className="text-[10px] text-[#74777d] font-bold block uppercase tracking-wider">Total Expense</span>
                            <span className="text-sm font-extrabold text-[#ba1a1a]">{sym}{dayData.totalExpense.toFixed(2)}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20 shadow-2xs">
                            <span className="text-[10px] text-[#74777d] font-bold block uppercase tracking-wider">Total Income</span>
                            <span className="text-sm font-extrabold text-[#00a656]">{sym}{dayData.totalIncome.toFixed(2)}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20 shadow-2xs">
                            <span className="text-[10px] text-[#74777d] font-bold block uppercase tracking-wider">Total Allowed</span>
                            <span className="text-sm font-extrabold text-[#006397]">{sym}{dayData.totalAllowed.toFixed(2)}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20 shadow-2xs">
                            <span className="text-[10px] text-[#74777d] font-bold block uppercase tracking-wider">Difference</span>
                            <span className={`text-sm font-extrabold ${dayData.diff >= 0 ? 'text-[#008844]' : 'text-[#ba1a1a]'}`}>
                              {dayData.diff >= 0 ? '+' : ''}{sym}{dayData.diff.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Transactions list for selected day */}
                        <div className="flex flex-col gap-1.5 mt-1">
                          <span className="text-xs font-bold text-[#44474c]">
                            Day Transactions ({dayData.txs.length})
                          </span>
                          {dayData.txs.length === 0 ? (
                            <p className="text-xs text-[#74777d] italic bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20">
                              No transactions recorded for this date.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                              {dayData.txs.map((tx) => (
                                <div
                                  key={tx.id}
                                  className="bg-white p-2.5 rounded-xl border border-[#c4c6cd]/20 flex items-center justify-between text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                      tx.type === 'expense' ? 'bg-[#ba1a1a]' : 'bg-[#00a656]'
                                    }`} />
                                    <div>
                                      <span className="font-bold text-[#191c1d]">{tx.category}</span>
                                      {tx.memo && <span className="text-[#74777d] ml-1.5 text-[11px]">({tx.memo})</span>}
                                    </div>
                                  </div>
                                  <span className={`font-extrabold ${
                                    tx.type === 'expense' ? 'text-[#ba1a1a]' : 'text-[#00a656]'
                                  }`}>
                                    {tx.type === 'expense' ? '-' : '+'}{sym}{tx.amount.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {calendarViewMode === 'grid' ? (
                <>
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 text-center font-bold text-xs text-[#74777d] uppercase tracking-wider py-1.5 bg-[#f0f2f5] rounded-xl border border-[#c4c6cd]/20">
                    <span>Sun</span>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </div>

                  {/* Grid of Days */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {/* Empty padding cells for start of month */}
                    {Array.from({ length: calendarData.firstDayIndex }).map((_, idx) => (
                      <div key={`blank-${idx}`} className="bg-[#f8f9fa]/40 rounded-xl min-h-[64px] sm:min-h-[95px] border border-dashed border-[#c4c6cd]/20" />
                    ))}

                    {/* Actual day cells */}
                    {calendarData.daysList.map((item) => {
                      const now = new Date();
                      const isToday =
                        now.getFullYear() === calendarYear &&
                        now.getMonth() === calendarMonth &&
                        now.getDate() === item.day;
                      const isSelected = selectedCalendarDay === item.day;

                      return (
                        <div
                          key={`cal-day-${item.day}`}
                          onClick={() => setSelectedCalendarDay(isSelected ? null : item.day)}
                          className={`min-h-[68px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-sm ${
                            isSelected
                              ? 'border-2 border-[#006397] bg-[#006397]/15 shadow-md ring-2 ring-[#006397]/40'
                              : isToday
                              ? 'border-2 border-[#d97706] bg-[#fffcf0] hover:bg-[#fff7d6]'
                              : 'border-[#c4c6cd]/30 bg-white hover:border-[#006397]/60'
                          }`}
                        >
                          {/* Cell Header - Date Number and TX Dot */}
                          <div className="flex items-center justify-between pb-0.5 sm:pb-1 border-b border-[#f0f1f2]">
                            {isToday ? (
                              <span className="bg-[#d97706] text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                <span>{item.day}</span>
                                <span className="text-[8px] uppercase tracking-wider font-black hidden sm:inline">Today</span>
                              </span>
                            ) : (
                              <span className={`text-[11px] sm:text-xs font-black px-1.5 py-0.5 rounded-md ${
                                isSelected ? 'bg-[#006397] text-white' : 'text-[#191c1d]'
                              }`}>
                                {item.day}
                              </span>
                            )}

                            {item.txs.length > 0 && (
                              <span
                                className="text-[9px] sm:text-[10px] font-extrabold text-[#006397] bg-[#006397]/10 px-1 sm:px-1.5 py-0.2 rounded-full"
                                title={`${item.txs.length} transactions`}
                              >
                                {item.txs.length}
                              </span>
                            )}
                          </div>

                          {/* Desktop View: 4 Clean Numeric Value Rows */}
                          <div className="hidden sm:flex flex-col gap-0.5 text-[11px] font-bold text-right tracking-tight my-auto">
                            {/* Expense */}
                            <div className="flex items-center justify-end gap-1 text-[#ba1a1a]" title="Expense">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] shrink-0" />
                              <span>{sym}{item.totalExpense.toFixed(2)}</span>
                            </div>

                            {/* Income */}
                            <div className="flex items-center justify-end gap-1 text-[#00a656]" title="Income">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00a656] shrink-0" />
                              <span>{sym}{item.totalIncome.toFixed(2)}</span>
                            </div>

                            {/* Allowed */}
                            <div className="flex items-center justify-end gap-1 text-[#006397]" title="Allowed Budget">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#006397] shrink-0" />
                              <span>{sym}{item.totalAllowed.toFixed(2)}</span>
                            </div>

                            {/* Difference */}
                            <div className={`flex items-center justify-end gap-1 pt-0.5 border-t border-[#f0f1f2] font-extrabold ${
                              item.diff >= 0 ? 'text-[#008844]' : 'text-[#ba1a1a]'
                            }`} title="Difference (Allowed - Expense)">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.diff >= 0 ? 'bg-[#008844]' : 'bg-[#ba1a1a]'}`} />
                              <span>{item.diff >= 0 ? '+' : ''}{sym}{item.diff.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Mobile View: Minimalist date box with clean activity indicator dots (NO text amount) */}
                          <div className="flex sm:hidden items-center justify-center my-auto w-full pt-1">
                            <div className="flex items-center gap-1">
                              {item.totalExpense > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" title="Expense recorded" />}
                              {item.totalIncome > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#00a656]" title="Income recorded" />}
                              {item.totalExpense === 0 && item.totalIncome === 0 && <span className="w-1 h-1 rounded-full bg-[#c4c6cd]/30" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Legend Bar explaining the color indicators */}
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-2 px-3 bg-[#f8f9fa] rounded-xl border border-[#c4c6cd]/25 text-xs font-bold text-[#44474c] shadow-2xs">
                    <div className="flex items-center gap-1.5" title="Today's Date">
                      <span className="px-1.5 py-0.2 bg-[#d97706] text-white text-[10px] font-extrabold rounded-full">TODAY</span>
                      <span>Today</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Currently Selected Date">
                      <span className="px-1.5 py-0.2 bg-[#006397] text-white text-[10px] font-extrabold rounded-md">12</span>
                      <span>Selected Date</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Total Expense for the day">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
                      <span>Expense</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Total Income for the day">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00a656]" />
                      <span>Income</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Allowed Daily Budget">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#006397]" />
                      <span>Allowed Budget</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Net Difference (Allowed - Expense)">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#008844]" />
                      <span>Difference</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Mobile-optimized Daily Agenda List View */
                <div className="flex flex-col gap-2.5">
                  {calendarData.daysList.map((item) => {
                    const now = new Date();
                    const isToday =
                      now.getFullYear() === calendarYear &&
                      now.getMonth() === calendarMonth &&
                      now.getDate() === item.day;
                    const isSelected = selectedCalendarDay === item.day;
                    return (
                      <div
                        key={`list-day-${item.day}`}
                        onClick={() => setSelectedCalendarDay(isSelected ? null : item.day)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                          isSelected
                            ? 'border-2 border-[#006397] bg-[#006397]/10 shadow-sm'
                            : isToday
                            ? 'border-2 border-[#d97706] bg-[#fffcf0]'
                            : 'border-[#c4c6cd]/30 bg-white hover:border-[#006397]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isToday ? (
                              <span className="w-7 h-7 rounded-lg bg-[#d97706] text-white text-xs font-black flex items-center justify-center shrink-0">
                                {item.day}
                              </span>
                            ) : (
                              <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[#006397] text-white' : 'bg-[#f0f4f8] text-[#006397]'
                              }`}>
                                {item.day}
                              </span>
                            )}
                            <span className="font-bold text-sm text-[#191c1d] flex items-center gap-2">
                              <span>{MONTH_NAMES[calendarMonth]} {item.day}, {calendarYear}</span>
                              {isToday && (
                                <span className="text-[10px] font-black bg-[#d97706] text-white px-2 py-0.5 rounded-full">
                                  TODAY
                                </span>
                              )}
                            </span>
                          </div>
                          {item.txs.length > 0 && (
                            <span className="text-xs font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-full">
                              {item.txs.length} {item.txs.length === 1 ? 'tx' : 'txs'}
                            </span>
                          )}
                        </div>

                        {/* 4 Clean Value Pills */}
                        <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5 text-xs font-bold pt-1">
                          <div className="bg-[#ba1a1a]/10 text-[#ba1a1a] px-2 py-1 rounded-lg flex items-center justify-between">
                            <span className="text-[10px] text-[#ba1a1a]/80 uppercase">Exp:</span>
                            <span>{sym}{item.totalExpense.toFixed(2)}</span>
                          </div>
                          <div className="bg-[#00a656]/10 text-[#00a656] px-2 py-1 rounded-lg flex items-center justify-between">
                            <span className="text-[10px] text-[#00a656]/80 uppercase">Inc:</span>
                            <span>{sym}{item.totalIncome.toFixed(2)}</span>
                          </div>
                          <div className="bg-[#006397]/10 text-[#006397] px-2 py-1 rounded-lg flex items-center justify-between">
                            <span className="text-[10px] text-[#006397]/80 uppercase">Allow:</span>
                            <span>{sym}{item.totalAllowed.toFixed(2)}</span>
                          </div>
                          <div className={`px-2 py-1 rounded-lg flex items-center justify-between ${
                            item.diff >= 0 ? 'bg-[#008844]/10 text-[#008844]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                          }`}>
                            <span className="text-[10px] opacity-80 uppercase">Diff:</span>
                            <span>{item.diff >= 0 ? '+' : ''}{sym}{item.diff.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tag / Person Selection Modal Popup */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#e1e3e4] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#e1e3e4] flex items-center justify-between bg-[#f8f9fa]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#006397]/10 text-[#006397] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">sell</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#191c1d]">Filter by Tag / Person</h3>
                  <p className="text-xs text-[#44474c]">Select a tag or purpose to filter ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTagModal(false);
                  setTagSearchQuery('');
                }}
                className="w-8 h-8 rounded-full text-[#74777d] hover:text-[#191c1d] hover:bg-[#e1e3e4]/50 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search Filter Input inside Modal */}
            {uniquePersons.length > 4 && (
              <div className="p-3 border-b border-[#e1e3e4] bg-white">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777d] text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search tags or persons..."
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[#f3f4f5] rounded-xl text-xs font-medium border border-[#c4c6cd]/20 focus:outline-none focus:ring-2 focus:ring-[#006397]"
                  />
                  {tagSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTagSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#74777d]"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tag List */}
            <div className="p-4 overflow-y-auto flex flex-col gap-2 max-h-[360px]">
              {/* All Tags Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPersonFilter('all');
                  setShowTagModal(false);
                  setTagSearchQuery('');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                  selectedPersonFilter === 'all'
                    ? 'bg-[#e0f2fe] border-[#006397] text-[#006397] font-bold shadow-2xs'
                    : 'bg-[#f8f9fa] border-transparent hover:bg-[#f0f1f2] text-[#191c1d] font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]">layers</span>
                  <span className="text-sm">All Tags & Persons</span>
                </div>
                {selectedPersonFilter === 'all' && (
                  <span className="material-symbols-outlined text-[18px] text-[#006397]">check_circle</span>
                )}
              </button>

              {uniquePersons.length === 0 ? (
                <div className="py-8 text-center text-[#74777d]">
                  <span className="material-symbols-outlined text-3xl mb-1 text-[#a4a7ad]">sell</span>
                  <p className="text-xs font-medium">No tags or persons recorded yet.</p>
                  <p className="text-[11px] text-[#94979e] mt-0.5">Add a tag when creating or editing a transaction.</p>
                </div>
              ) : (
                uniquePersons
                  .filter((p) => p.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                  .map((person) => {
                    const isSelected = selectedPersonFilter.toLowerCase() === person.toLowerCase();
                    const count = personCounts[person] || 0;
                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => {
                          setSelectedPersonFilter(person);
                          setShowTagModal(false);
                          setTagSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#e0f2fe] border-[#006397] text-[#006397] font-bold shadow-2xs'
                            : 'bg-white border-[#e1e3e4] hover:border-[#006397]/40 hover:bg-[#f0f7fc] text-[#191c1d] font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-[#006397]">sell</span>
                          <span className="text-sm">{person}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#f3f4f5] text-[#44474c] font-semibold">
                            {count} {count === 1 ? 'tx' : 'txs'}
                          </span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[18px] text-[#006397]">check_circle</span>
                          )}
                        </div>
                      </button>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#e1e3e4] bg-[#f8f9fa] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedPersonFilter('all');
                  setShowTagModal(false);
                  setTagSearchQuery('');
                }}
                className="px-3 py-1.5 text-xs font-bold text-[#74777d] hover:text-[#191c1d]"
              >
                Reset Tag Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTagModal(false);
                  setTagSearchQuery('');
                }}
                className="px-4 py-2 bg-[#006397] text-white rounded-xl text-xs font-bold hover:bg-[#004e78] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

