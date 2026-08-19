import { describe, expect, it } from 'vitest';
import { localAgentSourcePayload } from './starlink-source';

describe('local agent source payload', () => {
  it('builds the payload used to link and unlink an agent', () => {
    expect(localAgentSourcePayload(true, '2.1.0')).toEqual({ sourceKind: 'local_agent', enabled: true, metadata: { version: '2.1.0' } });
    expect(localAgentSourcePayload(false)).toEqual({ sourceKind: 'local_agent', enabled: false, metadata: { version: '1.0.0' } });
  });
});
