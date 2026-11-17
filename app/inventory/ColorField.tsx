"use client";

export interface ColorPreset {
  name: string;
  hex: string; // "#RRGGBB"
}

// Standard CSS / W3C named colors. Keep in sync with COLOR_NAMES in
// inventory/views.py (used by sheet import).
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { name: "Red", hex: "#FF0000" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Green", hex: "#008000" },
  { name: "Olive", hex: "#808000" },
  { name: "Teal", hex: "#008080" },
  { name: "Cyan", hex: "#00FFFF" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Navy", hex: "#000080" },
  { name: "Purple", hex: "#800080" },
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Maroon", hex: "#800000" },
  { name: "Brown", hex: "#A52A2A" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gray", hex: "#808080" },
  { name: "Black", hex: "#000000" },
];

/** Standard name for a hex value, or "" when it is a custom color. */
export const colorName = (hex: string) =>
  COLOR_PRESETS.find((c) => c.hex === hex.toUpperCase())?.name ?? "";

interface Props {
  value: string; // "#RRGGBB" or "" (not set)
  onChange: (v: string) => void;
  id?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Standard color swatches + custom picker + hex readout + clear.
 * Empty string = no color. */
export default function ColorField({ value, onChange, id }: Props) {
  const valid = HEX.test(value);
  const current = valid ? value.toUpperCase() : "";
  const name = colorName(current);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Standard colors">
        {COLOR_PRESETS.map((c) => {
          const on = current === c.hex;
          return (
            <button
              type="button"
              key={c.hex}
              title={c.name}
              aria-label={c.name}
              aria-pressed={on}
              onClick={() => onChange(c.hex)}
              style={{ backgroundColor: c.hex }}
              className={`h-6 w-6 rounded-full border focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                on ? "border-slate-900 ring-2 ring-slate-900 ring-offset-1" : "border-slate-300"
              }`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label="Custom color"
          title="Custom color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={`h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5 ${
            valid ? "" : "opacity-40"
          }`}
        />
        <span className="text-xs text-slate-600">
          {valid ? (
            <>
              {name && <span className="mr-1 font-medium text-slate-800">{name}</span>}
              <span className="font-mono">{current}</span>
            </>
          ) : (
            "Not set"
          )}
        </span>
        {valid && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-slate-600 underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}