export function localAgentSourcePayload(enabled: boolean, version = '1.0.0') {
  return { sourceKind: 'local_agent' as const, enabled, metadata: { version } };
}
