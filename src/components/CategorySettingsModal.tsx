import React, { useState } from 'react';
import { CategoryTemplate, TransactionType } from '../types';

interface CategorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryTemplate[];
  onEditCategory: (cat: CategoryTemplate) => void;
  onDeleteCategory?: (id: string) => void;
  onReorderCategories?: (newCategories: CategoryTemplate[]) => void;
  onAddNewCategory?: () => void;
  initialTab?: TransactionType;
}

export const CategorySettingsModal: React.FC<CategorySettingsModalProps> = ({
  isOpen,
  onClose,
  categories,
  onEditCategory,
  onDeleteCategory,
  onReorderCategories,
  onAddNewCategory,
  initialTab = 'expense',
}) => {
  const [activeTab, setActiveTab] = useState<TransactionType>(initialTab);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const expenseCount = categories.filter((c) => (c.type || 'expense') === 'expense').length;
  const incomeCount = categories.filter((c) => (c.type || 'expense') === 'income').length;

  const typeFilteredCategories = categories.filter(
    (cat) => (cat.type || 'expense') === activeTab
  );

  const filteredCategories = typeFilteredCategories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleDragStart = (e: React.DragEvent, subIndex: number) => {
    setDraggedIndex(subIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subIndex.toString());
  };

  const handleDragOver = (e: React.DragEvent, subIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== subIndex) {
      setDragOverIndex(subIndex);
    }
  };

  const handleDrop = (e: React.DragEvent, dropSubIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropSubIndex || !onReorderCategories) return;

    const currentSubList = [...typeFilteredCategories];
    const [movedCat] = currentSubList.splice(draggedIndex, 1);
    currentSubList.splice(dropSubIndex, 0, movedCat);

    const otherTypesList = categories.filter(
      (c) => (c.type || 'expense') !== activeTab
    );

    const newOverallList =
      activeTab === 'expense'
        ? [...currentSubList, ...otherTypesList]
        : [...otherTypesList, ...currentSubList];

    onReorderCategories(newOverallList);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = (cat: CategoryTemplate) => {
    if (cat.isSystemOther || cat.name.toLowerCase().includes('other')) {
      alert('System "Other" category cannot be deleted.');
      return;
    }
    if (deleteConfirmId === cat.id) {
      if (onDeleteCategory) {
        onDeleteCategory(cat.id);
      }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(cat.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#041627]/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl p-4 sm:p-5 max-w-md w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#c4c6cd]/20 gap-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f1f2] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#006397]/10 flex items-center justify-center text-[#006397]">
              <span className="material-symbols-outlined text-[20px]">settings_suggest</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#191c1d]">Category Settings</h3>
              <p className="text-[11px] font-medium text-[#74777d]">
                Edit, reorder, or remove expense & income categories
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f2f5] text-[#74777d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Expense vs Income Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#f3f4f5] rounded-2xl border border-[#c4c6cd]/30 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('expense');
              setSearchQuery('');
            }}
            className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'expense'
                ? 'bg-[#ba1a1a] text-white shadow-xs'
                : 'text-[#44474c] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">trending_down</span>
            <span>Expense ({expenseCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('income');
              setSearchQuery('');
            }}
            className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'income'
                ? 'bg-[#00a656] text-white shadow-xs'
                : 'text-[#44474c] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            <span>Income ({incomeCount})</span>
          </button>
        </div>

        {/* Search & Add Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-[#74777d] text-[18px] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab} categories...`}
              className="w-full pl-9 pr-3 py-2 bg-[#f3f4f5] rounded-xl text-xs font-medium border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397] text-[#191c1d]"
            />
          </div>
          {onAddNewCategory && (
            <button
              type="button"
              onClick={onAddNewCategory}
              className="px-3 py-2 bg-[#006397] text-white text-xs font-bold rounded-xl hover:bg-[#00476e] transition-colors flex items-center gap-1 shadow-xs shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>New</span>
            </button>
          )}
        </div>

        {/* Subtitle / Drag hint */}
        {!searchQuery && onReorderCategories && (
          <p className="text-[11px] text-[#74777d] font-medium flex items-center gap-1 -mt-2">
            <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
            <span>Hold and drag any category to reorder</span>
          </p>
        )}

        {/* Categories List */}
        <div className="overflow-y-auto max-h-[45vh] pr-1 space-y-2 my-1">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-[#74777d] text-xs font-medium">
              No {activeTab} categories found.
            </div>
          ) : (
            filteredCategories.map((cat, subIndex) => {
              const isDeleting = deleteConfirmId === cat.id;
              const catColor = cat.color || (activeTab === 'income' ? '#00a656' : '#006397');
              const isDragging = draggedIndex === subIndex;
              const isDragOver = dragOverIndex === subIndex && draggedIndex !== subIndex;
              const canDrag = Boolean(onReorderCategories && !searchQuery);

              return (
                <div
                  key={cat.id}
                  draggable={canDrag}
                  onDragStart={(e) => canDrag && handleDragStart(e, subIndex)}
                  onDragOver={(e) => canDrag && handleDragOver(e, subIndex)}
                  onDrop={(e) => canDrag && handleDrop(e, subIndex)}
                  onDragEnd={handleDragEnd}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-2 transition-all shadow-2xs ${
                    isDragging
                      ? 'opacity-30 border-2 border-dashed border-[#006397] bg-[#f0f4f8]'
                      : isDragOver
                      ? 'bg-[#e2edf5] border-2 border-[#006397] scale-[1.01]'
                      : 'bg-[#f8f9fa] hover:bg-white border border-[#e1e3e4] hover:border-[#006397]/30'
                  }`}
                >
                  {/* Left: Reorder drag handle & Category Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Drag Handle Icon */}
                    {canDrag && (
                      <div
                        className="p-1 cursor-grab active:cursor-grabbing text-[#909399] hover:text-[#006397] shrink-0 touch-none"
                        title="Hold and drag to reorder"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          drag_indicator
                        </span>
                      </div>
                    )}

                    {/* Icon Badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold shadow-xs"
                      style={{ backgroundColor: catColor }}
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        {cat.icon || (activeTab === 'income' ? 'payments' : 'shopping_cart')}
                      </span>
                    </div>

                    {/* Name & details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-[#191c1d] truncate">{cat.name}</h4>
                        {cat.isSystemOther && (
                          <span className="text-[9px] bg-[#006397]/10 text-[#006397] font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                            System
                          </span>
                        )}
                      </div>
                      {cat.budgetLimit !== undefined && cat.budgetLimit > 0 && activeTab === 'expense' && (
                        <p className="text-[10px] text-[#74777d]">
                          Budget: ${cat.budgetLimit}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Edit & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditCategory(cat)}
                      className="px-2.5 py-1.5 bg-white border border-[#c4c6cd]/40 text-[#006397] hover:bg-[#006397]/10 text-xs font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Edit</span>
                    </button>

                    {!cat.isSystemOther && !cat.name.toLowerCase().includes('other') && onDeleteCategory && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95 ${
                          isDeleting
                            ? 'bg-[#ba1a1a] text-white shadow-xs'
                            : 'bg-white border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 shadow-2xs'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isDeleting ? 'check' : 'delete'}
                        </span>
                        <span>{isDeleting ? 'Confirm?' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info / Close */}
        <div className="pt-2 border-t border-[#f0f1f2] flex items-center justify-between text-xs text-[#74777d] shrink-0">
          <span>{filteredCategories.length} {activeTab} categories</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#f0f4f8] text-[#006397] font-bold rounded-xl hover:bg-[#e2edf5] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
