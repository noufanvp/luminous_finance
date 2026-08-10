import { Transaction, CategoryTemplate, BankAccount } from '../types';

export function calculateSummary(
  transactions: Transaction[],
  monthlyTarget: number,
  paydayAnchorDay: number
) {
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense' && !t.isTransfer)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter((t) => t.type === 'income' && !t.isTransfer)
    .reduce((sum, t) => sum + t.amount, 0);

  const remaining = Math.max(0, monthlyTarget - totalExpenses);

  // Calculate days left until payday anchor
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  let daysLeft = 0;
  if (currentDay <= paydayAnchorDay) {
    daysLeft = paydayAnchorDay - currentDay + 1;
  } else {
    daysLeft = (daysInMonth - currentDay) + paydayAnchorDay + 1;
  }

  daysLeft = Math.max(1, daysLeft);
  const dailyAllowance = Math.round((remaining / daysLeft) * 100) / 100;

  return {
    totalExpenses,
    totalIncome,
    remaining,
    monthlyTarget,
    daysLeft,
    dailyAllowance,
  };
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
  hasAllocation: boolean;
  budgetLimit: number;
  rolloverEnabled: boolean;
  rolledOverAmount: number;
  effectiveBudget: number;
  remainingCategoryBudget: number;
  isOverBudget: boolean;
  isSystemOther?: boolean;
  unallocatedItems?: { category: string; amount: number; icon: string; color: string }[];
}

export function getCategoryBreakdown(
  transactions: Transaction[],
  categories: CategoryTemplate[]
): CategoryBreakdown[] {
  const expenses = transactions.filter((t) => t.type === 'expense' && !t.isTransfer);
  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Find or default 'Other' category template
  const otherCatTemplate = categories.find(
    (c) => c.name.toLowerCase() === 'other' || c.isSystemOther
  ) || {
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

  // Helper to check if a category template has an active allocation
  const isAllocatedCat = (catTemplate?: CategoryTemplate) => {
    if (!catTemplate) return false;
    if ((catTemplate.type || 'expense') === 'income') return false;
    if (catTemplate.name.toLowerCase() === 'other' || catTemplate.isSystemOther) return false;
    if (catTemplate.hasAllocation === false) return false;
    return (catTemplate.budgetLimit ?? 0) > 0;
  };

  const allocatedMap: Record<string, number> = {};
  const unallocatedMap: Record<string, number> = {};
  let otherPoolSpent = 0;

  expenses.forEach((t) => {
    const rawCat = (t.category || 'Other').trim();
    const matched = categories.find((c) => c.name.toLowerCase() === rawCat.toLowerCase());

    if (matched && isAllocatedCat(matched)) {
      allocatedMap[matched.name] = (allocatedMap[matched.name] || 0) + t.amount;
    } else {
      // Belongs to unallocated category or 'Other' -> Count on "Other" allocation
      otherPoolSpent += t.amount;
      unallocatedMap[rawCat] = (unallocatedMap[rawCat] || 0) + t.amount;
    }
  });

  const iconMap: Record<string, string> = {
    'Rent': 'home',
    'Food': 'restaurant',
    'Dining': 'restaurant',
    'Dining Out': 'local_dining',
    'Groceries': 'shopping_cart',
    'Transport': 'commute',
    'Health': 'health_and_safety',
    'Clothing': 'checkroom',
    'Salary': 'payments',
    'Other': 'more_horiz'
  };

  const colorMap: Record<string, string> = {
    'Rent': '#006397',
    'Food': '#5cb8fd',
    'Dining': '#5cb8fd',
    'Dining Out': '#5cb8fd',
    'Groceries': '#00476e',
    'Transport': '#74777d',
    'Health': '#00a656',
    'Clothing': '#92ccff',
    'Other': '#44474c'
  };

  const result: CategoryBreakdown[] = [];

  // 1. Process Allocated Categories
  categories.forEach((cat) => {
    if ((cat.type || 'expense') === 'income') return;
    if (cat.name.toLowerCase() === 'other' || cat.isSystemOther) return;
    const hasAlloc = cat.hasAllocation !== false && (cat.budgetLimit ?? 0) > 0;
    if (!hasAlloc) return; // skip unallocated here, handled below

    const spent = allocatedMap[cat.name] || 0;
    const limit = cat.budgetLimit ?? 300;
    const rolloverEnabled = cat.rolloverEnabled ?? true;
    const rolledOverAmount = cat.rolledOverAmount ?? 0;
    const effectiveBudget = limit + (rolloverEnabled ? rolledOverAmount : 0);
    const remainingCategoryBudget = effectiveBudget - spent;
    const isOverBudget = remainingCategoryBudget < 0;
    const percentage = effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : 0;

    result.push({
      category: cat.name,
      amount: spent,
      percentage,
      icon: cat.icon || iconMap[cat.name] || 'shopping_bag',
      color: cat.color || colorMap[cat.name] || '#006397',
      hasAllocation: true,
      budgetLimit: limit,
      rolloverEnabled,
      rolledOverAmount,
      effectiveBudget,
      remainingCategoryBudget,
      isOverBudget,
      isSystemOther: false,
    });
  });

  // 2. Process Special 'Other' Category Allocation
  const otherLimit = otherCatTemplate.hasAllocation !== false ? (otherCatTemplate.budgetLimit ?? 300) : 0;
  const otherRolloverEnabled = otherCatTemplate.rolloverEnabled ?? true;
  const otherRolledOverAmount = otherCatTemplate.rolledOverAmount ?? 0;
  const otherEffectiveBudget = otherLimit + (otherRolloverEnabled ? otherRolledOverAmount : 0);
  const otherRemaining = otherEffectiveBudget - otherPoolSpent;
  const otherIsOver = otherEffectiveBudget > 0 ? otherRemaining < 0 : false;
  const otherPercentage = otherEffectiveBudget > 0 ? Math.round((otherPoolSpent / otherEffectiveBudget) * 100) : 0;

  // Build list of unallocated items for breakdown drilldown
  const unallocatedNames = Array.from(
    new Set([
      ...categories
        .filter(
          (c) =>
            (c.type || 'expense') !== 'income' &&
            (c.hasAllocation === false || (c.budgetLimit ?? 0) === 0)
        )
        .map((c) => c.name),
      ...Object.keys(unallocatedMap),
    ])
  );

  const unallocatedItems = unallocatedNames.map((name) => {
    const matched = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return {
      category: name,
      amount: unallocatedMap[name] || 0,
      icon: matched?.icon || iconMap[name] || 'more_horiz',
      color: matched?.color || colorMap[name] || '#44474c',
    };
  });

  result.push({
    category: otherCatTemplate.name,
    amount: otherPoolSpent,
    percentage: otherPercentage,
    icon: otherCatTemplate.icon || 'more_horiz',
    color: otherCatTemplate.color || '#44474c',
    hasAllocation: otherCatTemplate.hasAllocation !== false && otherLimit > 0,
    budgetLimit: otherLimit,
    rolloverEnabled: otherRolloverEnabled,
    rolledOverAmount: otherRolledOverAmount,
    effectiveBudget: otherEffectiveBudget,
    remainingCategoryBudget: otherRemaining,
    isOverBudget: otherIsOver,
    isSystemOther: true,
    unallocatedItems,
  });

  // 3. Process Unallocated Categories (for category view rendering)
  unallocatedNames.forEach((name) => {
    if (name.toLowerCase() === 'other') return;
    const matched = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (matched && (matched.type || 'expense') === 'income') return;
    const spent = unallocatedMap[name] || 0;

    result.push({
      category: name,
      amount: spent,
      percentage: totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0,
      icon: matched?.icon || iconMap[name] || 'more_horiz',
      color: matched?.color || colorMap[name] || '#44474c',
      hasAllocation: false,
      budgetLimit: 0,
      rolloverEnabled: false,
      rolledOverAmount: 0,
      effectiveBudget: 0,
      remainingCategoryBudget: 0,
      isOverBudget: false,
      isSystemOther: false,
    });
  });

  return result.sort((a, b) => b.amount - a.amount);
}

export interface BillingCycleInfo {
  cycleStartDate: Date;
  cycleEndDate: Date;
  totalDaysInCycle: number; // N
  elapsedDays: number;      // d_cycle
  daysRemainingInCycle: number;
  formattedCycleRange: string;
}

export function parseTransactionDate(dateStr: string): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const lower = (dateStr || '').toLowerCase().trim();

  if (lower === 'today' || !lower) return now;
  if (lower === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const daysAgoMatch = lower.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  return now;
}

export function getBillingCycleInfo(paydayAnchorDay: number, referenceDate: Date = new Date()): BillingCycleInfo {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const day = ref.getDate();

  let startYear = year;
  let startMonth = month;

  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const actualAnchorDay = Math.min(paydayAnchorDay, daysInCurrentMonth);

  if (day < actualAnchorDay) {
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
  }

  const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const startAnchorDay = Math.min(paydayAnchorDay, daysInStartMonth);
  const cycleStartDate = new Date(startYear, startMonth, startAnchorDay, 0, 0, 0, 0);

  let nextMonth = startMonth + 1;
  let nextYear = startYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear = startYear + 1;
  }
  const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
  const nextAnchorDay = Math.min(paydayAnchorDay, daysInNextMonth);
  const nextAnchorDate = new Date(nextYear, nextMonth, nextAnchorDay, 0, 0, 0, 0);

  const cycleEndDate = new Date(nextAnchorDate);
  cycleEndDate.setDate(cycleEndDate.getDate() - 1);
  cycleEndDate.setHours(23, 59, 59, 999);

  const totalDaysInCycle = Math.max(1, Math.round((nextAnchorDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const diffTime = ref.getTime() - cycleStartDate.getTime();
  const elapsedDays = Math.min(totalDaysInCycle, Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1));
  const daysRemainingInCycle = Math.max(0, totalDaysInCycle - elapsedDays);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedCycleRange = `${monthNames[cycleStartDate.getMonth()]} ${cycleStartDate.getDate()} – ${monthNames[cycleEndDate.getMonth()]} ${cycleEndDate.getDate()}`;

  return {
    cycleStartDate,
    cycleEndDate,
    totalDaysInCycle,
    elapsedDays,
    daysRemainingInCycle,
    formattedCycleRange,
  };
}

export interface RollingDailyPacingInfo {
  categoryName: string;
  monthlyBudget: number;
  totalDaysInCycle: number;
  elapsedDays: number;
  daysRemainingInCycle: number;
  dailyBaseRate: number;
  accumulatedTargetToDate: number;
  cycleExpensesLogged: number;
  availableToSpendToday: number;
  isOverPace: boolean;
  formattedCycleRange: string;
}

export function getRollingDailyCategoryPacing(
  categoryName: string,
  monthlyBudget: number,
  paydayAnchorDay: number,
  transactions: Transaction[],
  referenceDate: Date = new Date()
): RollingDailyPacingInfo {
  const cycleInfo = getBillingCycleInfo(paydayAnchorDay, referenceDate);
  const N = cycleInfo.totalDaysInCycle;
  const d_cycle = cycleInfo.elapsedDays;

  const startMs = cycleInfo.cycleStartDate.getTime();
  const endMs = cycleInfo.cycleEndDate.getTime();

  const cycleExpensesLogged = transactions
    .filter((t) => {
      if (t.type !== 'expense') return false;
      const tCat = (t.category || '').trim().toLowerCase();
      if (tCat !== categoryName.trim().toLowerCase()) return false;
      const tDate = parseTransactionDate(t.date).getTime();
      return tDate >= startMs && tDate <= endMs;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const dailyBaseRate = N > 0 ? monthlyBudget / N : 0;
  const accumulatedTargetToDate = dailyBaseRate * d_cycle;
  const availableToSpendToday = accumulatedTargetToDate - cycleExpensesLogged;
  const isOverPace = availableToSpendToday < 0;

  return {
    categoryName,
    monthlyBudget,
    totalDaysInCycle: N,
    elapsedDays: d_cycle,
    daysRemainingInCycle: cycleInfo.daysRemainingInCycle,
    dailyBaseRate,
    accumulatedTargetToDate,
    cycleExpensesLogged,
    availableToSpendToday,
    isOverPace,
    formattedCycleRange: cycleInfo.formattedCycleRange,
  };
}

export interface AccountBalanceInfo extends BankAccount {
  currentBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  transfersInTotal: number;
  transfersOutTotal: number;
}

export function getAccountBalances(
  accounts: BankAccount[],
  transactions: Transaction[]
): AccountBalanceInfo[] {
  if (!accounts || accounts.length === 0) return [];

  const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];

  return accounts.map((acc) => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let transfersInTotal = 0;
    let transfersOutTotal = 0;

    transactions.forEach((t) => {
      // If transaction has explicit accountId matching this account
      // Or if transaction has no accountId, attribute to default account
      const isForThisAcc = t.accountId === acc.id || (!t.accountId && acc.id === defaultAcc.id);

      if (t.isTransfer || t.type === 'transfer') {
        if (t.accountId === acc.id) {
          transfersOutTotal += t.amount;
        }
        if (t.toAccountId === acc.id) {
          transfersInTotal += t.amount;
        }
      } else if (t.type === 'income' && isForThisAcc) {
        incomeTotal += t.amount;
      } else if (t.type === 'expense' && isForThisAcc) {
        expenseTotal += t.amount;
      }
    });

    const currentBalance = acc.balance + incomeTotal - expenseTotal + transfersInTotal - transfersOutTotal;

    return {
      ...acc,
      currentBalance,
      incomeTotal,
      expenseTotal,
      transfersInTotal,
      transfersOutTotal,
    };
  });
}

