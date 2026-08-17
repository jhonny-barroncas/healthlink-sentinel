export type ZabbixItem = {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: string;
  units?: string;
  status?: string;
  state?: string;
};

export type LinkMetric = 'network.latency.ms' | 'network.loss.pct' | 'network.in.bps' | 'network.out.bps';

export type LinkMetricCandidate = {
  item: ZabbixItem;
  metric: { key: LinkMetric; value: number };
};

export function classifyLinkMetric(item: ZabbixItem): LinkMetricCandidate['metric'] | null {
  if (item.status === '1' || item.state === '1') return null;
  const raw = Number(item.lastvalue);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const key = item.key_.toLowerCase();
  if (key.includes('icmppingsec')) return { key: 'network.latency.ms', value: raw * 1000 };
  if (key.includes('icmppingloss')) return { key: 'network.loss.pct', value: raw };
  if (/discard|error|drop/.test(key) || /discard|error|drop/.test(item.name.toLowerCase())) return null;
  const trafficValue = item.units === 'Bps' ? raw * 8 : raw;
  if (key.includes('net.if.in')) return { key: 'network.in.bps', value: trafficValue };
  if (key.includes('net.if.out')) return { key: 'network.out.bps', value: trafficValue };
  return null;
}

export function metricItemPriority(item: ZabbixItem): number {
  const label = `${item.name} ${item.key_}`.toLowerCase();
  let priority = 0;
  if (/bits (received|sent)|bytes (received|sent)|traffic|throughput/.test(label)) priority += 100;
  if (/\bwan1\b/.test(label)) priority += 80;
  else if (/\bwan\d+\b/.test(label)) priority += 60;
  if (/\binternet\b|\buplink\b/.test(label)) priority += 50;
  if (/starlink/.test(label)) priority += 45;
  if (/\blink[-_ (]/.test(label)) priority += 30;
  if (/\bether1\b|pppoe|lte|cellular/.test(label)) priority += 20;
  if (/loopback|ssl\.root|l2t\.root|naf\.root|\bipsec\b|\bvpn\b/.test(label)) priority -= 60;
  if (/\binternal\d*\b|\bdmz\b/.test(label)) priority -= 30;
  return priority;
}

export function selectLinkMetricCandidates(items: ZabbixItem[]): Map<string, LinkMetricCandidate> {
  const candidates = new Map<string, LinkMetricCandidate>();
  for (const item of items) {
    const metric = classifyLinkMetric(item);
    if (!metric) continue;
    const candidateKey = `${item.hostid}:${metric.key}`;
    const current = candidates.get(candidateKey);
    const priority = metricItemPriority(item);
    const currentPriority = current ? metricItemPriority(current.item) : Number.NEGATIVE_INFINITY;
    if (!current || priority > currentPriority || (priority === currentPriority && Number(item.lastclock) > Number(current.item.lastclock))) {
      candidates.set(candidateKey, { item, metric });
    }
  }
  return candidates;
}
