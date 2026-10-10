import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(projectRoot, 'src');
const outputDir = path.join(projectRoot, 'public', 'src');

await mkdir(path.dirname(outputDir), { recursive: true });
await rm(outputDir, { recursive: true, force: true });
await cp(sourceDir, outputDir, { recursive: true });

console.log('Build concluído: src copiado para public/src.');
