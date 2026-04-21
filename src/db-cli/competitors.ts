import {
  listCompetitors,
  listCompetitorsCatalog,
  getCompetitor,
  insertCompetitor,
  insertCompetitorModel,
  setCompetitorAliases,
} from '../db/competitors.ts';

type ParseFn = (argv: string[]) => { flags: Record<string, string | boolean>; positionals: string[] };

export async function cmdCompetitors(argv: string[], parse: ParseFn): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub) {
    console.error('competitors: subcommand required (list | show | add | add-model | set-aliases)');
    process.exit(2);
  }
  switch (sub) {
    case 'list': return cmdList(parse(rest).flags);
    case 'show': {
      const { positionals } = parse(rest);
      return cmdShow(positionals[0]);
    }
    case 'add': {
      const { positionals, flags } = parse(rest);
      return cmdAdd(positionals[0], flags);
    }
    case 'add-model': {
      const { positionals, flags } = parse(rest);
      return cmdAddModel(positionals[0], flags);
    }
    case 'set-aliases': {
      const { positionals, flags } = parse(rest);
      return cmdSetAliases(positionals[0], flags);
    }
    default:
      console.error(`competitors: unknown subcommand "${sub}"`);
      process.exit(2);
  }
}

function cmdList(flags: Record<string, string | boolean>): void {
  if (flags.json) {
    console.log(JSON.stringify(listCompetitorsCatalog()));
    return;
  }
  const rows = listCompetitors();
  if (rows.length === 0) {
    console.log('(no competitors — run: bash scripts/init.sh)');
    return;
  }
  for (const r of rows) {
    const aliases = JSON.parse(r.aliases) as string[];
    const aliasStr = aliases.length ? `  [${aliases.join(', ')}]` : '';
    console.log(`${r.name}${aliasStr}\t${r.source}\t${r.added_at}`);
  }
}

function cmdShow(name: string | undefined): void {
  if (!name) {
    console.error('competitors show: <name> required');
    process.exit(2);
  }
  const { competitor, models } = getCompetitor(name);
  if (!competitor) {
    console.error(`no competitor: ${name}`);
    process.exit(1);
  }
  const brandAliases = JSON.parse(competitor.aliases) as string[];
  console.log(`name:     ${competitor.name}`);
  console.log(`aliases:  ${brandAliases.length ? brandAliases.join(', ') : '(none)'}`);
  console.log(`source:   ${competitor.source}`);
  console.log(`added_at: ${competitor.added_at}`);
  console.log('models:');
  for (const m of models) {
    const aliases = JSON.parse(m.aliases) as string[];
    const aliasStr = aliases.length ? ` (aliases: ${aliases.join(', ')})` : '';
    console.log(`  ${m.name}${aliasStr}`);
  }
}

function cmdAdd(name: string | undefined, flags: Record<string, string | boolean>): void {
  if (!name) {
    console.error('competitors add: <name> required');
    process.exit(2);
  }
  const aliasesStr = typeof flags.aliases === 'string' ? flags.aliases : '';
  const aliases = aliasesStr ? aliasesStr.split(',').map((a) => a.trim()).filter(Boolean) : [];
  const inserted = insertCompetitor(name, 'manual', aliases);
  if (inserted) console.log(`added: ${name}${aliases.length ? ` (aliases: ${aliases.join(', ')})` : ''}`);
  else console.log(`exists: ${name} (no change — use set-aliases to update aliases)`);
}

function cmdAddModel(name: string | undefined, flags: Record<string, string | boolean>): void {
  if (!name) {
    console.error('competitors add-model: <competitor-name> required');
    process.exit(2);
  }
  const model = flags.model;
  if (typeof model !== 'string' || !model) {
    console.error('competitors add-model: --model <name> required');
    process.exit(2);
  }
  const aliasesStr = typeof flags.aliases === 'string' ? flags.aliases : '';
  const aliases = aliasesStr ? aliasesStr.split(',').map((a) => a.trim()).filter(Boolean) : [];

  const { competitor } = getCompetitor(name);
  if (!competitor) {
    console.error(`no competitor: ${name} (add it first with: db-cli competitors add "${name}")`);
    process.exit(1);
  }

  const inserted = insertCompetitorModel(name, model, aliases);
  if (inserted) console.log(`added model "${model}" to ${name}`);
  else console.log(`model "${model}" already exists for ${name} (no change)`);
}

function cmdSetAliases(name: string | undefined, flags: Record<string, string | boolean>): void {
  if (!name) {
    console.error('competitors set-aliases: <name> required');
    process.exit(2);
  }
  const aliasesStr = typeof flags.aliases === 'string' ? flags.aliases : '';
  const aliases = aliasesStr ? aliasesStr.split(',').map((a) => a.trim()).filter(Boolean) : [];

  const { competitor } = getCompetitor(name);
  if (!competitor) {
    console.error(`no competitor: ${name}`);
    process.exit(1);
  }

  setCompetitorAliases(name, aliases);
  console.log(`set aliases for ${name}: ${aliases.length ? aliases.join(', ') : '(cleared)'}`);
}
