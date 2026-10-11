import React, { useState } from 'react';
import { FamilyMember } from '../types';

interface ManageFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
  activeMemberId: string;
  onSelectMember: (id: string) => void;
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
  onUpdateMember: (id: string, updated: Partial<FamilyMember>) => void;
  onDeleteMember: (id: string) => void;
}

const MEMBER_ROLES = [
  'Self',
  'Spouse',
  'Partner',
  'Child',
  'Parent',
  'Sibling',
  'Roommate',
  'Other',
];

const PRESET_MEMBER_COLORS = [
  '#006397', // Primary Ocean Blue
  '#00a656', // Emerald Green
  '#e11d48', // Ruby Rose
  '#7c3aed', // Purple
  '#d97706', // Amber Gold
  '#0284c7', // Sky Blue
  '#ec4899', // Pink
  '#475569', // Slate
];

const ROLE_ICONS: Record<string, string> = {
  Self: 'person',
  Spouse: 'favorite',
  Partner: 'favorite',
  Child: 'child_care',
  Parent: 'escalator_warning',
  Sibling: 'group',
  Roommate: 'home',
  Other: 'account_circle',
};

export const ManageFamilyModal: React.FC<ManageFamilyModalProps> = ({
  isOpen,
  onClose,
  members,
  activeMemberId,
  onSelectMember,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('Self');
  const [formColor, setFormColor] = useState('#006397');

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingMember(null);
    setFormName('');
    setFormRole('Spouse');
    setFormColor(PRESET_MEMBER_COLORS[members.length % PRESET_MEMBER_COLORS.length]);
    setIsAddingNew(true);
  };

  const handleStartEdit = (m: FamilyMember) => {
    setIsAddingNew(false);
    setEditingMember(m);
    setFormName(m.name);
    setFormRole(m.role || 'Other');
    setFormColor(m.color || '#006397');
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingMember(null);
    setFormName('');
  };

  const handleSave = () => {
    const trimmed = formName.trim();
    if (!trimmed) return;

    if (isAddingNew) {
      onAddMember({
        name: trimmed,
        role: formRole,
        color: formColor,
      });
      handleCancelForm();
    } else if (editingMember) {
      onUpdateMember(editingMember.id, {
        name: trimmed,
        role: formRole,
        color: formColor,
      });
      handleCancelForm();
    }
  };

  const handleDelete = (id: string) => {
    onDeleteMember(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-[#c4c6cd]/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e1e3e4] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006397]/10 text-[#006397] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">diversity_3</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#041627] leading-tight">Family Members</h3>
              <p className="text-xs text-[#44474c]">Manage profiles under this shared account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#44474c] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Mode (Add or Edit) */}
        {isAddingNew || editingMember ? (
          <div className="bg-[#f8fafc] p-4 rounded-2xl border border-[#e2e8f0] flex flex-col gap-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#041627] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#006397]">
                  {isAddingNew ? 'person_add' : 'edit'}
                </span>
                <span>{isAddingNew ? 'Add Family Member' : 'Edit Member Profile'}</span>
              </h4>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-xs text-[#44474c] hover:text-[#041627] font-semibold"
              >
                Cancel
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-xs font-bold text-[#44474c] block mb-1">Full Name / Nickname</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Sarah, Dad, Emma..."
                className="w-full px-3.5 py-2 bg-white rounded-xl text-sm font-semibold text-[#191c1d] border border-[#c4c6cd]/40 focus:outline-none focus:ring-2 focus:ring-[#006397]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>

            {/* Role / Relation */}
            <div>
              <label className="text-xs font-bold text-[#44474c] block mb-1.5">Role / Relationship</label>
              <div className="grid grid-cols-4 gap-1.5">
                {MEMBER_ROLES.map((role) => {
                  const isSelected = formRole === role;
                  const iconName = ROLE_ICONS[role] || 'person';
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormRole(role)}
                      className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-[#006397] text-white shadow-2xs'
                          : 'bg-white text-[#44474c] border border-[#e2e8f0] hover:bg-[#f0f4f8]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                      <span className="text-[11px] leading-none truncate w-full text-center">{role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Accent Picker */}
            <div>
              <label className="text-xs font-bold text-[#44474c] block mb-1.5">Theme Color</label>
              <div className="flex items-center gap-2">
                {PRESET_MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                    style={{ backgroundColor: c }}
                  >
                    {formColor === c && (
                      <span className="material-symbols-outlined text-white text-[16px]">check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="flex-1 py-2 rounded-xl border border-[#c4c6cd]/40 text-xs font-bold text-[#44474c] hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formName.trim()}
                className="flex-1 py-2 bg-[#006397] hover:bg-[#00476e] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>{isAddingNew ? 'Add Member' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* List of Members */
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#44474c] uppercase tracking-wider">
                Family Profiles ({members.length})
              </span>
              <button
                onClick={handleStartAdd}
                className="px-3 py-1 bg-[#006397] hover:bg-[#00476e] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>Add Member</span>
              </button>
            </div>

            <div className="space-y-2">
              {/* Combined Family Profile Row */}
              <div
                onClick={() => {
                  onSelectMember('all');
                  onClose();
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  activeMemberId === 'all'
                    ? 'bg-[#e0f2fe] border-[#38bdf8] shadow-xs'
                    : 'bg-[#f8f9fa] border-[#e1e3e4] hover:bg-[#f0f4f8]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#006397] to-[#0284c7] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">diversity_3</span>
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-[#041627] flex items-center gap-1.5">
                      <span>All Family (Combined)</span>
                      {activeMemberId === 'all' && (
                        <span className="px-2 py-0.5 bg-[#006397] text-white text-[10px] font-extrabold rounded-full">
                          Active
                        </span>
                      )}
                    </h5>
                    <p className="text-[11px] text-[#44474c]">Shared & aggregate family finances</p>
                  </div>
                </div>

                <span className="material-symbols-outlined text-[20px] text-[#006397]">
                  {activeMemberId === 'all' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>

              {/* Individual Members List */}
              {members.map((m) => {
                const isSelected = activeMemberId === m.id;
                const roleIcon = ROLE_ICONS[m.role || ''] || 'person';

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#f0fdf4] border-[#86efac] shadow-xs'
                        : 'bg-white border-[#e1e3e4] hover:bg-[#f8f9fa]'
                    }`}
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => {
                        onSelectMember(m.id);
                        onClose();
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-2xl text-white font-extrabold text-base flex items-center justify-center shadow-xs shrink-0"
                        style={{ backgroundColor: m.color || '#006397' }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-sm font-bold text-[#041627]">{m.name}</h5>
                          {m.isDefault && (
                            <span className="px-1.5 py-0.2 bg-[#f0f4f8] text-[#006397] text-[9px] font-bold rounded-md border border-[#d2e4fb]">
                              Primary
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-[#00a656] text-white text-[10px] font-extrabold rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#44474c] mt-0.5">
                          <span className="material-symbols-outlined text-[13px]">{roleIcon}</span>
                          <span>{m.role || 'Member'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(m);
                        }}
                        className="p-1.5 rounded-lg text-[#006397] hover:bg-[#006397]/10 transition-colors cursor-pointer"
                        title="Edit profile"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>

                      {members.length > 1 && !m.isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(m.id);
                          }}
                          className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors cursor-pointer"
                          title="Delete profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-fade-in">
            <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-[#ffdad6] text-center flex flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#ffdad6]/60 text-[#ba1a1a] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">delete</span>
              </div>
              <h4 className="text-base font-bold text-[#191c1d]">Remove Member Profile?</h4>
              <p className="text-xs text-[#44474c]">
                Are you sure you want to remove this family member? Existing transactions will remain stored.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="py-2 rounded-xl border border-[#c4c6cd]/40 text-xs font-bold text-[#44474c] hover:bg-[#f0f4f8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="py-2 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-[#e1e3e4] pt-3 flex items-center justify-between text-[11px] text-[#44474c]">
          <span>Tip: Filter views by active member or switch to 'All Family' for combined totals.</span>
        </div>
      </div>
    </div>
  );
};
