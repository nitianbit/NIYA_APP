import type { Member } from './api';
export type ClaimState = 'draft' | 'queued' | 'accepted' | 'confirmation_pending' | 'blocked';
export const claimStates: Record<ClaimState, string> = {
  draft: 'Draft', queued: 'Waiting to send', accepted: 'Test received',
  confirmation_pending: 'Receipt needs confirmation', blocked: 'Sending stopped',
};
export type ClaimSummary = {
  id: string; memberName: string; relation: string; policyId: string; policyName: string;
  memberId: string; treatmentDate: number; hospitalName: string; state: ClaimState;
  version: number; providerReference: string | null; createdAt: string;
};
export type ClaimDetails = ClaimSummary & { details: {
  hospitalName: string; hospitalCity: string; admissionType: 'planned' | 'emergency'; reason: string;
}; };
export type ClaimHistory = { id: string; kind: string; version: number; createdAt: string };
export type ClaimOptions = { availability: { enabled: boolean }; policies: {
  id: string; name: string; members: Member[];
}[] };
export type ClaimList = { availability: { enabled: boolean }; cases: ClaimSummary[]; total: number };
export type ClaimDetailResponse = { claim: ClaimDetails; history: ClaimHistory[] };
