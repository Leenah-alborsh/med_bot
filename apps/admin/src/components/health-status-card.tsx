import { getApiHealth } from '../lib/api-health';

export async function HealthStatusCard() {
  const health = await getApiHealth();
  const isHealthy = health?.status === 'ok';

  return (
    <article className="card">
      <h2>API health</h2>
      <p>
        <span className="status" data-state={isHealthy ? 'ok' : 'error'}>
          {isHealthy ? 'Healthy' : 'Unavailable'}
        </span>
      </p>
      <p className="muted">
        {health
          ? `Database: ${health.database.status}. Checked at ${health.app.timestamp}.`
          : 'The backend health endpoint could not be reached.'}
      </p>
    </article>
  );
}
