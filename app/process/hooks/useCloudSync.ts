"use client";

import { useEffect, useState } from "react";
import {
  CloudDocSummary,
  changeCloudPassphrase,
  fetchCloudDoc,
  fetchGroupBootstrap,
  fetchGroupDocList,
  saveCloudDoc,
} from "@/app/process/lib/api";
import { ProcessData } from "@/app/process/lib/process-utils";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * `masterword`, when given, scopes this hook to one named group and enables
 * listing/loading that group's workflows.
 *
 * When `masterword` is NOT provided (e.g. plain `/process`), the hook does
 * NOT fetch any document list — the Load menu should only offer the sample
 * JSON template so other users' workflows are never exposed.
 */
export function useCloudSync(loadData: (data: ProcessData) => void, masterword?: string) {
  const [cloudList, setCloudList] = useState<CloudDocSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");
  const [triedMaster, setTriedMaster] = useState(false);

  const [passphraseChangeBusy, setPassphraseChangeBusy] = useState(false);
  const [passphraseChangeError, setPassphraseChangeError] = useState("");

  const refreshList = async () => {
    // Only groups may list workflows. Plain /process never lists anything.
    if (!masterword) {
      setCloudList([]);
      return;
    }
    try {
      const list = await fetchGroupDocList(masterword);
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
          // Group mode: bootstrap gives us both the doc list and the master doc.
          const { documents, master } = await fetchGroupBootstrap(masterword);
          if (!cancelled) {
            setCloudList(documents);
            if (master && master.data) {
              loadData(master.data);
            }
          }
        } else {
          // Plain /process: never fetch the global list.
          if (!cancelled) setCloudList([]);
        }
      } catch (err) {
        console.error("Could not load initial data:", err);
        if (!cancelled) {
          setCloudError(getErrorMessage(err, "Failed to load group data."));
        }
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
        masterword: masterword ?? params.masterword ?? "",
      });
      // Only refresh the list when we're in group mode.
      if (masterword) {
        await refreshList();
      }
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
      if (masterword) {
        await refreshList();
      }
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
    initialLoading,
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