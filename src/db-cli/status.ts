import { counts } from '../db/runs.ts';
import { listQueries } from '../db/queries.ts';

export async function cmdStatus(flags: Record<string, string | boolean>): Promise<void> {
  const c = counts();
  const activeQueries = listQueries().length;
  const payload = { ...c, active_queries: activeQueries };
  if (flags.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(`runs:            ${c.runs}`);
  console.log(`today:           ${c.today}`);
  console.log(`distinct queries (historical): ${c.queries}`);
  console.log(`distinct brands:  ${c.brands}`);
  console.log(`active queries: ${activeQueries}`);
}
