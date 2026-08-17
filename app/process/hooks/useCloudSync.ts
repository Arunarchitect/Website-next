"use client";

import { useEffect, useState } from "react";
import {
  CloudDocSummary,
  changeCloudPassphrase,
  fetchCloudDoc,
  fetchCloudDocList,
  fetchGroupDocList,
  fetchGroupMasterDoc,
  fetchMasterDoc,
  saveCloudDoc,
} from "@/app/process/lib/api";
import { ProcessData } from "@/app/process/lib/process-utils";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * `masterword`, when given, scopes this hook to one named group:
 * - the list is that group's documents instead of everyone's
 * - the initial load is that group's master instead of the default page's
 * - saveToCloud auto-joins the doc to this group (sends `masterword`)
 *   unless the caller explicitly overrides it in the params they pass
 */
export function useCloudSync(loadData: (data: ProcessData) => void, masterword?: string) {
  const [cloudList, setCloudList] = useState<CloudDocSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
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
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterword]);

  useEffect(() => {
    (async () => {
      try {
        const master = masterword ? await fetchGroupMasterDoc(masterword) : await fetchMasterDoc();
        if (master && master.data) {
          loadData(master.data);
        }
      } catch (err) {
        console.error("Could not load master document:", err);
      } finally {
        setTriedMaster(true);
      }
    })();
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
        masterword,
        ...params,
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