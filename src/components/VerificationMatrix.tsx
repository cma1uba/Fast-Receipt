/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Check, X, AlertCircle, Eye, Landmark, Calendar, DollarSign, Tag, Plus, Trash2, List, ZoomIn, ZoomOut, RotateCw, Info } from "lucide-react";
import { BatchTask, ReceiptData, ExpenseCategory, ReceiptItem } from "../types";

interface VerificationMatrixProps {
  task: BatchTask;
  onSaveVerification: (taskId: string, finalData: ReceiptData) => void;
  onCancel: () => void;
}

export default function VerificationMatrix({
  task,
  onSaveVerification,
  onCancel,
}: VerificationMatrixProps) {
  const [formData, setFormData] = useState<Partial<ReceiptData>>({
    vendor: "",
    amount: 0,
    tax: 0,
    category: "Other",
    date: "",
    currency: "USD",
    rawNotes: "",
  });

  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Custom slider zoom and rotation states
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);

  // Synchronize initial state
  useEffect(() => {
    if (task.extractedData) {
      setFormData(task.extractedData);
      setItems(task.extractedData.items || []);
    } else {
      // Default guess fallback
      setFormData({
        vendor: "",
        amount: 0,
        tax: 0,
        category: "Other",
        date: new Date().toISOString().split("T")[0],
        currency: "USD",
        rawNotes: "",
      });
      setItems([]);
    }
  }, [task]);

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    const updated = [...items];
    if (field === "price") {
      updated[index][field] = parseFloat(value) || 0;
    } else if (field === "quantity") {
      updated[index][field] = parseInt(value, 10) || 1;
    } else {
      updated[index][field] = value;
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const itemsSum = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const totalDifference = Math.abs(itemsSum - (formData.amount || 0));
  const sumsMatch = totalDifference < 0.05;

  const categories: ExpenseCategory[] = [
    "Food & Dining",
    "Travel",
    "Lodging",
    "Office Supplies",
    "Electronics",
    "Utilities",
    "Entertainment",
    "Other",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" || name === "tax" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Guard rails
    if (!formData.vendor?.trim()) {
      setValidationError("Vendor or store name is required.");
      return;
    }
    if (formData.amount === undefined || formData.amount < 0) {
      setValidationError("Amount must be a non-negative number.");
      return;
    }
    if (!formData.date) {
      setValidationError("Transaction date is required.");
      return;
    }

    const finalRecord: ReceiptData = {
      id: formData.id || crypto.randomUUID(),
      vendor: formData.vendor.trim(),
      amount: Number(formData.amount),
      tax: Number(formData.tax || 0),
      category: (formData.category as ExpenseCategory) || "Other",
      date: formData.date,
      currency: (formData.currency || "USD").toUpperCase(),
      rawNotes: formData.rawNotes || "",
      items: items,
    };

    onSaveVerification(task.id, finalRecord);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 font-sans text-slate-900 dark:text-slate-100 flex flex-col max-h-[96vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Panel */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative group inline-block">
                <Info className="w-4 h-4 text-slate-400 dark:text-slate-505 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-64 sm:w-80 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                  Cross-reference parsed fields against the physical proof container and adjust metadata parameters or customize line-item lists.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 font-sans flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>
                Verify &amp; Save Extracted Receipt
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate max-w-sm mt-1 font-mono">
              FILE_REF: {task.fileName}
            </p>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Left Side: interactive document magnifier */}
        <div className="lg:col-span-6 bg-slate-50/50 dark:bg-slate-955/20 p-5 flex flex-col items-center justify-between min-h-[400px] lg:min-h-[550px]">
          <div className="w-full flex items-center justify-between select-none pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <div className="relative group inline-block">
                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-505 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                  Rotate document alignment or scale magnification factors using direct zoom controllers to inspect fine textual details.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              <Eye className="w-4 h-4 text-blue-500" /> High-Resolution Source Proof
            </span>
            
            {/* Interactive Image Control Buttons */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-500 px-1 min-w-[36px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.min(3.0, zoomLevel + 0.25))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-800"></span>
              <button
                type="button"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-md transition-colors cursor-pointer"
                title="Rotate 90deg"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative w-full flex-grow flex items-center justify-center p-3 select-none overflow-hidden max-h-[460px] lg:max-h-[520px]">
            <div className="w-full h-full flex items-center justify-center overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-inner">
              <img
                src={task.previewUrl}
                alt="Receipt proof content"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: "transform 0.15s ease-out",
                }}
                className="max-h-[380px] w-auto h-auto object-contain pointer-events-none rounded"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Right Side: verified adjustments form */}
        <div className="lg:col-span-6 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Validation Display */}
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-350 rounded-xl text-xs font-bold animate-in zoom-in-95">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Vendor Input */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-blue-500" /> Merchant / Vendor
              </label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor || ""}
                onChange={handleInputChange}
                placeholder="Target, Starbucks, Southwest Airlines"
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 dark:text-white outline-none transition-all font-bold text-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Amount Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> Amount ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500 text-xs font-bold font-mono">
                    {formData.currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={formData.amount !== undefined ? formData.amount : ""}
                    onChange={handleInputChange}
                    className="w-full pl-14 pr-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 outline-none transition-all font-mono font-bold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              {/* Tax Included Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  Tax ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500 text-xs font-semibold font-mono">
                    {formData.currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    name="tax"
                    value={formData.tax !== undefined ? formData.tax : ""}
                    onChange={handleInputChange}
                    className="w-full pl-14 pr-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 outline-none transition-all font-mono text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" /> Date
                </label>
                 <input
                  type="date"
                  name="date"
                  value={formData.date || ""}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 outline-none transition-all font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  required
                />
              </div>

              {/* Expense Category Select dropdown */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-500" /> Category
                </label>
                <select
                  name="category"
                  value={formData.category || "Other"}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 outline-none transition-all font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Currency Selector Input */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                Currency Code (ISO)
              </label>
              <input
                type="text"
                name="currency"
                maxLength={3}
                value={formData.currency || "USD"}
                onChange={handleInputChange}
                placeholder="USD, EUR, GBP"
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-800 hover:border-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950 outline-none transition-all font-mono font-bold uppercase text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Line Items List Editor */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-505 dark:text-slate-400 flex items-center gap-1.5 font-sans whitespace-nowrap">
                  <div className="relative group inline-block">
                    <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-505 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                    <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                      Define individual purchased item metadata. Items sum will align validation helpers directly with the receipt total.
                      <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                    </div>
                  </div>
                  <List className="w-4 h-4 text-blue-500" /> Itemized Line Items
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:text-blue-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="bg-white dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No individual items defined description.</p>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline font-sans cursor-pointer"
                  >
                    Click to register first purchase
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs font-sans animate-in fade-in slide-in-from-top-1">
                      {/* Name input */}
                      <input
                        type="text"
                        placeholder="Item name description"
                        value={item.name || ""}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        className="flex-1 bg-transparent px-2.5 py-1 w-full text-xs text-slate-800 dark:text-slate-300 font-semibold outline-none border-b border-transparent focus:border-blue-300 dark:focus:border-blue-800 transition-colors"
                        required
                      />

                      {/* Quantity input */}
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity || 1}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="w-11 bg-slate-50 dark:bg-slate-950 p-1 rounded-md border border-slate-200 dark:border-slate-800 text-xs text-slate-705 dark:text-slate-300 font-mono text-center outline-none focus:ring-1 focus:ring-blue-500/20"
                        title="Quantity"
                      />

                      {/* Price input */}
                      <div className="relative w-20 shrink-0">
                        <span className="absolute left-1.5 top-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold font-sans">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.price !== undefined ? item.price : ""}
                          onChange={(e) => handleItemChange(index, "price", e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 pl-4 pr-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono text-right outline-none focus:ring-1 focus:ring-blue-500/20"
                          title="Item total/price"
                          required
                        />
                      </div>

                      {/* Trash action button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors shrink-0"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Items Sum validation / visual helper */}
              {items.length > 0 && (
                <div className={`p-2.5 rounded-xl text-[10px] flex items-center justify-between font-sans ${
                  sumsMatch
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                    : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                }`}>
                  <span className="font-bold flex items-center gap-1">
                    Items Sum: ${itemsSum.toFixed(2)}
                  </span>
                  <span>
                    {sumsMatch
                      ? "✓ Matches receipt sum total!"
                      : `⚠ Total is ${formData.amount ? `$${formData.amount.toFixed(2)}` : "$0.00"} (Diff: $${totalDifference.toFixed(2)})`}
                  </span>
                </div>
              )}
            </div>

            {/* Save Buttons Row */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-medium hover:text-slate-800 dark:hover:text-slate-205 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                Cancel Review
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Check className="w-4 h-4" /> Save Record
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  );
}
