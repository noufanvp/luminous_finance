import React, { useState } from 'react';
import { BankAccount, Transaction } from '../types';
import { getAccountBalances } from '../utils/finance';
import { TransferMoneyModal } from './TransferMoneyModal';
import { AddAccountModal } from './AddAccountModal';

interface BankAccountsSectionProps {
  accounts: BankAccount[];
  transactions: Transaction[];
  currencySymbol?: string;
  onAddAccount: (account: BankAccount) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onDeleteAccount: (id: string) => void;
  onTransferMoney: (data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    memo?: string;
  }) => void;
}

export const BankAccountsSection: React.FC<BankAccountsSectionProps> = ({
  accounts,
  transactions,
  currencySymbol = '$',
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTransferMoney,
}) => {
  const accountBalances = getAccountBalances(accounts, transactions);

  // Total Net Worth = sum of current balances across all accounts
  const netWorth = accountBalances.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [transferFromId, setTransferFromId] = useState<string | undefined>(undefined);
  const [transferToId, setTransferToId] = useState<string | undefined>(undefined);

  const handleOpenTransferWithFrom = (fromId: string) => {
    setTransferFromId(fromId);
    setTransferToId(accounts.find((a) => a.id !== fromId)?.id);
    setShowTransferModal(true);
  };

  const getTypeBadge = (type: BankAccount['type']) => {
    switch (type) {
      case 'checking':
        return { label: 'Checking', bg: 'bg-[#006397]/10 text-[#006397]' };
      case 'savings':
        return { label: 'Savings', bg: 'bg-[#00a656]/10 text-[#00a656]' };
      case 'credit':
        return { label: 'Credit Card', bg: 'bg-[#e11d48]/10 text-[#e11d48]' };
      case 'cash':
        return { label: 'Cash', bg: 'bg-[#d97706]/10 text-[#d97706]' };
      case 'investment':
        return { label: 'Investment', bg: 'bg-[#6b4ea2]/10 text-[#6b4ea2]' };
      default:
        return { label: 'Other', bg: 'bg-[#475569]/10 text-[#475569]' };
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-[#c4c6cd]/20 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f1f2]">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006397] text-[22px]">account_balance</span>
            <h2 className="font-extrabold text-base text-[#191c1d]">Bank Accounts</h2>
            <span className="text-xs font-bold text-[#006397] bg-[#006397]/10 px-2 py-0.5 rounded-full">
              {accounts.length}
            </span>
          </div>
          <p className="text-xs text-[#74777d] mt-0.5">
            Total Net Worth Across Accounts:{' '}
            <strong className={`font-mono ${netWorth >= 0 ? 'text-[#00a656]' : 'text-[#ba1a1a]'}`}>
              {netWorth >= 0 ? `${currencySymbol}${netWorth.toFixed(2)}` : `-${currencySymbol}${Math.abs(netWorth).toFixed(2)}`}
            </strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {accounts.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                setTransferFromId(undefined);
                setTransferToId(undefined);
                setShowTransferModal(true);
              }}
              className="px-3 py-1.5 bg-[#006397]/10 text-[#006397] hover:bg-[#006397]/20 border border-[#006397]/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>Transfer Money</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setShowAddAccountModal(true);
            }}
            className="px-3 py-1.5 bg-[#006397] text-white hover:bg-[#00476e] rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {accountBalances.map((acc) => {
          const badge = getTypeBadge(acc.type);
          const isNegative = acc.currentBalance < 0;

          return (
            <div
              key={acc.id}
              className="p-3.5 bg-[#f8f9fa] rounded-2xl border border-[#c4c6cd]/30 hover:border-[#006397]/40 transition-all flex flex-col justify-between gap-3 group relative"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs shrink-0"
                    style={{ backgroundColor: acc.color || '#006397' }}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {acc.icon || 'account_balance'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-[#191c1d] group-hover:text-[#006397] transition-colors">
                        {acc.name}
                      </span>
                      {acc.isDefault && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-[#006397] text-white rounded-md">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#74777d]">
                      {acc.institution && <span>{acc.institution}</span>}
                      {acc.accountNumber && (
                        <span className="font-mono">•••• {acc.accountNumber}</span>
                      )}
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg}`}>
                  {badge.label}
                </span>
              </div>

              {/* Balance & Actions Row */}
              <div className="flex items-end justify-between pt-2 border-t border-[#e8eaed]">
                <div>
                  <span className="text-[10px] text-[#74777d] uppercase font-extrabold tracking-wider block">
                    Current Balance
                  </span>
                  <span
                    className={`text-lg font-black font-mono tracking-tight ${
                      isNegative ? 'text-[#ba1a1a]' : 'text-[#00a656]'
                    }`}
                  >
                    {isNegative
                      ? `-${currencySymbol}${Math.abs(acc.currentBalance).toFixed(2)}`
                      : `${currencySymbol}${acc.currentBalance.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {accounts.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTransferWithFrom(acc.id)}
                      className="px-2.5 py-1 text-[11px] font-bold text-[#006397] hover:bg-[#006397]/10 rounded-lg transition-colors flex items-center gap-1"
                      title="Transfer from this account"
                    >
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                      <span>Transfer</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(acc);
                      setShowAddAccountModal(true);
                    }}
                    className="p-1 text-[#74777d] hover:text-[#006397] hover:bg-white rounded-lg transition-colors"
                    title="Edit account details"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>

                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete account "${acc.name}"?`
                          )
                        ) {
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="p-1 text-[#74777d] hover:text-[#ba1a1a] hover:bg-white rounded-lg transition-colors"
                      title="Delete account"
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

      {/* Transfer Money Modal */}
      <TransferMoneyModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        accounts={accounts}
        transactions={transactions}
        currencySymbol={currencySymbol}
        onTransfer={onTransferMoney}
        initialFromAccountId={transferFromId}
        initialToAccountId={transferToId}
      />

      {/* Add / Edit Account Modal */}
      <AddAccountModal
        isOpen={showAddAccountModal}
        onClose={() => {
          setShowAddAccountModal(false);
          setEditingAccount(null);
        }}
        initialAccount={editingAccount}
        onSaveAccount={(acc) => {
          if (editingAccount) {
            onUpdateAccount(acc);
          } else {
            onAddAccount(acc);
          }
          setEditingAccount(null);
        }}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
