/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Download, Send, Search, Trash2, SlidersHorizontal, ArrowUpDown, Filter, RefreshCw, ChevronDown, ChevronUp, ShoppingBag, AlertTriangle, CheckSquare, Square, Calendar, Info, Eye, EyeOff, Save } from "lucide-react";
import { ReceiptData, ExpenseCategory } from "../types";
import { exportReceiptsToCSV } from "../utils/csv";
import { trackPendoEvent } from "../lib/pendo";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "Fr",
  CNY: "¥",
  ZMW: "K",
  ZAR: "R",
};

interface ReceiptListProps {
  receipts: ReceiptData[];
  onDeleteReceipt: (id: string) => void;
  onDeleteReceipts: (ids: string[]) => void;
  onUpdateReceiptsCategory: (ids: string[], category: ExpenseCategory) => void;
  exchangeRates?: Record<string, number>;
  onSaveLedger: (saveName: string) => void;
}

export default function ReceiptList({
  receipts,
  onDeleteReceipt,
  onDeleteReceipts,
  onUpdateReceiptsCategory,
  onSaveLedger,
  exchangeRates = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    JPY: 156.4,
    CAD: 1.36,
    AUD: 1.51,
    CHF: 0.90,
    CNY: 7.24,
    ZMW: 26.50,
    ZAR: 18.50,
  },
}: ReceiptListProps) {
  const targetCurrency = "USD";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortField, setSortField] = useState<keyof ReceiptData>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // States & selection helpers for bulk operations
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // States & helper logic for Save Ledger feature
  const [showSaveLedgerModal, setShowSaveLedgerModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveSuccessNotification, setSaveSuccessNotification] = useState(false);

  // States & helper logic for duplicate warning
  const [lastDuplicatesCount, setLastDuplicatesCount] = useState(0);
  const [dismissedDuplicateWarning, setDismissedDuplicateWarning] = useState(false);



  // Currency Converter Helpers
  const getConvertedAmount = (amount: number, fromCurr: string = "USD"): number => {
    const cleanFrom = (fromCurr || "USD").toUpperCase();
    const cleanTo = (targetCurrency || "USD").toUpperCase();
    if (cleanFrom === cleanTo) return amount;

    const rateFrom = exchangeRates[cleanFrom] || 1;
    const rateTo = exchangeRates[cleanTo] || 1;

    const amountInUSD = amount / rateFrom;
    return amountInUSD * rateTo;
  };

  const getConvertedReceiptAmount = (r: ReceiptData) => {
    return getConvertedAmount(r.amount, r.currency);
  };

  const targetCurrencySymbol = CURRENCY_SYMBOLS[targetCurrency] || "$";

  // Duplicate detection helper calculation
  const findDuplicates = (): Record<string, ReceiptData[]> => {
    const groups: Record<string, ReceiptData[]> = {};
    receipts.forEach((r) => {
      const key = `${r.vendor.trim().toLowerCase()}_${r.date}_${r.amount.toFixed(2)}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    const duplicateGroups: Record<string, ReceiptData[]> = {};
    Object.entries(groups).forEach(([key, list]) => {
      if (list.length > 1) {
        duplicateGroups[key] = list;
      }
    });

    return duplicateGroups;
  };

  const duplicateGroups = findDuplicates();
  const duplicateKeys = Object.keys(duplicateGroups);
  const totalDuplicateRecordsCount = duplicateKeys.reduce((sum, key) => sum + duplicateGroups[key].length, 0);
  const distinctDuplicateGroupsCount = duplicateKeys.length;

  useEffect(() => {
    if (totalDuplicateRecordsCount > lastDuplicatesCount) {
      setDismissedDuplicateWarning(false);
    }
    setLastDuplicatesCount(totalDuplicateRecordsCount);
  }, [totalDuplicateRecordsCount, lastDuplicatesCount]);

  const toggleRowExpansion = (id: string, e: React.MouseEvent) => {
    // Avoid expanding if user clicks on the trash or actions directly
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) {
      return;
    }
    if (isSelectMode) {
      toggleSelectId(id);
      return;
    }
    setExpandedReceiptId(expandedReceiptId === id ? null : id);
  };

  // Compute stats converted to base target currency
  const totalSpend = receipts.reduce((sum, r) => sum + getConvertedReceiptAmount(r), 0);
  const totalTax = receipts.reduce((sum, r) => sum + getConvertedAmount(r.tax || 0, r.currency), 0);
  
  // Category distribution
  const categories: ExpenseCategory[] = [
    "Food & Dining", "Travel", "Lodging", "Office Supplies", "Electronics", "Utilities", "Entertainment", "Other"
  ];
  
  const categoryStats = categories.map((cat) => {
    const items = receipts.filter((r) => r.category === cat);
    const sum = items.reduce((s, r) => s + getConvertedReceiptAmount(r), 0);
    const percentage = totalSpend > 0 ? (sum / totalSpend) * 100 : 0;
    return { name: cat, total: sum, percentage };
  }).filter((stat) => stat.total > 0).sort((a, b) => b.total - a.total);

  // Sorting handler
  const handleSort = (field: keyof ReceiptData) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filter & Search implementation
  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.rawNotes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.amount.toString().includes(searchTerm);

    const matchesCategory = selectedCategory === "All" || 
      r.category === selectedCategory ||
      (r.items && r.items.some((item) => item.category === selectedCategory));

    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }
    return sortOrder === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredSelected = filteredReceipts.length > 0 && filteredReceipts.every((r) => selectedIds.has(r.id));
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredReceipts.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredReceipts.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    onDeleteReceipts(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    setShowBulkDeleteConfirm(false);
  };

  const handleBulkCategoryChange = (category: ExpenseCategory) => {
    if (selectedIds.size === 0) return;
    onUpdateReceiptsCategory(Array.from(selectedIds), category);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  // Pure Binary-to-Blob Excel & Google Sheets compliant CSV exporter
  const triggerCSVDownload = () => {
    exportReceiptsToCSV(receipts);
    trackPendoEvent("csv_export_completed", {
      source: "active_ledger",
      receiptCount: receipts.length,
      timestamp: new Date().toISOString(),
    });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Food & Dining": return "bg-amber-500";
      case "Travel": return "bg-blue-500";
      case "Lodging": return "bg-violet-500";
      case "Office Supplies": return "bg-slate-400";
      case "Electronics": return "bg-indigo-500";
      case "Utilities": return "bg-yellow-500";
      case "Entertainment": return "bg-pink-500";
      default: return "bg-teal-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Summary Cards */}
      {receipts.length > 0 && (
        <div id="financial-metrics" className="grid grid-cols-2 gap-3 sm:gap-6 font-sans">
          {/* Total Spend */}
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in duration-300 flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-2 select-none">
              <div className="relative group inline-block">
                <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-505 hover:text-blue-505 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-48 sm:w-64 p-2 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[9.5px] sm:text-[10.5px] text-left">
                  Aggregated from {receipts.length} extracted and saved documents in active local database.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              TOTAL TRACKED
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 mt-auto justify-between w-full">
              <span className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-slate-850 dark:text-slate-100 tracking-tight truncate">
                {targetCurrencySymbol}{totalSpend.toFixed(2)}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Tax: {targetCurrencySymbol}{totalTax.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Custom Sleek Category Progress Bars */}
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 sm:gap-1.5 select-none">
                <div className="relative group inline-block">
                  <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-550 hover:text-blue-550 transition-colors cursor-help shrink-0" />
                  <div className="absolute bottom-full left-0 mb-2 w-48 sm:w-64 p-2 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[9.5px] sm:text-[10.5px] text-left">
                    Track dynamic distribution of overall expenses across defined user category classifications in real-time.
                    <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                  </div>
                </div>
                Budget Distribution
              </span>
            </div>
            {categoryStats.length === 0 ? (
              <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 py-1 sm:py-2">No data yet.</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-2 max-h-[70px] sm:max-h-[85px] overflow-y-auto pr-1 mt-auto">
                {categoryStats.slice(0, 3).map((stat) => (
                  <div key={stat.name} className="space-y-0.5">
                    <div className="flex justify-between items-center text-[9px] xs:text-[10px] sm:text-[11px] text-slate-705 dark:text-slate-305">
                      <span className="font-semibold truncate max-w-[50px] xs:max-w-[70px] sm:max-w-none text-slate-700 dark:text-slate-300">{stat.name}</span>
                      <span className="font-bold shrink-0 text-slate-800 dark:text-slate-205">{targetCurrencySymbol}{stat.total.toFixed(0)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 sm:h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getCategoryColor(stat.name)}`}
                        style={{ width: `${stat.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Category Filter Hub */}
      {receipts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm font-sans space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative group inline-block">
                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                  Perform queries across metadata key tags, filter exact amounts, or narrow the list instantly by category keys.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Filter &amp; Inspect Ledger
              </h3>
            </div>
            {/* Reset / Stat Indicators */}
            {(searchTerm || selectedCategory !== "All") && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Matches: <span className="font-bold text-slate-900 dark:text-slate-100">{filteredReceipts.length}</span> / <span className="text-slate-500 dark:text-slate-450 font-medium">{receipts.length}</span>
                </span>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("All");
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold cursor-pointer underline underline-offset-2 transition-colors ml-1"
                >
                  Reset Active Filters
                </button>
              </div>
            )}
          </div>

          <div>
            {/* Search Box */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search vendor, comments, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50/50 dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-100/30 transition-all font-sans"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-2.5 text-slate-450 hover:text-slate-650 p-0.5 rounded cursor-pointer transition-colors text-xs"
                  title="Clear Search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Sub Row: Categories Selection */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-2 tracking-wider">Fast Category Filter</span>
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto select-none py-0.5 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  selectedCategory === "All"
                    ? "bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                All Receipts
                <span className={`inline-flex items-center justify-center rounded-full text-[10px] px-1.5 py-0.2 font-bold ${
                  selectedCategory === "All" ? "bg-slate-850 dark:bg-blue-700 text-slate-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {receipts.length}
                </span>
              </button>
              {categories.filter((cat) => 
                receipts.some((r) => r.category === cat || (r.items && r.items.some((item) => item.category === cat)))
              ).map((cat) => {
                const countOfCat = receipts.filter((r) => 
                  r.category === cat || (r.items && r.items.some((item) => item.category === cat))
                ).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      selectedCategory === cat
                        ? "bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(cat)}`}></span>
                    {cat}
                    <span className={`inline-flex items-center justify-center rounded-full text-[10px] px-1.5 py-0.2 font-bold ${
                      selectedCategory === cat ? "bg-slate-850 dark:bg-blue-700 text-slate-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      {countOfCat}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
         {/* Main Ledger Head Section with Actions */}
      <div className="bg-white dark:bg-[#0b1220]/72 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2a3e]/80 rounded-2xl overflow-hidden shadow-md">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-[#1e2a3e]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 dark:bg-[#0f172a]/40">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative group inline-block">
                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-56 sm:w-72 p-2 sm:p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10px] sm:text-[10.5px] text-left">
                  Check verified scanned logs database. Fast-export results in native spreadsheet CSV format or change values in batches.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-450 font-sans">
                VERIFIED LEDGER
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium block mt-1">
              {receipts.length} Record{receipts.length !== 1 ? "s" : ""} Pending Export
            </span>
          </div>

          {/* Hub Operations Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap xs:flex-nowrap">
            {/* Select Mode Toggler */}
            <button
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedIds(new Set());
              }}
              className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 ${
                isSelectMode
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-white dark:bg-[#1a2333] border-slate-305 dark:border-[#253247] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1e293b]"
              }`}
              title="Toggle Select Mode for bulk operations"
            >
              <CheckSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Downloader trigger banner */}
            <button
              onClick={triggerCSVDownload}
              disabled={receipts.length === 0}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl font-bold transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px] sm:text-xs"
            >
              <span className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </span>
            </button>

            {/* Save snapshot to saved ledger history */}
            <button
              onClick={() => {
                const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                setSaveName(`Ledger - ${receipts.length} Record${receipts.length !== 1 ? 's' : ''} (${dateStr})`);
                setShowSaveLedgerModal(true);
              }}
              disabled={receipts.length === 0}
              className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-505/20 dark:border-indigo-500/30 rounded-xl font-bold transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[11px] sm:text-xs"
              title="Save current verified state to Saved Ledgers list"
            >
              <span className="flex items-center gap-2">
                {saveSuccessNotification ? (
                  <span className="text-emerald-500">✓ Saved</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Ledger
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {isSelectMode && (
          <div className="mx-3 my-2 sm:mx-5 sm:my-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs font-sans text-[11px] sm:text-xs animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2.5">
              <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-blue-600 rounded-lg text-white font-bold tracking-tight text-[10px] sm:text-[11px] select-none shadow">
                {selectedIds.size} SELECTED
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-blue-900 dark:text-blue-300">
                Choose a command to process selected ledger rows at once.
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Category assign dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 select-none">Assign Category</span>
                <select
                  onChange={(e) => {
                    const cat = e.target.value as ExpenseCategory;
                    if (cat) {
                      handleBulkCategoryChange(cat);
                      e.target.value = "";
                    }
                  }}
                  disabled={selectedIds.size === 0}
                  className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-[11px] sm:text-xs text-slate-805 dark:text-slate-200 focus:ring-2 focus:ring-blue-150 outline-none font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  defaultValue=""
                >
                  <option value="" disabled className="dark:bg-slate-900 dark:text-gray-400">Change...</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-white">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Bulk Delete Button */}
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1 sm:gap-1.5 transition-all text-[11px] sm:text-xs disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer active:scale-98 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Potentially Duplicate Receipts Warning Prompt */}
        {totalDuplicateRecordsCount > 0 && !dismissedDuplicateWarning && (
          <div className="mx-3 my-2 sm:mx-5 sm:my-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-1 duration-200 font-sans">
            <div className="flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-400 text-[10px] sm:text-xs uppercase tracking-wide block">
                  Potential Duplicates Detected
                </span>
                <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 leading-relaxed max-w-2xl font-medium">
                  We identified <strong className="text-amber-950 dark:text-amber-200">{totalDuplicateRecordsCount} entries</strong> spread across <strong className="text-amber-950 dark:text-amber-200">{distinctDuplicateGroupsCount} match groups</strong> with matching merchants, identical transaction dates, and exact amount parameters. Review each highlighted entry.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setDismissedDuplicateWarning(true)}
                className="px-2 py-1 sm:px-3 sm:py-1.5 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-900/40 text-amber-805 dark:text-amber-400 text-[10px] sm:text-xs font-bold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/40 cursor-pointer transition-colors shadow-2xs"
              >
                Hide Warning
              </button>
            </div>
          </div>
        )}
             {/* Dynamic Receipts Ledger Table */}
        {filteredReceipts.length === 0 ? (
          <div className="p-12 text-center font-sans">
            <SlidersHorizontal className="w-8 h-8 text-slate-350 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-650 dark:text-slate-305">
              {receipts.length === 0 ? "Ledger is currently empty" : "No matching records found"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-sm mx-auto select-none leading-relaxed">
              {receipts.length === 0
                ? "Drop screenshot files in the space above to execute instantaneous parsing and OCR."
                : "Try shifting pills or widening search terms to discover saved metadata."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1e2a3e]/80 bg-slate-50/50 dark:bg-[#070d19]/60 font-sans font-bold text-slate-400 dark:text-slate-400 select-none uppercase tracking-wider text-[10px] sm:text-xs">
                  <th className="w-10 px-3 sm:px-4 py-3 sm:py-4 text-center select-none font-sans">
                    {isSelectMode ? (
                      <input
                        type="checkbox"
                        checked={filteredReceipts.length > 0 && filteredReceipts.every((r) => selectedIds.has(r.id))}
                        onChange={handleSelectAllFiltered}
                        className="w-4 h-4 text-[#00A3FF] bg-white dark:bg-[#090f1d] border-slate-300 dark:border-slate-800 rounded focus:ring-[#00A3FF]/25 cursor-pointer"
                        title="Select/Deselect All filtered items"
                      />
                    ) : null}
                  </th>
                  <th 
                    onClick={() => handleSort("date")} 
                    className="px-3 sm:px-5 py-3.5 sm:py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#1a2333]/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-sans font-extrabold tracking-wider">
                      Date <ArrowUpDown className="w-3.5 h-3.5 text-[#00A3FF]" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("vendor")} 
                    className="px-3 sm:px-5 py-3.5 sm:py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#1a2333]/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-sans font-extrabold tracking-wider">
                      Merchant <ArrowUpDown className="w-3.5 h-3.5 text-[#00A3FF]" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("category")} 
                    className="px-3 sm:px-5 py-3.5 sm:py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#1a2333]/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-sans font-extrabold tracking-wider">
                      Category <ArrowUpDown className="w-3.5 h-3.5 text-[#00A3FF]" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("amount")} 
                    className="px-3 sm:px-5 py-3.5 sm:py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#1a2333]/40 transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5 font-sans font-extrabold tracking-wider">
                      Total <ArrowUpDown className="w-3.5 h-3.5 text-[#00A3FF]" />
                    </div>
                  </th>
                  <th className="px-3 sm:px-5 py-3.5 sm:py-4 text-center font-sans font-extrabold tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-sans text-slate-700 dark:text-slate-300">
                {filteredReceipts.map((r) => {
                  const hasItems = r.items && r.items.length > 0;
                  const isExpanded = expandedReceiptId === r.id;
                  const isSelected = selectedIds.has(r.id);
                  const isDuplicate = Object.values(duplicateGroups).some((group) =>
                     group.some((gItem) => gItem.id === r.id)
                  );
                  return (
                    <React.Fragment key={r.id}>
                      <tr 
                        onClick={(e) => {
                          if (isSelectMode) {
                            toggleSelectId(r.id);
                          } else {
                            toggleRowExpansion(r.id, e);
                          }
                        }}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300 cursor-pointer select-none ${
                          isExpanded ? "bg-slate-50 dark:bg-slate-800 font-medium" : ""
                        } ${isSelectMode && isSelected ? "bg-blue-50/55 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 text-slate-900 dark:text-slate-100 font-semibold" : ""}`}
                      >
                        {/* Toggle Arrow/Checkbox Column */}
                        <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-center text-slate-400">
                          {isSelectMode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 rounded focus:ring-blue-505/25 cursor-pointer pointer-events-none"
                            />
                          ) : isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto text-blue-600 animate-pulse" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto hover:text-slate-600" />
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-2.5 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs">
                          {r.date}
                        </td>

                        {/* Vendor */}
                        <td className="px-2.5 sm:px-5 py-2.5 sm:py-3 font-bold text-slate-900 dark:text-slate-100 max-w-[80px] xs:max-w-[120px] sm:max-w-[155px] truncate text-[11px] sm:text-xs">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5 truncate">
                              {r.vendor}
                              {isDuplicate && (
                                <AlertTriangle 
                                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" 
                                  title="Duplicate detected: matching vendor name, transaction date, and receipt amount parameters!"
                                />
                              )}
                            </span>
                            {isDuplicate && (
                              <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 font-sans tracking-wide">
                                POTENTIAL DUPLICATE
                              </span>
                            )}
                            {hasItems && (
                              <span className="text-[9px] sm:text-[10px] font-semibold text-blue-600 dark:text-blue-400 font-sans underline underline-offset-1 mt-0.5">
                                {r.items!.length} line item{r.items!.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category with inline pill block */}
                        <td className="px-2.5 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-755 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${getCategoryColor(r.category)}`}></span>
                            {r.category}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-2.5 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap font-bold text-right text-slate-900 dark:text-slate-100 font-mono text-[11px] sm:text-xs">
                          <div className="flex flex-col items-end">
                            <span>
                              {CURRENCY_SYMBOLS[r.currency] || ""}{r.amount.toFixed(2)}
                              <span className="text-[10px] text-slate-400 font-bold ml-1 font-sans">{r.currency}</span>
                            </span>
                            {r.tax > 0 && (
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium font-sans">
                                tax: {CURRENCY_SYMBOLS[r.currency] || ""}{r.tax.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Delete entry */}
                        <td className="px-2.5 sm:px-5 py-2.5 sm:py-3 text-center whitespace-nowrap text-slate-300 dark:text-slate-700">
                          {isSelectMode ? (
                            <span className="text-slate-350 dark:text-slate-600 font-semibold font-mono text-[11px] sm:text-xs">-</span>
                          ) : (
                            <button
                              onClick={() => onDeleteReceipt(r.id)}
                              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                              title="Delete ledger entry"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded View for Itemized Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/20 dark:bg-slate-955/10 select-text">
                          <td colSpan={7} className="px-2 sm:px-6 py-2.5 sm:py-4 border-b border-slate-200 dark:border-slate-805">
                            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-5 shadow-2xs max-w-full sm:max-w-3xl mb-1 sm:mb-2 mt-1 animate-in fade-in duration-200 font-sans">
                              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 sm:pb-3 mb-2 sm:mb-3">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5">
                                  <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" /> Itemized List
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded-full border border-slate-250 dark:border-slate-800 font-sans">
                                  {r.items?.length || 0} Record{r.items?.length !== 1 ? "s" : ""}
                                </span>
                              </div>

                              {!r.items || r.items.length === 0 ? (
                                <div className="text-center py-4 bg-slate-50/30 dark:bg-slate-900/10 rounded-lg">
                                  <p className="text-[10px] sm:text-xs text-slate-400 italic font-sans animate-pulse">
                                    No itemized line items details were defined.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-12 gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800 select-none">
                                    <div className="col-span-12 sm:col-span-5 font-sans truncate">Item</div>
                                    <div className="hidden sm:block sm:col-span-3 text-left font-sans truncate">Category</div>
                                    <div className="col-span-4 sm:col-span-1 text-center font-sans truncate">Qty</div>
                                    <div className="col-span-4 sm:col-span-1.5 text-right font-sans font-medium truncate">Price</div>
                                    <div className="col-span-4 sm:col-span-1.5 text-right font-sans font-bold text-slate-900 dark:text-slate-200 truncate">Total</div>
                                  </div>

                                  <div className="divide-y divide-slate-100 dark:divide-slate-805">
                                    {r.items.map((item, idx) => {
                                      const rowSymbol = CURRENCY_SYMBOLS[r.currency || "USD"] || "$";
                                      return (
                                        <div key={idx} className="grid grid-cols-12 gap-1.5 py-2 text-[11px] text-slate-705 dark:text-slate-300 items-start sm:items-center hover:bg-slate-50/40 dark:hover:bg-slate-900/40 rounded px-0.5 transition-colors">
                                          <div className="col-span-12 sm:col-span-5 flex flex-col gap-0.5 justify-center min-w-0">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.name}>
                                              {item.name}
                                            </span>
                                            {/* Mobile category badge */}
                                            <span className="block sm:hidden self-start px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 mt-1 whitespace-nowrap">
                                              {item.category || "Other"}
                                            </span>
                                          </div>
                                          <div className="hidden sm:block sm:col-span-3 text-left truncate">
                                            <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                                              {item.category || "Other"}
                                            </span>
                                          </div>
                                          <div className="col-span-4 sm:col-span-1 text-center font-mono font-medium text-slate-500 dark:text-slate-400 text-[10px]">
                                            {item.quantity || 1}
                                          </div>
                                          <div className="col-span-4 sm:col-span-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                            {rowSymbol}{item.price.toFixed(2)}
                                          </div>
                                          <div className="col-span-4 sm:col-span-1.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                            {rowSymbol}{((item.price) * (item.quantity || 1)).toFixed(2)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="border-t border-slate-105 dark:border-slate-800 pt-2 mt-2 flex flex-col items-end gap-1 text-[10px] sm:text-[11px] font-sans">
                                    <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 flex justify-between w-full sm:w-64">
                                      <span>Extracted Tax:</span>
                                      <span className="font-mono">{CURRENCY_SYMBOLS[r.currency] || ""}{(r.tax || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="text-[11px] sm:text-xs font-bold text-[#00A3FF] flex justify-between w-full sm:w-64 border-t border-slate-100 dark:border-slate-805 pt-1">
                                      <span>Document Amount due:</span>
                                      <span className="font-mono text-blue-600 dark:text-blue-400">{CURRENCY_SYMBOLS[r.currency] || ""}{r.amount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modern state-driven inline confirmation modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-red-100 dark:bg-red-950/30 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-105">
                  Confirm Bulk Deletion?
                </h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  Are you sure you want to securely delete the <span className="text-red-600 dark:text-red-400 font-bold">{selectedIds.size} selected records</span> from your local cache list? This operation is immediate and completely irreversible!
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-98 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Ledger Naming Input Modal */}
      {showSaveLedgerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
                  <Save className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-105">
                    Save Verified Ledger
                  </h3>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    Give this ledger a name to preserve a historic snapshot of its <span className="text-indigo-600 dark:text-indigo-400 font-bold">{receipts.length} record{receipts.length !== 1 ? 's' : ''}</span>. This list will be persisted in your "Saved Ledgers" bank on the start screen.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-505 block">
                  Ledger Description Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. June Monthly Trip Ledger"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  maxLength={50}
                  className="w-full bg-slate-50 dark:bg-[#090f1d] border border-slate-205 dark:border-[#1e2a3e] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-[#00A3FF] text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowSaveLedgerModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!saveName.trim()}
                onClick={() => {
                  onSaveLedger(saveName.trim());
                  setShowSaveLedgerModal(false);
                  setSaveSuccessNotification(true);
                  setTimeout(() => setSaveSuccessNotification(false), 2500);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-98 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
