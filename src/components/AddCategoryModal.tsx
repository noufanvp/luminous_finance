import React, { useState, useEffect } from 'react';
import { CategoryTemplate, TransactionType } from '../types';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCategory: (category: CategoryTemplate) => void;
  initialCategory?: CategoryTemplate | null;
  defaultType?: TransactionType;
  currencySymbol?: string;
  baseIncome?: number;
  monthlyBudgetGoal?: number;
}

// Preset Icon Collections categorized by domain
const ICON_CATEGORIES = [
  {
    category: 'Food & Dining',
    icons: [
      'local_dining',
      'restaurant',
      'fastfood',
      'local_cafe',
      'local_bar',
      'bakery_dining',
      'icecream',
      'ramen_dining',
    ],
  },
  {
    category: 'Shopping',
    icons: [
      'shopping_cart',
      'shopping_bag',
      'storefront',
      'receipt_long',
      'local_mall',
      'checkroom',
      'inventory_2',
      'sell',
    ],
  },
  {
    category: 'Transport & Travel',
    icons: [
      'directions_car',
      'commute',
      'directions_bus',
      'flight',
      'local_gas_station',
      'pedal_bike',
      'local_taxi',
      'train',
    ],
  },
  {
    category: 'Housing & Utilities',
    icons: [
      'home',
      'apartment',
      'bolt',
      'water_drop',
      'wifi',
      'build',
      'cleaning_services',
      'lightbulb',
    ],
  },
  {
    category: 'Entertainment & Leisure',
    icons: [
      'movie',
      'sports_esports',
      'fitness_center',
      'music_note',
      'theater_comedy',
      'sports_soccer',
      'attractions',
      'gamepad',
    ],
  },
  {
    category: 'Health & Personal',
    icons: [
      'health_and_safety',
      'medical_services',
      'medication',
      'spa',
      'self_improvement',
      'vaccines',
      'face',
      'content_cut',
    ],
  },
  {
    category: 'Finance & Career',
    icons: [
      'payments',
      'account_balance',
      'savings',
      'trending_up',
      'work',
      'attach_money',
      'credit_card',
      'badge',
    ],
  },
  {
    category: 'Tech & Family',
    icons: [
      'subscriptions',
      'devices',
      'smartphone',
      'laptop',
      'pets',
      'card_giftcard',
      'school',
      'child_care',
    ],
  },
];

// Preset Color Swatches with mobile-optimized contrast
const PRESET_COLORS = [
  { name: 'Ocean Blue', hex: '#006397' },
  { name: 'Emerald Green', hex: '#00a656' },
  { name: 'Crimson Red', hex: '#ba1a1a' },
  { name: 'Royal Purple', hex: '#6b4ea2' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Cyan Blue', hex: '#0891b2' },
  { name: 'Rose Pink', hex: '#e11d48' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Teal', hex: '#059669' },
  { name: 'Sunset Orange', hex: '#ea580c' },
  { name: 'Slate Gray', hex: '#475569' },
  { name: 'Fuchsia', hex: '#a21caf' },
];

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  onSaveCategory,
  initialCategory,
  defaultType = 'expense',
  currencySymbol = '$',
  baseIncome = 3000,
  monthlyBudgetGoal,
}) => {
  if (!isOpen) return null;

  const effectiveGoal = monthlyBudgetGoal && monthlyBudgetGoal > 0 ? monthlyBudgetGoal : (baseIncome > 0 ? baseIncome : 3000);

  const isEditing = Boolean(initialCategory);

  const [activeTab, setActiveTab] = useState<'basics' | 'style'>('basics');
  const [name, setName] = useState(initialCategory?.name || '');
  const [categoryType, setCategoryType] = useState<TransactionType>(
    initialCategory?.type || defaultType
  );
  const [selectedIcon, setSelectedIcon] = useState(initialCategory?.icon || 'shopping_cart');
  const [selectedColor, setSelectedColor] = useState(initialCategory?.color || '#006397');
  const [hasAllocation, setHasAllocation] = useState<boolean>(
    initialCategory?.hasAllocation ?? (initialCategory ? (initialCategory.budgetLimit ?? 0) > 0 : false)
  );
  const [targetMode, setTargetMode] = useState<'amount' | 'percent'>('amount');
  const [budgetValue, setBudgetValue] = useState<string>(
    initialCategory?.budgetLimit ? initialCategory.budgetLimit.toString() : '300'
  );
  const [rolloverEnabled, setRolloverEnabled] = useState<boolean>(
    initialCategory?.rolloverEnabled ?? false
  );
  const [rollingDailyEnabled, setRollingDailyEnabled] = useState<boolean>(
    initialCategory?.rollingDailyEnabled ?? false
  );

  const [iconCategoryFilter, setIconCategoryFilter] = useState<string>('All');
  const [iconSearchQuery, setIconSearchQuery] = useState<string>('');
  const [showCustomIconInput, setShowCustomIconInput] = useState<boolean>(false);

  // Filtered icons
  const filteredIconGroups = ICON_CATEGORIES.map((catGroup) => {
    let icons = catGroup.icons;
    if (iconSearchQuery.trim()) {
      const q = iconSearchQuery.toLowerCase().trim();
      icons = icons.filter((ic) => ic.toLowerCase().includes(q));
    }
    return {
      category: catGroup.category,
      icons,
    };
  }).filter((group) => {
    if (iconCategoryFilter !== 'All' && group.category !== iconCategoryFilter) {
      return false;
    }
    return group.icons.length > 0;
  });

  const isIncome = categoryType === 'income';

  // Ensure income categories reset activeTab to basics and have no budget allocation
  useEffect(() => {
    if (isIncome) {
      setActiveTab('basics');
      setHasAllocation(false);
    }
  }, [isIncome]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('basics');
      return;
    }

    let limit = 0;
    if (!isIncome && hasAllocation) {
      limit = parseFloat(budgetValue) || 300;
      if (targetMode === 'percent') {
        limit = (limit / 100) * effectiveGoal;
      }
    }

    const finalHasAllocation = isIncome ? false : hasAllocation;
    const finalLimit = isIncome ? 0 : (finalHasAllocation ? Math.max(0, Math.round(limit * 100) / 100) : 0);
    const finalRollover = isIncome ? false : (finalHasAllocation ? rolloverEnabled : false);
    const finalRollingDaily = isIncome ? false : (finalHasAllocation ? rollingDailyEnabled : false);

    const newCategory: CategoryTemplate = {
      id: initialCategory?.id || `cat-${Date.now()}`,
      name: name.trim(),
      type: categoryType,
      icon: selectedIcon.trim() || 'shopping_cart',
      color: selectedColor,
      hasAllocation: finalHasAllocation,
      budgetLimit: finalLimit,
      rolloverEnabled: finalRollover,
      rolledOverAmount: isIncome ? 0 : (initialCategory?.rolledOverAmount || 0),
      rollingDailyEnabled: finalRollingDaily,
      isSystemOther: initialCategory?.isSystemOther || name.trim().toLowerCase() === 'other',
    };

    onSaveCategory(newCategory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#041627]/60 backdrop-blur-xs animate-in fade-in duration-200 p-3 sm:p-4">
      {/* Mobile & Desktop Centered Container */}
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#c4c6cd]/30 max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Mobile Top Drag Handle */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden shrink-0 bg-[#f8f9fa] border-b border-[#f0f1f2]">
          <div className="w-12 h-1.5 rounded-full bg-[#c4c6cd]/60" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#f0f1f2] flex items-center justify-between bg-[#f8f9fa] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs transition-colors shrink-0"
              style={{ backgroundColor: selectedColor }}
            >
              <span className="material-symbols-outlined text-[22px]">{selectedIcon}</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#191c1d] leading-tight">
                {isEditing ? 'Edit Category' : 'Add Category'}
              </h3>
              <p className="text-xs text-[#74777d]">Personalized budget bucket</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#c4c6cd]/30 flex items-center justify-center text-[#74777d] hover:bg-[#e8eaed] transition-colors shrink-0 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Segmented Tab Switcher for Smartphone Comfort */}
        {!isIncome && (
          <div className="p-2 bg-[#f0f2f5] border-b border-[#e1e3e4] shrink-0">
            <div className="grid grid-cols-2 gap-1.5 bg-[#e4e7eb] p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('basics')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'basics'
                    ? 'bg-white text-[#006397] shadow-sm'
                    : 'text-[#5c6066] hover:text-[#191c1d]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">palette</span>
                <span>1. Name & Icon</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('style')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'style'
                    ? 'bg-white text-[#006397] shadow-sm'
                    : 'text-[#5c6066] hover:text-[#191c1d]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
                <span>2. Budget Target</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Body - Scrollable Area */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          
          {/* Live Badge Preview Card - Always Visible */}
          <div className="p-3.5 rounded-2xl border border-[#c4c6cd]/30 bg-gradient-to-r from-[#f8f9fa] to-[#eef4f8] flex items-center justify-between gap-3 shadow-xs shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md transition-all shrink-0"
                style={{ backgroundColor: selectedColor }}
              >
                <span className="material-symbols-outlined text-[24px]">{selectedIcon}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#74777d] block">
                  Preview Badge
                </span>
                <h4 className="font-extrabold text-sm sm:text-base text-[#191c1d] truncate">
                  {name.trim() || 'Category Name'}
                </h4>
              </div>
            </div>

            {hasAllocation && (
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border shrink-0"
                style={{
                  backgroundColor: `${selectedColor}18`,
                  borderColor: `${selectedColor}40`,
                  color: selectedColor,
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
                <span className="font-mono font-extrabold">
                  {targetMode === 'amount'
                    ? `${currencySymbol}${parseFloat(budgetValue) || 0}`
                    : `${budgetValue || 0}%`}
                </span>
              </span>
            )}
          </div>

          {/* TAB 1: Name, Icon & Color Theme */}
          {activeTab === 'basics' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Category Name Input */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-1.5">
                <label className="text-xs font-extrabold text-[#191c1d] uppercase tracking-wider flex items-center justify-between">
                  <span>Category Name</span>
                  <span className="text-[#ba1a1a] text-[11px] font-bold">* Required</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Groceries, Coffee, Salary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f3f4f5] rounded-xl text-base sm:text-sm font-bold border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397] focus:bg-white text-[#191c1d] transition-all"
                />
              </div>

              {/* Category Type Selector: Expense vs Income */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-2">
                <label className="text-xs font-extrabold text-[#191c1d] uppercase tracking-wider block">
                  Category Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#f3f4f5] rounded-xl border border-[#c4c6cd]/30">
                  <button
                    type="button"
                    onClick={() => setCategoryType('expense')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      categoryType === 'expense'
                        ? 'bg-[#ba1a1a] text-white shadow-xs'
                        : 'text-[#44474c] hover:bg-white/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">trending_down</span>
                    <span>Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryType('income')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      categoryType === 'income'
                        ? 'bg-[#00a656] text-white shadow-xs'
                        : 'text-[#44474c] hover:bg-white/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                    <span>Income</span>
                  </button>
                </div>
                {isIncome && (
                  <div className="bg-[#eefbe7] p-3 rounded-xl border border-[#00a656]/30 flex items-center gap-2 text-xs text-[#13612a] font-semibold animate-in fade-in duration-150">
                    <span className="material-symbols-outlined text-[18px] text-[#00a656] shrink-0">info</span>
                    <span>Income categories track earnings and are excluded from expense budget limits.</span>
                  </div>
                )}
              </div>

              {/* Color Swatch Picker */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-[#191c1d] uppercase tracking-wider">
                    Badge Color Theme
                  </label>
                  <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-[#f0f2f5] text-[#191c1d]">
                    {selectedColor}
                  </span>
                </div>

                {/* 6-Column Touch Palette Grid */}
                <div className="grid grid-cols-6 gap-2 p-2 bg-[#f8f9fa] rounded-2xl border border-[#c4c6cd]/20">
                  {PRESET_COLORS.map((col) => {
                    const isSelected = selectedColor.toLowerCase() === col.hex.toLowerCase();
                    return (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setSelectedColor(col.hex)}
                        className={`h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'ring-3 ring-[#006397] scale-105 shadow-sm font-bold'
                            : 'hover:scale-102 opacity-90 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-[18px] text-white font-black drop-shadow-xs">
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Picker input */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs font-bold text-[#44474c] flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-8 h-8 rounded-xl border border-[#c4c6cd]/40 cursor-pointer p-0 bg-transparent shrink-0"
                    />
                    <span>Custom Hex:</span>
                  </label>
                  <input
                    type="text"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    placeholder="#006397"
                    className="w-28 px-3 py-1.5 text-xs font-mono font-extrabold bg-[#f3f4f5] rounded-xl border border-[#c4c6cd]/30 uppercase focus:outline-none focus:ring-1 focus:ring-[#006397]"
                  />
                </div>
              </div>

              {/* Icon Picker Section */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-[#191c1d] uppercase tracking-wider">
                    Select Icon
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomIconInput(!showCustomIconInput)}
                    className="text-xs font-extrabold text-[#006397] hover:underline"
                  >
                    {showCustomIconInput ? 'Presets Grid' : 'Custom Name'}
                  </button>
                </div>

                {showCustomIconInput ? (
                  <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#c4c6cd]/20 flex flex-col gap-2">
                    <p className="text-xs text-[#74777d]">
                      Type any Google Material Symbol name (e.g. <code className="bg-[#e8eaed] px-1 py-0.5 rounded text-[11px]">coffee</code>):
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[24px] text-[#006397] bg-white p-2 rounded-xl border border-[#c4c6cd]/30">
                        {selectedIcon || 'help'}
                      </span>
                      <input
                        type="text"
                        value={selectedIcon}
                        onChange={(e) => setSelectedIcon(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="e.g. Local_dining, sports_soccer"
                        className="flex-1 px-3 py-2 text-xs font-bold bg-white rounded-xl border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-[#f8f9fa] p-2.5 rounded-2xl border border-[#c4c6cd]/20">
                    {/* Search Bar */}
                    <div className="relative">
                      <span className="material-symbols-outlined text-[#74777d] text-[18px] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search icons (e.g. food, car)..."
                        value={iconSearchQuery}
                        onChange={(e) => setIconSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-[#c4c6cd]/30 focus:outline-none focus:ring-1 focus:ring-[#006397]"
                      />
                    </div>

                    {/* Filter Category Pills */}
                    <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                      <button
                        type="button"
                        onClick={() => setIconCategoryFilter('All')}
                        className={`px-3 py-1 text-[11px] font-extrabold rounded-lg shrink-0 transition-colors ${
                          iconCategoryFilter === 'All'
                            ? 'bg-[#006397] text-white shadow-xs'
                            : 'bg-white text-[#44474c] hover:bg-[#e8eaed]'
                        }`}
                      >
                        All
                      </button>
                      {ICON_CATEGORIES.map((cat) => (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => setIconCategoryFilter(cat.category)}
                          className={`px-3 py-1 text-[11px] font-extrabold rounded-lg shrink-0 transition-colors ${
                            iconCategoryFilter === cat.category
                              ? 'bg-[#006397] text-white shadow-xs'
                              : 'bg-white text-[#44474c] hover:bg-[#e8eaed]'
                          }`}
                        >
                          {cat.category}
                        </button>
                      ))}
                    </div>

                    {/* Touch-Friendly Icon Grid */}
                    <div className="max-h-[170px] overflow-y-auto pr-1 flex flex-col gap-3 mt-1">
                      {filteredIconGroups.map((group) => (
                        <div key={group.category} className="flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-[#74777d] uppercase tracking-wider px-1">
                            {group.category}
                          </span>
                          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                            {group.icons.map((ic) => {
                              const isSelected = selectedIcon === ic;
                              return (
                                <button
                                  key={ic}
                                  type="button"
                                  onClick={() => setSelectedIcon(ic)}
                                  className={`h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-[#006397] text-white ring-2 ring-[#006397]/40 shadow-xs font-bold'
                                      : 'bg-white text-[#44474c] hover:bg-[#e8eaed] hover:text-[#006397] border border-[#c4c6cd]/20'
                                  }`}
                                  title={ic}
                                >
                                  <span className="material-symbols-outlined text-[22px]">{ic}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {filteredIconGroups.length === 0 && (
                        <p className="text-xs text-[#74777d] italic text-center py-4">
                          No matching icons for "{iconSearchQuery}".
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Jump to Next Tab */}
              {!isIncome && (
                <button
                  type="button"
                  onClick={() => setActiveTab('style')}
                  className="w-full py-3 bg-[#f0f4f8] text-[#006397] font-extrabold text-xs rounded-xl hover:bg-[#e2edf5] transition-all flex items-center justify-center gap-1.5 border border-[#006397]/20"
                >
                  <span>Configure Budget Allocation</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: Budget Allocation & Rollover Settings */}
          {activeTab === 'style' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Set Individual Budget Allocation Toggle Box */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-[#191c1d] block">
                    Individual Budget Allocation
                  </span>
                  <span className="text-[11px] text-[#74777d] leading-tight block">
                    {hasAllocation
                      ? 'Set a dedicated monthly limit for this category'
                      : 'No allocation — expenses count on "Other" budget pool'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={hasAllocation}
                    onChange={(e) => setHasAllocation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006397]"></div>
                </label>
              </div>

              {/* Monthly Budget Target Section - conditional on hasAllocation */}
              {hasAllocation ? (
                <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-3">
                  <label className="text-xs font-extrabold text-[#191c1d] uppercase tracking-wider block">
                    Monthly Target Allocation
                  </label>

                  {/* Fixed Amount vs % Mode Toggle */}
                  <div className="grid grid-cols-2 gap-1 bg-[#f3f4f5] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        if (targetMode === 'percent') {
                          const p = parseFloat(budgetValue) || 0;
                          setBudgetValue(Math.round((p / 100) * effectiveGoal).toString());
                        }
                        setTargetMode('amount');
                      }}
                      className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                        targetMode === 'amount'
                          ? 'bg-white text-[#006397] shadow-xs'
                          : 'text-[#74777d] hover:text-[#191c1d]'
                      }`}
                    >
                      Fixed ({currencySymbol})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (targetMode === 'amount') {
                          const a = parseFloat(budgetValue) || 0;
                          const pctVal = effectiveGoal > 0 ? (a / effectiveGoal) * 100 : 0;
                          setBudgetValue(pctVal.toFixed(1));
                        }
                        setTargetMode('percent');
                      }}
                      className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                        targetMode === 'percent'
                          ? 'bg-white text-[#006397] shadow-xs'
                          : 'text-[#74777d] hover:text-[#191c1d]'
                      }`}
                    >
                      % Budget Goal
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-1">
                    <div className="relative">
                      <span className="material-symbols-outlined text-[#74777d] text-[20px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {targetMode === 'amount' ? 'attach_money' : 'percent'}
                      </span>
                      <input
                        type="number"
                        step={targetMode === 'percent' ? '0.1' : '1'}
                        placeholder={targetMode === 'percent' ? '10' : '300'}
                        value={budgetValue}
                        onChange={(e) => setBudgetValue(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#f3f4f5] rounded-xl text-base sm:text-sm font-extrabold border border-[#c4c6cd]/30 focus:outline-none focus:ring-2 focus:ring-[#006397] focus:bg-white text-[#191c1d]"
                      />
                    </div>
                    <span className="text-[11px] font-extrabold text-[#006397] block px-1 pt-0.5">
                      {targetMode === 'amount'
                        ? `= ${effectiveGoal > 0 ? (((parseFloat(budgetValue) || 0) / effectiveGoal) * 100).toFixed(1) : '0'}% of monthly budget goal (${currencySymbol}${effectiveGoal.toLocaleString('en-US')})`
                        : `= ${currencySymbol}${(((parseFloat(budgetValue) || 0) / 100) * effectiveGoal).toFixed(2)} category budget (${budgetValue || 0}% of ${currencySymbol}${effectiveGoal.toLocaleString('en-US')} goal)`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#f0f4f8] p-4 rounded-2xl border border-[#006397]/20 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#006397] text-[22px] shrink-0 mt-0.5">
                    info
                  </span>
                  <div>
                    <h5 className="font-extrabold text-xs text-[#006397] mb-0.5">No Individual Allocation Needed</h5>
                    <p className="text-xs text-[#44474c] leading-relaxed">
                      Expenses in <strong className="text-[#191c1d]">{name.trim() || 'this category'}</strong> will automatically be tracked under your overall <strong className="text-[#006397]">"Other"</strong> category budget pool.
                    </p>
                  </div>
                </div>
              )}

              {/* Rolling Daily Budget Allocation Toggle Box */}
              {hasAllocation && (
                <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-[#006397]">
                          timelapse
                        </span>
                        <span className="text-xs font-extrabold text-[#191c1d] block">
                          Monthly Rolling Daily Budget
                        </span>
                      </div>
                      <span className="text-[11px] text-[#74777d] leading-tight block mt-0.5">
                        Divide total budget equally across all days in your cycle and accumulate unspent balance into "Available to Spend Today"
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={rollingDailyEnabled}
                        onChange={(e) => setRollingDailyEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006397]"></div>
                    </label>
                  </div>

                  {rollingDailyEnabled && (
                    <div className="bg-[#f0f7fc] p-2.5 rounded-xl border border-[#006397]/20 text-[11px] text-[#00476e] font-medium flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#006397] shrink-0 mt-0.5">
                        auto_awesome
                      </span>
                      <span>
                        Pacing is active! Calculates your real-time <strong>Available to Spend Today</strong> metric based on your daily rate minus expenses logged to date.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Rollover Toggle Box */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#c4c6cd]/25 shadow-2xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-[#191c1d] block">
                    Monthly Rollover
                  </span>
                  <span className="text-[11px] text-[#74777d] leading-tight block">
                    Carry leftover surplus or deficit into next month
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={rolloverEnabled}
                    onChange={(e) => setRolloverEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#e1e3e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c4c6cd] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a656]"></div>
                </label>
              </div>
            </div>
          )}

          {/* Sticky Footer Buttons always right at thumb on smartphones */}
          <div className="pt-2 pb-1 bg-white border-t border-[#f0f1f2] flex gap-2.5 mt-auto sticky bottom-0 shrink-0">
            <button
              type="submit"
              className="flex-1 py-3.5 bg-[#006397] text-white font-extrabold text-sm rounded-2xl hover:bg-[#00476e] active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>{isEditing ? 'Save Category' : 'Create Category'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 bg-[#f3f4f5] text-[#44474c] font-extrabold text-sm rounded-2xl hover:bg-[#e1e3e4] active:scale-98 transition-all shrink-0"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
