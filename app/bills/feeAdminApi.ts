// app/bills/feeAdminApi.ts — fee setup & project fee calculations
import { call, list, type Instalment } from "./billsApi";

const F = "/api/feecalc";
export type BillingType = "quantity_rate" | "percentage" | "hourly";

export interface QUnit { id: number; name: string; symbol: string; organisation: number }
export interface FeeStage { id: number; name: string; order: number; organisation: number; is_active: boolean }
export interface DelivTpl { id: number; name: string; order: number; is_mandatory: boolean }
export interface TplStage {
  id: number; fee_stage: FeeStage; fee_percentage: string; order: number;
  payment_terms_days: number; deliverable_templates: DelivTpl[];
}
export interface FeeTpl {
  id: number; organisation: number; name: string; billing_type: BillingType;
  quantity_unit: QUnit | null; default_rate_per_unit: string | null;
  default_percentage: string | null; default_hourly_rate: string | null;
  currency: string; is_active: boolean;
  template_stages: TplStage[]; total_stage_percentage: string;
}
export interface Calc {
  id: number; project: number; fee_template: number; quantity: string; discount_percentage: string;
  currency: string; base_fee: string; discount_amount: string; final_fee: string;
  quantity_unit_snapshot: string; status: string; instalments: Instalment[];
}

const j = (b: unknown) => JSON.stringify(b);
const post = <T,>(path: string, b: unknown) => call<T>(`${F}${path}`, { method: "POST", body: j(b) });
const patch = <T,>(path: string, b: unknown) => call<T>(`${F}${path}`, { method: "PATCH", body: j(b) });
const del = (path: string) => call<void>(`${F}${path}`, { method: "DELETE" });

// templates
export const fetchFeeTemplates = (org: number) =>
  call<FeeTpl[] | { results: FeeTpl[] }>(`${F}/fee-templates/?organisation=${org}`).then(list);
export const createFeeTemplate = (b: object) => post<{ id: number }>("/fee-templates/", b);
export const updateFeeTemplate = (id: number, b: object) => patch<{ id: number }>(`/fee-templates/${id}/`, b);

// units & stage library
export const fetchUnits = (org: number) =>
  call<QUnit[] | { results: QUnit[] }>(`${F}/quantity-units/`).then(list).then((l) => l.filter((u) => u.organisation === org));
export const createUnit = (b: { organisation: number; name: string; symbol: string }) => post<QUnit>("/quantity-units/", b);
export const fetchStages = (org: number) =>
  call<FeeStage[] | { results: FeeStage[] }>(`${F}/fee-stages/?organisation=${org}`).then(list);
export const createStage = (b: { organisation: number; name: string; order: number }) => post<FeeStage>("/fee-stages/", b);

// template stages & deliverables
export const createTplStage = (b: object) => post<{ id: number }>("/fee-template-stages/", b);
export const updateTplStage = (id: number, b: object) => patch<{ id: number }>(`/fee-template-stages/${id}/`, b);
export const deleteTplStage = (id: number) => del(`/fee-template-stages/${id}/`);
export const createDeliv = (b: { fee_template_stage: number; name: string; order: number }) => post<{ id: number }>("/deliverable-templates/", b);
export const deleteDeliv = (id: number) => del(`/deliverable-templates/${id}/`);

// project fee calculation
export interface CalcBody { fee_template: number; quantity: string; discount_percentage: string; currency: string }
export const fetchCalcs = (project: number) =>
  call<Calc[] | { results: Calc[] }>(`${F}/project-calculations/?project=${project}`).then(list);
export const createCalc = (b: CalcBody & { project: number }) => post<{ id: number }>("/project-calculations/", b);
export const updateCalc = (id: number, b: CalcBody) => patch<{ id: number }>(`/project-calculations/${id}/`, b);
export const confirmCalc = (id: number) => post<unknown>(`/project-calculations/${id}/confirm/`, {});
