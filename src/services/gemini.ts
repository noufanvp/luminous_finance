import { GoogleGenAI } from '@google/genai';
import { CategoryTemplate, BankAccount } from '../types';

const LOCAL_STORAGE_KEY = 'luminous_gemini_api_key';

/**
 * Retrieves the current Gemini API Key from localStorage or environment variables.
 */
export function getGeminiApiKey(): string {
  const customKey = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  
  // Read from Vite process.env define or import.meta.env
  const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY)
    ? process.env.GEMINI_API_KEY
    : (import.meta.env?.VITE_GEMINI_API_KEY || '');
    
  return envKey || '';
}

/**
 * Saves a custom user Gemini API key to localStorage.
 */
export function setGeminiApiKey(key: string): void {
  if (!key || key.trim() === '') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } else {
    localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  }
}

export interface ParsedAiTransaction {
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category: string;
  title: string;
  memo?: string;
  payee?: string;
  date?: string; // 'Today', 'Yesterday', or 'YYYY-MM-DD'
  accountName?: string;
  toAccountName?: string;
  rawExpression?: string;
}

/**
 * Parses natural language input (e.g. "Spent $24 on groceries at Target today") into a structured transaction.
 */
export async function parseNaturalLanguageTransaction(
  prompt: string,
  categories: CategoryTemplate[],
  accounts: BankAccount[] = []
): Promise<ParsedAiTransaction> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure your API key in Settings or AI Assist.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const categoryNames = categories.map((c) => c.name).join(', ');
  const accountNames = accounts.map((a) => a.name).join(', ');

  const systemInstruction = `You are a financial AI parsing assistant for Luminous Finance.
Your task is to analyze user natural language financial logs and extract structured transaction details.

Available Categories: [${categoryNames || 'Groceries, Food, Dining, Transport, Rent, Health, Clothing, Salary, Other'}]
Available Accounts: [${accountNames || 'Checking, Savings, Cash, Credit Card'}]

Return ONLY a valid JSON object matching this schema:
{
  "amount": number (e.g. 24.50),
  "type": "expense" | "income" | "transfer",
  "category": string (must closely match one of the Available Categories or fallback to 'Other'),
  "title": string (short descriptive title e.g. "Target Groceries" or "Salary Deposit"),
  "memo": string (optional notes or extra item details),
  "payee": string (optional store name, vendor, or person e.g. "Target", "Starbucks", "John"),
  "date": string ("Today", "Yesterday", or ISO "YYYY-MM-DD"),
  "accountName": string (optional name of account matched from Available Accounts),
  "toAccountName": string (optional target account name if type is transfer)
}

Important Rules:
1. Always calculate the final numeric total amount.
2. If the user mentions transferring money from one account to another, set type="transfer".
3. If money is received/earned, set type="income". Otherwise set type="expense".
4. Choose the best matching category from Available Categories.
5. If date is not explicitly specified, default to "Today".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nUser Input: "${prompt}"` }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsed: ParsedAiTransaction = JSON.parse(responseText);

    // Sanitize values
    return {
      amount: Math.abs(parsed.amount || 0),
      type: ['expense', 'income', 'transfer'].includes(parsed.type) ? parsed.type : 'expense',
      category: parsed.category || (categories[0]?.name || 'Groceries'),
      title: parsed.title || parsed.category || 'Transaction',
      memo: parsed.memo || '',
      payee: parsed.payee || '',
      date: parsed.date || 'Today',
      accountName: parsed.accountName || '',
      toAccountName: parsed.toAccountName || '',
    };
  } catch (err: any) {
    console.error('Gemini Natural Language parsing error:', err);
    throw new Error(err?.message || 'Failed to parse natural language log with Gemini AI.');
  }
}

/**
 * Parses a receipt or invoice image into structured transaction data.
 */
export async function parseReceiptImage(
  base64Data: string,
  mimeType: string,
  categories: CategoryTemplate[],
  accounts: BankAccount[] = []
): Promise<ParsedAiTransaction> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure your API key in Settings or AI Assist.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const categoryNames = categories.map((c) => c.name).join(', ');
  const accountNames = accounts.map((a) => a.name).join(', ');

  // Clean base64 string if data URL prefix exists
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const promptText = `Analyze this receipt or invoice image carefully and extract financial transaction details into JSON.

Available Categories: [${categoryNames || 'Groceries, Food, Dining, Transport, Rent, Health, Clothing, Salary, Other'}]
Available Accounts: [${accountNames || 'Checking, Savings, Cash, Credit Card'}]

Return ONLY a valid JSON object matching this schema:
{
  "amount": number (total amount paid, e.g. 45.90),
  "type": "expense",
  "category": string (best matching category from Available Categories),
  "title": string (Merchant or Store name + short summary e.g. "Target - Household Goods"),
  "memo": string (Itemized list of top items purchased with prices e.g. "Milk ($3.50), Bread ($2.20), Towels ($12.00)"),
  "payee": string (Merchant / Store / Vendor Name),
  "date": string ("Today", "Yesterday", or "YYYY-MM-DD" matching receipt date if visible),
  "accountName": string (optional matching account name if card/payment method on receipt matches an account)
}

Important Rules:
1. Extract the GRAND TOTAL amount accurately.
2. Extract the Merchant / Vendor name for payee and title.
3. List key purchased items in the memo.
4. Match to the most appropriate category from the list above.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            { text: promptText },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsed: ParsedAiTransaction = JSON.parse(responseText);

    return {
      amount: Math.abs(parsed.amount || 0),
      type: 'expense',
      category: parsed.category || 'Groceries',
      title: parsed.title || parsed.payee || 'Receipt Purchase',
      memo: parsed.memo || '',
      payee: parsed.payee || '',
      date: parsed.date || 'Today',
      accountName: parsed.accountName || '',
    };
  } catch (err: any) {
    console.error('Gemini Receipt image parsing error:', err);
    throw new Error(err?.message || 'Failed to analyze receipt image with Gemini AI.');
  }
}
