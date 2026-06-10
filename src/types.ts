/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReceiptItem {
  name: string;
  quantity?: number;
  price: number;
}

export interface ReceiptSession {
  id: string;
  name: string;
  createdAt: string;
}

export interface ReceiptData {
  id: string;
  vendor: string;
  amount: number;
  tax: number;
  category: ExpenseCategory;
  date: string;
  currency: string;
  rawNotes: string;
  items?: ReceiptItem[];
}

export type ExpenseCategory =
  | "Food & Dining"
  | "Travel"
  | "Lodging"
  | "Office Supplies"
  | "Electronics"
  | "Utilities"
  | "Entertainment"
  | "Other";

export interface BatchTask {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  previewUrl: string;
  base64Data: string; // inline base64
  status: "idle" | "uploading" | "extracting" | "verifying" | "completed" | "failed";
  error?: string;
  extractedData?: ReceiptData;
}

export interface SecuritySettings {
  encryptStorage: boolean;
  passphrase?: string; // key for visual feedback / local AES
  isTemporary: boolean; // Ephemeral flag (wipe on tab close or session end)
  autoShredDelayMs: number; // 0 for disabled, or time such as 15m, 1h, 24h
}

export interface SavedLedger {
  id: string;
  sessionId: string;
  sessionName: string;
  saveName: string;
  savedAt: string;
  receipts: ReceiptData[];
  totalAmount: number;
  totalTax: number;
  itemCount: number;
}

