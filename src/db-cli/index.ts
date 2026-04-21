#!/usr/bin/env node
import { closeDb } from '../db/connection.ts';
import { migrate } from '../db/migrate.ts';
import { cmdStatus } from './status.ts';
import { cmdHasToday } from './has-today.ts';
import { cmdAppend } from './append.ts';
import { cmdList } from './list.ts';
import { cmdToday } from './today.ts';
import { cmdBrandHistory } from './brand-history.ts';
import { cmdExport } from './export.ts';
import { cmdKeywords } from './keywords.ts';

function help(): void {
  console.log(`db-cli — geo_ranking database

Usage:
  db-cli <command> [options]

Results:
  status                           Count of runs, today's runs, distinct keywords and brands
  has-today --keyword "<text>"     Exit 0 if today has a run for keyword, 1 otherwise
  append                           Read JSON record from stdin and insert atomically
  list [--date YYYY-MM-DD] [--pack <name>] [--json]
  today [--json]
  brand-history <name> [--json]
  export [--date YYYY-MM-DD] [--out data/results.jsonl]

Keywords:
  keywords list [--pack <name>] [--include-inactive] [--json]
  keywords add --keyword "<text>" --pack <name>
  keywords activate <id>
  keywords deactivate <id>
  keywords import --from <dir>     One-time: import .txt files (stem = pack)

Other:
  init                             Create schema (idempotent)
  --help, -h
`);
}

function parseFlags(argv: string[]): { flags: Record<string, string | boolean>; positionals: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--help' || a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    help();
    return;
  }

  migrate();

  const rest = argv.slice(1);
  try {
    switch (command) {
      case 'init':
        console.log('schema ready');
        break;
      case 'status':
        await cmdStatus(parseFlags(rest).flags);
        break;
      case 'has-today': {
        const { flags } = parseFlags(rest);
        process.exitCode = (await cmdHasToday(flags)) ? 0 : 1;
        break;
      }
      case 'append':
        await cmdAppend();
        break;
      case 'list':
        await cmdList(parseFlags(rest).flags);
        break;
      case 'today':
        await cmdToday(parseFlags(rest).flags);
        break;
      case 'brand-history': {
        const { flags, positionals } = parseFlags(rest);
        await cmdBrandHistory(positionals[0], flags);
        break;
      }
      case 'export':
        await cmdExport(parseFlags(rest).flags);
        break;
      case 'keywords':
        await cmdKeywords(rest, parseFlags);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "db-cli --help" for usage.');
        process.exitCode = 1;
    }
  } finally {
    closeDb();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
