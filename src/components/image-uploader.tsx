"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Upload, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { z } from "zod";
import { removeBackground } from "@imgly/background-removal";

const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const imageFileSchema = z.object({
  type: z.enum(ALLOWED_FILE_TYPES),
  size: z.number().max(5 * 1024 * 1024), // 5MB
});

type AllowedFileType = typeof ALLOWED_FILE_TYPES[number];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const makeCheckerboardStyle = (cell = 12) => ({
  backgroundImage: `
    linear-gradient(45deg, #e6e6e6 25%, transparent 25%),
    linear-gradient(-45deg, #e6e6e6 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e6e6e6 75%),
    linear-gradient(-45deg, transparent 75%, #e6e6e6 75%)
  `,
  backgroundSize: `${cell}px ${cell}px, ${cell}px ${cell}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
  backgroundPosition: `0 0, 0 ${cell / 2}px, ${cell / 2}px -${cell / 2}px, -${cell / 2}px 0px`,
});

export function ImageUploader() {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // toggle for checkerboard preview
  const [useCheckerboard, setUseCheckerboard] = useState(true);

  // image load state for fade-in transitions
  const [originalLoaded, setOriginalLoaded] = useState(false);
  const [processedLoaded, setProcessedLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processedUrlRef = useRef<string | null>(null);

  // lock scrolling while processing to avoid blue overscroll/focus effects
  useEffect(() => {
    if (isProcessing) {
      const prev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = prev || "";
      };
    }
    return;
  }, [isProcessing]);

  // cleanup processed object URL on unmount
  useEffect(() => {
    return () => {
      if (processedUrlRef.current) {
        URL.revokeObjectURL(processedUrlRef.current);
        processedUrlRef.current = null;
      }
      // ensure scroll lock removed
      document.documentElement.style.overflow = "";
    };
  }, []);

  const processImage = async (imageUrl: string) => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setProcessedLoaded(false);

      const blob = await removeBackground(imageUrl, {
        progress: (_key, current, total) => {
          const pct = (current / total) * 100;
          setProgress(pct);
        },
        output: { format: "image/png", quality: 0.8 },
        model: "isnet_fp16",
        debug: false,
      });

      if (processedUrlRef.current) {
        URL.revokeObjectURL(processedUrlRef.current);
        processedUrlRef.current = null;
      }

      const url = URL.createObjectURL(blob);
      processedUrlRef.current = url;
      setProcessedImage(url);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // aborted intentionally, do nothing
      } else {
        console.error("Background removal error:", err);
        setError(
          err instanceof Error
            ? `Failed to remove background: ${err.message}`
            : "Failed to remove background. Please try again.",
        );
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
      abortControllerRef.current = null;
    }
  };

  const validateAndProcessFile = (file: File) => {
    try {
      imageFileSchema.parse({
        type: file.type as AllowedFileType,
        size: file.size,
      });

      setFileName(file.name);
      setFileSize(file.size);
      setError(null);

      // reset loaded flags to allow fade-in each time
      setOriginalLoaded(false);
      setProcessedLoaded(false);
      setProcessedImage(null);

      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = reader.result as string;
        setImage(imageUrl);
        processImage(imageUrl);
      };
      reader.onerror = () => {
        setError("Failed to read the file. Please try again.");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError("Please upload a valid PNG, JPG, or WEBP image (max 5MB).");
      } else {
        setError("Invalid file. Please try a different image.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const clearImage = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (processedUrlRef.current) {
      URL.revokeObjectURL(processedUrlRef.current);
      processedUrlRef.current = null;
    }

    setImage(null);
    setProcessedImage(null);
    setFileName(null);
    setFileSize(null);
    setError(null);
    setIsProcessing(false);
    setProgress(0);
    setOriginalLoaded(false);
    setProcessedLoaded(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "background-removed";
    const link = document.createElement("a");
    link.href = processedImage;
    link.download = `${baseName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // compact min height for previews
const previewHeight = "h-[320px] md:h-[380px]";
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Background Remover</h1>
        <p className="text-sm text-white/70 mt-1">
          Upload a single image (PNG, JPG, WEBP). Max 5MB.
        </p>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:grid md:grid-cols-[380px_1fr] md:gap-8 items-start">
        {/* Left column (controls) */}
        <aside className="space-y-4">
          <Card className="bg-white/6 border border-white/8 rounded-lg h-full">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              {/* Upload area (top) */}
              <div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-md cursor-pointer transition-border border-2 ${
                    isDragging
                      ? "border-purple-400 bg-white/6"
                      : "border-white/20 hover:border-purple-400/50"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                  />
                  <div className="bg-white/8 p-2 rounded-full">
                    <Upload className="h-6 w-6 text-white/80" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-white">Click or drag to upload</div>
                    <div className="text-xs text-white/60 mt-0.5">PNG • JPG • WEBP • ≤ 5MB</div>
                  </div>
                </div>

                {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
              </div>

              {/* Bottom region: file info, progress, actions */}
              <div className="mt-4">
                {image ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-white/90">{fileName ?? "Uploaded image"}</div>
                        <div className="text-xs text-white/60 mt-1">{fileSize ? formatBytes(fileSize) : ""}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-white/80 px-2 py-1 text-xs"
                        >
                          Replace
                        </Button>

                        <Button variant="ghost" size="sm" onClick={clearImage} className="text-red-400 px-2 py-1 text-xs">
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* progress */}
                    {isProcessing && (
                      <div aria-live="polite" className="mt-3">
                        <div className="w-full bg-white/10 h-2 rounded overflow-hidden">
                          <div className="h-full bg-purple-400 transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
                        </div>
                        <div className="text-xs text-white/60 mt-1">Removing background… {Math.round(progress)}%</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-white/60">No file selected</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tips / actions + checkerboard toggle */}
          <Card className="bg-white/4 border border-white/8 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/70">Tip: clear subject + contrasting background yields best results.</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={useCheckerboard}
                  onClick={() => setUseCheckerboard((v) => !v)}
                  className={`text-xs px-2 py-1 rounded-md transition ${
                    useCheckerboard ? "bg-white/6 text-white" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  {useCheckerboard ? "Checkerboard" : "Plain"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {processedImage && (
                <Button variant="ghost" size="sm" onClick={handleDownload} className="text-white/80 px-2 py-1 text-xs">
                  <Download className="h-4 w-4 mr-1" />
                  Download PNG
                </Button>
              )}
            </div>
          </Card>
        </aside>

        {/* Right column (preview) */}
        <section className="h-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-white">Preview</h2>

            <div className="flex items-center gap-2">
              {processedImage && (
                <Button variant="ghost" size="sm" onClick={handleDownload} className="text-white/80 px-2 py-1 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              )}

              {image && (
                <Button variant="ghost" size="sm" onClick={clearImage} className="text-white/80 px-2 py-1 text-xs">
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-6 h-full`}>
            {/* Original */}
            <Card className="h-full bg-white/6 border border-white/10 rounded-lg overflow-hidden" style={{ maxHeight: "60vh" }}>
              <div className={`flex items-center justify-center ${previewHeight} p-6 bg-transparent`}>
                {image ? (
                  <img
                    src={image}
                    alt="Original upload"
                    onLoad={() => setOriginalLoaded(true)}
                    className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${originalLoaded ? "opacity-100" : "opacity-0"}`}      
					style={{ height: "auto", width: "auto" }}     />
                ) : (
                  <div className="text-sm text-white/50">Original will appear here</div>
                )}
              </div>
              <div className="p-3 text-xs text-center text-white/70">Original</div>
            </Card>

            {/* Processed with checkerboard/plain background */}
            <Card className="h-full bg-white/6 border border-white/10 rounded-lg overflow-hidden relative" style={{ maxHeight: "60vh" }}>
              {isProcessing && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-7 w-7 animate-spin text-purple-300 mb-2" />
                    <div className="text-xs text-white/80">{Math.round(progress)}%</div>
                  </div>
                </div>
              )}

              <div
  className={`flex items-center justify-center ${previewHeight} p-6 overflow-hidden`}
  style={processedImage && useCheckerboard ? makeCheckerboardStyle(12) : undefined}
>
  {processedImage ? (
    <img
      src={processedImage}
      alt="Background removed"
      onLoad={() => setProcessedLoaded(true)}
      className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${processedLoaded ? "opacity-100" : "opacity-0"}`}
      style={{ height: "auto", width: "auto" }}
    />
  ) : (
    <div className="text-sm text-white/50">Processed result will appear here</div>
  )}
</div>

              <div className="p-3 text-xs text-center text-white/70">Background removed</div>
            </Card>
          </div>
        </section>
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden space-y-4">
        <Card className="bg-white/6 border border-white/8 rounded-lg">
          <CardContent className="p-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 p-4 rounded-md cursor-pointer ${
                isDragging ? "border-purple-400 bg-white/6 border-2" : "border-white/20 hover:border-purple-400/50 border-2"
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".png,.jpg,.jpeg,.webp" className="hidden" />
              <div className="bg-white/8 p-2 rounded-full">
                <Upload className="h-6 w-6 text-white/80" />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-white">Tap to upload</div>
                <div className="text-xs text-white/60 mt-0.5">PNG, JPG, WEBP • ≤ 5MB</div>
              </div>
            </div>

            {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
          </CardContent>
        </Card>

        {image || processedImage ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-medium text-white">Preview</h2>
              <div className="flex gap-2">
                {processedImage && (
                  <Button variant="ghost" size="sm" onClick={handleDownload} className="text-white/80 px-2 py-1 text-xs">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={clearImage} className="text-white/80 px-2 py-1 text-xs">
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Card className="bg-white/6 border border-white/10 rounded-lg">
                <div className="flex items-center justify-center min-h-[220px] p-4">
                  {image ? (
                    <img
                      src={image}
                      alt="Original"
                      onLoad={() => setOriginalLoaded(true)}
                      className={`max-h-[300px] object-contain transition-opacity duration-300 ${originalLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                  ) : null}
                </div>
                <div className="p-2 text-xs text-center text-white/70">Original</div>
              </Card>

              <Card className="bg-white/6 border border-white/10 rounded-lg">
                <div className="flex items-center justify-center min-h-[220px] p-4" style={processedImage && useCheckerboard ? makeCheckerboardStyle(12) : undefined}>
                  {isProcessing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-400 mb-1" />
                      <div className="text-xs text-white/60">{Math.round(progress)}%</div>
                    </div>
                  ) : processedImage ? (
                    <img
                      src={processedImage}
                      alt="Processed"
                      onLoad={() => setProcessedLoaded(true)}
                      className={`max-h-[300px] object-contain transition-opacity duration-300 ${processedLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                  ) : null}
                </div>
                <div className="p-2 text-xs text-center text-white/70">Background removed</div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}