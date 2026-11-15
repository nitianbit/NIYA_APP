import type { Member } from './api';
export type ClaimState = 'draft' | 'queued' | 'accepted' | 'confirmation_pending' | 'blocked';
export const claimStates: Record<ClaimState, string> = {
  draft: 'Draft', queued: 'Waiting to send', accepted: 'Test received',
  confirmation_pending: 'Receipt needs confirmation', blocked: 'Sending stopped',
};
export type ClaimSummary = {
  id: string; memberName: string; relation: string; policyId: string; policyName: string;
  memberId: string; treatmentDate: number; hospitalName: string; state: ClaimState;
  mode?: 'fake' | 'demo' | 'mediassist_uat'; claimType?: 'intimation' | 'reimbursement'; insuranceStatus?: string | null; approvedAmount?: number | null; paidAmount?: number | null; lastSyncedAt?: string | null; isTest?: boolean; providerReady?: boolean; providerStatus?: string | null;
  version: number; providerReference: string | null; createdAt: string;
};
export type ClaimDetails = ClaimSummary & { reimbursement?: Reimbursement | null; documents?: ClaimDocument[]; details: {
  hospitalName: string; hospitalCity: string; admissionType: 'planned' | 'emergency'; reason: string; contactPhone?: string;
}; };
export type ClaimHistory = { id: string; kind: string; version: number; createdAt: string; payload?: Record<string, unknown> };
export type ClaimOptions = { availability: { enabled: boolean; mode?: string }; policies: {
  id: string; name: string; members: Member[];
}[] };
export type ClaimList = { availability: { enabled: boolean; mode?: string }; cases: ClaimSummary[]; total: number };
export type ClaimDetailResponse = { claim: ClaimDetails; history: ClaimHistory[] };

export type Reimbursement = { dischargeDate: number; hospitalAddress: string; diagnosis: string;
  claimedAmount: number; contactPhone: string; contactEmail: string };
export type ClaimDocument = { id: string; name: string; category: string; bytes: number; mime: string; checksum: string };
export const documentCategories = { claim_form: 'Signed claim form', discharge_summary: 'Discharge summary',
  hospital_bill: 'Hospital bill', receipt: 'Payment receipt', investigation: 'Investigation report', prescription: 'Prescription', other: 'Other document' };
export const providerStates: Record<string,string> = { settled: 'Settled (payment not confirmed)', cashless_denied: 'Cashless request denied', rejected: 'Rejected', provider_reported: 'Provider update', processing: 'Processing', documents_required: 'Documents requested', approved: 'Approved', paid: 'Paid' };

export const claimStateLabel = (row: ClaimSummary) => row.mode === 'mediassist_uat' && row.state === 'accepted' ? 'TPA received (UAT)' : claimStates[row.state];
export const providerLabel = (row: { mode?: string; insuranceStatus?: string | null; providerStatus?: string | null }) => (row.mode === 'mediassist_uat' ? 'Provider (UAT): ' : 'Simulated status: ') + (row.mode === 'mediassist_uat' && row.providerStatus ? row.providerStatus : providerStates[row.insuranceStatus ?? ''] ?? row.insuranceStatus ?? 'Not reported');
