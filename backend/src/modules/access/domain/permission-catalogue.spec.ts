import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MODULE_EXTRA_ACTIONS,
  PERMISSIONS,
  PERMISSION_KEYS,
  STANDARD_ACTIONS,
  STANDARD_MODULES,
  WORKSHEET_ACTIONS,
} from './permission-catalogue.js';

const FRONTEND_APP = fileURLToPath(new URL('../../../../../frontend/src/app/', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return ['.ts', '.html'].includes(extname(path)) ? [path] : [];
  });
}

const read = (relative: string): string => readFileSync(join(FRONTEND_APP, relative), 'utf8');

/** Module keys of the frontend permission matrix, e.g. "clients". */
function frontendModules(): string[] {
  return [
    ...read('features/admin/domain/permission-matrix.ts').matchAll(/\{ key: '([a-z]+)', label:/g),
  ].map((m) => m[1]);
}

/** Action names the frontend matrix can combine with a module. */
function frontendActions(): { standard: string[]; worksheet: string[]; extra: string[] } {
  const models = read('features/admin/domain/permission-matrix.ts');
  const standard = /export const ACTIONS[^=]*=\s*\[([^\]]+)\]/.exec(models)?.[1] ?? '';
  return {
    standard: [...standard.matchAll(/'([a-z]+)'/g)].map((m) => m[1]),
    worksheet: [...models.matchAll(/\{\s*action: '([a-z]+)'/g)].map((m) => m[1]),
    // `MODULE_EXTRA_ACTIONS` entries: `{ module: 'clients', action: 'deactivate', ...}`.
    extra: [...models.matchAll(/module: '([a-z]+)',\s*action: '([a-z_]+)'/g)].map(
      (m) => `${m[1]}.${m[2]}`,
    ),
  };
}

describe('permission catalogue', () => {
  it('has unique keys that follow module.action', () => {
    expect(PERMISSION_KEYS.size).toBe(PERMISSIONS.length);
    for (const key of PERMISSION_KEYS) expect(key).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('covers every module and action of the frontend permission matrix', () => {
    const modules = frontendModules();
    const { standard, worksheet, extra } = frontendActions();
    expect(modules.length).toBeGreaterThan(0);
    expect(standard.length).toBeGreaterThan(0);
    expect(worksheet.length).toBeGreaterThan(0);

    for (const module of modules.filter((m) => m !== 'worksheet')) {
      expect(STANDARD_MODULES as readonly string[], `module ${module}`).toContain(module);
      for (const action of standard) {
        expect(PERMISSION_KEYS.has(`${module}.${action}`), `${module}.${action}`).toBe(true);
      }
    }
    for (const action of worksheet) {
      expect(PERMISSION_KEYS.has(`worksheet.${action}`), `worksheet.${action}`).toBe(true);
    }
    const backendExtra = Object.entries(MODULE_EXTRA_ACTIONS).flatMap(([m, actions]) =>
      actions.map((a) => `${m}.${a}`),
    );
    expect([...extra].sort()).toEqual([...backendExtra].sort());
    expect(STANDARD_ACTIONS.length).toBe(standard.length);
    expect(WORKSHEET_ACTIONS.length).toBe(worksheet.length);
  });

  it('contains every permission key the frontend source uses', () => {
    const modules = new Set(frontendModules());
    const used = new Map<string, string>();
    for (const file of sourceFiles(FRONTEND_APP)) {
      // A quoted "module.action" literal, e.g. can('clients.edit') or permission: 'hr.view'.
      for (const match of readFileSync(file, 'utf8').matchAll(/['"`]([a-z]+)\.([a-z_]+)['"`]/g)) {
        if (modules.has(match[1])) used.set(`${match[1]}.${match[2]}`, file);
      }
    }
    // Guards against the scan silently finding nothing (e.g. after a refactor).
    expect(used.size).toBeGreaterThan(10);

    const missing = [...used].filter(([key]) => !PERMISSION_KEYS.has(key));
    expect(
      missing.map(([key, file]) => `${key} (${file})`),
      'Frontend uses permission keys that are not in the backend catalogue',
    ).toEqual([]);
  });
});
