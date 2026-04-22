import { appendRun, type RunRecord } from '../db/runs.ts';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function cmdAppend(): Promise<void> {
  const raw = (await readStdin()).trim();
  if (!raw) {
    console.error('append: stdin is empty — pipe a JSON record');
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`append: invalid JSON on stdin — ${(e as Error).message}`);
    process.exit(2);
  }
  const rec = parsed as Partial<RunRecord>;
  const required: (keyof RunRecord)[] = ['date', 'query', 'pack', 'response_text', 'timestamp'];
  for (const k of required) {
    if (!rec[k]) {
      console.error(`append: missing required field: ${k}`);
      process.exit(2);
    }
  }
  const run: RunRecord = {
    date: rec.date!,
    query: rec.query!,
    pack: rec.pack!,
    platform: rec.platform ?? 'doubao',
    response_text: rec.response_text!,
    timestamp: rec.timestamp!,
    brands: Array.isArray(rec.brands) ? rec.brands : [],
    new_brands: Array.isArray(rec.new_brands) ? rec.new_brands : [],
  };
  try {
    const id = appendRun(run);
    console.log(JSON.stringify({ ok: true, id, total_brands: run.brands.length }));
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) {
      console.error(`append: already exists for (date=${run.date}, query=${run.query}, platform=${run.platform})`);
      process.exit(3);
    }
    throw e;
  }
}
