import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDeployConfig } from './deploy-config';

const root = join(__dirname, '..');
const vercelJson = readFileSync(join(root, 'vercel.json'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const prismaVersion = (JSON.parse(packageJson) as { devDependencies: Record<string, string> })
  .devDependencies.prisma;

function withConfig(mutate: (config: Record<string, unknown>) => void): string {
  const config = JSON.parse(vercelJson) as Record<string, unknown>;
  mutate(config);
  return JSON.stringify(config);
}

function failedIds(vercelRaw: string): string[] {
  return checkDeployConfig(vercelRaw, packageJson)
    .checks.filter((check) => !check.ok)
    .map((check) => check.id);
}

describe('checkDeployConfig', () => {
  it('accepts the deployment config in this repository', () => {
    const report = checkDeployConfig(vercelJson, packageJson);
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('pins the Prisma CLI to the version in package.json', () => {
    const install = (JSON.parse(vercelJson) as { installCommand: string }).installCommand;
    expect(install).toContain(`prisma@${prismaVersion} generate`);
  });

  it('rejects an install step that drops devDependencies', () => {
    const config = withConfig((raw) => {
      raw.installCommand = `npm install && npx prisma@${prismaVersion} generate`;
    });
    expect(failedIds(config)).toContain('install-dev-deps');
  });

  it('rejects a bare "prisma generate" that resolves the latest major', () => {
    const config = withConfig((raw) => {
      raw.installCommand = 'npm install --include=dev && npm --prefix web install --include=dev && npx prisma generate';
    });
    expect(failedIds(config)).toContain('prisma-generate-pinned');
  });

  it('rejects a Prisma client that does not match the CLI', () => {
    const pkg = JSON.parse(packageJson) as { dependencies: Record<string, string> };
    pkg.dependencies['@prisma/client'] = '5.0.0';
    const report = checkDeployConfig(vercelJson, JSON.stringify(pkg));
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === 'prisma-versions-match')?.ok).toBe(false);
  });

  it('rejects a rewrite table without the SPA fallback', () => {
    const config = withConfig((raw) => {
      raw.rewrites = (raw.rewrites as Array<{ source: string }>).filter(
        (rule) => rule.source !== '/((?!assets/).*)',
      );
    });
    expect(failedIds(config)).toContain('rewrite-spa');
  });

  it('rejects a rewrite table that sends the API to the wrong place', () => {
    const config = withConfig((raw) => {
      raw.rewrites = (raw.rewrites as Array<{ source: string; destination: string }>).filter(
        (rule) => rule.source !== '/api/(.*)',
      );
    });
    expect(failedIds(config)).toContain('rewrite-api');
  });

  it('reports invalid JSON instead of throwing', () => {
    const report = checkDeployConfig('{ not json', packageJson);
    expect(report.ok).toBe(false);
    expect(report.checks[0].id).toBe('json');
  });
});
