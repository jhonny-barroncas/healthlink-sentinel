import { timingSafeEqual } from 'node:crypto';
import { hashAgentSecret } from './provisioning.js';

export type EnrollmentRecord = {
  tokenHash: string;
  expiresAt: string | Date;
  consumedAt: string | Date | null;
  revokedAt: string | Date | null;
};

export type EnrollmentValidation = { valid: true } | { valid: false; reason: 'invalid' | 'expired' | 'consumed' | 'revoked' };

export function validateEnrollment(record: EnrollmentRecord, secret: string, now = new Date()): EnrollmentValidation {
  if (record.revokedAt) return { valid: false, reason: 'revoked' };
  if (record.consumedAt) return { valid: false, reason: 'consumed' };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) return { valid: false, reason: 'expired' };
  const expected = Buffer.from(record.tokenHash, 'hex');
  const received = Buffer.from(hashAgentSecret(secret), 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { valid: false, reason: 'invalid' };
  return { valid: true };
}

export type AgentRuntimeRecord = { status: 'pending' | 'active' | 'revoked'; lastHeartbeatAt: string | Date | null };
export type AgentRuntimeState = 'unlinked' | 'pending' | 'online' | 'offline';

export function agentRuntimeStatus(record: AgentRuntimeRecord | null, now = new Date()): AgentRuntimeState {
  if (!record) return 'unlinked';
  if (record.status === 'pending') return 'pending';
  if (record.status !== 'active' || !record.lastHeartbeatAt) return 'offline';
  return now.getTime() - new Date(record.lastHeartbeatAt).getTime() <= 30_000 ? 'online' : 'offline';
}

