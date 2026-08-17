import { describe, expect, it } from 'vitest';
import { classifyLinkMetric, selectLinkMetricCandidates, type ZabbixItem } from './telemetry.js';

function item(overrides: Partial<ZabbixItem>): ZabbixItem {
  return {
    itemid: '1', hostid: '10680', name: '', key_: '', lastvalue: '0', lastclock: '100', units: 'bps', status: '0', state: '0',
    ...overrides,
  };
}

describe('Zabbix link telemetry selection', () => {
  it('prioritizes FortiGate wan1 over inactive interfaces with the same timestamp', () => {
    const candidates = selectLinkMetricCandidates([
      item({ itemid: 'inactive-in', name: 'Interface a(): Bits received', key_: 'net.if.in[ifHCInOctets.9]', lastvalue: '0' }),
      item({ itemid: 'inactive-out', name: 'Interface a(): Bits sent', key_: 'net.if.out[ifHCOutOctets.9]', lastvalue: '0' }),
      item({ itemid: 'wan-in', name: 'Interface wan1(LINK-ICOM-100Mb): Bits received', key_: 'net.if.in[ifHCInOctets.1]', lastvalue: '12822960' }),
      item({ itemid: 'wan-out', name: 'Interface wan1(LINK-ICOM-100Mb): Bits sent', key_: 'net.if.out[ifHCOutOctets.1]', lastvalue: '912904' }),
    ]);

    expect(candidates.get('10680:network.in.bps')?.item.itemid).toBe('wan-in');
    expect(candidates.get('10680:network.in.bps')?.metric.value).toBe(12822960);
    expect(candidates.get('10680:network.out.bps')?.item.itemid).toBe('wan-out');
    expect(candidates.get('10680:network.out.bps')?.metric.value).toBe(912904);
  });

  it('rejects error/discard counters and converts bytes per second to bits per second', () => {
    expect(classifyLinkMetric(item({ name: 'Interface wan1: Inbound errors', key_: 'net.if.in.errors[wan1]', lastvalue: '4' }))).toBeNull();
    expect(classifyLinkMetric(item({ name: 'Interface wan1: Bytes received', key_: 'net.if.in[wan1]', lastvalue: '125', units: 'Bps' }))).toEqual({ key: 'network.in.bps', value: 1000 });
  });
});
