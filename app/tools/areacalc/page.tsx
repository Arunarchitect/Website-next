/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  UNIT_SYSTEMS, calcGrossArea, groupByFloor, makeSpaceFromTemplate,
  type UnitKey, type SpaceTemplate, type SpaceInstance, type ProjectTemplate,
} from "./areadata";
import {
  fetchCountries, fetchStates, fetchPlaces, fetchRateLookup,
  fetchSpaceTemplates, fetchProjectTemplates, fetchMyRole,
  fetchCustomProjectTemplates, saveCustomProjectTemplate,
  updateCustomProjectTemplate, saveGeneralProjectTemplate,
  updatePublicProjectTemplate, fetchRateSnapshot,
  deleteCustomProjectTemplate, deletePublicProjectTemplate,
  type ApiCountry, type ApiState, type ApiRateStatus,
  type ApiMyRole, type ApiCustomProjectTemplate,
  type ApiProjectTemplate, type ApiRateSnapshot,
  toSpaceTemplate, toProjectTemplate, 
} from "./areacalcApi";
import { type ImportPayload } from "./SpaceRequirementCsvButton";
import { StickyBar } from "./_components/ui";
import {
  WizardProgress, StepLocation, StepProjectType,
  StepSpaces, StepSummary, type WizardStep,
} from "./_components/WizardSteps";
import {
  SaveAsGeneralModal,
  type ActiveTemplateSource,
} from "./_components/TemplateManager";

// ─── Occupancy / finish metadata ─────────────────────────────

const OCCUPANCY_TYPE_META: Record<string, { emoji: string; label: string }> = {
  residential:   { emoji: "🏠", label: "Home / Villa"        },
  commercial:    { emoji: "🏢", label: "Shop / Office"       },
  institutional: { emoji: "🏫", label: "School / Hospital"   },
  industrial:    { emoji: "🏭", label: "Warehouse / Factory" },
  mixed:         { emoji: "🏙️", label: "Mixed Use"           },
};

const FINISH_LEVEL_META: Record<string, { emoji: string; label: string; hint: string }> = {
  basic:    { emoji: "🪨", label: "Basic",    hint: "Plain plaster, simple tiles"       },
  medium:   { emoji: "🧱", label: "Medium",   hint: "Branded tiles, modular kitchen"    },
  standard: { emoji: "🧱", label: "Standard", hint: "Branded tiles, modular kitchen"    },
  premium:  { emoji: "✨", label: "Premium",  hint: "Imported materials, false ceiling"  },
  luxury:   { emoji: "💎", label: "Luxury",   hint: "Marble, designer fittings"         },
};

// ─── App ──────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState<WizardStep>("location");

  // ── Geography ────────────────────────────────────────────────
  const [countries,     setCountries]    = useState<ApiCountry[]>([]);
  const [statesList,    setStatesList]   = useState<ApiState[]>([]);
  const [placesList,    setPlacesList]   = useState<{ id: number; name: string }[]>([]);
  const [countryId,     setCountryId]    = useState<number | null>(null);
  const [stateId,       setStateId]      = useState<number | null>(null);
  const [placeId,       setPlaceId]      = useState<number | null>(null);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const pendingLocationRef = useRef<{ stateId: number | null; placeId: number | null } | null>(null);

  // ── Project settings ─────────────────────────────────────────
  const [finishLevel,   setFinishLevel]   = useState("");
  const [occupancyType, setOccupancyType] = useState("");
  const [wall,          setWall]          = useState(10);
  const [circ,          setCirc]          = useState(15);
  const [unit,          setUnit]          = useState<UnitKey>("sqft");
  const [projectName,   setProjectName]   = useState("Untitled Project");
  const [clientName,    setClientName]    = useState("");
  const [customRate,    setCustomRate]    = useState<number | null>(null);

  // ── Templates ────────────────────────────────────────────────
  const [spaceTemplates,   setSpaceTemplates]   = useState<SpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // ── Spaces ───────────────────────────────────────────────────
  const [spaces, setSpaces] = useState<SpaceInstance[]>([]);

  // ── Rate ─────────────────────────────────────────────────────
  const [rateStatus,  setRateStatus]  = useState<ApiRateStatus | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // ── Role + custom templates ──────────────────────────────────
  const [myRole,          setMyRole]          = useState<ApiMyRole | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ApiCustomProjectTemplate[]>([]);
  const [savingTemplate,  setSavingTemplate]  = useState(false);
  const [templateSaveMsg, setTemplateSaveMsg] = useState("");

  // ── Active template source ───────────────────────────────────
  const [activeTemplateSource, setActiveTemplateSource] = useState<ActiveTemplateSource>(null);

  // ── Modals ───────────────────────────────────────────────────
  const [generalModalOpen,     setGeneralModalOpen]     = useState(false);
  const [generalTemplateSaved, setGeneralTemplateSaved] = useState("");
  const [saveAsCustomOpen,     setSaveAsCustomOpen]     = useState(false);

  // ── Snapshots ────────────────────────────────────────────────
  const [allSnapshots,   setAllSnapshots]   = useState<ApiRateSnapshot[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [placeHasData,   setPlaceHasData]   = useState(false);

  // ── Derived occupancy type / finish level options ────────────
  const occupancyTypes = useMemo(() => {
    const seen = new Set<string>();
    return allSnapshots
      .filter((s) => s.occupancy_type !== "" && s.finish_level === "")
      .filter((s) => { const ok = !seen.has(s.occupancy_type); seen.add(s.occupancy_type); return ok; })
      .map((s) => ({
        value: s.occupancy_type,
        label: OCCUPANCY_TYPE_META[s.occupancy_type]?.label ?? s.occupancy_type,
        emoji: OCCUPANCY_TYPE_META[s.occupancy_type]?.emoji ?? "🏗️",
      }));
 
  }, [allSnapshots]);

  const finishLevels = useMemo(() => {
    const seen = new Set<string>();
    return allSnapshots
      .filter((s) => s.finish_level !== "" && s.occupancy_type === "")
      .filter((s) => { const ok = !seen.has(s.finish_level); seen.add(s.finish_level); return ok; })
      .map((s) => ({
        value: s.finish_level,
        label: FINISH_LEVEL_META[s.finish_level]?.label ?? s.finish_level,
        emoji: FINISH_LEVEL_META[s.finish_level]?.emoji ?? "🏗️",
        hint:  FINISH_LEVEL_META[s.finish_level]?.hint  ?? "",
      }));
  
  }, [allSnapshots]);

  const snapshotRate = useMemo((): number | null => {
    if (allSnapshots.length === 0) return null;
    const exact = allSnapshots.find((s) => s.occupancy_type === occupancyType && s.finish_level === finishLevel);
    if (exact) return exact.avg_rate;
    const occOnly = allSnapshots.find((s) => s.occupancy_type === occupancyType && s.finish_level === "");
    if (occOnly) return occOnly.avg_rate;
    return allSnapshots.find((s) => s.occupancy_type === "" && s.finish_level === "")?.avg_rate ?? null;
  }, [allSnapshots, occupancyType, finishLevel]);

  const costPerSqft = customRate !== null ? customRate : (snapshotRate ?? 2000);

  // ── Derived ──────────────────────────────────────────────────
  const selectedCountry = countries.find((c) => c.id === countryId);
  const selectedState   = statesList.find((s) => s.id === stateId);
  const selectedPlace   = placesList.find((p) => p.id === placeId);
  const locationLabel   = [selectedCountry?.name, selectedState?.name, selectedPlace?.name].filter(Boolean).join(" · ");
  const totals          = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups     = useMemo(() => groupByFloor(spaces), [spaces]);
  const canSavePublic   = myRole?.role === "member" || myRole?.role === "admin";

  // ── Snapshot fetch ───────────────────────────────────────────
  useEffect(() => {
    if (!countryId) return;
    setLoadingOptions(true);

    const applySnapshots = (rows: ApiRateSnapshot[]) => {
      setAllSnapshots(rows);
      const occs = [...new Set(rows.filter((r) => r.occupancy_type !== "" && r.finish_level === "").map((r) => r.occupancy_type))];
      if (occs.length > 0 && !occs.includes(occupancyType)) setOccupancyType(occs[0]);
      const fins = [...new Set(rows.filter((r) => r.finish_level !== "" && r.occupancy_type === "").map((r) => r.finish_level))];
      if (fins.length > 0 && !fins.includes(finishLevel)) setFinishLevel(fins.includes("basic") ? "basic" : fins[0]);
    };

    (async () => {
      try {
        if (placeId) {
          const placeRows = await fetchRateSnapshot({ scope: "place", place_id: placeId });
          if (placeRows.some((r) => r.occupancy_type !== "" || r.finish_level !== "")) {
            setPlaceHasData(true); applySnapshots(placeRows); return;
          }
        }
        setPlaceHasData(false);
        applySnapshots(await fetchRateSnapshot({ scope: "country", country_id: countryId }));
      } catch (err) { console.error(err); }
      finally { setLoadingOptions(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, placeId]);

  // ── rateStatus fetch ─────────────────────────────────────────
  useEffect(() => {
    if (!placeId) { setRateStatus(null); return; }
    setLoadingRate(true);
    fetchRateLookup(placeId, null,
      finishLevel   && finishLevel   !== "unknown" ? finishLevel   : undefined,
      occupancyType && occupancyType !== "unknown" ? occupancyType : undefined,
    ).then((data) => setRateStatus(data.rate_status)).catch(console.error).finally(() => setLoadingRate(false));
  }, [placeId, finishLevel, occupancyType]);

  // ── Mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetchCountries().then((data) => {
      setCountries(data);
      const india = data.find((c) => c.code?.toUpperCase() === "IN" || c.name.toLowerCase() === "india");
      if (india) setCountryId(india.id);
    }).catch(console.error);

    Promise.all([fetchSpaceTemplates(), fetchProjectTemplates()])
      .then(([sts, pts]) => {
        setSpaceTemplates(sts.map(toSpaceTemplate));
        setProjectTemplates(pts.map(toProjectTemplate));
      })
      .catch(console.error).finally(() => setLoadingTemplates(false));

    fetchMyRole().then((role) => {
      setMyRole(role);
      if (role.can_save_custom_templates) fetchCustomProjectTemplates().then(setCustomTemplates).catch(console.error);
    }).catch(console.error);
  }, []);

  // ── Geography cascades ───────────────────────────────────────
  useEffect(() => {
    if (!countryId) { setStatesList([]); setStateId(null); return; }
    setLoadingStates(true);
    fetchStates(countryId).then((data) => {
      setStatesList(data);
      if (pendingLocationRef.current) setStateId(pendingLocationRef.current.stateId);
      else { setStateId(null); setPlaceId(null); }
    }).catch(console.error).finally(() => setLoadingStates(false));
 
  }, [countryId]);

  useEffect(() => {
    if (!stateId) { setPlacesList([]); setPlaceId(null); return; }
    setLoadingPlaces(true);
    fetchPlaces(stateId).then((data) => {
      setPlacesList(data);
      if (pendingLocationRef.current) { setPlaceId(pendingLocationRef.current.placeId); pendingLocationRef.current = null; }
      else setPlaceId(null);
    }).catch(console.error).finally(() => setLoadingPlaces(false));
  }, [stateId]);

  // ── Wizard navigation ────────────────────────────────────────
  const goNext = (from: WizardStep) => {
    const order: WizardStep[] = ["location", "project-type", "spaces", "summary"];
    const idx = order.indexOf(from);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };
  const goBack = (from: WizardStep) => {
    const order: WizardStep[] = ["location", "project-type", "spaces", "summary"];
    const idx = order.indexOf(from);
    if (idx > 0) setStep(order[idx - 1]);
  };

  // ── Save helpers ─────────────────────────────────────────────
  // NOTE: always pass current projectName explicitly so the saved data
  // reflects whatever is in the header input at save time.
  function buildSaveData(nameOverride?: string) {
    return {
      projectName: nameOverride ?? projectName,
      clientName,
      unit,
      wall,
      circ,
      spaces,
      countryId,
      stateId,
      placeId,
      customRate,
    };
  }

  function buildPublicSpacesPayload() {
    return spaces
      .filter((s) => {
        if (s.isCustom) return false;
        const st = spaceTemplates.find((x) => x.id === s.templateId);
        return !!st?.dbId;
      })
      .map((s, idx) => {
        const st = spaceTemplates.find((x) => x.id === s.templateId)!;
        const subIds = s.subSpaces
          .map((sub) => st.subSpaces?.find((x) => x.id === sub.templateId)?.dbId)
          .filter((id): id is number => typeof id === "number");
        return {
          id: s.projectSpaceDbId,
          space_template: st.dbId!,
          floor: s.floor,
          override_l: s.L !== st.L ? s.L : null,
          override_b: s.B !== st.B ? s.B : null,
          sort_order: idx,
          sub_ids: subIds,
        };
      });
  }

  // ── handleSave ───────────────────────────────────────────────
  async function handleSave() {
    if (!myRole?.can_save_custom_templates && !canSavePublic) {
      setTemplateSaveMsg("Beta Version."); return;
    }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }

    // No active template → open the right "save as" modal
    if (activeTemplateSource === null) {
      if (myRole?.can_save_custom_templates) setSaveAsCustomOpen(true);
      else if (canSavePublic) setGeneralModalOpen(true);
      return;
    }

    try {
      setSavingTemplate(true); setTemplateSaveMsg("");

      if (activeTemplateSource.type === "custom") {
        // ── Update existing custom template ──────────────────────
        // Also update the label to match the current project name in the header.
        const newLabel = projectName.trim() || customTemplates.find((t) => t.id === activeTemplateSource.id)?.label || "Untitled";
        const updated = await updateCustomProjectTemplate(activeTemplateSource.id, {
          label: newLabel,
          data: buildSaveData(newLabel),
        });
        setCustomTemplates((prev) => prev.map((t) => t.id === activeTemplateSource.id ? updated : t));
        // Keep projectName in sync with saved label
        setProjectName(updated.label);
        setTemplateSaveMsg("✓ Template updated.");

      } else if (activeTemplateSource.type === "public") {
        if (!canSavePublic) { setTemplateSaveMsg("Member / admin role required to update public templates."); return; }
        const tpl = projectTemplates.find((t) => t.dbId === activeTemplateSource.id);
        if (!tpl) { setTemplateSaveMsg("Template not found."); return; }

        const spacesPayload = buildPublicSpacesPayload();
        if (spacesPayload.length === 0) {
          setTemplateSaveMsg("No template-backed spaces found."); return;
        }

        // Use current projectName as the template label if it differs from tpl.label
        const newLabel = projectName.trim() || tpl.label;
        const updated = await updatePublicProjectTemplate(activeTemplateSource.id, {
          template_id: tpl.id,
          label: newLabel,
          description: tpl.description,
          icon: tpl.icon,
          spaces: spacesPayload,
        });
        const updatedTpl = toProjectTemplate(updated);

        if (updatedTpl.spaces.length === 0 && spacesPayload.length > 0) {
          setProjectTemplates((prev) => prev.map((t) =>
            t.dbId === activeTemplateSource.id
              ? {
                  ...tpl,
                  label: newLabel,
                  spaces: spacesPayload.map((sp) => {
                    const st = spaceTemplates.find((x) => x.dbId === sp.space_template);
                    return {
                      dbId: sp.id,
                      templateId: st?.id ?? "",
                      floor: sp.floor,
                      L: typeof sp.override_l === "number" ? sp.override_l : (st?.L ?? 0),
                      B: typeof sp.override_b === "number" ? sp.override_b : (st?.B ?? 0),
                      subIds: [],
                    };
                  }).filter((sp) => sp.templateId),
                }
              : t,
          ));
        } else {
          setProjectTemplates((prev) => prev.map((t) => t.dbId === activeTemplateSource.id ? updatedTpl : t));
        }
        // Sync header project name to the saved label
        setProjectName(newLabel);
        setTemplateSaveMsg("✓ Public template updated.");
      }
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save.");
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── handleSaveAsCustomConfirm ────────────────────────────────
  // Called when the user confirms the name in SaveAsCustomModal.
  // The chosen label becomes the new project name in the header.
  async function handleSaveAsCustomConfirm(label: string) {
    const saved = await saveCustomProjectTemplate({
      label,
      description: "User saved",
      icon: "🏠",
      data: buildSaveData(label),          // persist the label as projectName too
      source_project_template: activeTemplateSource?.type === "public" ? activeTemplateSource.id : null,
    });
    setCustomTemplates((prev) => [saved, ...prev]);
    // ── Sync header project name to saved label ──────────────
    setProjectName(label);
    setActiveTemplateSource({ type: "custom", id: saved.id });
    setTemplateSaveMsg("✓ Saved as custom template.");
  }

  // ── handleSaveAsCustom ───────────────────────────────────────
  function handleSaveAsCustom() {
    if (!myRole?.can_save_custom_templates) { setTemplateSaveMsg("Beta Version."); return; }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    setSaveAsCustomOpen(true);
  }

  // ── handleSaveAsPublic ───────────────────────────────────────
  function handleSaveAsPublic() {
    if (!canSavePublic) { setTemplateSaveMsg("Member / admin role required."); return; }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    setGeneralModalOpen(true);
  }

  // ── handleGeneralTemplateSaved ───────────────────────────────
  // Called after SaveAsGeneralModal finishes — label becomes the project name.
  function handleGeneralTemplateSaved(tpl: ApiProjectTemplate) {
    const converted = toProjectTemplate(tpl);
    setProjectTemplates((prev) => [...prev, converted]);
    // ── Sync header project name to the published template label ──
    setProjectName(tpl.label || "Untitled Project");
    setActiveTemplateSource({ type: "public", id: tpl.id });
    setGeneralModalOpen(false);
    setGeneralTemplateSaved(`✓ "${tpl.label}" published.`);
    setTimeout(() => setGeneralTemplateSaved(""), 5000);
  }

  // ── Delete templates ─────────────────────────────────────────
  async function handleDeleteCustomTemplate(id: number) {
    await deleteCustomProjectTemplate(id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    if (activeTemplateSource?.type === "custom" && activeTemplateSource.id === id) {
      setActiveTemplateSource(null); setTemplateSaveMsg("Template deleted.");
    }
  }

  async function handleDeletePublicTemplate(templateStringId: string) {
    const tpl = projectTemplates.find((t) => t.id === templateStringId);
    if (!tpl?.dbId) return;
    await deletePublicProjectTemplate(tpl.dbId);
    setProjectTemplates((prev) => prev.filter((t) => t.id !== templateStringId));
    if (activeTemplateSource?.type === "public" && activeTemplateSource.id === tpl.dbId) setActiveTemplateSource(null);
    setTemplateSaveMsg("✓ Public template deleted.");
  }

  // ── Load templates ───────────────────────────────────────────
  function handleLoadPublicTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces.map(({ dbId, templateId, floor, L, B, subIds }) => {
      const t = spaceTemplates.find((x) => x.id === templateId);
      return t ? makeSpaceFromTemplate(t, floor, subIds, L, B, dbId) : null;
    }).filter((x): x is SpaceInstance => x !== null);
    setSpaces(newSpaces);
    setProjectName(tpl.label || "Untitled Project");
    setClientName((prev) => prev || "Name");
    setActiveTemplateSource(tpl.dbId != null ? { type: "public", id: tpl.dbId } : null);
    setTemplateSaveMsg("Opened a public template.");
  }

  function handleLoadCustomTemplate(tpl: ApiCustomProjectTemplate) {
    const data = tpl.data as Partial<ReturnType<typeof buildSaveData>>;
    // Project name: prefer data.projectName, then template label
    const loadedProjectName =
      typeof data.projectName === "string" && data.projectName.trim() && data.projectName !== "Untitled Project"
        ? data.projectName
        : tpl.label;
    setProjectName(loadedProjectName || "Untitled Project");
    setClientName(data.clientName ?? "Name");
    if (data.unit === "sqft" || data.unit === "sqm") setUnit(data.unit);
    if (typeof data.wall === "number") setWall(data.wall);
    if (typeof data.circ === "number") setCirc(data.circ);
    if (typeof data.countryId === "number" || data.countryId === null) {
      setCountryId(data.countryId ?? null);
      pendingLocationRef.current = {
        stateId: typeof data.stateId === "number" ? data.stateId : null,
        placeId: typeof data.placeId === "number" ? data.placeId : null,
      };
    }
    setCustomRate(typeof data.customRate === "number" ? data.customRate : null);
    setSpaces((data.spaces as SpaceInstance[] | undefined) || []);
    setActiveTemplateSource({ type: "custom", id: tpl.id });
    setTemplateSaveMsg("Opened custom template. Save will update this template.");
  }

  // ── CSV import ───────────────────────────────────────────────
  const handleCsvImport = useCallback((
    payload: ImportPayload & { countryId?: number | null; stateId?: number | null; placeId?: number | null },
  ) => {
    setProjectName(payload.projectName);
    setClientName(payload.clientName);
    setUnit(payload.unit);
    setWall(payload.wall);
    setCirc(payload.circ);
    setSpaces(payload.spaces);
    setActiveTemplateSource(null);
    setTemplateSaveMsg("");
    if (payload.countryId && payload.stateId && payload.placeId) {
      pendingLocationRef.current = { stateId: payload.stateId, placeId: payload.placeId };
      if (countryId === payload.countryId) setStateId(payload.stateId);
      else setCountryId(payload.countryId);
    }
    setStep("spaces");
 
  }, [countryId]);

  // ── Shared save button props ─────────────────────────────────
  const displaySaveMsg = generalTemplateSaved || templateSaveMsg;
  const saveButtonSharedProps = {
    myRole, savingTemplate, templateSaveMsg: displaySaveMsg,
    activeTemplateSource,
    canSaveCustom: myRole?.can_save_custom_templates ?? false,
    canSavePublic,
    onSave: handleSave,
    onSaveAsCustom: handleSaveAsCustom,
    onSaveAsPublic: handleSaveAsPublic,
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="ac-root">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f4f1; font-family: 'Segoe UI', system-ui, sans-serif; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 1; }
 
        .ac-root input,
        .ac-root select,
        .ac-root textarea {
          color-scheme: light;
          background-color: #ffffff;
          color: #111827;
          -webkit-text-fill-color: #111827;
        }
        .ac-root input::placeholder,
        .ac-root textarea::placeholder {
          color: #9ca3af;
          -webkit-text-fill-color: #9ca3af;
          opacity: 1;
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.05)", position: "sticky", top: 0, zIndex: 80 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 160px", minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📐</div>
            <div style={{ minWidth: 0 }}>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name"
                style={{ fontSize: 14, fontWeight: 700, color: "#111827", background: "transparent", border: "none", borderBottom: "2px solid transparent", outline: "none", width: "100%", maxWidth: 160, transition: "border-color .15s" }}
                onFocus={(e) => { e.target.style.borderBottomColor = "#f59e0b"; }}
                onBlur={(e)  => { e.target.style.borderBottomColor = "transparent"; }} />
              <p style={{ margin: 0, fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .4 }}>Cost Estimator</p>
            </div>
          </div>
          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name"
              style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", outline: "none", width: "100%", transition: "border-color .15s" }}
              onFocus={(e) => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#fff"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
          </div>
          {locationLabel && (
            <span onClick={() => setStep("location")} style={{ fontSize: 11, color: "#047857", background: "#ecfdf5", padding: "4px 9px", borderRadius: 20, border: "1px solid #a7f3d0", cursor: "pointer", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
              📍 {locationLabel}
            </span>
          )}
          {customRate !== null && (
            <span onClick={() => setStep("project-type")} title="Custom rate active — click to edit"
              style={{ fontSize: 11, color: "#be185d", background: "#fdf2f8", padding: "4px 9px", borderRadius: 20, border: "1px solid #f9a8d4", cursor: "pointer", flexShrink: 0 }}>
              ✏️ ₹{customRate.toLocaleString("en-IN")}/sqft
            </span>
          )}
          {/* Show which template is active */}
          {activeTemplateSource && (
            <span style={{
              fontSize: 11,
              color: activeTemplateSource.type === "custom" ? "#166534" : "#4338ca",
              background: activeTemplateSource.type === "custom" ? "#dcfce7" : "#eef2ff",
              padding: "4px 9px", borderRadius: 20,
              border: `1px solid ${activeTemplateSource.type === "custom" ? "#bbf7d0" : "#c7d2fe"}`,
              flexShrink: 0, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {activeTemplateSource.type === "custom" ? "💾" : "🌐"} {projectName}
            </span>
          )}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {(["sqft", "sqm"] as UnitKey[]).map((u) => (
              <button key={u} type="button" onClick={() => setUnit(u)} style={{
                padding: "4px 10px", borderRadius: 5, border: "none",
                background: unit === u ? "#fff" : "transparent",
                fontWeight: unit === u ? 700 : 500, fontSize: 11,
                color: unit === u ? "#111827" : "#9ca3af", cursor: "pointer",
                boxShadow: unit === u ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              }}>{u}</button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "18px 14px 110px" }}>
        <WizardProgress step={step} onJump={setStep} />

        {step === "location" && (
          <StepLocation
            countries={countries} statesList={statesList} placesList={placesList}
            countryId={countryId} stateId={stateId} placeId={placeId}
            setCountryId={setCountryId} setStateId={setStateId} setPlaceId={setPlaceId}
            loadingStates={loadingStates} loadingPlaces={loadingPlaces}
            onNext={() => goNext("location")} onCsvImport={handleCsvImport} />
        )}

        {step === "project-type" && (
          <StepProjectType
            occupancyTypes={occupancyTypes} finishLevels={finishLevels}
            loadingOptions={loadingOptions} placeHasData={placeHasData}
            occupancyType={occupancyType} setOccupancyType={setOccupancyType}
            finishLevel={finishLevel} setFinishLevel={setFinishLevel}
            currentRate={snapshotRate} customRate={customRate} setCustomRate={setCustomRate}
            wall={wall} setWall={setWall} circ={circ} setCirc={setCirc}
            onNext={() => goNext("project-type")} onBack={() => goBack("project-type")} />
        )}

        {step === "spaces" && (
          <StepSpaces
            spaces={spaces} setSpaces={setSpaces}
            spaceTemplates={spaceTemplates} projectTemplates={projectTemplates}
            customTemplates={customTemplates}
            unit={unit} loadingTemplates={loadingTemplates}
            locationLabel={locationLabel} clientName={clientName} projectName={projectName}
            wall={wall} circ={circ} costPerSqft={costPerSqft}
            totals={totals} floorGroups={floorGroups}
            rateStatus={rateStatus} onCsvImport={handleCsvImport}
            saveAsCustomOpen={saveAsCustomOpen} setSaveAsCustomOpen={setSaveAsCustomOpen}
            onSaveAsCustomConfirm={handleSaveAsCustomConfirm}
            onDeleteCustom={handleDeleteCustomTemplate}
            onDeletePublic={handleDeletePublicTemplate}
            onLoadProjectTemplate={handleLoadPublicTemplate}
            onLoadCustomProjectTemplate={handleLoadCustomTemplate}
            onNext={() => goNext("spaces")} onBack={() => goBack("spaces")}
            {...saveButtonSharedProps}
          />
        )}

        {step === "summary" && (
          <StepSummary
            spaces={spaces} unit={unit} wall={wall} circ={circ}
            costPerSqft={costPerSqft} rateStatus={rateStatus}
            locationLabel={locationLabel} projectName={projectName} clientName={clientName}
            floorGroups={floorGroups} totals={totals}
            onCsvImport={handleCsvImport}
            onBack={() => goBack("summary")} onEdit={() => setStep("spaces")}
            customRate={customRate}
            {...saveButtonSharedProps}
          />
        )}
      </main>

      <StickyBar gross={totals.gross} cost={totals.cost} unit={unit} loading={loadingRate && customRate === null} />

      {/* ── App-level modals ── */}
      {generalModalOpen && (
        <SaveAsGeneralModal
          spaces={spaces} spaceTemplates={spaceTemplates}
          onClose={() => setGeneralModalOpen(false)}
          onSaved={handleGeneralTemplateSaved} />
      )}
    </div>
  );
}