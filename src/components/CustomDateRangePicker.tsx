import React, { useState, useEffect } from 'react';

interface CustomDateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  onClose?: () => void;
}

export const CustomDateRangePicker: React.FC<CustomDateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  onClose,
}) => {
  // Lock body scroll when calendar modal is open
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
  // Parse initial state date or fallback to current month
  const initialDate = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11

  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const [pickerMode, setPickerMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = useState<number>(viewYear - 5);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const handlePrev = () => {
    if (pickerMode === 'days') {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    } else if (pickerMode === 'months') {
      setViewYear(viewYear - 1);
    } else if (pickerMode === 'years') {
      setYearPageStart(yearPageStart - 12);
    }
  };

  const handleNext = () => {
    if (pickerMode === 'days') {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    } else if (pickerMode === 'months') {
      setViewYear(viewYear + 1);
    } else if (pickerMode === 'years') {
      setYearPageStart(yearPageStart + 12);
    }
  };

  const formatDateStr = (year: number, month: number, day: number): string => {
    const y = year.toString();
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return 'Select date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDayClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else if (tempStart && !tempEnd) {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const applyPreset = (preset: 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'quarter' | 'ytd') => {
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());
    setPickerMode('days');

    if (preset === 'last_7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const startStr = formatDateStr(past.getFullYear(), past.getMonth(), past.getDate());
      setTempStart(startStr);
      setTempEnd(todayStr);
      setViewYear(past.getFullYear());
      setViewMonth(past.getMonth());
    } else if (preset === 'last_30') {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      const startStr = formatDateStr(past.getFullYear(), past.getMonth(), past.getDate());
      setTempStart(startStr);
      setTempEnd(todayStr);
      setViewYear(past.getFullYear());
      setViewMonth(past.getMonth());
    } else if (preset === 'this_month') {
      const first = formatDateStr(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const last = formatDateStr(now.getFullYear(), now.getMonth(), lastDay);
      setTempStart(first);
      setTempEnd(last);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (preset === 'last_month') {
      const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const first = formatDateStr(prevY, prevM, 1);
      const lastDay = new Date(prevY, prevM + 1, 0).getDate();
      const last = formatDateStr(prevY, prevM, lastDay);
      setTempStart(first);
      setTempEnd(last);
      setViewYear(prevY);
      setViewMonth(prevM);
    } else if (preset === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const startMonth = q * 3;
      const first = formatDateStr(now.getFullYear(), startMonth, 1);
      const endMonth = startMonth + 2;
      const lastDay = new Date(now.getFullYear(), endMonth + 1, 0).getDate();
      const last = formatDateStr(now.getFullYear(), endMonth, lastDay);
      setTempStart(first);
      setTempEnd(last);
      setViewYear(now.getFullYear());
      setViewMonth(startMonth);
    } else if (preset === 'ytd') {
      const first = formatDateStr(now.getFullYear(), 0, 1);
      setTempStart(first);
      setTempEnd(todayStr);
      setViewYear(now.getFullYear());
      setViewMonth(0);
    }
  };

  // Generate year options for quick dropdown selection (e.g. 10 years back and 10 years ahead)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => currentYear - 15 + i);

  // Generate calendar grid days (always 42 cells = 6 rows of 7 days for fixed modal height)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }
  while (daysArray.length < 42) {
    daysArray.push(null);
  }

  const handleApply = () => {
    onChange(tempStart, tempEnd || tempStart);
    if (onClose) onClose();
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    onChange('', '');
    if (onClose) onClose();
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[#c4c6cd]/30 p-5 max-w-md w-full animate-fade-in text-[#191c1d]">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#e1e3e4]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006397]">calendar_month</span>
          <h3 className="text-base font-bold text-[#191c1d]">Select Custom Date Range</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#f3f4f5] rounded-lg text-[#74777d] hover:text-[#191c1d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap gap-1.5 mt-3 mb-2">
        {[
          { key: 'last_7', label: 'Last 7 Days' },
          { key: 'last_30', label: 'Last 30 Days' },
          { key: 'this_month', label: 'This Month' },
          { key: 'last_month', label: 'Last Month' },
          { key: 'ytd', label: 'Year to Date' },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key as any)}
            className="px-2.5 py-1 text-[11px] font-bold bg-[#f3f4f5] hover:bg-[#006397]/10 hover:text-[#006397] text-[#44474c] rounded-lg transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Selected Range Badges Display */}
      <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-[#f8f9fa] rounded-xl border border-[#e1e3e4]">
        <div>
          <span className="text-[10px] font-bold text-[#74777d] uppercase tracking-wider block">Start Date</span>
          <span className="text-xs font-extrabold text-[#006397]">
            {formatDisplayDate(tempStart)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-[#74777d] uppercase tracking-wider block">End Date</span>
          <span className="text-xs font-extrabold text-[#006397]">
            {formatDisplayDate(tempEnd || tempStart)}
          </span>
        </div>
      </div>

      {/* Interactive Calendar Header Controller & Grid */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1.5 rounded-lg hover:bg-[#f3f4f5] text-[#44474c] hover:text-[#191c1d] transition-colors"
            title="Previous"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          {/* Clickable Month & Year Mode Selectors */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerMode(pickerMode === 'months' ? 'days' : 'months')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                pickerMode === 'months'
                  ? 'bg-[#006397] text-white shadow-2xs'
                  : 'bg-[#f3f4f5] hover:bg-[#e8eaed] text-[#191c1d] border border-[#c4c6cd]/30'
              }`}
            >
              <span>{months[viewMonth]}</span>
              <span className="material-symbols-outlined text-[16px]">
                {pickerMode === 'months' ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pickerMode !== 'years') {
                  setYearPageStart(viewYear - 5);
                }
                setPickerMode(pickerMode === 'years' ? 'days' : 'years');
              }}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                pickerMode === 'years'
                  ? 'bg-[#006397] text-white shadow-2xs'
                  : 'bg-[#f3f4f5] hover:bg-[#e8eaed] text-[#191c1d] border border-[#c4c6cd]/30'
              }`}
            >
              <span>{pickerMode === 'years' ? `${yearPageStart} – ${yearPageStart + 11}` : viewYear}</span>
              <span className="material-symbols-outlined text-[16px]">
                {pickerMode === 'years' ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="p-1.5 rounded-lg hover:bg-[#f3f4f5] text-[#44474c] hover:text-[#191c1d] transition-colors"
            title="Next"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Days View */}
        {pickerMode === 'days' && (
          <>
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d} className="text-[11px] font-bold text-[#74777d]">
                  {d}
                </span>
              ))}
            </div>

            {/* Date Grid */}
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-8" />;
                }

                const dayStr = formatDateStr(viewYear, viewMonth, day);
                const isStart = tempStart === dayStr;
                const isEnd = tempEnd === dayStr || (!tempEnd && isStart);

                let inRange = false;
                if (tempStart && tempEnd) {
                  inRange = dayStr >= tempStart && dayStr <= tempEnd;
                } else if (tempStart && hoverDate) {
                  const minDate = tempStart < hoverDate ? tempStart : hoverDate;
                  const maxDate = tempStart < hoverDate ? hoverDate : tempStart;
                  inRange = dayStr >= minDate && dayStr <= maxDate;
                }

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => handleDayClick(dayStr)}
                    onMouseEnter={() => setHoverDate(dayStr)}
                    className={`h-8 w-full text-xs font-bold transition-all relative flex items-center justify-center ${
                      isStart || isEnd
                        ? 'bg-[#006397] text-white rounded-lg shadow-2xs z-10'
                        : inRange
                        ? 'bg-[#006397]/15 text-[#006397]'
                        : 'hover:bg-[#f3f4f5] text-[#191c1d] rounded-lg'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Months Selection View */}
        {pickerMode === 'months' && (
          <div className="grid grid-cols-3 gap-2.5 py-1.5 h-[236px] items-center">
            {months.map((m, idx) => {
              const isSelected = viewMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewMonth(idx);
                    setPickerMode('days');
                  }}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-[#006397] text-white border-[#006397] shadow-2xs'
                      : 'bg-[#f3f4f5] hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#c4c6cd]/20'
                  }`}
                >
                  {shortMonths[idx]}
                </button>
              );
            })}
          </div>
        )}

        {/* Years Selection View */}
        {pickerMode === 'years' && (
          <div className="grid grid-cols-3 gap-2.5 py-1.5 h-[236px] items-center">
            {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
              const isSelected = viewYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setPickerMode('months');
                  }}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-[#006397] text-white border-[#006397] shadow-2xs'
                      : 'bg-[#f3f4f5] hover:bg-[#006397]/10 hover:text-[#006397] text-[#191c1d] border-[#c4c6cd]/20'
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#e1e3e4]">
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 text-xs font-semibold text-[#74777d] hover:text-[#191c1d] hover:bg-[#f3f4f5] rounded-xl transition-colors"
        >
          Clear
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#44474c] bg-[#f3f4f5] hover:bg-[#e1e3e4] rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          className="px-4 py-1.5 text-xs font-bold text-white bg-[#006397] hover:bg-[#00476e] rounded-xl transition-colors shadow-2xs"
        >
          Apply Range
        </button>
      </div>
    </div>
  );
};
