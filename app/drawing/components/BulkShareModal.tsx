"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDocuments,
  bulkCreateGuestLinks,
  bulkRevokeGuestLinks,
  getActiveGuestLinks,
  buildGuestLinkUrl,
  BulkLink,
  DocumentFilters,
} from "../drawingApi";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Same filters page.tsx passes to getDocuments (page/pageSize are ignored). */
  filters: Omit<DocumentFilters, "page" | "pageSize">;
}

interface Item {
  id: number;
  title: string;
  project_name: string;
  deliverable_name: string;
  is_private: boolean;
}

const PAGE_SIZE = 100; // backend max_page_size
const MAX_PAGES = 50;

// jsPDF's built-in fonts only cover Latin-1; anything else would print garbled.
const latin = (s: string) => String(s ?? "").replace(/[^\x00-\xFF]/g, "?");

/**
 * Builds a real A4 portrait PDF with true link annotations (clickable in
 * every PDF viewer), grouped by project. Needs: npm i jspdf
 */
async function downloadPdf(links: BulkLink[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const PW = 210, PH = 297, M = 15, BOTTOM = PH - M;
  const X_N = M, X_T = M + 9, W_T = 72, X_L = M + 86, W_L = PW - M - X_L;
  const BLUE: [number, number, number] = [26, 86, 219];
  let y = M;

  const sorted = [...links].sort(
    (a, b) =>
      a.project_name.localeCompare(b.project_name) ||
      a.deliverable_name.localeCompare(b.deliverable_name) ||
      a.title.localeCompare(b.title)
  );
  const groups = new Map<string, BulkLink[]>();
  sorted.forEach((l) => {
    const k = l.project_name || "No project";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  });

  // Title block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(17);
  pdf.text("Shared Drawings", M, y + 5);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(85);
  pdf.text(
    latin(`${links.length} drawing(s) · ${new Date().toLocaleDateString()} · Anyone with the link can view`),
    M,
    y + 3
  );
  y += 6;
  pdf.setDrawColor(17);
  pdf.setLineWidth(0.5);
  pdf.line(M, y, PW - M, y);
  y += 6;

  const rowHeight = (r: BulkLink) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    const n = pdf.splitTextToSize(latin(r.title), W_T).length;
    return Math.max(n * 4.4 + (r.deliverable_name ? 3.8 : 0), 5) + 2.5;
  };

  groups.forEach((rows, project) => {
    // keep the project heading together with its first row
    if (y + 8 + rowHeight(rows[0]) > BOTTOM) {
      pdf.addPage();
      y = M;
    }
    pdf.setFillColor(238, 238, 238);
    pdf.rect(M, y, PW - 2 * M, 6.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(17);
    pdf.text(latin(project), M + 2, y + 4.6);
    y += 8.5;

    rows.forEach((r, i) => {
      const h = rowHeight(r);
      if (y + h > BOTTOM) {
        pdf.addPage();
        y = M;
      }
      const url = buildGuestLinkUrl(r.code);

      // #
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(119);
      pdf.text(String(i + 1), X_N, y + 4);

      // title + deliverable
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(17);
      const tLines: string[] = pdf.splitTextToSize(latin(r.title), W_T);
      pdf.text(tLines, X_T, y + 4);
      if (r.deliverable_name) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(102);
        pdf.text(latin(r.deliverable_name), X_T, y + 4 + tLines.length * 4.4 - 0.6);
      }

      // clickable link: visible text + underline + real link annotation
      let size = 8.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(size);
      let w = pdf.getTextWidth(url);
      while (w > W_L && size > 6) {
        size -= 0.5;
        pdf.setFontSize(size);
        w = pdf.getTextWidth(url);
      }
      pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      pdf.text(url, X_L, y + 4);
      pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
      pdf.setLineWidth(0.2);
      pdf.line(X_L, y + 4.7, X_L + w, y + 4.7);
      pdf.link(X_L, y + 0.6, w, 4.6, { url });

      // row separator
      pdf.setDrawColor(221, 221, 221);
      pdf.setLineWidth(0.2);
      pdf.line(M, y + h - 0.5, PW - M, y + h - 0.5);
      y += h;
    });
    y += 4;
  });

  pdf.save(`shared-drawings-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function BulkShareModal({ open, onClose, filters }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // id -> existing guest link (only drawings that currently have one)
  const [linkMap, setLinkMap] = useState<Map<number, BulkLink>>(new Map());

  const filtersKey = JSON.stringify(filters);

  // Load ALL drawings matching the current filters (every page) + which of
  // them already have a link.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      setSelected(new Set());
      setQuery("");
      try {
        const all: Item[] = [];
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await getDocuments({ ...filters, page, pageSize: PAGE_SIZE });
          res.results.forEach((d) =>
            all.push({
              id: d.id,
              title: d.title,
              project_name: d.project_name || "No project",
              deliverable_name: d.deliverable_name || "",
              is_private: !!d.is_private,
            })
          );
          if (!res.next || res.results.length === 0) break;
        }
        let links: BulkLink[] = [];
        try {
          links = await getActiveGuestLinks(filters);
        } catch (e) {
          console.error(e); // non-fatal: badges + Revoke just won't know about existing links
        }
        if (!cancelled) {
          setItems(all);
          setLinkMap(new Map(links.map((l) => [l.id, l])));
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Couldn't load drawings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtersKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.project_name.toLowerCase().includes(q) ||
            i.deliverable_name.toLowerCase().includes(q)
        )
      : items;
  }, [items, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    visible.forEach((i) => {
      if (!m.has(i.project_name)) m.set(i.project_name, []);
      m.get(i.project_name)!.push(i);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  const selectedPrivate = items.filter((i) => selected.has(i.id) && i.is_private).length;
  const selectedWithLinkIds = Array.from(selected).filter((id) => linkMap.has(id));

  // PRINT PDF: make sure every selected drawing has a link (mints missing
  // ones, returns existing ones), then build the clickable A4 PDF.
  const handlePrintPdf = async () => {
    if (selected.size === 0) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await bulkCreateGuestLinks(Array.from(selected));
      setLinkMap((prev) => {
        const n = new Map(prev);
        res.links.forEach((l) => n.set(l.id, l));
        return n;
      });
      if (res.links.length === 0) {
        setError("No links could be created for the selected drawings.");
        return;
      }
      await downloadPdf(res.links);
      setNotice(
        `PDF created with ${res.links.length} link(s).` +
          (res.skipped > 0 ? ` ${res.skipped} skipped (no access).` : "")
      );
    } catch (e) {
      console.error(e);
      setError("Failed to create the PDF. If it keeps failing, make sure jspdf is installed (npm i jspdf).");
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (selectedWithLinkIds.length === 0) return;
    if (
      !window.confirm(
        `Revoke ${selectedWithLinkIds.length} link(s)? Anyone holding those links will lose access immediately. This can't be undone (new links get new codes).`
      )
    ) {
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await bulkRevokeGuestLinks(selectedWithLinkIds);
      setLinkMap((prev) => {
        const n = new Map(prev);
        res.revoked.forEach((id) => n.delete(id));
        return n;
      });
      setNotice(
        `${res.revoked.length} link(s) revoked.` +
          (res.skipped > 0 ? ` ${res.skipped} skipped.` : "")
      );
    } catch (e) {
      console.error(e);
      setError("Failed to revoke links.");
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const box: React.CSSProperties = {
    background: "#fff", color: "#111", borderRadius: 10, width: "100%", maxWidth: 640,
    maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
  };
  const btn: React.CSSProperties = {
    padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc",
    background: "#f5f5f5", cursor: "pointer", fontSize: 14, color: "#111",
  };
  const btnPrimary: React.CSSProperties = { ...btn, background: "#111", color: "#fff", border: "1px solid #111" };

  const revokeDisabled = selectedWithLinkIds.length === 0 || working;
  const printDisabled = selected.size === 0 || working;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Share drawings</strong>
          <button style={{ ...btn, padding: "2px 10px" }} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: "10px 18px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in list…"
            style={{ flex: 1, minWidth: 140, padding: "7px 10px", border: "1px solid #ccc", borderRadius: 6, color: "#111", background: "#fff" }}
          />
          <button style={btn} onClick={() => setMany(visible.map((i) => i.id), true)}>All</button>
          <button style={btn} onClick={() => setMany(visible.map((i) => i.id), false)}>None</button>
        </div>

        <div style={{ padding: "0 18px 10px", overflowY: "auto", flex: 1 }}>
          {loading && <p>Loading…</p>}
          {!loading && items.length === 0 && !error && <p>No drawings match the current filters.</p>}
          {grouped.map(([project, docs]) => {
            const ids = docs.map((d) => d.id);
            const allOn = ids.every((id) => selected.has(id));
            return (
              <div key={project} style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", gap: 8, fontWeight: 700, background: "#f3f3f3", padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={allOn} onChange={() => setMany(ids, !allOn)} />
                  {project} <span style={{ fontWeight: 400, color: "#777" }}>({docs.length})</span>
                </label>
                {docs.map((d) => (
                  <label key={d.id} style={{ display: "flex", gap: 8, padding: "5px 8px 5px 24px", cursor: "pointer" }}>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                    <span>
                      {d.title}
                      {d.deliverable_name && <span style={{ color: "#888" }}> · {d.deliverable_name}</span>}
                      {linkMap.has(d.id) && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#0F6E56", border: "1px solid #0F6E56", borderRadius: 4, padding: "0 4px" }}>
                          shared
                        </span>
                      )}
                      {d.is_private && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#b45309", border: "1px solid #b45309", borderRadius: 4, padding: "0 4px" }}>
                          private
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid #eee" }}>
          {selectedPrivate > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#b45309" }}>
              ⚠ {selectedPrivate} private drawing(s) selected. Their links let anyone with the URL view them, and the links never expire.
            </p>
          )}
          {error && <p style={{ margin: "0 0 8px", color: "#b91c1c" }}>{error}</p>}
          {notice && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#0F6E56" }}>{notice}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#666" }}>{selected.size} selected</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={{ ...btn, color: "#b91c1c", borderColor: "#b91c1c", opacity: revokeDisabled ? 0.5 : 1 }}
                disabled={revokeDisabled}
                onClick={handleRevoke}
              >
                Revoke links
              </button>
              <button
                style={{ ...btnPrimary, opacity: printDisabled ? 0.5 : 1 }}
                disabled={printDisabled}
                onClick={handlePrintPdf}
              >
                {working ? "Working…" : "Print PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}