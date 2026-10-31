import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GAME_VERSION, GAME_VERSION_LABEL } from './version.ts';

test('GAME_VERSION matches package.json version', () => {
  const pkgPath = resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.equal(GAME_VERSION, pkg.version);
});

test('GAME_VERSION is valid semver', () => {
  assert.match(GAME_VERSION, /^\d+\.\d+\.\d+$/);
});

test('GAME_VERSION_LABEL formats version with v prefix', () => {
  assert.equal(GAME_VERSION_LABEL, `v${GAME_VERSION}`);
});
