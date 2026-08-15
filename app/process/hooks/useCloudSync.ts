"use client";

import { useEffect, useState } from "react";
import {
  CloudDocSummary,
  changeCloudPassphrase,
  fetchCloudDoc,
  fetchCloudDocList,
  fetchMasterDoc,
  saveCloudDoc,
} from "@/app/process/lib/api";
import { ProcessData } from "@/app/process/lib/process-utils";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useCloudSync(loadData: (data: ProcessData) => void) {
  const [cloudList, setCloudList] = useState<CloudDocSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [triedMaster, setTriedMaster] = useState(false);

  const [passphraseChangeBusy, setPassphraseChangeBusy] = useState(false);
  const [passphraseChangeError, setPassphraseChangeError] = useState("");

  const refreshList = async () => {
    try {
      const list = await fetchCloudDocList();
      setCloudList(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshList();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const master = await fetchMasterDoc();
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
  }, []);

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
    data: ProcessData;
  }) => {
    setCloudLoading(true);
    setCloudError("");
    try {
      const doc = await saveCloudDoc(params);
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