import { listKeywords, addKeyword, setActive } from '../db/keywords.ts';

type ParseFn = (argv: string[]) => { flags: Record<string, string | boolean>; positionals: string[] };

export async function cmdKeywords(argv: string[], parse: ParseFn): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub) {
    console.error('keywords: subcommand required (list | add | activate | deactivate)');
    process.exit(2);
  }
  switch (sub) {
    case 'list': return cmdList(parse(rest).flags);
    case 'add': return cmdAdd(parse(rest).flags);
    case 'activate':
    case 'deactivate': {
      const { positionals } = parse(rest);
      return cmdSetActive(positionals[0], sub === 'activate');
    }
    default:
      console.error(`keywords: unknown subcommand "${sub}"`);
      process.exit(2);
  }
}

function cmdList(flags: Record<string, string | boolean>): void {
  const rows = listKeywords({
    includeInactive: flags['include-inactive'] === true,
    pack: typeof flags.pack === 'string' ? flags.pack : undefined,
  });
  if (flags.json) {
    console.log(JSON.stringify(rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      pack: r.pack,
      active: r.active,
    }))));
    return;
  }
  for (const r of rows) {
    const flag = r.active ? '  ' : ' *';
    console.log(`${r.id}\t${flag}\t${r.pack}\t${r.keyword}`);
  }
}

function cmdAdd(flags: Record<string, string | boolean>): void {
  const keyword = flags.keyword;
  const pack = flags.pack;
  if (typeof keyword !== 'string' || !keyword) {
    console.error('keywords add: --keyword "<text>" required');
    process.exit(2);
  }
  if (typeof pack !== 'string' || !pack) {
    console.error('keywords add: --pack <name> required');
    process.exit(2);
  }
  const { inserted, id } = addKeyword(keyword, pack);
  if (inserted) console.log(`added id=${id}`);
  else console.log(`exists id=${id} (no change)`);
}

function cmdSetActive(idStr: string | undefined, active: boolean): void {
  if (!idStr) {
    console.error('keywords activate/deactivate: <id> required');
    process.exit(2);
  }
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    console.error(`invalid id: ${idStr}`);
    process.exit(2);
  }
  const ok = setActive(id, active);
  if (!ok) {
    console.error(`no keyword with id=${id}`);
    process.exit(1);
  }
  console.log(`id=${id} ${active ? 'active' : 'inactive'}`);
}
