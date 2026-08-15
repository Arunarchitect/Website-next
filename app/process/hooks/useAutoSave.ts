"use client";

import { useEffect, useRef, useState } from "react";
import { ProcessData } from "@/app/process/lib/process-utils";

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type SaveFn = (params: { passphrase: string; data: ProcessData }) => Promise<unknown>;
type GetDataFn = () => ProcessData | null;

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Silent background autosave to the server.
 * ...(comment unchanged)...
 */
export function useAutosave(getExportData: GetDataFn, saveToCloud: SaveFn) {
  const [enabled, setEnabled] = useState(false);
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const getExportDataRef = useRef(getExportData);
  const saveToCloudRef = useRef(saveToCloud);

  useEffect(() => {
    getExportDataRef.current = getExportData;
  }, [getExportData]);

  useEffect(() => {
    saveToCloudRef.current = saveToCloud;
  }, [saveToCloud]);

  const runSave = async (passOverride?: string) => {
    const pass = passOverride ?? passphrase;
    if (!pass) return;
    const data = getExportDataRef.current();
    if (!data) return;
    setSaving(true);
    try {
      await saveToCloudRef.current({ passphrase: pass, data });
      setLastSavedAt(new Date());
      setError("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Autosave failed."));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled || !passphrase) return;
    const interval = setInterval(() => runSave(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, passphrase]);

  const enable = (pass: string) => {
    setPassphrase(pass.trim());
    setError("");
    setEnabled(true);
  };

  const verifyAndEnable = async (pass: string): Promise<boolean> => {
    const trimmed = pass.trim();
    if (!trimmed) {
      setVerifyError("Enter a passphrase.");
      return false;
    }
    const data = getExportDataRef.current();
    if (!data) {
      setVerifyError("No process data to save yet.");
      return false;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      await saveToCloudRef.current({ passphrase: trimmed, data });
      setPassphrase(trimmed);
      setLastSavedAt(new Date());
      setError("");
      setEnabled(true);
      return true;
    } catch (err: unknown) {
      setVerifyError(getErrorMessage(err, "That passphrase didn't work."));
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const disable = () => {
    setEnabled(false);
  };

  return {
    enabled,
    enable,
    verifyAndEnable,
    verifying,
    verifyError,
    disable,
    lastSavedAt,
    error,
    saving,
    saveNow: () => runSave(),
  };
}