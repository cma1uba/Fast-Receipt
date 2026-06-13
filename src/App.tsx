/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import HeaderBanner from "./components/HeaderBanner";
import DropZone from "./components/DropZone";
import VerificationMatrix from "./components/VerificationMatrix";
import ReceiptList from "./components/ReceiptList";
import { BatchTask, ReceiptData, SecuritySettings, ExpenseCategory, ReceiptSession, SavedLedger } from "./types";
import { encryptData, decryptData, generateSessionPasscode } from "./utils/crypto";
import { exportReceiptsToCSV } from "./utils/csv";
import { Shield, Sparkles, Key, AlertTriangle, Layers, Info, Plus, Folder, Briefcase, User, Calendar, Trash2, Save, History, BookOpen, ExternalLink, Download } from "lucide-react";

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const comma = res.indexOf(",");
      resolve({
        base64: res.substring(comma + 1),
        mimeType: file.type,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("nf_theme_mode");
    if (saved) return saved === "dark";
    return true;
  });

  const [isPreLoading, setIsPreLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPreLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("nf_theme_mode", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("nf_theme_mode", "light");
    }
  }, [isDark]);

  const [passcode, setPasscode] = useState<string>("");
  const [security, setSecurity] = useState<SecuritySettings>({
    encryptStorage: true,
    isTemporary: false,
    autoShredDelayMs: 0,
  });

  const [sessions, setSessions] = useState<ReceiptSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [newSessionName, setNewSessionName] = useState<string>("");
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  const [receipts, setReceipts] = useState<ReceiptData[]>([]);

  // Saved ledgers snapbank history
  const [savedLedgers, setSavedLedgers] = useState<SavedLedger[]>(() => {
    const saved = localStorage.getItem("nf_saved_ledgers");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("nf_saved_ledgers", JSON.stringify(savedLedgers));
  }, [savedLedgers]);

  const [startScreenTab, setStartScreenTab] = useState<"sessions" | "history">("sessions");
  const [viewingSavedLedger, setViewingSavedLedger] = useState<SavedLedger | null>(null);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [activeVerification, setActiveVerification] = useState<BatchTask | null>(null);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  
  // Auto-verification trigger for completed tasks
  useEffect(() => {
    if (!activeVerification) {
      const nextCompletedTask = tasks.find(
        (t) => t.status === "completed" && !dismissedTaskIds.includes(t.id)
      );
      if (nextCompletedTask) {
        setActiveVerification(nextCompletedTask);
      }
    }
  }, [tasks, activeVerification, dismissedTaskIds]);

  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const defaultRates = {
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
    };
    const saved = localStorage.getItem("nf_exchange_rates");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultRates, ...parsed };
      } catch {
        // no-op
      }
    }
    return defaultRates;
  });

  useEffect(() => {
    localStorage.setItem("nf_exchange_rates", JSON.stringify(exchangeRates));
  }, [exchangeRates]);

  const autoShredTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 1: Initialize Passkey & security variables from storage, and load bootstrap sessions
  useEffect(() => {
    // Generate an high-entropy session passcode as default
    const sessionKey = generateSessionPasscode();
    let currentPass = sessionKey;

    // Load security settings
    const rawSecurity = localStorage.getItem("nf_receipt_security");
    let secConfig: SecuritySettings = {
      encryptStorage: true,
      isTemporary: false,
      autoShredDelayMs: 0,
    };

    if (rawSecurity) {
      try {
        secConfig = JSON.parse(rawSecurity);
      } catch (e) {
        console.error("Failed to parse security settings, resetting...", e);
      }
    }

    // Load passcode
    const savedPass = localStorage.getItem("nf_receipt_pass");
    if (savedPass) {
      currentPass = savedPass;
    } else {
      localStorage.setItem("nf_receipt_pass", sessionKey);
    }

    setSecurity(secConfig);
    setPasscode(currentPass);

    // Load sessions metadata list
    const rawSessions = localStorage.getItem("nf_sessions");
    let initialSessions: ReceiptSession[] = [];
    if (rawSessions) {
      try {
        initialSessions = JSON.parse(rawSessions);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }

    // Backwards-compatible bootstrap
    if (initialSessions.length === 0) {
      const legacyLedger = localStorage.getItem("nf_receipt_ledger");
      if (legacyLedger) {
        initialSessions = [
          { id: "personal", name: "Personal", createdAt: new Date().toISOString() },
          { id: "work", name: "Work", createdAt: new Date().toISOString() }
        ];
        // Move old receipts legacy ledger to "nf_receipt_ledger_personal"
        localStorage.setItem("nf_receipt_ledger_personal", legacyLedger);
      } else {
        initialSessions = [
          { id: "personal", name: "Personal", createdAt: new Date().toISOString() },
          { id: "work", name: "Work", createdAt: new Date().toISOString() }
        ];
      }
      localStorage.setItem("nf_sessions", JSON.stringify(initialSessions));
    }
    setSessions(initialSessions);

    // Bind beforeunload if temporary session mode is requested
    const handleBeforeUnload = () => {
      const mode = localStorage.getItem("nf_receipt_security");
      if (mode) {
        try {
          const parsedMode = JSON.parse(mode) as SecuritySettings;
          if (parsedMode.autoShredDelayMs === -1) {
            // Unload Shred active!
            localStorage.removeItem("nf_receipt_ledger");
            localStorage.removeItem("nf_receipt_pass");
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith("nf_receipt_ledger_")) {
                localStorage.removeItem(k);
              }
            }
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Load receipts for selected session
  useEffect(() => {
    if (!currentSessionId || !passcode) return;

    const ledgerKey = `nf_receipt_ledger_${currentSessionId}`;
    const rawLedger = localStorage.getItem(ledgerKey);
    if (rawLedger) {
      if (security.encryptStorage) {
        decryptData(rawLedger, passcode)
          .then((decrypted) => {
            const list = JSON.parse(decrypted);
            setReceipts(list);
            setDecryptionError(null);
          })
          .catch((err) => {
            console.warn("Could not decrypt with stored passcode for session:", currentSessionId, err);
            setDecryptionError("Decrypt Error: Local cache requires a match for your previous keystore key. Change passcode back or wipe the ledger cache to begin parsing.");
            setReceipts([]);
          });
      } else {
        try {
          const list = JSON.parse(rawLedger);
          setReceipts(list);
          setDecryptionError(null);
        } catch {
          setDecryptionError("Parsing error: Corrupted unencrypted storage payload.");
          setReceipts([]);
        }
      }
    } else {
      setReceipts([]);
      setDecryptionError(null);
    }
  }, [currentSessionId, passcode, security.encryptStorage]);

  // Track and count session elements dynamically
  useEffect(() => {
    if (sessions.length === 0 || !passcode) return;

    const updateCounts = async () => {
      const counts: Record<string, number> = {};
      for (const s of sessions) {
        const raw = localStorage.getItem(`nf_receipt_ledger_${s.id}`);
        if (!raw) {
          counts[s.id] = 0;
          continue;
        }
        try {
          if (security.encryptStorage) {
            const dec = await decryptData(raw, passcode);
            const list = JSON.parse(dec);
            counts[s.id] = Array.isArray(list) ? list.length : 0;
          } else {
            const list = JSON.parse(raw);
            counts[s.id] = Array.isArray(list) ? list.length : 0;
          }
        } catch {
          counts[s.id] = 0;
        }
      }
      setSessionCounts(counts);
    };

    updateCounts();
  }, [sessions, passcode, security.encryptStorage, receipts]);

  // Phase 2: Save metadata and encrypt values on receipts or passcode updates
  const saveStateToStorage = async (updatedReceipts: ReceiptData[], currentSec: SecuritySettings, currentPass: string) => {
    localStorage.setItem("nf_receipt_security", JSON.stringify(currentSec));
    localStorage.setItem("nf_receipt_pass", currentPass);

    if (!currentSessionId) return;
    const ledgerKey = `nf_receipt_ledger_${currentSessionId}`;

    if (updatedReceipts.length === 0) {
      localStorage.removeItem(ledgerKey);
      return;
    }

    if (currentSec.encryptStorage) {
      try {
        const encrypted = await encryptData(JSON.stringify(updatedReceipts), currentPass);
        localStorage.setItem(ledgerKey, encrypted);
        setDecryptionError(null);
      } catch (err: any) {
        console.error("Failed to encrypt ledger updates:", err);
      }
    } else {
      localStorage.setItem(ledgerKey, JSON.stringify(updatedReceipts));
      setDecryptionError(null);
    }
  };

  // Trigger manual security controls changes
  const handleSecurityChange = async (newSec: SecuritySettings) => {
    pendo.track("security_settings_changed", {
      encryptStorage: newSec.encryptStorage,
      autoShredDelayMs: newSec.autoShredDelayMs,
      previousEncryptStorage: security.encryptStorage,
      previousAutoShredDelayMs: security.autoShredDelayMs,
    });

    setSecurity(newSec);
    // Save settings right away
    await saveStateToStorage(receipts, newSec, passcode);
  };

  const handleRegeneratePasscode = async () => {
    const freshPass = generateSessionPasscode();
    setPasscode(freshPass);
    // Re-encrypt the current state under the new passphrase
    await saveStateToStorage(receipts, security, freshPass);
  };

  const handleSaveLedger = (saveName: string) => {
    if (receipts.length === 0) return;
    const currentSession = sessions.find(s => s.id === currentSessionId);
    
    // Convert currencies to USD base for consolidated totals
    const totalAmount = receipts.reduce((sum, r) => {
      const rate = exchangeRates[r.currency.toUpperCase()] || 1;
      return sum + (r.amount / rate);
    }, 0);
    const totalTax = receipts.reduce((sum, r) => {
      const rate = exchangeRates[r.currency.toUpperCase()] || 1;
      return sum + ((r.tax || 0) / rate);
    }, 0);

    const newSaved: SavedLedger = {
      id: "ledger_" + Math.random().toString(36).substring(2, 9),
      sessionId: currentSessionId || "",
      sessionName: currentSession?.name || "Unknown Session",
      saveName: saveName.trim(),
      savedAt: new Date().toISOString(),
      receipts: JSON.parse(JSON.stringify(receipts)),
      totalAmount,
      totalTax,
      itemCount: receipts.length,
    };

    setSavedLedgers(prev => [newSaved, ...prev]);

    pendo.track("ledger_snapshot_saved", {
      saveName: saveName.trim(),
      sessionId: currentSessionId || "",
      sessionName: currentSession?.name || "Unknown Session",
      receiptCount: receipts.length,
      totalAmount,
      totalTax,
    });
  };

  const handleRestoreLedger = async (ledger: SavedLedger) => {
    // Generate a fresh workspace (session) for the restored ledger to maintain cleanliness
    const newId = "session_" + Math.random().toString(36).substring(2, 9);
    const restoredSession = {
      id: newId,
      name: `${ledger.saveName} (Restored)`,
      createdAt: new Date().toISOString()
    };
    
    const updated = [...sessions, restoredSession];
    setSessions(updated);
    localStorage.setItem("nf_sessions", JSON.stringify(updated));
    
    // Write receipts to session storage (encypted if requested)
    const ledgerKey = `nf_receipt_ledger_${newId}`;
    if (security.encryptStorage) {
      try {
        const encrypted = await encryptData(JSON.stringify(ledger.receipts), passcode);
        localStorage.setItem(ledgerKey, encrypted);
      } catch (err) {
        console.error("Failed encrypt state for restored session:", err);
      }
    } else {
      localStorage.setItem(ledgerKey, JSON.stringify(ledger.receipts));
    }
    
    // Switch to restored session
    setCurrentSessionId(newId);
    setReceipts(ledger.receipts);
    setViewingSavedLedger(null); // safely close modal if open

    pendo.track("ledger_restored", {
      saveName: ledger.saveName,
      sourceSessionName: ledger.sessionName,
      receiptCount: ledger.receipts.length,
      totalAmount: ledger.totalAmount,
      totalTax: ledger.totalTax,
      newSessionId: newId,
      isEncrypted: security.encryptStorage,
    });
  };

  const handleDeleteSavedLedger = (id: string) => {
    const ledger = savedLedgers.find(l => l.id === id);
    if (ledger) {
      pendo.track("saved_ledger_deleted", {
        ledgerId: id,
        saveName: ledger.saveName,
        receiptCount: ledger.itemCount,
        totalAmount: ledger.totalAmount,
      });
    }
    setSavedLedgers(prev => prev.filter(l => l.id !== id));
  };

  // Phase 3: Auto-Shred Timer management
  useEffect(() => {
    if (autoShredTimerRef.current) {
      clearInterval(autoShredTimerRef.current);
    }

    if (security.autoShredDelayMs > 0 && receipts.length > 0) {
      autoShredTimerRef.current = setTimeout(() => {
        handleWipeData();
        alert("🔒 No-Fuss Privacy Notice: Your local offline history cache has been automatically shredded according to your security configuration!");
      }, security.autoShredDelayMs);
    }

    return () => {
      if (autoShredTimerRef.current) clearTimeout(autoShredTimerRef.current);
    };
  }, [security.autoShredDelayMs, receipts]);

  // Handle addition of multiple files to the process batch queue
  const handleAddFiles = (files: File[]) => {
    const fileTypes = [...new Set(files.map((f) => f.type))];
    const totalFileSize = files.reduce((sum, f) => sum + f.size, 0);

    pendo.track("receipt_images_uploaded", {
      fileCount: files.length,
      totalFileSize,
      fileTypes: fileTypes.join(", "),
    });

    const newTasks = files.map((file) => {
      const task: BatchTask = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        previewUrl: URL.createObjectURL(file),
        base64Data: "",
        status: "idle",
      };
      
      // Perform immediate async OCR & upload trigger
      triggerExtraction(task, file);
      
      return task;
    });

    setTasks((prev) => [...prev, ...newTasks]);
  };

  // Perform AI parsing extraction sequence on the backend
  const triggerExtraction = async (task: BatchTask, file: File) => {
    updateTaskStatus(task.id, { status: "uploading" });

    try {
      const { base64, mimeType } = await fileToBase64(file);
      updateTaskStatus(task.id, { status: "extracting", base64Data: base64 });

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image: base64,
          mimeType: mimeType,
        }),
      });

      if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error || `Server responded with standard exit code: ${response.status}`);
      }

      const extractedPayload = await response.json();

      updateTaskStatus(task.id, {
        status: "completed",
        extractedData: {
          id: task.id,
          vendor: extractedPayload.vendor || "Unknown Vendor",
          amount: typeof extractedPayload.amount === "number" ? extractedPayload.amount : 0,
          tax: typeof extractedPayload.tax === "number" ? extractedPayload.tax : 0,
          category: extractedPayload.category || "Other",
          date: extractedPayload.date || new Date().toISOString().split("T")[0],
          currency: extractedPayload.currency || "USD",
          rawNotes: extractedPayload.rawNotes || "",
          items: Array.isArray(extractedPayload.items) ? extractedPayload.items : [],
        },
      });

      pendo.track("receipt_extraction_completed", {
        fileName: task.fileName,
        fileType: task.fileType,
        fileSize: task.fileSize,
        vendor: extractedPayload.vendor || "Unknown Vendor",
        amount: typeof extractedPayload.amount === "number" ? extractedPayload.amount : 0,
        tax: typeof extractedPayload.tax === "number" ? extractedPayload.tax : 0,
        currency: extractedPayload.currency || "USD",
        category: extractedPayload.category || "Other",
        date: extractedPayload.date || "",
        itemCount: Array.isArray(extractedPayload.items) ? extractedPayload.items.length : 0,
        rawNotesLength: (extractedPayload.rawNotes || "").length,
      });
    } catch (err: any) {
      console.error(`AI Extraction error for ${task.fileName}:`, err);
      updateTaskStatus(task.id, {
        status: "failed",
        error: err?.message || "Failed to parse receipt text content.",
      });

      pendo.track("receipt_extraction_failed", {
        fileName: task.fileName,
        fileType: task.fileType,
        fileSize: task.fileSize,
        errorMessage: (err?.message || "Failed to parse receipt text content.").substring(0, 200),
      });
    }
  };

  const updateTaskStatus = (id: string, updates: Partial<BatchTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (activeVerification?.id === taskId) {
      setActiveVerification(null);
    }
  };

  const handleRetryTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    pendo.track("receipt_extraction_retried", {
      fileName: task.fileName,
      fileType: task.fileType,
      taskId: task.id,
      hadBase64Data: !!task.base64Data,
    });

    // We can't easily re-access the file stream object immediately,
    // so we re-fetch from the stored base64 image or prompt failure
    if (task.base64Data) {
      executeReExtraction(task);
    } else {
      updateTaskStatus(taskId, {
        status: "failed",
        error: "Source file cache cleared. Please re-drop the screenshot.",
      });
    }
  };

  const executeReExtraction = async (task: BatchTask) => {
    updateTaskStatus(task.id, { status: "extracting", error: undefined });

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image: task.base64Data,
          mimeType: task.fileType,
        }),
      });

      if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error || "Server responded with failure.");
      }

      const extractedPayload = await response.json();

      updateTaskStatus(task.id, {
        status: "completed",
        extractedData: {
          id: task.id,
          vendor: extractedPayload.vendor || "Unknown Vendor",
          amount: typeof extractedPayload.amount === "number" ? extractedPayload.amount : 0,
          tax: typeof extractedPayload.tax === "number" ? extractedPayload.tax : 0,
          category: extractedPayload.category || "Other",
          date: extractedPayload.date || new Date().toISOString().split("T")[0],
          currency: extractedPayload.currency || "USD",
          rawNotes: extractedPayload.rawNotes || "",
          items: Array.isArray(extractedPayload.items) ? extractedPayload.items : [],
        },
      });
    } catch (err: any) {
      updateTaskStatus(task.id, {
        status: "failed",
        error: err?.message || "Failed to retry parsing.",
      });
    }
  };

  // Phase 4: Verification Matrix Save Handler
  const handleSaveVerification = async (taskId: string, finalData: ReceiptData) => {
    const updatedLedger = [finalData, ...receipts];
    setReceipts(updatedLedger);

    // Save to storage
    await saveStateToStorage(updatedLedger, security, passcode);

    // Clear verification views
    handleRemoveTask(taskId);


  };

  const handleSelectTaskToVerify = (task: BatchTask) => {
    // If manually clicked, make sure we remove it from dismissed list so modal opens
    setDismissedTaskIds((prev) => prev.filter((id) => id !== task.id));
    setActiveVerification(task);
  };

  const handleCancelVerification = () => {
    if (activeVerification) {
      setDismissedTaskIds((prev) => [...prev, activeVerification.id]);
    }
    setActiveVerification(null);
  };

  // Manual delete single item
  const handleDeleteReceipt = async (id: string) => {
    const receipt = receipts.find((r) => r.id === id);
    if (receipt) {
      pendo.track("receipt_deleted", {
        receiptId: id,
        vendor: receipt.vendor,
        amount: receipt.amount,
        currency: receipt.currency,
        category: receipt.category,
      });
    }
    const filtered = receipts.filter((r) => r.id !== id);
    setReceipts(filtered);
    await saveStateToStorage(filtered, security, passcode);
  };

  const handleDeleteReceipts = async (ids: string[]) => {
    const filtered = receipts.filter((r) => !ids.includes(r.id));
    setReceipts(filtered);
    await saveStateToStorage(filtered, security, passcode);
  };

  const handleUpdateReceiptsCategory = async (ids: string[], category: ExpenseCategory) => {
    const updated = receipts.map((r) => ids.includes(r.id) ? { ...r, category } : r);
    setReceipts(updated);
    await saveStateToStorage(updated, security, passcode);
  };

  // Full system clear state
  const handleWipeData = async () => {
    const confirmWipe = window.confirm("⚠️ Are you absolutely sure you want to securely shred all sessions & local storage caches? This cannot be undone.");
    if (!confirmWipe) return;

    pendo.track("all_data_wiped", {
      totalSessionsWiped: sessions.length,
      totalReceiptsWiped: receipts.length,
      hadEncryption: security.encryptStorage,
    });

    setReceipts([]);
    setTasks([]);
    setActiveVerification(null);
    setDismissedTaskIds([]);
    
    // Clear all session storage keys
    for (const s of sessions) {
      localStorage.removeItem(`nf_receipt_ledger_${s.id}`);
    }
    localStorage.removeItem("nf_receipt_ledger");
    localStorage.removeItem("nf_sessions");
    localStorage.removeItem("nf_receipt_pass");
    localStorage.removeItem("nf_receipt_security");
    
    // Regenerate unique session variables
    const newPass = generateSessionPasscode();
    setPasscode(newPass);
    setSecurity({
      encryptStorage: true,
      isTemporary: false,
      autoShredDelayMs: 0,
    });
    
    // Reset sessions
    const defaultSessions = [
      { id: "personal", name: "Personal", createdAt: new Date().toISOString() },
      { id: "work", name: "Work", createdAt: new Date().toISOString() }
    ];
    setSessions(defaultSessions);
    localStorage.setItem("nf_sessions", JSON.stringify(defaultSessions));
    setCurrentSessionId(null);
  };

  if (isPreLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-sans select-none transition-all duration-500 ${isDark ? "bg-[#070d19] text-white" : "bg-slate-50 text-slate-900"}`}>
        <div className="flex flex-col items-center gap-7 max-w-md text-center px-8 animate-in fade-in duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00A3FF]/25 rounded-3xl blur-2xl animate-pulse"></div>
            <div className="w-20 h-20 bg-gradient-to-br from-[#00A3FF] to-indigo-650 rounded-2xl flex items-center justify-center text-white shadow-xl relative animate-bounce duration-1000">
              <Layers className="w-10 h-10 stroke-[1.8] drop-shadow-md" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight leading-none">
              NO-FUSS
            </h1>
            <p className="text-xs text-[#00A3FF] font-extrabold tracking-widest uppercase mt-1">
              Receipt Grabber
            </p>
          </div>

          <div className="w-56 h-1.5 bg-slate-205 dark:bg-[#1a2333] rounded-full overflow-hidden mt-3 relative">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00A3FF] to-indigo-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
            />
          </div>
          
          <p className="text-[10px] text-slate-400 dark:text-slate-505 font-bold font-mono tracking-widest uppercase animate-pulse">
            Bootstrapping secure partition...
          </p>
        </div>
      </div>
    );
  }

  // Dynamic Session selection landing screen (just after preloading)
  if (!currentSessionId) {
    return (
      <div className={`min-h-screen font-sans transition-all duration-300 flex flex-col ${isDark ? "bg-[#070d19] text-white" : "bg-slate-50 text-slate-900"}`}>
        {/* Simple Branding logo header */}
        <header className="border-b border-slate-200/80 dark:border-[#1e293b]/60 bg-white/80 dark:bg-[#070d19]/80 backdrop-blur-md px-6 py-4.5 shrink-0 sticky top-0 z-45 transition-all">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#00A3FF] to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <Layers className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="flex flex-col justify-center leading-none">
                <h1 className="text-base sm:text-lg font-black tracking-tight leading-none">
                  NO-FUSS
                </h1>
                <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5 leading-none">
                  Receipt Grabber
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 border border-slate-200 dark:border-[#1e2a3e] rounded-xl hover:bg-slate-100 dark:hover:bg-[#0f172a] text-slate-500 dark:text-slate-400 cursor-pointer transition-all hover:scale-105"
            >
              {isDark ? <Sparkles className="w-4 h-4 text-amber-400" /> : <Shield className="w-4 h-4 text-[#00A3FF]" />}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-14 md:py-24 flex flex-col justify-center">
          <div className="space-y-4 text-center max-w-xl mx-auto mb-12 md:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              WELCOME
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              What are you capturing today?
            </p>
          {/* Start Screen Tabs Selector */}
          <div className="flex justify-center gap-2.5 mb-8 max-w-sm mx-auto">
            <button
              onClick={() => setStartScreenTab("sessions")}
              className={`flex-1 py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-205 cursor-pointer flex items-center justify-center gap-1.5 border leading-none ${
                startScreenTab === "sessions"
                  ? "bg-[#00A3FF] border-[#00A3FF] text-white shadow-md font-extrabold"
                  : "bg-white dark:bg-[#0b1220]/80 border-slate-205 dark:border-[#1e2a3e]/80 text-slate-650 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-[#0f172a]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Active Workspaces
            </button>
            <button
              onClick={() => setStartScreenTab("history")}
              className={`flex-1 py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-205 cursor-pointer flex items-center justify-center gap-1.5 border leading-none ${
                startScreenTab === "history"
                  ? "bg-[#00A3FF] border-[#00A3FF] text-white shadow-md font-extrabold"
                  : "bg-white dark:bg-[#0b1220]/80 border-slate-205 dark:border-[#1e2a3e]/80 text-slate-655 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-[#0f172a]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Saved Ledgers ({savedLedgers.length})
            </button>
          </div>

          {startScreenTab === "sessions" ? (
                   <div className="grid grid-cols-3 gap-2 sm:gap-6">
            {sessions.map((session) => {
              const isWork = session.name.toLowerCase().includes("work") || session.name.toLowerCase().includes("job") || session.name.toLowerCase().includes("business");
              const isPersonal = session.name.toLowerCase().includes("personal") || session.name.toLowerCase().includes("life") || session.name.toLowerCase().includes("home") || session.name.toLowerCase().includes("self");
              const isTravel = session.name.toLowerCase().includes("travel") || session.name.toLowerCase().includes("trip") || session.name.toLowerCase().includes("flight") || session.name.toLowerCase().includes("vacation");
              
              const count = sessionCounts[session.id] ?? 0;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    pendo.track("workspace_selected", {
                      sessionId: session.id,
                      sessionName: session.name,
                      receiptCount: count,
                      totalAvailableSessions: sessions.length,
                    });
                    setCurrentSessionId(session.id);
                  }}
                  className="group relative bg-white dark:bg-[#0b1220]/72 backdrop-blur-md border border-slate-205 dark:border-[#1e2a3e]/80 rounded-xl sm:rounded-2xl p-2 sm:p-6.5 shadow-sm hover:shadow-xl hover:border-[#00A3FF] dark:hover:border-[#00A3FF]/85 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[110px] sm:min-h-[190px]"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-1 sm:p-3 bg-[#00A3FF]/5 dark:bg-[#00A3FF]/10 text-[#00A3FF] rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform duration-300">
                      {isWork ? (
                        <Shield className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      ) : isPersonal ? (
                        <User className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      ) : isTravel ? (
                        <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-400" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-400" />
                      )}
                    </div>

                    {sessions.length > 1 && (
                      <div className="relative shrink-0 flex items-center">
                        {deletingSessionId === session.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 p-1 py-0.5 sm:p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 animate-in fade-in slide-in-from-top-1">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-450 px-1 hidden sm:block">Delete Workspace?</span>
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-450 px-0.5 sm:hidden">Sure?</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = sessions.filter(s => s.id !== session.id);
                                setSessions(updated);
                                localStorage.setItem("nf_sessions", JSON.stringify(updated));
                                localStorage.removeItem(`nf_receipt_ledger_${session.id}`);
                                setDeletingSessionId(null);

                                pendo.track("workspace_deleted", {
                                  sessionId: session.id,
                                  sessionName: session.name,
                                  receiptCount: sessionCounts[session.id] ?? 0,
                                  remainingSessionCount: updated.length,
                                });
                              }}
                              className="px-1.5 py-0.5 bg-rose-600 dark:bg-rose-700 hover:bg-rose-700 dark:hover:bg-rose-650 text-white rounded text-[9px] font-extrabold transition-all cursor-pointer mr-0.5 shadow-3xs"
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingSessionId(null);
                              }}
                              className="px-1.5 py-0.5 bg-slate-205 dark:bg-slate-805 hover:bg-slate-305 dark:hover:bg-slate-755 text-slate-705 dark:text-slate-305 rounded text-[9px] font-extrabold transition-all cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSessionId(session.id);
                            }}
                            className="p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-950/25 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-450 rounded-lg sm:rounded-xl transition-all cursor-pointer"
                            title="Delete Session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5 sm:mt-4 space-y-0.5 sm:space-y-1">
                    <h3 className="font-bold text-[10px] sm:text-base text-slate-805 dark:text-white group-hover:text-[#00A3FF] dark:group-hover:text-[#00A3FF] transition-colors capitalize truncate max-w-full">
                      {session.name}
                    </h3>
                    <p className="text-[8px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-bold font-mono">
                      {new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>

                  <div className="mt-1.5 sm:mt-4 pt-1.5 sm:pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[8px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold font-mono uppercase tracking-wide">
                    <span className="truncate max-w-[65%]">
                      <span className="hidden xs:inline">scanned </span>records
                    </span>
                    <span className="text-[#00A3FF] dark:text-white bg-[#00A3FF]/10 dark:bg-[#00A3FF]/20 px-1 sm:px-2.5 py-0.5 rounded-full shrink-0 text-[8px] sm:text-[10px]">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Creator Button Card - Button named '+' */}
            <div className="bg-white/40 dark:bg-[#0b1220]/40 border-2 border-dashed border-slate-205 dark:border-[#1e2a3e]/80 hover:border-[#00A3FF]/45 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-2 sm:p-6 min-h-[110px] sm:min-h-[190px] relative transition-all duration-300 hover:bg-white dark:hover:bg-[#0f182c]/50 text-center">
              {!isCreatingSession ? (
                <button
                  onClick={() => setIsCreatingSession(true)}
                  className="flex flex-col items-center justify-center gap-1 sm:gap-2 cursor-pointer w-full h-full group"
                >
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-slate-100 dark:bg-[#1a2333]/80 flex items-center justify-center text-slate-500 dark:text-slate-400 font-normal text-lg sm:text-2xl group-hover:scale-110 group-hover:bg-[#00A3FF] group-hover:text-white transition-all shadow-3xs border border-slate-200 dark:border-slate-800">
                    +
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-black font-sans text-slate-450 dark:text-[#00A3FF] uppercase tracking-widest block transition-colors group-hover:text-slate-700 dark:group-hover:text-[#00A3FF]/80 text-center w-full">
                    +
                  </span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = newSessionName.trim();
                    if (!trimmed) return;
                    
                    const newId = crypto.randomUUID();
                    const newSessionObj = {
                      id: newId,
                      name: trimmed,
                      createdAt: new Date().toISOString()
                    };
                    const updated = [...sessions, newSessionObj];
                    setSessions(updated);
                    localStorage.setItem("nf_sessions", JSON.stringify(updated));
                    setNewSessionName("");
                    setIsCreatingSession(false);
                    setCurrentSessionId(newId);

                    pendo.track("workspace_created", {
                      sessionName: trimmed,
                      sessionId: newId,
                      totalSessionCount: updated.length,
                    });
                  }}
                  className="w-full space-y-1.5 sm:space-y-3.5 px-0.5 sm:px-1.5"
                >
                  <span className="block text-[8px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#00A3FF]">
                    Session Name
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Work, Family Travel"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    autoFocus
                    maxLength={20}
                    className="w-full bg-slate-50 dark:bg-[#090f1d] border border-slate-205 dark:border-[#1e2a3e] rounded-lg sm:rounded-xl px-1.5 py-1 sm:px-3 sm:py-2.5 text-[9px] sm:text-xs font-bold outline-none focus:ring-1 focus:ring-[#00A3FF] text-slate-800 dark:text-white"
                  />
                  <div className="flex gap-1 sm:gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingSession(false);
                        setNewSessionName("");
                      }}
                      className="px-1.5 py-1 sm:px-3.5 sm:py-2 border border-slate-200 dark:border-[#1e2a3e]/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-[8px] sm:text-xs font-bold rounded-lg sm:rounded-xl cursor-pointer text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-1.5 py-1 sm:px-3.5 sm:py-2 bg-[#00A3FF] hover:bg-blue-600 text-white text-[8px] sm:text-xs font-bold rounded-lg sm:rounded-xl cursor-pointer shadow-sm"
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}
            </div>   </div>
          ) : (
            /* Saved Ledgers History Panel */
            <div className="space-y-4 animate-in fade-in duration-200">
              {savedLedgers.length === 0 ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-[#0b1220]/50 border border-slate-200 dark:border-[#1e2a3e]/85 rounded-2xl max-w-sm mx-auto space-y-4 shadow-sm">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-[#1a2333]/80 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto">
                    <Save className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No Saved Ledgers Yet
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                      Once you capture and finalize a verified ledger inside a workspace, click "Save Ledger" to build your sheet history snapshot collection.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedLedgers.map((ledger) => (
                    <div
                      key={ledger.id}
                      className="bg-white dark:bg-[#0b1220]/72 backdrop-blur-md border border-slate-205 dark:border-[#1e2a3e]/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between animate-in fade-in duration-200"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-[#00A3FF] uppercase tracking-wider">
                              <BookOpen className="w-3 h-3 text-[#00A3FF]" />
                              {ledger.sessionName}
                            </div>
                            <h3 className="font-bold text-slate-850 dark:text-slate-100 text-xs sm:text-xs shrink truncate" title={ledger.saveName}>
                              {ledger.saveName}
                            </h3>
                          </div>
                          {deletingLedgerId === ledger.id ? (
                            <div className="flex items-center gap-1.5 shrink-0 bg-rose-50 dark:bg-rose-955/20 p-1 rounded-xl border border-rose-200 dark:border-rose-900/40 animate-in fade-in slide-in-from-right-1 duration-150">
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-450 px-1">Delete?</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSavedLedger(ledger.id);
                                  setDeletingLedgerId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 dark:bg-rose-700 hover:bg-rose-700 dark:hover:bg-rose-650 text-white rounded text-[9px] font-extrabold transition-all cursor-pointer shadow-3xs"
                              >
                                Yes
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLedgerId(null);
                                }}
                                className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-305 rounded text-[9px] font-extrabold transition-all cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingLedgerId(ledger.id);
                              }}
                              className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-505 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-xl transition-all cursor-pointer shrink-0"
                              title="Delete saved ledger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Statistics Summary block */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50/70 dark:bg-[#0f172a]/60 rounded-xl text-center text-[10px] sm:text-[11px] border border-slate-100 dark:border-[#1e2a3e]/50">
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-bold text-slate-406 dark:text-slate-500 block uppercase tracking-wider">Records</span>
                            <span className="font-extrabold text-slate-705 dark:text-slate-205 font-mono">{ledger.itemCount}</span>
                          </div>
                          <div className="space-y-0.5 border-x border-slate-200 dark:border-[#1e2a3e]/70">
                            <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 block uppercase tracking-wider font-sans">Spend</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">${ledger.totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 block uppercase tracking-wider">Tax</span>
                            <span className="font-extrabold text-indigo-550 dark:text-indigo-400 font-mono">${ledger.totalTax.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5 flex-wrap">
                        <span className="text-[9px] text-slate-405 dark:text-slate-500 font-bold font-mono">
                          {new Date(ledger.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            onClick={() => {
                              pendo.track("saved_ledger_viewed", {
                                ledgerId: ledger.id,
                                saveName: ledger.saveName,
                                sessionName: ledger.sessionName,
                                receiptCount: ledger.itemCount,
                                totalAmount: ledger.totalAmount,
                                totalTax: ledger.totalTax,
                                daysSinceSaved: Math.floor((Date.now() - new Date(ledger.savedAt).getTime()) / (1000 * 60 * 60 * 24)),
                              });
                              setViewingSavedLedger(ledger);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2333] dark:hover:bg-[#253247] text-slate-705 dark:text-slate-300 rounded-lg font-bold text-[9px] sm:text-[10.5px] transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={() => exportReceiptsToCSV(ledger.receipts, `${ledger.saveName.replace(/\s+/g, "_")}_export.csv`)}
                            className="p-1 sm:p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 transition-colors cursor-pointer"
                            title="Download CSV report"
                          >
                            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRestoreLedger(ledger)}
                            className="px-2 py-1 bg-[#00A3FF] hover:bg-blue-600 text-white rounded-lg font-bold text-[9px] sm:text-[10.5px] transition-all cursor-pointer shadow-3xs flex items-center gap-1 active:scale-95"
                            title="Restore snapshot context to a newly dedicated verification workspace"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Restore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </main>

        <footer className="mt-auto border-t border-slate-200/80 dark:border-[#1e293b]/60 bg-white/40 dark:bg-[#070d19]/40 py-6 text-center text-xs text-slate-400 dark:text-slate-500 font-mono select-none">
          Sandbox Session Separation • Safe Client-Side Keystorage
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Branding Header Banner */}
      <HeaderBanner
        security={security}
        onSecurityChange={handleSecurityChange}
        onWipeData={handleWipeData}
        itemCount={receipts.length}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        currentSessionName={sessions.find(s => s.id === currentSessionId)?.name || ""}
        onSwitchSession={() => setCurrentSessionId(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Dynamic Decryption Alert Banner */}
        {decryptionError && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row items-baseline gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-650 shrink-0 self-center" />
            <div className="flex-1 space-y-1 text-xs text-amber-850">
              <span className="font-bold block text-amber-900">Secure Keystore Lockout</span>
              <p className="leading-relaxed text-[11px] text-amber-700">
                A previous session key mismatch is locking your stored logs. Reset the database to continue.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to clear old locked cache and start new?")) {
                      localStorage.removeItem("nf_receipt_ledger");
                      setReceipts([]);
                      setDecryptionError(null);
                    }
                  }}
                  className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-850 transition text-center cursor-pointer"
                >
                  Clear old cache
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          
          {/* Section 1: The Drop Zone & Batch Monitor */}
          <section className="space-y-4">
            <DropZone
              tasks={tasks}
              onAddFiles={handleAddFiles}
              onRemoveTask={handleRemoveTask}
              onRetryTask={handleRetryTask}
              onSelectTaskToVerify={handleSelectTaskToVerify}
            />
          </section>

          {/* Active Verification Matrix Popup Modal */}
          {activeVerification && (
            <VerificationMatrix
              task={activeVerification}
              onSaveVerification={handleSaveVerification}
              onCancel={handleCancelVerification}
            />
          )}

          <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <ReceiptList
              receipts={receipts}
              onDeleteReceipt={handleDeleteReceipt}
              onDeleteReceipts={handleDeleteReceipts}
              onUpdateReceiptsCategory={handleUpdateReceiptsCategory}
              exchangeRates={exchangeRates}
              onSaveLedger={handleSaveLedger}
            />
          </section>

        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 py-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
          <p>
            No-Fuss Receipt Grabber • Offline Secured Local Storage
          </p>
          <p className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-505">
            <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-505" /> Fully Stateless Backend API Engine
          </p>
        </div>
      </footer>

      {/* Saved Ledger Details Viewer Overlay Modal */}
      {viewingSavedLedger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-805 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 font-sans my-8">
            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-805 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#00A3FF] uppercase tracking-wider">
                  <History className="w-3 h-3 text-[#00A3FF]" />
                  Saved Historical Snapshot
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {viewingSavedLedger.saveName}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-505 font-bold font-mono">
                  Origin Sandbox: {viewingSavedLedger.sessionName} • Saved {new Date(viewingSavedLedger.savedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setViewingSavedLedger(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-5 space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-805 text-slate-405 dark:text-slate-500 uppercase tracking-widest text-[9px] font-black">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Vendor</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5 text-right">Tax</th>
                    <th className="py-2.5 text-right">Amount Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                  {viewingSavedLedger.receipts.map((r) => (
                    <tr key={r.id} className="text-slate-705 dark:text-slate-200">
                      <td className="py-3 font-mono text-[10.5px]">{r.date || "N/A"}</td>
                      <td className="py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">{r.vendor}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {r.category}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-505 dark:text-slate-400">${(r.tax || 0).toFixed(2)}</td>
                      <td className="py-3 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">${r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewingSavedLedger.receipts.length === 0 && (
                <p className="text-center text-slate-400 font-semibold py-8">This ledger was saved with no items.</p>
              )}
            </div>

            {/* Total Footer Row */}
            <div className="bg-slate-50 dark:bg-[#0f172a]/60 border border-slate-150 dark:border-[#1e2a3e]/50 p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-bold">
              <div className="flex gap-4 sm:gap-6 divide-x divide-slate-200 dark:divide-slate-800">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider block font-black">Record Count</span>
                  <span className="font-mono text-slate-800 dark:text-slate-105 font-bold">{viewingSavedLedger.itemCount} item{viewingSavedLedger.itemCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-0.5 pl-4 sm:pl-6">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider block font-black">Consolidated Tax</span>
                  <span className="font-mono text-indigo-550 dark:text-indigo-400 font-bold">${viewingSavedLedger.totalTax.toFixed(2)}</span>
                </div>
                <div className="space-y-0.5 pl-4 sm:pl-6">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider block font-black">Consolidated Total</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm sm:text-base">${viewingSavedLedger.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3.5 border-t border-slate-150 dark:border-slate-805 pt-4">
              <button
                type="button"
                onClick={() => setViewingSavedLedger(null)}
                className="px-4 py-2 bg-slate-105 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-350 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close View
              </button>
              <button
                type="button"
                onClick={() => exportReceiptsToCSV(viewingSavedLedger.receipts, `${viewingSavedLedger.saveName.replace(/\s+/g, "_")}_export.csv`)}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV Report
              </button>
              <button
                type="button"
                onClick={() => handleRestoreLedger(viewingSavedLedger)}
                className="px-4 py-2 bg-[#00A3FF] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Restore Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
