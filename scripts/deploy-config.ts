#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

// Guards the Vercel deployment contract. The build itself cannot fail cheaply
// (it needs a remote builder), so the parts that broke in production are checked
// statically here: install flags, the pinned Prisma CLI, and the rewrite table.

export interface CheckResult {
  id: string;
  ok: boolean;
  detail: string;
}

export interface DeployConfigReport {
  ok: boolean;
  checks: CheckResult[];
}

interface VercelConfig {
  buildCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
  functions?: Record<string, { includeFiles?: string }>;
  rewrites?: Array<{ source: string; destination: string }>;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const API_FUNCTION = 'api/index.js';

export function checkDeployConfig(vercelRaw: string, packageRaw: string): DeployConfigReport {
  const checks: CheckResult[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });

  let config: VercelConfig;
  let pkg: PackageJson;
  try {
    config = JSON.parse(vercelRaw) as VercelConfig;
    pkg = JSON.parse(packageRaw) as PackageJson;
  } catch (error) {
    add('json', false, `vercel.json or package.json is not valid JSON: ${(error as Error).message}`);
    return { ok: false, checks };
  }

  const install = config.installCommand ?? '';
  const build = config.buildCommand ?? '';
  const scripts = pkg.scripts ?? {};

  add(
    'install-dev-deps',
    /--include=dev|--production=false/.test(install),
    'installCommand must keep devDependencies: add --include=dev (Vercel installs with NODE_ENV=production)',
  );

  add(
    'install-web-deps',
    /--prefix\s+web|--workspace\s+web/.test(install),
    'installCommand must install web/ dependencies: add npm --prefix web install --include=dev',
  );

  const prismaVersion = (pkg.devDependencies ?? {}).prisma ?? (pkg.dependencies ?? {}).prisma;
  const clientVersion =
    (pkg.dependencies ?? {})['@prisma/client'] ?? (pkg.devDependencies ?? {})['@prisma/client'];
  add(
    'prisma-versions-match',
    Boolean(prismaVersion) && prismaVersion === clientVersion,
    `prisma (${prismaVersion ?? 'missing'}) and @prisma/client (${clientVersion ?? 'missing'}) must be pinned to the same version`,
  );
  add(
    'prisma-generate-pinned',
    Boolean(prismaVersion) && install.includes(`prisma@${prismaVersion} generate`),
    `installCommand must generate the client with the pinned CLI (npx prisma@${prismaVersion ?? '<version>'} generate); a bare "prisma generate" resolves the latest major, which removed the command`,
  );

  const buildScripts = build.replace(/^npm\s+(?:run\s+)?/, '').split(/\s+&&\s+/);
  add(
    'build-command-exists',
    buildScripts.length > 0 && buildScripts.every((name) => name in scripts),
    `buildCommand "${build}" must reference package.json scripts (found: ${buildScripts.join(', ') || 'none'})`,
  );
  add(
    'build-command-includes-web',
    (scripts[buildScripts[0]] ?? '').includes('build:web') ||
      buildScripts.some((name) => name === 'build:web'),
    'buildCommand must also build the frontend (npm run build:all runs build:web)',
  );

  add(
    'output-directory',
    config.outputDirectory === 'web/dist',
    `outputDirectory must be "web/dist", the folder vite writes (got: ${config.outputDirectory ?? 'unset'})`,
  );

  const includeFiles = config.functions?.[API_FUNCTION]?.includeFiles ?? '';
  add(
    'function-includes',
    Boolean(config.functions?.[API_FUNCTION]) &&
      ['dist', 'prisma', 'web/dist'].every((dir) => includeFiles.includes(dir)),
    `functions["${API_FUNCTION}"].includeFiles must bundle dist, prisma and web/dist`,
  );

  const rewrites = config.rewrites ?? [];
  const sendsTo = (source: string, destination: string) =>
    rewrites.some((rule) => rule.source === source && rule.destination === destination);

  add(
    'rewrite-api',
    rewrites.some((rule) => /^\/api\//.test(rule.source) && rule.destination === `/${API_FUNCTION}`),
    `a rewrite must send /api/* to /${API_FUNCTION}`,
  );
  add(
    'rewrite-health',
    ['/healthz', '/readyz'].every((path) => sendsTo(path, `/${API_FUNCTION}`)),
    `rewrites must send /healthz and /readyz to /${API_FUNCTION}`,
  );
  add(
    'rewrite-docs',
    ['/docs', '/docs/(.*)'].every((path) => rewrites.some((rule) => rule.source === path && rule.destination === `/${API_FUNCTION}`)),
    `rewrites must send /docs and /docs/* to /${API_FUNCTION}`,
  );
  add(
    'rewrite-spa',
    rewrites.some((rule) => rule.destination === '/index.html' && /assets/.test(rule.source)),
    'a fallback rewrite must send non-asset paths to /index.html so client routes work',
  );

  return { ok: checks.every((check) => check.ok), checks };
}

const HELP = `Usage: npm run check:deploy -- [--json] [--config <file>] [--package <file>]

Validates vercel.json against package.json before a deployment.

Options:
  --json              Print the report as JSON (machine readable)
  --config <file>     vercel.json to check (default: ./vercel.json)
  --package <file>    package.json to check (default: ./package.json)
  -h, --help          Show this help

Exit codes:
  0  every check passed
  1  at least one check failed
  2  usage or file error

Examples:
  npm run check:deploy
  npm run check:deploy -- --json | jq '.checks[] | select(.ok == false)'
  npm run check:deploy -- --config /tmp/vercel.json
`;

function parseArgs(argv: string[]) {
  const options = { json: false, help: false, config: 'vercel.json', packageFile: 'package.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--config' || arg === '--package') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) throw new Error(`${arg} needs a file path`);
      if (arg === '--config') options.config = value;
      else options.packageFile = value;
      i += 1;
    } else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function main(argv: string[]): number {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\nTry --help for usage.\n`);
    return 2;
  }

  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let report: DeployConfigReport;
  try {
    const resolve = (file: string) => (isAbsolute(file) ? file : join(process.cwd(), file));
    const configPath = resolve(options.config);
    const packagePath = resolve(options.packageFile);
    report = checkDeployConfig(readFileSync(configPath, 'utf8'), readFileSync(packagePath, 'utf8'));
  } catch (error) {
    process.stderr.write(`cannot read deployment files: ${(error as Error).message}\n`);
    return 2;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const check of report.checks) {
      process.stdout.write(`${check.ok ? 'ok  ' : 'FAIL'} ${check.id}${check.ok ? '' : `: ${check.detail}`}\n`);
    }
    process.stdout.write(report.ok ? '\ndeployment config is valid\n' : '\ndeployment config has problems\n');
  }

  return report.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
