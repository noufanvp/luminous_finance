import React, { useState, useRef, useEffect } from 'react';
import { FamilyMember } from '../types';

interface FamilyMemberSwitcherProps {
  members: FamilyMember[];
  activeMemberId: string;
  onSelectMember: (id: string) => void;
  onOpenManageModal?: () => void;
  variant?: 'compact' | 'full' | 'header';
}

export const FamilyMemberSwitcher: React.FC<FamilyMemberSwitcherProps> = ({
  members,
  activeMemberId,
  onSelectMember,
  onOpenManageModal,
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeMember = members.find((m) => m.id === activeMemberId);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Switcher Trigger Button - Direct Icon Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all border active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center shrink-0 ${
          activeMemberId === 'all'
            ? 'bg-[#006397] border-[#006397] text-white hover:bg-[#004e78]'
            : 'border-transparent text-white hover:opacity-90'
        }`}
        style={
          activeMemberId !== 'all'
            ? { backgroundColor: activeMember?.color || '#006397', borderColor: activeMember?.color || '#006397' }
            : undefined
        }
        title={`Family Member: ${activeMemberId === 'all' ? 'All Family' : activeMember?.name || 'Member'} (Click to switch)`}
        aria-label="Switch family member profile"
      >
        {activeMemberId === 'all' ? (
          <span className="material-symbols-outlined text-[17px] sm:text-[19px]">diversity_3</span>
        ) : (
          <span className="font-extrabold text-xs sm:text-sm">
            {activeMember?.name ? activeMember.name.charAt(0).toUpperCase() : 'U'}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl bg-white shadow-2xl border border-[#e1e3e4] py-2 z-[90] animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-2 border-b border-[#e1e3e4]/80">
            <span className="text-[11px] font-extrabold text-[#44474c] uppercase tracking-wider">
              Family Profile Switcher
            </span>
          </div>

          <div className="p-1.5 space-y-1 max-h-60 overflow-y-auto no-scrollbar">
            {/* All Family Option */}
            <button
              type="button"
              onClick={() => {
                onSelectMember('all');
                setIsOpen(false);
              }}
              className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors text-left cursor-pointer ${
                activeMemberId === 'all'
                  ? 'bg-[#e0f2fe] text-[#00476e] font-bold'
                  : 'hover:bg-[#f0f4f8] text-[#191c1d]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#006397] to-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[18px]">diversity_3</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">All Family (Combined)</div>
                  <div className="text-[10px] text-[#44474c] truncate">Aggregate household totals</div>
                </div>
              </div>
              {activeMemberId === 'all' && (
                <span className="material-symbols-outlined text-[18px] text-[#006397] shrink-0">
                  check_circle
                </span>
              )}
            </button>

            <div className="my-1 border-t border-[#f0f2f5]"></div>

            {/* Individual Members */}
            {members.map((m) => {
              const isSelected = activeMemberId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectMember(m.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2 rounded-xl flex items-center justify-between transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-[#f0fdf4] text-[#14532d] font-bold'
                      : 'hover:bg-[#f0f4f8] text-[#191c1d]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: m.color || '#006397' }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.isDefault && (
                          <span className="text-[9px] bg-[#f0f4f8] text-[#006397] px-1.5 py-0.2 rounded font-semibold border border-[#d2e4fb]">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#44474c] truncate">{m.role || 'Member'}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-[#00a656] shrink-0">
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Manage / Add Member Footer Button */}
          {onOpenManageModal && (
            <div className="p-1.5 border-t border-[#e1e3e4]/80">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenManageModal();
                }}
                className="w-full py-2 px-3 bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#006397] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                <span>Manage Family Profiles</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
