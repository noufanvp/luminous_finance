import React, { useState } from 'react';
import { Transaction, CategoryTemplate, BudgetConfig, TabType, BankAccount, FixedBill } from '../types';
import { calculateSummary, getCategoryBreakdown, getAccountBalances } from '../utils/finance';

interface DashboardViewProps {
  transactions: Transaction[];
  categories: CategoryTemplate[];
  config: BudgetConfig;
  accounts?: BankAccount[];
  fixedBills?: FixedBill[];
  setActiveTab: (tab: TabType) => void;
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  categories,
  config,
  accounts = [],
  fixedBills = [],
  setActiveTab,
  currentUser,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [transactionSearch, setTransactionSearch] = useState<string>('');

  // 1. Calculate Summary Metrics
  const summary = calculateSummary(
    transactions,
    config.monthlyTarget,
    config.paydayAnchorDay
  );

  const breakdown = getCategoryBreakdown(transactions, categories);

  // Other vs Allocated breakdown calculation
  const otherStats = breakdown.find((b) => b.isSystemOther || b.category.toLowerCase() === 'other');
  const otherSpent = otherStats ? otherStats.amount : 0;
  const allocatedSpent = breakdown
    .filter((b) => !b.isSystemOther && b.category.toLowerCase() !== 'other')
    .reduce((sum, b) => sum + b.amount, 0);

  const daysLeft = Math.max(1, summary.daysLeft);
  const grossDailyAllowance = Math.max(0, config.monthlyTarget - allocatedSpent) / daysLeft;
  const otherDailyImpact = otherSpent / daysLeft;

  // Currency Symbol
  const sym = config.currencySymbol || '$';

  // Account Balances Metrics (Dynamic real-time balance incorporating income, expenses, and transfers)
  const accountBalancesList = getAccountBalances(accounts, transactions);
  const accountBalancesMap: Record<string, number> = {};
  accountBalancesList.forEach((ab) => {
    accountBalancesMap[ab.id] = ab.currentBalance;
  });

  const liquidAccounts = accounts.filter((a) => !a.excludeFromTotal && a.type !== 'credit');
  const creditAccounts = accounts.filter((a) => !a.excludeFromTotal && a.type === 'credit');

  const totalLiquidCash = liquidAccounts.reduce((sum, a) => sum + (accountBalancesMap[a.id] ?? a.balance), 0);
  const totalCreditDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(accountBalancesMap[a.id] ?? a.balance), 0);
  const totalNetWorth = accounts.length > 0
    ? totalLiquidCash - totalCreditDebt
    : (summary.totalIncome - summary.totalExpenses);

  // SVG Pacing Ring
  const strokeDashArray = 552.92;
  const progressRatio = Math.min(1, Math.max(0, summary.remaining / (summary.monthlyTarget || 1)));
  const strokeDashOffset = strokeDashArray * (1 - progressRatio);

  // Spending Donut Segments
  const activeBreakdown = breakdown.filter((item) => item.amount > 0);
  const totalChartSpent = activeBreakdown.reduce((acc, i) => acc + i.amount, 0);
  const donutCircumference = 2 * Math.PI * 70; // radius = 70 => ~439.82

  let cumulativeOffset = 0;
  const donutSegments = activeBreakdown.map((item) => {
    const fraction = totalChartSpent > 0 ? item.amount / totalChartSpent : 0;
    const strokeDash = fraction * donutCircumference;
    const offset = cumulativeOffset;
    cumulativeOffset += strokeDash;
    return {
      ...item,
      fraction,
      percentageOfTotal: Math.round(fraction * 100),
      strokeDash,
      offset,
    };
  });

  // Health Stats
  const overBudgetCnt = breakdown.filter((item) => item.isOverBudget).length;
  const nearLimitCnt = breakdown.filter((item) => !item.isOverBudget && item.percentage >= 75).length;
  const onTrackCnt = breakdown.filter((item) => !item.isOverBudget && item.percentage < 75).length;
  const netRolloverTotal = breakdown.reduce((acc, item) => acc + (item.rolloverEnabled ? item.rolledOverAmount : 0), 0);

  // Recent Transactions (sorted by date descending)
  const recentTransactions = [...transactions]
    .filter((t) => {
      const matchCat = selectedCategoryFilter === 'all' || t.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      const matchSearch = !transactionSearch || t.title.toLowerCase().includes(transactionSearch.toLowerCase()) || t.category.toLowerCase().includes(transactionSearch.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Active / Upcoming Bills
  const activeBills = fixedBills.filter((b) => b.active);
  const totalFixedBillsCost = activeBills.reduce((sum, b) => sum + b.amount, 0);

  // Top spending category
  const topCategory = activeBreakdown.length > 0
    ? [...activeBreakdown].sort((a, b) => b.amount - a.amount)[0]
    : null;

  // Pacing status calculation
  const targetSpentSoFarRatio = (30 - daysLeft) / 30;
  const actualSpentRatio = summary.monthlyTarget > 0 ? summary.totalExpenses / summary.monthlyTarget : 0;
  const isVelocityHigh = summary.dailyAllowance < 30 || actualSpentRatio > (targetSpentSoFarRatio + 0.15);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-5 sm:gap-6">
      {/* ==================== TOP KEY METRICS CARDS GRID ==================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Net Worth / Balance */}
        <div
          onClick={() => setActiveTab('accounts')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e1e3e4] shadow-2xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <span className="text-[11px] font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{accounts.length || 1} Accounts</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-[#44474c] uppercase tracking-wider block">Net Account Liquidity</span>
          <p className={`text-xl sm:text-2xl font-extrabold mt-1 tracking-tight ${totalNetWorth < 0 ? 'text-[#ba1a1a]' : 'text-[#041627]'}`}>
            {totalNetWorth < 0 ? '-' : ''}{sym}{Math.abs(totalNetWorth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#74777d] mt-2 pt-2 border-t border-[#f0f4f8]">
            <span>Cash: <strong className="text-[#00a656]">{sym}{totalLiquidCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            {totalCreditDebt > 0 && (
              <span>Credit: <strong className="text-[#ba1a1a]">-{sym}{totalCreditDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            )}
          </div>
        </div>

        {/* Metric 2: Monthly Budget Pacing */}
        <div
          onClick={() => setActiveTab('budgets')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e1e3e4] shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#00a656]/10 text-[#00a656] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">pie_chart</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              summary.remaining > 300 ? 'bg-[#00a656]/10 text-[#00a656]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
            }`}>
              {Math.round((summary.totalExpenses / (summary.monthlyTarget || 1)) * 100)}% Spent
            </span>
          </div>
          <span className="text-xs font-semibold text-[#44474c] uppercase tracking-wider block">Monthly Target Remaining</span>
          <p className="text-xl sm:text-2xl font-extrabold text-[#041627] mt-1 tracking-tight">
            {sym}{summary.remaining.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <div className="w-full bg-[#f0f4f8] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summary.remaining < 300 ? 'bg-[#ba1a1a]' : 'bg-[#00a656]'
              }`}
              style={{ width: `${Math.min(100, Math.round((summary.totalExpenses / (summary.monthlyTarget || 1)) * 100))}%` }}
            ></div>
          </div>
        </div>

        {/* Metric 3: Smart Daily Allowance */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e1e3e4] shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#008243]/10 text-[#008243] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">event_repeat</span>
            </div>
            <span className="text-[11px] font-bold text-[#008243] bg-[#008243]/10 px-2 py-0.5 rounded-full">
              {daysLeft} Days Left
            </span>
          </div>
          <span className="text-xs font-semibold text-[#44474c] uppercase tracking-wider block">Smart Daily Allowance</span>
          <p className="text-xl sm:text-2xl font-extrabold text-[#00a656] mt-1 tracking-tight">
            {sym}{summary.dailyAllowance.toFixed(2)}<span className="text-xs font-normal text-[#44474c]"> / day</span>
          </p>
          <div className="text-[11px] text-[#44474c] mt-2 pt-2 border-t border-[#f0f4f8] flex justify-between items-center">
            <span>Payday anchor: <strong>{config.paydayAnchorDay}th</strong></span>
            <span className="text-[10px] text-[#006397] font-semibold">Auto-calculated</span>
          </div>
        </div>

        {/* Metric 4: Pacing Health Status */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e1e3e4] shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isVelocityHigh ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]' : 'bg-[#00a656]/10 text-[#00a656]'
            }`}>
              <span className="material-symbols-outlined text-[20px]">
                {isVelocityHigh ? 'speed' : 'verified_user'}
              </span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isVelocityHigh ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]' : 'bg-[#00a656]/10 text-[#00a656]'
            }`}>
              {isVelocityHigh ? 'High Velocity' : 'Safe Pace'}
            </span>
          </div>
          <span className="text-xs font-semibold text-[#44474c] uppercase tracking-wider block">Spending Health</span>
          <p className={`text-xl sm:text-2xl font-extrabold mt-1 tracking-tight ${
            isVelocityHigh ? 'text-[#ba1a1a]' : 'text-[#00a656]'
          }`}>
            {isVelocityHigh ? 'Pacing Alert' : 'On Track'}
          </p>
          <div className="text-[11px] text-[#44474c] mt-2 pt-2 border-t border-[#f0f4f8] flex justify-between items-center">
            <span>{overBudgetCnt} Over Budget</span>
            <span>{onTrackCnt} On Track</span>
          </div>
        </div>
      </section>

      {/* ==================== MAIN DASHBOARD CONTENT HUB (12-COL GRID) ==================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* LEFT COLUMN (7 COLS ON DESKTOP): PACING, BREAKDOWN & FIXED BILLS */}
        <div className="xl:col-span-7 flex flex-col gap-5 sm:gap-6">
          
          {/* 1. Smart Daily Allowance & Pacing Visualizer Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[#e1e3e4] flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0f4f8] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006397] text-[20px]">donut_large</span>
                  <span>Pacing Progress & Daily Engine</span>
                </h2>
                <p className="text-xs text-[#44474c] mt-0.5">Real-time daily burn rate vs payday anchor</p>
              </div>
              <button
                onClick={() => setActiveTab('budgets')}
                className="self-start sm:self-auto text-xs font-bold text-[#006397] bg-[#006397]/10 hover:bg-[#006397]/20 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
              >
                <span>Target Rules</span>
                <span className="material-symbols-outlined text-[14px]">tune</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* SVG Ring Gauge */}
              <div className="flex flex-col items-center justify-center p-2 relative">
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                  <svg className="progress-ring w-full h-full" viewBox="0 0 192 192">
                    <circle
                      cx="96"
                      cy="96"
                      fill="transparent"
                      r="88"
                      stroke="#f0f4f8"
                      strokeWidth="12"
                    />
                    <circle
                      className="progress-ring-circle"
                      cx="96"
                      cy="96"
                      fill="transparent"
                      r="88"
                      stroke={summary.remaining > 500 ? "#00a656" : "#ba1a1a"}
                      strokeWidth="12"
                      strokeDasharray={strokeDashArray}
                      strokeDashoffset={strokeDashOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center p-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#041627]">
                      {sym}{summary.remaining.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[11px] text-[#44474c] font-medium mt-0.5">
                      remaining of {sym}{summary.monthlyTarget.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Allowance Math Breakdown Card */}
              <div className="bg-[#f8f9fa] rounded-2xl p-4 border border-[#e1e3e4] flex flex-col justify-between gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-[#041627] uppercase tracking-wider">Allowance Math</span>
                  <span className="text-[10px] font-bold text-[#00a656] bg-[#00a656]/15 px-2 py-0.5 rounded-full">
                    Active Cycle
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[#44474c]">
                    <span>Gross Daily Target:</span>
                    <span className="font-mono font-bold text-[#041627]">{sym}{grossDailyAllowance.toFixed(2)}/day</span>
                  </div>
                  <div className="flex justify-between items-center text-[#ba1a1a]">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[13px]">remove_circle_outline</span>
                      'Others' Category ({sym}{otherSpent.toFixed(2)}):
                    </span>
                    <span className="font-mono font-bold">-{sym}{otherDailyImpact.toFixed(2)}/day</span>
                  </div>
                  <div className="flex justify-between items-center font-extrabold text-[#00a656] pt-2 border-t border-[#e1e3e4]">
                    <span>Net Available Per Day:</span>
                    <span className="font-mono text-sm">{sym}{summary.dailyAllowance.toFixed(2)}/day</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e1e3e4] flex items-center justify-between text-[11px] text-[#44474c]">
                  <span>Payday in: <strong>{daysLeft} days</strong></span>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="text-[#006397] font-bold hover:underline flex items-center gap-0.5"
                  >
                    + Add Transaction
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Interactive Category Budgets & Rollover Leaderboard */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[#e1e3e4] flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0f4f8] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006397] text-[20px]">category</span>
                  <span>Category Budgets & Rollover</span>
                </h2>
                <p className="text-xs text-[#44474c] mt-0.5">Budget allocations, surpluses, and category burn rates</p>
              </div>

              {/* Category Health Indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#00a656]/15 text-[#00a656] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  {onTrackCnt} On Track
                </span>
                {nearLimitCnt > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#e06d00]/15 text-[#e06d00] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">warning</span>
                    {nearLimitCnt} Near Limit
                  </span>
                )}
                {overBudgetCnt > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#ba1a1a]/15 text-[#ba1a1a] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">error</span>
                    {overBudgetCnt} Over
                  </span>
                )}
              </div>
            </div>

            {/* Donut Distribution + Category Progress Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Donut Chart & Legend (5 Cols) */}
              <div className="lg:col-span-5 bg-[#f8f9fa] rounded-2xl p-4 border border-[#e1e3e4] flex flex-col items-center gap-3">
                <span className="text-xs font-bold text-[#041627] uppercase tracking-wider w-full text-left">Spending Breakdown</span>
                
                {/* SVG Donut */}
                <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center my-1">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                    <circle
                      cx="90"
                      cy="90"
                      r="70"
                      fill="none"
                      stroke="#e1e3e4"
                      strokeWidth="18"
                    />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="90"
                        cy="90"
                        r="70"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="18"
                        strokeDasharray={`${seg.strokeDash} ${donutCircumference - seg.strokeDash}`}
                        strokeDashoffset={-seg.offset}
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                    <span className="text-[10px] font-bold text-[#74777d] uppercase tracking-wider">Total Spent</span>
                    <span className="text-lg font-extrabold text-[#041627] my-0.5">
                      {sym}{summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-[#44474c]">
                      of {sym}{summary.monthlyTarget.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                {/* Rollover Surpluses Badge */}
                <div className="w-full bg-white p-2.5 rounded-xl border border-[#e1e3e4] flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#44474c]">Rollover Net Surpluses:</span>
                  <span className={`font-mono font-bold flex items-center gap-0.5 ${
                    netRolloverTotal >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">sync_alt</span>
                    {netRolloverTotal >= 0 ? `+${sym}${netRolloverTotal.toFixed(2)}` : `-${sym}${Math.abs(netRolloverTotal).toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Progress Bars Leaderboard (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-2.5">
                {breakdown.length === 0 ? (
                  <p className="text-xs text-[#74777d] italic py-4 text-center">No category budgets logged yet.</p>
                ) : (
                  breakdown.map((item, idx) => {
                    const isOver = item.isOverBudget;
                    const isNearLimit = !isOver && item.percentage >= 75;

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#f8f9fa] border border-[#e1e3e4] hover:bg-[#f0f4f8] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${item.color}18`, color: item.color }}
                            >
                              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                            </div>
                            <span className="text-xs font-bold text-[#041627] truncate">{item.category}</span>
                            {item.rolloverEnabled && item.rolledOverAmount !== 0 && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 ${
                                item.rolledOverAmount > 0 ? 'bg-[#00a656]/15 text-[#00a656]' : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
                              }`}>
                                <span className="material-symbols-outlined text-[10px]">sync_alt</span>
                                {item.rolledOverAmount > 0 ? `+${sym}${item.rolledOverAmount}` : `-${sym}${Math.abs(item.rolledOverAmount)}`}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                              item.remainingCategoryBudget >= 0 ? 'bg-[#00a656]/15 text-[#00a656]' : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
                            }`}>
                              {item.remainingCategoryBudget >= 0 ? `+${sym}${item.remainingCategoryBudget.toFixed(2)}` : `-${sym}${Math.abs(item.remainingCategoryBudget).toFixed(2)}`}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[#e1e3e4] h-1.5 rounded-full overflow-hidden my-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? 'bg-[#ba1a1a]' : isNearLimit ? 'bg-[#e06d00]' : 'bg-[#006397]'
                            }`}
                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-[#44474c] mt-0.5 font-medium">
                          <span>
                            Spent: {sym}{item.amount.toFixed(2)} / {sym}{item.effectiveBudget.toFixed(0)}
                          </span>
                          <span className={isOver ? 'text-[#ba1a1a] font-bold' : isNearLimit ? 'text-[#e06d00] font-bold' : 'text-[#00a656]'}>
                            {item.percentage}% used
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. Fixed Bills & Recurring Subscriptions Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[#e1e3e4] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#f0f4f8] pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006397] text-[20px]">calendar_today</span>
                  <span>Fixed Obligations & Subscriptions</span>
                </h2>
                <p className="text-xs text-[#44474c] mt-0.5">Recurring monthly bills committed</p>
              </div>
              <span className="text-xs font-bold text-[#006397] bg-[#006397]/10 px-2.5 py-1 rounded-full">
                {sym}{totalFixedBillsCost.toLocaleString()} / mo
              </span>
            </div>

            {activeBills.length === 0 ? (
              <p className="text-xs text-[#74777d] italic py-2">No fixed bills configured.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#e1e3e4] flex items-center gap-3 hover:border-[#006397]/40 transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">{bill.icon || 'receipt'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[#041627] truncate">{bill.name}</h4>
                      <p className="text-[11px] font-extrabold text-[#00a656] font-mono mt-0.5">
                        {sym}{bill.amount.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#44474c] bg-white px-2 py-0.5 rounded-md border border-[#e1e3e4] shrink-0">
                      {bill.schedule}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (5 COLS ON DESKTOP): ACCOUNTS, RECENT ACTIVITY & COACHING */}
        <div className="xl:col-span-5 flex flex-col gap-5 sm:gap-6">
          
          {/* 1. Linked Accounts Quick Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[#e1e3e4] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#f0f4f8] pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006397] text-[20px]">account_balance</span>
                  <span>Accounts Overview</span>
                </h2>
                <p className="text-xs text-[#44474c] mt-0.5">Active bank accounts and balances</p>
              </div>
              <button
                onClick={() => setActiveTab('accounts')}
                className="text-xs font-bold text-[#006397] hover:underline flex items-center gap-0.5"
              >
                <span>Manage</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            {accounts.length === 0 ? (
              <p className="text-xs text-[#74777d] italic py-2">No bank accounts linked yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {accounts.map((acc) => {
                  const currentBal = accountBalancesMap[acc.id] ?? acc.balance;
                  const isCredit = acc.type === 'credit';
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setActiveTab('accounts')}
                      className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#e1e3e4] hover:bg-[#f0f4f8] transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: acc.color || '#006397' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">{acc.icon || 'account_balance'}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#041627] truncate">{acc.name}</h4>
                          <span className="text-[10px] text-[#44474c] font-medium capitalize block">
                            {acc.institution ? `${acc.institution} • ` : ''}{acc.type}
                            {acc.excludeFromTotal && ' • Excluded'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs sm:text-sm font-extrabold font-mono block ${
                          isCredit ? 'text-[#ba1a1a]' : currentBal < 0 ? 'text-[#ba1a1a]' : 'text-[#041627]'
                        }`}>
                          {isCredit && currentBal > 0 ? '-' : ''}{currentBal < 0 ? '-' : ''}{sym}{Math.abs(currentBal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Recent Transactions Activity Feed */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xs border border-[#e1e3e4] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0f4f8] pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#041627] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006397] text-[20px]">receipt_long</span>
                  <span>Recent Activity</span>
                </h2>
                <p className="text-xs text-[#44474c] mt-0.5">Latest transactions logged in ledger</p>
              </div>
              <button
                onClick={() => setActiveTab('ledger')}
                className="self-start sm:self-auto text-xs font-bold text-[#006397] bg-[#006397]/10 hover:bg-[#006397]/20 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <input
                type="text"
                placeholder="Search recent..."
                value={transactionSearch}
                onChange={(e) => setTransactionSearch(e.target.value)}
                className="text-xs bg-[#f0f4f8] border border-[#e1e3e4] rounded-xl px-3 py-1.5 text-[#041627] focus:outline-none focus:ring-1 focus:ring-[#006397] min-w-[120px] flex-1"
              />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs bg-[#f0f4f8] border border-[#e1e3e4] rounded-xl px-2.5 py-1.5 text-[#041627] focus:outline-none focus:ring-1 focus:ring-[#006397] shrink-0"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {recentTransactions.length === 0 ? (
              <p className="text-xs text-[#74777d] italic py-4 text-center">No transactions match search criteria.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#e1e3e4] flex items-center justify-between gap-3 hover:bg-[#f0f4f8] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-[#00a656]/15 text-[#00a656]'
                            : tx.isTransfer
                            ? 'bg-[#006397]/15 text-[#006397]'
                            : 'bg-[#ba1a1a]/15 text-[#ba1a1a]'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">
                            {isIncome ? 'arrow_downward' : tx.isTransfer ? 'sync_alt' : 'arrow_upward'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#041627] truncate">{tx.title}</h4>
                          <span className="text-[10px] text-[#44474c] font-medium block truncate">
                            {tx.category} • {tx.date}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs sm:text-sm font-extrabold font-mono block ${
                          isIncome ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                        }`}>
                          {isIncome ? '+' : '-'}{sym}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Smart Financial Insights & Coaching */}
          <div className="bg-[#eef5fc] border border-[#d2e4fb] rounded-3xl p-5 shadow-2xs relative overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#006397] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#041627]">Luminous Assistant Insight</h3>
                <span className="text-[10px] text-[#006397] font-semibold">Real-Time Pacing Engine</span>
              </div>
            </div>

            <p className="text-xs text-[#041627] leading-relaxed font-medium">
              {isVelocityHigh ? (
                <>
                  ⚡ Your current daily spending rate is running above your safe daily allowance. Consider prioritizing essential categories and limiting 'Other' expenses to maintain your target before payday on the <strong>{config.paydayAnchorDay}th</strong>.
                </>
              ) : topCategory ? (
                <>
                  ✅ Great job! Your pacing is well within target. Your highest expense category this cycle is <strong>{topCategory.category}</strong> ({sym}{topCategory.amount.toFixed(0)}). Your available balance per day is <strong className="text-[#008243]">{sym}{summary.dailyAllowance.toFixed(2)}/day</strong>.
                </>
              ) : (
                <>
                  💡 Welcome to your financial dashboard. Log expenses as they occur to keep your smart daily allowance and pacing metrics completely accurate.
                </>
              )}
            </p>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setActiveTab('reports')}
                className="text-xs font-bold text-[#006397] hover:underline flex items-center gap-1"
              >
                <span>View Full Pacing Report</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
