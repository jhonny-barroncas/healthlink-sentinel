import { Fragment, FormEvent, ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import brazilMap from '@svg-maps/brazil';
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import brandIcon from './assets/brand-icon.svg';
import { validateManagedUserForm } from './user-form.js';
import { groupTelemetryByUnit } from './state-map-telemetry.js';
import { chooseDiagnosticTarget, type DiagnosticTargetCandidate } from './diagnostic-target.js';
import { getUnitInventoryView, getUnitMapAlertState, getUnitMapMenuAvailability, selectMapAsset, shouldShowMapAssetKind, type MapAssetView } from './state-map-interactions.js';
import { buildPingSparkline } from './ping-sparkline.js';
import { nearestLatencyIndex } from './latency-hover.js';
import { agentStatusLabel, normalizeAgentRecord, type AgentRecord } from './agent-status.js';
import { localAgentSourcePayload } from './starlink-source.js';
import { canPublishAgentVersion, type AgentPlatform, type AgentVersionRecord } from './agent-version.js';
import { agentInstallerFileName, extractAgentInstallerFileName, getAgentProvisioningRequirements } from './agent-provisioning.js';
import { friendlyApiMessage } from './error-messages.js';
import { mapRasterFallbackStyle, mapRasterLightFallbackStyle } from './map-styles.js';
import { filterIncidentReports, summarizeIncidentReports, type IncidentReportFilters } from './incident-reports.js';
import { EyeIcon, EyeOffIcon, UserIcon, LockIcon, MailIcon, BadgeIcon, LoginIcon, MoreVerticalIcon, ChevronIcon, EditIcon, LogoutIcon, CloseIcon, BlockIcon, UnblockIcon, RejectIcon, CheckIcon, EyeCheckIcon, ResolveIcon, NavDashboardIcon, NavTruckIcon, NavBellIcon, NavActivityIcon, NavUsersIcon, NavReportIcon, SyncIcon, SunIcon, SearchIcon, HomeIcon, BreadcrumbChevronIcon, NavGeneralIcon, NavLinkIcon, NavVpnIcon, NavServerIcon, ClipboardIcon, MoonIcon, WarningIcon, ErrorIcon, InfoIcon, PingIcon, TracertIcon, TrashIcon, PlusIcon, RefreshIcon, ClearFilterIcon, AgentIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PackageIcon, FolderIcon, UploadIcon, MapIcon } from './icons.js';

type LoginResponse = { accessToken: string; user: { id: string; displayName: string; email: string }; tenant: { name: string; roles?: string[] } };
type Unit = { unit_id: string; code: string; name: string; state_code: string; city: string; unit_type: 'mobile' | 'fixed'; latitude: number | string | null; longitude: number | string | null; operational_status: 'online' | 'degraded' | 'offline' | 'unknown'; offline_equipment: number; degraded_equipment: number };
type Alert = { id: string; title: string; severity: number; status: string; unit_id?: string | null; unit_code?: string; equipment_id?: string | null; equipment_name?: string; opened_at: string; resolved_at?: string | null };
type Equipment = { equipment_id: string; unit_id: string; equipment_type: string; name: string; serial_number?: string | null; management_address?: string | null; contracted_download_mbps?: number | null; contracted_upload_mbps?: number | null; operational_status: 'online' | 'degraded' | 'offline' | 'unknown'; observed_at?: string; active?: boolean };
type LatencyPoint = { value: number; observed_at: string };
type LinkTelemetry = { unit_id: string; unit_code: string; unit_name: string; equipment_id: string; equipment_name: string; equipment_type: string; contracted_download_mbps: number | null; contracted_upload_mbps: number | null; operational_status: Unit['operational_status']; observed_at: string | null; telemetry_stale?: boolean; telemetry_error?: string | null; metrics: Record<string, number>; latency_history: LatencyPoint[] };
type StarlinkTelemetry = { equipmentId: string; equipmentName: string; observedAt: string | null; collectorStatus?: 'online' | 'offline'; collectorError?: string | null; metrics: Array<{ metric_key: string; value: number; unit: string; observed_at: string }> };
type ZabbixHost = { hostid: string; host: string; name: string; status: string | number; interfaces?: Array<{ ip?: string; dns?: string; port?: string }>; tags?: Array<{ tag: string; value: string }>; inventory?: { location?: string; location_lat?: string; location_lon?: string } };
type ZabbixMapping = { id: string; zabbix_host_id: string; equipment_id: string };
type ZabbixCandidates = { integrationId: string; hosts: ZabbixHost[]; equipment: Array<{ id: string; unit_id: string; name: string; equipment_type: string }>; mappings: ZabbixMapping[] };
type ZabbixSyncStatus = { integration_id: string; health_status: 'healthy' | 'degraded' | 'unavailable' | 'unknown'; last_attempt_at: string | null; last_success_at: string | null; last_failure_at: string | null; consecutive_failures: number; last_error: string | null; hosts_seen: number; mapped_hosts: number; problems_seen: number; duration_ms: number | null };
type DiagnosticResult = { action: 'ping' | 'tracert'; target: string; success: boolean; output: string; latencyMs?: number; code?: string | number };
type ManagedUser = { id: string; email: string; display_name: string; active: boolean; last_access_at?: string | null; created_at: string; roles: string[] };
type AccessRequest = { id: string; email: string; display_name: string; requested_role: string; status: string; created_at: string };
type Toast = { id: string; type: 'error' | 'warning' | 'success' | 'info'; title: string; detail?: string; sticky?: boolean; durationMs?: number };

const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  global_administrator: 'Administrador global',
  tenant_administrator: 'Administrador',
  supervisor: 'Supervisor',
  mobile_unit_supervisor: 'Supervisor de unidades móveis',
  noc_operator: 'Operador NOC',
  service_agent: 'Agente de integração',
  viewer: 'Visualizador',
};

function roleLabel(roles: string[] | undefined): string {
  const role = roles?.[0];
  return (role && ROLE_LABELS[role]) || 'Usuário';
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessão expirada. Entre novamente.');
    let detail = '';
    try {
      const payload = await response.json() as { message?: string; error?: string };
      detail = payload.message || payload.error || '';
    } catch { /* resposta sem JSON */ }
    throw new Error(friendlyApiMessage(detail || `Falha na plataforma (HTTP ${response.status}).`, 'Não foi possível concluir a operação. Tente novamente.'));
  }
  return response.json() as Promise<T>;
}

function friendlyMessage(reason: unknown, fallback: string): string {
  if (!(reason instanceof Error)) return fallback;
  return friendlyApiMessage(reason.message.replace(/^Falha na plataforma:\s*/, ''), fallback);
}

async function loginErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return friendlyApiMessage(payload.message || payload.error, 'E-mail ou senha incorretos. Confira os dados e tente novamente.');
  } catch { return 'Não foi possível interpretar a resposta da aplicação. Tente novamente.'; }
}

export function App() {
  const [session, setSession] = useState<LoginResponse | null>(() => {
    const saved = sessionStorage.getItem('healthlink.session');
    return saved ? JSON.parse(saved) as LoginResponse : null;
  });
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<Alert[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [alertMode, setAlertMode] = useState<'active' | 'history'>('active');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [view, setView] = useState<'command' | 'mobile-units' | 'fixed-units' | 'alerts' | 'reports' | 'zabbix' | 'connections' | 'users'>('command');
  const [commandMenuOpen, setCommandMenuOpen] = useState(true);
  const [usersCreating, setUsersCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const usersEditing = editingUserId !== null;
  const [unitCreating, setUnitCreating] = useState(false);
  const [equipmentCreating, setEquipmentCreating] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [commandScope, setCommandScope] = useState<'all' | 'links' | 'agents' | 'servers'>('all');
  useEffect(() => { if (view !== 'users') { setUsersCreating(false); setEditingUserId(null); } }, [view]);
  useEffect(() => { setUnitCreating(false); setEquipmentCreating(false); setEditingUnitId(null); setEditingEquipmentId(null); }, [view]);
  useEffect(() => { if (!selectedUnitId) { setEquipmentCreating(false); setEditingEquipmentId(null); } }, [selectedUnitId]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [zabbixCandidates, setZabbixCandidates] = useState<ZabbixCandidates | null>(null);
  const [zabbixStatus, setZabbixStatus] = useState<ZabbixSyncStatus | null>(null);
  const [zabbixLoading, setZabbixLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const SESSION_EXPIRED_TOAST_ID = 'session-expired';
  // Requisições que já estavam "em voo" com o token antigo podem resolver logo após um
  // novo login e reportar 401 tardiamente; ignoramos esse eco por uma janela curta.
  const reauthGraceUntilRef = useRef(0);
  useEffect(() => {
    if (error !== 'Sessão expirada. Entre novamente.') return;
    setError('');
    if (Date.now() < reauthGraceUntilRef.current) return;
    setSessionExpired(true);
    setToasts((prev) => prev.some((t) => t.id === SESSION_EXPIRED_TOAST_ID) ? prev : [...prev, { id: SESSION_EXPIRED_TOAST_ID, type: 'error', title: 'Sessão expirada', detail: 'Entre novamente para continuar.', sticky: true }]);
  }, [error]);
  const lockedStyle = sessionExpired ? { pointerEvents: 'none' as const, opacity: .5, filter: 'grayscale(.4)' } : undefined;
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (event: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setUserMenuOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onEscape); };
  }, [userMenuOpen]);

  function addToast(toast: Omit<Toast, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (!toast.sticky) window.setTimeout(() => dismissToast(id), toast.durationMs ?? (toast.type === 'error' ? 8000 : 5000));
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }
  function exitExpiredSession() {
    sessionStorage.removeItem('healthlink.session');
    setJustLoggedOut(false);
    setSessionExpired(false);
    setToasts((prev) => prev.filter((toast) => toast.id !== SESSION_EXPIRED_TOAST_ID));
    setSession(null);
  }
  useEffect(() => {
    if (!sessionExpired) return;
    const exitOnKeyboard = (event: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(event.key)) exitExpiredSession();
    };
    window.addEventListener('keydown', exitOnKeyboard);
    return () => window.removeEventListener('keydown', exitOnKeyboard);
  }, [sessionExpired]);

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
        api<Array<Record<string, unknown>>>('/v1/monitoring/agents', session.accessToken),
      ]).then(([nextUnits, nextEquipment, nextAgents]) => { setUnits(nextUnits); setEquipment(nextEquipment); setAgents(nextAgents.map(normalizeAgentRecord)); setError(''); });

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
              title: `HOST DOWN · ${unit.code}`,
              detail: `A unidade ${unit.name} (${unit.city}/${unit.state_code}) ficou ${toLabel.toLowerCase()} (era ${fromLabel.toLowerCase()})!`,
              durationMs: 10000,
            });
          } else if (unit.operational_status === 'online') {
            addToast({
              type: 'success',
              title: `HOST UP · ${unit.code}`,
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
          title: `ZABBIX DOWN`,
          detail: `Comunicação com a API Zabbix indisponível ou degradada!`,
          durationMs: 10000,
        });
      } else if (zabbixStatus.health_status === 'healthy') {
        addToast({
          type: 'success',
          title: `ZABBIX UP`,
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
  const scopeLabelFor = (scope: 'all' | 'links' | 'agents' | 'servers') => scope === 'all' ? 'Geral' : scope === 'links' ? 'Links' : scope === 'agents' ? 'Agentes' : 'Servidores';
  const breadcrumbSectionLabel = view === 'command' ? 'Visão geral' : view === 'mobile-units' ? 'Unidades móveis' : view === 'fixed-units' ? 'Unidades fixas' : view === 'alerts' ? 'Alertas' : view === 'reports' ? 'Relatórios' : view === 'connections' ? 'Status das conexões' : view === 'users' ? 'Usuários' : 'Integração Zabbix';
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
      addToast({ type: 'error', title: 'Falha ao atualizar alerta', detail: msg });
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
    try {
      if (action === 'delete') await api(`/v1/users/${id}`, session.accessToken, { method: 'DELETE' });
      else await api(`/v1/users/${id}`, session.accessToken, { method: 'PATCH', body: JSON.stringify({ active: action === 'unblock' }) });
      await loadUsers();
      addToast({
        type: 'success',
        title: action === 'delete' ? 'Usuário excluído' : action === 'block' ? 'Usuário bloqueado' : 'Usuário desbloqueado',
        detail: action === 'delete' ? 'O usuário foi removido desta lista.' : action === 'block' ? 'O acesso do usuário foi suspenso.' : 'O acesso do usuário foi restaurado.',
      });
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

  if (!session) return <LoginWithRequest showLogoutToast={justLoggedOut} onSuccess={(next) => { sessionStorage.setItem('healthlink.session', JSON.stringify(next)); setJustLoggedOut(false); setSession(next); setSessionExpired(false); setError(''); reauthGraceUntilRef.current = Date.now() + 5000; setToasts((prev) => prev.filter((t) => t.id !== SESSION_EXPIRED_TOAST_ID)); addToast({ type: 'success', title: 'Acesso confirmado', detail: `Bem-vindo(a) de volta, ${next.user.displayName.split(' ')[0] || 'operador'}.` }); }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar" style={lockedStyle} onPointerUp={(event) => { const button = (event.target as HTMLElement).closest('button'); button?.blur(); }}>
        <button type="button" className="brand" title="Ir para a visão geral" onClick={() => { setView('command'); setCommandScope('all'); setSelectedUnitId(null); setCommandMenuOpen(true); }}><img className="brand-mark" src={brandIcon} alt="HealthLink Sentinel" width={38} height={38} /><div><strong>HealthLink</strong><small>SENTINEL</small></div></button>
        <nav>
          <button title="Visão geral" className={`nav-item ${view === 'command' ? 'active' : ''}`} onClick={() => { setView('command'); setSelectedUnitId(null); setCommandMenuOpen((open) => !open); }}><span className="nav-icon"><NavDashboardIcon /></span><span className="nav-label">Visão geral</span><b className="nav-chevron">{commandMenuOpen && view === 'command' ? '−' : '+'}</b></button>
          {commandMenuOpen && view === 'command' && <div className="nav-submenu" aria-label="Filtros do centro operacional">
            {([['all', 'Geral', <NavGeneralIcon />], ['links', 'Links', <NavLinkIcon />], ['agents', 'Agentes', <NavVpnIcon />], ['servers', 'Servidores', <NavServerIcon />]] as const).map(([scope, label, icon]) => <button key={scope} className={`nav-subitem ${commandScope === scope ? 'active' : ''}`} onClick={() => { setCommandScope(scope); setSelectedUnitId(null); }}><span className="nav-subitem-icon">{icon}</span>{label}</button>)}
          </div>}
          {!(session.tenant.roles ?? []).includes('mobile_unit_supervisor') && <button title="Unidades fixas" className={`nav-item ${view === 'fixed-units' ? 'active' : ''}`} onClick={() => { setView('fixed-units'); setSelectedUnitId(null); }}><span className="nav-icon"><NavServerIcon /></span><span className="nav-label">Unidades fixas</span></button>}
          <button title="Unidades móveis" className={`nav-item ${view === 'mobile-units' ? 'active' : ''}`} onClick={() => { setView('mobile-units'); setSelectedUnitId(null); }}><span className="nav-icon"><NavTruckIcon /></span><span className="nav-label">Unidades móveis</span></button>
          <button title="Alertas" className={`nav-item ${view === 'alerts' ? 'active' : ''}`} onClick={() => { setView('alerts'); setSelectedUnitId(null); }}><span className="nav-icon"><NavBellIcon /></span><span className="nav-label">Alertas</span>{activeAlertCount > 0 && <b className="nav-badge">{activeAlertCount}</b>}</button>
          <button title="Status das conexões" className={`nav-item ${view === 'connections' ? 'active' : ''}`} onClick={() => { setView('connections'); setSelectedUnitId(null); void loadZabbixStatus(); }}><span className="nav-icon"><NavActivityIcon /></span><span className="nav-label">Status das conexões</span><i className={`nav-health-dot ${zabbixStatus?.health_status ?? 'unknown'}`} /></button>
          <button title="Usuários" className={`nav-item ${view === 'users' ? 'active' : ''}`} onClick={() => { setView('users'); setSelectedUnitId(null); void loadUsers(); }}><span className="nav-icon"><NavUsersIcon /></span><span className="nav-label">Usuários</span></button>
          <button title="Relatórios" className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => { setView('reports'); setSelectedUnitId(null); }}><span className="nav-icon"><NavReportIcon /></span><span className="nav-label">Relatórios</span></button>
        </nav>
        <SyncStatusButton active={view === 'zabbix'} status={zabbixStatus} onClick={() => { setView('zabbix'); setSelectedUnitId(null); void Promise.all([loadZabbixStatus(), loadZabbixCandidates()]); }} />
        <div className={`sidebar-footer integration-${zabbixStatus?.health_status ?? 'unknown'}`}><span className="pulse" /> {zabbixStatus?.health_status === 'healthy' ? 'Zabbix sincronizado' : zabbixStatus?.health_status === 'unavailable' ? 'Zabbix indisponível' : zabbixStatus?.health_status === 'degraded' ? 'Zabbix em atenção' : 'Zabbix aguardando coleta'}<small>{zabbixStatus?.last_success_at ? `última coleta · ${new Date(zabbixStatus.last_success_at).toLocaleTimeString('pt-BR')}` : 'ciclo automático · 60s'}</small></div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">CENTRO DE COMANDO · {session.tenant.name}</p><h1>Consciência operacional</h1>
            <nav className="breadcrumb" aria-label="Navegação" style={lockedStyle}>
              <button className="breadcrumb-home" onClick={() => { setProfileModalOpen(false); setView('command'); setCommandScope('all'); setSelectedUnitId(null); }} aria-label="Ir para o início"><HomeIcon /></button>
              <BreadcrumbChevronIcon />
              {profileModalOpen ? <span className="breadcrumb-item current">Editar perfil</span> : <>
              <button className={`breadcrumb-item ${!selectedUnitId && !(view === 'users' && (usersCreating || usersEditing)) && !((view === 'mobile-units' || view === 'fixed-units') && (unitCreating || editingUnitId || editingEquipmentId)) && (view !== 'command' || commandScope === 'all') ? 'current' : ''}`} onClick={() => { setSelectedUnitId(null); setUsersCreating(false); setEditingUserId(null); setUnitCreating(false); setEquipmentCreating(false); setEditingUnitId(null); setEditingEquipmentId(null); if (view === 'command') setCommandScope('all'); }}>{breadcrumbSectionLabel}</button>
              {view === 'users' && usersCreating && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Criar usuário</span></>}
              {view === 'users' && usersEditing && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Editar usuário</span></>}
              {(view === 'mobile-units' || view === 'fixed-units') && unitCreating && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Criar unidade</span></>}
              {view === 'command' && commandScope !== 'all' && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">{scopeLabelFor(commandScope)}</span></>}
              {(view === 'mobile-units' || view === 'fixed-units') && selectedUnit && <><BreadcrumbChevronIcon /><span className={`breadcrumb-item ${equipmentCreating || editingUnitId || editingEquipmentId ? '' : 'current'}`}>{selectedUnit.code} · {selectedUnit.name}</span></>}
              {(view === 'mobile-units' || view === 'fixed-units') && selectedUnit && equipmentCreating && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Cadastrar equipamento</span></>}
              {(view === 'mobile-units' || view === 'fixed-units') && editingUnitId && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Editar unidade</span></>}
              {(view === 'mobile-units' || view === 'fixed-units') && editingEquipmentId && <><BreadcrumbChevronIcon /><span className="breadcrumb-item current">Editar equipamento</span></>}
              </>}
            </nav>
          </div>
          <div className="header-actions-group">
            <div className="user-profile-pill-wrapper" ref={userMenuRef}>
              <button className={`user-profile-pill ${userMenuOpen ? 'active' : ''}`} onClick={() => setUserMenuOpen((prev) => !prev)} aria-haspopup="menu" aria-expanded={userMenuOpen}>
                <span className="user-avatar-circle">{initialsFromName(session.user.displayName)}</span>
                <span className="user-profile-identity-text">
                  <strong>{session.user.displayName.split(' ')[0] || 'admin'}</strong>
                  <small>{roleLabel(session.tenant.roles)}</small>
                </span>
                <span className="user-chevron"><ChevronIcon up={userMenuOpen} /></span>
              </button>
              {userMenuOpen && (
                <div className="user-profile-dropdown" role="menu" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="user-profile-identity">
                    <strong title={session.user.displayName}>{session.user.displayName}</strong>
                    <small title={session.user.email}>{session.user.email}</small>
                  </div>
                  <div className="dropdown-divider" />
                  <button role="menuitem" className="dropdown-item" disabled={sessionExpired} onClick={() => { setUserMenuOpen(false); setProfileModalOpen(true); }}>
                    <span className="dropdown-item-icon"><EditIcon /></span>
                    <span>Editar perfil</span>
                  </button>
                  <div className="dropdown-divider" />
                  <button role="menuitem" className="dropdown-item logout" onClick={() => { sessionStorage.clear(); setJustLoggedOut(true); setSession(null); }}>
                    <span className="dropdown-item-icon"><LogoutIcon /></span>
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className="mission-strip" style={lockedStyle}><div><span className={`live-dot ${zabbixStatus?.health_status ?? 'unknown'}`} /> OPERAÇÃO MONITORADA</div><p>{activeAlertCount ? `${activeAlertCount} alerta(s) requerem avaliação` : 'Nenhum evento crítico em aberto'}</p><time>{new Date().toLocaleString('pt-BR')}</time></section>
        <section className="content" style={lockedStyle}>
          {error && (
            <div className="error-banner" role="alert">
              <span className="error-banner-icon"><WarningIcon /></span>
              <span className="error-banner-text">{error}</span>
              <button type="button" className="icon-button clear-filters-button error-banner-close" onClick={() => setError('')} aria-label="Fechar"><CloseIcon /></button>
            </div>
          )}
          {profileModalOpen ? <EditProfilePage session={session} onSaved={(newName) => { setSession({ ...session, user: { ...session.user, displayName: newName } }); addToast({ type: 'success', title: 'Perfil atualizado', detail: 'Nome de exibição salvo com sucesso.' }); }} onClose={() => setProfileModalOpen(false)} /> : view === 'alerts' ? <AlertsCenter alerts={alerts} mode={alertMode} loading={alertsLoading} onModeChange={setAlertMode} onAction={changeAlert} onRetry={() => void loadAlerts(alertMode).catch((r: Error) => setError(r.message))} /> : view === 'reports' ? <IncidentReports alerts={[...activeAlerts, ...resolvedAlerts]} units={units} onRefresh={() => { void Promise.all([loadAlerts('active'), loadResolvedAlerts()]); }} /> : view === 'users' ? <UsersPanel users={managedUsers} requests={accessRequests} loading={usersLoading} token={session.accessToken} onRefresh={loadUsers} onChange={changeUser} onToast={addToast} creating={usersCreating} onCreatingChange={setUsersCreating} editingUserId={editingUserId} onEditingUserIdChange={setEditingUserId} /> : view === 'command' ? <CommandCenter key={commandScope} units={units} equipment={equipment} agents={agents} alerts={activeAlerts} resolvedAlerts={resolvedAlerts} summary={summary} scope={commandScope} token={session.accessToken} onInventoryRefresh={refreshInventory} onError={setError} onSelectUnit={(unitId) => { const target = units.find((unit) => unit.unit_id === unitId); setSelectedUnitId(unitId); setView(getUnitInventoryView(target?.unit_type ?? 'mobile')); }} onEditUnit={(unitId) => { const target = units.find((unit) => unit.unit_id === unitId); setSelectedUnitId(unitId); setEditingUnitId(unitId); setView(getUnitInventoryView(target?.unit_type ?? 'mobile')); }} onOpenReports={() => { setSelectedUnitId(null); setView('reports'); }} onToast={addToast} /> : view === 'connections' ? <ConnectionStatus integrationStatus={zabbixStatus} onRefresh={loadZabbixStatus} onOpenZabbix={() => { setView('zabbix'); void loadZabbixCandidates(); }} /> : view === 'zabbix' ? <ZabbixIntegration candidates={zabbixCandidates} units={units} loading={zabbixLoading} onRefresh={loadZabbixCandidates} onStatusRefresh={loadZabbixStatus} onInventoryRefresh={refreshInventory} onAlertsRefresh={refreshAlerts} onError={setError} onToast={addToast} token={session.accessToken} /> : <Fragment key={view}><InventoryActions token={session.accessToken} selectedUnit={selectedUnit} creating={equipmentCreating} onCreatingChange={setEquipmentCreating} onRefresh={refreshInventory} onError={(message) => { setError(message); addToast({ type: 'error', title: 'Falha no cadastro', detail: message }); }} onToast={addToast} /><UnitsView units={units.filter((unit) => unit.unit_type === (view === 'mobile-units' ? 'mobile' : 'fixed'))} selectedUnit={selectedUnit} selectedEquipment={selectedEquipment} loading={loading} summary={{ online: units.filter((u) => u.unit_type === (view === 'mobile-units' ? 'mobile' : 'fixed') && u.operational_status === 'online').length, attention: units.filter((u) => u.unit_type === (view === 'mobile-units' ? 'mobile' : 'fixed') && u.operational_status === 'degraded').length, offline: units.filter((u) => u.unit_type === (view === 'mobile-units' ? 'mobile' : 'fixed') && u.operational_status === 'offline').length, unknown: units.filter((u) => u.unit_type === (view === 'mobile-units' ? 'mobile' : 'fixed') && u.operational_status === 'unknown').length }} unitType={view === 'mobile-units' ? 'mobile' : 'fixed'} creating={unitCreating} onCreatingChange={setUnitCreating} equipmentCreating={equipmentCreating} editingUnitId={editingUnitId} onEditingUnitIdChange={setEditingUnitId} editingEquipmentId={editingEquipmentId} onEditingEquipmentIdChange={setEditingEquipmentId} onCreateEquipment={(id) => { setSelectedUnitId(id); setEquipmentCreating(true); }} onSelectUnit={setSelectedUnitId} onBack={() => setSelectedUnitId(null)} onInventoryRefresh={refreshInventory} token={session.accessToken} onToast={addToast} /></Fragment>}
        </section>
      </main>
      <ToastStack toasts={toasts} />
      {sessionExpired && (
        <div
          className="session-expired-exit-layer"
          role="button"
          tabIndex={0}
          aria-label="Sessão expirada. Toque para voltar ao login."
          onPointerDown={exitExpiredSession}
        />
      )}
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

const AGENT_PAGE_SIZE = 25;

function AgentOverview({ agents, onSelectUnit, filters }: { agents: AgentRecord[]; onSelectUnit: (unitId: string) => void; filters?: ReactNode }) {
  const online = agents.filter((agent) => agent.status === 'online').length;
  const offline = agents.filter((agent) => agent.status === 'offline').length;
  const pending = agents.filter((agent) => agent.status === 'pending').length;
  const unlinked = agents.filter((agent) => agent.status === 'unlinked').length;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(agents.length / AGENT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAgents = agents.slice((currentPage - 1) * AGENT_PAGE_SIZE, currentPage * AGENT_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [agents.length]);
  return <div className="agent-overview"><div className="command-summary"><CommandMetric label="Unidades móveis" value={String(agents.length)} note="no recorte atual" tone="neutral" /><CommandMetric label="Agentes em execução" value={String(online)} note="heartbeat ≤ 30s" tone="ok" /><CommandMetric label="Agentes parados" value={String(offline)} note="sem heartbeat recente" tone="danger" /><CommandMetric label="Sem vínculo" value={String(unlinked + pending)} note={pending ? `${pending} aguardando instalação` : 'nenhuma instalação pendente'} tone="warn" /></div>{filters}<div className="agent-panel panel"><div className="agent-list">{agents.length === 0 ? <div className="empty-state"><h3>Nenhuma unidade móvel encontrada</h3><p>Cadastre um servidor e uma fonte para gerar o agente.</p></div> : <><div className="agent-list-scroll">{pagedAgents.map((agent) => <button className={`agent-row agent-${agent.status}`} key={agent.unitId} onClick={() => onSelectUnit(agent.unitId)}><span><strong>{agent.unitCode} · {agent.unitName}</strong><small>{agent.city}/{agent.stateCode} · {agent.equipmentName ?? 'Nenhum servidor vinculado'}{agent.version ? ` · v${agent.version}` : ''}</small></span><em className={`status ${agent.status === 'online' || agent.status === 'offline' ? agent.status : agent.status === 'pending' ? 'pending' : 'unknown'}`}>{agentStatusLabel(agent.status)}</em></button>)}</div>{totalPages > 1 && <div className="pagination"><button type="button" className="secondary-button compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" className="secondary-button compact" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>}</>}</div></div></div>;
}

function CommandCenter({ units, equipment, agents, alerts: _alerts, resolvedAlerts, summary: _summary, scope, token, onInventoryRefresh, onError, onSelectUnit, onEditUnit, onOpenReports, onToast = () => undefined }: { units: Unit[]; equipment: Equipment[]; agents: AgentRecord[]; alerts: Alert[]; resolvedAlerts: Alert[]; summary: { online: number; attention: number; offline: number; unknown: number }; scope: 'all' | 'links' | 'agents' | 'servers'; token: string; onInventoryRefresh: () => Promise<void>; onError: (message: string) => void; onSelectUnit: (unitId: string) => void; onEditUnit: (unitId: string) => void; onOpenReports: () => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [stateMapCode, setStateMapCode] = useState<string | null>(null);
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [mapContext, setMapContext] = useState<{ stateCode: string; x: number; y: number } | null>(null);
  const [quickCreateStateCode, setQuickCreateStateCode] = useState<string | null>(null);
  const [equipmentModalUnit, setEquipmentModalUnit] = useState<Unit | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Unit['operational_status']>('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | Unit['unit_type']>('all');
  const [linkTelemetry, setLinkTelemetry] = useState<LinkTelemetry[]>([]);
  const scopeTypeCodes = scope === 'links' ? ['internet_link'] : scope === 'servers' ? ['linux_server', 'server'] : [];
  const agentUnitIds = scope === 'agents' ? new Set(agents.map((agent) => agent.unitId)) : null;
  const scopedUnitIds = agentUnitIds ?? (scopeTypeCodes.length ? new Set(equipment.filter((item) => scopeTypeCodes.some((code) => item.equipment_type.toLowerCase().includes(code))).map((item) => item.unit_id)) : null);
  const visibleUnits = scopedUnitIds ? units.filter((unit) => scopedUnitIds.has(unit.unit_id)) : units;
  const visibleUnitCodes = new Set(visibleUnits.map((unit) => unit.code));
  const visibleEquipment = equipment.filter((item) => visibleUnitCodes.has(units.find((unit) => unit.unit_id === item.unit_id)?.code ?? ''));
  const alerts = scope === 'all' ? _alerts : _alerts.filter((alert) => alert.unit_code ? visibleUnitCodes.has(alert.unit_code) : false);
  const scopedResolvedAlerts = scope === 'all' ? resolvedAlerts : resolvedAlerts.filter((alert) => alert.unit_code ? visibleUnitCodes.has(alert.unit_code) : false);
  const filteredUnits = visibleUnits.filter((unit) => (unitTypeFilter === 'all' || unit.unit_type === unitTypeFilter) && (stateFilter === 'all' || unit.state_code.toUpperCase() === stateFilter) && (statusFilter === 'all' || unit.operational_status === statusFilter));
  const visibleSummary = { online: filteredUnits.filter((unit) => unit.operational_status === 'online').length, attention: filteredUnits.filter((unit) => unit.operational_status === 'degraded').length, offline: filteredUnits.filter((unit) => unit.operational_status === 'offline').length, unknown: filteredUnits.filter((unit) => unit.operational_status === 'unknown').length };
  const summary = visibleSummary;
  const selectedUnits = filteredUnits.filter((unit) => unit.state_code.toUpperCase() === selectedStateCode);
  const availability = filteredUnits.length ? Math.round((visibleSummary.online / filteredUnits.length) * 100) : 0;
  const hoveredUnits = filteredUnits.filter((unit) => unit.state_code.toUpperCase() === hoveredStateCode);
  const hoveredStatus = hoveredUnits.length && hoveredUnits.every((unit) => unit.operational_status === 'online') ? 'online' : hoveredUnits.some((unit) => unit.operational_status === 'offline') ? 'offline' : hoveredUnits.some((unit) => unit.operational_status === 'degraded') ? 'degraded' : 'unknown';
  const stateOptions = [...new Set(visibleUnits.map((unit) => unit.state_code.toUpperCase()))].sort();
  const scopeLabel = scope === 'all' ? 'Geral' : scope === 'links' ? 'Links' : scope === 'agents' ? 'Agentes' : 'Servidores';
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
  const filtersBar = <div className="command-filters"><div className="command-filter-summary"><p className="eyebrow">FILTROS OPERACIONAIS</p><strong>{filteredUnits.length} unidade(s) no recorte atual</strong></div><div className="command-filter-controls"><label>Tipo de unidade<AppDropdown value={unitTypeFilter} onChange={(next) => setUnitTypeFilter(next as typeof unitTypeFilter)} options={[{ value: 'all', label: 'Todas' }, { value: 'fixed', label: 'Unidades fixas' }, { value: 'mobile', label: 'Unidades móveis' }]} /></label><label>Situação<AppDropdown value={statusFilter} onChange={(next) => setStatusFilter(next as typeof statusFilter)} options={[{ value: 'all', label: 'Todas' }, { value: 'online', label: 'Operacionais' }, { value: 'degraded', label: 'Em atenção' }, { value: 'offline', label: 'Indisponíveis' }, { value: 'unknown', label: 'Sem telemetria' }]} /></label><label>UF<AppDropdown value={stateFilter} onChange={(next) => { setStateFilter(next); setSelectedStateCode(next === 'all' ? null : next); }} options={[{ value: 'all', label: 'Brasil inteiro' }, ...stateOptions.map((code) => ({ value: code, label: `${code} · ${stateNameByCode[code] ?? code}` }))]} /></label>{(unitTypeFilter !== 'all' || stateFilter !== 'all' || statusFilter !== 'all') && <button type="button" className="secondary-button compact clear-filters-button" onClick={() => { setUnitTypeFilter('all'); setStateFilter('all'); setStatusFilter('all'); setSelectedStateCode(null); }}><ClearFilterIcon /> Limpar filtros</button>}</div></div>;
  return <section className="command-center">
    {scope !== 'agents' && stateMapCode && createPortal(<StateLocationMap stateCode={stateMapCode} units={filteredUnits.filter((unit) => unit.state_code.toUpperCase() === stateMapCode)} equipment={visibleEquipment} telemetry={linkTelemetry} alerts={[..._alerts, ...resolvedAlerts]} onClose={() => setStateMapCode(null)} onSelectUnit={onSelectUnit} onEditUnit={onEditUnit} onOpenReports={onOpenReports} onLocateUnit={onSelectUnit} onAddEquipment={setEquipmentModalUnit} onDiagnostic={async (target, action) => api<DiagnosticResult>(`/v1/equipment/${target.equipment_id}/diagnostics`, token, { method: 'POST', body: JSON.stringify({ action }) })} />, document.body)}
    {equipmentModalUnit && createPortal(<EquipmentForm token={token} unit={equipmentModalUnit} onCreated={async () => { setEquipmentModalUnit(null); await onInventoryRefresh(); }} onCancel={() => setEquipmentModalUnit(null)} onError={onError} onToast={onToast} />, document.body)}
    <div className="section-heading units-module-heading command-scope-heading"><div><p className="eyebrow">CENTRO OPERACIONAL · VISÃO FILTRADA</p><h2>{scopeLabel}</h2><small>{scope === 'all' ? 'Todas as unidades e equipamentos monitorados.' : `Unidades com equipamentos classificados como ${scopeLabel.toLowerCase()}.`}</small></div></div>
    {quickCreateStateCode && <div className="map-quick-create"><UnitForm token={token} initialStateCode={quickCreateStateCode} onCreated={async () => { setQuickCreateStateCode(null); await onInventoryRefresh(); }} onCancel={() => setQuickCreateStateCode(null)} onToast={onToast} /></div>}
    {scope !== 'agents' && <div className="command-summary">
      <CommandMetric label="Total unidades" value={String(visibleUnits.length)} note="inventário monitorado" tone="neutral" />
      <CommandMetric label="Online" value={String(summary.online)} note={`${availability}% respondendo`} tone="ok" />
      <CommandMetric label="Offline" value={String(summary.offline)} note="sem comunicação" tone="danger" />
      <CommandMetric label="Degradadas" value={String(summary.attention)} note="exigem atenção" tone="warn" />
      <CommandMetric label="Disponibilidade média" value={`${availability}%`} note="janela operacional" tone="cyan" />
      <CommandMetric label="Alertas críticos" value={String(alerts.filter((alert) => alert.severity >= 4).length)} note={`${alerts.length} em aberto`} tone="danger" />
    </div>}
    {scope !== 'agents' && filtersBar}
    {scope === 'agents' && <AgentOverview agents={agents.filter((agent) => filteredUnits.some((unit) => unit.code === agent.unitCode))} onSelectUnit={onSelectUnit} filters={filtersBar} />}
    {scope !== 'agents' && <div className="command-grid">
      <article className="map-panel">
        <div className="panel-heading"><div><p className="eyebrow">MONITORAMENTO · BRASIL INTEIRO</p><h2>Mapa operacional</h2><small>Clique em um estado para filtrar a operação.</small></div><div className="map-supervisor"><span>CONTROLE SUPERVISOR</span><strong>NOC · acesso auditado</strong></div></div>
        <div className="map-stage"><svg className="brazil-map brazil-vector-map" viewBox={brazilMap.viewBox} role="img" aria-label="Mapa interativo do Brasil">
          {mapLocations.map((location) => {
            const code = location.id.toUpperCase();
            const stateUnits = filteredUnits.filter((unit) => unit.state_code.toUpperCase() === code);
            const status = stateUnits.length && stateUnits.every((unit) => unit.operational_status === 'online') ? 'online' : stateUnits.some((unit) => unit.operational_status === 'offline') && stateUnits.filter((unit) => unit.operational_status === 'offline').length / stateUnits.length > 0.5 ? 'offline' : stateUnits.some((unit) => unit.operational_status === 'offline' || unit.operational_status === 'degraded') ? 'degraded' : 'unknown';
            const unit = stateUnits[0];
            const stateName = stateNameByCode[code] ?? location.name;
            return <path key={code} d={location.path} className={`map-location ${status} ${selectedStateCode === code ? 'selected' : ''}`} fill={getStateFill(code, filteredUnits)} tabIndex={0} role="button" aria-label={`${stateName} (${code}) · ${statusLabel[status]}`} onMouseEnter={() => setHoveredStateCode(code)} onMouseLeave={() => setHoveredStateCode(null)} onFocus={() => setHoveredStateCode(code)} onBlur={() => setHoveredStateCode(null)} onClick={() => { setSelectedStateCode(code); setStateMapCode(code); setMapContext(null); }} onContextMenu={(event) => { event.preventDefault(); setSelectedStateCode(code); setHoveredStateCode(null); const posX = event.clientX + 260 > window.innerWidth ? Math.max(12, event.clientX - 260) : event.clientX; const posY = event.clientY + 180 > window.innerHeight ? Math.max(12, event.clientY - 180) : event.clientY; setMapContext({ stateCode: code, x: posX, y: posY }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedStateCode(code); setStateMapCode(code); } }} />;
          })}
        </svg>{hoveredStateCode && <div className="map-tooltip"><span>{hoveredStateCode}</span><strong>{stateNameByCode[hoveredStateCode] ?? mapLocations.find((location) => location.id.toUpperCase() === hoveredStateCode)?.name}</strong><small>{hoveredUnits.length ? `${hoveredUnits.length} unidade(s) · ${statusLabel[hoveredStatus]}` : 'Nenhuma unidade cadastrada'}</small></div>}</div>
        <div className="map-selection">{selectedStateCode ? <><strong>{selectedStateCode}</strong><span>{selectedUnits.length ? `${selectedUnits.length} unidade(s) · ${statusLabel[hoveredStatus]}` : 'Nenhuma unidade cadastrada neste estado'}</span><button className="primary compact map-open-detail" onClick={() => setStateMapCode(selectedStateCode)}><MapIcon /> Explorar mapa</button></> : <span>Selecione um estado no mapa para consultar a prontidão local.</span>}</div>
        {selectedStateCode && selectedUnits.length > 0 && <div className="map-unit-list">{selectedUnits.map((unit) => <button key={unit.unit_id} className={unit.operational_status} onClick={() => onSelectUnit(unit.unit_id)}><span><strong>{unit.code}</strong><small>{unit.name}</small></span><span className={`status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span></button>)}</div>}
        <div className="map-legend"><span><i className="legend-dot online" /> 100% online</span><span><i className="legend-dot degraded" /> Atenção / instável</span><span><i className="legend-dot offline" /> &gt;50% offline</span><span><i className="legend-dot unknown" /> Sem unidades</span><span><i className="legend-dot selected" /> UF selecionada</span></div>
      </article>
      <OperationalOverview units={filteredUnits} equipment={visibleEquipment} alerts={alerts} resolvedAlerts={scopedResolvedAlerts} summary={summary} onSelectUnit={onSelectUnit} />
    </div>}
    {mapContext && <div className="map-context-card" style={{ left: mapContext.x, top: mapContext.y }} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button clear-filters-button map-context-close" aria-label="Fechar" onClick={() => setMapContext(null)}><CloseIcon /></button><p>AÇÃO RÁPIDA · {mapContext.stateCode}</p><strong>{stateNameByCode[mapContext.stateCode] ?? mapContext.stateCode}</strong><small>Cadastre uma unidade diretamente neste estado.</small><button className="primary compact" onClick={() => { setQuickCreateStateCode(mapContext.stateCode); setMapContext(null); }}><PlusIcon /> Adicionar unidade</button></div>}
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

function formatPercent(value?: number, digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`;
}

function isLinkEquipmentType(type: string) {
  return ['mikrotik', 'starlink', 'vpn', 'internet_link'].includes(type);
}

function LinkSparkline({ values, status }: { values: number[]; status: Unit['operational_status'] }) {
  const sparkline = buildPingSparkline(values);
  const points = sparkline.points.map((point) => `${point.x},${point.y}`).join(' ');
  return <svg className={`link-sparkline ${status}`} viewBox="0 0 86 30" role="img" aria-label="Histórico recente de latência em escala de 0 a 250 milissegundos"><polyline className="link-sparkline-back" points={points} /><polyline className="link-sparkline-front" points={points} /><circle cx={sparkline.last.x} cy={sparkline.last.y} r="2.5" /></svg>;
}

function LinkTelemetryCard({ unit, link, located, diagnosticLatencyMs, onView, onContext }: { unit: Unit; link?: LinkTelemetry; located: boolean; diagnosticLatencyMs?: number; onView: () => void; onContext: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const equipmentType = link?.equipment_type ?? '';
  if (equipmentType === 'starlink') return <StarlinkLinkCard unit={unit} link={link} located={located} onView={onView} onContext={onContext} />;
  if (equipmentType === 'vpn' || /ipsec|vpn/i.test(link?.equipment_name ?? '')) return <TunnelStatusCard unit={unit} link={link} located={located} onView={onView} onContext={onContext} />;
  const metrics = link?.metrics ?? {};
  const telemetryStale = link?.telemetry_stale ?? (!link?.observed_at || Date.now() - new Date(link.observed_at).getTime() > 30_000);
  const manualPing = Number.isFinite(diagnosticLatencyMs);
  const stale = telemetryStale && !manualPing;
  const latency = manualPing ? diagnosticLatencyMs : stale ? 0 : metrics['network.latency.ms'];
  const loss = stale ? 0 : metrics['network.loss.pct'];
  const inbound = stale ? 0 : metrics['network.in.bps'];
  const outbound = stale ? 0 : metrics['network.out.bps'];
  const status = unit.operational_status;
  const statusCode = status === 'online' ? 'OPR' : status === 'degraded' ? 'ATN' : status === 'offline' ? 'DWN' : 'N/D';
  const statusIcon = status === 'online' ? '◆' : status === 'degraded' ? '△' : status === 'offline' ? '⇩' : '○';
  return <article className={`state-link-card ${status} ${stale ? 'telemetry-zeroed' : ''} ${located ? '' : 'pending'}`} role="button" tabIndex={0} aria-label={`${located ? 'Focalizar' : 'Localizar'} ${link?.equipment_name ?? unit.name}`} onClick={onView} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(); } }} onContextMenu={onContext}>
    <div className="state-link-card-head"><strong>{link?.equipment_name ?? unit.name}</strong><span className="state-link-health-icon" aria-label={statusLabel[status]}>{statusIcon}</span><span className="state-link-badge">{statusCode}</span></div>
    <div className="state-link-card-body">
      <div className="state-link-values"><span>Latência: <b>{formatLatencyMs(latency)}</b></span><span>Perda: <b>{formatPercent(loss, 1)}</b></span><span>↓ Download: <b>{formatLinkRate(inbound)}</b></span><span>↑ Upload: <b>{formatLinkRate(outbound)}</b></span></div>
      <LinkSparkline values={stale || diagnosticLatencyMs === undefined ? (link?.latency_history ?? []).map((point) => point.value) : [...(link?.latency_history ?? []).slice(-13).map((point) => point.value), diagnosticLatencyMs]} status={status} />
      <span className="state-link-open-hint">{located ? '›' : '+'}</span>
    </div>
    {stale && <div className="state-link-zero-warning"><WarningIcon /> TELEMETRIA ZERADA · SEM COMUNICAÇÃO</div>}
    <div className="state-link-card-meta"><span>{unit.code} · {unit.city}</span><span>Plano: ↓ {formatContractedMbps(link?.contracted_download_mbps)} · ↑ {formatContractedMbps(link?.contracted_upload_mbps)}</span><small>{manualPing ? 'PING MANUAL' : stale ? 'TELEMETRIA ZERADA' : link?.observed_at ? new Date(link.observed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'SEM TELEMETRIA'}</small></div>
  </article>;
}

function TunnelStatusCard({ unit, link, located, onView, onContext }: { unit: Unit; link?: LinkTelemetry; located: boolean; onView: () => void; onContext: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const status = unit.operational_status;
  const label = status === 'online' ? 'TÚNEL UP' : status === 'offline' ? 'TÚNEL DOWN' : status === 'degraded' ? 'ATENÇÃO' : 'SEM ESTADO';
  return <article className={`state-link-card tunnel-card ${status} ${located ? '' : 'pending'}`} role="button" tabIndex={0} aria-label={`${located ? 'Focalizar' : 'Localizar'} ${link?.equipment_name ?? unit.name}`} onClick={onView} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(); } }} onContextMenu={onContext}>
    <div className="state-link-card-head"><strong>{link?.equipment_name ?? unit.name}</strong><span className="state-link-health-icon">{status === 'online' ? '◆' : status === 'offline' ? '⇩' : '○'}</span><span className="state-link-badge">{label}</span></div>
    <div className="tunnel-status-body"><strong>{status === 'online' ? 'Conectividade do túnel normal' : status === 'offline' ? 'Túnel indisponível' : 'Aguardando estado do túnel'}</strong><small>IPsec/VPN · monitoramento por estado</small></div>
    <div className="state-link-card-meta"><span>{unit.code} · {unit.city}</span><small>{link?.observed_at ? `VERIFICADO ${new Date(link.observed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'SEM VERIFICAÇÃO'}</small></div>
  </article>;
}

function StarlinkLinkCard({ unit, link, located, onView, onContext }: { unit: Unit; link?: LinkTelemetry; located: boolean; onView: () => void; onContext: (event: ReactMouseEvent<HTMLElement>) => void }) {
  const metrics = link?.metrics ?? {};
  const stale = link?.telemetry_stale ?? !link?.observed_at;
  const status = unit.operational_status;
  return <article className={`state-link-card starlink-card ${status} ${located ? '' : 'pending'}`} role="button" tabIndex={0} aria-label={`${located ? 'Focalizar' : 'Localizar'} ${link?.equipment_name ?? unit.name}`} onClick={onView} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(); } }} onContextMenu={onContext}>
    <div className="state-link-card-head"><strong>{link?.equipment_name ?? unit.name}</strong><span className="state-link-health-icon">✦</span><span className="state-link-badge">{status === 'online' ? 'STARLINK' : status === 'degraded' ? 'ATENÇÃO' : status === 'offline' ? 'DOWN' : 'N/D'}</span></div>
    <div className="state-link-values"><span>Latência: <b>{stale ? '—' : formatLatencyMs(metrics['starlink.latency.ms'])}</b></span><span>Download: <b>{stale ? '—' : formatLinkRate(metrics['starlink.download.bps'])}</b></span><span>Upload: <b>{stale ? '—' : formatLinkRate(metrics['starlink.upload.bps'])}</b></span></div>
    <div className="starlink-card-note">Telemetria da antena · agente local</div>
    <div className="state-link-card-meta"><span>{unit.code} · {unit.city}</span><small>{stale ? 'SEM TELEMETRIA' : 'COLETOR STARLINK'}</small></div>
  </article>;
}

function LinkAnalysisPanel({ unit, link, alerts, diagnosticLatencyMs, targetEquipment, onDiagnostic, onClose, onOpenInventory }: { unit: Unit; link?: LinkTelemetry; alerts: Alert[]; diagnosticLatencyMs?: number; targetEquipment?: Equipment; onDiagnostic?: (action: 'ping' | 'tracert') => void; onClose: () => void; onOpenInventory: () => void }) {
  const [hoveredLatency, setHoveredLatency] = useState<{ value: number; observedAt: string; left: number; top: number } | null>(null);
  const metrics = link?.metrics ?? {};
  const telemetryStale = link?.telemetry_stale ?? (!link?.observed_at || Date.now() - new Date(link.observed_at).getTime() > 30_000);
  const effectiveDiagnosticLatency = Number.isFinite(diagnosticLatencyMs) ? diagnosticLatencyMs : undefined;
  const stale = telemetryStale && effectiveDiagnosticLatency === undefined;
  const latency = effectiveDiagnosticLatency ?? (stale ? 0 : metrics['network.latency.ms']);
  const loss = stale ? 0 : metrics['network.loss.pct'];
  const inbound = stale ? 0 : metrics['network.in.bps'];
  const outbound = stale ? 0 : metrics['network.out.bps'];
  const history = stale ? [] : link?.latency_history ?? [];
  const chartHistory = effectiveDiagnosticLatency === undefined ? history : [...history.slice(-13), { value: effectiveDiagnosticLatency, observed_at: new Date().toISOString() }];
  const chartSeries = chartHistory.length > 1 ? chartHistory.map((point) => point.value) : [0, 0];
  const maximum = Math.max(1, ...chartSeries);
  const chartPoints = chartSeries.map((value, index) => `${(index / (chartSeries.length - 1)) * 680},${190 - (value / maximum) * 155}`).join(' ');
  const linkErrors = alerts
    .filter((alert) => link?.equipment_id ? alert.equipment_id === link.equipment_id : alert.unit_id === unit.unit_id || alert.unit_code === unit.code)
    .sort((first, second) => new Date(second.resolved_at ?? second.opened_at).getTime() - new Date(first.resolved_at ?? first.opened_at).getTime())
    .slice(0, 8);
  return <div className="link-analysis-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="link-analysis-dialog" role="dialog" aria-modal="true" aria-label={`Análise detalhada de ${link?.equipment_name ?? unit.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="link-analysis-header"><div><p className="eyebrow">ANÁLISE DETALHADA · LINK</p><h2>{link?.equipment_name ?? unit.name}</h2><small>{unit.code} · {unit.name} · {unit.city}/{unit.state_code}</small></div><button className="icon-button clear-filters-button" onClick={onClose} aria-label="Fechar análise"><CloseIcon /></button></header>
      <div className="link-analysis-content">
        <article className={`link-analysis-identity ${unit.operational_status}`}><div className="link-analysis-title"><div><span>LINK MONITORADO</span><strong>{link?.equipment_name ?? unit.name}</strong><small>Unidade {unit.code}</small></div><i /></div><div className="link-analysis-status-grid"><div><span>STATUS ATUAL</span><strong>{statusLabel[unit.operational_status]}</strong></div><div><span>{effectiveDiagnosticLatency === undefined ? 'ÚLTIMA AMOSTRA' : 'ÚLTIMO PING'}</span><strong>{effectiveDiagnosticLatency !== undefined ? `${formatLatencyMs(effectiveDiagnosticLatency)} · medição manual` : stale ? 'Telemetria zerada' : link?.observed_at ? new Date(link.observed_at).toLocaleString('pt-BR') : 'Sem telemetria'}</strong></div></div>{stale && <div className="link-analysis-zero-warning"><WarningIcon /> {link?.telemetry_error ?? 'Telemetria zerada: sem comunicação recente.'}</div>}<div className="link-analysis-command-actions"><button type="button" disabled={!targetEquipment?.management_address} onClick={() => onDiagnostic?.('ping')}><PingIcon /> Ping</button><button type="button" disabled={!targetEquipment?.management_address} onClick={() => onDiagnostic?.('tracert')}><TracertIcon /> Tracert</button></div>{!targetEquipment?.management_address && <small className="link-analysis-command-hint">Cadastre o endereço de gerenciamento para habilitar os comandos.</small>}<button onClick={onOpenInventory}>Abrir inventário completo</button></article>
        <article className="link-analysis-chart"><div className="link-analysis-section-head"><div><h3>Latência (ms)</h3><small>{effectiveDiagnosticLatency === undefined ? 'AMOSTRAS RECENTES DO ZABBIX · passe o mouse nos pontos' : 'ÚLTIMO PING LOCAL · MEDIÇÃO MANUAL'}</small></div><strong>{formatLatencyMs(hoveredLatency?.value ?? latency)}</strong></div><div className="link-chart-stage"><span>{formatLatencyMs(maximum)}</span><span>0 ms</span><svg viewBox="0 0 680 210" preserveAspectRatio="none" onMouseMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const index = nearestLatencyIndex(event.clientX - bounds.left, bounds.width, chartHistory.length); const point = chartHistory[index]; if (point) setHoveredLatency({ value: point.value, observedAt: point.observed_at, left: Math.max(74, Math.min(bounds.width - 74, event.clientX - bounds.left)), top: Math.max(52, event.clientY - bounds.top) }); }} onMouseLeave={() => setHoveredLatency(null)}><line x1="0" y1="35" x2="680" y2="35" /><line x1="0" y1="87" x2="680" y2="87" /><line x1="0" y1="139" x2="680" y2="139" /><line x1="0" y1="190" x2="680" y2="190" /><polyline className={unit.operational_status} points={chartPoints} />{chartHistory.map((point, index) => { const x = (index / Math.max(1, chartHistory.length - 1)) * 680; const y = 190 - (point.value / maximum) * 155; const showTooltip = (event: ReactMouseEvent<SVGCircleElement>) => { const stage = event.currentTarget.ownerSVGElement?.parentElement; if (!stage) return; const bounds = stage.getBoundingClientRect(); setHoveredLatency({ value: point.value, observedAt: point.observed_at, left: Math.max(74, Math.min(bounds.width - 74, event.clientX - bounds.left)), top: Math.max(52, event.clientY - bounds.top) }); }; return <circle className="link-chart-point" key={`${point.observed_at}-${index}`} cx={x} cy={y} r="5" onMouseEnter={showTooltip} onMouseMove={showTooltip}><title>{`${formatLatencyMs(point.value)} · ${new Date(point.observed_at).toLocaleString('pt-BR')}`}</title></circle>; })}</svg>{hoveredLatency && <div className="link-chart-tooltip" style={{ left: hoveredLatency.left, top: hoveredLatency.top }}><strong>{formatLatencyMs(hoveredLatency.value)}</strong><small>{new Date(hoveredLatency.observedAt).toLocaleString('pt-BR')}</small></div>}{chartHistory.length < 2 && effectiveDiagnosticLatency === undefined && <div className="link-chart-empty">{stale ? 'Telemetria zerada: aguardando comunicação' : 'Aguardando histórico da coleta rápida'}</div>}</div></article>
        <div className="link-analysis-metrics"><article><span>PERDA DE PACOTES</span><strong>{formatPercent(loss, 2)}</strong><small>última amostra válida</small></article><article><span>DOWNLOAD ATUAL</span><strong>{formatLinkRate(inbound)}</strong><small>tráfego recebido na interface WAN</small></article><article><span>UPLOAD ATUAL</span><strong>{formatLinkRate(outbound)}</strong><small>tráfego enviado pela interface WAN</small></article><article><span>VELOCIDADE CONTRATADA</span><strong>↓ {formatContractedMbps(link?.contracted_download_mbps)}<br />↑ {formatContractedMbps(link?.contracted_upload_mbps)}</strong><small>download e upload cadastrados</small></article></div>
        <article className="link-error-history"><div className="link-error-history-head"><div><span>HISTÓRICO DE ERROS</span><strong>Ocorrências do link</strong></div><small>{linkErrors.length + (stale ? 1 : 0)} registro(s)</small></div>{linkErrors.length === 0 && !stale ? <div className="link-error-empty"><i>✓</i><div><strong>Nenhum erro registrado</strong><small>Alertas do Zabbix vinculados a este link aparecerão aqui.</small></div></div> : <div className="link-error-list">{stale && <div className="link-error-row offline telemetry-zero-error"><span className="link-error-indicator" /><div><strong>Telemetria zerada: sem comunicação</strong><small>{link?.telemetry_error ?? 'Nenhuma amostra válida recebida nos últimos 30 segundos.'}</small></div><span className="status offline">Aberto</span></div>}{linkErrors.map((alert) => { const statusTone = alert.status === 'resolved' ? 'online' : alert.status === 'acknowledged' ? 'degraded' : 'offline'; return <div className={`link-error-row ${statusTone}`} key={alert.id}><span className="link-error-indicator" /><div><strong>{alert.title}</strong><small>{new Date(alert.opened_at).toLocaleString('pt-BR')}{alert.resolved_at ? ` · resolvido em ${new Date(alert.resolved_at).toLocaleString('pt-BR')}` : ''}</small></div><span className={`status ${statusTone}`}>{alert.status === 'resolved' ? 'Resolvido' : alert.status === 'acknowledged' ? 'Reconhecido' : 'Aberto'}</span></div>; })}</div>}</article>
      </div>
    </section>
  </div>;
}

function StateLocationMap({ stateCode, units, equipment = [], telemetry = [], alerts = [], onClose, onSelectUnit, onEditUnit, onOpenReports, onLocateUnit, onAddEquipment, onDiagnostic }: { stateCode: string; units: Unit[]; equipment?: Equipment[]; telemetry?: LinkTelemetry[]; alerts?: Alert[]; onClose: () => void; onSelectUnit: (unitId: string) => void; onEditUnit: (unitId: string) => void; onOpenReports: () => void; onLocateUnit: (unitId: string) => void; onAddEquipment: (unit: Unit) => void; onDiagnostic: (equipment: DiagnosticTargetCandidate, action: 'ping' | 'tracert') => Promise<DiagnosticResult> }) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedLink, setSelectedLink] = useState<LinkTelemetry | null>(null);
  const [diagnosticEquipmentId, setDiagnosticEquipmentId] = useState<string | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(() => new Set());
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [unitContext, setUnitContext] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [diagnosticLatencyByUnit, setDiagnosticLatencyByUnit] = useState<Record<string, number>>({});
  const [diagnostic, setDiagnostic] = useState<{ unit: Unit; action: 'ping' | 'tracert'; status: 'running' | 'done' | 'error'; result?: DiagnosticResult; message?: string } | null>(null);
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('healthlink.map-theme') === 'light' ? 'light' : 'dark');
  // Começamos pelo estilo raster leve: ele evita aguardar o JSON de estilo
  // vetorial antes de mostrar o mapa e reduz o tempo de primeira pintura.
  const [mapFallback, setMapFallback] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [assetView, setAssetView] = useState<MapAssetView>('all');
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
  const telemetryByUnit = groupTelemetryByUnit(safeTelemetry);
  const mapAlertState = (unit: Unit) => getUnitMapAlertState(unit, alerts);
  const panelUnits = selectedUnit ? [selectedUnit, ...units.filter((unit) => unit.unit_id !== selectedUnit.unit_id)] : units;
  const toggleUnitExpanded = (unitId: string) => setExpandedUnitIds((current) => { const next = new Set(current); if (next.has(unitId)) { next.delete(unitId); if (unitContext?.unit.unit_id === unitId) setUnitContext(null); } else next.add(unitId); return next; });
  const expandUnitOnHover = (unitId: string) => setExpandedUnitIds((current) => current.has(unitId) ? current : new Set(current).add(unitId));
  const diagnosticTarget = (unit: Unit) => chooseDiagnosticTarget(equipment, unit.unit_id, diagnosticEquipmentId);
  const selectAsset = (unit: Unit, equipmentId: string, link?: LinkTelemetry) => {
    const selection = selectMapAsset(unit.unit_id, equipmentId);
    setSelectedUnit(unit);
    setSelectedLink(link ?? null);
    setDiagnosticEquipmentId(selection.equipment_id);
    setExpandedUnitIds((current) => new Set(current).add(unit.unit_id));
    setDetailUnit(link ? unit : null);
  };
  const openUnitContext = (unit: Unit, x: number, y: number, preferredEquipmentId?: string) => { setDiagnosticEquipmentId(chooseDiagnosticTarget(equipment, unit.unit_id, preferredEquipmentId)?.equipment_id ?? null); setUnitContext({ unit, x, y }); };
  const contextEquipment = unitContext ? equipment.filter((item) => item.unit_id === unitContext.unit.unit_id && Boolean(item.management_address?.trim())) : [];
  const runDiagnostic = async (unit: Unit, action: 'ping' | 'tracert') => {
    setUnitContext(null);
    setDiagnostic({ unit, action, status: 'running' });
    const target = diagnosticTarget(unit);
    if (!target) { setDiagnostic({ unit, action, status: 'error', message: 'Nenhum equipamento desta unidade possui endereço de gerenciamento cadastrado.' }); return; }
    try { const result = await onDiagnostic(target, action); if (action === 'ping' && result.success && Number.isFinite(result.latencyMs)) setDiagnosticLatencyByUnit((current) => ({ ...current, [unit.unit_id]: result.latencyMs as number })); setDiagnostic({ unit, action, status: 'done', result }); }
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
  useEffect(() => {
    setMapReady(false);
    // Alguns estilos rasterizados exibem os tiles, mas não disparam `load`
    // de forma consistente em redes locais. O mapa já está utilizável nesse
    // ponto, então removemos o overlay para não deixá-lo preso na tela.
    const readyFallback = window.setTimeout(() => setMapReady(true), 3000);
    return () => window.clearTimeout(readyFallback);
  }, [stateCode, mapTheme]);
  const changeMapTheme = (theme: 'dark' | 'light') => {
    if (mapTheme === theme) return;
    setMapTheme(theme);
    window.localStorage.setItem('healthlink.map-theme', theme);
    setMapFallback(true);
    setMapReady(false);
  };
  return <div className="state-map-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="state-map-dialog" role="dialog" aria-modal="true" aria-label={`Localização das unidades em ${stateNameByCode[stateCode] ?? stateCode}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="state-map-header"><div><p className="eyebrow">VISÃO GEOGRÁFICA · {stateCode}</p><h2>{stateNameByCode[stateCode] ?? stateCode}</h2><small>{units.length} unidade(s) no estado · {locatedUnits.length} georreferenciada(s)</small></div><div className="state-map-header-actions"><div className="map-theme-switch" role="group" aria-label="Tema do mapa"><span className={`map-theme-thumb ${mapTheme}`} /><button className={mapTheme === 'dark' ? 'active' : ''} onClick={() => changeMapTheme('dark')} aria-pressed={mapTheme === 'dark'}><MoonIcon /> Dark</button><button className={mapTheme === 'light' ? 'active' : ''} onClick={() => changeMapTheme('light')} aria-pressed={mapTheme === 'light'}><SunIcon /> Claro</button></div><button type="button" className="icon-button clear-filters-button state-map-close" onClick={onClose} aria-label="Fechar mapa"><CloseIcon /></button></div></header>
      <div className="state-map-body">
        <div className={`state-map-canvas ${mapTheme === 'light' ? 'map-theme-light' : ''} ${mapFallback ? 'map-raster-fallback' : ''}`}>
          <Map ref={mapRef} key={`${stateCode}-${mapTheme}-${mapFallback ? 'raster' : 'vector'}`} initialViewState={{ longitude, latitude, zoom: locatedUnits.length > 1 ? 8 : locatedUnits.length === 1 ? 12 : 6 }} mapStyle={mapFallback ? (mapTheme === 'dark' ? mapRasterFallbackStyle : mapRasterLightFallbackStyle) : (mapTheme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright')} onLoad={(event) => { setMapReady(true); if (mapBounds) { event.target.fitBounds([[mapBounds.minLng, mapBounds.minLat], [mapBounds.maxLng, mapBounds.maxLat]], { padding: 90, maxZoom: 12, duration: 0 }); } else if (locatedUnits.length === 1) { event.target.setZoom(12); } }} onIdle={() => setMapReady(true)} onError={() => setMapFallback(true)} attributionControl={{}}>
            <NavigationControl position="bottom-right" showCompass={false} />
            {locatedUnits.map((unit) => { const alertState = mapAlertState(unit); const alertLabel = alertState.alertCount ? ` · ${alertState.alertCount} alerta(s) ativo(s)` : ''; return <Marker key={unit.unit_id} longitude={Number(unit.longitude)} latitude={Number(unit.latitude)} anchor="center" onClick={(event) => { event.originalEvent.stopPropagation(); setSelectedUnit(unit); setSelectedLink(null); setDiagnosticEquipmentId(null); setExpandedUnitIds(new Set([unit.unit_id])); }}><div className="unit-map-marker-wrap"><button className={`unit-map-marker ${unit.operational_status}`} aria-label={`Abrir ${unit.name}${alertLabel}`} title={`${unit.name}${alertLabel}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openUnitContext(unit, Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), Math.max(12, Math.min(event.clientY, window.innerHeight - 210))); }}><span /></button>{alertState.alertCount > 0 && <span className={`unit-map-alert-card ${alertState.tone}`} role="status"><strong>{alertState.alertCount} alerta{alertState.alertCount > 1 ? 's' : ''}</strong><small>{alertState.tone === 'critical' ? 'Ação crítica' : 'Requer atenção'}</small></span>}</div></Marker>; })}
            {selectedUnit && <Popup longitude={Number(selectedUnit.longitude)} latitude={Number(selectedUnit.latitude)} anchor="bottom" closeButton={false} offset={18} onClose={() => { setSelectedUnit(null); setSelectedLink(null); setUnitContext(null); setExpandedUnitIds(new Set()); }}><div className="unit-map-popup"><span className={`status ${selectedUnit.operational_status}`}>{statusLabel[selectedUnit.operational_status]}</span><strong>{selectedUnit.name}</strong><small>{selectedUnit.code} · {selectedUnit.city}/{selectedUnit.state_code}</small><div className="unit-map-popup-actions"><button onClick={() => { setSelectedLink(null); setDetailUnit(selectedUnit); }}>Abrir unidade</button><button onClick={() => { const unit = selectedUnit; setSelectedUnit(null); setSelectedLink(null); onAddEquipment(unit); }}><PlusIcon /> Adicionar equipamento</button></div></div></Popup>}
          </Map>
          {!mapReady && <div className="state-map-loading" role="status"><span className="loading-pulse" /> Preparando mapa operacional…</div>}
          {!locatedUnits.length && <div className="state-map-empty">{pendingUnits[0] ? <button type="button" className="state-map-empty-action" aria-label="Adicionar localização" onClick={() => { onClose(); onLocateUnit(pendingUnits[0].unit_id); }}><PlusIcon /></button> : <span><PlusIcon /></span>}<strong>Localização ainda não informada</strong><small>Cadastre latitude e longitude nas unidades para exibir os pontos exatos.</small></div>}
          {mapFallback && <div className="state-map-provider-note">Mapa {mapTheme === 'dark' ? 'dark' : 'claro'} otimizado · carregamento rápido</div>}
        </div>
        <aside className="state-map-units state-links-panel"><div className="state-links-heading"><div><h3>Ativos das unidades</h3><span>{equipment.length} equipamento(s)</span></div><label className="state-asset-view"><span>Exibir</span><AppDropdown value={assetView} onChange={(value) => setAssetView(value as MapAssetView)} options={[{ value: "all", label: "Tudo" }, { value: "links", label: "Somente links" }, { value: "equipment", label: "Somente equipamentos" }]} /></label></div>{units.length === 0 ? <div className="state-map-list-empty">Nenhuma unidade cadastrada.</div> : panelUnits.map((unit) => { const located = locatedUnits.includes(unit); const unitTelemetry = telemetryByUnit.get(unit.unit_id) ?? []; const unitEquipment = equipment.filter((item) => item.unit_id === unit.unit_id); const telemetryEquipmentIds = new Set(unitTelemetry.map((item) => item.equipment_id)); const isExpanded = expandedUnitIds.has(unit.unit_id); const onlineLinks = unitTelemetry.filter((link) => link.operational_status === 'online').length; const attentionLinks = unitTelemetry.filter((link) => link.operational_status === 'degraded').length; const menuAvailability = getUnitMapMenuAvailability(unit.unit_id, unitTelemetry); const showLinks = shouldShowMapAssetKind("link", assetView); const showEquipment = shouldShowMapAssetKind("equipment", assetView); const standaloneEquipment = unitEquipment.filter((item) => !telemetryEquipmentIds.has(item.equipment_id)); const hasVisibleAssets = (showLinks && unitTelemetry.length > 0) || (showEquipment && standaloneEquipment.length > 0); return <section className={`state-unit-assets ${selectedUnit?.unit_id === unit.unit_id ? 'selected' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`} key={unit.unit_id} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openUnitContext(unit, Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), Math.max(12, Math.min(event.clientY, window.innerHeight - 210))); }}><div className="state-unit-assets-head"><button type="button" className="state-unit-assets-title" onClick={() => { setSelectedUnit(unit); setSelectedLink(null); setDetailUnit(null); setDiagnosticEquipmentId(null); setExpandedUnitIds((current) => new Set(current).add(unit.unit_id)); }}><strong>{unit.name}</strong><small>{unit.code} · {unit.city}/{unit.state_code}</small></button><div className="state-unit-assets-actions"><span>{unitEquipment.length} ativo(s)</span><div className="state-unit-action-menu"><button type="button" className="state-unit-action-trigger" aria-label={`Ações de ${unit.name}`}><PlusIcon /></button><div className="state-unit-action-popover" role="menu"><button type="button" role="menuitem" onClick={() => { onClose(); onSelectUnit(unit.unit_id); }}><ChevronRightIcon /><span><strong>Abrir unidade</strong><small>Inventário completo</small></span></button><button type="button" role="menuitem" onClick={() => { onClose(); onEditUnit(unit.unit_id); }}><EditIcon /><span><strong>Editar unidade</strong><small>Dados e localização</small></span></button><button type="button" role="menuitem" onClick={() => { onClose(); onOpenReports(); }}><NavReportIcon /><span><strong>Relatórios</strong><small>Resumo operacional</small></span></button><button type="button" role="menuitem" disabled={!menuAvailability.telemetryAvailable} onClick={() => { const link = unitTelemetry.find((item) => item.equipment_id === menuAvailability.telemetryEquipmentId); if (link) selectAsset(unit, link.equipment_id, link); }}><NavActivityIcon /><span><strong>Telemetria</strong><small>{menuAvailability.telemetryAvailable ? "Links e medições" : "Sem leitura disponível"}</small></span></button></div></div><button type="button" className="state-unit-expand-toggle" onMouseEnter={() => expandUnitOnHover(unit.unit_id)} aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} ativos de ${unit.name}`} aria-expanded={isExpanded} onClick={() => toggleUnitExpanded(unit.unit_id)}><span className="state-unit-expand-arrow" aria-hidden="true">›</span></button></div></div><div className="state-unit-link-summary"><span><b>{unitTelemetry.length}</b> link(s)</span><span className="online"><b>{onlineLinks}</b> operacionais</span><span className={attentionLinks ? 'attention' : ''}><b>{attentionLinks}</b> atenção</span></div>{isExpanded && <>{showLinks && unitTelemetry.length > 0 && <div className="state-unit-links">{unitTelemetry.map((link) => <LinkTelemetryCard key={link.equipment_id} unit={unit} link={link} located={located} diagnosticLatencyMs={diagnosticLatencyByUnit[unit.unit_id]} onView={() => selectAsset(unit, link.equipment_id, link)} onContext={(event) => { event.preventDefault(); event.stopPropagation(); openUnitContext(unit, Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), Math.max(12, Math.min(event.clientY, window.innerHeight - 210)), link.equipment_id); }} />)}</div>}{showEquipment && standaloneEquipment.map((item) => <button className={`state-inventory-row ${diagnosticEquipmentId === item.equipment_id ? 'selected' : ''}`} key={item.equipment_id} onClick={(event) => { selectAsset(unit, item.equipment_id); openUnitContext(unit, Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), Math.max(12, Math.min(event.clientY, window.innerHeight - 210)), item.equipment_id); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openUnitContext(unit, Math.max(12, Math.min(event.clientX, window.innerWidth - 250)), Math.max(12, Math.min(event.clientY, window.innerHeight - 210)), item.equipment_id); }}><span className={`legend-dot ${item.operational_status}`} /><span><strong>{item.name}</strong><small>{item.equipment_type.replaceAll('_', ' ')}</small></span><em>{statusLabel[item.operational_status]}</em></button>)}{!hasVisibleAssets && <div className="state-unit-empty"><p>Nenhum equipamento ou link cadastrado nesta unidade.</p><button type="button" className="primary compact" onClick={() => onAddEquipment(unit)}><PlusIcon /> Cadastrar equipamento</button></div>}</>}</section>; })}{pendingUnits.length > 0 && <p className="state-map-pending-note">Use LOCAL para adicionar as coordenadas da unidade.</p>}</aside>
      </div>
      <footer className="state-map-footer"><span><i className="legend-dot online" /> Operacional</span><span><i className="legend-dot degraded" /> Atenção</span><span><i className="legend-dot offline" /> Indisponível</span><span><i className="legend-dot unknown" /> Sem telemetria</span><small>Mapa {mapTheme === 'dark' ? 'dark' : 'claro'} · OpenStreetMap</small></footer>
      {unitContext && <div className="map-context-card map-unit-context-card" style={{ left: unitContext.x, top: unitContext.y }} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button clear-filters-button map-context-close" aria-label="Fechar" onClick={() => setUnitContext(null)}><CloseIcon /></button><p>AÇÃO RÁPIDA · UNIDADE</p><strong>{unitContext.unit.name}</strong><small>{unitContext.unit.code} · {unitContext.unit.city}/{unitContext.unit.state_code}</small>{contextEquipment.length > 0 ? <label className="diagnostic-target-field"><span>Equipamento-alvo</span><AppDropdown className="diagnostic-target-select" value={diagnosticEquipmentId ?? ''} onChange={setDiagnosticEquipmentId} options={contextEquipment.map((item) => ({ value: item.equipment_id, label: `${item.name} · ${item.management_address}` }))} /></label> : <small className="diagnostic-target-empty">Nenhum equipamento desta unidade possui endereço de gerenciamento.</small>}<button className="context-action" disabled={!diagnosticEquipmentId} onClick={() => void runDiagnostic(unitContext.unit, 'ping')}><PingIcon /> Ping</button><button className="context-action" disabled={!diagnosticEquipmentId} onClick={() => void runDiagnostic(unitContext.unit, 'tracert')}><TracertIcon /> Tracert</button><button className="primary compact" onClick={() => { setUnitContext(null); onAddEquipment(unitContext.unit); }}><PlusIcon /> Adicionar equipamento</button></div>}
      {diagnostic && <div className="diagnostic-float" role="status"><div className="diagnostic-float-head"><div><p className="eyebrow">DIAGNÓSTICO EM TEMPO REAL · {diagnostic.action === 'ping' ? 'PING' : 'TRACERT'}</p><strong>{diagnostic.unit.name}</strong><small>{diagnostic.unit.code} · alvo {diagnostic.result?.target ?? 'endereço de gerenciamento'}</small></div><button className="icon-button clear-filters-button" aria-label="Fechar diagnóstico" onClick={() => setDiagnostic(null)}><CloseIcon /></button></div><div className={`diagnostic-state ${diagnostic.status}`}>{diagnostic.status === 'running' ? 'Executando diagnóstico… aguardando resposta do equipamento.' : diagnostic.status === 'error' ? diagnostic.message : diagnostic.result?.success ? 'Concluído com resposta positiva.' : 'Concluído; o alvo não respondeu.'}</div>{diagnostic.status !== 'running' && <pre>{diagnostic.result?.output ?? diagnostic.message}</pre>}<button className="diagnostic-close" onClick={() => setDiagnostic(null)}>Fechar painel</button></div>}
      {detailUnit && <LinkAnalysisPanel unit={detailUnit} link={selectedLink ?? telemetryByUnit.get(detailUnit.unit_id)?.[0]} alerts={alerts} diagnosticLatencyMs={diagnosticLatencyByUnit[detailUnit.unit_id]} targetEquipment={equipment.find((item) => item.equipment_id === (selectedLink ?? telemetryByUnit.get(detailUnit.unit_id)?.[0])?.equipment_id)} onDiagnostic={(action) => void runDiagnostic(detailUnit, action)} onClose={() => setDetailUnit(null)} onOpenInventory={() => { onClose(); onSelectUnit(detailUnit.unit_id); }} />}
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
        <div className="overview-switcher" aria-label="Navegar entre cards operacionais"><button className="overview-nav-button" onClick={() => setCardIndex((index) => (index - 1 + cards.length) % cards.length)} aria-label="Card anterior">&lt;</button><span>{cardIndex + 1}/{cards.length}</span><button className="overview-nav-button" onClick={() => setCardIndex((index) => (index + 1) % cards.length)} aria-label="Próximo card">&gt;</button></div>
      </div>
    </div>
    {card.id === 'ranking' && <div className="problem-list">{alerts.length === 0 ? <div className="ranking-empty"><span><CheckIcon /></span><strong>Operação estável</strong><small>Nenhum problema ativo requer ação.</small></div> : alerts.slice(0, 5).map((alert, index) => { const linkedUnit = units.find((unit) => unit.code === alert.unit_code); const sev = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig[0]; const tone = alert.severity >= 4 ? 'offline' : alert.severity >= 2 ? 'degraded' : 'unknown'; return <button className={`problem-row severity-${alert.severity}`} key={alert.id} onClick={() => linkedUnit && onSelectUnit(linkedUnit.unit_id)}><span className="problem-rank">#{index + 1}</span><div><strong>{alert.title}</strong><small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'}</small></div><span className={`status ${tone}`}>{sev.label}</span></button>})}</div>}
    {card.id === 'history' && <div className="history-card-body"><div className="history-toolbar"><span>Janela móvel · limpa automaticamente a cada 30 min</span><button className="secondary-button compact clear-filters-button" onClick={() => setHistoryClearedAt(Date.now())}><ClearFilterIcon /> Limpar lista</button></div><div className="problem-list history-list">{historyAlerts.length === 0 ? <div className="ranking-empty"><span><CheckIcon /></span><strong>Nenhum problema registrado</strong><small>Problemas resolvidos aparecerão nesta janela.</small></div> : historyAlerts.slice(0, 5).map((alert, index) => { const linkedUnit = units.find((unit) => unit.code === alert.unit_code); return <button className={`problem-row history-row severity-${alert.severity}`} key={alert.id} onClick={() => linkedUnit && onSelectUnit(linkedUnit.unit_id)}><span className="problem-rank">#{index + 1}</span><div><strong>{alert.title}</strong><small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'} · {new Date(alert.resolved_at ?? alert.opened_at).toLocaleTimeString('pt-BR')}</small></div><span className="status online">Resolvido</span></button>})}</div></div>}
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

function InventoryActions({ token, selectedUnit, creating, onCreatingChange, onRefresh, onError, onToast = () => undefined }: { token: string; selectedUnit?: Unit; creating: boolean; onCreatingChange: (value: boolean) => void; onRefresh: () => Promise<void>; onError: (message: string) => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  if (creating && selectedUnit) return <EquipmentForm token={token} unit={selectedUnit} onCreated={async () => { onCreatingChange(false); await onRefresh(); }} onCancel={() => onCreatingChange(false)} onError={onError} onToast={onToast} />;
  return null;
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', confirmIcon = <TrashIcon />, tone = 'danger', busy = false, onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; confirmIcon?: ReactNode; tone?: 'danger' | 'warning' | 'positive'; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onCancel]);
  useEffect(() => {
    const body = document.body.style.overflow;
    const root = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; document.documentElement.style.overflow = root; };
  }, []);
  const toneClass = tone === 'warning' ? 'warning-button' : tone === 'positive' ? 'positive-button' : 'danger-button';
  return createPortal(<div className="form-modal-backdrop" role="presentation" onMouseDown={onCancel} onWheel={(event) => event.stopPropagation()}>
    <article className="form-card confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <div className="panel-title"><div><p className="eyebrow">CONFIRMAÇÃO NECESSÁRIA</p><h3>{title}</h3></div><button className="icon-button clear-filters-button" onClick={onCancel} aria-label="Fechar">{<CloseIcon />}</button></div>
      <p className="confirm-dialog-message">{message}</p>
      <div className="form-actions">
        <button type="button" className="secondary-button clear-filters-button" onClick={onCancel} disabled={busy}><CloseIcon /> Cancelar</button>
        <button type="button" className={toneClass} onClick={onConfirm} disabled={busy}>{confirmIcon} {busy ? 'Processando…' : confirmLabel}</button>
      </div>
    </article>
  </div>, document.body);
}

function FormCard({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onCancel]);
  return <div className="form-modal-backdrop" role="presentation" onMouseDown={onCancel}><article className="form-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">CADASTRO OPERACIONAL</p><h3>{title}</h3></div><button className="icon-button clear-filters-button" onClick={onCancel} aria-label="Fechar formulário"><CloseIcon /></button></div>{children}</article></div>;
}

function UnitFormLegacy({ token, onCreated, onCancel, onError = () => undefined }: { token: string; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void }) {
  const [form, setForm] = useState({ code: '', name: '', stateCode: '', city: '' }); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await api('/v1/units', token, { method: 'POST', body: JSON.stringify(form) }); await onCreated(); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar unidade.'); } finally { setSaving(false); } }
  return <FormCard title="Nova unidade móvel" onCancel={onCancel}><form className="inline-form" onSubmit={submit}><label>Código<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="UMS-011" /></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unidade Móvel Manaus" /></label><label>UF<input required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} placeholder="AM" /></label><label>Cidade<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Manaus" /></label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><PlusIcon /> Cadastrar unidade</>}</button></div></form></FormCard>;
}

function UnitForm({ token, initialStateCode = '', unitType = 'mobile', lockType = false, onCreated, onCancel, onError = () => undefined, onToast = () => undefined }: { token: string; initialStateCode?: string; unitType?: 'mobile' | 'fixed'; lockType?: boolean; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const [type, setType] = useState<'mobile' | 'fixed'>(unitType);
  const [form, setForm] = useState({ code: '', name: '', stateCode: initialStateCode.toUpperCase(), city: '', latitude: '', longitude: '' });
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
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
    event.preventDefault(); setFormError(''); setValidationRequested(true);
    if (Object.values(unitValidation).some(Boolean)) return;
    setSaving(true);
    try {
      await api('/v1/units', token, { method: 'POST', body: JSON.stringify({ code: form.code, name: form.name, unitType: type, stateCode: form.stateCode.toUpperCase(), city: form.city, latitude: form.latitude.trim() ? Number(form.latitude) : undefined, longitude: form.longitude.trim() ? Number(form.longitude) : undefined }) });
      await onCreated();
      onToast({ type: 'success', title: type === 'fixed' ? 'Unidade fixa cadastrada' : 'Unidade móvel cadastrada', detail: `${form.name} foi adicionada ao inventário.` });
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Falha ao cadastrar unidade.'); }
    finally { setSaving(false); }
  }
  return <section className="users-page">
    <div className="section-heading">
      <div><p className="eyebrow">CADASTRO DE INVENTÁRIO</p><h2>Nova unidade {type === 'fixed' ? 'fixa' : 'móvel'}</h2><small>Preencha os dados abaixo para registrar a unidade no inventário.</small></div>
    </div>
    <button className="back-button" onClick={onCancel}>← Voltar para a lista de unidades {type === 'fixed' ? 'fixas' : 'móveis'}</button>
    <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">DADOS DA UNIDADE</p>
          <h3>Dados da unidade</h3>
          <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
        </div>
      </div>
      {formError && <div className="form-error" role="alert">{formError}</div>}
      <div className="user-form-grid">
        <div className="mfield">
          <div className="input-group has-icon is-dropdown">
            <span className="input-icon" aria-hidden="true"><NavServerIcon /></span>
            <AppDropdown value={type} disabled={lockType} onChange={(next) => setType(next as 'mobile' | 'fixed')} options={[{ value: 'fixed', label: 'Unidade fixa' }, { value: 'mobile', label: 'Unidade móvel' }]} />
            <span className="input-group-label">Tipo de unidade <b className="req">*</b></span>
          </div>
          {lockType && <span className="field-hint">Definido pelo módulo atual.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon is-dropdown">
            <span className="input-icon" aria-hidden="true"><NavGeneralIcon /></span>
            <GlassCombobox value={form.stateCode} options={brazilStateCodes.map((code) => ({ value: code, label: stateNameByCode[code] }))} onChange={(value) => setForm({ ...form, stateCode: value.toUpperCase().slice(0, 2), city: '' })} placeholder="Escolha ou digite a UF" invalid={validationRequested && unitValidation.stateCode} compact />
            <span className="input-group-label">UF <b className="req">*</b></span>
          </div>
          {validationRequested && unitValidation.stateCode && <span className="field-error-text">Selecione ou informe uma UF válida.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon is-dropdown">
            <span className="input-icon" aria-hidden="true"><HomeIcon /></span>
            <GlassCombobox value={form.city} options={cities.map((city) => ({ value: city, label: city }))} onChange={(value) => setForm({ ...form, city: value })} placeholder={loadingCities ? 'Carregando cidades…' : 'Escolha ou digite a cidade'} invalid={validationRequested && unitValidation.city} disabled={!validState || loadingCities} />
            <span className="input-group-label">Cidade <b className="req">*</b></span>
          </div>
          {validationRequested && unitValidation.city ? <span className="field-error-text">Selecione ou informe a cidade.</span> : (loadingCities || cities.length > 0) && <span className="field-hint">{loadingCities ? 'Consultando municípios da UF…' : `${cities.length} cidades disponíveis para ${form.stateCode}`}</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
            <input id="cu-unit-code" value={form.code} className={validationRequested && unitValidation.code ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder=" " required />
            <label htmlFor="cu-unit-code">Código <b className="req">*</b></label>
          </div>
          {validationRequested && unitValidation.code ? <span className="field-error-text">Informe o código da unidade.</span> : <span className="field-hint">Ex.: {type === 'fixed' ? 'UFX-011' : 'UMS-011'}</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><FolderIcon /></span>
            <input id="cu-unit-name" value={form.name} className={validationRequested && unitValidation.name ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder=" " required />
            <label htmlFor="cu-unit-name">Nome <b className="req">*</b></label>
          </div>
          {validationRequested && unitValidation.name && <span className="field-error-text">Informe o nome da unidade.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><PingIcon /></span>
            <input id="cu-unit-lat" inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder=" " />
            <label htmlFor="cu-unit-lat">Latitude <em>opcional</em></label>
          </div>
          {validationRequested && unitValidation.coordinates ? <span className="field-error-text">Informe latitude entre -90 e 90.</span> : <span className="field-hint">Você pode informar a localização agora ou adicioná-la depois pelo mapa.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><PingIcon /></span>
            <input id="cu-unit-lng" inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder=" " />
            <label htmlFor="cu-unit-lng">Longitude <em>opcional</em></label>
          </div>
          {validationRequested && unitValidation.coordinates ? <span className="field-error-text">Informe longitude entre -180 e 180.</span> : <span className="field-hint">Você pode informar a localização agora ou adicioná-la depois pelo mapa.</span>}
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button clear-filters-button" onClick={onCancel}><CloseIcon /> Cancelar</button>
        <button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><PlusIcon /> Cadastrar unidade {type === 'fixed' ? 'fixa' : 'móvel'}</>}</button>
      </div>
    </form>
  </section>;
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
  return <FormCard title="Nova unidade móvel" onCancel={onCancel}><form className="inline-form validated-form" noValidate onSubmit={submit}><div className="required-fields-note"><strong>Dados da unidade</strong><small>Os campos marcados com <b>*</b> são obrigatórios.</small></div><label><span className="field-label">Código <b>*</b></span><input required className={validationRequested && unitValidation.code ? 'field-invalid' : ''} aria-invalid={validationRequested && unitValidation.code} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex.: UMS-011" />{validationRequested && unitValidation.code && <small className="field-error">Informe o código da unidade.</small>}</label><label><span className="field-label">Nome <b>*</b></span><input required className={validationRequested && unitValidation.name ? 'field-invalid' : ''} aria-invalid={validationRequested && unitValidation.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Unidade Móvel Manaus" />{validationRequested && unitValidation.name && <small className="field-error">Informe o nome da unidade.</small>}</label><label><span className="field-label">UF <b>*</b></span><GlassCombobox value={form.stateCode} options={brazilStateCodes.map((code) => ({ value: code, label: stateNameByCode[code] }))} onChange={(value) => setForm({ ...form, stateCode: value.toUpperCase().slice(0, 2), city: '' })} placeholder="Escolha ou digite a UF" invalid={validationRequested && unitValidation.stateCode} compact />{validationRequested && unitValidation.stateCode && <small className="field-error">Selecione ou informe uma UF válida.</small>}</label><label><span className="field-label">Cidade <b>*</b></span><GlassCombobox value={form.city} options={cities.map((city) => ({ value: city, label: city }))} onChange={(value) => setForm({ ...form, city: value })} placeholder={loadingCities ? 'Carregando cidades…' : 'Escolha ou digite a cidade'} invalid={validationRequested && unitValidation.city} disabled={!form.stateCode || loadingCities} />{validationRequested && unitValidation.city ? <small className="field-error">Selecione ou informe a cidade.</small> : <small className="field-hint">{loadingCities ? 'Consultando municípios da UF…' : cities.length ? `${cities.length} cidades disponíveis para ${form.stateCode}` : 'Informe uma UF válida para carregar as cidades.'}</small>}</label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><PlusIcon /> Cadastrar unidade</>}</button></div></form></FormCard>;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function DateField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [viewDate, setViewDate] = useState(() => parsed ?? new Date());
  useEffect(() => { if (open) setViewDate(parsed ?? new Date()); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onEscape); };
  }, [open]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const rawMonthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: new Date(year, month, i - firstWeekday + 1), inMonth: false });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(year, month, day), inMonth: true });
  while (cells.length < 42) cells.push({ date: new Date(year, month, cells.length - firstWeekday + 1), inMonth: false });
  const today = new Date();
  const todayIso = isoDate(today);
  const isNextMonthDisabled = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth());
  return (
    <div className={`date-field ${open ? 'open' : ''}`} ref={rootRef}>
      <input type="date" value={value} max={todayIso} onChange={(event) => onChange(event.target.value)} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} placeholder={placeholder} />
      <button type="button" className="date-field-trigger" aria-label="Abrir calendário" onClick={() => setOpen((current) => !current)}><CalendarIcon /></button>
      <div className={`date-picker-panel ${open ? 'open' : ''}`}>
        <div className="date-picker-header">
          <strong>{monthLabel}</strong>
          <div className="date-picker-nav">
            <button type="button" aria-label="Mês anterior" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeftIcon /></button>
            <button type="button" aria-label="Próximo mês" disabled={isNextMonthDisabled} onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRightIcon /></button>
          </div>
        </div>
        <div className="date-picker-weekdays">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => <span key={index}>{label}</span>)}</div>
        <div className="date-picker-grid">{cells.map(({ date, inMonth }, index) => { const iso = isoDate(date); const isFuture = iso > todayIso; return <button type="button" key={index} disabled={isFuture} className={`date-picker-day ${inMonth ? '' : 'outside'} ${iso === value ? 'selected' : ''} ${iso === todayIso ? 'today' : ''} ${isFuture ? 'future' : ''}`} onClick={() => { onChange(iso); setOpen(false); }}>{date.getDate()}</button>; })}</div>
        <div className="date-picker-footer">
          <button type="button" className="date-picker-clear" onClick={() => { onChange(''); setOpen(false); }}>Limpar</button>
          <button type="button" className="date-picker-today" onClick={() => { onChange(todayIso); setOpen(false); }}>Hoje</button>
        </div>
      </div>
    </div>
  );
}

type AppDropdownOption = { value: string; label: string; group?: string };

function AppDropdown({ value, options, onChange, placeholder = 'Selecionar', disabled = false, invalid = false, className = '' }: { value: string; options: AppDropdownOption[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; invalid?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onEscape); };
  }, [open]);
  const effectiveOptions = options.some((option) => option.value === 'linux_server') && !options.some((option) => option.value === 'server')
    ? [{ value: 'server', label: 'Servidor' }, ...options]
    : options;
  const selected = effectiveOptions.find((option) => option.value === value);
  const groups: Array<{ label?: string; items: AppDropdownOption[] }> = [];
  effectiveOptions.forEach((option) => {
    const last = groups[groups.length - 1];
    if (last && last.label === option.group) { last.items.push(option); return; }
    groups.push({ label: option.group, items: [option] });
  });
  return (
    <div className={`app-dropdown ${open ? 'open' : ''} ${invalid ? 'field-invalid' : ''} ${className}`} ref={rootRef}>
      <button type="button" className="app-dropdown-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={selected ? '' : 'app-dropdown-placeholder'}>{selected ? selected.label : placeholder}</span>
        <ChevronIcon up={open} />
      </button>
      <ul className={`app-dropdown-list webkit-scrollbar ${open ? 'open' : ''}`} role="listbox" aria-hidden={!open} onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
        {groups.map((group, groupIndex) => (
          <li key={group.label ?? groupIndex} className="app-dropdown-group">
            {group.label && <span className="app-dropdown-group-label">{group.label}</span>}
            {group.items.map((option) => (
              <button key={option.value} type="button" role="option" aria-selected={option.value === value} tabIndex={open ? 0 : -1} className={`app-dropdown-option ${option.value === value ? 'selected' : ''}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GlassCombobox({ value, options, onChange, placeholder, invalid = false, disabled = false, compact = false }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; placeholder: string; invalid?: boolean; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const search = value.trim().toLocaleLowerCase('pt-BR');
  const filtered = options.filter((option) => !search || option.value.toLocaleLowerCase('pt-BR').includes(search) || option.label.toLocaleLowerCase('pt-BR').includes(search)).slice(0, compact ? 27 : 100);
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const updateRect = () => {
      const box = rootRef.current?.getBoundingClientRect();
      if (box) setRect({ top: box.bottom + 7, left: box.left, width: box.width });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => { window.removeEventListener('scroll', updateRect, true); window.removeEventListener('resize', updateRect); };
  }, [open]);
  return <div className={`glass-combobox ${open ? 'open' : ''} ${invalid ? 'field-invalid' : ''}`} ref={rootRef}>
    <input value={value} disabled={disabled} aria-invalid={invalid} aria-expanded={open} role="combobox" autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') setOpen(true); }} placeholder={placeholder} />
    <span className="combobox-toggle" aria-hidden="true"><ChevronIcon up={open} /></span>
    {open && !disabled && rect && createPortal(
      <div className="glass-options glass-options-portal" role="listbox" style={{ top: rect.top, left: rect.left, width: rect.width }} onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>{filtered.length ? filtered.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} key={option.value} onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { onChange(option.value); setOpen(false); }}><strong>{option.value}</strong>{option.label !== option.value && <small>{option.label}</small>}</button>) : <div className="combobox-empty">Nenhuma opção encontrada</div>}</div>,
      document.body,
    )}
  </div>;
}

function EquipmentForm({ token, unit, onCreated, onCancel, onError = () => undefined, onToast = () => undefined }: { token: string; unit: Unit; onCreated: () => Promise<void>; onCancel: () => void; onError?: (message: string) => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const [form, setForm] = useState({ equipmentTypeCode: 'linux_server', name: '', serialNumber: '', managementAddress: '', contractedDownloadMbps: '', contractedUploadMbps: '' }); const [saving, setSaving] = useState(false); const [validationRequested, setValidationRequested] = useState(false);
  const linkFieldsVisible = isLinkEquipmentType(form.equipmentTypeCode);
  const equipmentValidation = { type: !form.equipmentTypeCode, name: !form.name.trim(), contractedDownloadMbps: Boolean(form.contractedDownloadMbps) && Number(form.contractedDownloadMbps) <= 0, contractedUploadMbps: Boolean(form.contractedUploadMbps) && Number(form.contractedUploadMbps) <= 0 };
  async function submit(event: FormEvent) { event.preventDefault(); setValidationRequested(true); if (Object.values(equipmentValidation).some(Boolean)) return; setSaving(true); try { await api(`/v1/units/${unit.unit_id}/equipment`, token, { method: 'POST', body: JSON.stringify({ equipmentTypeCode: form.equipmentTypeCode, name: form.name, serialNumber: form.serialNumber || undefined, managementAddress: form.managementAddress || undefined, contractedDownloadMbps: linkFieldsVisible && form.contractedDownloadMbps ? Number(form.contractedDownloadMbps) : undefined, contractedUploadMbps: linkFieldsVisible && form.contractedUploadMbps ? Number(form.contractedUploadMbps) : undefined }) }); await onCreated(); onToast({ type: 'success', title: 'Equipamento cadastrado', detail: `${form.name} foi adicionado à unidade ${unit.name}.` }); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao cadastrar equipamento.'); } finally { setSaving(false); } }
  return <section className="users-page">
    <div className="section-heading">
      <div><p className="eyebrow">CADASTRO DE INVENTÁRIO</p><h2>Novo equipamento</h2><small>Vincule um novo ativo à unidade {unit.name}.</small></div>
    </div>
    <button className="back-button" onClick={onCancel}>← Voltar para a unidade</button>
    <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">DADOS DO EQUIPAMENTO</p>
          <h3>Dados do equipamento</h3>
          <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
        </div>
      </div>
      <div className="user-form-grid">
        <div className="mfield">
          <div className="input-group has-icon is-dropdown">
            <span className="input-icon" aria-hidden="true"><PackageIcon /></span>
            <AppDropdown invalid={validationRequested && equipmentValidation.type} value={form.equipmentTypeCode} onChange={(next) => setForm({ ...form, equipmentTypeCode: next })} options={[{ value: 'linux_server', label: 'Servidor Linux' }, { value: 'mikrotik', label: 'Mikrotik' }, { value: 'starlink', label: 'Starlink' }, { value: 'vpn', label: 'VPN' }, { value: 'internet_link', label: 'Link de internet' }]} />
            <span className="input-group-label">Tipo <b className="req">*</b></span>
          </div>
          {validationRequested && equipmentValidation.type && <span className="field-error-text">Selecione o tipo do equipamento.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><FolderIcon /></span>
            <input id="ce-name" value={form.name} className={validationRequested && equipmentValidation.name ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder=" " required />
            <label htmlFor="ce-name">Nome <b className="req">*</b></label>
          </div>
          {validationRequested && equipmentValidation.name ? <span className="field-error-text">Informe o nome do equipamento.</span> : <span className="field-hint">Ex.: Mikrotik - {unit.code}</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><NavLinkIcon /></span>
            <input id="ce-address" value={form.managementAddress} onChange={(e) => setForm({ ...form, managementAddress: e.target.value })} placeholder=" " />
            <label htmlFor="ce-address">Endereço de gerenciamento <em>opcional</em></label>
          </div>
          <span className="field-hint">Ex.: 10.0.0.50</span>
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
            <input id="ce-serial" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder=" " />
            <label htmlFor="ce-serial">Número de série <em>opcional</em></label>
          </div>
        </div>
        {linkFieldsVisible && <>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><PingIcon /></span>
              <input id="ce-down" type="number" min="0.001" max="1000000" step="0.001" value={form.contractedDownloadMbps} className={validationRequested && equipmentValidation.contractedDownloadMbps ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, contractedDownloadMbps: e.target.value })} placeholder=" " />
              <label htmlFor="ce-down">Download contratado <em>Mbps · opcional</em></label>
            </div>
            {validationRequested && equipmentValidation.contractedDownloadMbps ? <span className="field-error-text">Informe um valor maior que zero.</span> : <span className="field-hint">Somente valores confirmados pelo contrato/provedor.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><PingIcon /></span>
              <input id="ce-up" type="number" min="0.001" max="1000000" step="0.001" value={form.contractedUploadMbps} className={validationRequested && equipmentValidation.contractedUploadMbps ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, contractedUploadMbps: e.target.value })} placeholder=" " />
              <label htmlFor="ce-up">Upload contratado <em>Mbps · opcional</em></label>
            </div>
            {validationRequested && equipmentValidation.contractedUploadMbps && <span className="field-error-text">Informe um valor maior que zero.</span>}
          </div>
        </>}
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button clear-filters-button" onClick={onCancel}><CloseIcon /> Cancelar</button>
        <button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><PlusIcon /> Cadastrar equipamento</>}</button>
      </div>
    </form>
  </section>;
}

function syncStatusLabel(status: ZabbixSyncStatus | null) {
  const health = status?.health_status ?? 'unknown';
  return health === 'healthy' ? 'Zabbix sincronizado' : health === 'unavailable' ? 'Zabbix indisponível' : health === 'degraded' ? 'Zabbix em atenção' : 'Zabbix aguardando coleta';
}

function SyncStatusButton({ active, status, onClick }: { active: boolean; status: ZabbixSyncStatus | null; onClick: () => void }) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const health = status?.health_status ?? 'unknown';
  const lastAttempt = status?.last_attempt_at ? new Date(status.last_attempt_at).getTime() : 0;
  const nextSync = lastAttempt ? Math.max(0, 60_000 - (Date.now() - lastAttempt)) : 60_000;
  const seconds = Math.ceil(nextSync / 1000);
  return <button type="button" className={`sidebar-sync-button ${active ? 'active' : ''} integration-${health}`} onClick={onClick} title="Abrir status da integração e ponte de hosts">
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

function ZabbixIntegration({ candidates, units, loading, onRefresh, onStatusRefresh, onInventoryRefresh, onAlertsRefresh, onError, onToast = () => undefined, token }: { candidates: ZabbixCandidates | null; units: Unit[]; loading: boolean; onRefresh: () => Promise<void>; onStatusRefresh: () => Promise<void>; onInventoryRefresh: () => Promise<void>; onAlertsRefresh: () => Promise<void>; onError: (message: string) => void; onToast?: (toast: Omit<Toast, 'id'>) => void; token: string }) {
  const [hostSearch, setHostSearch] = useState(''); const [selectedHost, setSelectedHost] = useState(''); const [selectedEquipment, setSelectedEquipment] = useState(''); const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'bridge'>('overview');
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
  const [confirmMove, setConfirmMove] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  async function refreshAfterChange() { await Promise.all([onRefresh(), onInventoryRefresh()]); }
  async function link() {
    if (!selectedHost || !selectedEquipment || unchanged) return;
    if (selectedEquipmentMapping && selectedEquipmentMapping.zabbix_host_id !== selectedHost && !confirmMove) {
      setConfirmMove(true);
      return;
    }
    setConfirmMove(false);
    setSaving(true); onError('');
    const wasMove = Boolean(selectedEquipmentMapping && selectedEquipmentMapping.zabbix_host_id !== selectedHost);
    const equipmentName = candidates?.equipment.find((item) => item.id === selectedEquipment)?.name ?? 'equipamento selecionado';
    try {
      await api('/v1/integrations/zabbix/mappings', token, { method: 'POST', body: JSON.stringify({ zabbixHostId: selectedHost, equipmentId: selectedEquipment }) });
      await refreshAfterChange();
      onToast({ type: 'success', title: wasMove ? 'Vínculo movido' : 'Host vinculado', detail: `${currentHost?.name ?? selectedHost} agora está vinculado a ${equipmentName}.` });
    } catch (reason) { onError(reason instanceof Error ? reason.message : 'Falha ao salvar vínculo.'); }
    finally { setSaving(false); }
  }
  async function unlink() {
    if (!selectedHost || !currentMapping) return;
    if (!confirmUnlink) { setConfirmUnlink(true); return; }
    setConfirmUnlink(false);
    setSaving(true); onError('');
    const hostName = currentHost?.name ?? selectedHost;
    try {
      await api(`/v1/integrations/zabbix/mappings/${encodeURIComponent(selectedHost)}`, token, { method: 'DELETE' });
      setSelectedEquipment('');
      await refreshAfterChange();
      onToast({ type: 'success', title: 'Host desvinculado', detail: `${hostName} não está mais vinculado a nenhum equipamento.` });
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
  const syncActions = <div className="section-actions"><button type="button" className="secondary-button compact" onClick={() => void onRefresh()}>{loading ? 'Atualizando…' : <><RefreshIcon /> Atualizar hosts</>}</button><button type="button" className="primary compact" disabled={syncing} onClick={() => void synchronizeNow()}>{syncing ? 'Sincronizando…' : <><SyncIcon /> Sincronizar agora</>}</button></div>;
  return <section className="integration-page">
    <div className="section-heading"><div><p className="eyebrow">INTEGRAÇÃO · ZABBIX</p><h2>Hosts e vínculos operacionais</h2><small>Associe cada host a um equipamento cadastrado e mantenha a unidade rastreável.</small></div>{candidates && <div className="alert-tabs integration-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === 'overview'} className={`alert-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Visão geral <span>{tab === 'overview' ? candidates.hosts.length : '—'}</span></button><button type="button" role="tab" aria-selected={tab === 'bridge'} className={`alert-tab ${tab === 'bridge' ? 'active' : ''}`} onClick={() => setTab('bridge')}>Ponte de hosts <span>{tab === 'bridge' ? mappings.length : '—'}</span></button></div>}</div>
    {!candidates && <div className="empty-state compact-empty"><span className="empty-glyph"><RefreshIcon /></span><h3>{loading ? 'Consultando Zabbix…' : 'Nenhum catálogo carregado'}</h3><button className="primary" onClick={() => void onRefresh()}><RefreshIcon /> Carregar hosts</button></div>}
    {candidates && <>
      {tab === 'overview' && <div className="integration-overview">
      <div className="integration-stats"><Metric label="Hosts encontrados" value={candidates.hosts.length} tone="neutral" /><Metric label="Já vinculados" value={mappings.length} tone="ok" /><Metric label="Pendentes" value={Math.max(candidates.hosts.length - mappings.length, 0)} tone="warn" /></div>
      <AgentVersionsPanel token={token} onToast={onToast} actions={syncActions} />
      </div>}
      {tab === 'bridge' && <div className="integration-grid">
        <article className="host-panel"><div className="panel-title"><div><p className="eyebrow">INVENTÁRIO DO ZABBIX</p><h3>Selecione um host</h3></div><strong>{filteredHosts.length}</strong></div><div className="search-input-wrap"><SearchIcon /><input className="search-input" value={hostSearch} onChange={(e) => setHostSearch(e.target.value)} placeholder="Buscar por nome ou ID…" /></div><div className="host-list">{filteredHosts.map((host) => { const hasCoordinates = Number.isFinite(Number(host.inventory?.location_lat)) && Number.isFinite(Number(host.inventory?.location_lon)); return <button key={host.hostid} className={`host-row ${linkedEquipment.has(host.hostid) ? 'linked' : 'pending'} ${selectedHost === host.hostid ? 'selected' : ''}`} onClick={() => setSelectedHost(host.hostid)}><div><strong>{host.name || host.host}</strong><small>{host.host} · ID {host.hostid}{host.interfaces?.[0]?.ip ? ` · ${host.interfaces[0].ip}` : ''}{hasCoordinates ? ' · localização no inventário' : ''}</small></div><span className={`status ${linkedEquipment.has(host.hostid) ? 'online' : 'degraded'}`}>{linkedEquipment.has(host.hostid) ? 'Vinculado' : 'Pendente'}</span></button>; })}</div></article>
        <article className="link-panel">
          <div className="panel-title"><div><p className="eyebrow">DESTINO DO VÍNCULO</p><h3>Equipamento do HealthLink</h3></div>{syncActions}</div>
          <p className="muted">O host é associado ao equipamento; a unidade é herdada automaticamente.</p>
          {currentMapping && <div className="current-mapping"><span>VÍNCULO ATUAL</span><strong>{currentEquipment?.name ?? currentMapping.equipment_id}</strong><small>{currentUnit ? `${currentUnit.code} · ${currentUnit.name}` : 'Unidade não localizada no catálogo atual'}</small></div>}
          {!currentMapping && selectedHost && (suggestedUnit || suggestedType) && <button type="button" className={`suggestion-box suggestion-action ${suggestedEquipment && selectedEquipment === suggestedEquipment.id ? 'selected' : ''}`} disabled={!suggestedEquipment} aria-pressed={Boolean(suggestedEquipment && selectedEquipment === suggestedEquipment.id)} onClick={() => { if (suggestedEquipment) setSelectedEquipment(suggestedEquipment.id); }}><span>SUGESTÃO AUTOMÁTICA</span><strong>{suggestedEquipment?.name ?? (suggestedUnit ? `${suggestedUnit.code} · ${suggestedUnit.name}` : 'Unidade não identificada')}</strong><small>{suggestedEquipment ? `${suggestedEquipment.equipment_type.replaceAll('_', ' ')} · clique para selecionar` : suggestedType ? `Tipo detectado: ${suggestedType.replaceAll('_', ' ')} · confirme o equipamento manualmente.` : 'Confirme o equipamento manualmente.'}</small></button>}
          <AppDropdown className="link-select" placeholder="Selecione um equipamento" value={selectedEquipment} onChange={setSelectedEquipment} disabled={!selectedHost || saving} options={units.flatMap((unit) => candidates.equipment.filter((item) => item.unit_id === unit.unit_id).map((item) => ({ value: item.id, label: `${item.name} · ${item.equipment_type.replaceAll('_', ' ')}`, group: `${unit.code} · ${unit.name}` })))} />
          {selectedEquipmentMapping && selectedEquipmentMapping.zabbix_host_id !== selectedHost && <div className="mapping-warning"><strong>Este equipamento já possui um vínculo.</strong><small>Ao salvar, ele será movido do host {selectedEquipmentHost?.name ?? selectedEquipmentMapping.zabbix_host_id} para o host selecionado.</small></div>}
          <div className="link-context"><span>Host selecionado</span><strong>{selectedHost ? `${currentHost?.name ?? 'Host'}${currentHost?.interfaces?.[0]?.ip ? ` · ${currentHost.interfaces[0].ip}` : ''}` : 'Nenhum host selecionado'}</strong></div>
          <div className="mapping-actions"><button className="primary wide" disabled={!selectedHost || !selectedEquipment || saving || unchanged} onClick={() => void link()}>{saving ? 'Processando…' : unchanged ? <><CheckIcon /> Vínculo atual confirmado</> : currentMapping ? <><CheckIcon /> Trocar vínculo</> : <><PlusIcon /> Vincular host ao equipamento</>}</button>{currentMapping && <button className="secondary-button warning-action-button wide" disabled={saving} onClick={() => void unlink()}><RejectIcon /> Desvincular host</button>}</div>
          <div className="link-help"><span>Fluxo seguro</span><small>Host Zabbix → Equipamento → Unidade móvel · alterações auditadas</small></div>
        </article>
      </div>}
    </>}
    {confirmMove && <ConfirmDialog title="Mover vínculo" message={`O equipamento já está ligado ao host "${selectedEquipmentHost?.name ?? selectedEquipmentMapping?.zabbix_host_id}". Deseja mover o vínculo para "${currentHost?.name ?? selectedHost}"?`} confirmLabel="Mover vínculo" confirmIcon={<CheckIcon />} tone="warning" busy={saving} onConfirm={() => void link()} onCancel={() => setConfirmMove(false)} />}
    {confirmUnlink && <ConfirmDialog title="Desvincular host" message={`Desvincular o host "${currentHost?.name ?? selectedHost}" de "${currentEquipment?.name ?? 'seu equipamento'}"? O histórico será preservado.`} confirmLabel="Desvincular" confirmIcon={<RejectIcon />} tone="warning" busy={saving} onConfirm={() => void unlink()} onCancel={() => setConfirmUnlink(false)} />}
  </section>;
}

function UnitsView({ units, selectedUnit, selectedEquipment, loading, summary, unitType, creating, onCreatingChange, equipmentCreating, editingUnitId, onEditingUnitIdChange, editingEquipmentId, onEditingEquipmentIdChange, onCreateEquipment, onSelectUnit, onBack, onInventoryRefresh, token, onToast = () => undefined }: { units: Unit[]; selectedUnit?: Unit; selectedEquipment: Equipment[]; loading: boolean; summary: { online: number; attention: number; offline: number; unknown: number }; unitType: 'mobile' | 'fixed'; creating: boolean; onCreatingChange: (value: boolean) => void; equipmentCreating: boolean; editingUnitId: string | null; onEditingUnitIdChange: (value: string | null) => void; editingEquipmentId: string | null; onEditingEquipmentIdChange: (value: string | null) => void; onCreateEquipment: (unitId: string) => void; onSelectUnit: (unitId: string) => void; onBack: () => void; onInventoryRefresh: () => Promise<void>; token: string; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const editing = editingEquipmentId ? selectedEquipment.find((item) => item.equipment_id === editingEquipmentId) ?? null : null;
  const [contextMenu, setContextMenu] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const editingUnit = editingUnitId ? units.find((u) => u.unit_id === editingUnitId) ?? selectedUnit ?? null : null;
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => { const close = () => setContextMenu(null); const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); }; window.addEventListener('mousedown', close); window.addEventListener('scroll', close, true); window.addEventListener('keydown', onKey); return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', onKey); }; }, []);
  const refresh = async () => { onEditingEquipmentIdChange(null); onEditingUnitIdChange(null); await onInventoryRefresh(); };
  const menuAction = (action: 'open' | 'edit' | 'equipment' | 'delete') => { if (!contextMenu) return; const unit = contextMenu.unit; setContextMenu(null); if (action === 'open') onSelectUnit(unit.unit_id); else if (action === 'edit') onEditingUnitIdChange(unit.unit_id); else if (action === 'equipment') onCreateEquipment(unit.unit_id); else setDeleteTarget(unit); };
  async function confirmDeleteUnit() {
    if (!deleteTarget) return;
    setDeletingUnit(true);
    try {
      await api(`/v1/units/${deleteTarget.unit_id}`, token, { method: 'DELETE' });
      await onInventoryRefresh();
      onBack();
      onToast({ type: 'success', title: 'Unidade excluída', detail: `${deleteTarget.name} e seus ativos foram removidos definitivamente.` });
    } catch (reason) {
      onToast({ type: 'error', title: 'Falha ao excluir unidade', detail: reason instanceof Error ? reason.message : 'Tente novamente em instantes.' });
    } finally { setDeletingUnit(false); setDeleteTarget(null); }
  }
  const regionOptions = Array.from(new Set(units.map((unit) => unit.state_code))).sort().map((state) => ({ value: state, label: state }));
  const filteredUnits = units.filter((unit) => {
    if (nameFilter.trim() && !unit.name.toLowerCase().includes(nameFilter.trim().toLowerCase()) && !unit.code.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    if (regionFilter && unit.state_code !== regionFilter) return false;
    if (statusFilter && unit.operational_status !== statusFilter) return false;
    return true;
  });
  const clearUnitFilters = () => { setNameFilter(''); setRegionFilter(''); setStatusFilter(''); };
  const UNITS_PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [nameFilter, regionFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / UNITS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUnits = filteredUnits.slice((currentPage - 1) * UNITS_PAGE_SIZE, currentPage * UNITS_PAGE_SIZE);
  if (creating) return <UnitForm unitType={unitType} lockType token={token} onCreated={async () => { onCreatingChange(false); await onInventoryRefresh(); }} onCancel={() => onCreatingChange(false)} onToast={onToast} />;
  if (editingUnit) return <UnitEditForm unit={editingUnit} token={token} onSaved={refresh} onCancel={() => onEditingUnitIdChange(null)} onToast={onToast} />;
  if (editing) return <EquipmentEditForm equipment={editing} token={token} onSaved={refresh} onCancel={() => onEditingEquipmentIdChange(null)} onToast={onToast} />;
  return <>{!selectedUnit && <div className="section-heading units-module-heading"><div><p className="eyebrow">FROTA E INFRAESTRUTURA · {unitType === 'mobile' ? 'MÓVEIS' : 'FIXAS'}</p><h2>{unitType === 'mobile' ? 'Unidades móveis' : 'Unidades fixas'}</h2><small>{unitType === 'mobile' ? 'Monitoramento das ambulâncias e unidades itinerantes em operação de campo.' : 'Monitoramento de hospitais, postos e instalações permanentes.'}</small></div><button type="button" className="primary" onClick={() => onCreatingChange(true)}><PlusIcon /> Cadastrar unidade {unitType === 'mobile' ? 'móvel' : 'fixa'}</button></div>}{!selectedUnit && <div className="summary-grid"><Metric label={`${unitType === 'mobile' ? 'Unidades móveis' : 'Unidades fixas'} monitoradas`} value={units.length} tone="neutral" /><Metric label={`${unitType === 'mobile' ? 'Unidades móveis' : 'Unidades fixas'} operacionais`} value={summary.online} tone="ok" /><Metric label={`${unitType === 'mobile' ? 'Unidades móveis' : 'Unidades fixas'} em atenção`} value={summary.attention} tone="warn" /><Metric label={`${unitType === 'mobile' ? 'Unidades móveis' : 'Unidades fixas'} indisponíveis`} value={summary.offline} tone="danger" /></div>}{selectedUnit ? (equipmentCreating ? null : <UnitDetail unit={selectedUnit} equipment={selectedEquipment} onBack={onBack} onEdit={(item) => onEditingEquipmentIdChange(item.equipment_id)} onRequestEdit={(u) => onEditingUnitIdChange(u.unit_id)} onCreateEquipment={() => onCreateEquipment(selectedUnit.unit_id)} onRefresh={refresh} onToast={onToast} onRequestDelete={setDeleteTarget} />) : <><div className="units-list panel"><div className="section-heading"><div><p className="eyebrow">FROTA E INFRAESTRUTURA</p><h2>Estado das unidades</h2></div></div><div className="unit-filters"><div className="search-input-wrap"><SearchIcon /><input className="search-input" placeholder="Pesquisar por nome ou código…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} /></div><AppDropdown placeholder="Todas as regiões" value={regionFilter} onChange={setRegionFilter} options={[{ value: '', label: 'Todas as regiões' }, ...regionOptions]} /><AppDropdown placeholder="Todos os status" value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Todos os status' }, { value: 'online', label: 'Operacional' }, { value: 'degraded', label: 'Atenção' }, { value: 'offline', label: 'Indisponível' }, { value: 'unknown', label: 'Sem telemetria' }]} />{(nameFilter || regionFilter || statusFilter) && <button type="button" className="secondary-button compact clear-filters-button" onClick={clearUnitFilters}><ClearFilterIcon /> Limpar</button>}</div>{filteredUnits.length === 0 ? <div className="empty-state compact-empty"><p>Nenhuma unidade encontrada.</p></div> : <><div className="unit-grid unit-grid-scroll">{pagedUnits.map((unit) => <button className={`unit-card ${unit.operational_status}`} key={unit.unit_id} onClick={() => onSelectUnit(unit.unit_id)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ unit, x: Math.min(event.clientX, window.innerWidth - 240), y: Math.min(event.clientY, window.innerHeight - 170) }); }}><div className="unit-card-head"><span className="unit-code">{unit.code}</span><span className={`status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span></div><h3>{unit.name}</h3><p>{unit.city} · {unit.state_code}</p><div className="telemetry"><span><strong>{unit.offline_equipment}</strong> indisponíveis</span><span><strong>{unit.degraded_equipment}</strong> atenção</span></div><div className="signal-line"><i /><i /><i /><i /></div></button>)}</div>{totalPages > 1 && <div className="pagination"><button type="button" className="secondary-button compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage} de {totalPages}</span><button type="button" className="secondary-button compact" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>}</>}</div></>}{contextMenu && <div className="unit-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}><div className="unit-context-menu-head"><span>{contextMenu.unit.code}</span><strong title={contextMenu.unit.name}>{contextMenu.unit.name}</strong></div><div className="dropdown-divider" /><button type="button" role="menuitem" className="dropdown-item" onClick={() => menuAction('open')}><span className="dropdown-item-icon"><ChevronRightIcon /></span><span>Abrir unidade</span></button><button type="button" role="menuitem" className="dropdown-item" onClick={() => menuAction('edit')}><span className="dropdown-item-icon"><EditIcon /></span><span>Editar unidade</span></button><button type="button" role="menuitem" className="dropdown-item" onClick={() => menuAction('equipment')}><span className="dropdown-item-icon"><PlusIcon /></span><span>Cadastrar equipamento</span></button><div className="dropdown-divider" /><button type="button" role="menuitem" className="dropdown-item logout" onClick={() => menuAction('delete')}><span className="dropdown-item-icon"><TrashIcon /></span><span>Excluir unidade</span></button></div>}{deleteTarget && <ConfirmDialog title="Excluir unidade definitivamente" message={`Excluir a unidade "${deleteTarget.name}"? Todos os equipamentos, links, agentes, telemetrias, alertas e histórico operacional vinculados serão apagados. Esta ação não pode ser desfeita.`} confirmLabel="Excluir unidade" busy={deletingUnit} onConfirm={() => void confirmDeleteUnit()} onCancel={() => setDeleteTarget(null)} />}</>;
}


function UnitEditForm({ unit, token, onSaved, onCancel, onToast = () => undefined }: { unit: Unit; token: string; onSaved: () => Promise<void>; onCancel: () => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const initialForm = useRef({ code: unit.code, name: unit.name, stateCode: unit.state_code, city: unit.city, latitude: unit.latitude == null ? '' : String(unit.latitude), longitude: unit.longitude == null ? '' : String(unit.longitude) }).current;
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationRequested, setValidationRequested] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const hasLatitude = Boolean(form.latitude.trim());
  const hasLongitude = Boolean(form.longitude.trim());
  const validCoordinates = (!hasLatitude && !hasLongitude) || (hasLatitude && hasLongitude && Number.isFinite(Number(form.latitude)) && Number(form.latitude) >= -90 && Number(form.latitude) <= 90 && Number.isFinite(Number(form.longitude)) && Number(form.longitude) >= -180 && Number(form.longitude) <= 180);
  const unitValidation = { code: !form.code.trim(), name: !form.name.trim(), stateCode: !brazilStateCodes.includes(form.stateCode.trim().toUpperCase()), city: !form.city.trim(), coordinates: !validCoordinates };
  async function submit(event: FormEvent) {
    event.preventDefault(); setValidationRequested(true); setError('');
    if (Object.values(unitValidation).some(Boolean)) return;
    if (!isDirty) { onCancel(); return; }
    setSaving(true);
    try { await api(`/v1/units/${unit.unit_id}`, token, { method: 'PATCH', body: JSON.stringify({ code: form.code, name: form.name, stateCode: form.stateCode.toUpperCase(), city: form.city, latitude: form.latitude.trim() ? Number(form.latitude) : undefined, longitude: form.longitude.trim() ? Number(form.longitude) : undefined }) }); await onSaved(); onToast({ type: 'success', title: 'Unidade atualizada', detail: `As alterações em ${form.name} foram salvas.` }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao atualizar unidade.'); }
    finally { setSaving(false); }
  }
  return <section className="users-page">
    <div className="section-heading">
      <div><p className="eyebrow">CADASTRO DE INVENTÁRIO</p><h2>Editar unidade</h2><small>Atualize os dados de {unit.name}.</small></div>
    </div>
    <button className="back-button" onClick={onCancel}>← Voltar para a unidade</button>
    <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">DADOS DA UNIDADE</p>
          <h3>Dados da unidade</h3>
          <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="user-form-grid">
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><NavGeneralIcon /></span><input id="eu-unit-uf" value={form.stateCode} placeholder=" " disabled /><label htmlFor="eu-unit-uf">UF</label></div><span className="field-hint">Não editável — definido no cadastro da unidade.</span></div>
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><HomeIcon /></span><input id="eu-unit-city" value={form.city} placeholder=" " disabled /><label htmlFor="eu-unit-city">Cidade</label></div></div>
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><BadgeIcon /></span><input id="eu-unit-code" value={form.code} className={validationRequested && unitValidation.code ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder=" " /><label htmlFor="eu-unit-code">Código <b className="req">*</b></label></div>{validationRequested && unitValidation.code && <span className="field-error-text">Informe o código da unidade.</span>}</div>
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><FolderIcon /></span><input id="eu-unit-name" value={form.name} className={validationRequested && unitValidation.name ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder=" " /><label htmlFor="eu-unit-name">Nome <b className="req">*</b></label></div>{validationRequested && unitValidation.name && <span className="field-error-text">Informe o nome da unidade.</span>}</div>
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><PingIcon /></span><input id="eu-unit-lat" inputMode="decimal" value={form.latitude} className={validationRequested && unitValidation.coordinates ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder=" " /><label htmlFor="eu-unit-lat">Latitude <em>opcional</em></label></div>{validationRequested && unitValidation.coordinates ? <span className="field-error-text">Informe latitude entre -90 e 90.</span> : <span className="field-hint">Deixe latitude e longitude vazias para remover a localização.</span>}</div>
        <div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><PingIcon /></span><input id="eu-unit-lng" inputMode="decimal" value={form.longitude} className={validationRequested && unitValidation.coordinates ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder=" " /><label htmlFor="eu-unit-lng">Longitude <em>opcional</em></label></div>{validationRequested && unitValidation.coordinates && <span className="field-error-text">Informe longitude entre -180 e 180.</span>}</div>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button clear-filters-button" onClick={onCancel}><CloseIcon /> Cancelar</button><button className="primary" disabled={saving || !isDirty}>{saving ? 'Salvando…' : <><CheckIcon /> Salvar alterações</>}</button></div>
    </form>
  </section>;
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
  return <FormCard title={`Editar unidade · ${unit.name}`} onCancel={onCancel}><form className="inline-form" onSubmit={submit}>{error && <div className="error-banner">{error}</div>}<label>Código<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>UF<input required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })} /></label><label>Cidade<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><CheckIcon /> Salvar alterações</>}</button></div></form></FormCard>;
}

function EquipmentEditForm({ equipment, token, onSaved, onCancel, onToast = () => undefined }: { equipment: Equipment; token: string; onSaved: () => Promise<void>; onCancel: () => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const initialForm = useRef({ equipmentTypeCode: equipment.equipment_type, name: equipment.name, serialNumber: equipment.serial_number ?? '', managementAddress: equipment.management_address ?? '', contractedDownloadMbps: equipment.contracted_download_mbps?.toString() ?? '', contractedUploadMbps: equipment.contracted_upload_mbps?.toString() ?? '' }).current;
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationRequested, setValidationRequested] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const linkFieldsVisible = isLinkEquipmentType(form.equipmentTypeCode);
  const equipmentValidation = { name: !form.name.trim(), contractedDownloadMbps: Boolean(form.contractedDownloadMbps) && Number(form.contractedDownloadMbps) <= 0, contractedUploadMbps: Boolean(form.contractedUploadMbps) && Number(form.contractedUploadMbps) <= 0 };
  async function submit(event: FormEvent) { event.preventDefault(); setValidationRequested(true); setError(''); if (Object.values(equipmentValidation).some(Boolean)) return; if (!isDirty) { onCancel(); return; } setSaving(true); try { await api(`/v1/equipment/${equipment.equipment_id}`, token, { method: 'PATCH', body: JSON.stringify({ equipmentTypeCode: form.equipmentTypeCode, name: form.name, serialNumber: form.serialNumber || undefined, managementAddress: form.managementAddress || undefined, contractedDownloadMbps: linkFieldsVisible && form.contractedDownloadMbps ? Number(form.contractedDownloadMbps) : undefined, contractedUploadMbps: linkFieldsVisible && form.contractedUploadMbps ? Number(form.contractedUploadMbps) : undefined }) }); await onSaved(); onToast({ type: 'success', title: 'Equipamento atualizado', detail: `As alterações em ${form.name} foram salvas.` }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao atualizar equipamento.'); } finally { setSaving(false); } }
  return <section className="users-page">
    <div className="section-heading">
      <div><p className="eyebrow">CADASTRO DE INVENTÁRIO</p><h2>Editar equipamento</h2><small>Atualize os dados de {equipment.name}.</small></div>
    </div>
    <button className="back-button" onClick={onCancel}>← Voltar para a unidade</button>
    <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">DADOS DO EQUIPAMENTO</p>
          <h3>Dados do equipamento</h3>
          <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="user-form-grid">
        <div className="mfield">
          <div className="input-group has-icon is-dropdown">
            <span className="input-icon" aria-hidden="true"><PackageIcon /></span>
            <AppDropdown value={form.equipmentTypeCode} onChange={(next) => setForm({ ...form, equipmentTypeCode: next })} options={[{ value: 'linux_server', label: 'Servidor Linux' }, { value: 'mikrotik', label: 'Mikrotik' }, { value: 'starlink', label: 'Starlink' }, { value: 'vpn', label: 'VPN' }, { value: 'internet_link', label: 'Link de internet' }]} />
            <span className="input-group-label">Tipo <b className="req">*</b></span>
          </div>
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><FolderIcon /></span>
            <input id="ee-name" value={form.name} className={validationRequested && equipmentValidation.name ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder=" " required />
            <label htmlFor="ee-name">Nome <b className="req">*</b></label>
          </div>
          {validationRequested && equipmentValidation.name && <span className="field-error-text">Informe o nome do equipamento.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><NavLinkIcon /></span>
            <input id="ee-address" value={form.managementAddress} onChange={(e) => setForm({ ...form, managementAddress: e.target.value })} placeholder=" " />
            <label htmlFor="ee-address">Endereço de gerenciamento <em>opcional</em></label>
          </div>
          <span className="field-hint">Ex.: 10.0.0.50</span>
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
            <input id="ee-serial" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder=" " />
            <label htmlFor="ee-serial">Número de série <em>opcional</em></label>
          </div>
        </div>
        {linkFieldsVisible && <>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><PingIcon /></span>
              <input id="ee-down" type="number" min="0.001" max="1000000" step="0.001" value={form.contractedDownloadMbps} className={validationRequested && equipmentValidation.contractedDownloadMbps ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, contractedDownloadMbps: e.target.value })} placeholder=" " />
              <label htmlFor="ee-down">Download contratado <em>Mbps · opcional</em></label>
            </div>
            {validationRequested && equipmentValidation.contractedDownloadMbps ? <span className="field-error-text">Informe um valor maior que zero.</span> : <span className="field-hint">Campos vazios são apresentados como N/D.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><PingIcon /></span>
              <input id="ee-up" type="number" min="0.001" max="1000000" step="0.001" value={form.contractedUploadMbps} className={validationRequested && equipmentValidation.contractedUploadMbps ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, contractedUploadMbps: e.target.value })} placeholder=" " />
              <label htmlFor="ee-up">Upload contratado <em>Mbps · opcional</em></label>
            </div>
            {validationRequested && equipmentValidation.contractedUploadMbps && <span className="field-error-text">Informe um valor maior que zero.</span>}
          </div>
        </>}
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button clear-filters-button" onClick={onCancel}><CloseIcon /> Cancelar</button>
        <button className="primary" disabled={saving || !isDirty}>{saving ? 'Salvando…' : <><CheckIcon /> Salvar alterações</>}</button>
      </div>
    </form>
  </section>;
}

const starlinkMetricLabels: Record<string, string> = {
  'starlink.latency.ms': 'Latência', 'starlink.loss.pct': 'Perda', 'starlink.download.bps': 'Download', 'starlink.upload.bps': 'Upload',
  'starlink.obstruction.pct': 'Obstrução', 'starlink.signal.snr': 'SNR', 'starlink.temperature.c': 'Temperatura', 'starlink.alerts.active': 'Alertas ativos',
  'starlink.location.latitude': 'Latitude', 'starlink.location.longitude': 'Longitude', 'starlink.coverage.available': 'Cobertura',
};

function formatStarlinkMetric(sample: { metric_key: string; value: number | string; unit: string }, zeroed = false): string {
  if (zeroed && (sample.metric_key.includes('latitude') || sample.metric_key.includes('longitude'))) return 'N/D';
  if (zeroed) return sample.metric_key === 'starlink.download.bps' || sample.metric_key === 'starlink.upload.bps' ? '0 Mbps' : sample.unit === '%' ? formatPercent(0, 2) : `0 ${sample.unit}`;
  const value = Number(sample.value);
  if (!Number.isFinite(value)) return 'N/D';
  if (sample.metric_key === 'starlink.download.bps' || sample.metric_key === 'starlink.upload.bps') return `${(value / 1_000_000).toFixed(2)} Mbps`;
  if (sample.metric_key === 'starlink.coverage.available') return value === 1 ? 'Disponível' : 'Indisponível';
  if (sample.metric_key.includes('latitude') || sample.metric_key.includes('longitude')) return value.toFixed(6);
  if (sample.unit === '%') return formatPercent(value, 2);
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${sample.unit}`;
}

function starlinkSampleValue(metrics: StarlinkTelemetry['metrics'], key: string, stale: boolean): string {
  const sample = metrics.find((item) => item.metric_key === key);
  return sample ? formatStarlinkMetric(sample, stale) : 'N/D';
}

function StarlinkTelemetryPanel({ unit, equipment, token, actionsSlot }: { unit: Unit; equipment: Equipment[]; token: string; actionsSlot?: HTMLElement | null }) {
  const starlinks = equipment.filter((item) => item.equipment_type === 'starlink');
  const [telemetry, setTelemetry] = useState<StarlinkTelemetry[]>([]);
  const [linkedAgents, setLinkedAgents] = useState<Record<string, boolean>>({});
  const [sourceBusy, setSourceBusy] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const STARLINK_PAGE_SIZE = 3;
  const [starlinkPage, setStarlinkPage] = useState(1);
  async function refresh() {
    if (!starlinks.length) { setTelemetry([]); return; }
    setLoading(true); setError('');
    try { setTelemetry(await Promise.all(starlinks.map((item) => api<StarlinkTelemetry>(`/v1/integrations/starlink/telemetry/${item.equipment_id}`, token)))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao consultar a telemetria Starlink.'); }
    finally { setLoading(false); }
  }
  async function toggleLocalAgent(equipmentId: string) {
    const enabled = !linkedAgents[equipmentId];
    setSourceBusy(equipmentId); setSourceMessage('');
    try {
      await api(`/v1/integrations/starlink/sources/${equipmentId}`, token, { method: 'PUT', body: JSON.stringify(localAgentSourcePayload(enabled)) });
      setLinkedAgents((current) => ({ ...current, [equipmentId]: enabled }));
      setSourceMessage(enabled ? 'Agente local vinculado. Inicie o serviço na unidade para receber o heartbeat.' : 'Agente local desvinculado.');
    } catch (reason) { setSourceMessage(reason instanceof Error ? reason.message : 'Não foi possível atualizar o vínculo do agente.'); }
    finally { setSourceBusy(null); }
  }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15_000); return () => window.clearInterval(timer); }, [equipment, token]);
  if (!starlinks.length) return null;
  const starlinkTotalPages = Math.max(1, Math.ceil(telemetry.length / STARLINK_PAGE_SIZE));
  const starlinkCurrentPage = Math.min(starlinkPage, starlinkTotalPages);
  const pagedTelemetry = telemetry.slice((starlinkCurrentPage - 1) * STARLINK_PAGE_SIZE, starlinkCurrentPage * STARLINK_PAGE_SIZE);
  const soloItem = pagedTelemetry.length === 1 ? pagedTelemetry[0] : null;
  const headerActions = <><button className="secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshIcon /> {loading ? 'Atualizando…' : 'Atualizar'}</button>{soloItem && (linkedAgents[soloItem.equipmentId] === true
      ? <button className="secondary-button clear-filters-button" onClick={() => void toggleLocalAgent(soloItem.equipmentId)} disabled={sourceBusy === soloItem.equipmentId}>{sourceBusy === soloItem.equipmentId ? 'Salvando…' : <><CloseIcon /> Desvincular agente</>}</button>
      : <button className="primary" onClick={() => void toggleLocalAgent(soloItem.equipmentId)} disabled={sourceBusy === soloItem.equipmentId}>{sourceBusy === soloItem.equipmentId ? 'Salvando…' : <><PlusIcon /> Vincular agente local</>}</button>)}</>;
  return <section className="starlink-telemetry-panel panel">{actionsSlot ? createPortal(headerActions, actionsSlot) : null}<div className="panel-title"><div><p className="eyebrow">TELEMETRIA STARLINK</p><h3>Métricas da antena</h3><small className="starlink-unit-location">Unidade vinculada: {unit.name} · {unit.city}/{unit.state_code}</small></div>{!actionsSlot && <div className="starlink-header-actions">{headerActions}</div>}</div>{error && <div className="error-banner">{error}</div>}{sourceMessage && <div className="success-banner">{sourceMessage}</div>}{pagedTelemetry.map((item) => { const stale = !item.observedAt || Date.now() - new Date(item.observedAt).getTime() > 30_000; const latitude = starlinkSampleValue(item.metrics, 'starlink.location.latitude', stale); const longitude = starlinkSampleValue(item.metrics, 'starlink.location.longitude', stale); const linked = linkedAgents[item.equipmentId] === true; return <article className="starlink-telemetry-card" key={item.equipmentId}>{!soloItem && <div className="starlink-telemetry-card-head"><strong>{item.equipmentName}</strong><button className="secondary-button compact" onClick={() => void toggleLocalAgent(item.equipmentId)} disabled={sourceBusy === item.equipmentId}>{sourceBusy === item.equipmentId ? 'Salvando…' : linked ? <><CloseIcon /> Desvincular agente</> : <><PlusIcon /> Vincular agente local</>}</button></div>}{(item.collectorError || stale) && <div className="error-banner starlink-collector-error">{item.collectorError ?? 'Agente Starlink sem comunicação recente.'}</div>}{item.metrics.length ? <div className="starlink-table-wrap"><table className="starlink-collector-table"><thead><tr><th>Hora</th><th>Latência</th><th>Perda</th><th>Download</th><th>Upload</th><th>Obstrução</th><th>Localização da antena</th><th>Origem</th></tr></thead><tbody><tr><td>{item.observedAt ? new Date(item.observedAt).toLocaleTimeString('pt-BR') : 'N/D'}</td><td>{starlinkSampleValue(item.metrics, 'starlink.latency.ms', stale)}</td><td>{starlinkSampleValue(item.metrics, 'starlink.loss.pct', stale)}</td><td>{starlinkSampleValue(item.metrics, 'starlink.download.bps', stale)}</td><td>{starlinkSampleValue(item.metrics, 'starlink.upload.bps', stale)}</td><td>{starlinkSampleValue(item.metrics, 'starlink.obstruction.pct', stale)}</td><td>{latitude !== 'N/D' && longitude !== 'N/D' ? `${latitude} · ${longitude}` : 'N/D'}</td><td>local_agent</td></tr></tbody></table></div> : <p className="muted">Aguardando o agente enviar a primeira amostra.</p>}<div className="starlink-collector-log"><div className="starlink-collector-log-head"><span>ÚLTIMA COLETA</span><small>{item.observedAt ? new Date(item.observedAt).toLocaleTimeString('pt-BR') : 'aguardando'}</small></div><div className="starlink-log-empty">A linha acima é atualizada a cada coleta. A localidade da unidade permanece {unit.city}/{unit.state_code}; a localização da antena usa a última latitude/longitude recebida.</div></div></article>; })}{starlinkTotalPages > 1 && <div className="pagination"><button type="button" className="secondary-button compact" disabled={starlinkCurrentPage <= 1} onClick={() => setStarlinkPage(starlinkCurrentPage - 1)}>Anterior</button><span>Página {starlinkCurrentPage} de {starlinkTotalPages}</span><button type="button" className="secondary-button compact" disabled={starlinkCurrentPage >= starlinkTotalPages} onClick={() => setStarlinkPage(starlinkCurrentPage + 1)}>Próxima</button></div>}</section>;
}

function AgentVersionsPanel({ token, onToast, actions }: { token: string; onToast: (toast: Omit<Toast, 'id'>) => void; actions?: ReactNode }) {
  const [versions, setVersions] = useState<AgentVersionRecord[]>([]);
  const [platform, setPlatform] = useState<AgentPlatform>('windows');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const load = async () => { try { setVersions(await api<AgentVersionRecord[]>('/v1/integrations/zabbix/agent-versions', token)); } catch { /* área pode aguardar a migração */ } finally { setLoaded(true); } };
  useEffect(() => { void load(); }, [token]);
  async function publish() {
    if (!file) return onToast({ type: 'warning', title: 'Arquivo obrigatório', detail: `Selecione o instalador ${platform === 'windows' ? 'Windows' : 'Linux'} do agente.` });
    if (!canPublishAgentVersion(file.name, platform)) return onToast({ type: 'warning', title: 'Pacote inválido', detail: 'Publique um bundle executável .cjs ou .js do agente, não o instalador .ps1/.sh.' });
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const published = await api<AgentVersionRecord>('/v1/integrations/zabbix/agent-versions', token, { method: 'POST', body: JSON.stringify({ platform, fileName: file.name, artifactBase64: btoa(binary) }) });
      await load(); setFile(null); onToast({ type: 'success', title: `Agente ${platform === 'windows' ? 'Windows' : 'Linux'} publicado`, detail: `A versão automática ${published.version} foi validada e está disponível para download.` });
    } catch (reason) { onToast({ type: 'error', title: 'Falha ao publicar agente', detail: reason instanceof Error ? reason.message : 'Não foi possível enviar o arquivo.' }); }
    finally { setBusy(false); }
  }
  return (
    <article className="agent-versions-panel">
      <div className="agent-versions-header">
        <div className="agent-versions-info">
          <p className="eyebrow">REPOSITÓRIO DO AGENTE</p>
          <h3>Versões Windows e Linux</h3>
          <small>Publique um bundle Node <code>.cjs</code> ou <code>.js</code>; a API calcula a versão automaticamente, embute a numeração e valida o checksum SHA-256.</small>
        </div>
        <div className="agent-versions-header-side">
          {actions}
        </div>
      </div>

      <div className="agent-version-form-card">
        <div className="agent-form-field">
          <label className="field-label">Sistema Operacional</label>
          <AppDropdown value={platform} onChange={(next) => setPlatform(next as AgentPlatform)} options={[{ value: 'windows', label: 'Windows (x64)' }, { value: 'linux', label: 'Linux (x64 / ARM)' }]} />
        </div>

        <div className="agent-form-field file-field">
          <label className="field-label">Bundle Node <code>.cjs</code> ou <code>.js</code> do Agente</label>
          <div
            className={`agent-file-picker${dragActive ? ' dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); dragCounter.current += 1; setDragActive(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { event.preventDefault(); dragCounter.current -= 1; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragActive(false); } }}
            onDrop={(event) => { event.preventDefault(); dragCounter.current = 0; setDragActive(false); const dropped = event.dataTransfer.files?.[0]; if (dropped) setFile(dropped); }}
          >
            <input
              type="file"
              id="agent-bundle-file"
              accept=".cjs,.js,application/javascript"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <label htmlFor="agent-bundle-file" className="agent-file-label">
              <span className="file-icon"><FolderIcon /></span>
              <span className="file-name-text">{file ? file.name : dragActive ? 'Solte o arquivo aqui…' : 'Selecionar bundle .cjs ou .js…'}</span>
              <span className="file-browse-btn"><SearchIcon /> Procurar</span>
            </label>
          </div>
        </div>

        <div className="agent-form-action">
          <button className="primary" disabled={busy || !file} onClick={() => void publish()}>
            {busy ? 'Validando e publicando…' : <><UploadIcon /> Publicar versão</>}
          </button>
        </div>
      </div>

      <div className="agent-version-list-section">
        <div className="agent-list-heading">
          <h4>Versões Disponíveis</h4>
          <span className="subtext">Sincronizadas com agentes locais</span>
        </div>
        <div className="agent-version-list">
          {versions.length === 0 ? (
            <div className="agent-version-empty">
              <span className="agent-version-empty-icon"><PackageIcon /></span>
              <p>Nenhuma versão publicada ainda. A primeira versão será <strong>v1.0.0</strong>.</p>
            </div>
          ) : (
            versions.map((item) => (
              <div className={`agent-version-card ${item.active ? 'is-active' : 'is-inactive'}`} key={item.id}>
                <div className="agent-version-main">
                  <div className="agent-version-title-group">
                    <strong>{item.platform === 'windows' ? 'Windows' : 'Linux'}</strong>
                    <span className="version-tag">v{item.version}</span>
                  </div>
                </div>
                <div className="agent-version-meta">
                  <span className="file-name">{item.file_name}</span>
                  <span className="file-size">{Math.round(item.file_size / 1024)} KB</span>
                  <span className="file-hash" title={item.checksum_sha256}>
                    SHA-256: <code>{item.checksum_sha256.slice(0, 10)}…</code>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function UnitDetail({ unit, equipment, onBack, onEdit, onRequestEdit, onCreateEquipment, onRefresh, onRequestDelete, onToast = () => undefined }: { unit: Unit; equipment: Equipment[]; onBack: () => void; onEdit: (equipment: Equipment) => void; onRequestEdit: (unit: Unit) => void; onCreateEquipment: () => void; onRefresh: () => Promise<void>; onRequestDelete: (unit: Unit) => void; onToast?: (toast: Omit<Toast, 'id'>) => void }) {
  const token = (JSON.parse(sessionStorage.getItem('healthlink.session') ?? '{}') as { accessToken?: string }).accessToken ?? '';
  const starlinkCount = equipment.filter((item) => item.equipment_type === 'starlink').length;
  const hasStarlink = starlinkCount > 0;
  const [tab, setTab] = useState<'overview' | 'equipment' | 'starlink'>('overview');
  useEffect(() => { if (tab === 'starlink' && !hasStarlink) setTab('overview'); }, [tab, hasStarlink]);
  const EQUIPMENT_PAGE_SIZE = 10;
  const [equipmentPage, setEquipmentPage] = useState(1);
  const equipmentTotalPages = Math.max(1, Math.ceil(equipment.length / EQUIPMENT_PAGE_SIZE));
  const equipmentCurrentPage = Math.min(equipmentPage, equipmentTotalPages);
  const pagedEquipment = equipment.slice((equipmentCurrentPage - 1) * EQUIPMENT_PAGE_SIZE, equipmentCurrentPage * EQUIPMENT_PAGE_SIZE);
  useEffect(() => { setEquipmentPage(1); }, [tab, equipment.length]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<Equipment | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
  const [agentServer, setAgentServer] = useState<Equipment | null>(null);
  const [agentPlatform, setAgentPlatform] = useState<AgentPlatform>('windows');
  const [agentGenerating, setAgentGenerating] = useState(false);
  const [agentGenerationError, setAgentGenerationError] = useState('');
  const servers = equipment.filter((item) => item.active !== false && (item.equipment_type === 'linux_server' || item.equipment_type === 'server'));
  const agentRequirements = getAgentProvisioningRequirements(equipment.map((item) => ({ equipment_id: item.equipment_id, equipment_type: item.equipment_type, active: item.active })));
  const missingAgentRequirements = agentRequirements.missingMessages;
  function openAgentGenerator(server: Equipment) {
    if (missingAgentRequirements.length) {
      onToast({ type: 'warning', title: 'Requisitos ausentes', detail: missingAgentRequirements.join(' ') });
      return;
    }
    setAgentGenerationError('');
    setAgentServer(server);
  }
  async function generateAgentInstaller() {
    if (!agentServer) return;
    setAgentGenerating(true);
    setAgentGenerationError('');
    try {
      const response = await fetch(`${apiBase}/v1/units/${unit.unit_id}/collection-agents/installer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ serverEquipmentId: agentServer.equipment_id, platform: agentPlatform }),
      });
      if (!response.ok) {
        let message = `Falha na plataforma (HTTP ${response.status}).`;
        try { const payload = await response.json() as { message?: string; error?: string }; message = payload.message || payload.error || message; } catch { /* resposta sem JSON */ }
        throw new Error(message);
      }
      const blob = await response.blob();
      const fileName = extractAgentInstallerFileName(response.headers.get('content-disposition'), agentInstallerFileName(unit.code, agentPlatform));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setAgentServer(null);
      onToast({ type: 'success', title: 'Agente gerado', detail: `${fileName} baixado. Execute o arquivo uma única vez no servidor ${agentServer.name}.` });
    } catch (reason) {
      setAgentGenerationError(reason instanceof Error ? reason.message : 'Não foi possível gerar o instalador.');
    } finally { setAgentGenerating(false); }
  }
  async function confirmDeactivate() {
    if (!blockTarget) return;
    setProcessingId(blockTarget.equipment_id);
    try { await api(`/v1/equipment/${blockTarget.equipment_id}`, token, { method: 'DELETE' }); await onRefresh(); onToast({ type: 'success', title: 'Equipamento bloqueado', detail: `${blockTarget.name} parou de contar para o status da unidade.` }); setProcessingId(null); setBlockTarget(null); }
    catch (reason) { onToast({ type: 'error', title: 'Falha ao bloquear equipamento', detail: reason instanceof Error ? reason.message : 'Tente novamente em instantes.' }); setProcessingId(null); setBlockTarget(null); }
  }
  async function confirmReactivate() {
    if (!unblockTarget) return;
    setProcessingId(unblockTarget.equipment_id);
    try { await api(`/v1/equipment/${unblockTarget.equipment_id}/reactivate`, token, { method: 'POST' }); await onRefresh(); onToast({ type: 'success', title: 'Equipamento desbloqueado', detail: `${unblockTarget.name} voltou a contar para o status da unidade.` }); setProcessingId(null); setUnblockTarget(null); }
    catch (reason) { onToast({ type: 'error', title: 'Falha ao desbloquear equipamento', detail: reason instanceof Error ? reason.message : 'Tente novamente em instantes.' }); setProcessingId(null); setUnblockTarget(null); }
  }
  async function confirmRemove() {
    if (!deleteTarget) return;
    setProcessingId(deleteTarget.equipment_id);
    try { await api(`/v1/equipment/${deleteTarget.equipment_id}/permanent`, token, { method: 'DELETE' }); await onRefresh(); onToast({ type: 'success', title: 'Equipamento excluído', detail: `${deleteTarget.name} foi removido definitivamente.` }); setProcessingId(null); setDeleteTarget(null); }
    catch (reason) { onToast({ type: 'error', title: 'Falha ao excluir equipamento', detail: reason instanceof Error ? reason.message : 'Tente novamente em instantes.' }); setProcessingId(null); setDeleteTarget(null); }
  }
  return <section className="unit-detail">
    <div className="section-heading units-module-heading">
      <div><p className="eyebrow">UNIDADE SELECIONADA · {unit.code}</p><h2>{unit.name}</h2><small>Gerencie os equipamentos e ativos vinculados a esta unidade.</small></div>
    </div>
    <button className="back-button" onClick={onBack}>← Voltar ao centro operacional</button>
    <div className="unit-detail-tabbar">
      <div className="alert-tabs unit-detail-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'overview'} className={`alert-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Visão geral <span>—</span></button>
        <button type="button" role="tab" aria-selected={tab === 'equipment'} className={`alert-tab ${tab === 'equipment' ? 'active' : ''}`} onClick={() => setTab('equipment')}>Equipamentos <span>{tab === 'equipment' ? equipment.length : '—'}</span></button>
        {hasStarlink && <button type="button" role="tab" aria-selected={tab === 'starlink'} className={`alert-tab ${tab === 'starlink' ? 'active' : ''}`} onClick={() => setTab('starlink')}>Telemetria Starlink <span>{tab === 'starlink' ? starlinkCount : '—'}</span></button>}
      </div>
      <div className="unit-detail-tabbar-actions">
        <span className={`status ${unit.operational_status}`}>{statusLabel[unit.operational_status]}</span>
      </div>
    </div>
    {tab === 'overview' && <article className="panel unit-overview-panel" key="overview">
      <div className="section-heading"><div><p className="eyebrow">PRONTIDÃO OPERACIONAL</p><h2>Resumo da unidade</h2><small>Situação consolidada dos ativos monitorados nesta unidade.</small></div><div className="units-heading-actions"><button type="button" className="secondary-button clear-filters-button" onClick={() => onRequestDelete(unit)}><TrashIcon /> Excluir unidade</button><button type="button" className="primary" onClick={() => onRequestEdit(unit)}><EditIcon /> Editar unidade</button></div></div>
      <div className="readiness-panel readiness-block"><div className="readiness-score"><strong>{equipment.filter((item) => item.operational_status === 'online').length}</strong><span>de {equipment.length}<small>ativos confirmados</small></span></div><div className="readiness-line"><i style={{ width: `${equipment.length ? equipment.filter((item) => item.operational_status === 'online').length / equipment.length * 100 : 0}%` }} /></div><dl><div><dt>Indisponíveis</dt><dd>{equipment.filter((item) => item.operational_status === 'offline').length}</dd></div><div><dt>Em atenção</dt><dd>{equipment.filter((item) => item.operational_status === 'degraded').length}</dd></div><div><dt>Sem telemetria</dt><dd>{equipment.filter((item) => item.operational_status === 'unknown').length}</dd></div></dl></div>
    </article>}
    {tab === 'equipment' && <article className="panel" key="equipment">
      <div className="section-heading"><div><p className="eyebrow">ATIVOS MONITORADOS</p><h2>Infraestrutura da unidade</h2></div><button type="button" className="primary" onClick={onCreateEquipment}><PlusIcon /> Cadastrar equipamento</button></div>
      <div className="agent-provisioning"><div><p className="eyebrow">AGENTE DE COLETA</p><h4>Instalação em arquivo único</h4><small>{missingAgentRequirements.length ? `Requisitos pendentes: ${missingAgentRequirements.join(' ')}` : `${servers.length} servidor(es) e ${agentRequirements.sources.length} fonte(s) elegíveis. Use o botão no servidor escolhido.`}</small></div>{missingAgentRequirements.length > 0 && <button className="secondary-button compact" onClick={() => onToast({ type: 'warning', title: 'Requisitos ausentes', detail: missingAgentRequirements.join(' ') })}><WarningIcon /> Ver requisitos</button>}</div>
      {equipment.length === 0 ? <div className="empty-state compact-empty"><p>Nenhum equipamento cadastrado nesta unidade.</p></div> : <><div className="equipment-list">{pagedEquipment.map((item) => { const blocked = item.active === false; const isServer = item.equipment_type === 'server' || item.equipment_type === 'linux_server'; return <div className={`equipment-row ${blocked ? 'blocked' : item.operational_status}`} key={item.equipment_id}><span className={`equipment-indicator ${blocked ? 'blocked' : item.operational_status}`} /><div><strong>{item.name}</strong><small>{item.equipment_type.replaceAll('_', ' ')} · {item.management_address ?? 'sem endereço'}</small></div><div className="equipment-state"><span className={`status ${blocked ? 'blocked' : item.operational_status}`}>{blocked ? 'Bloqueado' : statusLabel[item.operational_status]}</span><small>{blocked ? 'telemetria desativada' : item.observed_at ? new Date(item.observed_at).toLocaleString('pt-BR') : 'aguardando coleta'}</small></div><div className="equipment-actions"><RowActionsMenu active={!blocked} label={`Ações de ${item.name}`} onGenerateAgent={isServer && !blocked ? () => openAgentGenerator(item) : undefined} onEdit={() => onEdit(item)} onBlock={() => setBlockTarget(item)} onUnblock={() => setUnblockTarget(item)} onDelete={() => setDeleteTarget(item)} /></div></div>; })}</div>{equipmentTotalPages > 1 && <div className="pagination"><button type="button" className="secondary-button compact" disabled={equipmentCurrentPage <= 1} onClick={() => setEquipmentPage(equipmentCurrentPage - 1)}>Anterior</button><span>Página {equipmentCurrentPage} de {equipmentTotalPages}</span><button type="button" className="secondary-button compact" disabled={equipmentCurrentPage >= equipmentTotalPages} onClick={() => setEquipmentPage(equipmentCurrentPage + 1)}>Próxima</button></div>}</>}
    </article>}
    {tab === 'starlink' && <StarlinkTelemetryPanel unit={unit} equipment={equipment} token={token} />}
    {agentServer && <FormCard title={`Gerar agente · ${agentServer.name}`} onCancel={() => { if (!agentGenerating) setAgentServer(null); }}><form className="inline-form" onSubmit={(event) => { event.preventDefault(); void generateAgentInstaller(); }}><div className="agent-installer-summary"><p className="eyebrow">ARQUIVO ÚNICO · SEM CONFIGURAÇÃO MANUAL</p><p>O instalador já leva o vínculo desta unidade, o servidor e as fontes elegíveis. Execute uma única vez no equipamento servidor; depois o serviço coleta, envia heartbeat e atualiza o agente sozinho.</p><small>O link de instalação expira em 30 minutos e só pode ser consumido uma vez.</small></div><label>Sistema operacional<AppDropdown value={agentPlatform} onChange={(next) => setAgentPlatform(next as AgentPlatform)} disabled={agentGenerating} options={[{ value: 'windows', label: 'Windows · PowerShell' }, { value: 'linux', label: 'Linux · systemd' }]} /></label><div className="agent-installer-sources"><span className="field-label">Fontes que serão vinculadas</span>{agentRequirements.sources.map((source) => <small key={source.equipment_id}>● {equipment.find((item) => item.equipment_id === source.equipment_id)?.name ?? source.equipment_type} · {source.equipment_type.replaceAll('_', ' ')}</small>)}</div>{agentGenerationError && <div className="error-banner" role="alert">{agentGenerationError}</div>}<div className="form-actions"><button type="button" className="secondary-button clear-filters-button" onClick={() => setAgentServer(null)} disabled={agentGenerating}><CloseIcon /> Cancelar</button><button className="primary" disabled={agentGenerating}>{agentGenerating ? 'Gerando e preparando download…' : 'Gerar e baixar instalador'}</button></div></form></FormCard>}
    {blockTarget && <ConfirmDialog title="Bloquear equipamento" message={`Bloquear o equipamento "${blockTarget.name}"? Ele para de contar para o status da unidade e para de receber telemetria, assim como um usuário bloqueado. O histórico será preservado.`} confirmLabel="Bloquear" confirmIcon={<BlockIcon />} tone="warning" busy={processingId === blockTarget.equipment_id} onConfirm={() => void confirmDeactivate()} onCancel={() => setBlockTarget(null)} />}
    {unblockTarget && <ConfirmDialog title="Desbloquear equipamento" message={`Desbloquear o equipamento "${unblockTarget.name}"? Ele volta a contar para o status da unidade e a receber telemetria normalmente.`} confirmLabel="Desbloquear" confirmIcon={<UnblockIcon />} tone="positive" busy={processingId === unblockTarget.equipment_id} onConfirm={() => void confirmReactivate()} onCancel={() => setUnblockTarget(null)} />}
    {deleteTarget && <ConfirmDialog title="Excluir equipamento" message={`Excluir definitivamente o equipamento "${deleteTarget.name}"? Esta ação não pode ser desfeita.`} confirmLabel="Excluir" confirmIcon={<TrashIcon />} busy={processingId === deleteTarget.equipment_id} onConfirm={() => void confirmRemove()} onCancel={() => setDeleteTarget(null)} />}
  </section>;
}

function RowActionsMenu({ active, onGenerateAgent, onEdit, onBlock, onUnblock, onDelete, label = 'Ações' }: { active: boolean; onGenerateAgent?: () => void; onEdit: () => void; onBlock: () => void; onUnblock: () => void; onDelete: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onEscape); };
  }, [open]);
  return <div className={`row-menu ${open ? 'open' : ''}`} ref={rootRef}>
    <button type="button" className="icon-button row-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((prev) => !prev)}><MoreVerticalIcon /></button>
    {open && <div className="row-menu-dropdown" role="menu" onMouseDown={(event) => event.stopPropagation()}>
      {onGenerateAgent && <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); onGenerateAgent(); }}><span className="dropdown-item-icon"><AgentIcon /></span><span>Gerar agente</span></button>}
      <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); onEdit(); }}><span className="dropdown-item-icon"><EditIcon /></span><span>Editar</span></button>
      {active
        ? <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); onBlock(); }}><span className="dropdown-item-icon"><BlockIcon /></span><span>Bloquear</span></button>
        : <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); onUnblock(); }}><span className="dropdown-item-icon"><UnblockIcon /></span><span>Desbloquear</span></button>}
      <div className="dropdown-divider" />
      <button type="button" role="menuitem" className="dropdown-item logout" onClick={() => { setOpen(false); onDelete(); }}><span className="dropdown-item-icon"><TrashIcon /></span><span>Excluir</span></button>
    </div>}
  </div>;
}

function UnitActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEscape);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onEscape); };
  }, [open]);
  return <div className={`row-menu ${open ? 'open' : ''}`} ref={rootRef}>
    <button type="button" className="icon-button row-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Ações da unidade" onClick={() => setOpen((prev) => !prev)}><MoreVerticalIcon /></button>
    {open && <div className="row-menu-dropdown" role="menu" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); onEdit(); }}><span className="dropdown-item-icon"><EditIcon /></span><span>Editar unidade</span></button>
      <div className="dropdown-divider" />
      <button type="button" role="menuitem" className="dropdown-item logout" onClick={() => { setOpen(false); onDelete(); }}><span className="dropdown-item-icon"><TrashIcon /></span><span>Excluir unidade</span></button>
    </div>}
  </div>;
}


function UsersPanel({ users, requests, loading, token, onRefresh, onChange, onToast, creating, onCreatingChange, editingUserId, onEditingUserIdChange }: { users: ManagedUser[]; requests: AccessRequest[]; loading: boolean; token: string; onRefresh: () => Promise<void>; onChange: (id: string, action: 'block' | 'unblock' | 'delete') => Promise<void>; onToast: (toast: Omit<Toast, 'id'>) => void; creating: boolean; onCreatingChange: (value: boolean) => void; editingUserId: string | null; onEditingUserIdChange: (value: string | null) => void }) {
  const emptyUserForm = { displayName: '', email: '', password: '', role: '', cpf: '', coligada: 'HealthLink Sentinel', active: true };
  const [form, setForm] = useState(emptyUserForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  function resetCreateForm() { setForm(emptyUserForm); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false); }
  const createEmailMissing = submitted && !form.email.trim();
  const createEmailInvalid = submitted && !createEmailMissing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const editing = editingUserId;
  const setEditing = onEditingUserIdChange;
  const [editForm, setEditForm] = useState(emptyUserForm);
  const [initialEditForm, setInitialEditForm] = useState(emptyUserForm);
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const isDirty = JSON.stringify(editForm) !== JSON.stringify(initialEditForm);
  const editingIsGlobalAdmin = editing ? users.find((user) => user.id === editing)?.roles.includes('global_administrator') ?? false : false;
  useEffect(() => { if (!editing) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelEdit(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [editing]);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const setCreating = onCreatingChange;
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [blockTarget, setBlockTarget] = useState<ManagedUser | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<ManagedUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filteredUsers = users.filter((user) => {
    if (nameFilter.trim() && !user.display_name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    if (statusFilter === 'active' && !user.active) return false;
    if (statusFilter === 'inactive' && user.active) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearUserFilters() {
    setNameFilter('');
    setStatusFilter('');
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await onChange(deleteTarget.id, 'delete'); setDeleteTarget(null); }
    finally { setDeleting(false); }
  }

  async function confirmBlock() {
    if (!blockTarget) return;
    setBlocking(true);
    try { await onChange(blockTarget.id, 'block'); setBlockTarget(null); }
    finally { setBlocking(false); }
  }

  async function confirmUnblock() {
    if (!unblockTarget) return;
    setUnblocking(true);
    try { await onChange(unblockTarget.id, 'unblock'); setUnblockTarget(null); }
    finally { setUnblocking(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (validateManagedUserForm({ displayName: form.displayName, email: form.email, role: form.role, password: form.password, editing: false }).length > 0 || confirmPassword !== form.password) {
      return;
    }
    setSaving(true);
    try {
      await api('/v1/users', token, { method: 'POST', body: JSON.stringify({ displayName: form.displayName, email: form.email, password: form.password, role: form.role }) });
      resetCreateForm();
      setSubmitted(false); setCreating(false); await onRefresh();
      onToast({ type: 'success', title: 'Usuário criado', detail: 'O novo usuário foi cadastrado com a senha definida no formulário.' });
    } catch (reason) { onToast({ type: 'error', title: 'Falha ao criar usuário', detail: friendlyMessage(reason, 'Não foi possível salvar o usuário. Tente novamente.') }); }
    finally { setSaving(false); }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault(); setEditSubmitted(true);
    if (!editing) return;
    if (validateManagedUserForm({ displayName: editForm.displayName, email: editForm.email, role: editingIsGlobalAdmin ? 'global_administrator' : editForm.role, password: editForm.password, editing: true }).length > 0) {
      return;
    }
    if (editForm.password && editConfirmPassword !== editForm.password) return;
    if (!isDirty) { cancelEdit(); return; }
    setEditSaving(true);
    try {
      await api(`/v1/users/${editing}`, token, { method: 'PATCH', body: JSON.stringify({ displayName: editForm.displayName, password: editForm.password || undefined, role: editingIsGlobalAdmin ? undefined : editForm.role, active: editForm.active }) });
      setEditing(null); setEditSubmitted(false); setEditConfirmPassword(''); setShowEditPassword(false); setShowEditConfirm(false); await onRefresh();
      onToast({ type: 'success', title: 'Usuário atualizado', detail: 'As alterações foram salvas com sucesso.' });
    } catch (reason) { onToast({ type: 'error', title: 'Falha ao atualizar usuário', detail: friendlyMessage(reason, 'Não foi possível salvar o usuário. Tente novamente.') }); }
    finally { setEditSaving(false); }
  }

  function startEdit(user: ManagedUser) {
    setEditing(user.id);
    const nextForm = { displayName: user.display_name, email: user.email, password: '', role: user.roles[0] ?? 'viewer', cpf: '000.000.000-00', coligada: 'HealthLink Sentinel', active: user.active };
    setEditForm(nextForm);
    setInitialEditForm(nextForm);
    setEditConfirmPassword('');
    setShowEditPassword(false);
    setShowEditConfirm(false);
    setEditSubmitted(false);
  }

  function cancelEdit() {
    setEditing(null);
    setEditConfirmPassword('');
    setShowEditPassword(false);
    setShowEditConfirm(false);
    setEditSubmitted(false);
  }

  return <section className="users-page">
    {approvalOpen && <ApprovalModal requests={requests} token={token} onClose={() => setApprovalOpen(false)} onRefresh={onRefresh} onToast={onToast} />}
    {deleteTarget && <ConfirmDialog title="Excluir usuário" message={`Excluir "${deleteTarget.display_name}" do tenant? O histórico global será preservado, mas ele não aparecerá mais nesta lista.`} confirmLabel="Excluir" busy={deleting} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />}
    {blockTarget && <ConfirmDialog title="Bloquear usuário" message={`Bloquear "${blockTarget.display_name}"? O acesso dele à plataforma será suspenso até que seja desbloqueado novamente.`} confirmLabel="Bloquear" confirmIcon={<BlockIcon />} tone="warning" busy={blocking} onConfirm={() => void confirmBlock()} onCancel={() => setBlockTarget(null)} />}
    {unblockTarget && <ConfirmDialog title="Desbloquear usuário" message={`Desbloquear "${unblockTarget.display_name}"? O acesso dele à plataforma será restaurado imediatamente.`} confirmLabel="Desbloquear" confirmIcon={<UnblockIcon />} tone="positive" busy={unblocking} onConfirm={() => void confirmUnblock()} onCancel={() => setUnblockTarget(null)} />}
    {editing ? <>
      <div className="section-heading">
        <div><p className="eyebrow">GOVERNANÇA DE ACESSO</p><h2>Editar usuário</h2><small>Atualize os dados da identidade selecionada.</small></div>
      </div>
      <button className="back-button" onClick={cancelEdit}>← Voltar para a lista de usuários</button>
      <form className="user-form panel users-create-form" onSubmit={submitEdit} noValidate>
        <div className="panel-title">
          <div>
            <p className="eyebrow">DADOS DO USUÁRIO</p>
            <h3>Dados do usuário</h3>
            <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
          </div>
        </div>
        <div className="user-form-grid">
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><UserIcon /></span>
              <input id="eu-name" value={editForm.displayName} className={editSubmitted && !editForm.displayName.trim() ? 'field-invalid' : ''} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} placeholder=" " required />
              <label htmlFor="eu-name">Nome completo <b className="req">*</b></label>
            </div>
            {editSubmitted && !editForm.displayName.trim() && <span className="field-error-text">Informe o nome completo.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><MailIcon /></span>
              <input id="eu-email" type="text" value={editForm.email} disabled placeholder=" " />
              <label htmlFor="eu-email">E-mail</label>
            </div>
            <span className="field-hint">O e-mail não pode ser alterado por aqui.</span>
          </div>
          <div className="mfield">
            <div className="input-group has-icon is-dropdown">
              <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
              {editingIsGlobalAdmin
                ? <AppDropdown placeholder="Administrador global" value="" disabled onChange={() => undefined} options={[]} />
                : <AppDropdown placeholder="Selecione um perfil" invalid={editSubmitted && !editForm.role} value={editForm.role} onChange={(next) => setEditForm({ ...editForm, role: next })} options={[{ value: 'tenant_administrator', label: 'Administrador' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'mobile_unit_supervisor', label: 'Supervisor de unidades móveis' }, { value: 'noc_operator', label: 'Operador NOC' }, { value: 'service_agent', label: 'Agente de integração' }, { value: 'viewer', label: 'Visualizador' }]} />}
              <span className="input-group-label">Perfil <b className="req">*</b></span>
            </div>
            {editingIsGlobalAdmin && <span className="field-hint">O perfil de administrador global não pode ser alterado por este formulário.</span>}
            {!editingIsGlobalAdmin && editSubmitted && !editForm.role && <span className="field-error-text">Selecione o perfil.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon is-dropdown">
              <span className="input-icon" aria-hidden="true"><UnblockIcon /></span>
              <AppDropdown value={editForm.active ? 'active' : 'inactive'} onChange={(next) => setEditForm({ ...editForm, active: next === 'active' })} options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Bloqueado' }]} />
              <span className="input-group-label">Status <b className="req">*</b></span>
            </div>
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><LockIcon /></span>
              <div className="password-field">
                <input id="eu-password" type={showEditPassword ? 'text' : 'password'} name="hl-new-account-password" autoComplete="new-password" data-lpignore="true" data-1p-ignore minLength={8} value={editForm.password} className={editSubmitted && !!editForm.password && editForm.password.length < 8 ? 'field-invalid' : ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder=" " />
                <button type="button" className="password-toggle" onClick={() => setShowEditPassword((prev) => !prev)} aria-label={showEditPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showEditPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label htmlFor="eu-password">Nova senha (opcional)</label>
            </div>
            {editSubmitted && !!editForm.password && editForm.password.length < 8 && <span className="field-error-text">Pelo menos 8 caracteres.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><LockIcon /></span>
              <div className="password-field">
                <input id="eu-password-confirm" type={showEditConfirm ? 'text' : 'password'} name="hl-new-account-password-confirm" autoComplete="new-password" data-lpignore="true" data-1p-ignore value={editConfirmPassword} className={editSubmitted && !!editForm.password && editConfirmPassword !== editForm.password ? 'field-invalid' : ''} onChange={(e) => setEditConfirmPassword(e.target.value)} placeholder=" " />
                <button type="button" className="password-toggle" onClick={() => setShowEditConfirm((prev) => !prev)} aria-label={showEditConfirm ? 'Ocultar senha' : 'Mostrar senha'}>{showEditConfirm ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label htmlFor="eu-password-confirm">Confirmar nova senha</label>
            </div>
            {editSubmitted && !!editForm.password && editConfirmPassword !== editForm.password && <span className="field-error-text">As senhas não coincidem.</span>}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button clear-filters-button" onClick={cancelEdit}><CloseIcon /> Cancelar</button>
          <button className="primary" disabled={editSaving || !isDirty}>{editSaving ? 'Salvando…' : <><CheckIcon /> Salvar alterações</>}</button>
        </div>
      </form>
    </> : creating ? <>
      <div className="section-heading">
        <div><p className="eyebrow">GOVERNANÇA DE ACESSO</p><h2>Criar novo usuário</h2><small>Preencha os dados abaixo para registrar uma nova identidade.</small></div>
      </div>
      <button className="back-button" onClick={() => { setCreating(false); resetCreateForm(); setSubmitted(false); }}>← Voltar para a lista de usuários</button>
      <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
        <div className="panel-title">
          <div>
            <p className="eyebrow">DADOS DO USUÁRIO</p>
            <h3>Dados do usuário</h3>
            <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
          </div>
        </div>
        <div className="user-form-grid">
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><UserIcon /></span>
              <input id="cu-name" value={form.displayName} className={submitted && !form.displayName.trim() ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder=" " required />
              <label htmlFor="cu-name">Nome completo <b className="req">*</b></label>
            </div>
            {submitted && !form.displayName.trim() && <span className="field-error-text">Informe o nome completo.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><MailIcon /></span>
              <input id="cu-email" type="text" inputMode="email" name="hl-account-email-field" autoComplete="off" data-lpignore="true" data-1p-ignore value={form.email} className={createEmailMissing || createEmailInvalid ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder=" " required />
              <label htmlFor="cu-email">E-mail <b className="req">*</b></label>
            </div>
            {createEmailMissing && <span className="field-error-text">Informe o e-mail.</span>}
            {createEmailInvalid && <span className="field-error-text">Informe um e-mail válido, como nome@dominio.com.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon is-dropdown">
              <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
              <AppDropdown placeholder="Selecione um perfil" invalid={submitted && !form.role} value={form.role} onChange={(next) => setForm({ ...form, role: next })} options={[{ value: 'tenant_administrator', label: 'Administrador' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'mobile_unit_supervisor', label: 'Supervisor de unidades móveis' }, { value: 'noc_operator', label: 'Operador NOC' }, { value: 'service_agent', label: 'Agente de integração' }, { value: 'viewer', label: 'Visualizador' }]} />
              <span className="input-group-label">Perfil <b className="req">*</b></span>
            </div>
            {submitted && !form.role && <span className="field-error-text">Selecione o perfil.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon is-dropdown">
              <span className="input-icon" aria-hidden="true"><UnblockIcon /></span>
              <AppDropdown value={form.active ? 'active' : 'inactive'} onChange={(next) => setForm({ ...form, active: next === 'active' })} options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Bloqueado' }]} />
              <span className="input-group-label">Status <b className="req">*</b></span>
            </div>
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><LockIcon /></span>
              <div className="password-field">
                <input id="cu-password" type={showPassword ? 'text' : 'password'} name="hl-new-account-password" autoComplete="new-password" data-lpignore="true" data-1p-ignore minLength={8} value={form.password} className={submitted && (!form.password || form.password.length < 8) ? 'field-invalid' : ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder=" " required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label htmlFor="cu-password">Senha <b className="req">*</b></label>
            </div>
            {submitted && !form.password && <span className="field-error-text">Informe uma senha para o usuário.</span>}
            {submitted && !!form.password && form.password.length < 8 && <span className="field-error-text">Pelo menos 8 caracteres.</span>}
          </div>
          <div className="mfield">
            <div className="input-group has-icon">
              <span className="input-icon" aria-hidden="true"><LockIcon /></span>
              <div className="password-field">
                <input id="cu-password-confirm" type={showConfirmPassword ? 'text' : 'password'} name="hl-new-account-password-confirm" autoComplete="new-password" data-lpignore="true" data-1p-ignore value={confirmPassword} className={submitted && confirmPassword !== form.password ? 'field-invalid' : ''} onChange={(e) => setConfirmPassword(e.target.value)} placeholder=" " required />
                <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label htmlFor="cu-password-confirm">Confirmar senha <b className="req">*</b></label>
            </div>
            {submitted && confirmPassword !== form.password && <span className="field-error-text">As senhas não coincidem.</span>}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button clear-filters-button" onClick={() => { resetCreateForm(); setSubmitted(false); }}><ClearFilterIcon /> Limpar</button>
          <button className="primary" disabled={saving}>{saving ? 'Salvando…' : <><PlusIcon /> Criar usuário</>}</button>
        </div>
      </form>
    </> : <>
      <div className="section-heading">
        <div><p className="eyebrow">GOVERNANÇA DE ACESSO</p><h2>Gerenciamento de usuários</h2><small>Controle de identidades, perfis e acesso ao cliente.</small></div>
        <div className="section-heading-actions">
          <button type="button" className="secondary-button" onClick={() => setApprovalOpen(true)}><ClipboardIcon /> Aprovações {requests.length > 0 && <b className="nav-badge approval-count">{requests.length}</b>}</button>
          <button type="button" className="primary" onClick={() => { resetCreateForm(); setSubmitted(false); setCreating(true); }}><PlusIcon /> Criar usuário</button>
        </div>
      </div>
      <div className="users-list panel">
        <div className="panel-title"><div><p className="eyebrow">USUÁRIOS DO CLIENTE</p><h3>{filteredUsers.length} identidades</h3></div><button className="secondary-button compact action-refresh-button" onClick={() => void onRefresh()} disabled={loading} title="Recarregar lista de usuários"><RefreshIcon /> Atualizar</button></div>
        <div className="user-filters">
          <div className="search-input-wrap"><SearchIcon /><input className="search-input" placeholder="Pesquisar por nome…" value={nameFilter} onChange={(e) => { setNameFilter(e.target.value); setPage(1); }} /></div>
          <AppDropdown placeholder="Todos os status" value={statusFilter} onChange={(next) => { setStatusFilter(next); setPage(1); }} options={[{ value: '', label: 'Todos os status' }, { value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Bloqueado' }]} />
          {(nameFilter || statusFilter) && <button type="button" className="secondary-button compact clear-filters-button" onClick={clearUserFilters}><ClearFilterIcon /> Limpar</button>}
        </div>
        {loading ? <div className="empty-state compact-empty"><p>Consultando diretório…</p></div> : filteredUsers.length === 0 ? <div className="empty-state compact-empty"><p>Nenhum usuário encontrado.</p></div> : <>
          <div className="user-table user-table-scroll">
            <div className="user-table-head">
              <span>Nome</span>
              <span>E-mail</span>
              <span className="user-cell-role">Papel</span>
              <span className="user-cell-status">Status</span>
              <span className="user-cell-actions">Ações</span>
            </div>
            {pagedUsers.map((user) => <article className={`user-row ${user.active ? '' : 'blocked'}`} key={user.id}>
              <div className="user-cell-name">
                <span className={`user-avatar ${user.active ? 'active' : 'blocked'}`}>{initialsFromName(user.display_name)}</span>
                <strong className="user-name-text" title={user.display_name}>{user.display_name}</strong>
              </div>
              <div className="user-cell-email" title={user.email}>{user.email}</div>
              <div className="user-cell-role"><span className="role-badge">{roleLabel(user.roles)}</span></div>
              <div className="user-cell-status"><span className={`status ${user.active ? 'online' : 'blocked'}`}>{user.active ? 'Ativo' : 'Bloqueado'}</span></div>
              <div className="user-cell-actions">
                <RowActionsMenu active={user.active} onEdit={() => startEdit(user)} onBlock={() => setBlockTarget(user)} onUnblock={() => setUnblockTarget(user)} onDelete={() => setDeleteTarget(user)} />
              </div>
            </article>)}
          </div>
          {totalPages > 1 && <div className="pagination">
            <button type="button" className="secondary-button compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button type="button" className="secondary-button compact" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
          </div>}
        </>}
      </div>
    </>}
  </section>;
}

function ApprovalModal({ requests, token, onClose, onRefresh, onToast }: { requests: AccessRequest[]; token: string; onClose: () => void; onRefresh: () => Promise<void>; onToast: (toast: Omit<Toast, 'id'>) => void }) {
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<AccessRequest | null>(null);
  const [approving, setApproving] = useState(false);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);

  async function review(id: string, approve: boolean) {
    try {
      await api(approve ? `/v1/users/access-requests/${id}/approve` : `/v1/users/access-requests/${id}`, token, { method: approve ? 'POST' : 'DELETE', ...(approve ? { body: '{}' } : {}) });
      await onRefresh();
      onToast({ type: 'success', title: approve ? 'Solicitação aprovada' : 'Solicitação rejeitada', detail: approve ? 'O acesso foi liberado para o solicitante.' : 'A solicitação de cadastro foi recusada.' });
    } catch (reason) {
      onToast({ type: 'error', title: approve ? 'Falha ao aprovar' : 'Falha ao rejeitar', detail: reason instanceof Error ? reason.message : 'Não foi possível concluir a ação.' });
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    try { await review(rejectTarget.id, false); setRejectTarget(null); }
    finally { setRejecting(false); }
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    setApproving(true);
    try { await review(approveTarget.id, true); setApproveTarget(null); }
    finally { setApproving(false); }
  }

  return <div className="approval-modal" role="dialog" aria-modal="true" onMouseDown={onClose}><div className="approval-modal-card panel" onMouseDown={(event) => event.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">CONTROLE DE ACESSO</p><h3>Solicitações de cadastro</h3></div><button className="icon-button clear-filters-button" onClick={onClose} aria-label="Fechar"><CloseIcon /></button></div>{requests.length === 0 ? <div className="empty-state compact-empty"><p>Nenhuma solicitação pendente.</p></div> : <div className="request-list">{requests.map((item) => <article className="request-row" key={item.id}><div><strong>{item.display_name}</strong><small>{item.email} · {item.requested_role.replaceAll('_', ' ')}</small></div><div className="user-actions"><button className="primary compact" onClick={() => setApproveTarget(item)}><CheckIcon /> Aprovar</button><button className="delete-button compact" onClick={() => setRejectTarget(item)}><RejectIcon /> Rejeitar</button></div></article>)}</div>}</div>
  {approveTarget && <ConfirmDialog title="Aprovar solicitação" message={`Aprovar o cadastro de "${approveTarget.display_name}"? O acesso à plataforma será liberado imediatamente.`} confirmLabel="Aprovar" confirmIcon={<CheckIcon />} tone="positive" busy={approving} onConfirm={() => void confirmApprove()} onCancel={() => setApproveTarget(null)} />}
  {rejectTarget && <ConfirmDialog title="Rejeitar solicitação" message={`Rejeitar o cadastro de "${rejectTarget.display_name}"? O solicitante não terá acesso à plataforma.`} confirmLabel="Rejeitar" confirmIcon={<RejectIcon />} busy={rejecting} onConfirm={() => void confirmReject()} onCancel={() => setRejectTarget(null)} />}</div>;
}

// Escala ascendente (padrão Zabbix): 0/1 = baixa gravidade, 5 = mais grave.
const severityConfig = {
  0: { label: 'N/D',        cls: 'low',      color: '#8da3b7' },
  1: { label: 'INFO',       cls: 'low',      color: '#8da3b7' },
  2: { label: 'AVISO',      cls: 'medium',   color: 'var(--amber)' },
  3: { label: 'MÉDIA',      cls: 'medium',   color: 'var(--amber)' },
  4: { label: 'ALTA',       cls: 'high',     color: 'var(--red)' },
  5: { label: 'CRÍTICA',    cls: 'critical', color: 'var(--red)' },
} as const;

function AlertSeverityBadge({ severity }: { severity: number }) {
  const cfg = severityConfig[severity as keyof typeof severityConfig] ?? { label: `S${severity}`, cls: 'info', color: '#8da3b7' };
  return (
    <div className={`alert-severity-badge sev-${cfg.cls}`}>
      {severity >= 4 && <span className="sev-pulse" />}
      <span className="sev-label">{cfg.label}</span>
      <span className="sev-num">S{severity}</span>
    </div>
  );
}

function AlertRow({ alert, isHistory, onAction }: { alert: Alert; isHistory: boolean; onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void> }) {
  const [busy, setBusy] = useState<'acknowledge' | 'resolve' | null>(null);
  const [rowFeedback, setRowFeedback] = useState<'success' | 'error' | null>(null);
  const [rowError, setRowError] = useState('');
  const [pendingAction, setPendingAction] = useState<'acknowledge' | 'resolve' | null>(null);

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
    <article className={`alert-row severity-${alert.severity}${alert.status === 'resolved' ? ' resolved' : ''}${rowFeedback === 'success' ? ' row-success' : rowFeedback === 'error' ? ' row-error' : ''}`}>
      <AlertSeverityBadge severity={alert.severity} />
      <div className="alert-main">
        <strong>{alert.title}</strong>
        <small>{alert.unit_code ?? 'Unidade não associada'} · {alert.equipment_name ?? 'Equipamento não informado'}</small>
        {rowFeedback === 'error' && <span className="alert-inline-error"><WarningIcon /> {rowError}</span>}
      </div>
      <div className="alert-meta">
        <span className={`status ${statusTone}`}>{statusReadable}</span>
        <small>{new Date(alert.opened_at).toLocaleString('pt-BR')}</small>
        {alert.resolved_at && <small className="resolved-at">Resolvido: {new Date(alert.resolved_at).toLocaleString('pt-BR')}</small>}
      </div>
      {!isHistory && (
        <div className="alert-actions">
          {alert.status === 'open' && (
            <button className="alert-action-btn ack" onClick={() => setPendingAction('acknowledge')} disabled={busy !== null} title="Reconhecer alerta">
              {busy === 'acknowledge' ? <span className="btn-spinner" /> : <EyeCheckIcon />} Reconhecer
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button className="alert-action-btn resolve" onClick={() => setPendingAction('resolve')} disabled={busy !== null} title="Resolver incidente">
              {busy === 'resolve' ? <span className="btn-spinner" /> : <ResolveIcon />} Resolver
            </button>
          )}
        </div>
      )}
      {pendingAction === 'acknowledge' && <ConfirmDialog title="Reconhecer alerta" message={`Reconhecer "${alert.title}"? Isso sinaliza que a equipe já está ciente do problema.`} confirmLabel="Reconhecer" confirmIcon={<EyeCheckIcon />} tone="warning" busy={busy === 'acknowledge'} onConfirm={() => { setPendingAction(null); void handleAction('acknowledge'); }} onCancel={() => setPendingAction(null)} />}
      {pendingAction === 'resolve' && <ConfirmDialog title="Resolver incidente" message={`Marcar "${alert.title}" como resolvido? Ele sairá da lista de alertas ativos e irá para o histórico.`} confirmLabel="Resolver" confirmIcon={<ResolveIcon />} tone="positive" busy={busy === 'resolve'} onConfirm={() => { setPendingAction(null); void handleAction('resolve'); }} onCancel={() => setPendingAction(null)} />}
    </article>
  );
}

function AlertsCenter({ alerts, mode, loading, onModeChange, onAction, onRetry }: { alerts: Alert[]; mode: 'active' | 'history'; loading: boolean; onModeChange: (mode: 'active' | 'history') => void; onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void>; onRetry: () => void }) {
  const isHistory = mode === 'history';
  const criticalCount = !isHistory ? alerts.filter((a) => a.severity >= 4 && a.status !== 'resolved').length : 0;
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [mode]);
  const totalPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAlerts = alerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return (
    <section className="alerts-center" key={mode}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">GOVERNANÇA OPERACIONAL · RESPOSTA</p>
          <h2>Central de alertas</h2>
          <small>Triagem e tratativa dos incidentes monitorados em tempo real.</small>
        </div>
        <div className="alert-tabs" role="tablist" aria-label="Filtro de alertas">
          <button className={`alert-tab ${!isHistory ? 'active' : ''}`} onClick={() => onModeChange('active')} role="tab" aria-selected={!isHistory}>
            Ativos <span>{!isHistory ? alerts.length : '—'}</span>
          </button>
          <button className={`alert-tab ${isHistory ? 'active' : ''}`} onClick={() => onModeChange('history')} role="tab" aria-selected={isHistory}>
            Histórico resolvido <span>{isHistory ? alerts.length : '—'}</span>
          </button>
        </div>
      </div>
      {criticalCount > 0 && (
        <div className="alerts-critical-banner" role="alert">
          <span className="critical-pulse-dot" />
          <strong>{criticalCount} incidente(s) crítico(s)</strong> requerem ação imediata
        </div>
      )}
      <div className="alerts-panel panel">
      <div className="section-heading">
        <div><p className="eyebrow">EVENTOS E INCIDENTES</p><h2>{isHistory ? 'Histórico resolvido' : 'Alertas ativos'}</h2></div>
        <div className="alerts-heading-actions">
          {loading && <span className="alerts-loading-indicator"><span className="btn-spinner" /> Carregando…</span>}
          <button className="secondary-button action-refresh-button" onClick={onRetry} disabled={loading} title="Recarregar lista de alertas"><RefreshIcon /> Atualizar</button>
        </div>
      </div>
      {loading && alerts.length === 0 ? (
        <div className="alerts-loading-skeleton">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-glyph">{isHistory ? <ClipboardIcon /> : <CheckIcon />}</span>
          <h3>{isHistory ? 'Nenhum alerta resolvido' : 'Nenhum alerta requer ação'}</h3>
          <p>{isHistory ? 'Os incidentes resolvidos aparecerão aqui para auditoria operacional.' : 'O núcleo de monitoramento não identificou problemas ativos nas unidades.'}</p>
          {!isHistory && <button className="secondary-button empty-state-action" onClick={onRetry}>Verificar novamente</button>}
        </div>
      ) : (
        <>
          <div className="alert-list alert-list-scroll">
            {pagedAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} isHistory={isHistory} onAction={onAction} />)}
          </div>
          {totalPages > 1 && <div className="pagination">
            <button type="button" className="secondary-button compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button type="button" className="secondary-button compact" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
          </div>}
        </>
      )}
      </div>
    </section>
  );
}

function IncidentReports({ alerts, units, onRefresh }: { alerts: Alert[]; units: Unit[]; onRefresh: () => void }) {
  const [filters, setFilters] = useState<IncidentReportFilters>({ status: 'all', severity: 'all', unitId: '', from: '', to: '' });
  const filteredAlerts = useMemo(() => filterIncidentReports(alerts, filters), [alerts, filters]);
  const summary = useMemo(() => summarizeIncidentReports(filteredAlerts), [filteredAlerts]);
  const updateFilter = <K extends keyof IncidentReportFilters>(key: K, value: IncidentReportFilters[K]) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const hasFilters = filters.status !== 'all' || filters.severity !== 'all' || Boolean(filters.unitId || filters.from || filters.to);
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const resolutionTime = (alert: Alert) => alert.resolved_at ? `${Math.max(0, Math.round((new Date(alert.resolved_at).getTime() - new Date(alert.opened_at).getTime()) / 60000))} min` : 'Em aberto';
  const clearFilters = () => { setFilters({ status: 'all', severity: 'all', unitId: '', from: '', to: '' }); setPage(1); };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAlerts = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <section className="incident-reports">
    <div className="reports-header">
      <div><p className="eyebrow">GOVERNANÇA OPERACIONAL · AUDITORIA</p><h2>Relatório de incidentes</h2><small>Consolidação dos eventos monitorados, do primeiro alerta ao encerramento.</small></div>
      <div className="reports-actions"><button type="button" className="secondary-button" onClick={onRefresh}><RefreshIcon /> Atualizar</button><button type="button" className="primary" onClick={() => window.print()}><NavReportIcon /> Imprimir relatório</button></div>
    </div>
    <div className="report-summary-grid">
      <ReportMetric label="Incidentes no total" value={summary.total} tone="neutral" />
      <ReportMetric label="Incidentes em aberto" value={summary.open} tone="danger" />
      <ReportMetric label="Incidentes reconhecidos" value={summary.acknowledged} tone="warn" />
      <ReportMetric label="Incidentes resolvidos" value={summary.resolved} tone="ok" />
      <ReportMetric label="Incidentes críticos" value={summary.critical} tone="danger" />
      <ReportMetric label="Tempo médio de resolução" value={summary.averageResolutionMinutes ? `${summary.averageResolutionMinutes} min` : '—'} tone="cyan" />
    </div>
    <div className="report-table-panel">
      <div className="panel-title">
        <div><p className="eyebrow">REGISTRO CONSOLIDADO</p><h3>Incidentes monitorados</h3></div>
        <div className="report-title-actions">
          {hasFilters && !filtersOpen && <span className="report-filters-flag">filtros ativos</span>}
          <button type="button" className="secondary-button report-filters-toggle" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}><ClearFilterIcon /> {filtersOpen ? 'Recolher filtros' : 'Filtros'} <ChevronIcon up={filtersOpen} /></button>
        </div>
      </div>
      {filtersOpen && <div className="report-filters">
        <label>Período inicial<DateField value={filters.from} onChange={(value) => updateFilter('from', value)} /></label>
        <label>Período final<DateField value={filters.to} onChange={(value) => updateFilter('to', value)} /></label>
        <label>Situação<AppDropdown value={filters.status} onChange={(value) => updateFilter('status', value as IncidentReportFilters['status'])} options={[{ value: 'all', label: 'Todas' }, { value: 'open', label: 'Abertos' }, { value: 'acknowledged', label: 'Reconhecidos' }, { value: 'resolved', label: 'Resolvidos' }]} /></label>
        <label>Severidade<AppDropdown value={filters.severity} onChange={(value) => updateFilter('severity', value as IncidentReportFilters['severity'])} options={[{ value: 'all', label: 'Todas' }, { value: 'critical', label: 'Crítica (S5)' }, { value: 'high', label: 'Alta (S4)' }, { value: 'medium', label: 'Média (S2–S3)' }, { value: 'low', label: 'Baixa (S0–S1)' }]} /></label>
        <label>Unidade<AppDropdown value={filters.unitId} onChange={(value) => updateFilter('unitId', value)} options={[{ value: '', label: 'Todas as unidades' }, ...units.map((unit) => ({ value: unit.unit_id, label: `${unit.code} · ${unit.name}` }))]} /></label>
        {hasFilters && <button type="button" className="secondary-button compact clear-filters-button" onClick={clearFilters}><ClearFilterIcon /> Limpar filtros</button>}
      </div>}
      {filteredAlerts.length === 0 ? <div className="empty-state compact-empty"><span className="empty-glyph"><CheckIcon /></span><strong>Nenhum incidente no recorte</strong><small>Ajuste os filtros ou atualize os dados para consultar novamente.</small></div> : <div className="report-table-wrap"><div className="incident-report-table incident-report-scroll"><div className="incident-report-head"><span>Incidente</span><span>Severidade</span><span>Unidade / ativo</span><span>Abertura</span><span>Encerramento</span><span>Tempo</span><span>Status</span></div><div className="incident-report-list">{(printing ? filteredAlerts : pagedAlerts).map((alert) => { const statusTone = alert.status === 'resolved' ? 'online' : alert.status === 'acknowledged' ? 'degraded' : 'offline'; const statusText = alert.status === 'resolved' ? 'Resolvido' : alert.status === 'acknowledged' ? 'Reconhecido' : 'Aberto'; return <div key={alert.id} className={`incident-row ${statusTone}`}><div><strong>{alert.title}</strong><small>{alert.id.slice(0, 8)} · registro auditável</small></div><div><AlertSeverityBadge severity={alert.severity} /></div><div><strong>{alert.unit_code ?? 'Unidade não associada'}</strong><small>{alert.equipment_name ?? 'Ativo não informado'}</small></div><div>{formatDate(alert.opened_at)}</div><div>{formatDate(alert.resolved_at)}</div><div>{resolutionTime(alert)}</div><div><span className={`status ${statusTone}`}>{statusText}</span></div></div>; })}</div></div></div>}
      {totalPages > 1 && <div className="pagination">
        <button type="button" className="secondary-button compact" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <span>Página {currentPage} de {totalPages}</span>
        <button type="button" className="secondary-button compact" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
      </div>}
    </div>
  </section>;
}

function ReportMetric({ label, value, tone }: { label: string; value: number | string; tone: 'neutral' | 'danger' | 'warn' | 'ok' | 'cyan' }) {
  return <article className={`report-metric ${tone}`}><strong>{value}</strong><span>{label}</span></article>;
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  const iconMap: Record<Toast['type'], ReactNode> = {
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    success: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path className="toast-check-mark" d="M5 12.5l4.5 4.5L19 7" /></svg>,
    info: <InfoIcon />,
  };
  return (
    <div className="noc-toast-stack" role="log" aria-live="assertive" aria-label="Notificações do sistema">
      {toasts.map((t) => (
        <div key={t.id} className={`noc-toast noc-toast-${t.type}`} role="alert">
          <span className="toast-icon">{iconMap[t.type]}</span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.detail && <p>{t.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditProfilePage({ session, onSaved, onClose }: { session: LoginResponse; onSaved: (name: string) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  const nameMissing = submitted && !displayName.trim();
  const passwordInvalid = submitted && password.length > 0 && password.length < 8;
  const confirmMismatch = submitted && password.length > 0 && confirmPassword !== password;
  const isDirty = displayName.trim() !== session.user.displayName || password.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault(); setSubmitted(true); setError('');
    if (!displayName.trim() || (password.length > 0 && password.length < 8) || (password.length > 0 && confirmPassword !== password)) return;
    if (!isDirty) { onClose(); return; }
    setSaving(true);
    try {
      await api(`/v1/users/${session.user.id}`, session.accessToken, { method: 'PATCH', body: JSON.stringify({ displayName: displayName.trim(), password: password || undefined }) });
      onSaved(displayName.trim());
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao salvar o perfil.'); } finally { setSaving(false); }
  }

  return <section className="users-page">
    <div className="section-heading">
      <div><p className="eyebrow">PERFIL CORPORATIVO</p><h2>Editar perfil</h2><small>Atualize seu nome de exibição e a senha de acesso.</small></div>
    </div>
    <button className="back-button" onClick={onClose}>← Voltar</button>
    <form className="user-form panel users-create-form" onSubmit={submit} noValidate>
      <div className="panel-title">
        <div>
          <p className="eyebrow">DADOS DO PERFIL</p>
          <h3>Dados do perfil</h3>
          <small className="muted" style={{ margin: 0 }}>Os campos marcados com <b className="req">*</b> são obrigatórios.</small>
        </div>
      </div>
      <div className="user-form-grid">
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><UserIcon /></span>
            <input id="ep-name" value={displayName} className={nameMissing ? 'field-invalid' : ''} onChange={(e) => setDisplayName(e.target.value)} placeholder=" " required />
            <label htmlFor="ep-name">Nome completo <b className="req">*</b></label>
          </div>
          {nameMissing && <span className="field-error-text">Informe o nome completo.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><MailIcon /></span>
            <input id="ep-email" type="text" value={session.user.email} disabled placeholder=" " />
            <label htmlFor="ep-email">E-mail corporativo</label>
          </div>
          <span className="field-hint">O e-mail não pode ser alterado por aqui.</span>
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><BadgeIcon /></span>
            <input id="ep-tenant" type="text" value={session.tenant.name} disabled placeholder=" " />
            <label htmlFor="ep-tenant">Organização / Tenant</label>
          </div>
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><LockIcon /></span>
            <div className="password-field">
              <input id="ep-password" type={showPassword ? 'text' : 'password'} name="hl-new-account-password" autoComplete="new-password" data-lpignore="true" data-1p-ignore minLength={8} value={password} className={passwordInvalid ? 'field-invalid' : ''} onChange={(e) => setPassword(e.target.value)} placeholder=" " />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
            </div>
            <label htmlFor="ep-password">Nova senha (opcional)</label>
          </div>
          {passwordInvalid && <span className="field-error-text">Pelo menos 8 caracteres.</span>}
        </div>
        <div className="mfield">
          <div className="input-group has-icon">
            <span className="input-icon" aria-hidden="true"><LockIcon /></span>
            <div className="password-field">
              <input id="ep-password-confirm" type={showConfirmPassword ? 'text' : 'password'} name="hl-new-account-password-confirm" autoComplete="new-password" data-lpignore="true" data-1p-ignore value={confirmPassword} className={confirmMismatch ? 'field-invalid' : ''} onChange={(e) => setConfirmPassword(e.target.value)} placeholder=" " />
              <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
            </div>
            <label htmlFor="ep-password-confirm">Confirmar nova senha</label>
          </div>
          {confirmMismatch && <span className="field-error-text">As senhas não coincidem.</span>}
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="secondary-button clear-filters-button" onClick={onClose}><CloseIcon /> Cancelar</button>
        <button className="primary" disabled={saving || !isDirty}>{saving ? 'Salvando…' : <><CheckIcon /> Salvar alterações</>}</button>
      </div>
    </form>
  </section>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>atualização em tempo real</small></article>;
}

function LoginWithRequest({ onSuccess, showLogoutToast = false }: { onSuccess: (session: LoginResponse) => void; showLogoutToast?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  function addToast(toast: Omit<Toast, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (!toast.sticky) window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.durationMs ?? (toast.type === 'error' ? 8000 : 5000));
  }
  const logoutToastShown = useRef(false);
  useEffect(() => {
    if (showLogoutToast && !logoutToastShown.current) {
      logoutToastShown.current = true;
      addToast({ type: 'success', title: 'Sessão encerrada', detail: 'Você saiu do HealthLink Sentinel com segurança.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emailMissing = submitted && !email.trim();
  const emailInvalid = submitted && !emailMissing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordMissing = submitted && (!password.trim() || password.length < 8 || password.length > 200);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true); setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password.trim() || password.length < 8 || password.length > 200) return;
    try {
      const response = await fetch(`${apiBase}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error(await loginErrorMessage(response));
      onSuccess(await response.json() as LoginResponse);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'E-mail ou senha incorretos. Confira os dados e tente novamente.'); }
  }
  return <div className="login-page"><section className="login-context"><div className="brand large"><img className="brand-mark" src={brandIcon} alt="HealthLink Sentinel" width={46} height={46} /><div><strong>HealthLink</strong><small>SENTINEL</small></div></div><div className="context-copy"><p className="eyebrow">PLATAFORMA DE MISSÃO CRÍTICA</p><AnimatedHeroTitle /><p>Monitoramento contínuo de conectividade, infraestrutura e disponibilidade operacional.</p></div></section><section className="login-panel"><form onSubmit={submit} noValidate><p className="eyebrow">ACESSO RESTRITO</p><h2>Entrar no centro de comando</h2><p className="muted">Utilize sua identidade corporativa.</p><div className="login-field"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><UserIcon /></span><input id="login-email" type="email" maxLength={254} value={email} className={emailMissing || emailInvalid ? 'field-invalid' : ''} onChange={(event) => setEmail(event.target.value)} placeholder=" " autoFocus /><label htmlFor="login-email">E-mail corporativo</label></div>{emailMissing && <span className="field-error-text">Informe o e-mail.</span>}{emailInvalid && <span className="field-error-text">Informe um e-mail válido, como nome@dominio.com.</span>}</div><div className="login-field"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><LockIcon /></span><div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} maxLength={200} value={password} className={passwordMissing ? 'field-invalid' : ''} onChange={(event) => setPassword(event.target.value)} placeholder=" " /><button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button></div><label htmlFor="login-password">Senha</label></div>{passwordMissing && <span className="field-error-text">Pelo menos 8 caracteres.</span>}</div>{error && <div className="error-banner" role="alert"><span className="error-banner-icon"><WarningIcon /></span><span className="error-banner-text">{error}</span></div>}<button className="primary"><LoginIcon /> Acessar plataforma</button><button type="button" className="request-access-link" onClick={() => setRequestOpen(true)}><UserIcon /> Criar conta <span>(sujeito a aprovação)</span></button></form></section>{requestOpen && <RequestAccessModal onClose={() => setRequestOpen(false)} onToast={addToast} />}<ToastStack toasts={toasts} /></div>;
}

function AnimatedHeroTitle() {
  const lines = ['Visibilidade para', 'proteger cada', 'unidade em campo.'];
  let wordIndex = 0;
  return <h1 className="hero-title" aria-label={lines.join(' ')}>{lines.map((line) => <span className="hero-line" key={line}>{line.split(' ').map((word) => { const delay = `${0.12 + wordIndex++ * 0.09}s`; return <span className="hero-word" style={{ '--word-delay': delay } as CSSProperties} aria-hidden="true" key={`${line}-${word}`}>{word}&nbsp;</span>; })}</span>)}</h1>;
}

function RequestAccessModal({ onClose, onToast }: { onClose: () => void; onToast: (toast: Omit<Toast, 'id'>) => void }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: 'viewer' }); const [saving, setSaving] = useState(false); const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (form.password.length > 200) setForm((previous) => ({ ...previous, password: previous.password.slice(0, 200) })); }, [form.password]);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  const nameMissing = submitted && !form.displayName.trim();
  const emailMissing = submitted && !form.email.trim();
  const emailInvalid = submitted && !emailMissing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const passwordMissing = submitted && (form.password.trim().length < 8 || form.password.length > 200);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (!form.displayName.trim() || !form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.password.trim().length < 8 || form.password.length > 200) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}/v1/access-requests`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      if (!response.ok) {
        let detail = '';
        try { const payload = await response.json() as { message?: string; error?: string }; detail = payload.message || payload.error || ''; } catch { /* resposta sem JSON */ }
        throw new Error(detail || 'Não foi possível enviar a solicitação.');
      }
      onToast({ type: 'success', title: 'Solicitação enviada', detail: 'Aguarde a aprovação do administrador.' });
      onClose();
    } catch (reason) { onToast({ type: 'error', title: 'Falha ao solicitar acesso', detail: friendlyMessage(reason, 'Não foi possível enviar a solicitação. Tente novamente.') }); } finally { setSaving(false); }
  }
  return <div className="approval-modal" role="dialog" aria-modal="true" onMouseDown={onClose}><form className="request-access-modal panel" onSubmit={submit} noValidate onMouseDown={(event) => event.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">SOLICITAÇÃO DE ACESSO</p><h3>Criar conta</h3></div><button type="button" className="icon-button clear-filters-button" onClick={onClose} aria-label="Fechar"><CloseIcon /></button></div><p className="muted">Seu cadastro será analisado por um administrador.</p><div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><UserIcon /></span><input id="ra-name" className={nameMissing ? 'field-invalid' : ''} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder=" " /><label htmlFor="ra-name">Nome completo <b className="req">*</b></label></div>{nameMissing && <span className="field-error-text">Informe o nome completo.</span>}</div><div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><MailIcon /></span><input id="ra-email" type="text" inputMode="email" name="hl-account-email-field" autoComplete="off" data-lpignore="true" data-1p-ignore className={emailMissing || emailInvalid ? 'field-invalid' : ''} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder=" " /><label htmlFor="ra-email">E-mail corporativo <b className="req">*</b></label></div>{emailMissing && <span className="field-error-text">Informe o e-mail.</span>}{emailInvalid && <span className="field-error-text">Informe um e-mail válido, como nome@dominio.com.</span>}</div><div className="mfield"><div className="input-group has-icon is-dropdown"><span className="input-icon" aria-hidden="true"><BadgeIcon /></span><AppDropdown value={form.role} onChange={(next) => setForm({ ...form, role: next })} options={[{ value: 'viewer', label: 'Visualizador' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'noc_operator', label: 'Operador NOC' }]} /><span className="input-group-label">Perfil solicitado <b className="req">*</b></span></div></div><div className="mfield"><div className="input-group has-icon"><span className="input-icon" aria-hidden="true"><LockIcon /></span><input id="ra-password" type="password" name="hl-new-account-password" autoComplete="new-password" data-lpignore="true" data-1p-ignore minLength={8} className={passwordMissing ? 'field-invalid' : ''} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder=" " /><label htmlFor="ra-password">Senha <b className="req">*</b></label></div>{passwordMissing && <span className="field-error-text">A senha deve ter ao menos 8 caracteres.</span>}</div><div className="form-actions request-access-actions"><button type="button" className="secondary-button clear-filters-button" onClick={onClose}><CloseIcon /> Cancelar</button><button className="primary" disabled={saving}><LockIcon /> {saving ? 'Enviando…' : 'Solicitar Acesso'}</button></div></form></div>;
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
      if (!response.ok) throw new Error(await loginErrorMessage(response));
      onSuccess(await response.json() as LoginResponse);
    } catch (reason) { setError(reason instanceof Error ? friendlyApiMessage(reason.message, 'Falha de autenticação. Tente novamente.') : 'Falha de autenticação. Tente novamente.'); }
    finally { setLoading(false); }
  }
  return <div className="login-page">
    <section className="login-context"><div className="brand large"><img className="brand-mark" src={brandIcon} alt="HealthLink Sentinel" width={46} height={46} /><div><strong>HealthLink</strong><small>SENTINEL</small></div></div><div className="context-copy"><p className="eyebrow">PLATAFORMA DE MISSÃO CRÍTICA</p><h1>Visibilidade para proteger cada unidade em campo.</h1><p>Monitoramento contínuo de conectividade, infraestrutura e disponibilidade operacional das unidades móveis de saúde.</p></div><div className="context-status"><span className="pulse" /> Núcleo de monitoramento disponível</div></section>
    <section className="login-panel"><form onSubmit={submit}><p className="eyebrow">ACESSO RESTRITO</p><h2>Entrar no centro de comando</h2><p className="muted">Utilize sua identidade corporativa.</p><label>E-mail corporativo<input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label><label>Senha<input type="password" maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="error-banner" role="alert"><span className="error-banner-icon"><WarningIcon /></span><span className="error-banner-text">{error}</span></div>}<button className="primary" disabled={loading}>{loading ? 'Validando acesso…' : 'Acessar plataforma'}</button><small className="security-note">Sessão protegida · Acesso auditado</small></form></section>
  </div>;
}
