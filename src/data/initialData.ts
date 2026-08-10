import { Transaction, FixedBill, CategoryTemplate, BudgetConfig, BankAccount } from '../types';

export const INITIAL_CONFIG: BudgetConfig = {
  monthlyTarget: 3000,
  paydayAnchorDay: 25,
  smartBufferActive: true,
  userAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0n075ADJHg4CURsbHX5o2QOxKEDSslqRBT0tWx5_kMteB71gMhnsI77SO3zGr3rlr7ItpdACDi7__Rhxe2JoL9U3GM1pgjS90gEK1cGvJgQwsUMonR-SxaPMZoAbYL4GAL7d3-oUFdmSlTjeyriiblvSswzfETzU5k2jhKHSCuIjrGrOwBmLN7C9eMv1MifKdz-tob59-i__DawGzIC_CO_KbzMvfqA2DV4v9drW9QPIT_ld4e5B5",
  userName: "User",
  currencySymbol: "$",
  currencyCode: "USD"
};

export const INITIAL_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-1',
    name: 'Primary Checking',
    type: 'checking',
    balance: 0,
    color: '#006397',
    icon: 'account_balance',
    isDefault: true,
  },
  {
    id: 'acc-2',
    name: 'Savings Account',
    type: 'savings',
    balance: 0,
    color: '#00a656',
    icon: 'savings',
  },
  {
    id: 'acc-3',
    name: 'Credit Card',
    type: 'credit',
    balance: 0,
    color: '#e11d48',
    icon: 'credit_card',
  },
  {
    id: 'acc-4',
    name: 'Cash Wallet',
    type: 'cash',
    balance: 0,
    color: '#d97706',
    icon: 'payments',
  },
];

export const INITIAL_CATEGORIES: CategoryTemplate[] = [
  // Expense Categories
  { id: 'cat-1', name: 'Groceries', icon: 'shopping_cart', color: '#0284c7', type: 'expense', hasAllocation: true, budgetLimit: 500, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: true },
  { id: 'cat-2', name: 'Dining Out', icon: 'restaurant', color: '#006397', type: 'expense', hasAllocation: true, budgetLimit: 300, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: true },
  { id: 'cat-3', name: 'Rent & Housing', icon: 'home', color: '#7c3aed', type: 'expense', hasAllocation: true, budgetLimit: 1200, rolloverEnabled: false, rolledOverAmount: 0, rollingDailyEnabled: false },
  { id: 'cat-4', name: 'Utilities & Bills', icon: 'bolt', color: '#d97706', type: 'expense', hasAllocation: true, budgetLimit: 200, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: false },
  { id: 'cat-5', name: 'Transport & Gas', icon: 'directions_car', color: '#475569', type: 'expense', hasAllocation: true, budgetLimit: 200, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: true },
  { id: 'cat-6', name: 'Entertainment & Leisure', icon: 'sports_esports', color: '#ec4899', type: 'expense', hasAllocation: true, budgetLimit: 150, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: true },
  { id: 'cat-7', name: 'Shopping & Apparel', icon: 'shopping_bag', color: '#10b981', type: 'expense', hasAllocation: true, budgetLimit: 200, rolloverEnabled: true, rolledOverAmount: 0, rollingDailyEnabled: false },
  { id: 'cat-8', name: 'Healthcare & Fitness', icon: 'fitness_center', color: '#00a656', type: 'expense', hasAllocation: true, budgetLimit: 150, rolloverEnabled: false, rolledOverAmount: 0, rollingDailyEnabled: false },
  { id: 'cat-9', name: 'Subscriptions & Tech', icon: 'subscriptions', color: '#6366f1', type: 'expense', hasAllocation: true, budgetLimit: 100, rolloverEnabled: false, rolledOverAmount: 0, rollingDailyEnabled: false },
  { id: 'cat-other', name: 'Other Expense', icon: 'more_horiz', color: '#64748b', type: 'expense', hasAllocation: true, budgetLimit: 200, rolloverEnabled: true, rolledOverAmount: 0, isSystemOther: true, rollingDailyEnabled: false },

  // Income Categories
  { id: 'cat-inc-1', name: 'Salary', icon: 'payments', color: '#00a656', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0 },
  { id: 'cat-inc-2', name: 'Freelance & Consulting', icon: 'work', color: '#006397', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0 },
  { id: 'cat-inc-3', name: 'Investments & Dividends', icon: 'trending_up', color: '#d97706', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0 },
  { id: 'cat-inc-4', name: 'Gifts & Bonuses', icon: 'card_giftcard', color: '#e11d48', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0 },
  { id: 'cat-inc-5', name: 'Side Hustle', icon: 'storefront', color: '#8b5cf6', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0 },
  { id: 'cat-other-inc', name: 'Other Income', icon: 'account_balance_wallet', color: '#475569', type: 'income', hasAllocation: false, budgetLimit: 0, rolloverEnabled: false, rolledOverAmount: 0, isSystemOther: true },
];

export const INITIAL_FIXED_BILLS: FixedBill[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];
