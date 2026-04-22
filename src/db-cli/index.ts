#!/usr/bin/env node
import { closeDb } from '../db/connection.ts';
import { migrate } from '../db/migrate.ts';
import { cmdStatus } from './status.ts';
import { cmdHasToday } from './has-today.ts';
import { cmdHasRecent } from './has-recent.ts';
import { cmdNext, cmdRelease } from './next.ts';
import { cmdAppend } from './append.ts';
import { cmdList } from './list.ts';
import { cmdToday } from './today.ts';
import { cmdTodayDate } from './today-date.ts';
import { cmdBrandHistory } from './brand-history.ts';
import { cmdQueries } from './queries.ts';
import { cmdCompetitors } from './competitors.ts';
import { cmdCandidates } from './candidates.ts';

function help(): void {
  console.log(`db-cli — geo_ranking database

Usage:
  db-cli <command> [options]

Results:
  status                           Count of runs, today's runs, distinct queries and brands
  has-today --query "<text>"       Exit 0 if today has a run for query, 1 otherwise
  has-recent --query "<text>" [--days 7] [--json]
                                   Print 'fresh'/'stale' (or JSON); always exits 0
  next [--pack <name>] [--days 7] [--limit N] [--json|--ids-only|--no-claim]
                                   Hand out stale/never-run queries with atomic claim
  release <id>                     Clear the claim on a query (manual unstick)
  append                           Read JSON record from stdin and insert atomically
  list [--date YYYY-MM-DD] [--pack <name>] [--json]
  today [--json]
  today-date                       Print today's local date (YYYY-MM-DD) — matches has-today semantics
  brand-history <name> [--json]

Queries:
  queries list [--pack <name>] [--include-inactive] [--json]
  queries add --query "<text>" --pack <name>
  queries activate <id>
  queries deactivate <id>

Competitors:
  competitors list [--json]
  competitors show <name>
  competitors add <name>
  competitors add-model <name> --model <name> [--aliases a,b,c]

Candidates:
  candidates list [--status pending|accepted|rejected|reviewed] [--pack <name>] [--json]
  candidates pending
  candidates show <name>
  candidates accept <name> [--model NAME [--aliases a,b]]...
  candidates reject <name> --reason "..."

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
      case 'has-recent':
        await cmdHasRecent(parseFlags(rest).flags);
        break;
      case 'next':
        await cmdNext(parseFlags(rest).flags);
        break;
      case 'release':
        await cmdRelease(parseFlags(rest).positionals);
        break;
      case 'append':
        await cmdAppend();
        break;
      case 'list':
        await cmdList(parseFlags(rest).flags);
        break;
      case 'today':
        await cmdToday(parseFlags(rest).flags);
        break;
      case 'today-date':
        await cmdTodayDate();
        break;
      case 'brand-history': {
        const { flags, positionals } = parseFlags(rest);
        await cmdBrandHistory(positionals[0], flags);
        break;
      }
      case 'queries':
        await cmdQueries(rest, parseFlags);
        break;
      case 'competitors':
        await cmdCompetitors(rest, parseFlags);
        break;
      case 'candidates':
        await cmdCandidates(rest, parseFlags);
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
