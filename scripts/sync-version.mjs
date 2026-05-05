import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'frontend', 'package.json');
const tauriPath = path.join(root, 'frontend', 'src-tauri', 'tauri.conf.json');
const cargoPath = path.join(root, 'frontend', 'src-tauri', 'Cargo.toml');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauri.version = version;
fs.writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

const cargo = fs.readFileSync(cargoPath, 'utf8');
const syncedCargo = cargo.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
  `$1${version}$2`,
);
fs.writeFileSync(cargoPath, syncedCargo);

console.log(`Version synced to ${version}`);
