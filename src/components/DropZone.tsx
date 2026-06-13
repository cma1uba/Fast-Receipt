/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { UploadCloud, FileImage, Sparkles, X, RefreshCw, Check, AlertCircle, Camera, Clipboard, ClipboardCheck, Info } from "lucide-react";
import { BatchTask } from "../types";

interface DropZoneProps {
  tasks: BatchTask[];
  onAddFiles: (files: File[]) => void;
  onRemoveTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onSelectTaskToVerify: (task: BatchTask) => void;
}

export default function DropZone({
  tasks,
  onAddFiles,
  onRemoveTask,
  onRetryTask,
  onSelectTaskToVerify,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [showPasteToast, setShowPasteToast] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Monitor clipboard paste (Ctrl+V) for lightning-fast screenshot ingestion
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isCameraActive) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            // Give it a generic name
            const renamedFile = new File([file], `Pasted-Receipt-${Date.now().toString().slice(-6)}.png`, {
              type: file.type
            });
            imageFiles.push(renamedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        onAddFiles(imageFiles);
        setShowPasteToast(true);
        setTimeout(() => setShowPasteToast(false), 3000);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [onAddFiles, isCameraActive]);

  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => console.error("Error starting video playback:", err));
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive, cameraStream]);

  // Lock body scroll when camera is active for an immersive, mobile-native experience
  useEffect(() => {
    if (isCameraActive) {
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isCameraActive]);

  const startCamera = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCameraActive(true);
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err: any) {
      console.error("Camera environment option failed, trying fallback:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setCameraStream(fallbackStream);
      } catch (fallbackErr: any) {
        console.error("All camera entry options failed:", fallbackErr);
        setMediaError("Could not access camera. Please check permissions or upload manually.");
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `Camera-Capture-${Date.now().toString().slice(-6)}.jpg`, {
                type: "image/jpeg",
              });
              onAddFiles([file]);
              stopCamera();
            }
          },
          "image/jpeg",
          0.95
        );
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = (Array.from(e.dataTransfer.files) as File[]).filter((f) =>
        f.type.startsWith("image/")
      );
      if (filesArray.length > 0) {
        onAddFiles(filesArray);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = (Array.from(e.target.files) as File[]).filter((f) =>
        f.type.startsWith("image/")
      );
      if (filesArray.length > 0) {
        onAddFiles(filesArray);
      }
    }
  };

  const triggerInputSelect = () => {
    inputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 1;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {mediaError && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 rounded-xl p-3.5 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm transition-all animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{mediaError}</span>
          </div>
          <button
            onClick={() => setMediaError(null)}
            className="text-[10px] bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-450 px-2.5 py-1 rounded-md hover:bg-rose-100/50 cursor-pointer transition-colors font-bold"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Paste Success Tiny Toast */}
      {showPasteToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 dark:bg-blue-650 text-white rounded-xl px-4 py-3 shadow-lg border border-slate-700/50 flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-350">
          <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          <span>Image parsed successfully from Clipboard!</span>
        </div>
      )}

      {/* Full screen Immersive Live Viewfinder modal */}
      {isCameraActive && (
        <div 
          className="fixed inset-0 z-55 bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Immersive background video stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover z-0"
          />

          {/* Styled Live Camera Floating Tag */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-slate-950/70 backdrop-blur-md rounded-full border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase z-20 select-none shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="font-sans">LIVE CAM</span>
          </div>

          {/* Minimalist Floating 'X' Close button */}
          <button
            type="button"
            onClick={stopCamera}
            className="absolute top-4 right-4 p-2.5 sm:p-3 bg-red-650/80 dark:bg-rose-700/85 hover:bg-red-750 hover:scale-105 active:scale-95 text-white rounded-full transition-all cursor-pointer z-30 shadow-xl border border-white/15 flex items-center justify-center animate-in zoom-in-75 duration-200"
            title="Close Camera"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>

          {/* Guideline Overlay Frame with Corner Hooks */}
          <div className="absolute inset-6 sm:inset-16 md:inset-24 border border-dashed border-white/20 rounded-2xl pointer-events-none flex flex-col items-center justify-between p-6 z-10">
            {/* Brackets */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-[3px] border-l-[3px] border-[#00A3FF]"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t-[3px] border-r-[3px] border-[#00A3FF]"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-[3px] border-l-[3px] border-[#00A3FF]"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-[3px] border-r-[3px] border-[#00A3FF]"></div>

            <div className="mt-auto text-center px-4">
              <span className="bg-slate-950/70 backdrop-blur-md text-white border border-white/10 text-[10px] md:text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-lg select-none">
                Align entire receipt inside box
              </span>
            </div>
          </div>

          {/* Floating Shutter Button Bottom Overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center select-none">
            <button
              type="button"
              onClick={capturePhoto}
              className="group/shutter relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[5px] border-white/90 bg-transparent hover:scale-105 active:scale-90 transition-all cursor-pointer shadow-all-glow"
              title="Capture receipt photo"
            >
              {/* Inner capture core circle */}
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white hover:bg-slate-100 rounded-full transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Visual Drag Space */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerInputSelect}
        className={`group relative border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all duration-300 ${
          isDragOver
            ? "border-[#00A3FF] bg-[#00A3FF]/5 scale-[0.99] shadow-xl cursor-pointer"
            : "border-slate-300 dark:border-[#1e2a3e] bg-white dark:bg-[#0b1220]/72 hover:border-[#00A3FF] dark:hover:border-[#00A3FF]/80 cursor-pointer hover:shadow-lg dark:hover:bg-[#0f192b]/80"
        }`}
      >
        <input
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          multiple
          accept="image/png, image/jpeg, image/jpg"
          className="hidden"
        />

        {/* Visual glow element behind the dropzone */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-[#00A3FF]/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-700"></div>

        <div className="flex flex-col items-center justify-center space-y-6 py-4 relative z-10">
          {/* Styled centered Upload Icon in Cyan matching mockup */}
          <div className="w-20 h-20 bg-[#00A3FF]/5 dark:bg-[#00A3FF]/10 rounded-2xl flex items-center justify-center border border-[#00A3FF]/25 group-hover:bg-[#00A3FF]/15 group-hover:scale-105 transition-all duration-300">
            <UploadCloud className="w-10 h-10 text-[#00A3FF] drop-shadow-[0_2px_8px_rgba(0,163,255,0.4)]" />
          </div>

          <div className="space-y-2 text-center max-w-sm">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Drag & drop your receipt or <span className="text-[#00A3FF] cursor-pointer hover:underline transition-all font-extrabold">browse</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 select-none font-medium">
              Supports PNG, JPG, JPEG
            </p>
            
            {/* Optional Quick Camera/File triggers */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerInputSelect();
                }}
                className="px-4 py-2 bg-slate-950 dark:bg-[#1a2333] hover:bg-slate-900 dark:hover:bg-[#253247] border border-transparent dark:border-slate-800 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2 active:scale-95"
              >
                <UploadCloud className="w-4 h-4 text-[#00A3FF]" />
                Select File
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 bg-blue-500/5 hover:bg-blue-500/10 dark:bg-[#0d1624] dark:hover:bg-[#121f33] border border-blue-500/10 dark:border-blue-500/20 text-[#00A3FF] text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-2 active:scale-95"
              >
                <Camera className="w-4 h-4 text-[#00A3FF]" />
                Use Camera
              </button>
            </div>
          </div>

          <div id="ocr-badge" className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/10 text-xs font-bold select-none shadow-3xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Stateless AI Extraction Engine
          </div>
        </div>
      </div>

      {/* Ongoing Batch Grid Queue */}
      {tasks.length > 0 && (
        <div className="space-y-4 font-sans animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative group inline-block">
                <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors cursor-help shrink-0" />
                <div className="absolute bottom-full left-0 mb-2 w-64 p-2.5 bg-slate-900/95 dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 text-slate-200 dark:text-slate-300 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 leading-relaxed font-normal normal-case text-[10.5px] text-left">
                  Track active AI ingestion progress streams, queue status, or review parsing error logs.
                  <div className="absolute top-full left-1.5 border-[4px] border-transparent border-t-slate-900/95 dark:border-t-slate-950"></div>
                </div>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                PROCESSING IMAGE
              </h3>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {tasks.length} task{tasks.length === 1 ? "" : "s"} total
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tasks.filter((t) => t.status === "completed").length} / {tasks.length} Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task) => {
              const isLoading = task.status === "uploading" || task.status === "extracting";
              return (
                <div
                  key={task.id}
                  className={`group/task relative flex gap-4 p-4 rounded-2xl border transition-all duration-300 overflow-hidden ${
                    task.status === "failed"
                      ? "border-red-200 dark:border-red-900/30 bg-red-50/20 dark:bg-red-950/10"
                      : task.status === "completed"
                      ? "border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-950/10 hover:shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md"
                  }`}
                >
                  {/* Micro Loading Progress Glow Underlay */}
                  {isLoading && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-blue-100 dark:bg-blue-950 overflow-hidden">
                      <div className="h-full bg-blue-600 animate-pulse w-full origin-left duration-1000 scale-x-50"></div>
                    </div>
                  )}

                  {/* Thumbnail Preview Clip */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 flex-shrink-0 shadow-2xs">
                    <img
                      src={task.previewUrl}
                      alt="Receipt Thumbnail"
                      className="w-full h-full object-cover group-hover/task:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {task.status === "completed" && (
                      <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-3xs flex items-center justify-center">
                        <div className="bg-emerald-500 text-white p-1 rounded-full shadow-md scale-110">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Panel */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate font-mono">
                          {task.fileName}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTask(task.id);
                          }}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remove Task"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 select-none">
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-mono font-medium">
                          {formatSize(task.fileSize)}
                        </span>
                        <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest font-bold">
                          {task.fileType.substring(task.fileType.indexOf("/") + 1)}
                        </span>
                      </div>
                    </div>

                    {/* Operation Status Banner */}
                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center">
                        {task.status === "idle" && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Idle</span>
                          </span>
                        )}
                        {task.status === "uploading" && (
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Uploading...</span>
                          </span>
                        )}
                        {task.status === "extracting" && (
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse uppercase tracking-wider">Parsing with AI OCR...</span>
                          </span>
                        )}
                        {task.status === "failed" && (
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-red-650 dark:text-red-400 uppercase tracking-wider">Llm Error</span>
                          </span>
                        )}
                        {task.status === "completed" && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border border-emerald-100/50 dark:border-emerald-900/20 shadow-3xs">
                            Extraction Done
                          </span>
                        )}
                      </div>

                      {/* Action Items according to outcome */}
                      {task.status === "completed" && task.extractedData && (
                        <button
                          onClick={() => onSelectTaskToVerify(task)}
                          className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] cursor-pointer shadow-sm hover:shadow px-3.5 py-1.5 rounded-xl transition-all"
                        >
                          Verify &amp; Save
                        </button>
                      )}                      {task.status === "failed" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onRetryTask(task.id)}
                            className="text-[11px] bg-red-50 hover:bg-red-100 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 overflow-hidden text-red-700 dark:text-red-400 px-3 py-1 rounded-lg cursor-pointer font-bold transition-all"
                          >
                            Retry Capture
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Absolute positioning error drawer for failing parse tasks */}
                  {task.error && (
                    <div className="absolute inset-x-0 bottom-0 bg-red-600 text-[10px] text-white p-1.5 px-3 font-mono truncate border-t border-red-500 rounded-b-2xl">
                      <strong>Analysis Blocked:</strong> {task.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
