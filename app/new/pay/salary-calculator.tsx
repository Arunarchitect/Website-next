// "use client";

// // salary-calculator.tsx
// // Hourly + % of Fee salary calculator panel.
// // Receives all filter state and setters from the parent salary.tsx.

// import { useState } from "react";
// import {
//   worklogEntries, organisations, projects, members,
//   projMap, orgMap,
//   memberRates, projectFees, stageFees, fundAllocations, minutesPerMember,
//   type WorklogEntry, type MemberRate, type StageFee, type FundAllocation,
// } from "./data";
// import {
//   T, AVATAR_GRADIENTS,
//   fmtINR, fmtHours, selStyle,
//   Divider, FieldLabel, Avatar, Bar, EditableNum, ModeTab,
//   type HourlyResult, type FeeResult,
// } from "./salary-shared";

// // ─── Hourly Result Card ───────────────────────────────────────────────────────

// function HourlyResultCard({ result, onRateChange }: {
//   result: HourlyResult;
//   onRateChange: (memberId: string, rate: number) => void;
// }) {
//   const maxPay = Math.max(...result.projectBreakdown.map(p => p.pay), 1);
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

//       {/* Identity strip */}
//       <div style={{ display: "flex", alignItems: "center", gap: 14,
//         background: T.greenBg, border: `1px solid ${T.green}33`,
//         borderRadius: 14, padding: "16px 18px" }}>
//         <Avatar name={result.memberName} size={48} idx={result.memberIdx} />
//         <div style={{ flex: 1, minWidth: 0 }}>
//           <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>{result.memberName}</div>
//           <div style={{ fontSize: 12, color: T.t5, marginTop: 2 }}>{result.memberRole} · {result.orgName}</div>
//           <div style={{ fontSize: 11, color: T.t6, marginTop: 3 }}>
//             {result.dateFrom && result.dateTo
//               ? `${result.dateFrom} → ${result.dateTo}`
//               : result.dateFrom ? `From ${result.dateFrom}`
//               : result.dateTo   ? `Until ${result.dateTo}`
//               : "All time"}
//           </div>
//         </div>
//         <div style={{ textAlign: "right", flexShrink: 0 }}>
//           <div style={{ fontSize: 11, color: T.green, fontWeight: 600,
//             letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Total Salary</div>
//           <div style={{ fontSize: 32, fontWeight: 700, color: T.green,
//             fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{fmtINR(result.totalPay)}</div>
//           <div style={{ fontSize: 11.5, color: T.t5, marginTop: 4 }}>{fmtHours(result.totalMins)}</div>
//         </div>
//       </div>

//       {/* Stats */}
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
//         {[
//           { label: "Hours logged", val: fmtHours(result.totalMins), color: T.acText },
//           { label: "Sessions",     val: String(result.sessionCount), color: T.teal   },
//           { label: "Hourly rate",  val: fmtINR(result.hourlyRate),  color: T.amber  },
//         ].map(({ label, val, color }) => (
//           <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
//             borderRadius: 10, padding: "11px 13px" }}>
//             <div style={{ fontSize: 9.5, color, fontWeight: 600,
//               letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
//             <div style={{ fontSize: 17, fontWeight: 700, color: T.t1,
//               fontFamily: "'Sora',sans-serif", marginTop: 4 }}>{val}</div>
//           </div>
//         ))}
//       </div>

//       {/* Rate editor */}
//       <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
//         borderRadius: 12, padding: "13px 16px",
//         display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//         <div>
//           <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
//             letterSpacing: "0.07em", textTransform: "uppercase" }}>Hourly Rate</div>
//           <div style={{ fontSize: 11, color: T.t6, marginTop: 2 }}>Click the value to edit</div>
//         </div>
//         <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
//           <span style={{ fontSize: 13, color: T.t4 }}>₹</span>
//           <EditableNum value={result.hourlyRate}
//             onChange={v => onRateChange(result.memberId, v)} min={0} />
//           <span style={{ fontSize: 12, color: T.t5 }}>/ hr</span>
//         </div>
//       </div>

//       {/* Per-project breakdown */}
//       {result.projectBreakdown.length > 0 && (
//         <div>
//           <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//             letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>By Project</div>
//           <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
//             {result.projectBreakdown.map(p => (
//               <div key={p.projectId}>
//                 <div style={{ display: "flex", justifyContent: "space-between",
//                   alignItems: "center", marginBottom: 5 }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                     <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
//                       background: p.color, display: "inline-block" }} />
//                     <span style={{ fontSize: 12.5, color: T.t2 }}>{p.name}</span>
//                     <span style={{ fontSize: 11, color: T.t5 }}>{fmtHours(p.mins)}</span>
//                   </div>
//                   <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{fmtINR(p.pay)}</span>
//                 </div>
//                 <Bar pct={(p.pay / maxPay) * 100} color={p.color} />
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {result.totalMins === 0 && (
//         <div style={{ fontSize: 12.5, color: T.amber, background: T.amberBg,
//           border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 14px" }}>
//           ⚠ No work sessions found for this member in the selected period / project.
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Fee Result Card ──────────────────────────────────────────────────────────

// function FeeResultCard({ result, onAllocChange }: {
//   result: FeeResult;
//   onAllocChange: (id: string, pct: number) => void;
// }) {
//   const [showOthers, setShowOthers] = useState(false);
//   const totalPct  = result.allAllocs.reduce((s, a) => s + a.percentage, 0);
//   const pctWarn   = Math.abs(totalPct - 100) > 0.01;
//   const memberPct = result.memberAlloc?.percentage ?? 0;
//   const nonMemberAllocs = result.allAllocs.filter(a => a.memberId !== result.memberId);

//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

//       {/* Identity strip */}
//       <div style={{ display: "flex", alignItems: "center", gap: 14,
//         background: T.greenBg, border: `1px solid ${T.green}33`,
//         borderRadius: 14, padding: "16px 18px" }}>
//         <Avatar name={result.memberName} size={48} idx={result.memberIdx} />
//         <div style={{ flex: 1, minWidth: 0 }}>
//           <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>{result.memberName}</div>
//           <div style={{ fontSize: 12, color: T.t5, marginTop: 2 }}>{result.memberRole} · {result.orgName}</div>
//           <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
//             <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
//               background: result.projectColor, display: "inline-block" }} />
//             <span style={{ fontSize: 11.5, color: T.t4 }}>{result.projectName}</span>
//             <span style={{ fontSize: 11, color: T.t6 }}>· {result.stageLabel}</span>
//           </div>
//         </div>
//         <div style={{ textAlign: "right", flexShrink: 0 }}>
//           <div style={{ fontSize: 11, color: T.green, fontWeight: 600,
//             letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Member Share</div>
//           <div style={{ fontSize: 32, fontWeight: 700, color: T.green,
//             fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>
//             {result.memberAlloc ? fmtINR(result.memberPay) : "—"}
//           </div>
//           {result.memberAlloc && (
//             <div style={{ fontSize: 11.5, color: T.t5, marginTop: 4 }}>
//               {memberPct}% of {fmtINR(result.baseAmount)}
//             </div>
//           )}
//         </div>
//       </div>

//       {!result.memberAlloc && (
//         <div style={{ fontSize: 12.5, color: T.amber, background: T.amberBg,
//           border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 14px" }}>
//           ⚠ No fee allocation found for {result.memberName} in this project.
//         </div>
//       )}
//       {pctWarn && (
//         <div style={{ fontSize: 12, color: T.amber, background: T.amberBg,
//           border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 14px" }}>
//           ⚠ Total allocations sum to {totalPct.toFixed(1)}% — adjust to reach 100%.
//         </div>
//       )}

//       {/* Stats */}
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
//         {[
//           { label: "Base amount",    val: fmtINR(result.baseAmount),   color: T.acText },
//           { label: "Member share",   val: `${memberPct}%`,             color: T.green  },
//           { label: "Other expenses", val: fmtINR(result.otherAllocTotal + result.otherMemberTotal), color: T.teal },
//         ].map(({ label, val, color }) => (
//           <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
//             borderRadius: 10, padding: "11px 13px" }}>
//             <div style={{ fontSize: 9.5, color, fontWeight: 600,
//               letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
//             <div style={{ fontSize: 17, fontWeight: 700, color: T.t1,
//               fontFamily: "'Sora',sans-serif", marginTop: 4 }}>{val}</div>
//           </div>
//         ))}
//       </div>

//       {/* Allocation editor */}
//       {result.memberAlloc && (
//         <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
//           borderRadius: 12, padding: "13px 16px",
//           display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//           <div>
//             <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
//               letterSpacing: "0.07em", textTransform: "uppercase" }}>Allocation Percentage</div>
//             <div style={{ fontSize: 11, color: T.t6, marginTop: 2 }}>Click the value to edit</div>
//           </div>
//           <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
//             <EditableNum value={memberPct}
//               onChange={v => result.memberAlloc && onAllocChange(result.memberAlloc.id, Math.min(100, v))}
//               min={0} max={100} />
//             <span style={{ fontSize: 12, color: T.t5 }}>%</span>
//           </div>
//         </div>
//       )}

//       {/* Distribution bar */}
//       <div>
//         <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//           letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
//           Fee Distribution
//         </div>
//         <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", gap: 1 }}>
//           {result.allAllocs.map(a => {
//             const isMe = a.memberId === result.memberId;
//             return (
//               <div key={a.id} title={`${a.label}: ${a.percentage}%`}
//                 style={{ flex: a.percentage, minWidth: a.percentage > 0 ? 2 : 0,
//                   background: isMe ? T.green : (a.color ?? "#475569"),
//                   transition: "flex 0.4s",
//                   outline: isMe ? `2px solid ${T.green}` : "none",
//                   outlineOffset: isMe ? 1 : 0 }} />
//             );
//           })}
//         </div>
//         <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
//           {result.allAllocs.map(a => {
//             const isMe = a.memberId === result.memberId;
//             return (
//               <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
//                 <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
//                   background: isMe ? T.green : (a.color ?? T.t5), display: "inline-block" }} />
//                 <span style={{ color: isMe ? T.t2 : T.t5, fontWeight: isMe ? 600 : 400 }}>{a.label}</span>
//                 <span style={{ color: isMe ? T.green : T.t6, fontWeight: isMe ? 700 : 400 }}>{a.percentage}%</span>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Collapsible other allocations */}
//       <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
//         borderRadius: 12, overflow: "hidden" }}>
//         <button onClick={() => setShowOthers(p => !p)} style={{
//           width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
//           padding: "12px 16px", background: "none", border: "none",
//           cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
//           <span style={{ fontSize: 12.5, fontWeight: 600, color: T.t3 }}>
//             Other Expenses &amp; Allocations
//           </span>
//           <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//             <span style={{ fontSize: 12, color: T.t5 }}>
//               {fmtINR(result.otherAllocTotal + result.otherMemberTotal)} total
//             </span>
//             <svg width={12} height={12} viewBox="0 0 12 12" fill="none"
//               style={{ transform: showOthers ? "rotate(180deg)" : "none", transition: "0.15s" }}>
//               <path d="M2 4l4 4 4-4" stroke={T.t5} strokeWidth={1.5} strokeLinecap="round"/>
//             </svg>
//           </div>
//         </button>
//         {showOthers && (
//           <div style={{ borderTop: `1px solid ${T.divider}`, padding: "12px 16px",
//             display: "flex", flexDirection: "column", gap: 8 }}>
//             {nonMemberAllocs.map(a => {
//               const amt = (result.baseAmount * a.percentage) / 100;
//               return (
//                 <div key={a.id} style={{ display: "flex", alignItems: "center",
//                   justifyContent: "space-between", gap: 10 }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                     <span style={{ width: 8, height: 8, borderRadius: "50%",
//                       background: a.color ?? T.t5, flexShrink: 0, display: "inline-block" }} />
//                     <span style={{ fontSize: 12.5, color: T.t3 }}>{a.label}</span>
//                     <span style={{ fontSize: 11, color: T.t6 }}>{a.percentage}%</span>
//                   </div>
//                   <span style={{ fontSize: 13, fontWeight: 600, color: T.t4 }}>{fmtINR(amt)}</span>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─── SalaryCalculator — the full right panel ──────────────────────────────────

// export interface SalaryCalculatorProps {
//   // date/calendar filters (already applied upstream)
//   calFilteredEntries: WorklogEntry[];
//   dateFrom: string;
//   dateTo:   string;
//   // editable data copies
//   rates:  MemberRate[];
//   fees:   ReturnType<typeof projectFees.map>;
//   stages: StageFee[];
//   allocs: FundAllocation[];
//   onRateChange:   (memberId: string, rate: number) => void;
//   onAllocChange:  (id: string, pct: number) => void;
//   // fired when analysis succeeds — passes active filter values up to the parent
//   onAnalysisRun:  (filters: { memberId: string; orgId: string; projId: string }) => void;
// }

// export default function SalaryCalculator({
//   calFilteredEntries, dateFrom, dateTo,
//   rates, fees, stages, allocs,
//   onRateChange, onAllocChange, onAnalysisRun,
// }: SalaryCalculatorProps) {

//   const [mode,        setMode]        = useState<"hourly" | "fee">("hourly");
//   const [selOrgId,    setSelOrgId]    = useState("");
//   const [selMemberId, setSelMemberId] = useState("");
//   const [selProjId,   setSelProjId]   = useState("");
//   const [selStage,    setSelStage]    = useState<"all" | string>("all");

//   const [hourlyResult,  setHourlyResult]  = useState<HourlyResult | null>(null);
//   const [feeResult,     setFeeResult]     = useState<FeeResult    | null>(null);
//   const [analysisError, setAnalysisError] = useState("");

//   // Derived option lists
//   const projOptions  = selOrgId ? projects.filter(p => p.organisationId === selOrgId) : projects;
//   const memOptions   = selOrgId
//     ? members.filter(m => worklogEntries.some(e => e.memberId === m.id && e.organisationId === selOrgId))
//     : members;
//   const projStages   = stages.filter(s => s.projectId === selProjId).sort((a, b) => +a.stage - +b.stage);

//   function resetResult() { setHourlyResult(null); setFeeResult(null); setAnalysisError(""); }
//   function switchMode(m: "hourly" | "fee") { setMode(m); resetResult(); }

//   const canRun = !!selMemberId && (mode === "hourly" || !!selProjId);

//   function runAnalysis() {
//     resetResult();
//     if (!selMemberId) { setAnalysisError("Please select a member."); return; }
//     const member    = members.find(m => m.id === selMemberId);
//     const memberIdx = members.findIndex(m => m.id === selMemberId);
//     if (!member) { setAnalysisError("Member not found."); return; }
//     const orgName = selOrgId ? (orgMap[selOrgId]?.name ?? "All Orgs") : "All Orgs";

//     if (mode === "hourly") {
//       const entries = calFilteredEntries.filter(e =>
//         e.memberId === selMemberId
//         && (!selOrgId  || e.organisationId === selOrgId)
//         && (!selProjId || e.projectId      === selProjId)
//       );
//       const rateObj    = rates.find(r => r.memberId === selMemberId);
//       const hourlyRate = rateObj?.hourlyRate ?? 0;
//       const minsMap    = minutesPerMember(entries);
//       const totalMins  = minsMap[selMemberId] ?? 0;
//       const totalPay   = Math.round((totalMins / 60) * hourlyRate);

//       const projBreakdown = Object.entries(
//         entries.reduce((acc, e) => {
//           const [sh, sm] = e.startTime.split(":").map(Number);
//           const [eh, em] = e.endTime.split(":").map(Number);
//           acc[e.projectId] = (acc[e.projectId] ?? 0) + (eh * 60 + em - (sh * 60 + sm));
//           return acc;
//         }, {} as Record<string, number>)
//       ).map(([pid, mins]) => {
//         const proj = projMap[pid];
//         return { projectId: pid, name: proj?.name ?? pid, color: proj?.color ?? T.t6,
//           mins, pay: Math.round((mins / 60) * hourlyRate) };
//       }).sort((a, b) => b.pay - a.pay);

//       setHourlyResult({
//         memberId: selMemberId, memberName: member.name, memberRole: member.role,
//         memberIdx, hourlyRate, totalMins, totalPay, orgName,
//         projectBreakdown: projBreakdown, sessionCount: entries.length, dateFrom, dateTo,
//       });
//       onAnalysisRun({ memberId: selMemberId, orgId: selOrgId, projId: selProjId });

//     } else {
//       if (!selProjId) { setAnalysisError("Please select a project for % of Fee analysis."); return; }
//       const proj       = projMap[selProjId];
//       const projFeeAmt = fees.find((f: any) => f.projectId === selProjId)?.totalFee ?? 0;
//       const baseAmount = selStage === "all"
//         ? projFeeAmt
//         : (stages.find(s => s.projectId === selProjId && s.stage === selStage)?.fee ?? 0);
//       const stageLabel = selStage === "all"
//         ? "All Stages"
//         : `Stage ${selStage} — ${stages.find(s => s.projectId === selProjId && s.stage === selStage)?.label ?? ""}`;

//       const projAllocs     = allocs.filter(a => a.projectId === selProjId);
//       const memberAlloc    = projAllocs.find(a => a.memberId === selMemberId) ?? null;
//       const memberPay      = memberAlloc ? Math.round(baseAmount * memberAlloc.percentage / 100) : 0;
//       const otherAllocTotal  = projAllocs.filter(a => !a.memberId)
//         .reduce((s, a) => s + Math.round(baseAmount * a.percentage / 100), 0);
//       const otherMemberTotal = projAllocs.filter(a => a.memberId && a.memberId !== selMemberId)
//         .reduce((s, a) => s + Math.round(baseAmount * a.percentage / 100), 0);

//       setFeeResult({
//         memberId: selMemberId, memberName: member.name, memberRole: member.role,
//         memberIdx, orgName,
//         projectName: proj?.name ?? selProjId, projectColor: proj?.color ?? T.ac,
//         stageLabel, baseAmount, memberAlloc, memberPay,
//         otherAllocTotal, otherMemberTotal, allAllocs: projAllocs,
//       });
//       onAnalysisRun({ memberId: selMemberId, orgId: selOrgId, projId: selProjId });
//     }
//   }

//   // Live rate sync
//   function handleRateChange(memberId: string, rate: number) {
//     onRateChange(memberId, rate);
//     if (hourlyResult && hourlyResult.memberId === memberId) {
//       setHourlyResult(prev => {
//         if (!prev) return prev;
//         return {
//           ...prev, hourlyRate: rate,
//           totalPay: Math.round((prev.totalMins / 60) * rate),
//           projectBreakdown: prev.projectBreakdown.map(p => ({
//             ...p, pay: Math.round((p.mins / 60) * rate),
//           })),
//         };
//       });
//     }
//   }
//   function handleAllocChange(id: string, pct: number) {
//     onAllocChange(id, pct);
//     if (feeResult) {
//       setFeeResult(prev => {
//         if (!prev) return prev;
//         const updated = prev.allAllocs.map(a => a.id === id ? { ...a, percentage: pct } : a);
//         const mAlloc  = updated.find(a => a.memberId === prev.memberId) ?? null;
//         return {
//           ...prev,
//           memberAlloc:      mAlloc,
//           memberPay:        mAlloc ? Math.round(prev.baseAmount * mAlloc.percentage / 100) : 0,
//           otherAllocTotal:  updated.filter(a => !a.memberId).reduce((s, a) => s + Math.round(prev.baseAmount * a.percentage / 100), 0),
//           otherMemberTotal: updated.filter(a => a.memberId && a.memberId !== prev.memberId).reduce((s, a) => s + Math.round(prev.baseAmount * a.percentage / 100), 0),
//           allAllocs: updated,
//         };
//       });
//     }
//   }

//   return (
//     <div style={{ background: T.panel, border: `1px solid ${T.panelB}`,
//       borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

//       {/* Mode tabs */}
//       <div style={{ display: "flex", background: T.panel2,
//         border: `1px solid ${T.panel2B}`, borderRadius: 12, padding: 4, gap: 2 }}>
//         <ModeTab active={mode === "hourly"} onClick={() => switchMode("hourly")} icon="⏱" label="Hourly" />
//         <ModeTab active={mode === "fee"}    onClick={() => switchMode("fee")}    icon="%" label="% of Fee" />
//       </div>

//       {/* Filter fields */}
//       <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
//           <div>
//             <FieldLabel>Organisation</FieldLabel>
//             <select value={selOrgId}
//               onChange={e => { setSelOrgId(e.target.value); setSelProjId(""); setSelMemberId(""); resetResult(); }}
//               style={selStyle()}>
//               <option value="">All Organisations</option>
//               {organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
//             </select>
//           </div>
//           <div>
//             <FieldLabel required>Member</FieldLabel>
//             <select value={selMemberId} onChange={e => { setSelMemberId(e.target.value); resetResult(); }}
//               style={selStyle()}>
//               <option value="">Select member</option>
//               {memOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
//             </select>
//           </div>
//         </div>

//         <div style={{ display: "grid",
//           gridTemplateColumns: (mode === "fee" && selProjId) ? "1fr 1fr" : "1fr", gap: 12 }}>
//           <div>
//             <FieldLabel required={mode === "fee"}>Project</FieldLabel>
//             <select value={selProjId}
//               onChange={e => { setSelProjId(e.target.value); setSelStage("all"); resetResult(); }}
//               style={selStyle()}>
//               <option value="">{mode === "fee" ? "Select project" : "All Projects"}</option>
//               {projOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
//             </select>
//           </div>
//           {mode === "fee" && selProjId && (
//             <div>
//               <FieldLabel>Stage scope</FieldLabel>
//               <select value={selStage} onChange={e => { setSelStage(e.target.value); resetResult(); }}
//                 style={selStyle()}>
//                 <option value="all">All Stages (total fee)</option>
//                 {projStages.map(sf => (
//                   <option key={sf.stage} value={sf.stage}>Stage {sf.stage} — {sf.label}</option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         <div style={{ fontSize: 11.5, color: T.t5, lineHeight: 1.6,
//           background: T.panel2, borderRadius: 8, padding: "10px 13px" }}>
//           {mode === "hourly"
//             ? "Calculates salary from hours logged × hourly rate. Optionally filter by org and project."
//             : "Calculates salary as a % of project (or stage) fee. Project selection is required."}
//         </div>
//       </div>

//       {/* Action buttons */}
//       <div style={{ display: "flex", gap: 10 }}>
//         <button onClick={runAnalysis} disabled={!canRun} style={{
//           flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
//           background: canRun ? T.ac : T.panel2B, color: canRun ? "#fff" : T.t6,
//           fontSize: 14, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed",
//           fontFamily: "'DM Sans',sans-serif", transition: "background 0.2s",
//           display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
//         }}
//           onMouseEnter={e => { if (canRun) (e.currentTarget as HTMLElement).style.background = "#4f46e5"; }}
//           onMouseLeave={e => { if (canRun) (e.currentTarget as HTMLElement).style.background = T.ac; }}
//         >
//           <svg width={15} height={15} viewBox="0 0 16 16" fill="none">
//             <path d="M3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8Z" stroke="currentColor" strokeWidth={1.4}/>
//             <path d="M6.5 6.5l3 1.5-3 1.5V6.5Z" fill="currentColor"/>
//           </svg>
//           Run Analysis
//         </button>
//         {(hourlyResult || feeResult || analysisError) && (
//           <button onClick={resetResult} style={{
//             padding: "12px 18px", borderRadius: 10, border: `1px solid ${T.panel2B}`,
//             background: "transparent", color: T.t4, fontSize: 13,
//             cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
//           }}
//             onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
//             onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
//           >Clear Result</button>
//         )}
//       </div>

//       {/* Error */}
//       {analysisError && (
//         <div style={{ fontSize: 13, color: T.red, background: T.redBg,
//           border: `1px solid ${T.red}33`, borderRadius: 10, padding: "11px 14px" }}>
//           {analysisError}
//         </div>
//       )}

//       {/* Empty state */}
//       {!hourlyResult && !feeResult && !analysisError && (
//         <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
//           justifyContent: "center", minHeight: 220, gap: 12,
//           border: `1px dashed ${T.divider}`, borderRadius: 14, color: T.t6 }}>
//           <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1}>
//             <circle cx={11} cy={11} r={7}/>
//             <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
//             <path d="M11 8v6M8 11h6" strokeLinecap="round"/>
//           </svg>
//           <div style={{ textAlign: "center" }}>
//             <div style={{ fontSize: 13.5, marginBottom: 4 }}>No analysis run yet</div>
//             <div style={{ fontSize: 12, color: T.t6 }}>
//               Select a member{mode === "fee" ? " and project" : ""}, then hit Run Analysis
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Results */}
//       {hourlyResult && (
//         <>
//           <Divider />
//           <HourlyResultCard result={hourlyResult} onRateChange={handleRateChange} />
//         </>
//       )}
//       {feeResult && (
//         <>
//           <Divider />
//           <FeeResultCard result={feeResult} onAllocChange={handleAllocChange} />
//         </>
//       )}
//     </div>
//   );
// }