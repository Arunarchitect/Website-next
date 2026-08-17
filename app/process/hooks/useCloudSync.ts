"use client";

import { useEffect, useState } from "react";
import {
  CloudDocSummary,
  changeCloudPassphrase,
  fetchCloudDoc,
  fetchCloudDocList,
  fetchGroupBootstrap,
  fetchGroupDocList,
  saveCloudDoc,
} from "@/app/process/lib/api";
import { ProcessData } from "@/app/process/lib/process-utils";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * `masterword`, when given, scopes this hook to one named group.
 * Now uses the new bootstrap endpoint to fetch the group's list and
 * master doc in one request, and exposes an `initialLoading` flag.
 */
export function useCloudSync(loadData: (data: ProcessData) => void, masterword?: string) {
  const [cloudList, setCloudList] = useState<CloudDocSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);  // ← NEW
  const [cloudError, setCloudError] = useState("");
  const [triedMaster, setTriedMaster] = useState(false);

  const [passphraseChangeBusy, setPassphraseChangeBusy] = useState(false);
  const [passphraseChangeError, setPassphraseChangeError] = useState("");

  const refreshList = async () => {
    try {
      const list = masterword ? await fetchGroupDocList(masterword) : await fetchCloudDocList();
      setCloudList(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setInitialLoading(true);
      setCloudError("");
      try {
        if (masterword) {
          // Use bootstrap to get list + master in one request
          const { documents, master } = await fetchGroupBootstrap(masterword);
          if (!cancelled) {
            setCloudList(documents);
            if (master && master.data) {
              loadData(master.data);
            }
          }
        } else {
          // No masterword – still list all documents, but do not auto‑load a master
          const list = await fetchCloudDocList();
          if (!cancelled) setCloudList(list);
        }
      } catch (err) {
        console.error("Could not load initial data:", err);
        if (!cancelled) setCloudError(getErrorMessage(err, "Failed to load group data."));
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
          setTriedMaster(true);
        }
      }
    };

    loadInitial();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterword]);

  const loadCloudDoc = async (id: number) => {
    setCloudLoading(true);
    setCloudError("");
    try {
      const doc = await fetchCloudDoc(id);
      if (doc.data) loadData(doc.data);
      return doc;
    } catch (err: unknown) {
      setCloudError(getErrorMessage(err, "Failed to load document."));
      throw err;
    } finally {
      setCloudLoading(false);
    }
  };

  const saveToCloud = async (params: {
    passphrase: string;
    person_name?: string;
    title?: string;
    is_master?: boolean;
    master_key?: string;
    masterword?: string;
    data: ProcessData;
  }) => {
    setCloudLoading(true);
    setCloudError("");
    try {
      const doc = await saveCloudDoc({
        ...params,
        // Ensure masterword is always a string (use outer scope, fallback to params, then empty string)
        masterword: masterword ?? params.masterword ?? "",
      });
      await refreshList();
      return doc;
    } catch (err: unknown) {
      setCloudError(getErrorMessage(err, "Failed to save document."));
      throw err;
    } finally {
      setCloudLoading(false);
    }
  };

  const changePassphrase = async (oldPassphrase: string, newPassphrase: string) => {
    setPassphraseChangeBusy(true);
    setPassphraseChangeError("");
    try {
      const doc = await changeCloudPassphrase(oldPassphrase.trim(), newPassphrase.trim());
      await refreshList();
      return doc;
    } catch (err: unknown) {
      setPassphraseChangeError(getErrorMessage(err, "Failed to change passphrase."));
      throw err;
    } finally {
      setPassphraseChangeBusy(false);
    }
  };

  return {
    masterword,
    cloudList,
    cloudLoading,
    initialLoading,       // ← NEW
    cloudError,
    setCloudError,
    triedMaster,
    loadCloudDoc,
    saveToCloud,
    refreshList,
    changePassphrase,
    passphraseChangeBusy,
    passphraseChangeError,
    setPassphraseChangeError,
  };
}