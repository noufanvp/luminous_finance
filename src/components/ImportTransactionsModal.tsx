import React, { useState, useRef } from 'react';
import { Transaction, TransactionType, BankAccount } from '../types';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (imported: Transaction[], replaceAll: boolean) => void;
  accounts?: BankAccount[];
}

export const ImportTransactionsModal: React.FC<ImportTransactionsModalProps> = ({
  isOpen,
  onClose,
  onImport,
  accounts = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  // Helper to parse CSV text into transactions
  const parseCSV = (csvText: string) => {
    try {
      setParseError('');
      setIsSuccess(false);

      const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        setParseError('The file seems empty or contains no transaction rows.');
        setParsedTransactions([]);
        return;
      }

      // Parse headers
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const rawHeaders = parseLine(lines[0]);
      const headers = rawHeaders.map((h) => h.toLowerCase());

      // Helper column locator
      const findIndex = (names: string[]) => {
        return headers.findIndex((h) => names.some((n) => h.includes(n)));
      };

      const idIdx = findIndex(['id']);
      const dateIdx = findIndex(['date', 'time', 'day']);
      const typeIdx = findIndex(['type', 'kind']);
      const titleIdx = findIndex(['title', 'description', 'name']);
      const catIdx = findIndex(['category', 'cat']);
      const amountIdx = findIndex(['amount', 'value', 'price', 'total']);
      const debitIdx = findIndex(['debit', 'spent', 'withdrawal']);
      const creditIdx = findIndex(['credit', 'received', 'deposit']);
      const accountIdx = findIndex(['account', 'bank']);
      const memoIdx = findIndex(['memo', 'note', 'comment']);
      const payeeIdx = findIndex(['payee', 'merchant', 'person', 'tag', 'purpose']);

      const parsedList: Transaction[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

        // Extract raw fields
        const idVal = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        const dateVal = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString().slice(0, 10);
        const payeeVal = payeeIdx !== -1 && cols[payeeIdx] ? cols[payeeIdx] : '';
        const titleVal = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : (payeeVal || `Imported Item ${i}`);
        const catVal = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'Other';
        const memoVal = memoIdx !== -1 && cols[memoIdx] ? cols[memoIdx] : '';
        const accountVal = accountIdx !== -1 && cols[accountIdx] ? cols[accountIdx] : '';

        // Match account by name or id if available
        let resolvedAccountId = targetAccountId || undefined;
        if (accountVal && accounts && accounts.length > 0) {
          const matched = accounts.find(
            (a) => a.name.toLowerCase() === accountVal.toLowerCase() || a.id.toLowerCase() === accountVal.toLowerCase()
          );
          if (matched) {
            resolvedAccountId = matched.id;
          }
        }

        // Determine Type & Amount
        let typeVal: TransactionType = 'expense';
        let rawAmount = 0;

        // 1. Check if type column specifies income/expense
        if (typeIdx !== -1 && cols[typeIdx]) {
          const typeStr = cols[typeIdx].toLowerCase();
          if (typeStr.includes('income') || typeStr.includes('deposit') || typeStr.includes('credit')) {
            typeVal = 'income';
          } else if (typeStr.includes('transfer')) {
            typeVal = 'transfer';
          } else {
            typeVal = 'expense';
          }
        }

        // 2. Check Debit / Credit columns
        if (debitIdx !== -1 && cols[debitIdx] && parseFloat(cols[debitIdx])) {
          rawAmount = Math.abs(parseFloat(cols[debitIdx]));
          typeVal = 'expense';
        } else if (creditIdx !== -1 && cols[creditIdx] && parseFloat(cols[creditIdx])) {
          rawAmount = Math.abs(parseFloat(cols[creditIdx]));
          typeVal = 'income';
        } else if (amountIdx !== -1 && cols[amountIdx]) {
          const num = parseFloat(cols[amountIdx].replace(/[^0-9.-]+/g, ''));
          if (!isNaN(num)) {
            if (num < 0) {
              typeVal = 'expense';
              rawAmount = Math.abs(num);
            } else {
              rawAmount = num;
              if (typeIdx === -1) {
                // If type not specified and amount > 0, default to expense unless marked income
                typeVal = typeVal === 'income' ? 'income' : 'expense';
              }
            }
          }
        }

        if (isNaN(rawAmount) || rawAmount <= 0) {
          rawAmount = 0.01; // fallback minimal positive amount
        }

        // Format date string cleanly
        let cleanDate = dateVal;
        if (!cleanDate || cleanDate === 'Invalid Date') {
          cleanDate = new Date().toISOString().slice(0, 10);
        }

        parsedList.push({
          id: idVal,
          type: typeVal,
          category: catVal || 'Other',
          title: titleVal || 'Imported Transaction',
          amount: Math.round(rawAmount * 100) / 100,
          date: cleanDate,
          memo: memoVal,
          payee: payeeVal,
          person: payeeVal,
          accountId: resolvedAccountId,
        });
      }

      if (parsedList.length === 0) {
        setParseError('Could not extract any valid transactions from the file.');
        setParsedTransactions([]);
      } else {
        setParsedTransactions(parsedList);
      }
    } catch (err) {
      console.error(err);
      setParseError('Failed to parse CSV file. Please ensure it is a valid CSV format.');
      setParsedTransactions([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmImport = () => {
    if (parsedTransactions.length === 0) return;

    // Apply account ID if selected
    const finalTransactions = parsedTransactions.map((tx) => ({
      ...tx,
      accountId: targetAccountId || tx.accountId,
    }));

    onImport(finalTransactions, importMode === 'replace');
    setImportedCount(finalTransactions.length);
    setIsSuccess(true);

    setTimeout(() => {
      onClose();
      // Reset state after close
      setParsedTransactions([]);
      setFileName('');
      setIsSuccess(false);
    }, 1500);
  };

  const handleDownloadSample = () => {
    const sampleHeaders = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Account', 'Memo', 'Payee'];
    const sampleRows = [
      ['tx-001', '2026-08-01', 'expense', 'Supermarket Supplies', 'Groceries', '65.50', 'Chase Checking', 'Weekly restocking', "Trader Joe's"],
      ['tx-002', '2026-08-02', 'income', 'Monthly Paycheck', 'Salary', '3200.00', 'Chase Checking', 'Direct deposit', 'Acme Corp'],
      ['tx-003', '2026-08-03', 'expense', 'Italian Bistro', 'Dining Out', '42.00', 'Sapphire Preferred', 'Dinner with team', "Luigi's Bistro"],
      ['tx-004', '2026-08-05', 'expense', 'Electric Bill', 'Utilities & Bills', '85.20', 'Chase Checking', 'August power bill', 'City Power'],
    ];

    const content = 'data:text/csv;charset=utf-8,' + [sampleHeaders.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const encoded = encodeURI(content);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = 'sample_luminous_transactions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#e1e3e4] max-h-[90vh] flex flex-col justify-between overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#f0f4f8] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006397]/10 text-[#006397] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">file_upload</span>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#041627]">Import Transactions</h3>
              <p className="text-xs text-[#44474c]">Upload CSV file to import transactions into your ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#44474c] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Success Banner */}
          {isSuccess ? (
            <div className="bg-[#00a656]/15 border border-[#00a656]/30 text-[#008243] p-4 rounded-2xl flex items-center gap-3 animate-fadeIn">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
              <div>
                <h4 className="font-bold text-sm">Import Successful!</h4>
                <p className="text-xs mt-0.5">Successfully imported {importedCount} transaction(s) into your ledger.</p>
              </div>
            </div>
          ) : (
            <>
              {/* File Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-[#006397] bg-[#006397]/5 scale-[0.99]'
                    : fileName
                    ? 'border-[#00a656] bg-[#00a656]/5'
                    : 'border-[#c4c6cd] hover:border-[#006397] hover:bg-[#f8f9fa]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <span className={`material-symbols-outlined text-[36px] ${
                  fileName ? 'text-[#00a656]' : 'text-[#006397]'
                }`}>
                  {fileName ? 'task_check' : 'cloud_upload'}
                </span>

                {fileName ? (
                  <div>
                    <p className="text-sm font-bold text-[#041627]">{fileName}</p>
                    <p className="text-xs text-[#00a656] font-semibold mt-0.5">File loaded and parsed</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-[#041627]">Click to upload or drag & drop CSV file</p>
                    <p className="text-xs text-[#74777d] mt-1">Supports exported CSVs from banks, Excel, or Luminous Finance</p>
                  </div>
                )}
              </div>

              {/* Sample Download Prompt */}
              <div className="flex items-center justify-between text-xs bg-[#f8f9fa] p-3 rounded-xl border border-[#e1e3e4]">
                <span className="text-[#44474c]">Need a template to test or format your data?</span>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="text-[#006397] font-bold hover:underline flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  Sample CSV Template
                </button>
              </div>

              {/* Parse Error Message */}
              {parseError && (
                <div className="p-3 rounded-xl bg-[#ba1a1a]/15 border border-[#ba1a1a]/30 text-[#ba1a1a] text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{parseError}</span>
                </div>
              )}

              {/* Preview & Options when Transactions are Parsed */}
              {parsedTransactions.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-[#f0f4f8]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#041627] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#00a656] text-[16px]">verified</span>
                      <span>Parsed {parsedTransactions.length} Transaction(s)</span>
                    </h4>

                    {/* Import Mode Selector */}
                    <div className="flex items-center gap-2 bg-[#f0f4f8] p-1 rounded-xl border border-[#e1e3e4] text-xs">
                      <button
                        type="button"
                        onClick={() => setImportMode('append')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          importMode === 'append'
                            ? 'bg-[#006397] text-white shadow-xs'
                            : 'text-[#44474c] hover:text-[#041627]'
                        }`}
                      >
                        Append to Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          importMode === 'replace'
                            ? 'bg-[#ba1a1a] text-white shadow-xs'
                            : 'text-[#44474c] hover:text-[#041627]'
                        }`}
                      >
                        Replace All
                      </button>
                    </div>
                  </div>

                  {/* Account Link Selection (Optional) */}
                  {accounts.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="text-[#44474c] font-semibold shrink-0">Link to Account (Optional):</label>
                      <select
                        value={targetAccountId}
                        onChange={(e) => setTargetAccountId(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#f0f4f8] border border-[#e1e3e4] rounded-xl text-[#041627] font-semibold focus:outline-none focus:ring-1 focus:ring-[#006397]"
                      >
                        <option value="">-- Unassigned / General --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.institution ? `${acc.institution} • ` : ''}${acc.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Transactions Preview Table */}
                  <div className="max-h-48 overflow-y-auto rounded-2xl border border-[#e1e3e4] bg-[#f8f9fa]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f0f4f8] text-[#44474c] font-bold sticky top-0 border-b border-[#e1e3e4]">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Title</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e1e3e4]">
                        {parsedTransactions.slice(0, 15).map((tx, idx) => (
                          <tr key={idx} className="hover:bg-white transition-colors">
                            <td className="p-2.5 font-mono text-[#74777d]">{tx.date}</td>
                            <td className="p-2.5 font-bold text-[#041627]">{tx.title}</td>
                            <td className="p-2.5 text-[#44474c]">
                              <span className="px-2 py-0.5 rounded-md bg-white border border-[#e1e3e4] text-[11px]">
                                {tx.category}
                              </span>
                            </td>
                            <td className={`p-2.5 text-right font-mono font-bold ${
                              tx.type === 'income' ? 'text-[#00a656]' : 'text-[#ba1a1a]'
                            }`}>
                              {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedTransactions.length > 15 && (
                      <p className="text-[11px] text-center text-[#74777d] py-2 bg-[#f0f4f8] font-medium border-t border-[#e1e3e4]">
                        + {parsedTransactions.length - 15} more transactions will be imported
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#f0f4f8] pt-3 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#f0f4f8] hover:bg-[#e1e3e4] text-[#44474c] font-bold text-xs transition-all"
          >
            Cancel
          </button>
          {!isSuccess && (
            <button
              type="button"
              disabled={parsedTransactions.length === 0}
              onClick={handleConfirmImport}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-xs flex items-center gap-1.5 ${
                parsedTransactions.length > 0
                  ? 'bg-[#006397] hover:bg-[#00476e] active:scale-95'
                  : 'bg-[#c4c6cd] cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">file_upload</span>
              <span>Import {parsedTransactions.length > 0 ? `${parsedTransactions.length} Items` : ''}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
