import React from 'react';
import { TabType } from '../types';

interface BottomNavBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-between items-center px-1 sm:px-2 pb-3.5 pt-1.5 landscape:pb-2 landscape:pt-1 bg-white/95 backdrop-blur-md border-t border-[#e1e3e4] shadow-[0_-4px_25px_rgba(4,22,39,0.12)] md:hidden rounded-t-2xl transition-all">
      {/* Dashboard */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'dashboard'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'dashboard' ? "'FILL' 1" : "'FILL' 0" }}
        >
          dashboard
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Dashboard</span>
      </button>

      {/* Accounts */}
      <button
        onClick={() => setActiveTab('accounts')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'accounts'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'accounts' ? "'FILL' 1" : "'FILL' 0" }}
        >
          account_balance
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Accounts</span>
      </button>

      {/* Ledger */}
      <button
        onClick={() => setActiveTab('ledger')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'ledger'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'ledger' ? "'FILL' 1" : "'FILL' 0" }}
        >
          receipt_long
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Ledger</span>
      </button>

      {/* Add Button (Floating Center) */}
      <button
        onClick={() => setActiveTab('add')}
        className={`shrink-0 flex flex-col items-center justify-center rounded-full transition-all active:scale-95 relative -top-3.5 bg-[#00a656] text-white shadow-lg shadow-[#00a656]/30 border-2 border-white p-2.5 mx-0.5 ${
          activeTab === 'add' ? 'ring-2 ring-[#00a656] ring-offset-2' : ''
        }`}
        title="Add Transaction"
      >
        <span
          className="material-symbols-outlined text-white text-[24px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          add
        </span>
        <span className="sr-only">Add Transaction</span>
      </button>

      {/* Reports */}
      <button
        onClick={() => setActiveTab('reports')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'reports'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'reports' ? "'FILL' 1" : "'FILL' 0" }}
        >
          insights
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Reports</span>
      </button>

      {/* Budgets */}
      <button
        onClick={() => setActiveTab('budgets')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'budgets'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'budgets' ? "'FILL' 1" : "'FILL' 0" }}
        >
          pie_chart
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Budgets</span>
      </button>

      {/* Profile */}
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[44px] px-1 py-1 rounded-xl transition-all active:scale-90 ${
          activeTab === 'profile'
            ? 'bg-[#006397] text-white font-bold shadow-xs'
            : 'text-[#44474c] hover:bg-[#f0f4f8] hover:text-[#041627]'
        }`}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: activeTab === 'profile' ? "'FILL' 1" : "'FILL' 0" }}
        >
          person
        </span>
        <span className="text-[9px] mt-0.5 tracking-tight font-semibold truncate w-full text-center">Profile</span>
      </button>
    </nav>
  );
};
