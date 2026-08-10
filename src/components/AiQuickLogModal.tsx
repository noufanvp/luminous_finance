import React, { useState, useRef } from 'react';
import { CategoryTemplate, BankAccount } from '../types';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  parseNaturalLanguageTransaction,
  parseReceiptImage,
  ParsedAiTransaction,
} from '../services/gemini';

interface AiQuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryTemplate[];
  accounts: BankAccount[];
  onApplyParsedTransaction: (parsed: ParsedAiTransaction) => void;
  currencySymbol?: string;
}

export const AiQuickLogModal: React.FC<AiQuickLogModalProps> = ({
  isOpen,
  onClose,
  categories,
  accounts,
  onApplyParsedTransaction,
  currencySymbol = '$',
}) => {
  const [activeMode, setActiveMode] = useState<'text' | 'receipt'>('text');
  const [promptText, setPromptText] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedAiTransaction | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const hasApiKey = Boolean(getGeminiApiKey());

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput);
    setShowKeyConfig(false);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select a valid image file (JPEG, PNG, WebP).');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessText = async () => {
    if (!promptText.trim()) {
      setErrorMsg('Please enter a natural language description (e.g. "Spent $24 on groceries at Target").');
      return;
    }
    if (!hasApiKey && !apiKeyInput.trim()) {
      setShowKeyConfig(true);
      setErrorMsg('Please provide a Gemini API Key to use AI parsing.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setParsedResult(null);

    try {
      if (apiKeyInput.trim()) setGeminiApiKey(apiKeyInput);
      const result = await parseNaturalLanguageTransaction(promptText, categories, accounts);
      setParsedResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process natural language input.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessReceipt = async () => {
    if (!selectedFile || !imagePreviewUrl) {
      setErrorMsg('Please select or upload a receipt photo.');
      return;
    }
    if (!hasApiKey && !apiKeyInput.trim()) {
      setShowKeyConfig(true);
      setErrorMsg('Please provide a Gemini API Key to use receipt scanning.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setParsedResult(null);

    try {
      if (apiKeyInput.trim()) setGeminiApiKey(apiKeyInput);
      const result = await parseReceiptImage(imagePreviewUrl, selectedFile.type, categories, accounts);
      setParsedResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process receipt image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedResult) {
      onApplyParsedTransaction(parsedResult);
      onClose();
    }
  };

  const presetExamples = [
    'Spent $24.50 on groceries at Target today',
    'Paid $85.00 for electricity bill yesterday',
    'Received $3,200 salary from Acme Corp',
    'Transferred $150 from Checking to Savings',
    'Dinner at Italian Bistro for $42.80 with John',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#c4c6cd]/30">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#00476e] to-[#006397] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md">
              <span className="material-symbols-outlined text-[22px] text-[#92ccff]">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                Gemini AI Smart Assist
              </h2>
              <p className="text-xs text-[#92ccff] font-medium">
                Instant receipt OCR & natural language parser
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* API Key Banner / Settings Toggle */}
        <div className="px-4 py-2 bg-[#f0f4f8] border-b border-[#d8e3ed] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-[#00a656]' : 'bg-[#ba1a1a]'}`} />
            <span className="font-semibold text-[#44474c]">
              {hasApiKey ? 'Gemini API Key Active' : 'API Key Required'}
            </span>
          </div>
          <button
            onClick={() => setShowKeyConfig((prev) => !prev)}
            className="text-[#006397] hover:underline font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">key</span>
            <span>{showKeyConfig ? 'Hide Key Config' : 'Configure Key'}</span>
          </button>
        </div>

        {/* API Key Configuration Collapsible Box */}
        {showKeyConfig && (
          <div className="p-4 bg-[#fff8f6] border-b border-[#ffdad6] flex flex-col gap-2.5">
            <div className="text-xs font-semibold text-[#93000a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>Gemini API Key Configuration</span>
            </div>
            <p className="text-[11px] text-[#44474c]">
              Enter your Gemini API key from Google AI Studio. It will be stored safely in your browser local storage.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-2 text-xs border border-[#c4c6cd] rounded-xl focus:outline-none focus:border-[#006397] bg-white font-mono"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-[#006397] text-white text-xs font-bold rounded-xl hover:bg-[#00476e] transition-colors shrink-0"
              >
                Save Key
              </button>
            </div>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="p-4 pb-2 flex border-b border-[#f0f1f2] gap-2 bg-[#f8f9fa]">
          <button
            onClick={() => {
              setActiveMode('text');
              setErrorMsg(null);
              setParsedResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeMode === 'text'
                ? 'bg-white text-[#006397] shadow-xs border border-[#006397]/20'
                : 'text-[#74777d] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">chat_spark</span>
            <span>Natural Language</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('receipt');
              setErrorMsg(null);
              setParsedResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeMode === 'receipt'
                ? 'bg-white text-[#006397] shadow-xs border border-[#006397]/20'
                : 'text-[#74777d] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Scan Receipt Photo</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          
          {/* Mode 1: Natural Language Prompt */}
          {activeMode === 'text' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-[#041627] flex items-center justify-between">
                <span>Describe your transaction in plain language:</span>
                <span className="text-[11px] text-[#74777d] font-normal">Gemini 2.5 Flash</span>
              </label>

              <div className="relative">
                <textarea
                  rows={3}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="e.g. Spent $32.40 on groceries at Whole Foods yesterday"
                  className="w-full p-3 text-xs sm:text-sm border border-[#c4c6cd] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#006397]/30 focus:border-[#006397] bg-white resize-none"
                />
              </div>

              {/* Preset Chips */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-[#74777d] uppercase tracking-wider">
                  Try examples:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presetExamples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setPromptText(ex)}
                      className="px-2.5 py-1 bg-[#f0f2f5] hover:bg-[#e1e4e8] text-[#44474c] text-[11px] font-medium rounded-lg transition-colors text-left"
                    >
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleProcessText}
                disabled={isLoading || !promptText.trim()}
                className="w-full py-2.5 px-4 bg-[#006397] hover:bg-[#00476e] text-white text-xs font-bold rounded-2xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    <span>Parse Transaction</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Mode 2: Receipt Image Upload */}
          {activeMode === 'receipt' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-[#041627]">
                Upload or take a photo of your receipt / invoice:
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreviewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#c4c6cd] bg-[#f8f9fa] max-h-[200px] flex items-center justify-center p-2">
                  <img
                    src={imagePreviewUrl}
                    alt="Receipt preview"
                    className="max-h-[185px] object-contain rounded-lg shadow-2xs"
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreviewUrl(null);
                      setParsedResult(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#c4c6cd] hover:border-[#006397] bg-[#f8f9fa] hover:bg-[#f0f4f8] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-[#006397]/10 text-[#006397] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#041627]">Click to select receipt image</p>
                    <p className="text-[11px] text-[#74777d]">Supports JPEG, PNG, WebP up to 10MB</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleProcessReceipt}
                disabled={isLoading || !imagePreviewUrl}
                className="w-full py-2.5 px-4 bg-[#006397] hover:bg-[#00476e] text-white text-xs font-bold rounded-2xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Receipt with Gemini...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                    <span>Scan & Extract Details</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-[#fff8f6] border border-[#ffdad6] rounded-2xl text-xs text-[#ba1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Preview Card */}
          {parsedResult && (
            <div className="mt-2 p-4 bg-[#f0f7ff] border border-[#92ccff]/50 rounded-2xl flex flex-col gap-3 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between border-b border-[#92ccff]/30 pb-2">
                <span className="text-xs font-extrabold text-[#00476e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#006397]">check_circle</span>
                  AI Extracted Details
                </span>
                <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#006397]/15 text-[#006397]">
                  {parsedResult.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#74777d] block text-[10px] uppercase font-bold">Amount</span>
                  <span className="text-base font-extrabold text-[#041627]">
                    {currencySymbol}{parsedResult.amount.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[#74777d] block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-bold text-[#006397]">{parsedResult.category}</span>
                </div>

                <div>
                  <span className="text-[#74777d] block text-[10px] uppercase font-bold">Payee / Merchant</span>
                  <span className="font-semibold text-[#041627]">{parsedResult.payee || parsedResult.title || '—'}</span>
                </div>

                <div>
                  <span className="text-[#74777d] block text-[10px] uppercase font-bold">Date</span>
                  <span className="font-semibold text-[#041627]">{parsedResult.date}</span>
                </div>
              </div>

              {parsedResult.memo && (
                <div className="pt-2 border-t border-[#92ccff]/30 text-xs">
                  <span className="text-[#74777d] block text-[10px] uppercase font-bold">Itemized Details / Memo</span>
                  <p className="text-[#041627] text-[11px] font-medium leading-relaxed mt-0.5">
                    {parsedResult.memo}
                  </p>
                </div>
              )}

              <button
                onClick={handleApply}
                className="w-full py-2.5 bg-[#00a656] hover:bg-[#008a46] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">file_download_done</span>
                <span>Apply to Transaction Entry Form</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
