import React, { useState } from 'react';
import { BudgetConfig, FixedBill, CategoryTemplate, Transaction } from '../types';
import {
  getCategoryBreakdown,
  getBillingCycleInfo,
  getRollingDailyCategoryPacing,
} from '../utils/finance';
import { AddCategoryModal } from './AddCategoryModal';

interface BudgetsViewProps {
  config: BudgetConfig;
  onUpdateConfig: (updated: Partial<BudgetConfig>) => void;
  fixedBills: FixedBill[];
  onToggleFixedBill: (id: string) => void;
  onAddFixedBill: (bill: Omit<FixedBill, 'id'>) => void;
  categories: CategoryTemplate[];
  onAddCategory: (cat: CategoryTemplate) => void;
  onUpdateCategory: (id: string, updated: Partial<CategoryTemplate>) => void;
  onDeleteCategory: (id: string) => void;
  transactions: Transaction[];
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  config,
  onUpdateConfig,
  fixedBills,
  onToggleFixedBill,
  onAddFixedBill,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  transactions,
}) => {
  const [showAddBillModal, setShowAddBillModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billSchedule, setBillSchedule] = useState('Monthly on 1st');

  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCatForModal, setEditingCatForModal] = useState<CategoryTemplate | null>(null);

  const [modeFilter, setModeFilter] = useState<'all' | 'rolling' | 'standard'>('all');

  const sym = config.currencySymbol || '$';
  const activeDate = new Date();

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const baseIncome = totalIncome > 0 ? totalIncome : (config.monthlyTarget > 0 ? config.monthlyTarget : 5000);

  const breakdown = getCategoryBreakdown(transactions, categories);
  const cycleInfo = getBillingCycleInfo(config.paydayAnchorDay, activeDate);

  // Compute metrics for categories with Rolling Daily mode enabled
  const rollingCategories = categories.filter(
    (cat) =>
      (cat.type || 'expense') !== 'income' &&
      !cat.isSystemOther &&
      cat.name.toLowerCase() !== 'other' &&
      cat.hasAllocation !== false &&
      (cat.budgetLimit ?? 0) > 0 &&
      cat.rollingDailyEnabled
  );

  const rollingPacingList = rollingCategories.map((cat) => {
    const limit = cat.budgetLimit ?? 300;
    const rolloverEnabled = cat.rolloverEnabled ?? true;
    const rolledOverAmount = cat.rolledOverAmount ?? 0;
    const monthlyBudget = limit + (rolloverEnabled ? rolledOverAmount : 0);

    return {
      cat,
      pacing: getRollingDailyCategoryPacing(
        cat.name,
        monthlyBudget,
        config.paydayAnchorDay,
        transactions,
        activeDate
      ),
    };
  });

  const totalRollingBaseRate = rollingPacingList.reduce(
    (sum, item) => sum + item.pacing.dailyBaseRate,
    0
  );
  const totalRollingAvailableToday = rollingPacingList.reduce(
    (sum, item) => sum + item.pacing.availableToSpendToday,
    0
  );

  // 'Others' / Unallocated expenses impact on daily available budget
  const otherStats = breakdown.find((b) => b.isSystemOther || b.category.toLowerCase() === 'other');
  const otherSpent = otherStats ? otherStats.amount : 0;

  const allocatedBreakdown = breakdown.filter((b) => !b.isSystemOther && b.category.toLowerCase() !== 'other');
  const totalAllocatedSpent = allocatedBreakdown.reduce((sum, b) => sum + b.amount, 0);

  const daysLeftInCycle = Math.max(1, cycleInfo.daysRemainingInCycle);
  const totalEffectiveBudget = breakdown.reduce((sum, b) => sum + b.effectiveBudget, 0) || config.monthlyTarget || 3000;

  // Total allocated budget across categories vs monthly target budget
  const totalBudgetAllocated = categories
    .filter(
      (cat) =>
        (cat.type || 'expense') !== 'income' &&
        !cat.isSystemOther &&
        cat.name.toLowerCase() !== 'other' &&
        cat.hasAllocation !== false
    )
    .reduce((sum, cat) => sum + (cat.budgetLimit ?? 0), 0);

  const targetBudget = config.monthlyTarget || 3000;
  const unallocatedTargetBudget = targetBudget - totalBudgetAllocated;
  const allocationPercentage = targetBudget > 0 ? Math.round((totalBudgetAllocated / targetBudget) * 100) : 0;

  const grossRemainingBudget = Math.max(0, totalEffectiveBudget - totalAllocatedSpent);
  const grossDailyTarget = grossRemainingBudget / daysLeftInCycle;
  const dailyOthersDeduction = otherSpent / daysLeftInCycle;

  const netRemainingBudget = Math.max(0, totalEffectiveBudget - totalAllocatedSpent - otherSpent);
  const netDailyAvailablePerDay = netRemainingBudget / daysLeftInCycle;
  const netRollingAvailableToday = totalRollingAvailableToday - otherSpent;

  const handleDayChange = (delta: number) => {
    let nextDay = config.paydayAnchorDay + delta;
    if (nextDay < 1) nextDay = 31;
    if (nextDay > 31) nextDay = 1;
    onUpdateConfig({ paydayAnchorDay: nextDay });
  };

  const handleCreateBill = () => {
    const amt = parseFloat(billAmount);
    if (!billName.trim() || isNaN(amt) || amt <= 0) return;

    onAddFixedBill({
      name: billName.trim(),
      amount: amt,
      schedule: billSchedule.trim() || 'Monthly',
      icon: 'receipt',
      active: true,
    });

    setBillName('');
    setBillAmount('');
    setShowAddBillModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 mt-2 flex flex-col gap-6 mb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#191c1d]">Category Budgets & Rollover</h1>
          <p className="text-sm text-[#44474c]">Set target limits, manage carry-over surpluses, and track daily rolling pacing.</p>
        </div>
      </div>

      {/* Budget Allocation & Pacing Metric Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Amount Left After Budget Allocation in Target Budget */}
        <div className="bg-white p-5 rounded-2xl border border-[#e1e3e4] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#006397] bg-[#006397]/10 px-2.5 py-1 rounded-full">
              Target Budget Left
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              unallocatedTargetBudget >= 0 ? 'bg-[#00a656]/10 text-[#00a656]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
            }`}>
              {allocationPercentage}% Allocated
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                unallocatedTargetBudget >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
              }`}>
                {unallocatedTargetBudget < 0 ? '-' : ''}{sym}{Math.abs(unallocatedTargetBudget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-[#74777d]">
                {unallocatedTargetBudget >= 0 ? 'unallocated' : 'over limit'}
              </span>
            </div>
            {/* Miniature Allocation Progress Bar */}
            <div className="w-full bg-[#f0f4f8] h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  unallocatedTargetBudget < 0 ? 'bg-[#ba1a1a]' : 'bg-[#006397]'
                }`}
                style={{ width: `${Math.min(100, allocationPercentage)}%` }}
              />
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#f0f4f8] text-xs space-y-1">
            <div className="flex justify-between text-[#44474c]">
              <span>Target Budget:</span>
              <span className="font-mono text-[#191c1d] font-bold">{sym}{targetBudget.toLocaleString('en-US')}</span>
            </div>
            <div className="flex justify-between text-[#74777d]">
              <span>Allocated to categories:</span>
              <span className="font-mono font-bold text-[#006397]">{sym}{totalBudgetAllocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Net Daily Available (After 'Others' Deducted) */}
        <div className="bg-white p-5 rounded-2xl border border-[#e1e3e4] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#006397] bg-[#006397]/10 px-2.5 py-1 rounded-full">
              Net Available Per Day
            </span>
            <span className="text-xs text-[#74777d] font-mono">
              Cycle: {cycleInfo.formattedCycleRange} (Day {cycleInfo.elapsedDays}/{cycleInfo.totalDaysInCycle})
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${netDailyAvailablePerDay >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
                {sym}{netDailyAvailablePerDay.toFixed(2)}
              </span>
              <span className="text-xs text-[#74777d]">/day</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#f0f4f8] text-xs space-y-1">
            <div className="flex justify-between text-[#44474c]">
              <span>Gross Target:</span>
              <span className="font-mono text-[#191c1d] font-bold">{sym}{grossDailyTarget.toFixed(2)}/day</span>
            </div>
            <div className="flex justify-between text-[#ba1a1a]">
              <span>Less 'Others' Spent ({sym}{otherSpent.toFixed(0)}):</span>
              <span className="font-mono font-bold">-{sym}{dailyOthersDeduction.toFixed(2)}/day</span>
            </div>
          </div>
        </div>

        {/* Card 3: Rolling Daily Pool Summary */}
        <div className="bg-white p-5 rounded-2xl border border-[#e1e3e4] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#006397] bg-[#006397]/10 px-2.5 py-1 rounded-full">
              Rolling Pool Today
            </span>
            <span className="text-xs text-[#74777d]">
              Base: <strong className="text-[#191c1d] font-mono">{sym}{totalRollingBaseRate.toFixed(2)}/day</strong>
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${totalRollingAvailableToday >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
                {totalRollingAvailableToday >= 0 ? `+${sym}${totalRollingAvailableToday.toFixed(2)}` : `-${sym}${Math.abs(totalRollingAvailableToday).toFixed(2)}`}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#f0f4f8] flex justify-between items-center text-xs">
            <span className="text-[#74777d]">Net after 'Others':</span>
            <span className={`font-mono font-bold ${netRollingAvailableToday >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
              {netRollingAvailableToday >= 0 ? `+${sym}${netRollingAvailableToday.toFixed(2)}` : `-${sym}${Math.abs(netRollingAvailableToday).toFixed(2)}`}
            </span>
          </div>
        </div>
      </section>

      {/* Main Category Budget & Rollover Cards Grid */}
      <section className="bg-white rounded-2xl shadow-ambient p-5 sm:p-6 border border-[#e1e3e4] space-y-6">
        {/* Section Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e1e3e4]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006397]">pie_chart</span>
            <div>
              <h2 className="text-lg font-bold text-[#191c1d]">Category Allocation Rules</h2>
              <p className="text-xs text-[#74777d]">Set individual targets or enable rolling daily pacing per category.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Filter Pills */}
            <div className="bg-[#f0f2f5] p-1 rounded-xl flex items-center gap-1 border border-[#e1e3e4]">
              <button
                type="button"
                onClick={() => setModeFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all ${
                  modeFilter === 'all'
                    ? 'bg-white text-[#006397] shadow-xs'
                    : 'text-[#5c6066] hover:text-[#191c1d]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('rolling')}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                  modeFilter === 'rolling'
                    ? 'bg-[#006397] text-white shadow-xs'
                    : 'text-[#5c6066] hover:text-[#191c1d]'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">timelapse</span>
                Rolling ({rollingCategories.length})
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('standard')}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all ${
                  modeFilter === 'standard'
                    ? 'bg-white text-[#006397] shadow-xs'
                    : 'text-[#5c6066] hover:text-[#191c1d]'
                }`}
              >
                Standard Cap
              </button>
            </div>

            <button
              onClick={() => {
                setEditingCatForModal(null);
                setShowAddCatModal(true);
              }}
              className="px-3 py-1.5 bg-[#006397] text-white font-bold text-xs rounded-xl hover:bg-[#00476e] transition-colors flex items-center gap-1 shadow-xs active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> Add
            </button>
          </div>
        </div>

        {/* 1. INDIVIDUAL CATEGORY ALLOCATION RULES & ROLLING DAILY CARDS */}
        <div>
          <h3 className="text-sm font-extrabold text-[#191c1d] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#006397]" />
            Individually Allocated Categories
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories
              .filter((cat) => {
                if ((cat.type || 'expense') === 'income' || cat.isSystemOther || cat.name.toLowerCase() === 'other' || cat.hasAllocation === false || (cat.budgetLimit ?? 0) <= 0) {
                  return false;
                }
                if (modeFilter === 'rolling') return Boolean(cat.rollingDailyEnabled);
                if (modeFilter === 'standard') return !cat.rollingDailyEnabled;
                return true;
              })
              .map((cat) => {
                const catStats = breakdown.find(
                  (b) => b.category.toLowerCase() === cat.name.toLowerCase()
                );

                const spent = catStats ? catStats.amount : 0;
                const limit = cat.budgetLimit ?? 300;
                const rolloverEnabled = cat.rolloverEnabled ?? true;
                const rolledOverAmount = cat.rolledOverAmount ?? 0;
                const effectiveBudget = limit + (rolloverEnabled ? rolledOverAmount : 0);
                const remaining = effectiveBudget - spent;
                const pct = effectiveBudget > 0 ? Math.min(100, Math.round((spent / effectiveBudget) * 100)) : 0;

                const isRolling = Boolean(cat.rollingDailyEnabled);
                const pacing = getRollingDailyCategoryPacing(
                  cat.name,
                  effectiveBudget,
                  config.paydayAnchorDay,
                  transactions,
                  activeDate
                );

                return (
                  <div
                    key={cat.id}
                    className={`rounded-2xl p-4 flex flex-col justify-between transition-all relative shadow-2xs ${
                      isRolling
                        ? 'bg-gradient-to-b from-[#f0f7fc] to-[#e6f2fa] border-2 border-[#006397]/40 ring-1 ring-[#006397]/20'
                        : 'bg-[#f8f9fa] border border-[#e1e3e4] hover:border-[#c4c6cd]'
                    }`}
                  >
                    {/* Top Bar: Icon, Name & Rolling Toggle */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: `${cat.color || '#006397'}20`, color: cat.color || '#006397' }}
                        >
                          <span className="material-symbols-outlined text-[22px]">{cat.icon || 'shopping_cart'}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-extrabold text-sm text-[#191c1d] truncate">{cat.name}</h3>
                            {isRolling && (
                              <span className="bg-[#006397] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">timelapse</span>
                                Rolling
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#44474c] block">
                            Monthly Budget: <strong className="text-[#191c1d]">{sym}{effectiveBudget.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Mode Toggle Switch (Rolling Daily ON / OFF) */}
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <label className="relative inline-flex items-center cursor-pointer" title="Toggle Rolling Daily Pacing Mode">
                          <input
                            type="checkbox"
                            checked={isRolling}
                            onChange={(e) =>
                              onUpdateCategory(cat.id, { rollingDailyEnabled: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#006397]"></div>
                        </label>
                        <span className="text-[9px] font-extrabold text-[#006397] uppercase tracking-wider">
                          {isRolling ? 'Daily Pacing' : 'Fixed Cap'}
                        </span>
                      </div>
                    </div>

                    {/* ROLLING DAILY PACING VIEW */}
                    {isRolling ? (
                      <div className="my-2 space-y-3">
                        {/* Hero Metric Box: Available to Spend Today */}
                        <div className="bg-white p-3 rounded-xl border border-[#006397]/25 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#006397] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">today</span>
                              Available to Spend Today
                            </span>
                            <span className="text-[10px] font-mono text-[#74777d]">
                              Day {pacing.elapsedDays}/{pacing.totalDaysInCycle}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-0.5">
                            <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                              pacing.availableToSpendToday >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                            }`}>
                              {pacing.availableToSpendToday >= 0
                                ? `+${sym}${pacing.availableToSpendToday.toFixed(2)}`
                                : `-${sym}${Math.abs(pacing.availableToSpendToday).toFixed(2)}`}
                            </span>
                            <span className="text-[11px] font-bold text-[#006397] bg-[#f0f7fc] px-2 py-0.5 rounded-md border border-[#006397]/20">
                              {sym}{pacing.dailyBaseRate.toFixed(2)} / day
                            </span>
                          </div>

                          <p className="text-[10px] text-[#44474c] leading-tight pt-0.5">
                            Target to date: <strong className="text-[#191c1d]">{sym}{pacing.accumulatedTargetToDate.toFixed(2)}</strong> | Logged spend: <strong className="text-[#191c1d]">{sym}{pacing.cycleExpensesLogged.toFixed(2)}</strong>
                          </p>
                        </div>

                        {/* Pacing Breakdown Mini-Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white/70 p-2.5 rounded-xl border border-[#006397]/15">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-[#74777d] block">Daily Base Rate</span>
                            <span className="font-mono font-extrabold text-[#191c1d]">
                              {sym}{pacing.dailyBaseRate.toFixed(2)}/day
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-[#74777d] block">Cycle Progress</span>
                            <span className="font-mono font-extrabold text-[#006397]">
                              Day {pacing.elapsedDays} of {pacing.totalDaysInCycle}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-[#74777d] block">Accumulated Pace</span>
                            <span className="font-mono font-bold text-[#191c1d]">
                              {sym}{pacing.accumulatedTargetToDate.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-[#74777d] block">Cycle Spent</span>
                            <span className="font-mono font-bold text-[#44474c]">
                              {sym}{pacing.cycleExpensesLogged.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar vs Accumulated Target */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-[#44474c] font-medium">
                            <span>Cycle Spend vs Target</span>
                            <span>{pacing.monthlyBudget > 0 ? Math.round((pacing.cycleExpensesLogged / pacing.monthlyBudget) * 100) : 0}% of Monthly</span>
                          </div>
                          <div className="w-full bg-[#e1e3e4] h-2 rounded-full overflow-hidden relative">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                pacing.isOverPace ? 'bg-[#ba1a1a]' : 'bg-[#00a656]'
                              }`}
                              style={{
                                width: `${Math.min(100, pacing.monthlyBudget > 0 ? (pacing.cycleExpensesLogged / pacing.monthlyBudget) * 100 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* STANDARD MONTHLY CAP VIEW */
                      <div className="my-2 space-y-2">
                        {/* Hero Metric Box: Available to Spend */}
                        <div className="bg-white p-3 rounded-xl border border-[#e1e3e4] shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#44474c] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-[#006397]">account_balance_wallet</span>
                              Available to Spend
                            </span>
                            <span className="text-[10px] font-mono text-[#74777d]">
                              Spent: {sym}{spent.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-0.5">
                            <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                              remaining >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                            }`}>
                              {remaining >= 0 ? `+${sym}${remaining.toFixed(2)}` : `-${sym}${Math.abs(remaining).toFixed(2)}`}
                            </span>
                            <span className="text-[11px] font-bold text-[#006397] bg-[#f0f2f5] px-2 py-0.5 rounded-md border border-[#e1e3e4]">
                              {pct}% Used
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-baseline pt-1">
                          <span className="text-xs text-[#44474c]">Target Budget:</span>
                          <div className="text-right">
                            <span className="text-xs font-extrabold text-[#191c1d]">{sym}{limit.toFixed(2)}</span>
                            {baseIncome > 0 && (
                              <span className="text-[10px] font-semibold text-[#006397] block">
                                {((limit / baseIncome) * 100).toFixed(1)}% of income
                              </span>
                            )}
                          </div>
                        </div>

                        {rolloverEnabled && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#44474c] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-[#00a656]">sync_alt</span>
                              Rollover Carry:
                            </span>
                            <span
                              className={`font-bold ${
                                rolledOverAmount >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                              }`}
                            >
                              {rolledOverAmount >= 0 ? `+${sym}${rolledOverAmount.toFixed(2)}` : `-${sym}${Math.abs(rolledOverAmount).toFixed(2)}`}
                            </span>
                          </div>
                        )}

                        <div className="pt-1 border-t border-[#e1e3e4] flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#041627]">Effective Limit:</span>
                          <span className="font-extrabold text-[#006397]">{sym}{effectiveBudget.toFixed(2)}</span>
                        </div>

                        <div className="w-full bg-[#e1e3e4] h-2 rounded-full overflow-hidden my-1">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              remaining < 0 ? 'bg-[#ba1a1a]' : pct >= 80 ? 'bg-[#e06d00]' : 'bg-[#00a656]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer Controls & Actions */}
                    <div className="mt-2 pt-2 border-t border-[#e1e3e4]/60 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {/* Rollover Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer" title="Monthly Rollover Switch">
                          <input
                            type="checkbox"
                            checked={rolloverEnabled}
                            onChange={(e) =>
                              onUpdateCategory(cat.id, { rolloverEnabled: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-7 h-3.5 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#00a656]"></div>
                        </label>
                        <span className="text-[10px] text-[#74777d]">
                          {rolloverEnabled ? 'Rollover' : 'No Rollover'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCatForModal(cat);
                            setShowAddCatModal(true);
                          }}
                          className="p-1 text-[#006397] hover:bg-[#006397]/10 rounded-md transition-colors"
                          title="Edit Category Details, Icon & Color"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {categories.length > 1 && (
                          <button
                            onClick={() => onDeleteCategory(cat.id)}
                            className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-md transition-colors"
                            title="Delete category"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 3. UNALLOCATED CATEGORIES SECTION (IF ANY) */}
        {modeFilter !== 'rolling' && (() => {
          const unallocatedCats = categories.filter(
            (cat) =>
              (cat.type || 'expense') !== 'income' &&
              !cat.isSystemOther &&
              cat.name.toLowerCase() !== 'other' &&
              (cat.hasAllocation === false || (cat.budgetLimit ?? 0) === 0)
          );

          if (unallocatedCats.length === 0) return null;

          return (
            <div className="pt-3 border-t border-[#e1e3e4]">
              <h3 className="text-sm font-extrabold text-[#191c1d] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#74777d]" />
                Categories Without Individual Allocation ({unallocatedCats.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unallocatedCats.map((cat) => {
                  const catStats = breakdown.find(
                    (b) => b.category.toLowerCase() === cat.name.toLowerCase()
                  );
                  const spent = catStats ? catStats.amount : 0;

                  return (
                    <div
                      key={cat.id}
                      className="bg-[#f8f9fa] border border-dashed border-[#c4c6cd] rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-[#006397]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.color || '#74777d'}20`, color: cat.color || '#74777d' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">{cat.icon || 'shopping_cart'}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#191c1d] truncate">{cat.name}</h4>
                          <span className="text-[10px] text-[#74777d] block">
                            Spent: <strong className="text-[#191c1d]">{sym}{spent.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingCatForModal(cat);
                          setShowAddCatModal(true);
                        }}
                        className="px-2.5 py-1 bg-white border border-[#006397]/30 text-[#006397] font-bold text-[11px] rounded-lg hover:bg-[#006397]/10 transition-colors shrink-0"
                      >
                        Add Allocation
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 3. SPECIAL ALLOCATION POOL CARD: "OTHER" (Placed at the bottom of all categories) */}
        {modeFilter !== 'rolling' && (() => {
          const otherCat = categories.find((c) => c.name.toLowerCase() === 'other' || c.isSystemOther) || {
            id: 'cat-other-default',
            name: 'Other',
            icon: 'more_horiz',
            color: '#44474c',
            hasAllocation: true,
            budgetLimit: 300,
            rolloverEnabled: true,
            rolledOverAmount: 0,
            isSystemOther: true,
          };

          const otherStats = breakdown.find((b) => b.isSystemOther || b.category.toLowerCase() === 'other');
          const otherSpent = otherStats ? otherStats.amount : 0;
          const otherLimit = otherCat.budgetLimit ?? 300;
          const otherRollover = otherCat.rolloverEnabled ?? true;
          const otherRolledOver = otherCat.rolledOverAmount ?? 0;
          const otherEffective = otherLimit + (otherRollover ? otherRolledOver : 0);
          const otherRemaining = otherEffective - otherSpent;
          const otherPct = otherEffective > 0 ? Math.min(100, Math.round((otherSpent / otherEffective) * 100)) : 0;
          const unallocatedItems = otherStats?.unallocatedItems || [];

          return (
            <div className="bg-gradient-to-br from-[#f0f4f8] via-[#e8f0fe] to-[#f8f9fa] border-2 border-[#006397]/30 rounded-2xl p-5 shadow-xs relative overflow-hidden mt-4">
              <div className="absolute top-0 right-0 bg-[#006397] text-white text-[10px] uppercase font-extrabold px-3 py-1 rounded-bl-xl tracking-wider">
                Special Allocation Pool
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                    style={{ backgroundColor: otherCat.color || '#44474c' }}
                  >
                    <span className="material-symbols-outlined text-[26px]">{otherCat.icon || 'more_horiz'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-[#191c1d]">"Other" Budget Pool</h3>
                      <span className="bg-[#006397]/15 text-[#006397] text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {sym}{otherLimit.toFixed(0)} Allocated
                      </span>
                    </div>
                    <p className="text-xs text-[#44474c] mt-0.5 max-w-xl">
                      Covers all expenses from unbudgeted categories plus direct 'Other' entries.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    onClick={() => {
                      setEditingCatForModal(otherCat);
                      setShowAddCatModal(true);
                    }}
                    className="px-3 py-1.5 bg-white border border-[#006397]/30 text-[#006397] font-bold text-xs rounded-xl hover:bg-[#006397]/10 transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span> Edit Pool Allocation
                  </button>
                </div>
              </div>

              {/* Other Pool Spending Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/80 backdrop-blur-xs p-3.5 rounded-xl border border-[#006397]/15 my-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#74777d]">Total Pool Spent</span>
                  <p className="text-base font-extrabold text-[#191c1d]">
                    {sym}{otherSpent.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#74777d]">Pool Limit (Target)</span>
                  <p className="text-base font-extrabold text-[#006397]">
                    {sym}{otherEffective.toFixed(2)}
                    {otherRollover && otherRolledOver !== 0 && (
                      <span className={`text-[10px] font-bold ml-1 ${otherRolledOver > 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
                        ({otherRolledOver > 0 ? `+${sym}${otherRolledOver}` : `-${sym}${Math.abs(otherRolledOver)}`})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#74777d]">Pool Allowance Left</span>
                  <p className={`text-base font-extrabold ${otherRemaining < 0 ? 'text-[#ba1a1a]' : 'text-[#00a656]'}`}>
                    {otherRemaining < 0 ? `Over by ${sym}${Math.abs(otherRemaining).toFixed(2)}` : `${sym}${otherRemaining.toFixed(2)} left`}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#e1e3e4] h-2.5 rounded-full overflow-hidden my-2">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    otherRemaining < 0 ? 'bg-[#ba1a1a]' : otherPct >= 80 ? 'bg-[#e06d00]' : 'bg-[#006397]'
                  }`}
                  style={{ width: `${otherPct}%` }}
                />
              </div>

              {/* Contributing Categories Breakdown Chips */}
              <div className="mt-3 pt-3 border-t border-[#006397]/15">
                <span className="text-[11px] font-extrabold text-[#191c1d] uppercase tracking-wider block mb-2">
                  Categories Feeding into "Other" Pool ({unallocatedItems.length})
                </span>

                {unallocatedItems.length === 0 ? (
                  <p className="text-xs text-[#74777d] italic">No unbudgeted category expenses recorded yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {unallocatedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white px-3 py-1.5 rounded-xl border border-[#c4c6cd]/30 shadow-2xs flex items-center gap-2 text-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ color: item.color }}>
                          {item.icon}
                        </span>
                        <span className="font-bold text-[#191c1d]">{item.category}</span>
                        <span className="text-[11px] font-mono text-[#006397] font-extrabold bg-[#006397]/10 px-1.5 py-0.5 rounded-md">
                          {sym}{item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* Bento Grid Layout for Payday Anchor & Fixed Bills */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* 1. Custom Payday Anchor */}
        <div className="md:col-span-4 bg-white rounded-2xl shadow-ambient p-5 flex flex-col justify-between border border-[#e1e3e4] relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#5cb8fd]/20 rounded-full blur-2xl group-hover:bg-[#5cb8fd]/30 transition-colors pointer-events-none"></div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#191c1d]">Payday Anchor</h3>
              <p className="text-xs text-[#44474c] mt-0.5">Cycle reset date (Day of month anchor)</p>
            </div>
            <span className="material-symbols-outlined text-[#006397] opacity-70">calendar_month</span>
          </div>

          <div className="flex items-center gap-4 mt-auto relative z-10">
            <button
              onClick={() => handleDayChange(-1)}
              className="w-10 h-10 rounded-full border border-[#c4c6cd] flex items-center justify-center text-[#44474c] hover:bg-[#f3f4f5] hover:text-[#191c1d] transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>

            <div className="flex-1 flex flex-col items-center justify-center py-3 bg-[#f3f4f5] rounded-xl border border-[#e1e3e4]">
              <span className="text-4xl font-extrabold text-[#006397]">
                {config.paydayAnchorDay}
                <span className="text-base font-semibold text-[#006397]/70 align-top ml-0.5">th</span>
              </span>
            </div>

            <button
              onClick={() => handleDayChange(1)}
              className="w-10 h-10 rounded-full border border-[#c4c6cd] flex items-center justify-center text-[#44474c] hover:bg-[#f3f4f5] hover:text-[#191c1d] transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>

        {/* 2. Fixed Bills Isolation */}
        <div className="md:col-span-8 bg-white rounded-2xl shadow-ambient p-5 border border-[#e1e3e4] flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#e1e3e4]">
            <div>
              <h3 className="text-lg font-bold text-[#191c1d]">Fixed Bills</h3>
              <p className="text-xs text-[#44474c] mt-0.5">Excluded from daily pacing</p>
            </div>
            <button
              onClick={() => setShowAddBillModal(true)}
              className="w-8 h-8 rounded-full bg-[#f3f4f5] flex items-center justify-center text-[#006397] hover:bg-[#e1e3e4] transition-colors"
              title="Add fixed bill"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
            {fixedBills.map((bill) => (
              <div
                key={bill.id}
                className={`flex items-center justify-between p-3 rounded-xl bg-[#f8f9fa] hover:bg-[#f3f4f5] transition-colors group border border-[#e1e3e4] ${
                  !bill.active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-[#44474c] shadow-2xs border border-[#e1e3e4]">
                    <span className="material-symbols-outlined text-lg">{bill.icon || 'receipt'}</span>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold text-[#191c1d] ${!bill.active ? 'line-through' : ''}`}>
                      {bill.name}
                    </p>
                    <p className="text-[10px] text-[#44474c]">{bill.schedule}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#191c1d]">{sym}{bill.amount.toFixed(2)}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bill.active}
                      onChange={() => onToggleFixedBill(bill.id)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#00a656]"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Fixed Bill Modal */}
      {showAddBillModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#041627]/40 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full max-h-[88vh] shadow-2xl border border-[#c4c6cd]/20 flex flex-col my-auto">
            <h3 className="font-bold text-lg text-[#191c1d] mb-4">Add Fixed Commitment</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-[#44474c] font-medium">Bill Name</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Electricity"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f3f4f5] rounded-xl text-sm border border-[#c4c6cd]/20 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-[#44474c] font-medium">Amount ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 15.99"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f3f4f5] rounded-xl text-sm border border-[#c4c6cd]/20 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-[#44474c] font-medium">Schedule</label>
                <input
                  type="text"
                  placeholder="Monthly on 1st"
                  value={billSchedule}
                  onChange={(e) => setBillSchedule(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f3f4f5] rounded-xl text-sm border border-[#c4c6cd]/20 mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateBill}
                className="flex-1 py-2 bg-[#006397] text-white font-medium text-sm rounded-xl hover:bg-[#00476e]"
              >
                Save Bill
              </button>
              <button
                onClick={() => setShowAddBillModal(false)}
                className="flex-1 py-2 bg-[#f3f4f5] text-[#44474c] font-medium text-sm rounded-xl hover:bg-[#e1e3e4]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redesigned Add/Edit Category Modal */}
      <AddCategoryModal
        isOpen={showAddCatModal}
        onClose={() => {
          setShowAddCatModal(false);
          setEditingCatForModal(null);
        }}
        initialCategory={editingCatForModal}
        onSaveCategory={(catData) => {
          if (editingCatForModal) {
            onUpdateCategory(editingCatForModal.id, catData);
          } else {
            onAddCategory(catData);
          }
          setShowAddCatModal(false);
          setEditingCatForModal(null);
        }}
        currencySymbol={sym}
        baseIncome={baseIncome}
        monthlyBudgetGoal={config.monthlyTarget || baseIncome || 3000}
      />
    </div>
  );
};
