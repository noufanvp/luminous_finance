export type TransactionType = 'expense' | 'income' | 'transfer';

export interface FamilyMember {
  id: string;
  name: string;
  role?: string; // 'Self' | 'Spouse' | 'Child' | 'Parent' | 'Partner' | 'Sibling' | 'Other'
  avatar?: string;
  color?: string;
  isDefault?: boolean;
  monthlyBudget?: number; // Personal monthly budget goal
}


export interface BankAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';
  balance: number;
  accountNumber?: string;
  color?: string;
  icon?: string;
  institution?: string;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
  memberId?: string; // ID of the family member who owns this account ('all' or undefined for joint/shared)
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  title: string;
  amount: number;
  date: string; // ISO string or format 'Today', 'Yesterday', 'YYYY-MM-DD'
  isAutoParsed?: boolean;
  memo?: string;
  person?: string; // Person / Tag / Purpose for filtering
  payee?: string;  // Alias for person/tag
  tag?: string;    // Alias for person/tag
  rawExpression?: string;
  accountId?: string;      // ID of associated bank account (source or target)
  toAccountId?: string;    // Destination bank account ID for transfers
  isTransfer?: boolean;    // Indicates internal money transfer between accounts
  excludeFromBudget?: boolean; // When true, excludes from budget allocation and pacing calculations
  memberId?: string;       // ID of family member associated with this transaction
}

export interface FixedBill {
  id: string;
  name: string;
  amount: number;
  schedule: string;
  icon: string;
  active: boolean;
}

export interface CategoryTemplate {
  id: string;
  name: string;
  icon: string;
  color?: string;
  type?: TransactionType; // 'expense' | 'income'
  hasAllocation?: boolean;
  budgetLimit?: number;
  rolloverEnabled?: boolean;
  rolledOverAmount?: number;
  rollingDailyEnabled?: boolean; // Monthly Rolling Daily Budget Allocation mode
  isSystemOther?: boolean;
}

export interface BudgetConfig {
  monthlyTarget: number;
  paydayAnchorDay: number;
  smartBufferActive: boolean;
  userAvatar: string;
  userName: string;
  currencySymbol?: string;
  currencyCode?: string;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (C$)' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (R$)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal (SAR)' },
];

export type TabType = 'dashboard' | 'ledger' | 'add' | 'budgets' | 'accounts' | 'reports' | 'profile';
