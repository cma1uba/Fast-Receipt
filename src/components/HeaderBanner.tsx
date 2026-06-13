/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Lock, Trash2, Shield, Sun, Moon, Sparkles, Layers, Sliders, Globe, X, AlertTriangle, Info, Receipt } from "lucide-react";
import { SecuritySettings } from "../types";
import { motion, AnimatePresence } from "motion/react";

const CURRENCIES = [
  { code: "USD", name: "US Dollar ($)" },
  { code: "EUR", name: "Euro (€)" },
  { code: "GBP", name: "British Pound (£)" },
  { code: "JPY", name: "Japanese Yen (¥)" },
  { code: "CAD", name: "Canadian Dollar (C$)" },
  { code: "AUD", name: "Australian Dollar (A$)" },
  { code: "CHF", name: "Swiss Franc (Fr)" },
  { code: "CNY", name: "Chinese Yuan (¥)" },
  { code: "ZMW", name: "Zambian Kwacha (K)" },
  { code: "ZAR", name: "South African Rand (R)" },
];

interface HeaderBannerProps {
  security: SecuritySettings;
  onSecurityChange: (settings: SecuritySettings) => void;
  onWipeData: () => void;
  itemCount: number;
  isDark: boolean;
  onToggleDark: () => void;
  currentSessionName?: string;
  onSwitchSession?: () => void;
}

export default function HeaderBanner({
  security,
  onSecurityChange,
  onWipeData,
  itemCount,
  isDark,
  onToggleDark,
  currentSessionName,
  onSwitchSession,
}: HeaderBannerProps) {
  const [showConfig, setShowConfig] = React.useState(false);

  // Handle escape key to close slide panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfig(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="border-b border-slate-200/80 dark:border-[#1e293b]/60 bg-white/80 dark:bg-[#070d19]/80 backdrop-blur-md px-4 sm:px-8 py-3.5 sm:py-5 shrink-0 sticky top-0 z-45 transition-all duration-300">
        <div className="max-w-7xl mx-auto w-full flex flex-row items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-gradient-to-br from-[#00A3FF] to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 hover:scale-105 hover:rotate-3 transition-all duration-300 shrink-0">
              <Layers className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="text-sm sm:text-2xl font-black tracking-tight text-slate-905 dark:text-white font-sans leading-none">
                NO-FUSS
              </h1>
              <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5 leading-none">
                Receipt Grabber
              </span>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {currentSessionName && onSwitchSession && (
              <button
                onClick={onSwitchSession}
                className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f172a] dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 rounded-xl border border-slate-250 dark:border-slate-800 text-[10px] sm:text-xs font-bold transition-all duration-205 cursor-pointer shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                title="Click to switch session"
              >
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00A3FF]" />
                <span className="max-w-[65px] sm:max-w-[140px] truncate capitalize">
                  {currentSessionName}
                </span>
              </button>
            )}

            <div 
              className="relative group p-2 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/10 dark:border-emerald-500/20 flex items-center justify-center transition-all shadow-xs select-none shrink-0"
              title={`${itemCount} scanned record${itemCount !== 1 ? "s" : ""}`}
            >
              <Receipt className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#070d19] shadow-xs">
                  {itemCount}
                </span>
              )}
            </div>

            {/* Settings Trigger Display */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 border cursor-pointer flex items-center gap-2 shadow-sm ${
                security.encryptStorage
                  ? "bg-slate-950 dark:bg-[#1e293b] text-white border-slate-900 dark:border-slate-800 hover:bg-slate-900 dark:hover:bg-[#334155]"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#00A3FF]" />
              <span className="hidden xs:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sliding Side-Drawer for Config and Encryption control */}
      <AnimatePresence>
        {showConfig && (
          <>
            {/* Tinted Underlay/Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfig(false)}
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs z-50 cursor-pointer"
            />

            {/* Sliding Panel Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col overflow-hidden font-sans"
            >
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Settings Portal</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Configure ledger space and offline cache</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-250 transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                
                {/* 1. Encryption Mechanism Slider */}
                <div className="space-y-3 bg-slate-50/40 dark:bg-slate-950/10 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative group inline-block">
                      <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                      <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                        Encrypt local entries in memory &amp; localStorage using high-entropy AES-GCM 256 keys. If plain text, direct inspection is unhindered.
                        <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                      </div>
                    </div>
                    <Lock className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">Encryption Mechanism</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl shadow-3xs">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {security.encryptStorage ? "AES-GCM (Active)" : "Plain Text (Disabled)"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={security.encryptStorage}
                        onChange={(e) =>
                          onSecurityChange({
                            ...security,
                            encryptStorage: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* 2. Auto-Shredder Configuration */}
                <div className="space-y-3 bg-slate-50/40 dark:bg-slate-950/10 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative group inline-block">
                      <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors cursor-help shrink-0" />
                      <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-55 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                        Automatically shred memory and database keys at designated rates for complete physical and digital ephemerality.
                        <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                      </div>
                    </div>
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">Auto-Shredder Time</span>
                  </div>
                  <select
                    value={security.autoShredDelayMs}
                    onChange={(e) =>
                      onSecurityChange({
                        ...security,
                        autoShredDelayMs: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-850 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-100/30 cursor-pointer transition-all"
                  >
                    <option value={0} className="dark:bg-slate-900 dark:text-white">Keep offline ledger state</option>
                    <option value={60000} className="dark:bg-slate-900 dark:text-white">Shred inside 1 minute</option>
                    <option value={900000} className="dark:bg-slate-900 dark:text-white">Shred inside 15 minutes</option>
                    <option value={3600000} className="dark:bg-slate-900 dark:text-white">Shred inside 1 hour</option>
                    <option value={86400000} className="dark:bg-slate-900 dark:text-white">Shred inside 24 hours</option>
                    <option value={-1} className="dark:bg-slate-900 dark:text-white">Wipe instantly when tab is closed</option>
                  </select>
                </div>

                {/* 3. Appearance Preference Options */}
                <div className="space-y-3 bg-slate-50/40 dark:bg-slate-950/10 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative group inline-block">
                      <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors cursor-help shrink-0" />
                      <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                        Customize visual appearance settings and active ledger base currency.
                        <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">Visual Preferences</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl shadow-3xs">
                      <span className="text-xs font-semibold text-slate-705 dark:text-slate-300 flex items-center gap-1.5">
                        {isDark ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                        Dark mode
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isDark}
                          onChange={onToggleDark}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-350 dark:after:border-slate-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. Danger & Ledger Wipe Controls */}
                <div className="p-4 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/40 dark:border-rose-900/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative group inline-block">
                      <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors cursor-help shrink-0" />
                      <div className="absolute bottom-full left-0 mb-2 w-60 sm:w-72 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                        Irreversibly delete all ledger entries, line-item products, scanned photos, and cached statistics instantly.
                        <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                      </div>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="font-bold text-rose-800 dark:text-rose-400 text-xs uppercase tracking-wider">Purge Section</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to destroy all local scans and wipe the encryption database permanently? This cannot be undone.")) {
                        onWipeData();
                        setShowConfig(false);
                      }
                    }}
                    className="w-full py-2 bg-rose-100 hover:bg-rose-200/80 dark:bg-rose-950/40 hover:dark:bg-rose-900/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 font-bold font-sans text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Direct Hard Wipe Ledger
                  </button>
                </div>
              </div>

              {/* Drawer Footer Panel */}
              <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Offline Engine Active • Sandbox Isolation Secure
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
