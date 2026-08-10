import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { Transaction, CategoryTemplate, BankAccount, BudgetConfig } from '../types';

interface ReportsViewProps {
  transactions: Transaction[];
  categories: CategoryTemplate[];
  accounts: BankAccount[];
  config: BudgetConfig;
}

type TimePeriod = 'this_month' | 'last_month' | 'last_3_months' | 'year_to_date' | 'all' | 'custom';

const PALETTE_COLORS = [
  '#006397', '#00a656', '#d97706', '#9333ea', '#ec4899',
  '#0284c7', '#10b981', '#f59e0b', '#6366f1', '#14b8a6',
  '#8b5cf6', '#ef4444', '#64748b', '#06b6d4', '#84cc16'
];

const PERIOD_LABELS: Record<TimePeriod, { label: string; icon: string }> = {
  this_month: { label: 'This Month', icon: 'calendar_today' },
  last_month: { label: 'Last Month', icon: 'history' },
  last_3_months: { label: 'Last 3 Months', icon: 'date_range' },
  year_to_date: { label: 'Year to Date', icon: 'event' },
  all: { label: 'All Time', icon: 'all_inclusive' },
  custom: { label: 'Custom Range', icon: 'edit_calendar' },
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  categories,
  accounts,
  config,
}) => {
  const [period, setPeriod] = useState<TimePeriod>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateModal, setShowCustomDateModal] = useState<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  
  // Tab and Sub-Chart view controls
  const [activeChartTab, setActiveChartTab] = useState<'cashflow' | 'categories' | 'daily' | 'accounts'>('cashflow');
  const [cashflowChartType, setCashflowChartType] = useState<'bar' | 'area' | 'line'>('bar');
  const [cashflowMetric, setCashflowMetric] = useState<'all' | 'income' | 'expense' | 'net'>('all');
  const [categoryChartType, setCategoryChartType] = useState<'donut' | 'bar'>('donut');
  const [hoveredCategory, setHoveredCategory] = useState<{ name: string; value: number; percentage: number; color: string; icon?: string } | null>(null);
  const [dailyChartType, setDailyChartType] = useState<'daily' | 'cumulative' | 'moving_avg'>('daily');
  const [accountChartType, setAccountChartType] = useState<'bar' | 'donut'>('bar');
  const [categoryFilterSearch, setCategoryFilterSearch] = useState<string>('');

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const currencySymbol = config.currencySymbol || '$';

  // Account Labels and Filter Active
  const activeAccountLabel = useMemo(() => {
    if (selectedAccountId === 'all') return 'All Accounts';
    if (selectedAccountId === 'all_included') return 'All Accounts (Excl. Excluded)';
    const acc = accounts.find((a) => a.id === selectedAccountId);
    return acc ? acc.name : 'Account';
  }, [accounts, selectedAccountId]);

  const activeAccount = useMemo(() => {
    if (selectedAccountId === 'all' || selectedAccountId === 'all_included') return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Map category template properties (color, icon) by name
  const categoryMetaMap = useMemo(() => {
    const map = new Map<string, { color: string; icon: string }>();
    categories.forEach((cat) => {
      map.set(cat.name.toLowerCase(), {
        color: cat.color || '#006397',
        icon: cat.icon || 'category',
      });
    });
    return map;
  }, [categories]);

  // Filter transactions based on period and selected account
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter by account
    if (selectedAccountId === 'all_included') {
      const excludedAccountIds = new Set(accounts.filter((a) => a.excludeFromTotal).map((a) => a.id));
      result = result.filter(
        (t) => !excludedAccountIds.has(t.accountId) && (!t.toAccountId || !excludedAccountIds.has(t.toAccountId))
      );
    } else if (selectedAccountId !== 'all') {
      result = result.filter(
        (t) => t.accountId === selectedAccountId || t.toAccountId === selectedAccountId
      );
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (period === 'this_month') {
      result = result.filter((t) => {
        const d = new Date(t.date === 'Today' ? now : t.date === 'Yesterday' ? new Date(now.getTime() - 86400000) : t.date);
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    } else if (period === 'last_month') {
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      result = result.filter((t) => {
        const d = new Date(t.date === 'Today' ? now : t.date === 'Yesterday' ? new Date(now.getTime() - 86400000) : t.date);
        return !isNaN(d.getTime()) && d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
      });
    } else if (period === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      result = result.filter((t) => {
        const d = new Date(t.date === 'Today' ? now : t.date === 'Yesterday' ? new Date(now.getTime() - 86400000) : t.date);
        return !isNaN(d.getTime()) && d >= threeMonthsAgo;
      });
    } else if (period === 'year_to_date') {
      result = result.filter((t) => {
        const d = new Date(t.date === 'Today' ? now : t.date === 'Yesterday' ? new Date(now.getTime() - 86400000) : t.date);
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
      });
    } else if (period === 'custom') {
      if (customStartDate || customEndDate) {
        const start = customStartDate ? new Date(customStartDate + 'T00:00:00') : null;
        const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : null;
        result = result.filter((t) => {
          const d = new Date(t.date === 'Today' ? now : t.date === 'Yesterday' ? new Date(now.getTime() - 86400000) : t.date);
          if (isNaN(d.getTime())) return false;
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
      }
    }

    return result;
  }, [transactions, period, selectedAccountId, customStartDate, customEndDate, accounts]);

  // Aggregate metrics
  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Category Expense Breakdown Data
  const categoryBreakdownData = useMemo(() => {
    const map: Record<string, { value: number; count: number }> = {};
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const catName = t.category || 'Other';
        if (!map[catName]) map[catName] = { value: 0, count: 0 };
        map[catName].value += t.amount;
        map[catName].count += 1;
      });

    const entries = Object.entries(map).map(([name, data], index) => {
      const meta = categoryMetaMap.get(name.toLowerCase());
      const fallbackColor = PALETTE_COLORS[index % PALETTE_COLORS.length];
      return {
        name,
        value: data.value,
        count: data.count,
        avg: data.count > 0 ? data.value / data.count : 0,
        percentage: totalExpenses > 0 ? parseFloat(((data.value / totalExpenses) * 100).toFixed(1)) : 0,
        color: meta?.color || fallbackColor,
        icon: meta?.icon || 'category',
      };
    });

    return entries.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, totalExpenses, categoryMetaMap]);

  // Filtered Category List for Breakdown display
  const displayCategoryList = useMemo(() => {
    if (!categoryFilterSearch.trim()) return categoryBreakdownData;
    const q = categoryFilterSearch.toLowerCase();
    return categoryBreakdownData.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryBreakdownData, categoryFilterSearch]);

  // Monthly Cashflow Trend Data (chronological order)
  const monthlyCashflowData = useMemo(() => {
    const map: Record<string, { key: string; dateObj: Date; label: string; Income: number; Expense: number; Net: number }> = {};

    transactions.forEach((t) => {
      if (t.type === 'transfer') return;
      let dateObj = new Date();
      if (t.date === 'Yesterday') {
        dateObj.setDate(dateObj.getDate() - 1);
      } else if (t.date !== 'Today') {
        const parsed = new Date(t.date);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
      }

      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!map[key]) {
        map[key] = { key, dateObj, label, Income: 0, Expense: 0, Net: 0 };
      }

      if (t.type === 'income') {
        map[key].Income += t.amount;
      } else if (t.type === 'expense') {
        map[key].Expense += t.amount;
      }
      map[key].Net = map[key].Income - map[key].Expense;
    });

    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        month: item.label,
        Income: parseFloat(item.Income.toFixed(2)),
        Expense: parseFloat(item.Expense.toFixed(2)),
        Net: parseFloat(item.Net.toFixed(2)),
      }));
  }, [transactions]);

  // Daily Spending Trajectory & Cumulative Data
  const dailySpendData = useMemo(() => {
    const map: Record<string, { fullDate: string; label: string; amount: number }> = {};
    const now = new Date();

    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        let dateStr = t.date;
        if (t.date === 'Today') {
          dateStr = now.toISOString().split('T')[0];
        } else if (t.date === 'Yesterday') {
          const prev = new Date(now);
          prev.setDate(prev.getDate() - 1);
          dateStr = prev.toISOString().split('T')[0];
        }

        const fullDate = dateStr.length >= 10 ? dateStr : dateStr;
        const label = dateStr.length >= 10 ? dateStr.slice(5) : dateStr;

        if (!map[fullDate]) {
          map[fullDate] = { fullDate, label, amount: 0 };
        }
        map[fullDate].amount += t.amount;
      });

    const sorted = Object.values(map).sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    // Calculate cumulative spend & moving average
    let cumulative = 0;
    return sorted.map((item, idx, arr) => {
      cumulative += item.amount;

      // 7-day moving avg
      const startIdx = Math.max(0, idx - 6);
      const windowItems = arr.slice(startIdx, idx + 1);
      const avg = windowItems.reduce((acc, curr) => acc + curr.amount, 0) / windowItems.length;

      return {
        date: item.label,
        fullDate: item.fullDate,
        amount: parseFloat(item.amount.toFixed(2)),
        cumulative: parseFloat(cumulative.toFixed(2)),
        movingAvg: parseFloat(avg.toFixed(2)),
      };
    });
  }, [filteredTransactions]);

  // Peak spending day calculation
  const peakSpendDay = useMemo(() => {
    if (dailySpendData.length === 0) return null;
    return [...dailySpendData].sort((a, b) => b.amount - a.amount)[0];
  }, [dailySpendData]);

  // Average daily spend calculation
  const avgDailySpend = useMemo(() => {
    if (dailySpendData.length === 0) return 0;
    const total = dailySpendData.reduce((acc, item) => acc + item.amount, 0);
    return total / dailySpendData.length;
  }, [dailySpendData]);

  // Account Spending Distribution
  const accountDistributionData = useMemo(() => {
    const map: Record<string, { value: number; count: number; color?: string; icon?: string }> = {};

    filteredTransactions
      .filter((t) => t.type === 'expense' && t.accountId)
      .forEach((t) => {
        const acc = accounts.find((a) => a.id === t.accountId);
        const name = acc ? acc.name : 'Unassigned Account';
        if (!map[name]) {
          map[name] = {
            value: 0,
            count: 0,
            color: acc?.color || '#006397',
            icon: acc?.icon || 'account_balance',
          };
        }
        map[name].value += t.amount;
        map[name].count += 1;
      });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        value: parseFloat(data.value.toFixed(2)),
        count: data.count,
        color: data.color || '#006397',
        icon: data.icon || 'account_balance',
        percentage: totalExpenses > 0 ? parseFloat(((data.value / totalExpenses) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, accounts, totalExpenses]);

  // Top Payees / Merchants
  const topPayees = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};

    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const name = t.payee || t.person || t.title || 'General Merchant';
        if (!map[name]) map[name] = { name, amount: 0, count: 0 };
        map[name].amount += t.amount;
        map[name].count += 1;
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Account', 'Memo', 'Payee'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.date,
      t.type,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${(accounts.find((a) => a.id === t.accountId)?.name || t.accountId || '').replace(/"/g, '""')}"`,
      `"${(t.memo || '').replace(/"/g, '""')}"`,
      `"${(t.payee || t.person || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `luminous_report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Rich Tooltip Component
  const CustomTooltip = ({ active, payload, label, titleFormatter }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-[#0f172a]/95 text-white p-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md text-xs flex flex-col gap-1.5 min-w-[160px] animate-in fade-in duration-100 z-50">
        {label && (
          <div className="font-black text-[11px] uppercase tracking-wider text-[#94a3b8] border-b border-white/10 pb-1 flex items-center justify-between">
            <span>{titleFormatter ? titleFormatter(label) : label}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((entry: any, index: number) => {
            const name = entry.name || entry.dataKey;
            const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value || 0);
            const color = entry.color || entry.fill || '#006397';

            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 font-medium">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-200 truncate">{name}:</span>
                </div>
                <span className="font-mono font-bold text-white shrink-0">
                  {currencySymbol}{value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-6">
      {/* Top Bar Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-[#e1e3e4] shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#006397]/10 text-[#006397] flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[24px]">insights</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#191c1d] tracking-tight">
                Financial Analytics & Reports
              </h2>
              <p className="text-xs text-[#74777d] font-medium">
                Deep insights into cashflow, spending trends, and category dynamics
              </p>
            </div>
          </div>
        </div>

        {/* Period & Account Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 relative pt-3 border-t border-[#f0f1f2] lg:border-t-0 lg:pt-0">
          {/* Custom Account Filter Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAccountDropdown(!showAccountDropdown);
                setShowPeriodDropdown(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all cursor-pointer shadow-2xs ${
                selectedAccountId !== 'all'
                  ? 'bg-[#006397]/10 text-[#006397] border-[#006397]/30 ring-1 ring-[#006397]/20'
                  : 'bg-[#f0f4f8] text-[#191c1d] border-[#c4c6cd]/40 hover:bg-[#e1e3e4]'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] shrink-0 font-bold"
                style={{ backgroundColor: activeAccount?.color || '#006397' }}
              >
                <span className="material-symbols-outlined text-[10px]">
                  {selectedAccountId === 'all'
                    ? 'public'
                    : selectedAccountId === 'all_included'
                    ? 'visibility_off'
                    : activeAccount?.icon || 'account_balance'}
                </span>
              </div>
              <span>{activeAccountLabel}</span>
              <span className="material-symbols-outlined text-[16px] text-[#74777d]">
                {showAccountDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Account Custom Dropdown Popover */}
            {showAccountDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
                  onClick={() => setShowAccountDropdown(false)}
                />
                <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:top-full sm:bottom-auto sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-72 w-auto max-w-sm mx-auto sm:mx-0 bg-white rounded-2xl border border-[#e1e3e4] shadow-2xl z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto">
                  <div className="px-3 py-2 text-[10px] uppercase font-black tracking-wider text-[#74777d] border-b border-[#f0f1f2] flex items-center justify-between">
                    <span>Filter by Account</span>
                    <button
                      type="button"
                      onClick={() => setShowAccountDropdown(false)}
                      className="sm:hidden text-[#74777d] hover:text-[#191c1d] p-0.5 rounded-lg hover:bg-[#f0f2f5]"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  {/* Option 1: All Accounts (Combined) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId('all');
                      setShowAccountDropdown(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                      selectedAccountId === 'all'
                        ? 'bg-[#006397]/10 text-[#006397]'
                        : 'hover:bg-[#f0f4f8] text-[#191c1d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[15px]">public</span>
                      </div>
                      <div className="flex flex-col">
                        <span>All Accounts (Combined)</span>
                        <span className="text-[10px] text-[#74777d] font-normal">
                          Includes every account
                        </span>
                      </div>
                    </div>
                    {selectedAccountId === 'all' && (
                      <span className="material-symbols-outlined text-[16px] text-[#006397]">check</span>
                    )}
                  </button>

                  {/* Option 2: All Accounts (Excl. Excluded) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId('all_included');
                      setShowAccountDropdown(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                      selectedAccountId === 'all_included'
                        ? 'bg-[#006397]/10 text-[#006397]'
                        : 'hover:bg-[#f0f4f8] text-[#191c1d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[15px]">visibility_off</span>
                      </div>
                      <div className="flex flex-col">
                        <span>All Accounts (Excl. Excluded)</span>
                        <span className="text-[10px] text-[#74777d] font-normal">
                          Omits accounts hidden from total
                        </span>
                      </div>
                    </div>
                    {selectedAccountId === 'all_included' && (
                      <span className="material-symbols-outlined text-[16px] text-[#006397]">check</span>
                    )}
                  </button>

                  <div className="my-1 border-t border-[#f0f1f2]" />

                  {/* Individual accounts list */}
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setSelectedAccountId(acc.id);
                          setShowAccountDropdown(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#006397]/10 text-[#006397]'
                            : 'hover:bg-[#f0f4f8] text-[#191c1d]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 font-bold"
                            style={{ backgroundColor: acc.color || '#006397' }}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {acc.icon || 'account_balance'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{acc.name}</span>
                              {acc.excludeFromTotal && (
                                <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-[#ba1a1a]/10 text-[#ba1a1a]">
                                  Excluded
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#74777d] font-semibold">{acc.type}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[16px] text-[#006397]">check</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Custom Time Period Filter Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPeriodDropdown(!showPeriodDropdown);
                setShowAccountDropdown(false);
              }}
              className="px-3.5 py-2 bg-[#006397] hover:bg-[#00476e] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 border border-[#006397] transition-all cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">
                {PERIOD_LABELS[period]?.icon || 'calendar_month'}
              </span>
              <span>
                {period === 'custom'
                  ? customStartDate && customEndDate
                    ? `${customStartDate} to ${customEndDate}`
                    : customStartDate
                    ? `From ${customStartDate}`
                    : customEndDate
                    ? `Until ${customEndDate}`
                    : 'Custom Range'
                  : PERIOD_LABELS[period]?.label}
              </span>
              <span className="material-symbols-outlined text-[16px]">
                {showPeriodDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Time Period Custom Dropdown Popover */}
            {showPeriodDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
                  onClick={() => setShowPeriodDropdown(false)}
                />
                <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:top-full sm:bottom-auto sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-64 w-auto max-w-xs mx-auto sm:mx-0 bg-white rounded-2xl border border-[#e1e3e4] shadow-2xl z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto">
                  <div className="px-3 py-2 text-[10px] uppercase font-black tracking-wider text-[#74777d] border-b border-[#f0f1f2] flex items-center justify-between">
                    <span>Select Time Window</span>
                    <button
                      type="button"
                      onClick={() => setShowPeriodDropdown(false)}
                      className="sm:hidden text-[#74777d] hover:text-[#191c1d] p-0.5 rounded-lg hover:bg-[#f0f2f5]"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((key) => {
                    const item = PERIOD_LABELS[key];
                    const isSelected = period === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPeriod(key);
                          if (key === 'custom') {
                            setShowCustomDateModal(true);
                          }
                          setShowPeriodDropdown(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#006397]/10 text-[#006397]'
                            : 'hover:bg-[#f0f4f8] text-[#191c1d]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-[#006397]">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[16px] text-[#006397]">check</span>
                        )}
                      </button>
                    );
                  })}

                  {period === 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomDateModal(true);
                        setShowPeriodDropdown(false);
                      }}
                      className="mt-1 w-full p-2 rounded-xl bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer border border-[#006397]/20"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                      <span>Configure Date Range</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] font-extrabold text-xs rounded-xl flex items-center gap-1.5 border border-[#006397]/20 transition-all cursor-pointer"
            title="Export Report to CSV"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Active Filter Pill Bar */}
      {(selectedAccountId !== 'all' || period === 'custom') && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[#006397]/10 border border-[#006397]/20 rounded-2xl text-xs font-bold text-[#006397] animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            <span>Filtered by:</span>
            {selectedAccountId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-[#006397]/20 font-extrabold text-[#006397]">
                Account:{' '}
                {selectedAccountId === 'all_included'
                  ? 'Excl. Excluded Accounts'
                  : activeAccount?.name}
                <button
                  type="button"
                  onClick={() => setSelectedAccountId('all')}
                  className="hover:text-[#ba1a1a] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </span>
            )}
            {period === 'custom' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-[#006397]/20 font-extrabold text-[#006397]">
                Date Range:{' '}
                {customStartDate && customEndDate
                  ? `${customStartDate} to ${customEndDate}`
                  : customStartDate
                  ? `From ${customStartDate}`
                  : customEndDate
                  ? `Until ${customEndDate}`
                  : 'Custom'}
                <button
                  type="button"
                  onClick={() => setShowCustomDateModal(true)}
                  className="hover:text-[#00476e] cursor-pointer ml-1"
                  title="Configure dates"
                >
                  <span className="material-symbols-outlined text-[12px]">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriod('this_month');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="hover:text-[#ba1a1a] cursor-pointer"
                  title="Reset date filter"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedAccountId('all');
              setPeriod('this_month');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="ml-auto px-2 py-0.5 rounded-lg bg-white/80 hover:bg-white text-[11px] font-extrabold text-[#006397] transition-all flex items-center gap-1 border border-[#006397]/20 cursor-pointer"
          >
            <span>Reset All</span>
            <span className="material-symbols-outlined text-[14px]">rotate_left</span>
          </button>
        </div>
      )}

      {/* KPI Key Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Income */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e1e3e4] shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden relative group">
          <div className="flex items-center justify-between text-[#00a656] text-xs font-bold uppercase tracking-wider mb-2 gap-1">
            <span className="truncate">Total Income</span>
            <div className="w-7 h-7 rounded-xl bg-[#00a656]/10 text-[#00a656] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <span
              className="text-base sm:text-xl lg:text-2xl xl:text-3xl font-black text-[#00a656] font-mono tracking-tight truncate block"
              title={`+${currencySymbol}${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              +{currencySymbol}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-[#74777d] mt-1 font-semibold truncate">
              {filteredTransactions.filter((t) => t.type === 'income').length} deposit entries
            </p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e1e3e4] shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden relative group">
          <div className="flex items-center justify-between text-[#ba1a1a] text-xs font-bold uppercase tracking-wider mb-2 gap-1">
            <span className="truncate">Total Outflow</span>
            <div className="w-7 h-7 rounded-xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <span
              className="text-base sm:text-xl lg:text-2xl xl:text-3xl font-black text-[#ba1a1a] font-mono tracking-tight truncate block"
              title={`-${currencySymbol}${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              -{currencySymbol}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-[#74777d] mt-1 font-semibold truncate">
              {filteredTransactions.filter((t) => t.type === 'expense').length} expense transactions
            </p>
          </div>
        </div>

        {/* Net Savings */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e1e3e4] shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden relative group">
          <div className="flex items-center justify-between text-[#006397] text-xs font-bold uppercase tracking-wider mb-2 gap-1">
            <span className="truncate">Net Cash Retention</span>
            <div className="w-7 h-7 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">savings</span>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <span
              className={`text-base sm:text-xl lg:text-2xl xl:text-3xl font-black font-mono tracking-tight truncate block ${
                netSavings >= 0 ? 'text-[#006397]' : 'text-[#ba1a1a]'
              }`}
              title={`${netSavings >= 0 ? '+' : ''}${currencySymbol}${netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              {netSavings >= 0 ? '+' : ''}{currencySymbol}{netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-[#74777d] mt-1 font-semibold truncate">
              Income minus total expenses
            </p>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e1e3e4] shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden relative group">
          <div className="flex items-center justify-between text-[#006397] text-xs font-bold uppercase tracking-wider mb-2 gap-1">
            <span className="truncate">Savings Efficiency</span>
            <div className="w-7 h-7 rounded-xl bg-[#9333ea]/10 text-[#9333ea] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">donut_large</span>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-base sm:text-xl lg:text-2xl xl:text-3xl font-black text-[#191c1d] font-mono tracking-tight truncate">
                {savingsRate}%
              </span>
              <span className="text-xs font-bold text-[#00a656] shrink-0">
                {savingsRate >= 20 ? 'Great' : savingsRate > 0 ? 'Moderate' : 'Low'}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[#e2e8f0] h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-[#006397] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Charts Container */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#e1e3e4] shadow-xs flex flex-col gap-5">
        {/* Chart Primary Tabs Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#f0f2f5] pb-4">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveChartTab('cashflow')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeChartTab === 'cashflow'
                  ? 'bg-[#006397] text-white shadow-md ring-2 ring-[#006397]/20'
                  : 'bg-[#f0f4f8] text-[#44474c] hover:bg-[#e1e3e4]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">bar_chart</span>
              <span>Cashflow Trend</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChartTab('categories')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeChartTab === 'categories'
                  ? 'bg-[#006397] text-white shadow-md ring-2 ring-[#006397]/20'
                  : 'bg-[#f0f4f8] text-[#44474c] hover:bg-[#e1e3e4]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">pie_chart</span>
              <span>Categories</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChartTab('daily')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeChartTab === 'daily'
                  ? 'bg-[#006397] text-white shadow-md ring-2 ring-[#006397]/20'
                  : 'bg-[#f0f4f8] text-[#44474c] hover:bg-[#e1e3e4]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">show_chart</span>
              <span>Daily Velocity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChartTab('accounts')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeChartTab === 'accounts'
                  ? 'bg-[#006397] text-white shadow-md ring-2 ring-[#006397]/20'
                  : 'bg-[#f0f4f8] text-[#44474c] hover:bg-[#e1e3e4]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              <span>By Account</span>
            </button>
          </div>

          {/* Sub-controls based on active chart tab */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {activeChartTab === 'cashflow' && (
              <div className="flex items-center bg-[#f0f4f8] p-1 rounded-xl border border-[#e1e3e4] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCashflowChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowChartType === 'bar' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Bars
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowChartType('area')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowChartType === 'area' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Area Fills
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowChartType('line')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowChartType === 'line' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Line Trend
                </button>
              </div>
            )}

            {activeChartTab === 'categories' && (
              <div className="flex items-center bg-[#f0f4f8] p-1 rounded-xl border border-[#e1e3e4] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCategoryChartType('donut')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    categoryChartType === 'donut' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">donut_large</span>
                  <span>Donut</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    categoryChartType === 'bar' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">align_horizontal_left</span>
                  <span>Bars</span>
                </button>
              </div>
            )}

            {activeChartTab === 'daily' && (
              <div className="flex items-center bg-[#f0f4f8] p-1 rounded-xl border border-[#e1e3e4] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDailyChartType('daily')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    dailyChartType === 'daily' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Daily Spend
                </button>
                <button
                  type="button"
                  onClick={() => setDailyChartType('cumulative')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    dailyChartType === 'cumulative' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Cumulative
                </button>
                <button
                  type="button"
                  onClick={() => setDailyChartType('moving_avg')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    dailyChartType === 'moving_avg' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  7-Day Avg
                </button>
              </div>
            )}

            {activeChartTab === 'accounts' && (
              <div className="flex items-center bg-[#f0f4f8] p-1 rounded-xl border border-[#e1e3e4] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setAccountChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    accountChartType === 'bar' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Horizontal Bars
                </button>
                <button
                  type="button"
                  onClick={() => setAccountChartType('donut')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    accountChartType === 'donut' ? 'bg-white text-[#006397] shadow-2xs font-extrabold' : 'text-[#64748b] hover:text-[#041627]'
                  }`}
                >
                  Share Donut
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CHART TAB 1: Monthly Cashflow Trend */}
        {activeChartTab === 'cashflow' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[#191c1d] flex items-center gap-2">
                  <span>Monthly Income vs Expense Performance</span>
                  <span className="text-[10px] bg-[#006397]/10 text-[#006397] px-2 py-0.5 rounded-full font-bold">
                    {monthlyCashflowData.length} Periods Recorded
                  </span>
                </h3>
                <p className="text-xs text-[#74777d]">Track net financial velocity across monthly windows</p>
              </div>

              {/* Data filter toggles */}
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCashflowMetric('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowMetric === 'all' ? 'bg-[#006397]/10 text-[#006397] font-extrabold' : 'text-[#64748b] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Combined
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowMetric('income')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowMetric === 'income' ? 'bg-[#00a656]/10 text-[#00a656] font-extrabold' : 'text-[#64748b] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowMetric('expense')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowMetric === 'expense' ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] font-extrabold' : 'text-[#64748b] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Outflow
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowMetric('net')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    cashflowMetric === 'net' ? 'bg-[#9333ea]/10 text-[#9333ea] font-extrabold' : 'text-[#64748b] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Net Retention
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-80 w-full pt-2 relative">
              {monthlyCashflowData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {cashflowChartType === 'bar' ? (
                    <BarChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                      
                      {(cashflowMetric === 'all' || cashflowMetric === 'income') && (
                        <Bar dataKey="Income" fill="#00a656" radius={[8, 8, 0, 0]} name="Income (+)" maxBarSize={48} />
                      )}
                      {(cashflowMetric === 'all' || cashflowMetric === 'expense') && (
                        <Bar dataKey="Expense" fill="#ba1a1a" radius={[8, 8, 0, 0]} name="Expenses (-)" maxBarSize={48} />
                      )}
                      {(cashflowMetric === 'net') && (
                        <Bar dataKey="Net" fill="#006397" radius={[8, 8, 0, 0]} name="Net Retention" maxBarSize={48} />
                      )}
                    </BarChart>
                  ) : cashflowChartType === 'area' ? (
                    <AreaChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00a656" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#00a656" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#006397" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#006397" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      
                      {(cashflowMetric === 'all' || cashflowMetric === 'income') && (
                        <Area type="monotone" dataKey="Income" stroke="#00a656" strokeWidth={3} fill="url(#incomeGrad)" name="Income (+)" />
                      )}
                      {(cashflowMetric === 'all' || cashflowMetric === 'expense') && (
                        <Area type="monotone" dataKey="Expense" stroke="#ba1a1a" strokeWidth={3} fill="url(#expenseGrad)" name="Expenses (-)" />
                      )}
                      {(cashflowMetric === 'net') && (
                        <Area type="monotone" dataKey="Net" stroke="#006397" strokeWidth={3} fill="url(#netGrad)" name="Net Retention" />
                      )}
                    </AreaChart>
                  ) : (
                    <LineChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      
                      {(cashflowMetric === 'all' || cashflowMetric === 'income') && (
                        <Line type="monotone" dataKey="Income" stroke="#00a656" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} name="Income (+)" />
                      )}
                      {(cashflowMetric === 'all' || cashflowMetric === 'expense') && (
                        <Line type="monotone" dataKey="Expense" stroke="#ba1a1a" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} name="Expenses (-)" />
                      )}
                      {(cashflowMetric === 'net') && (
                        <Line type="monotone" dataKey="Net" stroke="#006397" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} name="Net Retention" />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#74777d] text-xs font-semibold py-12 gap-2">
                  <span className="material-symbols-outlined text-[32px] text-[#c4c6cd]">bar_chart</span>
                  <span>No monthly cashflow data recorded for this selection</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHART TAB 2: Expense Categories Breakdown */}
        {activeChartTab === 'categories' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[#191c1d]">Category Outflow Breakdown</h3>
                <p className="text-xs text-[#74777d]">Proportional analysis of expenditure across category buckets</p>
              </div>

              {/* Search Category Filter */}
              <div className="relative max-w-xs w-full">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#74777d] text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter category list..."
                  value={categoryFilterSearch}
                  onChange={(e) => setCategoryFilterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#f0f4f8] border border-[#c4c6cd]/40 rounded-xl text-xs font-semibold text-[#041627] focus:outline-none focus:ring-2 focus:ring-[#006397]"
                />
              </div>
            </div>

            {categoryChartType === 'donut' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Interactive Donut Chart Container */}
                <div className="lg:col-span-6 h-80 w-full relative flex items-center justify-center bg-[#f8fafc] rounded-2xl p-4 border border-[#e2e8f0]">
                  {categoryBreakdownData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdownData}
                            cx="50%"
                            cy="50%"
                            innerRadius={72}
                            outerRadius={115}
                            paddingAngle={3}
                            dataKey="value"
                            onMouseEnter={(_, index) => setHoveredCategory(categoryBreakdownData[index])}
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            {categoryBreakdownData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                                stroke={hoveredCategory?.name === entry.name ? '#041627' : '#ffffff'}
                                strokeWidth={hoveredCategory?.name === entry.name ? 3 : 1.5}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Interactive Center Donut Metric Card */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none">
                        {hoveredCategory ? (
                          <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#191c1d]">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: hoveredCategory.color }}
                              />
                              <span className="truncate max-w-[120px]">{hoveredCategory.name}</span>
                            </div>
                            <span className="text-xl font-black text-[#191c1d] font-mono my-0.5">
                              {currencySymbol}{hoveredCategory.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[11px] font-extrabold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-full">
                              {hoveredCategory.percentage}% of total
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#74777d]">Total Outflow</span>
                            <span className="text-xl font-black text-[#041627] font-mono my-0.5">
                              {currencySymbol}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] text-[#74777d] font-semibold">
                              Across {categoryBreakdownData.length} categories
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-[#74777d] text-xs font-semibold py-12">
                      No expense records found for selected period
                    </div>
                  )}
                </div>

                {/* Category List Details */}
                <div className="lg:col-span-6 flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-[#64748b] uppercase tracking-wider px-1 pb-1 border-b border-[#f0f2f5]">
                    <span>Category</span>
                    <span>Amount (% Outflow)</span>
                  </div>

                  {displayCategoryList.length > 0 ? (
                    displayCategoryList.map((cat) => (
                      <div
                        key={cat.name}
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between text-xs cursor-pointer ${
                          hoveredCategory?.name === cat.name
                            ? 'bg-[#006397]/10 border-[#006397]/40 shadow-xs'
                            : 'bg-[#f8fafc] hover:bg-[#f1f5f9] border-[#e2e8f0]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-2xs"
                            style={{ backgroundColor: cat.color }}
                          >
                            <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-[#191c1d] truncate">{cat.name}</span>
                            <span className="text-[10px] text-[#74777d]">
                              {cat.count} txns • Avg {currencySymbol}{cat.avg.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 font-mono shrink-0">
                          <span className="font-extrabold text-[#191c1d]">
                            {currencySymbol}{cat.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-md min-w-[42px] text-center">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#74777d] text-center py-8">No matching categories found</p>
                  )}
                </div>
              </div>
            ) : (
              /* Category Horizontal Bar Mode */
              <div className="h-80 w-full pt-2">
                {displayCategoryList.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayCategoryList} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={(val) => `${currencySymbol}${val}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#191c1d', fontWeight: 700 }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} name="Spent">
                        {displayCategoryList.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-[#74777d] text-xs font-semibold py-12">
                    No expense data found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CHART TAB 3: Daily Spending Trajectory */}
        {activeChartTab === 'daily' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-[#191c1d]">Daily Spending Trajectory & Burn Rate</h3>
                <p className="text-xs text-[#74777d]">Analyze daily expense cadence and cumulative spend velocity</p>
              </div>

              {/* Highlights pills */}
              <div className="flex items-center gap-2 text-xs">
                {peakSpendDay && (
                  <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a] px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    <span>Peak Day: {peakSpendDay.date} ({currencySymbol}{peakSpendDay.amount.toFixed(0)})</span>
                  </div>
                )}
                <div className="bg-[#006397]/10 border border-[#006397]/20 text-[#006397] px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">speed</span>
                  <span>Avg: {currencySymbol}{avgDailySpend.toFixed(0)}/day</span>
                </div>
              </div>
            </div>

            {/* Daily Chart */}
            <div className="h-80 w-full pt-2">
              {dailySpendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {dailyChartType === 'daily' ? (
                    <BarChart data={dailySpendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={avgDailySpend} stroke="#d97706" strokeDasharray="4 4" label={{ value: 'Avg', fill: '#d97706', fontSize: 10, fontWeight: 800 }} />
                      <Bar dataKey="amount" fill="#006397" radius={[6, 6, 0, 0]} name="Daily Spend" maxBarSize={32} />
                    </BarChart>
                  ) : dailyChartType === 'cumulative' ? (
                    <AreaChart data={dailySpendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9333ea" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cumulative" stroke="#9333ea" strokeWidth={3} fill="url(#cumulGrad)" name="Cumulative Total" />
                    </AreaChart>
                  ) : (
                    <ComposedChart data={dailySpendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="amount" fill="#006397" opacity={0.4} radius={[4, 4, 0, 0]} name="Daily Spend" maxBarSize={28} />
                      <Line type="monotone" dataKey="movingAvg" stroke="#00a656" strokeWidth={3} dot={false} name="7-Day Moving Avg" />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-[#74777d] text-xs font-semibold py-12">
                  No daily expenditure activity recorded for selected range
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHART TAB 4: Account Outflow Distribution */}
        {activeChartTab === 'accounts' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[#191c1d]">Outflow Source Account Distribution</h3>
                <p className="text-xs text-[#74777d]">Which linked bank account or card funded your expenses</p>
              </div>
            </div>

            {accountChartType === 'bar' ? (
              <div className="h-80 w-full pt-2">
                {accountDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accountDistributionData} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={(val) => `${currencySymbol}${val}`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#191c1d', fontWeight: 700 }} width={130} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} name="Account Outflow">
                        {accountDistributionData.map((entry, index) => (
                          <Cell key={`acc-bar-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-[#74777d] text-xs font-semibold py-12">
                    No accounts linked to expenses in this period
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-6 h-80 w-full flex items-center justify-center bg-[#f8fafc] rounded-2xl p-4 border border-[#e2e8f0]">
                  {accountDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={accountDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {accountDistributionData.map((entry, index) => (
                            <Cell key={`cell-acc-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-[#74777d] text-xs font-semibold py-12">
                      No account distribution data available
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 flex flex-col gap-2">
                  {accountDistributionData.map((acc) => (
                    <div
                      key={acc.name}
                      className="p-3 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 font-bold"
                          style={{ backgroundColor: acc.color }}
                        >
                          <span className="material-symbols-outlined text-[15px]">{acc.icon}</span>
                        </div>
                        <span className="font-bold text-[#191c1d]">{acc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-extrabold text-[#191c1d]">
                          {currencySymbol}{acc.value.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-md min-w-[42px] text-center">
                          {acc.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insights & Top Merchants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Payees & Merchants Card */}
        <div className="bg-white p-5 rounded-3xl border border-[#e1e3e4] shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#f0f2f5]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006397] text-[20px]">storefront</span>
              <h3 className="font-extrabold text-sm text-[#191c1d]">Top Merchants & Payees</h3>
            </div>
            <span className="text-[11px] text-[#74777d] font-semibold">Highest Spend</span>
          </div>

          <div className="flex flex-col gap-2">
            {topPayees.length > 0 ? (
              topPayees.map((payee, idx) => (
                <div
                  key={payee.name}
                  className="p-3 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-[#006397]/10 text-[#006397] font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-[#191c1d] truncate">{payee.name}</span>
                      <span className="text-[10px] text-[#74777d] font-semibold">
                        {payee.count} transaction{payee.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-xs text-[#ba1a1a] shrink-0">
                    -{currencySymbol}{payee.amount.toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#74777d] text-center py-6">No merchant data available</p>
            )}
          </div>
        </div>

        {/* Smart Pacing Advisory & Health Checks */}
        <div className="bg-white p-5 rounded-3xl border border-[#e1e3e4] shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#f0f2f5]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00a656] text-[20px]">health_and_safety</span>
              <h3 className="font-extrabold text-sm text-[#191c1d]">Financial Pacing Insights</h3>
            </div>
            <span className="text-[11px] text-[#00a656] font-bold bg-[#00a656]/10 px-2 py-0.5 rounded-full">
              Automated
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {savingsRate >= 20 ? (
              <div className="p-3 bg-[#00a656]/10 border border-[#00a656]/20 rounded-2xl flex items-start gap-2.5 text-[#006a36]">
                <span className="material-symbols-outlined text-[20px] text-[#00a656] shrink-0">check_circle</span>
                <div>
                  <h4 className="font-bold text-xs">Healthy Savings Rate ({savingsRate}%)</h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    You are retaining over 20% of your earnings. Great discipline in building wealth!
                  </p>
                </div>
              </div>
            ) : savingsRate > 0 ? (
              <div className="p-3 bg-[#006397]/10 border border-[#006397]/20 rounded-2xl flex items-start gap-2.5 text-[#00476e]">
                <span className="material-symbols-outlined text-[20px] text-[#006397] shrink-0">info</span>
                <div>
                  <h4 className="font-bold text-xs">Positive Cashflow ({savingsRate}% Saved)</h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    You are living within your means. Consider cutting top non-essential categories to reach a 20%+ savings goal.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-2xl flex items-start gap-2.5 text-[#8c1d18]">
                <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0">warning</span>
                <div>
                  <h4 className="font-bold text-xs">Deficit Alert</h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    Expenses currently exceed or match income for this period. Review your category budget limits to prevent balance erosion.
                  </p>
                </div>
              </div>
            )}

            {/* Top Category Advisory */}
            {categoryBreakdownData.length > 0 && (
              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-[#006397] shrink-0">pie_chart</span>
                <div>
                  <h4 className="font-bold text-xs text-[#191c1d]">
                    Primary Outflow: {categoryBreakdownData[0].name}
                  </h4>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    Consumes <strong>{categoryBreakdownData[0].percentage}%</strong> of total expense ({currencySymbol}{categoryBreakdownData[0].value.toFixed(2)}).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showCustomDateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowCustomDateModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full border border-[#e1e3e4] shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f1f2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#041627]">Custom Date Range</h3>
                  <p className="text-[11px] text-[#74777d]">Select start and end dates for report</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomDateModal(false)}
                className="w-7 h-7 rounded-full bg-[#f0f2f5] hover:bg-[#e1e3e4] text-[#44474c] flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Date Inputs */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-[#44474c] mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f0f4f8] border border-[#c4c6cd]/40 rounded-xl text-xs font-semibold text-[#041627] focus:outline-none focus:ring-2 focus:ring-[#006397]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44474c] mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f0f4f8] border border-[#c4c6cd]/40 rounded-xl text-xs font-semibold text-[#041627] focus:outline-none focus:ring-2 focus:ring-[#006397]"
                />
              </div>
            </div>

            {/* Preset Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#f0f1f2]">
              <span className="w-full text-[10px] uppercase font-bold text-[#74777d] mb-0.5">Quick Presets</span>
              <button
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 7);
                  setCustomStartDate(start.toISOString().split('T')[0]);
                  setCustomEndDate(end.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-[#f0f2f5] hover:bg-[#e1e3e4] rounded-lg text-[11px] font-bold text-[#041627] cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 30);
                  setCustomStartDate(start.toISOString().split('T')[0]);
                  setCustomEndDate(end.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-[#f0f2f5] hover:bg-[#e1e3e4] rounded-lg text-[11px] font-bold text-[#041627] cursor-pointer"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="px-2.5 py-1 bg-[#ba1a1a]/10 hover:bg-[#ba1a1a]/20 rounded-lg text-[11px] font-bold text-[#ba1a1a] cursor-pointer ml-auto"
              >
                Clear Range
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#f0f1f2]">
              <button
                type="button"
                onClick={() => setShowCustomDateModal(false)}
                className="flex-1 py-2.5 bg-[#f0f2f5] hover:bg-[#e1e3e4] text-[#041627] font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod('custom');
                  setShowCustomDateModal(false);
                }}
                className="flex-1 py-2.5 bg-[#006397] hover:bg-[#00476e] text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-2xs transition-colors"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
