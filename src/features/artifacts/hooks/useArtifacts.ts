"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveFile } from "../types";
import { isArtifactsListResponse, parseApiError } from "../lib/api";

/**
 * Data-fetching hook for Google Drive artifacts.
 * Manages files, loading, error, and refresh state.
 */
export function useArtifacts(isSelected: boolean) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/artifacts");
      if (!res.ok) {
        throw new Error(await parseApiError(res, "Failed to load artifacts"));
      }
      const data: unknown = await res.json();
      if (!isArtifactsListResponse(data)) {
        throw new Error("Unexpected response format from artifacts API");
      }
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      setUploadError(null);

      try {
        const results = await Promise.allSettled(
          Array.from(fileList).map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/artifacts/upload", {
              method: "POST",
              body: formData,
            });
            if (!res.ok) {
              throw new Error(
                await parseApiError(res, `Upload failed for ${file.name}`),
              );
            }
          }),
        );

        const failures = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        if (failures.length > 0) {
          const msgs = failures.map((f) =>
            f.reason instanceof Error ? f.reason.message : "Upload failed",
          );
          setUploadError(
            failures.length === fileList.length
              ? `All uploads failed: ${msgs[0]}`
              : `${failures.length}/${fileList.length} failed: ${msgs.join("; ")}`,
          );
        }

        await fetchFiles(true);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fetchFiles],
  );

  const clearUploadError = useCallback(() => setUploadError(null), []);

  useEffect(() => {
    if (!isSelected) return;
    void fetchFiles();
  }, [isSelected, fetchFiles]);

  return {
    files,
    loading,
    error,
    refreshing,
    uploading,
    uploadError,
    fileInputRef,
    fetchFiles,
    handleUpload,
    clearUploadError,
  };
}
