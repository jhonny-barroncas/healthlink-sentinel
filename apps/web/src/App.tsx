import { FormEvent, ReactNode, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import brazilMap from '@svg-maps/brazil';
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

type LoginResponse = { accessToken: string; user: { displayName: string; email: string }; tenant: { name: string } };
type Unit = { unit_id: string; code: string; name: string; state_code: string; city: string; latitude: number | string | null; longitude: number | string | null; operational_status: 'online' | 'degraded' | 'offline' | 'unknown'; offline_equipment: number; degraded_equipment: number };
type Alert = { id: string; title: string; severity: number; status: string; unit_id?: string | null; unit_code?: string; equipment_id?: string | null; equipment_name?: string; opened_at: string; resolved_at?: string | null };
type Equipment = { equipment_id: string; unit_id: string; equipment_type: string; name: string; serial_number?: string | null; management_address?: string | null; contracted_download_mbps?: number | null; contracted_upload_mbps?: number | null; operational_status: 'online' | 'degraded' | 'offline' | 'unknown'; observed_at?: string };
type LatencyPoint = { value: number; observed_at: string };
type LinkTelemetry = { unit_id: string; unit_code: string; unit_name: string; equipment_id: string; equipment_name: string; contracted_download_mbps: number | null; contracted_upload_mbps: number | null; operational_status: Unit['operational_status']; observed_at: string | null; metrics: Record<string, number>; latency_history: LatencyPoint[] };
type ZabbixHost = { hostid: string; host: string; name: string; status: string | number; interfaces?: Array<{ ip?: string; dns?: string; port?: string }>; tags?: Array<{ tag: string; value: string }>; inventory?: { location?: string; location_lat?: string; location_lon?: string } };
type ZabbixMapping = { id: string; zabbix_host_id: string; equipment_id: string };
type ZabbixCandidates = { integrationId: string; hosts: ZabbixHost[]; equipment: Array<{ id: string; unit_id: string; name: string; equipment_type: string }>; mappings: ZabbixMapping[] };
type ZabbixSyncStatus = { integration_id: string; health_status: 'healthy' | 'degraded' | 'unavailable' | 'unknown'; last_attempt_at: string | null; last_success_at: string | null; last_failure_at: string | null; consecutive_failures: number; last_error: string | null; hosts_seen: number; mapped_hosts: number; problems_seen: number; duration_ms: number | null };
type DiagnosticResult = { action: 'ping' | 'tracert'; target: string; success: boolean; output: string; latencyMs?: number; code?: string | number };
type ManagedUser = { id: string; email: string; display_name: string; active: boolean; last_access_at?: string | null; created_at: string; roles: string[] };
type AccessRequest = { id: string; email: string; display_name: string; requested_role: string; status: string; created_at: string };
type Toast = { id: string; type: 'error' | 'warning' | 'success' | 'info'; title: string; detail?: string; sticky?: boolean };

const apiBase = `http://${window.location.hostname}:3000`;

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessão expirada. Entre novamente.');
    let detail = '';
    try {
      const payload = await response.json() as { message?: string; error?: string };
      detail = payload.message || payload.error || '';
    } catch { /* resposta sem JSON */ }
    throw new Error(detail ? `Falha na plataforma: ${detail}` : `Falha na plataforma (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function App() {
  const [session, setSession] = useState<LoginResponse | null>(() => {
    const saved = sessionStorage.getItem('healthlink.session');
    return saved ? JSON.parse(saved) as LoginResponse : null;
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<Alert[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [alertMode, setAlertMode] = useState<'active' | 'history'>('active');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [view, setView] = useState<'command' | 'units' | 'alerts' | 'zabbix' | 'connections' | 'users'>('command');
  const [commandMenuOpen, setCommandMenuOpen] = useState(true);
  const [commandScope, setCommandScope] = useState<'all' | 'links' | 'vpn' | 'servers'>('all');
  const [zabbixCandidates, setZabbixCandidates] = useState<ZabbixCandidates | null>(null);
  const [zabbixStatus, setZabbixStatus] = useState<ZabbixSyncStatus | null>(null);
  const [zabbixLoading, setZabbixLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [userMenuOpen]);

  function addToast(toast: Omit<Toast, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (!toast.sticky) window.setTimeout(() => dismissToast(id), toast.type === 'error' ? 8000 : 5000);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function loadAlerts(mode: 'active' | 'history') {
    if (!session) return;
    setAlertsLoading(true);
    try {
      const nextAlerts = mode === 'history'
        ? await api<Alert[]>('/v1/monitoring/alerts?status=resolved&limit=50', session.accessToken)
        : (await Promise.all([
          api<Alert[]>('/v1/monitoring/alerts?status=open&limit=50', session.accessToken),
          api<Alert[]>('/v1/monitoring/alerts?status=acknowledged&limit=50', session.accessToken),
        ])).flat().sort((left, right) => new Date(right.opened_at).getTime() - new Date(left.opened_at).getTime());
      setAlerts(nextAlerts);
      if (mode === 'active') { setActiveAlerts(nextAlerts); setActiveAlertCount(nextAlerts.length); }
    } finally {
      setAlertsLoading(false);
    }
  }

  async function loadResolvedAlerts() {
    if (!session) return;
    const nextAlerts = await api<Alert[]>('/v1/monitoring/alerts?status=resolved&limit=50', session.accessToken);
    setResolvedAlerts(nextAlerts);
  }

  const prevUnitsRef = useRef<Record<string, { status: Unit['operational_status']; name: string; code: string; city: string; state: string }>>({});
  const prevZabbixHealthRef = useRef<ZabbixSyncStatus['health_status'] | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const fetchInventory = () =>
      Promise.all([
        api<Unit[]>('/v1/monitoring/units', session.accessToken),
        api<Equipment[]>('/v1/monitoring/equipment', session.accessToken),
      ]).then(([nextUnits, nextEquipment]) => { setUnits(nextUnits); setEquipment(nextEquipment); setError(''); });

    void fetchInventory().finally(() => setLoading(false));

    const interval = window.setInterval(() => void fetchInventory().catch(() => undefined), 15_000);
    return () => window.clearInterval(interval);
  }, [session]);

  // Monitor Host UP / Host DOWN status transitions in real time and trigger Toast pop-ups
  useEffect(() => {
    if (units.length === 0) return;
    const prevMap = prevUnitsRef.current;
    if (Object.keys(prevMap).length > 0) {
      units.forEach((unit) => {
        const prev = prevMap[unit.unit_id];
        if (prev && prev.status !== unit.operational_status) {
          const fromLabel = statusLabel[prev.status];
          const toLabel = statusLabel[unit.operational_status];
          if (unit.operational_status === 'offline' || unit.operational_status === 'degraded') {
            addToast({
              type: 'error',
              title: `🔴 HOST DOWN · ${unit.code}`,
              detail: `A unidade ${unit.name} (${unit.city}/${unit.state_code}) ficou ${toLabel.toLowerCase()} (era ${fromLabel.toLowerCase()})!`,
              sticky: true,
            });
          } else if (unit.operational_status === 'online') {
            addToast({
              type: 'success',
              title: `🟢 HOST UP · ${unit.code}`,
              detail: `A unidade ${unit.name} (${unit.city}/${unit.state_code}) restabeleceu sinal e está Operacional!`,
            });
          }
        }
      });
    }
    const nextMap: Record<string, { status: Unit['operational_status']; name: string; code: string; city: string; state: string }> = {};
    units.forEach((u) => { nextMap[u.unit_id] = { status: u.operational_status, name: u.name, code: u.code, city: u.city, state: u.state_code }; });
    prevUnitsRef.current = nextMap;
  }, [units]);

  // Monitor Zabbix Integration health transitions
  useEffect(() => {
    if (!zabbixStatus) return;
    const prev = prevZabbixHealthRef.current;
    if (prev && prev !== zabbixStatus.health_status) {
      if (zabbixStatus.health_status === 'unavailable' || zabbixStatus.health_status === 'degraded') {
        addToast({
          type: 'error',
          title: `🔴 ZABBIX DOWN`,
          detail: `Comunicação com a API Zabbix indisponível ou degradada!`,
          sticky: true,
        });
      } else if (zabbixStatus.health_status === 'healthy') {
        addToast({
          type: 'success',
          title: `🟢 ZABBIX UP`,
          detail: `Comunicação com a API Zabbix restabelecida com sucesso!`,
        });
      }
    }
    prevZabbixHealthRef.current = zabbixStatus.health_status;
  }, [zabbixStatus]);

  useEffect(() => {
    if (session) void loadAlerts(alertMode).catch((reason: Error) => setError(reason.message));
  }, [session, alertMode]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => loadResolvedAlerts().catch((reason: Error) => setError(reason.message));
    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => api<ZabbixSyncStatus>('/v1/integrations/zabbix/status', session.accessToken).then(setZabbixStatus).catch(() => undefined);
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, [session]);

  const summary = useMemo(() => ({
    online: units.filter((unit) => unit.operational_status === 'online').length,
    attention: units.filter((unit) => unit.operational_status === 'degraded').length,
    offline: units.filter((unit) => unit.operational_status === 'offline').length,
    unknown: units.filter((unit) => unit.operational_status === 'unknown').length,
  }), [units]);
  const selectedUnit = units.find((unit) => unit.unit_id === selectedUnitId);
  const selectedEquipment = equipment.filter((item) => item.unit_id === selectedUnitId);
  async function refreshAlerts() {
    if (!session) return;
    await loadAlerts(alertMode);
  }
  async function changeAlert(id: string, action: 'acknowledge' | 'resolve') {
    if (!session) return;
    try {
      await api(`/v1/monitoring/alerts/${id}/${action}`, session.accessToken, { method: 'POST', body: '{}' });
      await refreshAlerts();
      await loadResolvedAlerts();
      addToast({ type: 'success', title: action === 'acknowledge' ? 'Alerta reconhecido' : 'Incidente resolvido', detail: action === 'acknowledge' ? 'O alerta foi reconhecido pelo operador.' : 'O incidente foi encerrado e movido para o histórico.' });
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Não foi possível atualizar o alerta.';
      addToast({ type: 'error', title: 'Falha ao atualizar alerta', detail: msg, sticky: true });
    }
  }
  async function loadZabbixCandidates() {
    if (!session) return;
    setZabbixLoading(true);
    try { setZabbixCandidates(await api<ZabbixCandidates>('/v1/integrations/zabbix/mapping-candidates', session.accessToken)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'NÃ£o foi possÃ­vel carregar os hosts Zabbix.'); }
    finally { setZabbixLoading(false); }
  }
  async function loadZabbixStatus() {
    if (!session) return;
    setZabbixStatus(await api<ZabbixSyncStatus>('/v1/integrations/zabbix/status', session.accessToken));
  }
  async function loadUsers() {
    if (!session) return;
    setUsersLoading(true);
    try { const [nextUsers, nextRequests] = await Promise.all([api<ManagedUser[]>('/v1/users', session.accessToken), api<AccessRequest[]>('/v1/users/access-requests', session.accessToken)]); setManagedUsers(nextUsers); setAccessRequests(nextRequests); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os usuários.'); }
    finally { setUsersLoading(false); }
  }
  async function changeUser(id: string, action: 'block' | 'unblock' | 'delete') {
    if (!session) return;
    if (action === 'delete' && !window.confirm('Excluir este usuário do tenant? O histórico global será preservado, mas ele não aparecerá mais nesta lista.')) return;
    try {
      if (action === 'delete') await api(`/v1/users/${id}`, session.accessToken, { method: 'DELETE' });
      else await api(`/v1/users/${id}`, session.accessToken, { method: 'PATCH', body: JSON.stringify({ active: action === 'unblock' }) });
      await loadUsers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o usuário.'); }
  }
  async function refreshInventory() {
    if (!session) return;
    const [nextUnits, nextEquipment] = await Promise.all([
      api<Unit[]>('/v1/monitoring/units', session.accessToken),
      api<Equipment[]>('/v1/monitoring/equipment', session.accessToken),
    ]);
    setUnits(nextUnits); setEquipment(nextEquipment);
  }

  if (!session) return <LoginWithRequest onSuccess={(next) => { sessionStorage.setItem('healthlink.session', JSON.stringify(next)); setSession(next); }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">HL</span><div><strong>HealthLink</strong><small>SENTINEL</small></div></div>
        <nav>
          <button className={`nav-item ${view === 'command' ? 'active' : ''}`} onClick={() => { setView('command'); setSelectedUnitId(null); setCommandMenuOpen((open) => !open); }}><span>01</span> Centro operacional <b className="nav-chevron">{commandMenuOpen && view === 'command' ? '−' : '+'}</b></button>
          {commandMenuOpen && view === 'command' && <div className="nav-submenu" aria-label="Filtros do centro operacional">
            {([['all', 'Geral'], ['links', 'Links'], ['vpn', 'VPN'], ['servers', 'Servidores']] as const).map(([scope, label]) => <button key={scope} className={`nav-subitem ${commandScope === scope ? 'active' : ''}`} onClick={() => { setCommandScope(scope); setSelectedUnitId(null); }}><span />{label}</button>)}
          </div>}
          <button className={`nav-item ${view === 'units' ? 'active' : ''}`} onClick={() => { setView('units'); setSelectedUnitId(null); }}><span>02</span> Unidades móveis</button>
          <button className={`nav-item ${view === 'alerts' ? 'active' : ''}`} onClick={() => { setView('alerts'); setSelectedUnitId(null); }}><span>03</span> Alertas {activeAlertCount > 0 && <b className="nav-badge">{activeAlertCount}</b>}</button>
          <button className={`nav-item ${view === 'connections' ? 'active' : ''}`} onClick={() => { setView('connections'); setSelectedUnitId(null); void loadZabbixStatus(); }}><span>04</span> Status das conexões <i className={`nav-health-dot ${zabbixStatus?.health_status ?? 'unknown'}`} /></button>
          <button className={`nav-item ${view === 'users' ? 'active' : ''}`} onClick={() => { setView('users'); setSelectedUnitId(null); void loadUsers(); }}><span>06</span> Usuários</button>
          <button className="nav-item"><span>07</span> Relatórios</button>
        </nav>
        <SyncStatusButton status={zabbixStatus} onClick={() => { setView('zabbix'); setSelectedUnitId(null); void Promise.all([loadZabbixStatus(), loadZabbixCandidates()]); }} />
        <div className={`sidebar-footer integration-${zabbixStatus?.health_status ?? 'unknown'}`}><span className="pulse" /> {zabbixStatus?.health_status === 'healthy' ? 'Zabbix sincronizado' : zabbixStatus?.health_status === 'unavailable' ? 'Zabbix indisponível' : zabbixStatus?.health_status === 'degraded' ? 'Zabbix em atenção' : 'Zabbix aguardando coleta'}<small>{zabbixStatus?.last_success_at ? `última coleta · ${new Date(zabbixStatus.last_success_at).toLocaleTimeString('pt-BR')}` : 'ciclo automático · 60s'}</small></div>
      </aside>
      <main>
        <header className="topbar">
          <div><p className="eyebrow">CENTRO DE COMANDO · {session.tenant.name}</p><h1>Consciência operacional</h1></div>
          <div className="header-actions-group">
              <span className="theme-moon-icon">🌙</span>
              <span className="theme-switch-knob" />
            <div className="user-profile-pill-wrapper">
              <button className={`user-profile-pill ${userMenuOpen ? 'active' : ''}`} onClick={() => setUserMenuOpen((prev) => !prev)} aria-expanded={userMenuOpen}>
                <span className="user-avatar-circle">👤</span>
                <span className="user-profile-name">{session.user.displayName.split(' ')[0] || 'admin'}</span>
                <span className="user-chevron">{userMenuOpen ? '▲' : '▼'}</span>
              </button>
              {userMenuOpen && (
                <div className="user-profile-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); setProfileModalOpen(true); }}>
                    <span className="dropdown-item-icon">✏</span>
                    <span>Editar perfil</span>
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout" onClick={() => { sessionStorage.clear(); setSession(null); }}>
                    <span className="dropdown-item-icon">🚪</span>
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className="mission-strip"><div><span className="live-dot" /> OPERAÇÃO MONITORADA</div><p>{activeAlertCount ? `${activeAlertCount} alerta(s) requerem avaliação` : 'Nenhum evento crítico em aberto'}</p><time>{new Date().toLocaleString('pt-BR')}</time></section>
        <section className="content">
          {error && (
            <div className="error-banner" role="alert">
              <span className="error-banner-icon">⚠</span>
              <span className="error-banner-text">{error}</span>
              <button className="error-banner-close" onClick={() => setError('')} title="Fechar">✕</button>
            </div>
          )}
          {view === 'alerts' ? <AlertsCenter alerts={alerts} mode={alertMode} loading={alertsLoading} onModeChange={setAlertMode} onAction={changeAlert} onRetry={() => void loadAlerts(alertMode).catch((r: Error) => setError(r.message))} /> : view === 'users' ? <UsersPanel users={managedUsers} requests={accessRequests} loading={usersLoading} token={session.accessToken} onRefresh={loadUsers} onChange={changeUser} /> : view === 'command' ? <CommandCenter units={units} equipment={equipment} alerts={activeAlerts} resolvedAlerts={resolvedAlerts} summary={summary} scope={commandScope} token={session.accessToken} onInventoryRefresh={refreshInventory} onError={setError} onSelectUnit={(unitId) => { setSelectedUnitId(unitId); setView('units'); }} /> : view === 'connections' ? <ConnectionStatus integrationStatus={zabbixStatus} onRefresh={loadZabbixStatus} onOpenZabbix={() => { setView('zabbix'); void loadZabbixCandidates(); }} /> : view === 'zabbix' ? <ZabbixIntegration candidates={zabbixCandidates} integrationStatus={zabbixStatus} units={units} loading={zabbixLoading} onRefresh={loadZabbixCandidates} onStatusRefresh={loadZabbixStatus} onInventoryRefresh={refreshInventory} onAlertsRefresh={refreshAlerts} onError={setError} token={session.accessToken} /> : <><InventoryActions token={session.accessToken} units={units} selectedUnit={selectedUnit} onRefresh={refreshInventory} onError={(message) => { setError(message); addToast({ type: 'error', title: 'Falha no cadastro', detail: message, sticky: true }); }} /><UnitsView units={units} selectedUnit={selectedUnit} selectedEquipment={selectedEquipment} loading={loading} summary={summary} onSelectUnit={setSelectedUnitId} onBack={() => setSelectedUnitId(null)} onInventoryRefresh={refreshInventory} token={session.accessToken} /></>}
        </section>
      </main>
      {profileModalOpen && <EditProfileModal session={session} onSave={(newName) => { setSession({ ...session, user: { ...session.user, displayName: newName } }); addToast({ type: 'success', title: 'Perfil atualizado', detail: 'Nome de exibição salvo com sucesso.' }); }} onClose={() => setProfileModalOpen(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

const statusLabel = { online: 'Operacional', degraded: 'Atenção', offline: 'Indisponível', unknown: 'Sem telemetria' };
const mapStatusColor = { online: '#35e887', degraded: '#ffbd4a', offline: '#ff5964', unknown: '#33455c' };
const brazilStateCodes = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const capitalByState: Record<string, string> = { AC: 'Rio Branco', AL: 'Maceió', AP: 'Macapá', AM: 'Manaus', BA: 'Salvador', CE: 'Fortaleza', DF: 'Brasília', ES: 'Vitória', GO: 'Goiânia', MA: 'São Luís', MT: 'Cuiabá', MS: 'Campo Grande', MG: 'Belo Horizonte', PA: 'Belém', PB: 'João Pessoa', PR: 'Curitiba', PE: 'Recife', PI: 'Teresina', RJ: 'Rio de Janeiro', RN: 'Natal', RS: 'Porto Alegre', RO: 'Porto Velho', RR: 'Boa Vista', SC: 'Florianópolis', SP: 'São Paulo', SE: 'Aracaju', TO: 'Palmas' };
const stateNameByCode: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };

const stateMapCenter: Record<string, [number, number]> = {
  AC: [-70.0, -9.0], AL: [-36.6, -9.6], AP: [-51.8, 1.4], AM: [-63.0, -4.2], BA: [-41.7, -12.5], CE: [-39.5, -5.2], DF: [-47.9, -15.8], ES: [-40.5, -19.6], GO: [-49.6, -16.0], MA: [-45.3, -5.0], MT: [-55.5, -12.8], MS: [-54.7, -20.5], MG: [-44.5, -18.5], PA: [-52.5, -4.5], PB: [-36.7, -7.1], PR: [-51.5, -24.6], PE: [-37.9, -8.4], PI: [-42.8, -7.5], RJ: [-43.2, -22.2], RN: [-36.6, -5.8], RS: [-53.2, -30.0], RO: [-63.0, -10.8], RR: [-61.3, 2.0], SC: [-50.2, -27.3], SP: [-48.7, -22.3], SE: [-37.4, -10.6], TO: [-48.3, -10.2],
};
const mapRasterFallbackStyle = {
  version: 8 as const,
  sources: {
    cartoDark: {
      type: 'raster' as const,
      // A raster source must use one provider/style. Mixing OSM and CARTO
      // here makes adjacent tiles alternate styles and creates vertical
      // light/dark bands in the map.
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto-dark-tiles', type: 'raster' as const, source: 'cartoDark' }],
};

function getStateFill(uf: string, units: Unit[]) {
  const stateUnits = units.filter((unit) => unit.state_code.toUpperCase() === uf.toUpperCase());
  if (!stateUnits.length) return mapStatusColor.unknown;
  const offline = stateUnits.filter((unit) => unit.operational_status === 'offline').length;
  if (offline / stateUnits.length > 0.5) return mapStatusColor.offline;
  if (stateUnits.every((unit) => unit.operational_status === 'online')) return mapStatusColor.online;
  if (offline > 0 || stateUnits.some((unit) => unit.operational_status === 'degraded')) return mapStatusColor.degraded;
  // Unidade cadastrada sem coleta exige atenção; cinza fica reservado
  // para estados sem unidades.
  return mapStatusColor.degraded;
}

function CommandCenter({ units, equipment, alerts: _alerts, resolvedAlerts, summary: _summary, scope, token, onInventoryRefresh, onError, onSelectUnit }: { units: Unit[]; equipment: Equipment[]; alerts: Alert[]; resolvedAlerts: Alert[]; summary: { online: number; attention: number; offline: number; unknown: number }; scope: 'all' | 'links' | 'vpn' | 'servers'; token: string; onInventoryRefresh: () => Promise<void>; onError: (message: string) => void; onSelectUnit: (unitId: string) => void }) {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [stateMapCode, setStateMapCode] = useState<string | null>(null);
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [mapContext, setMapContext] = useState<{ stateCode: string; x: number; y: number } | null>(null);
  const [quickCreateStateCode, setQuickCreateStateCode] = useState<string | null>(null);
  const [equipmentModalUnit, setEquipmentModalUnit] = useState<Unit | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Unit['operational_status']>('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [linkTelemetry, setLinkTelemetry] = useState<LinkTelemetry[]>([]);
  const scopeTypeCodes = scope === 'links' ? ['internet_link'] : scope === 'vpn' ? ['vpn'] : scope === 'servers' ? ['linux_server'] : [];
  const scopedUnitIds = scopeTypeCodes.length ? new Set(equipment.filter((item) => scopeTypeCodes.some((code) => item.equipment_type.toLowerCase().includes(code))).map((item) => item.unit_id)) : null;
  const visibleUnits = scopedUnitIds ? units.filter((unit) => scopedUnitIds.has(unit.unit_id)) : units;
  const visibleUnitCodes = new Set(visibleUnits.map((unit) => unit.code));
  const visibleEquipment = equipment.filter((item) => visibleUnitCodes.has(units.find((unit) => unit.unit_id === item.unit_id)?.code ?? ''));
  const alerts = scope === 'all' ? _alerts : _alerts.filter((alert) => alert.unit_code ? visibleUnitCodes.has(alert.unit_code) : false);
  const scopedResolvedAlerts = scope === 'all' ? resolvedAlerts : resolvedAlerts.filter((alert) => alert.unit_code ? visibleUnitCodes.has(alert.unit_code) : false);
  const visibleSummary = { online: visibleUnits.filter((unit) => unit.operational_status === 'online').length, attention: visibleUnits.filter((unit) => unit.operational_status === 'degraded').length, offline: visibleUnits.filter((unit) => unit.operational_status === 'offline').length, unknown: visibleUnits.filter((unit) => unit.operational_status === 'unknown').length };
  const summary = visibleSummary;
  const selectedUnits = visibleUnits.filter((unit) => unit.state_code.toUpperCase() === selectedStateCode);
  const filteredUnits = visibleUnits.filter((unit) => (stateFilter === 'all' || unit.state_code.toUpperCase() === stateFilter) && (statusFilter === 'all' || unit.operational_status === statusFilter));
  const availability = visibleUnits.length ? Math.round((visibleSummary.online / visibleUnits.length) * 100) : 0;
  const hoveredUnits = visibleUnits.filter((unit) => unit.state_code.toUpperCase() === hoveredStateCode);
  const hoveredStatus = hoveredUnits.length && hoveredUnits.every((unit) => unit.operational_status === 'online') ? 'online' : hoveredUnits.some((unit) => unit.operational_status === 'offline') ? 'offline' : hoveredUnits.some((unit) => unit.operational_status === 'degraded') ? 'degraded' : 'unknown';
  const stateOptions = [...new Set(visibleUnits.map((unit) => unit.state_code.toUpperCase()))].sort();
  const scopeLabel = scope === 'all' ? 'Geral' : scope === 'links' ? 'Links' : scope === 'vpn' ? 'VPN' : 'Servidores';
  const mapLocations = brazilMap.locations as Array<{ id: string; name: string; path: string }>;
  useEffect(() => {
    let active = true;
    const load = () => api<LinkTelemetry[]>('/v1/monitoring/link-telemetry', token)
      .then((rows) => { if (active) setLinkTelemetry(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setLinkTelemetry([]); });
    void load();
    const interval = window.setInterval(() => void load(), 2_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token]);
  useEffect(() => {
    if (!mapContext) return;
    const close = () => setMapContext(null);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', closeOnEscape); };
  }, [mapContext]);
  return <section className="command-center">
    {stateMapCode && <StateLocationMap stateCode={stateMapCode} units={visibleUnits.filter((unit) => unit.state_code.toUpperCase() === stateMapCode)} telemetry={linkTelemetry} alerts={[..._alerts, ...resolvedAlerts]} onClose={() => setStateMapCode(null)} onSelectUnit={onSelectUnit} onLocateUnit={onSelectUnit} onAddEquipment={setEquipmentModalUnit} onDiagnostic={async (unit, action) => { const target = equipment.find((item) => item.unit_id === unit.unit_id); if (!target) throw new Error('Nenhum equipamento cadastrado nesta unidade para executar o diagnóstico.'); return api<DiagnosticResult>(`/v1/equipment/${target.equipment_id}/diagnostics`, token, { method: 'POST', body: JSON.stringify({ action }) }); }} />}
    {equipmentModalUnit && <div className="form-modal-backdrop" role="presentation" onMouseDown={() => setEquipmentModalUnit(null)}><div className="form-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><EquipmentForm token={token} unit={equipmentModalUnit} onCreated={async () => { setEquipmentModalUnit(null); await onInventoryRefresh(); }} onCancel={() => setEquipmentModalUnit(null)} onError={onError} /></div></div>}
    <div className="command-scope-heading"><p className="eyebrow">CENTRO OPERACIONAL · VISÃO FILTRADA</p><h2>{scopeLabel}</h2><small>{scope === 'all' ? 'Todas as unidades e equipamentos monitorados.' : `Unidades com equipamentos classificados como ${scopeLabel.toLowerCase()}.`}</small></div>
    {quickCreateStateCode && <div className="map-quick-create"><UnitForm token={token} initialStateCode={quickCreateStateCode} onCreated={async () => { setQuickCreateStateCode(null); await onInventoryRefresh(); }} onCancel={() => setQuickCreateStateCode(null)} onError={onError} /></div>}
    <div className="command-summary">
      <CommandMetric label="Total unidades" value={String(visibleUnits.length)} note="inventário monitorado" tone="neutral" />
      <CommandMetric label="Online" value={String(summary.online)} note={`${availability}% respondendo`} tone="ok" />
      <CommandMetric label="Offline" value={String(summary.offline)} note="sem comunicação" tone="danger" />
      <CommandMetric label="Degradadas" value={String(summary.attention)} note="exigem atenção" tone="warn" />
      <CommandMetric label="Disponibilidade média" value={`${availability}%`} note="janela operacional" tone="cyan" />
      <CommandMetric label="Alertas críticos" value={String(alerts.filter((alert) => alert.severity >= 4).length)} note={`${alerts.length} em aberto`} tone="danger" />
    </div>
    <div className="command-filters"><div><p className="eyebrow">FILTROS OPERACIONAIS</p><strong>{filteredUnits.length} unidade(s) no recorte atual</strong></div><label>UF<select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setSelectedStateCode(event.target.value === 'all' ? null : event.target.value); }}><option value="all">Brasil inteiro</option>{stateOptions.map((code) => <option key={code} value={code}>{code} · {stateNameByCode[code] ?? code}</option>)}</select></label><label>Situação<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Todas</option><option value="online">Operacionais</option><option value="degraded">Em atenção</option><option value="offline">Indisponíveis</option><option value="unknown">Sem telemetria</option></select></label><button className="secondary-button compact" onClick={() => { setStateFilter('all'); setStatusFilter('all'); setSelectedStateCode(null); }}>Limpar filtros</button></div>
    <div className="command-grid">
      <article className="map-panel">
        <div className="panel-heading"><div><p className="eyebrow">MONITORAMENTO · BRASIL INTEIRO</p><h2>Mapa operacional</h2><small>Clique em um estado para filtrar a operação.</small></div><div className="map-supervisor"><span>CONTROLE SUPERVISOR</span><strong>NOC · acesso auditado</strong></div></div>
        <div className="map-stage"><svg className="brazil-map brazil-vector-map" viewBox={brazilMap.viewBox} role="img" aria-label="Mapa interativo do Brasil">
          {mapLocations.map((location) => {
            const code = location.id.toUpperCase();
            const stateUnits = visibleUnits.filter((unit) => unit.state_code.toUpperCase() === code);
            const status = stateUnits.length && stateUnits.every((unit) => unit.operational_status === 'online') ? 'online' : stateUnits.some((unit) => unit.operational_status === 'offline') && stateUnits.filter((unit) => unit.operational_status === 'offline').length / stateUnits.length > 0.5 ? 'offline' : stateUnits.some((unit) => unit.operational_status === 'offline' || unit.operational_status === 'degraded') ? 'degraded' : 'unknown';
            const unit = stateUnits[0];
            const stateName = stateNameByCode[code] ?? location.name;
            return <path key={code} d={location.path} className={`map-location ${status} ${selectedStateCode === code ? 'selected' : ''}`} fill={getStateFill(code, visibleUnits)} tabIndex={0} role="button" aria-label={`${stateName} (${code}) · ${statusLabel[status]}`} onMouseEnter={() => setHoveredStateCode(code)} onMouseLeave={() => setHoveredStateCode(null)} onFocus={() => setHoveredStateCode(code)} onBlur={() => setHoveredStateCode(null)} onClick={() => { setSelectedStateCode(code); setStateMapCode(code); setMapContext(null); }} onContextMenu={(event) => { event.preventDefault(); setSelectedStateCode(code); setHoveredStateCode(null); const posX = event.clientX + 260 > window.innerWidth ? Math.max(12, event.clientX - 260) : event.clientX; const posY = event.clientY + 180 > window.innerHeight ? Math.max(12, event.clientY - 180) : event.clientY; setMapContext({ stateCode: code, x: posX, y: posY }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedStateCode(code); setStateMapCode(code); } }} />;
          })}
        </svg>{hoveredStateCode && <div className="map-tooltip"><span>{hoveredStateCode}</span><strong>{stateNameByCode[hoveredStateCode] ?? mapLocations.find((location) => location.id.toUpperCase() === hoveredStateCode)?.name}</strong><small>{hoveredUnits.length ? `${hoveredUnits.length} unidade(s) · ${statusLabel[hoveredStatus]}` : 'Nenhuma unidade cadastrada'}</small></div>}</div>
        <div className="map-selection">{selectedStateCode ? <><strong>{selectedStateCode}</strong><span>{selectedUnits.length ? `${selectedUnits.length} unidade(s) · ${statusLabel[hoveredStatus]}` : 'Nenhuma unidade cadastrada neste estado'}</span><button className="map-open-detail" onClick={() => setStateMapCode(selectedStateCode)}>Explorar mapa</button></> : <span>Selecione um estado no mapa para consultar a prontidão local.</span>}</div>
        {selectedStateCode && selectedUnits.length > 0 && <div className="map-unit-list">{selectedUnits.map((unit) => <button key={unit.unit_id} onClick={() => onSelectUnit(unit.unit_id)}><span className={`legend-dot ${unit.operational_status}`} /><span><strong>{unit.code}</strong><small>{unit.name}</small></span><em>{statusLabel[unit.operational_status]}</em></button>)}</div>}
        <div className="map-legend"><span><i className="legend-dot online" /> 100% online</span><span><i className="legend-dot degraded" /> Atenção / instável</span><span><i className="legend-dot offline" /> &gt;50% offline</span><span><i className="legend-dot unknown" /> Sem unidades</span><span><i className="legend-dot selected" /> UF selecionada</span></div>
      </article>
      <OperationalOverview units={visibleUnits} equipment={visibleEquipment} alerts={alerts} resolvedAlerts={scopedResolvedAlerts} summary={summary} onSelectUnit={onSelectUnit} />
    </div>
    {mapContext && <div className="map-context-card" style={{ left: mapContext.x, top: mapContext.y }} onMouseDown={(event) => event.stopPropagation()}><button className="map-context-close" aria-label="Fechar menu" onClick={() => setMapContext(null)}>×</button><p>AÇÃO RÁPIDA · {mapContext.stateCode}</p><strong>{stateNameByCode[mapContext.stateCode] ?? mapContext.stateCode}</strong><small>Cadastre uma unidade diretamente neste estado.</small><button className="primary compact" onClick={() => { setQuickCreateStateCode(mapContext.stateCode); setMapContext(null); }}>+ Adicionar unidade</button></div>}
  </section>;
}

function formatLinkRate(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Gbps`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Kbps`;
  return `${Math.round(value)} bps`;
}

function formatContractedMbps(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return 'N/D';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} Mbps`;
}

function formatLatencyMs(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ms`;
}

function isLinkEquipmentType(type: string) {
  return ['mikrotik', 'starlink', 'vpn', 'internet_link'].includes(type);
}

function LinkSparkline({ values, status }: { values: number[]; status: Unit['operational_status'] }) {
  const series = values.length > 1 ? values : [0, 0];
  const max = Math.max(1, ...series);
  const points = series.map((value, index) => `${(index / (series.length - 1)) * 86},${26 - (value / max) * 22}`).join(' ');
  return <svg className={`link-sparkline ${status}`} viewBox="0 0 86 30" role="img" aria-label="Histórico recente de latência"><polyline points={points} /><circle cx="86" cy={26 - (series[series.length - 1] / max) * 22} r="2.5" /></svg>;
}

function LinkTelemetryCard({ unit, link, located, diagnosticLatencyMs, onView, onContext }: { unit: Unit; link?: LinkTelemetry; located: boolean; diagnosticLatencyMs?: number; onView: () => void; onContext: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const metrics = link?.metrics ?? {};
  const latency = diagnosticLatencyMs ?? metrics['network.latency.ms'];
  const loss = metrics['network.loss.pct'];
  const inbound = metrics['network.in.bps'];
  const outbound = metrics['network.out.bps'];
  const statusCode = unit.operational_status === 'online' ? 'OPR' : unit.operational_status === 'degraded' ? 'ATN' : unit.operational_status === 'offline' ? 'DWN' : 'N/D';
  const statusIcon = unit.operational_status === 'online' ? '◆' : unit.operational_status === 'degraded' ? '△' : unit.operational_status === 'offline' ? '⇩' : '○';
  return <article className={`state-link-card ${unit.operational_status} ${located ? '' : 'pending'}`} role="button" tabIndex={0} aria-label={`${located ? 'Focalizar' : 'Localizar'} ${link?.equipment_name ?? unit.name}`} onClick={onView} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(); } }} onContextMenu={onContext}>
    <div className="state-link-card-head"><strong>{link?.equipment_name ?? unit.name}</strong><span className="state-link-health-icon" aria-label={statusLabel[unit.operational_status]}>{statusIcon}</span><span className="state-link-badge">{statusCode}</span></div>
    <div className="state-link-card-body">
      <div className="state-link-values"><span>Latência: <b>{formatLatencyMs(latency)}</b></span><span>Perda: <b>{loss === undefined ? '—' : `${loss.toFixed(1)}%`}</b></span><span>↓ Download: <b>{formatLinkRate(inbound)}</b></span><span>↑ Upload: <b>{formatLinkRate(outbound)}</b></span></div>
      <LinkSparkline values={diagnosticLatencyMs === undefined ? (link?.latency_history ?? []).map((point) => point.value) : [...(link?.latency_history ?? []).slice(-13).map((point) => point.value), diagnosticLatencyMs]} status={unit.operational_status} />
      <span className="state-link-open-hint">{located ? '›' : '+'}</span>
    </div>
    <div className="state-link-card-meta"><span>{unit.code} · {unit.city}</span><span>Plano: ↓ {formatContractedMbps(link?.contracted_download_mbps)} · ↑ {formatContractedMbps(link?.contracted_upload_mbps)}</span><small>{link?.observed_at ? new Date(link.observed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'SEM TELEMETRIA'}</small></div>
  </article>;
}

function LinkAnalysisPanel({ unit, link, alerts, diagnosticLatencyMs, onClose, onOpenInventory }: { unit: Unit; link?: LinkTelemetry; alerts: Alert[]; diagnosticLatencyMs?: number; onClose: () => void; onOpenInventory: () => void }) {
  const [hoveredLatency, setHoveredLatency] = useState<{ value: number; observedAt: string; left: number; top: number } | null>(null);
  const metrics = link?.metrics ?? {};
  const latency = diagnosticLatencyMs ?? metrics['network.latency.ms'];
  const loss = metrics['network.loss.pct'];
  const inbound = metrics['network.in.bps'];
  const outbound = metrics['network.out.bps'];
  const history = link?.latency_history ?? [];
  const chartHistory = diagnosticLatencyMs === undefined ? history : [...history.slice(-13), { value: diagnosticLatencyMs, observed_at: new Date().toISOString() }];
  const chartSeries = chartHistory.length > 1 ? chartHistory.map((point) => point.value) : [0, 0];
  const maximum = Math.max(1, ...chartSeries);
  const chartPoints = chartSeries.map((value, index) => `${(index / (chartSeries.length - 1)) * 680},${190 - (value / maximum) * 155}`).join(' ');
  const linkErrors = alerts
    .filter((alert) => link?.equipment_id ? alert.equipment_id === link.equipment_id : alert.unit_id === unit.unit_id || alert.unit_code === unit.code)
    .sort((first, second) => new Date(second.resolved_at ?? second.opened_at).getTime() - new Date(first.resolved_at ?? first.opened_at).getTime())
    .slice(0, 8);
  return <div className="link-analysis-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="link-analysis-dialog" role="dialog" aria-modal="true" aria-label={`Análise detalhada de ${link?.equipment_name ?? unit.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="link-analysis-header"><div><p className="eyebrow">ANÁLISE DETALHADA · LINK</p><h2>{link?.equipment_name ?? unit.name}</h2><small>{unit.code} · {unit.name} · {unit.city}/{unit.state_code}</small></div><button onClick={onClose} aria-label="Fechar análise">×</button></header>
      <div className="link-analysis-content">
        <article className={`link-analysis-identity ${unit.operational_status}`}><div className="link-analysis-title"><div><span>LINK MONITORADO</span><strong>{link?.equipment_name ?? unit.name}</strong><small>Unidade {unit.code}</small></div><i /></div><div className="link-analysis-status-grid"><div><span>STATUS ATUAL</span><strong>{statusLabel[unit.operational_status]}</strong></div><div><span>ÚLTIMA AMOSTRA</span><strong>{link?.observed_at ? new Date(link.observed_at).toLocaleString('pt-BR') : 'Sem telemetria'}</strong></div></div><button onClick={onOpenInventory}>Abrir inventário completo</button></article>
        <article className="link-analysis-chart"><div className="link-analysis-section-head"><div><h3>Latência (ms)</h3><small>{diagnosticLatencyMs === undefined ? 'AMOSTRAS RECENTES DO ZABBIX · passe o mouse nos pontos' : 'ÚLTIMO PING LOCAL · MEDIÇÃO MANUAL'}</small></div><strong>{formatLatencyMs(hoveredLatency?.value ?? latency)}</strong></div><div className="link-chart-stage"><span>{formatLatencyMs(maximum)}</span><span>0 ms</span><svg viewBox="0 0 680 210" preserveAspectRatio="none" onMouseLeave={() => setHoveredLatency(null)}><line x1="0" y1="35" x2="680" y2="35" /><line x1="0" y1="87" x2="680" y2="87" /><line x1="0" y1="139" x2="680" y2="139" /><line x1="0" y1="190" x2="680" y2="190" /><polyline className={unit.operational_status} points={chartPoints} />{chartHistory.map((point, index) => { const x = (index / Math.max(1, chartHistory.length - 1)) * 680; const y = 190 - (point.value / maximum) * 155; const showTooltip = (event: ReactMouseEvent<SVGCircleElement>) => { const stage = event.currentTarget.ownerSVGElement?.parentElement; if (!stage) return; const bounds = stage.getBoundingClientRect(); setHoveredLatency({ value: point.value, observedAt: point.observed_at, left: Math.max(74, Math.min(bounds.width - 74, event.clientX - bounds.left)), top: Math.max(52, event.clientY - bounds.top) }); }; return <circle className="link-chart-point" key={`${point.observed_at}-${index}`} cx={x} cy={y} r="5" onMouseEnter={showTooltip} onMouseMove={showTooltip}><title>{`${formatLatencyMs(point.value)} · ${new Date(point.observed_at).toLocaleString('pt-BR')}`}</title></circle>; })}</svg>{hoveredLatency && <div className="link-chart-tooltip" style={{ left: hoveredLatency.left, top: hoveredLatency.top }}><strong>{formatLatencyMs(hoveredLatency.value)}</strong><small>{new Date(hoveredLatency.observedAt).toLocaleString('pt-BR')}</small></div>}{chartHistory.length < 2 && diagnosticLatencyMs === undefined && <div className="link-chart-empty">Aguardando histórico da coleta rápida</div>}</div></article>
        <div className="link-analysis-metrics"><article><span>PERDA DE PACOTES</span><strong>{loss === undefined ? '—' : `${loss.toFixed(2)}%`}</strong><small>última amostra válida</small></article><article><span>DOWNLOAD ATUAL</span><strong>{formatLinkRate(inbound)}</strong><small>tráfego recebido na interface WAN</small></article><article><span>UPLOAD ATUAL</span><strong>{formatLinkRate(outbound)}</strong><small>tráfego enviado pela interface WAN</small></article><article><span>VELOCIDADE CONTRATADA</span><strong>↓ {formatContractedMbps(link?.contracted_download_mbps)}<br />↑ {formatContractedMbps(link?.contracted_upload_mbps)}</strong><small>download e upload cadastrados</small></article></div>
        <article className="link-error-history"><div className="link-error-history-head"><div><span>HISTÓRICO DE ERROS</span><strong>Ocorrências do link</strong></div><small>{linkErrors.length} registro(s)</small></div>{linkErrors.length === 0 ? <div className="link-error-empty"><i>✓</i><div><strong>Nenhum erro registrado</strong><small>Alertas do Zabbix vinculados a este link aparecerão aqui.</small></div></div> : <div className="link-error-list">{linkErrors.map((alert) => <div className={`link-error-row severity-${alert.severity}`} key={alert.id}><span className="link-error-indicator" /><div><strong>{alert.title}</strong><small>{new Date(alert.opened_at).toLocaleString('pt-BR')}{alert.resolved_at ? ` · resolvido em ${new Date(alert.resolved_at).toLocaleString('pt-BR')}` : ''}</small></div><span className={`status ${alert.status === 'resolved' ? 'online' : alert.status === 'acknowledged' ? 'degraded' : 'offline'}`}>{alert.status === 'resolved' ? 'Resolvido' : alert.status === 'acknowledged' ? 'Reconhecido' : 'Ativo'}</span></div>)}</div>}</article>
      </div>
    </section>
  </div>;
}

function StateLocationMap({ stateCode, units, telemetry = [], alerts = [], onClose, onSelectUnit, onLocateUnit, onAddEquipment, onDiagnostic }: { stateCode: string; units: Unit[]; telemetry?: LinkTelemetry[]; alerts?: Alert[]; onClose: () => void; onSelectUnit: (unitId: string) => void; onLocateUnit: (unitId: string) => void; onAddEquipment: (unit: Unit) => void; onDiagnostic: (unit: Unit, action: 'ping' | 'tracert') => Promise<DiagnosticResult> }) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [unitContext, setUnitContext] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [diagnosticLatencyByUnit, setDiagnosticLatencyByUnit] = useState<Record<string, number>>({});
  const [diagnostic, setDiagnostic] = useState<{ unit: Unit; action: 'ping' | 'tracert'; status: 'running' | 'done' | 'error'; result?: DiagnosticResult; message?: string } | null>(null);
  // Começamos pelo estilo raster leve: ele evita aguardar o JSON de estilo
  // vetorial antes de mostrar o mapa e reduz o tempo de primeira pintura.
  const [mapFallback, setMapFallback] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const locatedUnits = units.filter((unit) => unit.latitude !== null && unit.longitude !== null && String(unit.latitude).trim() !== '' && String(unit.longitude).trim() !== '' && Number.isFinite(Number(unit.latitude)) && Number.isFinite(Number(unit.longitude)));
  const pendingUnits = units.filter((unit) => !locatedUnits.includes(unit));
  const fallbackCenter = stateMapCenter[stateCode] ?? [-52.5, -14.2];
  const longitude = locatedUnits.length ? locatedUnits.reduce((total, unit) => total + Number(unit.longitude), 0) / locatedUnits.length : fallbackCenter[0];
  const latitude = locatedUnits.length ? locatedUnits.reduce((total, unit) => total + Number(unit.latitude), 0) / locatedUnits.length : fallbackCenter[1];
  const mapBounds = locatedUnits.length > 1 ? locatedUnits.reduce((bounds, unit) => {
    const lng = Number(unit.longitude); const lat = Number(unit.latitude);
    return { minLng: Math.min(bounds.minLng, lng), maxLng: Math.max(bounds.maxLng, lng), minLat: Math.min(bounds.minLat, lat), maxLat: Math.max(bounds.maxLat, lat) };
  }, { minLng: Number(locatedUnits[0]?.longitude), maxLng: Number(locatedUnits[0]?.longitude), minLat: Number(locatedUnits[0]?.latitude), maxLat: Number(locatedUnits[0]?.latitude) }) : null;
  const safeTelemetry = Array.isArray(telemetry) ? telemetry : [];
  const telemetryByUnit = new globalThis.Map(units.map((unit) => [unit.unit_id, safeTelemetry.filter((item) => item?.unit_id === unit.unit_id)]));
  const runDiagnostic = async (unit: Unit, action: 'ping' | 'tracert') => {
    setUnitContext(null);
    setDiagnostic({ unit, action, status: 'running' });
    try { const result = await onDiagnostic(unit, action); if (action === 'ping' && result.success && Number.isFinite(result.latencyMs)) setDiagnosticLatencyByUnit((current) => ({ ...current, [unit.unit_id]: result.latencyMs as number })); setDiagnostic({ unit, action, status: 'done', result }); }
    catch (reason) { setDiagnostic({ unit, action, status: 'error', message: reason instanceof Error ? reason.message : 'Falha ao executar diagnóstico.' }); }
  };

  // Ao escolher uma unidade na lista ou no marcador, leva o mapa até ela.
  // O estado selecionado continua visível ao redor, mas a unidade recebe foco operacional.
  useEffect(() => {
    if (!selectedUnit || !mapRef.current) return;
    const unitLongitude = Number(selectedUnit.longitude);
    const unitLatitude = Number(selectedUnit.latitude);
    if (!Number.isFinite(unitLongitude) || !Number.isFinite(unitLatitude)) return;
    mapRef.current.flyTo({ center: [unitLongitude, unitLatitude], zoom: 14, duration: 650, essential: true });
  }, [selectedUnit]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') detailUnit ? setDetailUnit(null) : onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailUnit, onClose]);
  useEffect(() => { setMapReady(false); }, [stateCode]);
  return <div className="state-map-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="state-map-dialog" role="dialog" aria-modal="true" aria-label={`Localização das unidades em ${stateNameByCode[stateCode] ?? stateCode}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="state-map-header"><div><p className="eyebrow">VISÃO GEOGRÁFICA · {stateCode}</p><h2>{stateNameByCode[stateCode] ?? stateCode}</h2><small>{units.length} unidade(s) no estado · {locatedUnits.length} georreferenciada(s)</small></div><button className="state-map-close" onClick={onClose} aria-label="Fechar mapa">×</button></header>
      <div className="state-map-body">
        <div className="state-map-canvas">
          <Map ref={mapRef} key={stateCode} initialViewState={{ longitude, latitude, zoom: locatedUnits.length > 1 ? 8 : locatedUnits.length === 1 ? 12 : 6 }} mapStyle={mapFallback ? mapRasterFallbackStyle : 'https://tiles.openfreemap.org/styles/dark'} onLoad={(event) => { setMapReady(true); if (mapBounds) { event.target.fitBounds([[mapBounds.minLng, mapBounds.minLat], [mapBounds.maxLng, mapBounds.maxLat]], { padding: 90, maxZoom: 12, duration: 0 }); } else if (locatedUnits.length === 1) { event.target.setZoom(12); } }} onError={() => setMapFallback(true)} attributionControl>
            <NavigationControl position="bottom-right" showCompass={false} />
            {locatedUnits.map((unit) => <Marker key={unit.unit_id} longitude={Number(unit.longitude)} latitude={Number(unit.latitude)} anchor="center" onClick={(event) => { event.originalEvent.stopPropagation(); setSelectedUnit(unit); }}><button className={`unit-map-marker ${unit.operational_status}`} aria-label={`Abrir ${unit.name}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setUnitContext({ unit, x: Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), y: Math.max(12, Math.min(event.clientY, window.innerHeight - 210)) }); }}><span /></button></Marker>)}
            {selectedUnit && <Popup longitude={Number(selectedUnit.longitude)} latitude={Number(selectedUnit.latitude)} anchor="bottom" closeButton={false} offset={18} onClose={() => setSelectedUnit(null)}><div className="unit-map-popup"><span className={`status ${selectedUnit.operational_status}`}>{statusLabel[selectedUnit.operational_status]}</span><strong>{selectedUnit.name}</strong><small>{selectedUnit.code} · {selectedUnit.city}/{selectedUnit.state_code}</small><button onClick={() => setDetailUnit(selectedUnit)}>Abrir unidade</button></div></Popup>}
          </Map>
          {!mapReady && <div className="state-map-loading" role="status"><span className="loading-pulse" /> Preparando mapa operacional…</div>}
          {!locatedUnits.length && <div className="state-map-empty">{pendingUnits[0] ? <button type="button" className="state-map-empty-action" aria-label="Adicionar localização" onClick={() => { onClose(); onLocateUnit(pendingUnits[0].unit_id); }}>+</button> : <span>+</span>}<strong>Localização ainda não informada</strong><small>Cadastre latitude e longitude nas unidades para exibir os pontos exatos.</small></div>}
          {mapFallback && <div className="state-map-provider-note">Mapa dark otimizado · carregamento rápido</div>}
        </div>
        <aside className="state-map-units state-links-panel"><div className="state-links-heading"><h3>Links Ativos</h3><span>{units.filter((unit) => unit.operational_status === 'online').length}/{units.length}</span></div>{units.length === 0 ? <div className="state-map-list-empty">Nenhuma unidade cadastrada.</div> : units.map((unit) => { const located = locatedUnits.includes(unit); return <LinkTelemetryCard key={unit.unit_id} unit={unit} link={telemetryByUnit.get(unit.unit_id)?.[0]} located={located} diagnosticLatencyMs={diagnosticLatencyByUnit[unit.unit_id]} onView={() => located ? setSelectedUnit(unit) : (onClose(), onLocateUnit(unit.unit_id))} onContext={(event) => { event.preventDefault(); event.stopPropagation(); setUnitContext({ unit, x: Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), y: Math.max(12, Math.min(event.clientY, window.innerHeight - 210)) }); }} />; })}{pendingUnits.length > 0 && <p className="state-map-pending-note">Use LOCAL para adicionar as coordenadas da unidade.</p>}</aside>
      </div>
      <footer className="state-map-footer"><span><i className="legend-dot online" /> Operacional</span><span><i className="legend-dot degraded" /> Atenção</span><span><i className="legend-dot offline" /> Indisponível</span><span><i className="legend-dot unknown" /> Sem telemetria</span><small>Mapa dark · OpenFreeMap / OpenStreetMap</small></footer>
      {unitContext && <div className="map-context-card map-unit-context-card" style={{ left: unitContext.x, top: unitContext.y }} onMouseDown={(event) => event.stopPropagation()}><button className="map-context-close" aria-label="Fechar menu" onClick={() => setUnitContext(null)}>×</button><p>AÇÃO RÁPIDA · UNIDADE</p><strong>{unitContext.unit.name}</strong><small>{unitContext.unit.code} · {unitContext.unit.city}/{unitContext.unit.state_code}</small><button className="context-action" onClick={() => void runDiagnostic(unitContext.unit, 'ping')}>⌁ Ping</button><button className="context-action" onClick={() => void runDiagnostic(unitContext.unit, 'tracert')}>↝ Tracert</button><button className="primary compact" onClick={() => { setUnitContext(null); onAddEquipment(unitContext.unit); }}>+ Adicionar equipamento</button></div>}
      {diagnostic && <div className="diagnostic-float" role="status"><div className="diagnostic-float-head"><div><p className="eyebrow">DIAGNÓSTICO EM TEMPO REAL · {diagnostic.action === 'ping' ? 'PING' : 'TRACERT'}</p><strong>{diagnostic.unit.name}</strong><small>{diagnostic.unit.code} · alvo {diagnostic.result?.target ?? 'endereço de gerenciamento'}</small></div><button aria-label="Fechar diagnóstico" onClick={() => setDiagnostic(null)}>×</button></div><div className={`diagnostic-state ${diagnostic.status}`}>{diagnostic.status === 'running' ? 'Executando diagnóstico… aguardando resposta do equipamento.' : diagnostic.status === 'error' ? diagnostic.message : diagnostic.result?.success ? 'Concluído com resposta positiva.' : 'Concluído; o alvo não respondeu.'}</div>{diagnostic.status !== 'running' && <pre>{diagnostic.result?.output ?? diagnostic.message}</pre>}<button className="diagnostic-close" onClick={() => setDiagnostic(null)}>Fechar painel</button></div>}
      {detailUnit && <LinkAnalysisPanel unit={detailUnit} link={telemetryByUnit.get(detailUnit.unit_id)?.[0]} alerts={alerts} diagnosticLatencyMs={diagnosticLatencyByUnit[detailUnit.unit_id]} onClose={() => setDetailUnit(null)} onOpenInventory={() => { onClose(); onSelectUnit(detailUnit.unit_id); }} />}
    </section>
  </div>;
}

function LocalRegionalMap({ stateCode, units, selectedUnit, onSelectUnit }: { stateCode: string; units: Unit[]; selectedUnit: Unit | null; onSelectUnit: (unit: Unit) => void }) {
  const [zoom, setZoom] = useState(1);
  const locations = brazilMap.locations as Array<{ id: string; name: string; path: string }>;
  const locatedUnits = units.filter((unit) => unit.latitude !== null && unit.longitude !== null && Number.isFinite(Number(unit.latitude)) && Number.isFinite(Number(unit.longitude)));
  const toSvgPoint = (unit: Unit) => ({ x: Math.max(4, Math.min(609, ((Number(unit.longitude) + 74) / 40) * 613)), y: Math.max(4, Math.min(635, ((5 - Number(unit.latitude)) / 39) * 639)) });
  return <div className="offline-map-shell"><div className="offline-map-controls"><button onClick={() => setZoom((value) => Math.min(2.6, value + .25))} aria-label="Aumentar zoom">+</button><button onClick={() => setZoom((value) => Math.max(1, value - .25))} aria-label="Reduzir zoom">−</button><span>MAPA LOCAL</span></div><svg className="offline-regional-map" viewBox={brazilMap.viewBox} role="img" aria-label={`Mapa local de ${stateNameByCode[stateCode] ?? stateCode}`}><g transform={`translate(${(613 - 613 * zoom) / 2} ${(639 - 639 * zoom) / 2}) scale(${zoom})`}>{locations.map((location) => { const code = location.id.toUpperCase(); return <path key={code} d={location.path} className={`offline-state ${code === stateCode ? 'selected' : ''}`} />; })}{locatedUnits.map((unit) => { const point = toSvgPoint(unit); return <g key={unit.unit_id} className="offline-unit-marker" onClick={() => onSelectUnit(unit)} transform={`translate(${point.x} ${point.y})`}><circle className={unit.operational_status} r="7" /><circle className="offline-unit-core" r="2.5" /></g>; })}</g></svg>{selectedUnit && <div className="offline-map-popup"><span className={`status ${selectedUnit.operational_status}`}>{statusLabel[selectedUnit.operational_status]}</span><strong>{selectedUnit.name}</strong><small>{selectedUnit.code} · {selectedUnit.city}/{selectedUnit.state_code}</small><button onClick={() => onSelectUnit(selectedUnit)}>Selecionado</button></div>}<div className="offline-map-caption">Mapa operacional local · marcadores usam coordenadas cadastradas</div></div>;
}

function OperationalOverview({ units, equipment, alerts, resolvedAlerts, summary, onSelectUnit }: { units: Unit[]; equipment: Equipment[]; alerts: Alert[]; resolvedAlerts: Alert[]; summary: { online: number; attention: number; offline: number; unknown: number }; onSelectUnit: (unitId: string) => void }) {
  const [cardIndex, setCardIndex] = useState(0);
  const [historyClearedAt, setHistoryClearedAt] = useState(0);
  const cards = [
    { id: 'ranking' as const, eyebrow: 'EVENTOS E INCIDENTES', title: 'Ranking de problemas', subtitle: 'Prioridade por severidade e tempo em aberto.' },
    { id: 'history' as const, eyebrow: 'HISTÓRICO OPERACIONAL', title: 'Problemas registrados', subtitle: 'Ocorrências resolvidas na janela operacional.' },
    { id: 'coverage' as const, eyebrow: 'VISÃO OPERACIONAL', title: 'Cobertura de monitoramento', subtitle: 'Prontidão dos ativos cadastrados.' },
  ];
  const card = cards[cardIndex];
  const historyAlerts = resolvedAlerts.filter((alert) => new Date(alert.resolved_at ?? alert.opened_at).getTime() > historyClearedAt);
  const totalUnits = units.length || 1;
  const totalEquipment = equipment.length || 1;
  useEffect(() => { const interval = window.setInterval(() => setHistoryClearedAt(Date.now()), 30 * 60 * 1000); return () => window.clearInterval(interval); }, []);
  return <article className="ranking-panel operational-overview">
    <div className="panel-heading">
      <div><p className="eyebrow">{card.eyebrow}</p><h2>{card.title}</h2><small>{card.subtitle}</small></div>
      <div className="overview-heading-actions">
        <span className={`problem-count ${card.id === 'history' ? 'overview-count' : ''}`}>{card.id === 'ranking' ? `${alerts.length} em alerta` : card.id === 'history' ? `${historyAlerts.length} registrados` : `${equipment.length} ativos`}</span>
        <div className="overview-switcher" aria-label="Navegar entre cards operacionais"><button className="overview-nav-button" onClick={() => setCardIndex((index) => (index - 1 + cards.length) % cards.length)} aria-label="Card anterior">&lt;</button><span>{cardIndex + 1}/{cards.length}</span><button className="overview-nav-button" onClick={() => setCardIndex((index) => (index + 1) % cards.length)} aria-label="Próximo card">&gt;</button></div>
      </div>
    </div>
    {card.id === 'ranking' && <div className="problem-list">{alerts.length === 0 ? <div className="ranking-empty"><span>✓</span><strong>Operação estável</strong><small>Nenhum problema ativo requer ação.</small></div> : alerts.slice(0, 5).map((alert, index) => { const linkedUnit = units.find((unit) => unit.code === alert.unit_code); return <button className={`problem-row severity-${alert.severity}`} key={alert.id} onClick={() => linkedUnit && onSelectUnit(linkedUnit.unit_id)}><span className="problem-rank">#{index + 1}</span><div><strong>{alert.title}</strong><small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'}</small></div><span className={`status ${alert.status === 'acknowledged' ? 'degraded' : 'offline'}`}>{alert.status === 'acknowledged' ? 'Reconhecido' : 'Crítico'}</span></button>})}</div>}
    {card.id === 'history' && <div className="history-card-body"><div className="history-toolbar"><span>Janela móvel · limpa automaticamente a cada 30 min</span><button className="history-clear" onClick={() => setHistoryClearedAt(Date.now())}>Limpar lista</button></div><div className="problem-list history-list">{historyAlerts.length === 0 ? <div className="ranking-empty"><span>✓</span><strong>Nenhum problema registrado</strong><small>Problemas resolvidos aparecerão nesta janela.</small></div> : historyAlerts.slice(0, 5).map((alert, index) => { const linkedUnit = units.find((unit) => unit.code === alert.unit_code); return <button className={`problem-row history-row severity-${alert.severity}`} key={alert.id} onClick={() => linkedUnit && onSelectUnit(linkedUnit.unit_id)}><span className="problem-rank">#{index + 1}</span><div><strong>{alert.title}</strong><small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'} · {new Date(alert.resolved_at ?? alert.opened_at).toLocaleTimeString('pt-BR')}</small></div><span className="status online">Resolvido</span></button>})}</div></div>}
    {card.id === 'coverage' && <div className="overview-card-body"><OverviewStatusRow label="Ativos cadastrados" value={equipment.length} total={totalEquipment} tone="online" note="equipamentos no inventário" /><OverviewStatusRow label="Com telemetria" value={equipment.filter((item) => item.operational_status !== 'unknown').length} total={totalEquipment} tone="cyan" note="com leitura operacional" /><OverviewStatusRow label="Sem telemetria" value={equipment.filter((item) => item.operational_status === 'unknown').length} total={totalEquipment} tone="unknown" note="aguardando coleta válida" /><OverviewStatusRow label="Unidades operacionais" value={summary.online} total={totalUnits} tone={summary.online ? 'online' : 'unknown'} note={summary.online ? 'respondendo normalmente' : 'nenhuma unidade operacional'} /></div>}
  </article>;
}

function OverviewStatusRow({ label, value, total, tone, note }: { label: string; value: number; total: number; tone: string; note: string }) {
  const percentage = Math.min(100, Math.round((value / total) * 100));
  return <div className="overview-status-row"><div className="overview-status-copy"><div><strong>{label}</strong><span className={`overview-status-value ${tone}`}>{value}</span></div><small>{note}</small></div><div className="overview-status-track"><span className={tone} style={{ width: `${percentage}%` }} /></div><small className="overview-status-percent">{percentage}%</small></div>;
}

function CommandMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  const icon = label === 'Online' ? 'online' : label === 'Offline' ? 'offline' : label === 'Degradadas' ? 'degraded' : label.startsWith('Disponibilidade') ? 'availability' : label.startsWith('Alertas') ? 'alert' : 'units';
  return <article className={`command-metric ${tone}`}><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div><CommandMetricIcon type={icon} /></article>;
}

function CommandMetricIcon({ type }: { type: string }) {
  return <svg className="command-metric-icon" viewBox="0 0 120 90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    {type === 'units' && <><path d="M13 31h58v39H13zM71 44h20l16 15v11H71z" /><circle cx="31" cy="73" r="9" /><circle cx="88" cy="73" r="9" /><path d="M79 44v17h27" /></>}
    {type === 'online' && <><path d="M18 34c25-23 59-23 84 0M31 49c17-15 41-15 58 0M45 63c9-8 21-8 30 0" /><circle cx="60" cy="76" r="5" fill="currentColor" stroke="none" /></>}
    {type === 'offline' && <><path d="M18 39h18l22-17v48L36 55H18zM75 35l29 29M104 35L75 64" /><path d="M12 13l96 66" /></>}
    {type === 'degraded' && <><path d="M32 66h56c-8-8-10-18-10-31 0-12-8-23-18-23S42 23 42 35c0 13-2 23-10 31z" /><path d="M51 74c2 8 16 8 18 0" /></>}
    {type === 'availability' && <><rect x="12" y="13" width="96" height="58" rx="5" /><path d="M23 46h17l8-17 13 31 10-21 8 7h18M46 80h28" /></>}
    {type === 'alert' && <><path d="M60 10 108 78H12L60 10z" /><path d="M60 34v22M60 68h.1" /></>}
  </svg>;
}

function InventoryActions({ token, units, selectedUnit, onRefresh, onError }: { token: string; units: Unit[]; selectedUnit?: Unit; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
  const [mode, setMode] = useState<'unit' | 'equipment' | null>(null);
  return <>{!selectedUnit && <div className="admin-toolbar"><div><p className="eyebrow">ADMINISTRAÇÃO DE INVENTÁRIO</p><strong>Cadastre a estrutura antes de vincular ao Zabbix.</strong></div><button className="primary compact" onClick={() => setMode('unit')}>+ Cadastrar unidade</button></div>}{selectedUnit && <div className="admin-toolbar"><div><p className="eyebrow">UNIDADE SELECIONADA · {selectedUnit.code}</p><strong>{selectedUnit.name}</strong></div><button className="primary compact" onClick={() => setMode('equipment')}>+ Cadastrar equipamento</button></div>}{mode === 'unit' && <UnitForm token={token} onCreated={async () => { setMode(null); await onRefresh(); }} onCancel={() => setMode(null)} onError={onError} />}{mode === 'equipment' && selectedUnit && <EquipmentForm token={token} unit={selectedUnit} onCreated={async () => { setMode(null); await onRefresh(); }} onCancel={() => setMode(null)} onError={onError} />}</>;
}

function FormCard({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onCancel]);
  return <div className="form-modal-backdrop" role="presentation" onMouseDown={onCancel}><article className="form-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">CADASTRO OPERACIONAL</p><h3>{title}</h3></div><button className="icon-button" onClick={onCancel} aria-label="Fechar formulário">×</button></div>{children}</article></div>;
}

function UnitFormLegacy({ token, onCreated, onCancel, onError = () => undefined }: { token: string; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void }) {
  const [form, setForm] = useState({ code: '', name: '', stateCode: '', city: '' }); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await api('/v1/units', token, { method: 'POST', body: JSON.stringify(form) }); await onCreated(); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar unidade.'); } finally { setSaving(false); } }
  return <FormCard title="Nova unidade móvel" onCancel={onCancel}><form className="inline-form" onSubmit={submit}><label>Código<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="UMS-011" /></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unidade Móvel Manaus" /></label><label>UF<input required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} placeholder="AM" /></label><label>Cidade<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Manaus" /></label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar unidade'}</button></div></form></FormCard>;
}

function UnitForm({ token, initialStateCode = '', onCreated, onCancel, onError = () => undefined }: { token: string; initialStateCode?: string; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void }) {
  const [form, setForm] = useState({ code: '', name: '', stateCode: initialStateCode.toUpperCase(), city: '', latitude: '', longitude: '' });
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationRequested, setValidationRequested] = useState(false);
  const validState = brazilStateCodes.includes(form.stateCode.trim().toUpperCase());
  const hasLatitude = Boolean(form.latitude.trim());
  const hasLongitude = Boolean(form.longitude.trim());
  const validCoordinates = (!hasLatitude && !hasLongitude) || (hasLatitude && hasLongitude && Number.isFinite(Number(form.latitude)) && Number(form.latitude) >= -90 && Number(form.latitude) <= 90 && Number.isFinite(Number(form.longitude)) && Number(form.longitude) >= -180 && Number(form.longitude) <= 180);
  const unitValidation = { code: !form.code.trim(), name: !form.name.trim(), stateCode: !validState, city: !form.city.trim(), coordinates: !validCoordinates };
  useEffect(() => {
    const state = form.stateCode.trim().toUpperCase();
    if (!brazilStateCodes.includes(state)) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${state}`)
      .then((response) => response.ok ? response.json() as Promise<Array<{ nome: string }>> : Promise.reject(new Error('city catalog unavailable')))
      .then((items) => setCities(items.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))))
      .catch(() => setCities([capitalByState[state]]))
      .finally(() => setLoadingCities(false));
  }, [form.stateCode]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setValidationRequested(true);
    if (Object.values(unitValidation).some(Boolean)) return;
    setSaving(true);
    try {
      await api('/v1/units', token, { method: 'POST', body: JSON.stringify({ code: form.code, name: form.name, stateCode: form.stateCode.toUpperCase(), city: form.city, latitude: form.latitude.trim() ? Number(form.latitude) : undefined, longitude: form.longitude.trim() ? Number(form.longitude) : undefined }) });
      await onCreated();
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar unidade.'); }
    finally { setSaving(false); }
  }
  return <FormCard title="Nova unidade móvel" onCancel={onCancel}><form className="inline-form validated-form" noValidate onSubmit={submit}>
    <div className="required-fields-note"><strong>Dados da unidade</strong><small>Os campos marcados com <b>*</b> são obrigatórios.</small></div>
    <label><span className="field-label">Código <b>*</b></span><input required className={validationRequested && unitValidation.code ? 'field-invalid' : ''} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex.: UMS-011" />{validationRequested && unitValidation.code && <small className="field-error">Informe o código da unidade.</small>}</label>
    <label><span className="field-label">Nome <b>*</b></span><input required className={validationRequested && unitValidation.name ? 'field-invalid' : ''} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Unidade Móvel Manaus" />{validationRequested && unitValidation.name && <small className="field-error">Informe o nome da unidade.</small>}</label>
    <label><span className="field-label">UF <b>*</b></span><GlassCombobox value={form.stateCode} options={brazilStateCodes.map((code) => ({ value: code, label: stateNameByCode[code] }))} onChange={(value) => setForm({ ...form, stateCode: value.toUpperCase().slice(0, 2), city: '' })} placeholder="Escolha ou digite a UF" invalid={validationRequested && unitValidation.stateCode} compact />{validationRequested && unitValidation.stateCode && <small className="field-error">Selecione ou informe uma UF válida.</small>}</label>
    <label><span className="field-label">Cidade <b>*</b></span><GlassCombobox value={form.city} options={cities.map((city) => ({ value: city, label: city }))} onChange={(value) => setForm({ ...form, city: value })} placeholder={loadingCities ? 'Carregando cidades…' : 'Escolha ou digite a cidade'} invalid={validationRequested && unitValidation.city} disabled={!validState || loadingCities} />{validationRequested && unitValidation.city ? <small className="field-error">Selecione ou informe a cidade.</small> : <small className="field-hint">{loadingCities ? 'Consultando municípios da UF…' : cities.length ? `${cities.length} cidades disponíveis para ${form.stateCode}` : 'Informe uma UF válida para carregar as cidades.'}</small>}</label>
    <div className="location-fields" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}><label><span className="field-label">Latitude <em>opcional</em></span><input inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-3.1186" />{validationRequested && unitValidation.coordinates && <small className="field-error">Informe latitude entre -90 e 90.</small>}</label><label><span className="field-label">Longitude <em>opcional</em></span><input inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-60.0217" />{validationRequested && unitValidation.coordinates && <small className="field-error">Informe longitude entre -180 e 180.</small>}</label></div>
    <small className="field-hint location-hint">Você pode informar a localização agora ou adicioná-la depois pelo mapa.</small>
    <div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar unidade'}</button></div>
  </form></FormCard>;
}

function UnitFormWithoutLocation({ token, initialStateCode = '', onCreated, onCancel, onError = () => undefined }: { token: string; initialStateCode?: string; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void }) {
  const [form, setForm] = useState({ code: '', name: '', stateCode: initialStateCode.toUpperCase(), city: '', latitude: '', longitude: '' });
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationRequested, setValidationRequested] = useState(false);
  const unitValidation = {
    code: !form.code.trim(),
    name: !form.name.trim(),
    stateCode: !brazilStateCodes.includes(form.stateCode.trim().toUpperCase()),
    city: !form.city.trim(),
  };
  useEffect(() => {
    const state = form.stateCode.trim().toUpperCase();
    if (!brazilStateCodes.includes(state)) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${state}`)
      .then((response) => response.ok ? response.json() as Promise<Array<{ nome: string }>> : Promise.reject(new Error('city catalog unavailable')))
      .then((items) => setCities(items.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))))
      .catch(() => setCities([capitalByState[state]]))
      .finally(() => setLoadingCities(false));
  }, [form.stateCode]);
  async function submit(event: FormEvent) { event.preventDefault(); setValidationRequested(true); if (Object.values(unitValidation).some(Boolean)) return; setSaving(true); try { await api('/v1/units', token, { method: 'POST', body: JSON.stringify({ code: form.code, name: form.name, stateCode: form.stateCode.toUpperCase(), city: form.city, latitude: form.latitude.trim() ? Number(form.latitude) : undefined, longitude: form.longitude.trim() ? Number(form.longitude) : undefined }) }); await onCreated(); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar unidade.'); } finally { setSaving(false); } }
  return <FormCard title="Nova unidade móvel" onCancel={onCancel}><form className="inline-form validated-form" noValidate onSubmit={submit}><div className="required-fields-note"><strong>Dados da unidade</strong><small>Os campos marcados com <b>*</b> são obrigatórios.</small></div><label><span className="field-label">Código <b>*</b></span><input required className={validationRequested && unitValidation.code ? 'field-invalid' : ''} aria-invalid={validationRequested && unitValidation.code} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex.: UMS-011" />{validationRequested && unitValidation.code && <small className="field-error">Informe o código da unidade.</small>}</label><label><span className="field-label">Nome <b>*</b></span><input required className={validationRequested && unitValidation.name ? 'field-invalid' : ''} aria-invalid={validationRequested && unitValidation.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Unidade Móvel Manaus" />{validationRequested && unitValidation.name && <small className="field-error">Informe o nome da unidade.</small>}</label><label><span className="field-label">UF <b>*</b></span><GlassCombobox value={form.stateCode} options={brazilStateCodes.map((code) => ({ value: code, label: stateNameByCode[code] }))} onChange={(value) => setForm({ ...form, stateCode: value.toUpperCase().slice(0, 2), city: '' })} placeholder="Escolha ou digite a UF" invalid={validationRequested && unitValidation.stateCode} compact />{validationRequested && unitValidation.stateCode && <small className="field-error">Selecione ou informe uma UF válida.</small>}</label><label><span className="field-label">Cidade <b>*</b></span><GlassCombobox value={form.city} options={cities.map((city) => ({ value: city, label: city }))} onChange={(value) => setForm({ ...form, city: value })} placeholder={loadingCities ? 'Carregando cidades…' : 'Escolha ou digite a cidade'} invalid={validationRequested && unitValidation.city} disabled={!form.stateCode || loadingCities} />{validationRequested && unitValidation.city ? <small className="field-error">Selecione ou informe a cidade.</small> : <small className="field-hint">{loadingCities ? 'Consultando municípios da UF…' : cities.length ? `${cities.length} cidades disponíveis para ${form.stateCode}` : 'Informe uma UF válida para carregar as cidades.'}</small>}</label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar unidade'}</button></div></form></FormCard>;
}

function GlassCombobox({ value, options, onChange, placeholder, invalid = false, disabled = false, compact = false }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; placeholder: string; invalid?: boolean; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const search = value.trim().toLocaleLowerCase('pt-BR');
  const hasExactSelection = options.some((option) => option.value.toLocaleLowerCase('pt-BR') === search);
  const filtered = options.filter((option) => !search || hasExactSelection || option.value.toLocaleLowerCase('pt-BR').includes(search) || option.label.toLocaleLowerCase('pt-BR').includes(search)).slice(0, compact ? 27 : 100);
  return <div className={`glass-combobox ${open ? 'open' : ''} ${invalid ? 'field-invalid' : ''}`}>
    <input value={value} disabled={disabled} aria-invalid={invalid} aria-expanded={open} role="combobox" autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') setOpen(true); }} placeholder={placeholder} />
    <button type="button" className="combobox-toggle" disabled={disabled} tabIndex={-1} aria-label={open ? 'Fechar opções' : 'Abrir opções'} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((current) => !current)}>{open ? '▴' : '▾'}</button>
    {open && !disabled && <div className="glass-options" role="listbox">{filtered.length ? filtered.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setOpen(false); }}><strong>{option.value}</strong>{option.label !== option.value && <small>{option.label}</small>}</button>) : <div className="combobox-empty">Nenhuma opção encontrada</div>}</div>}
  </div>;
}

function EquipmentForm({ token, unit, onCreated, onCancel, onError = () => undefined }: { token: string; unit: Unit; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void }) {
  const [form, setForm] = useState({ equipmentTypeCode: 'linux_server', name: '', serialNumber: '', managementAddress: '', contractedDownloadMbps: '', contractedUploadMbps: '' }); const [saving, setSaving] = useState(false); const [validationRequested, setValidationRequested] = useState(false);
  const linkFieldsVisible = isLinkEquipmentType(form.equipmentTypeCode);
  const equipmentValidation = { type: !form.equipmentTypeCode, name: !form.name.trim(), contractedDownloadMbps: Boolean(form.contractedDownloadMbps) && Number(form.contractedDownloadMbps) <= 0, contractedUploadMbps: Boolean(form.contractedUploadMbps) && Number(form.contractedUploadMbps) <= 0 };
  async function submit(event: FormEvent) { event.preventDefault(); setValidationRequested(true); if (Object.values(equipmentValidation).some(Boolean)) return; setSaving(true); try { await api(`/v1/units/${unit.unit_id}/equipment`, token, { method: 'POST', body: JSON.stringify({ equipmentTypeCode: form.equipmentTypeCode, name: form.name, serialNumber: form.serialNumber || undefined, managementAddress: form.managementAddress || undefined, contractedDownloadMbps: linkFieldsVisible && form.contractedDownloadMbps ? Number(form.contractedDownloadMbps) : undefined, contractedUploadMbps: linkFieldsVisible && form.contractedUploadMbps ? Number(form.contractedUploadMbps) : undefined }) }); await onCreated(); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar equipamento.'); } finally { setSaving(false); } }
  return <FormCard title={`Novo equipamento · ${unit.name}`} onCancel={onCancel}><form className="inline-form validated-form" noValidate onSubmit={submit}><div className="required-fields-note"><strong>Dados do equipamento</strong><small>Os campos marcados com <b>*</b> são obrigatórios.</small></div><label><span className="field-label">Tipo <b>*</b></span><select required className={validationRequested && equipmentValidation.type ? 'field-invalid' : ''} aria-invalid={validationRequested && equipmentValidation.type} value={form.equipmentTypeCode} onChange={(e) => setForm({ ...form, equipmentTypeCode: e.target.value })}><option value="linux_server">Servidor Linux</option><option value="mikrotik">Mikrotik</option><option value="starlink">Starlink</option><option value="vpn">VPN</option><option value="internet_link">Link de internet</option></select>{validationRequested && equipmentValidation.type && <small className="field-error">Selecione o tipo do equipamento.</small>}</label><label><span className="field-label">Nome <b>*</b></span><input required className={validationRequested && equipmentValidation.name ? 'field-invalid' : ''} aria-invalid={validationRequested && equipmentValidation.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Mikrotik - UMS-011" />{validationRequested && equipmentValidation.name && <small className="field-error">Informe o nome do equipamento.</small>}</label><label><span className="field-label">Endereço de gerenciamento <em>opcional</em></span><input value={form.managementAddress} onChange={(e) => setForm({ ...form, managementAddress: e.target.value })} placeholder="10.0.0.50" /></label><label><span className="field-label">Número de série <em>opcional</em></span><input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>{linkFieldsVisible && <><div className="bandwidth-fields-note"><strong>Plano contratado</strong><small>Informe somente valores confirmados pelo contrato/provedor. Em branco será exibido como N/D.</small></div><label><span className="field-label">Download contratado <em>Mbps · opcional</em></span><input type="number" min="0.001" max="1000000" step="0.001" className={validationRequested && equipmentValidation.contractedDownloadMbps ? 'field-invalid' : ''} value={form.contractedDownloadMbps} onChange={(e) => setForm({ ...form, contractedDownloadMbps: e.target.value })} placeholder="Ex.: 500" />{validationRequested && equipmentValidation.contractedDownloadMbps && <small className="field-error">Informe um valor maior que zero.</small>}</label><label><span className="field-label">Upload contratado <em>Mbps · opcional</em></span><input type="number" min="0.001" max="1000000" step="0.001" className={validationRequested && equipmentValidation.contractedUploadMbps ? 'field-invalid' : ''} value={form.contractedUploadMbps} onChange={(e) => setForm({ ...form, contractedUploadMbps: e.target.value })} placeholder="Ex.: 250" />{validationRequested && equipmentValidation.contractedUploadMbps && <small className="field-error">Informe um valor maior que zero.</small>}</label></>}<div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar equipamento'}</button></div></form></FormCard>;
}

function syncStatusLabel(status: ZabbixSyncStatus | null) {
  const health = status?.health_status ?? 'unknown';
  return health === 'healthy' ? 'Zabbix sincronizado' : health === 'unavailable' ? 'Zabbix indisponível' : health === 'degraded' ? 'Zabbix em atenção' : 'Zabbix aguardando coleta';
}

function SyncStatusButton({ status, onClick }: { status: ZabbixSyncStatus | null; onClick: () => void }) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const health = status?.health_status ?? 'unknown';
  const lastAttempt = status?.last_attempt_at ? new Date(status.last_attempt_at).getTime() : 0;
  const nextSync = lastAttempt ? Math.max(0, 60_000 - (Date.now() - lastAttempt)) : 60_000;
  const seconds = Math.ceil(nextSync / 1000);
  return <button type="button" className={`sidebar-sync-button integration-${health}`} onClick={onClick} title="Abrir status da integração e ponte de hosts">
    <span className="sidebar-status-main"><span className="pulse" /><strong>{syncStatusLabel(status)}</strong><span className="sidebar-status-arrow">›</span></span>
    <small>{status?.last_success_at ? `última coleta · ${new Date(status.last_success_at).toLocaleTimeString('pt-BR')}` : 'nenhuma coleta confirmada'}</small>
    <small className="sidebar-countdown">próxima sincronização · {seconds}s</small>
  </button>;
}

function ConnectionStatus({ integrationStatus, onRefresh, onOpenZabbix }: { integrationStatus: ZabbixSyncStatus | null; onRefresh: () => Promise<void>; onOpenZabbix: () => void }) {
  const health = integrationStatus?.health_status ?? 'unknown';
  const healthLabel = health === 'healthy' ? 'Operacional' : health === 'degraded' ? 'Em atenção' : health === 'unavailable' ? 'Indisponível' : 'Aguardando coleta';
  const lastSuccess = integrationStatus?.last_success_at ? new Date(integrationStatus.last_success_at).toLocaleString('pt-BR') : 'Ainda não registrada';
  return <section className="connections-page">
    <div className="section-heading"><div><p className="eyebrow">INFRAESTRUTURA · CONECTIVIDADE</p><h2>Status das conexões</h2><small>Saúde técnica das integrações externas separada da visão operacional.</small></div><button className="secondary-button" onClick={() => void onRefresh()}>Atualizar status</button></div>
    <div className="connection-overview"><div><span className={`connection-orbit ${health}`}><i /></span><div><p className="eyebrow">ESTADO CONSOLIDADO</p><strong>{healthLabel}</strong><small>{health === 'healthy' ? 'Todos os serviços configurados estão respondendo.' : 'Verifique os detalhes técnicos abaixo.'}</small></div></div><span className={`connection-badge ${health}`}>{healthLabel}</span></div>
    <div className="connections-grid">
      <article className={`connection-card ${health}`}>
        <header><div className="connection-logo">Z</div><div><p>ZABBIX</p><h3>Monitoramento e eventos</h3></div><span className={`health-indicator ${health}`} /></header>
        <div className="connection-data"><div><span>Última coleta válida</span><strong>{lastSuccess}</strong><small className="metric-hover-detail">Momento em que o Zabbix respondeu com dados válidos para o HealthLink.</small></div><div><span>Duração da coleta</span><strong>{integrationStatus?.duration_ms != null ? `${integrationStatus.duration_ms} ms` : '—'}</strong><small className="metric-hover-detail">Tempo total da última consulta à API do Zabbix.</small></div><div><span>Hosts encontrados</span><strong>{integrationStatus?.hosts_seen ?? 0}</strong><small className="metric-hover-detail">Quantidade de hosts retornados pelo catálogo do Zabbix.</small></div><div><span>Hosts vinculados</span><strong>{integrationStatus?.mapped_hosts ?? 0}</strong><small className="metric-hover-detail">Hosts associados a equipamentos e unidades dentro do HealthLink.</small></div><div><span>Problemas recebidos</span><strong>{integrationStatus?.problems_seen ?? 0}</strong><small className="metric-hover-detail">Eventos ativos importados na última sincronização.</small></div><div><span>Falhas consecutivas</span><strong>{integrationStatus?.consecutive_failures ?? 0}</strong><small className="metric-hover-detail">Consultas consecutivas sem resposta válida. Quanto maior, maior o risco de indisponibilidade.</small></div></div>
        {integrationStatus?.last_error && <div className="connection-error"><span>ÚLTIMA FALHA</span><p>{integrationStatus.last_error}</p></div>}
        <footer><small>Coleta automática ativa</small><button className="secondary-button compact" onClick={onOpenZabbix}>Gerenciar integração</button></footer>
      </article>
      <article className="connection-placeholder"><span>+</span><h3>Próxima integração</h3><p>Esta área está preparada para concentrar novos serviços, links e conectores corporativos.</p></article>
    </div>
  </section>;
}

function ZabbixStatusPanel({ status, onRefresh }: { status: ZabbixSyncStatus | null; onRefresh: () => Promise<void> }) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const health = status?.health_status ?? 'unknown';
  const lastSuccess = status?.last_success_at ? new Date(status.last_success_at).toLocaleString('pt-BR') : 'Ainda não registrada';
  const lastAttempt = status?.last_attempt_at ? new Date(status.last_attempt_at).getTime() : 0;
  const seconds = Math.ceil(Math.max(0, 60_000 - (Date.now() - lastAttempt)) / 1000);
  return <article className={`zabbix-status-panel ${health}`}>
    <div className="zabbix-status-heading"><span className="connection-logo">Z</span><div><p className="eyebrow">STATUS DE CONEXÕES</p><h3>{syncStatusLabel(status)}</h3><small>Última coleta válida · {lastSuccess}</small></div><span className={`health-indicator ${health}`} /><button className="secondary-button compact" onClick={() => void onRefresh()}>Atualizar</button></div>
    <div className="zabbix-status-metrics"><div><span>Hosts encontrados</span><strong>{status?.hosts_seen ?? 0}</strong></div><div><span>Hosts vinculados</span><strong>{status?.mapped_hosts ?? 0}</strong></div><div><span>Problemas recebidos</span><strong>{status?.problems_seen ?? 0}</strong></div><div><span>Próxima sincronização</span><strong>{lastAttempt ? `${seconds}s` : 'aguardando'}</strong></div></div>
  </article>;
}

function ZabbixIntegration({ candidates, integrationStatus, units, loading, onRefresh, onStatusRefresh, onInventoryRefresh, onAlertsRefresh, onError, token }: { candidates: ZabbixCandidates | null; integrationStatus: ZabbixSyncStatus | null; units: Unit[]; loading: boolean; onRefresh: () => Promise<void>; onStatusRefresh: () => Promise<void>; onInventoryRefresh: () => Promise<void>; onAlertsRefresh: () => Promise<void>; onError: (message: string) => void; token: string }) {
  const [hostSearch, setHostSearch] = useState(''); const [selectedHost, setSelectedHost] = useState(''); const [selectedEquipment, setSelectedEquipment] = useState(''); const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const mappings = candidates?.mappings ?? []; const filteredHosts = (candidates?.hosts ?? []).filter((host) => `${host.name} ${host.host} ${host.hostid}`.toLowerCase().includes(hostSearch.toLowerCase()));
  // `Map` é também o componente React-MapLibre importado acima; use o construtor global explicitamente.
  const linkedEquipment = new globalThis.Map(mappings.map((mapping) => [mapping.zabbix_host_id, mapping.equipment_id]));
  const currentHost = candidates?.hosts.find((host) => host.hostid === selectedHost);
  const currentMapping = mappings.find((mapping) => mapping.zabbix_host_id === selectedHost);
  const currentEquipment = candidates?.equipment.find((item) => item.id === currentMapping?.equipment_id);
  const currentUnit = units.find((unit) => unit.unit_id === currentEquipment?.unit_id);
  const selectedEquipmentMapping = mappings.find((mapping) => mapping.equipment_id === selectedEquipment);
  const selectedEquipmentHost = candidates?.hosts.find((host) => host.hostid === selectedEquipmentMapping?.zabbix_host_id);
  const hostText = currentHost ? `${currentHost.name} ${currentHost.host}`.toUpperCase() : '';
  const suggestedUnit = units.find((unit) => new RegExp(`\\b${unit.code.replace('-', '[\\s-]?')}\\b`, 'i').test(hostText));
  const suggestedType = hostText.includes('MIKROTIK') ? 'mikrotik' : hostText.includes('STARLINK') ? 'starlink' : hostText.includes('VPN') ? 'vpn' : hostText.includes('LINUX') || hostText.includes('SERVER') ? 'linux_server' : hostText.includes('LINK') || hostText.includes('INTERNET') ? 'internet_link' : '';
  const normalizeMatch = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedHostName = normalizeMatch(currentHost?.name ?? currentHost?.host ?? '');
  // Primeiro tentamos o nome exato (ex.: "IPSec - HPS 28"); depois usamos
  // unidade + tipo como fallback para hosts padronizados (UMS-001, etc.).
  const suggestedEquipment = candidates?.equipment.find((item) => {
    const equipmentName = normalizeMatch(item.name);
    return Boolean(normalizedHostName && equipmentName === normalizedHostName);
  }) ?? (suggestedUnit && suggestedType ? candidates?.equipment.find((item) => item.unit_id === suggestedUnit.unit_id && item.equipment_type === suggestedType) : undefined);
  useEffect(() => {
    if (!selectedHost) return;
    if (currentMapping) setSelectedEquipment(currentMapping.equipment_id);
    else setSelectedEquipment(suggestedEquipment?.id ?? '');
  }, [selectedHost, currentMapping?.equipment_id, suggestedEquipment?.id]);
  const unchanged = Boolean(currentMapping && currentMapping.equipment_id === selectedEquipment);
  async function refreshAfterChange() { await Promise.all([onRefresh(), onInventoryRefresh()]); }
  async function link() {
    if (!selectedHost || !selectedEquipment || unchanged) return;
    if (selectedEquipmentMapping && selectedEquipmentMapping.zabbix_host_id !== selectedHost) {
      const confirmed = window.confirm(`O equipamento já está ligado ao host "${selectedEquipmentHost?.name ?? selectedEquipmentMapping.zabbix_host_id}". Deseja mover o vínculo para "${currentHost?.name ?? selectedHost}"?`);
      if (!confirmed) return;
    }
    setSaving(true); onError('');
    try {
      await api('/v1/integrations/zabbix/mappings', token, { method: 'POST', body: JSON.stringify({ zabbixHostId: selectedHost, equipmentId: selectedEquipment }) });
      await refreshAfterChange();
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao salvar vínculo.'); }
    finally { setSaving(false); }
  }
  async function unlink() {
    if (!selectedHost || !currentMapping) return;
    if (!window.confirm(`Desvincular o host "${currentHost?.name ?? selectedHost}" de "${currentEquipment?.name ?? 'seu equipamento'}"? O histórico será preservado.`)) return;
    setSaving(true); onError('');
    try {
      await api(`/v1/integrations/zabbix/mappings/${encodeURIComponent(selectedHost)}`, token, { method: 'DELETE' });
      setSelectedEquipment('');
      await refreshAfterChange();
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao desvincular host.'); }
    finally { setSaving(false); }
  }
  async function synchronizeNow() {
    setSyncing(true); onError('');
    try {
      await api('/v1/integrations/zabbix/sync', token, { method: 'POST', body: '{}' });
      await Promise.all([onStatusRefresh(), onRefresh(), onInventoryRefresh(), onAlertsRefresh()]);
    } catch (reason) {
      await onStatusRefresh().catch(() => undefined);
      onError(reason instanceof Error ? reason.message : 'Falha ao sincronizar com o Zabbix.');
    } finally { setSyncing(false); }
  }
  return <section className="integration-page">
    <ZabbixStatusPanel status={integrationStatus} onRefresh={onStatusRefresh} />
    <div className="section-heading"><div><p className="eyebrow">INTEGRAÇÃO · ZABBIX</p><h2>Hosts e vínculos operacionais</h2><small>Associe cada host a um equipamento cadastrado e mantenha a unidade rastreável.</small></div><div className="section-actions"><button className="secondary-button" onClick={() => void onRefresh()}>{loading ? 'Atualizando…' : 'Atualizar hosts'}</button><button className="primary compact" disabled={syncing} onClick={() => void synchronizeNow()}>{syncing ? 'Sincronizando…' : 'Sincronizar agora'}</button></div></div>
    {!candidates && <div className="empty-state compact-empty"><span className="empty-glyph">↻</span><h3>{loading ? 'Consultando Zabbix…' : 'Nenhum catálogo carregado'}</h3><button className="primary" onClick={() => void onRefresh()}>Carregar hosts</button></div>}
    {candidates && <>
      <div className="integration-stats"><Metric label="Hosts encontrados" value={candidates.hosts.length} tone="neutral" /><Metric label="Já vinculados" value={mappings.length} tone="ok" /><Metric label="Pendentes" value={Math.max(candidates.hosts.length - mappings.length, 0)} tone="warn" /></div>
      <div className="host-bridge-heading"><div><p className="eyebrow">PONTE DE HOSTS</p><h3>Catálogo Zabbix e vínculos</h3><small>Selecione um host, escolha o equipamento correspondente e mantenha a unidade rastreável.</small></div><span>{mappings.length} vinculados</span></div>
      <div className="integration-grid">
        <article className="host-panel"><div className="panel-title"><div><p className="eyebrow">INVENTÁRIO DO ZABBIX</p><h3>Selecione um host</h3></div><strong>{filteredHosts.length}</strong></div><input className="search-input" value={hostSearch} onChange={(e) => setHostSearch(e.target.value)} placeholder="Buscar por nome ou ID…" /><div className="host-list">{filteredHosts.map((host) => { const hasCoordinates = Number.isFinite(Number(host.inventory?.location_lat)) && Number.isFinite(Number(host.inventory?.location_lon)); return <button key={host.hostid} className={`host-row ${selectedHost === host.hostid ? 'selected' : ''}`} onClick={() => setSelectedHost(host.hostid)}><span className={`host-status ${Number(host.status) === 0 ? 'online' : 'offline'}`} /><div><strong>{host.name || host.host}</strong><small>{host.host} · ID {host.hostid}{host.interfaces?.[0]?.ip ? ` · ${host.interfaces[0].ip}` : ''}{hasCoordinates ? ' · localização no inventário' : ''}</small></div><span className={`link-state ${linkedEquipment.has(host.hostid) ? 'linked' : ''}`}>{linkedEquipment.has(host.hostid) ? 'Vinculado' : 'Pendente'}</span></button>; })}</div></article>
        <article className="link-panel">
          <div className="panel-title"><div><p className="eyebrow">DESTINO DO VÍNCULO</p><h3>Equipamento do HealthLink</h3></div></div>
          <p className="muted">O host é associado ao equipamento; a unidade é herdada automaticamente.</p>
          {currentMapping && <div className="current-mapping"><span>VÍNCULO ATUAL</span><strong>{currentEquipment?.name ?? currentMapping.equipment_id}</strong><small>{currentUnit ? `${currentUnit.code} · ${currentUnit.name}` : 'Unidade não localizada no catálogo atual'}</small></div>}
          {!currentMapping && selectedHost && (suggestedUnit || suggestedType) && <button type="button" className={`suggestion-box suggestion-action ${suggestedEquipment && selectedEquipment === suggestedEquipment.id ? 'selected' : ''}`} disabled={!suggestedEquipment} aria-pressed={Boolean(suggestedEquipment && selectedEquipment === suggestedEquipment.id)} onClick={() => { if (suggestedEquipment) setSelectedEquipment(suggestedEquipment.id); }}><span>SUGESTÃO AUTOMÁTICA</span><strong>{suggestedEquipment?.name ?? (suggestedUnit ? `${suggestedUnit.code} · ${suggestedUnit.name}` : 'Unidade não identificada')}</strong><small>{suggestedEquipment ? `${suggestedEquipment.equipment_type.replaceAll('_', ' ')} · clique para selecionar` : suggestedType ? `Tipo detectado: ${suggestedType.replaceAll('_', ' ')} · confirme o equipamento manualmente.` : 'Confirme o equipamento manualmente.'}</small></button>}
          <select className="link-select" value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)} disabled={!selectedHost || saving}><option value="">Selecione um equipamento</option>{units.map((unit) => <optgroup key={unit.unit_id} label={`${unit.code} · ${unit.name}`}>{candidates.equipment.filter((item) => item.unit_id === unit.unit_id).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.equipment_type.replaceAll('_', ' ')}</option>)}</optgroup>)}</select>
          {selectedEquipmentMapping && selectedEquipmentMapping.zabbix_host_id !== selectedHost && <div className="mapping-warning"><strong>Este equipamento já possui um vínculo.</strong><small>Ao salvar, ele será movido do host {selectedEquipmentHost?.name ?? selectedEquipmentMapping.zabbix_host_id} para o host selecionado.</small></div>}
          <div className="link-context"><span>Host selecionado</span><strong>{selectedHost ? `${currentHost?.name ?? 'Host'}${currentHost?.interfaces?.[0]?.ip ? ` · ${currentHost.interfaces[0].ip}` : ''}` : 'Nenhum host selecionado'}</strong></div>
          <div className="mapping-actions"><button className="primary wide" disabled={!selectedHost || !selectedEquipment || saving || unchanged} onClick={() => void link()}>{saving ? 'Processando…' : unchanged ? 'Vínculo atual confirmado' : currentMapping ? 'Trocar vínculo' : 'Vincular host ao equipamento'}</button>{currentMapping && <button className="danger-button" disabled={saving} onClick={() => void unlink()}>Desvincular host</button>}</div>
          <div className="link-help"><span>Fluxo seguro</span><small>Host Zabbix → Equipamento → Unidade móvel · alterações auditadas</small></div>
        </article>
      </div>
    </>}
  </section>;
}

function UnitsView({ units, selectedUnit, selectedEquipment, loading, summary, onSelectUnit, onBack, onInventoryRefresh, token }: { units: Unit[]; selectedUnit?: Unit; selectedEquipment: Equipment[]; loading: boolean; summary: { online: number; attention: number; offline: number; unknown: number }; onSelectUnit: (unitId: string) => void; onBack: () => void; onInventoryRefresh: () => Promise<void>; token: string }) {
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [contextMenu, setContextMenu] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [addingEquipment, setAddingEquipment] = useState<Unit | null>(null);
  useEffect(() => { const close = () => setContextMenu(null); window.addEventListener('mousedown', close); window.addEventListener('scroll', close, true); return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); }; }, []);
  const refresh = async () => { setEditing(null); setEditingUnit(null); setAddingEquipment(null); await onInventoryRefresh(); };
  const menuAction = (action: 'open' | 'edit' | 'equipment') => { if (!contextMenu) return; const unit = contextMenu.unit; setContextMenu(null); if (action === 'open') onSelectUnit(unit.unit_id); else if (action === 'edit') setEditingUnit(unit); else setAddingEquipment(unit); };
  return <><div className="summary-grid"><Metric label="Unidades monitoradas" value={units.length} tone="neutral" /><Metric label="Operacionais" value={summary.online} tone="ok" /><Metric label="Em atenção" value={summary.attention} tone="warn" /><Metric label="Indisponíveis" value={summary.offline} tone="danger" /></div>{editingUnit && <UnitEditForm unit={editingUnit} token={token} onSaved={refresh} onCancel={() => setEditingUnit(null)} />}{addingEquipment && <EquipmentForm token={token} unit={addingEquipment} onCreated={refresh} onCancel={() => setAddingEquipment(null)} />}{selectedUnit ? <>{editing && <EquipmentEditForm equipment={editing} token={token} onSaved={refresh} onCancel={() => setEditing(null)} />}<UnitDetail unit={selectedUnit} equipment={selectedEquipment} onBack={onBack} onEdit={setEditing} /></> : <><div className="section-heading"><div><p className="eyebrow">FROTA E INFRAESTRUTURA</p><h2>Estado das unidades</h2></div><span>{loading ? 'Atualizando…' : `${summary.unknown} sem telemetria`}</span></div><div className="unit-grid">{units.map((unit) => <button className={`unit-card ${unit.operational_status}`} key={unit.unit_id} onClick={() => onSelectUnit(unit.unit_id)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ unit, x: Math.min(event.clientX, window.innerWidth - 240), y: Math.min(event.clientY, window.innerHeight - 170) }); }}><div className="unit-card-head"><span className="unit-code">{unit.code}</span><span className={`status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span></div><h3>{unit.name}</h3><p>{unit.city} · {unit.state_code}</p><div className="telemetry"><span><strong>{unit.offline_equipment}</strong> indisponíveis</span><span><strong>{unit.degraded_equipment}</strong> atenção</span></div><div className="signal-line"><i /><i /><i /><i /></div></button>)}</div></>}{contextMenu && <div className="unit-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}><p>{contextMenu.unit.code}</p><strong>{contextMenu.unit.name}</strong><button onClick={() => menuAction('open')}>Abrir unidade</button><button onClick={() => menuAction('edit')}>Editar unidade</button><button onClick={() => menuAction('equipment')}>Cadastrar equipamento</button><button className="context-cancel" onClick={() => setContextMenu(null)}>Cancelar</button></div>}</>;
}

function UnitsViewLegacy({ units, selectedUnit, selectedEquipment, loading, summary, onSelectUnit, onBack, onInventoryRefresh, token }: { units: Unit[]; selectedUnit?: Unit; selectedEquipment: Equipment[]; loading: boolean; summary: { online: number; attention: number; offline: number; unknown: number }; onSelectUnit: (unitId: string) => void; onBack: () => void; onInventoryRefresh: () => Promise<void>; token: string }) {
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const refresh = async () => { setEditing(null); await onInventoryRefresh(); };
  return <><div className="summary-grid"><Metric label="Unidades monitoradas" value={units.length} tone="neutral" /><Metric label="Operacionais" value={summary.online} tone="ok" /><Metric label="Em atenção" value={summary.attention} tone="warn" /><Metric label="Indisponíveis" value={summary.offline} tone="danger" /></div>{selectedUnit ? <>{editing && <EquipmentEditForm equipment={editing} token={token} onSaved={refresh} onCancel={() => setEditing(null)} />}<UnitDetail unit={selectedUnit} equipment={selectedEquipment} onBack={onBack} onEdit={setEditing} /></> : <><div className="section-heading"><div><p className="eyebrow">FROTA E INFRAESTRUTURA</p><h2>Estado das unidades</h2></div><span>{loading ? 'Atualizando…' : `${summary.unknown} sem telemetria`}</span></div><div className="unit-grid">{units.map((unit) => <button className={`unit-card ${unit.operational_status}`} key={unit.unit_id} onClick={() => onSelectUnit(unit.unit_id)}><div className="unit-card-head"><span className="unit-code">{unit.code}</span><span className={`status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span></div><h3>{unit.name}</h3><p>{unit.city} · {unit.state_code}</p><div className="telemetry"><span><strong>{unit.offline_equipment}</strong> indisponíveis</span><span><strong>{unit.degraded_equipment}</strong> atenção</span></div><div className="signal-line"><i /><i /><i /><i /></div></button>)}</div></>}</>;
}

function UnitEditForm({ unit, token, onSaved, onCancel }: { unit: Unit; token: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ code: unit.code, name: unit.name, stateCode: unit.state_code, city: unit.city, latitude: unit.latitude == null ? '' : String(unit.latitude), longitude: unit.longitude == null ? '' : String(unit.longitude) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await api(`/v1/units/${unit.unit_id}`, token, { method: 'PATCH', body: JSON.stringify({ code: form.code, name: form.name, stateCode: form.stateCode.toUpperCase(), city: form.city, latitude: form.latitude.trim() ? Number(form.latitude) : undefined, longitude: form.longitude.trim() ? Number(form.longitude) : undefined }) }); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao atualizar unidade.'); }
    finally { setSaving(false); }
  }
  return <FormCard title={`Editar unidade · ${unit.name}`} onCancel={onCancel}><form className="inline-form" onSubmit={submit}>{error && <div className="error-banner">{error}</div>}<label>Código<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>UF<input required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} /></label><label>Cidade<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><div className="location-fields"><label>Latitude<input inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-3.1186" /></label><label>Longitude<input inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-60.0217" /></label></div><small className="field-hint location-hint">Informe as coordenadas para posicionar a unidade no mapa. Deixe ambas vazias para remover a localização.</small><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div></form></FormCard>;
}

function UnitEditFormWithoutLocation({ unit, token, onSaved, onCancel }: { unit: Unit; token: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ code: unit.code, name: unit.name, stateCode: unit.state_code, city: unit.city });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await api(`/v1/units/${unit.unit_id}`, token, { method: 'PATCH', body: JSON.stringify(form) }); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao atualizar unidade.'); }
    finally { setSaving(false); }
  }
  return <FormCard title={`Editar unidade · ${unit.name}`} onCancel={onCancel}><form className="inline-form" onSubmit={submit}>{error && <div className="error-banner">{error}</div>}<label>Código<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>UF<input required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} /></label><label>Cidade<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div></form></FormCard>;
}

function InventoryLifecyclePanel({ unit, equipment, token, onRefresh }: { unit: Unit; equipment: Equipment[]; token: string; onRefresh: () => Promise<void> }) {
  const [editingUnit, setEditingUnit] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  async function deactivate(item: Equipment) {
    if (!window.confirm(`Desativar o equipamento "${item.name}"? Ele sairá da operação, mas o histórico será preservado.`)) return;
    setProcessingId(item.equipment_id);
    try { await api(`/v1/equipment/${item.equipment_id}`, token, { method: 'DELETE' }); await onRefresh(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Falha ao desativar equipamento.'); }
    finally { setProcessingId(null); }
  }
  async function remove(item: Equipment) {
    if (!window.confirm(`Excluir definitivamente o equipamento "${item.name}"? Essa ação remove o cadastro e os vínculos e não pode ser desfeita.`)) return;
    setProcessingId(item.equipment_id);
    try { await api(`/v1/equipment/${item.equipment_id}/permanent`, token, { method: 'DELETE' }); await onRefresh(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Falha ao excluir equipamento.'); }
    finally { setProcessingId(null); }
  }
  return <article className="lifecycle-panel"><div className="panel-title"><div><p className="eyebrow">GESTÃO DO INVENTÁRIO</p><h3>Alterações controladas</h3></div><button className="secondary-button" onClick={() => setEditingUnit((value) => !value)}>{editingUnit ? 'Fechar edição' : 'Editar unidade'}</button></div><p className="muted">Desativar preserva histórico. Excluir remove definitivamente o cadastro e os vínculos.</p>{editingUnit && <UnitEditForm unit={unit} token={token} onSaved={async () => { setEditingUnit(false); await onRefresh(); }} onCancel={() => setEditingUnit(false)} />}<div className="lifecycle-list">{equipment.map((item) => <div className="lifecycle-row" key={item.equipment_id}><div><strong>{item.name}</strong><small>{item.equipment_type.replaceAll('_', ' ')} · {item.management_address ?? 'sem endereço'}</small></div><div className="lifecycle-actions"><button className="danger-button compact" disabled={processingId === item.equipment_id} onClick={() => void deactivate(item)}>{processingId === item.equipment_id ? 'Processando…' : 'Desativar'}</button><button className="delete-button compact" disabled={processingId === item.equipment_id} onClick={() => void remove(item)}>Excluir</button></div></div>)}</div></article>;
}

function EquipmentEditForm({ equipment, token, onSaved, onCancel }: { equipment: Equipment; token: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ equipmentTypeCode: equipment.equipment_type, name: equipment.name, serialNumber: equipment.serial_number ?? '', managementAddress: equipment.management_address ?? '', contractedDownloadMbps: equipment.contracted_download_mbps?.toString() ?? '', contractedUploadMbps: equipment.contracted_upload_mbps?.toString() ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const linkFieldsVisible = isLinkEquipmentType(form.equipmentTypeCode);
  async function submit(event: FormEvent) { event.preventDefault(); if ((form.contractedDownloadMbps && Number(form.contractedDownloadMbps) <= 0) || (form.contractedUploadMbps && Number(form.contractedUploadMbps) <= 0)) { setError('As velocidades contratadas devem ser maiores que zero.'); return; } setSaving(true); setError(''); try { await api(`/v1/equipment/${equipment.equipment_id}`, token, { method: 'PATCH', body: JSON.stringify({ equipmentTypeCode: form.equipmentTypeCode, name: form.name, serialNumber: form.serialNumber || undefined, managementAddress: form.managementAddress || undefined, contractedDownloadMbps: linkFieldsVisible && form.contractedDownloadMbps ? Number(form.contractedDownloadMbps) : undefined, contractedUploadMbps: linkFieldsVisible && form.contractedUploadMbps ? Number(form.contractedUploadMbps) : undefined }) }); await onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao atualizar equipamento.'); } finally { setSaving(false); } }
  return <FormCard title={`Editar equipamento · ${equipment.name}`} onCancel={onCancel}><form className="inline-form" onSubmit={submit}>{error && <div className="error-banner">{error}</div>}<label>Tipo<select value={form.equipmentTypeCode} onChange={(e) => setForm({ ...form, equipmentTypeCode: e.target.value })}><option value="linux_server">Servidor Linux</option><option value="mikrotik">Mikrotik</option><option value="starlink">Starlink</option><option value="vpn">VPN</option><option value="internet_link">Link de internet</option></select></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Endereço de gerenciamento<input value={form.managementAddress} onChange={(e) => setForm({ ...form, managementAddress: e.target.value })} /></label><label>Número de série<input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>{linkFieldsVisible && <><div className="bandwidth-fields-note"><strong>Plano contratado</strong><small>Campos vazios são apresentados como N/D e nunca preenchidos pela telemetria.</small></div><label>Download contratado (Mbps)<input type="number" min="0.001" max="1000000" step="0.001" value={form.contractedDownloadMbps} onChange={(e) => setForm({ ...form, contractedDownloadMbps: e.target.value })} placeholder="Ex.: 500" /></label><label>Upload contratado (Mbps)<input type="number" min="0.001" max="1000000" step="0.001" value={form.contractedUploadMbps} onChange={(e) => setForm({ ...form, contractedUploadMbps: e.target.value })} placeholder="Ex.: 250" /></label></>}<div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div></form></FormCard>;
}

function UnitDetail({ unit, equipment, onBack, onEdit }: { unit: Unit; equipment: Equipment[]; onBack: () => void; onEdit: (equipment: Equipment) => void }) {
  const token = (JSON.parse(sessionStorage.getItem('healthlink.session') ?? '{}') as { accessToken?: string }).accessToken ?? '';
  const [editingUnit, setEditingUnit] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  async function deactivate(item: Equipment) {
    if (!window.confirm(`Desativar o equipamento "${item.name}"? Ele sairá da operação, mas o histórico será preservado.`)) return;
    setProcessingId(item.equipment_id);
    try { await api(`/v1/equipment/${item.equipment_id}`, token, { method: 'DELETE' }); window.location.reload(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Falha ao desativar equipamento.'); setProcessingId(null); }
  }
  async function remove(item: Equipment) {
    if (!window.confirm(`Excluir definitivamente o equipamento "${item.name}"? Esta ação não pode ser desfeita.`)) return;
    setProcessingId(item.equipment_id);
    try { await api(`/v1/equipment/${item.equipment_id}/permanent`, token, { method: 'DELETE' }); window.location.reload(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Falha ao excluir equipamento.'); setProcessingId(null); }
  }
  return <section className="unit-detail">
    <button className="back-button" onClick={onBack}>← Voltar ao centro operacional</button>
    <div className="detail-hero"><div><p className="eyebrow">UNIDADE {unit.code} · {unit.state_code}</p><h2>{unit.name}</h2><p>{unit.city} · monitoramento de infraestrutura</p></div><div className="detail-hero-actions"><button className="secondary-button compact" onClick={() => setEditingUnit((current) => !current)}>{editingUnit ? 'Fechar edição' : 'Editar unidade'}</button><span className={`status large-status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span></div></div>
    {editingUnit && <UnitEditForm unit={unit} token={token} onSaved={async () => { setEditingUnit(false); window.location.reload(); }} onCancel={() => setEditingUnit(false)} />}
    <div className="detail-grid"><article className="equipment-panel"><div className="panel-title"><div><p className="eyebrow">ATIVOS MONITORADOS</p><h3>Infraestrutura da unidade</h3></div><div className="panel-title-actions"><strong>{equipment.length}</strong></div></div>
      <div className="equipment-list">{equipment.map((item) => <div className="equipment-row" key={item.equipment_id}><span className={`equipment-indicator ${item.operational_status}`} /><div><strong>{item.name}</strong><small>{item.equipment_type.replaceAll('_', ' ')} · {item.management_address ?? 'sem endereço'}</small></div><div className="equipment-state"><span className={`status ${item.operational_status}`}>{statusLabel[item.operational_status]}</span><small>{item.observed_at ? new Date(item.observed_at).toLocaleString('pt-BR') : 'aguardando coleta'}</small></div><div className="equipment-actions"><button className="secondary-button compact" onClick={() => onEdit(item)}>Editar</button><button className="danger-button compact" disabled={processingId === item.equipment_id} onClick={() => void deactivate(item)}>Desativar</button><button className="delete-button compact" disabled={processingId === item.equipment_id} onClick={() => void remove(item)}>Excluir</button></div></div>)}</div>
    </article><aside className="readiness-panel"><p className="eyebrow">PRONTIDÃO OPERACIONAL</p><div className="readiness-score"><strong>{equipment.filter((item) => item.operational_status === 'online').length}</strong><span>de {equipment.length}<small>ativos confirmados</small></span></div><div className="readiness-line"><i style={{ width: `${equipment.length ? equipment.filter((item) => item.operational_status === 'online').length / equipment.length * 100 : 0}%` }} /></div><dl><div><dt>Indisponíveis</dt><dd>{equipment.filter((item) => item.operational_status === 'offline').length}</dd></div><div><dt>Em atenção</dt><dd>{equipment.filter((item) => item.operational_status === 'degraded').length}</dd></div><div><dt>Sem telemetria</dt><dd>{equipment.filter((item) => item.operational_status === 'unknown').length}</dd></div></dl></aside></div>
  </section>;
}

function UsersPanel({ users, requests, loading, token, onRefresh, onChange }: { users: ManagedUser[]; requests: AccessRequest[]; loading: boolean; token: string; onRefresh: () => Promise<void>; onChange: (id: string, action: 'block' | 'unblock' | 'delete') => Promise<void> }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: '', cpf: '', coligada: 'HealthLink Sentinel', active: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState('');
  const [approvalOpen, setApprovalOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true); setLocalError('');
    if (!form.displayName.trim() || !form.email.trim() || !form.role || (!editing && !form.cpf.trim())) {
      return;
    }
    setSaving(true);
    try {
      if (editing) await api(`/v1/users/${editing}`, token, { method: 'PATCH', body: JSON.stringify({ displayName: form.displayName, password: form.password || undefined, role: form.role, active: form.active }) });
      else await api('/v1/users', token, { method: 'POST', body: JSON.stringify({ displayName: form.displayName, email: form.email, password: form.password || 'Sentinel@2026', role: form.role }) });
      setForm({ displayName: '', email: '', password: '', role: '', cpf: '', coligada: 'HealthLink Sentinel', active: true });
      setEditing(null); setSubmitted(false); await onRefresh();
    } catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'Falha ao salvar usuário.'); }
    finally { setSaving(false); }
  }

  function startEdit(user: ManagedUser) {
    setEditing(user.id);
    setForm({ displayName: user.display_name, email: user.email, password: '', role: user.roles[0] ?? 'viewer', cpf: '000.000.000-00', coligada: 'HealthLink Sentinel', active: user.active });
    setSubmitted(false);
  }

  return <section className="users-page">
    <button className="secondary-button approval-launch" onClick={() => setApprovalOpen(true)}>Aprovações {requests.length > 0 && <b className="nav-badge">{requests.length}</b>}</button>
    {approvalOpen && <ApprovalModal requests={requests} token={token} onClose={() => setApprovalOpen(false)} onRefresh={onRefresh} />}
    <div className="section-heading"><div><p className="eyebrow">GOVERNANÇA DE ACESSO</p><h2>Gerenciamento de usuários</h2><small>Controle de identidades, perfis e acesso ao cliente.</small></div><button className="secondary-button" onClick={() => void onRefresh()}>Atualizar</button></div>
    <div className="users-layout">
      <form className={`user-form panel ${editing ? 'user-edit-modal' : ''}`} onSubmit={submit} noValidate>
        <div className="panel-title">
          <div>
            <p className="eyebrow">{editing ? 'EDITAR IDENTIDADE' : 'DADOS DO USUÁRIO'}</p>
            <h3>{editing ? 'Atualizar usuário' : 'Dados do usuário'}</h3>
            <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
          </div>
          {editing && <button type="button" className="icon-button" aria-label="Fechar edição" onClick={() => setEditing(null)}>×</button>}
        </div>
        <div className="user-form-grid">
          <label>
            Nome completo <b className="req">*</b>
            <input value={form.displayName} className={submitted && !form.displayName.trim() ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Ex.: Nome" required />
            {submitted && !form.displayName.trim() && <span className="field-error-text">Informe o nome completo.</span>}
          </label>
          <label>
            E-mail <b className="req">*</b>
            <input type="email" value={form.email} className={submitted && !form.email.trim() ? 'field-invalid' : ''} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@empresa.com" required />
            {submitted && !form.email.trim() && <span className="field-error-text">Informe o e-mail.</span>}
          </label>
          <label>
            CPF <b className="req">*</b>
            <input value={form.cpf} className={submitted && !form.cpf.trim() ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" required />
            {submitted && !form.cpf.trim() && <span className="field-error-text">Informe o CPF.</span>}
          </label>
          <label>
            Perfil <b className="req">*</b>
            <select value={form.role} className={submitted && !form.role ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
              <option value="">Selecione um perfil</option>
              <option value="tenant_administrator">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="noc_operator">Operador NOC</option>
              <option value="service_agent">Agente de integração</option>
              <option value="viewer">Visualizador</option>
            </select>
            {submitted && !form.role && <span className="field-error-text">Selecione o perfil.</span>}
          </label>
          <label>
            Coligada <b className="req">*</b>
            <select value={form.coligada} className={submitted && !form.coligada ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, coligada: e.target.value })} required>
              <option value="">Selecione uma coligada</option>
              <option value="HealthLink Sentinel">HealthLink Sentinel (Matriz)</option>
              <option value="Filial 01">Filial 01 - Operações</option>
            </select>
            {submitted && !form.coligada && <span className="field-error-text">Selecione uma coligada.</span>}
          </label>
          <label>
            Status <b className="req">*</b>
            <select value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
              <option value="active">Ativo</option>
              <option value="inactive">Bloqueado</option>
            </select>
          </label>
          <div className="form-info-callout">
            <span>ⓘ</span>
            <div>
              <strong>Senha enviada por e-mail</strong>
              <span style={{ fontSize: '10px', color: '#7a94a8' }}>A senha inicial será criada automaticamente e enviada para o e-mail informado. Ela não é exibida neste formulário.</span>
            </div>
          </div>
        </div>
        {localError && <div className="form-error">{localError}</div>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ displayName: '', email: '', password: '', role: '', cpf: '', coligada: 'HealthLink Sentinel', active: true }); setSubmitted(false); }}>Limpar</button>
          <button className="primary" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar usuário'}</button>
        </div>
      </form>
      <div className="users-list panel">
        <div className="panel-title"><div><p className="eyebrow">USUÁRIOS DO CLIENTE</p><h3>{users.length} identidades</h3></div></div>
        {loading ? <div className="empty-state compact-empty"><p>Consultando diretório…</p></div> : users.length === 0 ? <div className="empty-state compact-empty"><p>Nenhum usuário cadastrado.</p></div> : <div className="user-table">{users.map((user) => <article className="user-row" key={user.id}><span className={`user-avatar ${user.active ? 'active' : 'blocked'}`}>{user.display_name.slice(0, 1).toUpperCase()}</span><div className="user-main"><strong>{user.display_name}</strong><small>{user.email}</small></div><div className="user-role"><span>{user.roles[0]?.replaceAll('_', ' ') ?? 'sem perfil'}</span><small>{user.active ? 'Ativo' : 'Bloqueado'}</small></div><div className="user-actions"><button className="secondary-button compact" onClick={() => startEdit(user)}>Editar</button>{user.active ? <button className="danger-button compact" onClick={() => void onChange(user.id, 'block')}>Bloquear</button> : <button className="secondary-button compact" onClick={() => void onChange(user.id, 'unblock')}>Desbloquear</button>}<button className="delete-button compact" onClick={() => void onChange(user.id, 'delete')}>Excluir</button></div></article>)}</div>}
      </div>
    </div>
  </section>;
}

function ApprovalModal({ requests, token, onClose, onRefresh }: { requests: AccessRequest[]; token: string; onClose: () => void; onRefresh: () => Promise<void> }) {
  async function review(id: string, approve: boolean) { await api(approve ? `/v1/users/access-requests/${id}/approve` : `/v1/users/access-requests/${id}`, token, { method: approve ? 'POST' : 'DELETE', ...(approve ? { body: '{}' } : {}) }); await onRefresh(); }
  return <div className="approval-modal" role="dialog" aria-modal="true"><div className="approval-modal-card panel"><div className="panel-title"><div><p className="eyebrow">CONTROLE DE ACESSO</p><h3>Solicitações de cadastro</h3></div><button className="icon-button" onClick={onClose}>×</button></div>{requests.length === 0 ? <div className="empty-state compact-empty"><p>Nenhuma solicitação pendente.</p></div> : <div className="request-list">{requests.map((item) => <article className="request-row" key={item.id}><div><strong>{item.display_name}</strong><small>{item.email} · {item.requested_role.replaceAll('_', ' ')}</small></div><div className="user-actions"><button className="primary compact" onClick={() => void review(item.id, true)}>Aprovar</button><button className="delete-button compact" onClick={() => void review(item.id, false)}>Rejeitar</button></div></article>)}</div>}</div></div>;
}

const severityConfig = {
  1: { label: 'CRÍTICO', cls: 'critical', color: 'var(--red)' },
  2: { label: 'ALTO',    cls: 'high',     color: 'var(--red)' },
  3: { label: 'MÉDIO',  cls: 'medium',   color: 'var(--amber)' },
  4: { label: 'BAIXO',  cls: 'low',      color: '#8da3b7' },
  5: { label: 'INFO',   cls: 'info',     color: '#8da3b7' },
} as const;

function AlertSeverityBadge({ severity }: { severity: number }) {
  const cfg = severityConfig[severity as keyof typeof severityConfig] ?? { label: `S${severity}`, cls: 'info', color: '#8da3b7' };
  return (
    <div className={`alert-severity-badge sev-${cfg.cls}`}>
      {severity <= 2 && <span className="sev-pulse" />}
      <span className="sev-label">{cfg.label}</span>
      <span className="sev-num">S{severity}</span>
    </div>
  );
}

function AlertRow({ alert, isHistory, onAction }: { alert: Alert; isHistory: boolean; onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void> }) {
  const [busy, setBusy] = useState<'acknowledge' | 'resolve' | null>(null);
  const [rowFeedback, setRowFeedback] = useState<'success' | 'error' | null>(null);
  const [rowError, setRowError] = useState('');

  async function handleAction(action: 'acknowledge' | 'resolve') {
    setBusy(action);
    setRowFeedback(null);
    setRowError('');
    try {
      await onAction(alert.id, action);
      setRowFeedback('success');
    } catch (e) {
      setRowFeedback('error');
      setRowError(e instanceof Error ? e.message : 'Falha ao processar ação.');
    } finally {
      setBusy(null);
    }
  }

  const statusTone = alert.status === 'resolved' ? 'online' : alert.status === 'acknowledged' ? 'degraded' : 'offline';
  const statusReadable = alert.status === 'resolved' ? 'Resolvido' : alert.status === 'acknowledged' ? 'Reconhecido' : 'Aberto';

  return (
    <article className={`alert-row severity-${alert.severity}${rowFeedback === 'success' ? ' row-success' : rowFeedback === 'error' ? ' row-error' : ''}`}>
      <AlertSeverityBadge severity={alert.severity} />
      <div className="alert-main">
        <strong>{alert.title}</strong>
        <small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'}</small>
        {rowFeedback === 'error' && <span className="alert-inline-error">⚠ {rowError}</span>}
      </div>
      <div className="alert-meta">
        <span className={`status ${statusTone}`}>{statusReadable}</span>
        <small>{new Date(alert.opened_at).toLocaleString('pt-BR')}</small>
        {alert.resolved_at && <small className="resolved-at">Resolvido: {new Date(alert.resolved_at).toLocaleString('pt-BR')}</small>}
      </div>
      {!isHistory && (
        <div className="alert-actions">
          {alert.status === 'open' && (
            <button className="alert-action-btn ack" onClick={() => void handleAction('acknowledge')} disabled={busy !== null} title="Reconhecer alerta">
              {busy === 'acknowledge' ? <span className="btn-spinner" /> : '✓'} Reconhecer
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button className="alert-action-btn resolve" onClick={() => void handleAction('resolve')} disabled={busy !== null} title="Resolver incidente">
              {busy === 'resolve' ? <span className="btn-spinner" /> : '⏺'} Resolver
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function AlertsCenter({ alerts, mode, loading, onModeChange, onAction, onRetry }: { alerts: Alert[]; mode: 'active' | 'history'; loading: boolean; onModeChange: (mode: 'active' | 'history') => void; onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void>; onRetry: () => void }) {
  const isHistory = mode === 'history';
  const criticalCount = !isHistory ? alerts.filter((a) => a.severity <= 2 && a.status !== 'resolved').length : 0;
  return (
    <section className="alerts-center">
      <div className="alerts-center-header">
        <div className="alert-tabs" role="tablist" aria-label="Filtro de alertas">
          <button className={`alert-tab ${!isHistory ? 'active' : ''}`} onClick={() => onModeChange('active')} role="tab" aria-selected={!isHistory}>
            Ativos <span>{!isHistory ? alerts.length : '—'}</span>
          </button>
          <button className={`alert-tab ${isHistory ? 'active' : ''}`} onClick={() => onModeChange('history')} role="tab" aria-selected={isHistory}>
            Histórico resolvido <span>{isHistory ? alerts.length : '—'}</span>
          </button>
        </div>
        {criticalCount > 0 && (
          <div className="alerts-critical-banner" role="alert">
            <span className="critical-pulse-dot" />
            <strong>{criticalCount} incidente(s) crítico(s)</strong> requerem ação imediata
          </div>
        )}
      </div>
      <div className="section-heading">
        <div><p className="eyebrow">EVENTOS E INCIDENTES</p><h2>{isHistory ? 'Histórico resolvido' : 'Alertas ativos'}</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {loading && <span className="alerts-loading-indicator"><span className="btn-spinner" /> Carregando…</span>}
          <button className="secondary-button compact" onClick={onRetry} disabled={loading} title="Recarregar lista de alertas">↺ Atualizar</button>
          <span style={{ font: '10px IBM Plex Mono', color: '#637b91' }}>{alerts.length} registro(s)</span>
        </div>
      </div>
      {loading && alerts.length === 0 ? (
        <div className="alerts-loading-skeleton">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-glyph">{isHistory ? '📋' : '✓'}</span>
          <h3>{isHistory ? 'Nenhum alerta resolvido' : 'Nenhum alerta requer ação'}</h3>
          <p>{isHistory ? 'Os incidentes resolvidos aparecerão aqui para auditoria operacional.' : 'O núcleo de monitoramento não identificou problemas ativos nas unidades.'}</p>
          {!isHistory && <button className="secondary-button" style={{ marginTop: '16px' }} onClick={onRetry}>Verificar novamente</button>}
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => <AlertRow key={alert.id} alert={alert} isHistory={isHistory} onAction={onAction} />)}
        </div>
      )}
    </section>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  const iconMap: Record<Toast['type'], string> = { error: '⛔', warning: '⚠', success: '✓', info: 'ℹ' };
  return (
    <div className="noc-toast-stack" role="log" aria-live="assertive" aria-label="Notificações do sistema">
      {toasts.map((t) => (
        <div key={t.id} className={`noc-toast noc-toast-${t.type}`} role="alert">
          <span className="toast-icon">{iconMap[t.type]}</span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.detail && <p>{t.detail}</p>}
          </div>
          <button className="toast-close" onClick={() => onDismiss(t.id)} title="Fechar notificação">✕</button>
        </div>
      ))}
    </div>
  );
}

function EditProfileModal({ session, onSave, onClose }: { session: LoginResponse; onSave: (name: string) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSave(displayName);
      setSaving(false);
      onClose();
    }, 350);
  }

  return (
    <div className="approval-modal" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <form className="user-form panel user-edit-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="panel-title">
          <div>
            <p className="eyebrow">PERFIL CORPORATIVO</p>
            <h3>Editar perfil</h3>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar edição" onClick={onClose}>×</button>
        </div>
        <div className="user-form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            Nome completo *
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            E-mail corporativo (não editável)
            <input value={session.user.email} disabled />
          </label>
          <label>
            Organização / Tenant
            <input value={session.tenant.name} disabled />
          </label>
          <label>
            Nova senha (opcional)
            <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter a atual" />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </form>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{String(value).padStart(2, '0')}</strong><small>atualização em tempo real</small></article>;
}

function LoginWithRequest({ onSuccess }: { onSuccess: (session: LoginResponse) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [requestOpen, setRequestOpen] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { const response = await fetch(`${apiBase}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); if (!response.ok) throw new Error('E-mail ou senha inválidos.'); onSuccess(await response.json() as LoginResponse); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha de autenticação.'); } }
  return <div className="login-page"><section className="login-context"><div className="brand large"><span className="brand-mark">HL</span><div><strong>HealthLink</strong><small>SENTINEL</small></div></div><div className="context-copy"><p className="eyebrow">PLATAFORMA DE MISSÃO CRÍTICA</p><h1>Visibilidade para proteger cada unidade em campo.</h1><p>Monitoramento contínuo de conectividade, infraestrutura e disponibilidade operacional.</p></div></section><section className="login-panel"><form onSubmit={submit}><p className="eyebrow">ACESSO RESTRITO</p><h2>Entrar no centro de comando</h2><p className="muted">Utilize sua identidade corporativa.</p><label>E-mail corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="form-error">{error}</div>}<button className="primary">Acessar plataforma</button><button type="button" className="request-access-link" onClick={() => setRequestOpen(true)}>Criar conta <span>(sujeito a aprovação)</span></button></form></section>{requestOpen && <RequestAccessModal onClose={() => setRequestOpen(false)} />}</div>;
}

function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: 'viewer' }); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { const response = await fetch(`${apiBase}/v1/access-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); if (!response.ok) throw new Error('Não foi possível enviar a solicitação.'); setMessage('Solicitação enviada. Aguarde a aprovação do administrador.'); setForm({ displayName: '', email: '', password: '', role: 'viewer' }); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Falha ao solicitar acesso.'); } finally { setSaving(false); } }
  return <div className="approval-modal" role="dialog" aria-modal="true"><form className="request-access-modal panel" onSubmit={submit}><div className="panel-title"><div><p className="eyebrow">SOLICITAÇÃO DE ACESSO</p><h3>Criar conta</h3></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="muted">Seu cadastro será analisado por um administrador.</p><label>Nome completo *<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></label><label>E-mail corporativo *<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Perfil solicitado *<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="viewer">Visualizador</option><option value="supervisor">Supervisor</option><option value="noc_operator">Operador NOC</option></select></label><label>Senha *<input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>{message && <div className="form-error">{message}</div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Enviando…' : 'Solicitar acesso'}</button></div></form></div>;
}

function Login({ onSuccess }: { onSuccess: (session: LoginResponse) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch(`${apiBase}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('E-mail ou senha inválidos.');
      onSuccess(await response.json() as LoginResponse);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha de autenticação.'); }
    finally { setLoading(false); }
  }
  return <div className="login-page">
    <section className="login-context"><div className="brand large"><span className="brand-mark">HL</span><div><strong>HealthLink</strong><small>SENTINEL</small></div></div><div className="context-copy"><p className="eyebrow">PLATAFORMA DE MISSÃO CRÍTICA</p><h1>Visibilidade para proteger cada unidade em campo.</h1><p>Monitoramento contínuo de conectividade, infraestrutura e disponibilidade operacional das unidades móveis de saúde.</p></div><div className="context-status"><span className="pulse" /> Núcleo de monitoramento disponível</div></section>
    <section className="login-panel"><form onSubmit={submit}><p className="eyebrow">ACESSO RESTRITO</p><h2>Entrar no centro de comando</h2><p className="muted">Utilize sua identidade corporativa.</p><label>E-mail corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="form-error">{error}</div>}<button className="primary" disabled={loading}>{loading ? 'Validando acesso…' : 'Acessar plataforma'}</button><small className="security-note">Sessão protegida · Acesso auditado</small></form></section>
  </div>;
}
