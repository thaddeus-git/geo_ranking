import {
  listCandidates,
  getCandidate,
  sourcesForCandidate,
  acceptCandidate,
  rejectCandidate,
} from '../db/candidates.ts';

type ParseFn = (argv: string[]) => { flags: Record<string, string | boolean>; positionals: string[] };

export async function cmdCandidates(argv: string[], parse: ParseFn): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub) {
    console.error('candidates: subcommand required (list | pending | show | accept | reject)');
    process.exit(2);
  }
  switch (sub) {
    case 'pending': return cmdList({ status: 'pending' });
    case 'list': {
      const { flags } = parse(rest);
      return cmdList(flags);
    }
    case 'show': {
      const { positionals } = parse(rest);
      return cmdShow(positionals[0]);
    }
    case 'accept': return cmdAccept(rest);
    case 'reject': return cmdReject(rest, parse);
    default:
      console.error(`candidates: unknown subcommand "${sub}"`);
      process.exit(2);
  }
}

function cmdList(flags: Record<string, string | boolean>): void {
  const status = typeof flags.status === 'string' ? flags.status : undefined;
  const pack = typeof flags.pack === 'string' ? flags.pack : undefined;
  const rows = listCandidates({ status, pack });
  if (flags.json) {
    console.log(JSON.stringify(rows));
    return;
  }
  if (rows.length === 0) { console.log('(none)'); return; }
  for (const r of rows) {
    const dec = r.decision ?? 'pending';
    console.log(`${r.name}\t${dec}\t${r.sighting_count}x\t${r.last_seen}`);
  }
}

function cmdShow(name: string | undefined): void {
  if (!name) { console.error('candidates show: <name> required'); process.exit(2); }
  const cand = getCandidate(name);
  if (!cand) { console.error(`no candidate: ${name}`); process.exit(1); }
  console.log(`name:          ${cand.name}`);
  console.log(`first_seen:    ${cand.first_seen}`);
  console.log(`last_seen:     ${cand.last_seen}`);
  console.log(`sightings:     ${cand.sighting_count}`);
  console.log(`reviewed:      ${cand.reviewed ? 'yes' : 'no'}`);
  if (cand.decision) console.log(`decision:      ${cand.decision}`);
  if (cand.accepted_at) console.log(`accepted_at:   ${cand.accepted_at}`);
  if (cand.notes) console.log(`notes:         ${cand.notes}`);
  const sources = sourcesForCandidate(name);
  if (sources.length) {
    console.log('sources:');
    for (const s of sources) {
      console.log(`  ${s.date}  rank=${s.rank}  [${s.pack}] ${s.keyword}`);
    }
  }
}

function parseModelAliases(argv: string[]): Array<{ name: string; aliases: string[] }> {
  const result: Array<{ name: string; aliases: string[] }> = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') {
      if (!argv[i + 1] || argv[i + 1]!.startsWith('--')) {
        console.error('warning: --model requires a name argument; skipping');
        continue;
      }
      const modelName = argv[i + 1]!;
      i++;
      let aliases: string[] = [];
      if (argv[i + 1] === '--aliases' && argv[i + 2] && !argv[i + 2]!.startsWith('--')) {
        aliases = argv[i + 2]!.split(',').map((a) => a.trim()).filter(Boolean);
        i += 2;
      }
      result.push({ name: modelName, aliases });
    }
  }
  return result;
}

function cmdAccept(argv: string[]): void {
  const name = argv[0];
  if (!name || name.startsWith('--')) {
    console.error('candidates accept: <name> required');
    process.exit(2);
  }
  const models = parseModelAliases(argv.slice(1));
  const cand = getCandidate(name);
  if (!cand) { console.error(`no candidate: ${name}`); process.exit(1); }
  if (cand.reviewed) { console.error(`already reviewed: ${name} (${cand.decision})`); process.exit(1); }
  acceptCandidate(name, models);
  console.log(`accepted: ${name}`);
  if (models.length) console.log(`  models: ${models.map((m) => m.name).join(', ')}`);
}

function cmdReject(argv: string[], parse: ParseFn): void {
  const { positionals, flags } = parse(argv);
  const name = positionals[0];
  if (!name) { console.error('candidates reject: <name> required'); process.exit(2); }
  const reason = typeof flags.reason === 'string' ? flags.reason : '';
  if (!reason) { console.error('candidates reject: --reason "..." required'); process.exit(2); }
  const cand = getCandidate(name);
  if (!cand) { console.error(`no candidate: ${name}`); process.exit(1); }
  if (cand.reviewed) { console.error(`already reviewed: ${name} (${cand.decision})`); process.exit(1); }
  rejectCandidate(name, reason);
  console.log(`rejected: ${name}`);
}
