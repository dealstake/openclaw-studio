"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveFile } from "../types";

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
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as { files: DriveFile[] };
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
        for (const file of Array.from(fileList)) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/artifacts/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              (body as { error?: string }).error ||
                `Upload failed (${res.status})`,
            );
          }
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
