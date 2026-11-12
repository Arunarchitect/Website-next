"use client";

import { useEffect, useState } from "react";
import { QuantityColumnConfig, QuantityConfig, QuantityRole } from "../types";

export const ROLE_LABELS: Record<QuantityRole, string> = {
  group: "Group by",
  sum: "Sum",
  avg: "Average",
  min: "Min",
  max: "Max",
  text: "Text",
};
export const NUMERIC_ROLES: QuantityRole[] = ["sum", "avg", "min", "max"];

export const STANDARD_UNITS = ["m", "m²", "m³", "mm", "cm", "ft", "ft²", "ft³", "nos", "set", "kg", "t", "L", "%"];

const CUSTOM_KEY = "est-custom-units";
const CUSTOM = "__custom";

const loadSaved = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const saveCustom = (unit: string): string[] => {
  const u = unit.trim();
  const cur = loadSaved();
  if (!u || STANDARD_UNITS.includes(u) || cur.includes(u)) return cur;
  const next = [...cur, u].slice(-30);
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
};

interface UnitPickerProps {
  value: string;
  disabled: boolean;
  saved: string[];
  onSaved: (list: string[]) => void;
  onChange: (v: string) => void;
}

function UnitPicker({ value, disabled, saved, onSaved, onChange }: UnitPickerProps) {
  const [customMode, setCustomMode] = useState(false);
  const known = value === "" || STANDARD_UNITS.includes(value) || saved.includes(value);
  const selectValue = customMode || !known ? CUSTOM : value;

  return (
    <div className="est-q-unit-wrap">
      <select
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">None</option>
        <optgroup label="Standard">
          {STANDARD_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </optgroup>
        {saved.length > 0 && (
          <optgroup label="Saved">
            {saved.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </optgroup>
        )}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {selectValue === CUSTOM && !disabled && (
        <input
          className="est-q-unit"
          value={value}
          maxLength={20}
          placeholder="e.g. rft"
          autoFocus={customMode}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const list = saveCustom(e.target.value);
            onSaved(list);
            if (list.includes(e.target.value.trim())) setCustomMode(false);
          }}
        />
      )}
    </div>
  );
}

interface Props {
  config: QuantityConfig;
  samples?: Record<string, string>;
  onChange: (c: QuantityConfig) => void;
}

export default function QuantityConfigEditor({ config, samples, onChange }: Props) {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => setSaved(loadSaved()), []);

  const patchCol = (key: string, p: Partial<QuantityColumnConfig>) => {
    const columns = config.columns.map((c) => (c.key === key ? { ...c, ...p } : c));
    const fc = columns.find((c) => c.key === config.final);
    const final = fc && fc.show && NUMERIC_ROLES.includes(fc.role) ? config.final : null;
    onChange({ ...config, columns, final });
  };

  return (
    <div className="est-q-cfg">
      <p className="est-hint">
        Choose what to show. <b>Group by</b> merges rows that share the same value, <b>Sum</b> adds them up.
        The <b>Final</b> column is shown bold and its total is highlighted. Pick a unit or choose Custom.
        Merged rows and wastage are set from the table&apos;s Adjust button.
      </p>

      <div className="est-table-scroll">
        <table className="est-q-cfg-table">
          <thead>
            <tr>
              <th>Show</th>
              <th>Column</th>
              <th>Role</th>
              <th>Label</th>
              <th>Unit</th>
              <th>Final</th>
            </tr>
          </thead>
          <tbody>
            {config.columns.map((c) => {
              const numeric = NUMERIC_ROLES.includes(c.role);
              return (
                <tr key={c.key} className={c.show ? "" : "est-q-off"}>
                  <td data-label="Show">
                    <input
                      type="checkbox"
                      checked={c.show}
                      onChange={(e) => patchCol(c.key, { show: e.target.checked })}
                      aria-label={`Show ${c.key}`}
                    />
                  </td>
                  <td data-label="Column">
                    <div>
                      <div className="est-q-colname">{c.key}</div>
                      {samples?.[c.key] && <small className="est-hint">{samples[c.key].slice(0, 28)}</small>}
                    </div>
                  </td>
                  <td data-label="Role">
                    <select
                      value={c.role}
                      disabled={!c.show}
                      onChange={(e) => patchCol(c.key, { role: e.target.value as QuantityRole })}
                    >
                      {(Object.keys(ROLE_LABELS) as QuantityRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Label">
                    <input
                      value={c.label}
                      disabled={!c.show}
                      onChange={(e) => patchCol(c.key, { label: e.target.value })}
                    />
                  </td>
                  <td data-label="Unit">
                    <UnitPicker
                      value={c.unit}
                      disabled={!c.show || !numeric}
                      saved={saved}
                      onSaved={setSaved}
                      onChange={(unit) => patchCol(c.key, { unit })}
                    />
                  </td>
                  <td data-label="Final">
                    <input
                      type="radio"
                      name="q-final"
                      disabled={!c.show || !numeric}
                      checked={config.final === c.key}
                      onChange={() => onChange({ ...config, final: c.key })}
                      aria-label={`Final column ${c.key}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="est-q-opts">
        <label>
          <input
            type="checkbox"
            checked={config.show_count}
            onChange={(e) => onChange({ ...config, show_count: e.target.checked })}
          />{" "}
          Show row count
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.show_details}
            onChange={(e) => onChange({ ...config, show_details: e.target.checked })}
          />{" "}
          Expandable detail rows
        </label>
        <label>
          Decimals{" "}
          <select
            value={config.decimals}
            onChange={(e) => onChange({ ...config, decimals: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {config.final && (
          <button type="button" className="est-btn est-btn-sm" onClick={() => onChange({ ...config, final: null })}>
            No final column
          </button>
        )}
      </div>
    </div>
  );
}