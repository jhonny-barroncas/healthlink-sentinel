BEGIN;

-- Telemetria detalhada: 30 dias.
DELETE FROM metric_samples
WHERE observed_at < now() - interval '30 days';

-- Histórico operacional: 90 dias. O estado atual permanece em snapshots/alerts.
DELETE FROM monitoring_events
WHERE observed_at < now() - interval '90 days';

DELETE FROM alert_events
WHERE created_at < now() - interval '90 days';

-- Dados técnicos temporários do agente: 30 dias.
DELETE FROM collection_agent_batches
WHERE received_at < now() - interval '30 days';

-- Enrollments consumidos, revogados ou expirados: 7 dias após o evento.
DELETE FROM collection_agent_enrollments
WHERE created_at < now() - interval '7 days'
  AND (consumed_at IS NOT NULL OR revoked_at IS NOT NULL OR expires_at < now());

-- Sessões expiradas/revogadas: limpeza diária.
DELETE FROM user_sessions
WHERE expires_at < now()
   OR revoked_at < now() - interval '7 days';

COMMIT;
