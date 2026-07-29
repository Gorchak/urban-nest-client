import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const outputRoot = join('dist', 'urban-nest');
const browserOutput = join(outputRoot, 'browser');
const serverOutput = join(outputRoot, 'server');

const browserFiles = await readdir(browserOutput);
if (!browserFiles.includes('index.html')) {
  throw new Error(`Netlify publish output is missing: ${join(browserOutput, 'index.html')}`);
}

// This project is deployed by Netlify as a static Angular application. Angular
// can leave an empty server directory behind, which makes
// @netlify/angular-runtime incorrectly attempt to create an SSR Edge Function.
// Removing that unused output makes the runtime skip SSR setup.
await rm(serverOutput, { recursive: true, force: true });

console.log(`Prepared static Netlify output at ${browserOutput}.`);
