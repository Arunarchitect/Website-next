// scripts/generate-build-info.mjs
import fs from 'fs';
import path from 'path';

const info = {
  buildTime: new Date().toISOString(),
  // optional: capture the git commit too, see note below
  commit: process.env.GIT_COMMIT || null,
};

const outDir = path.join(process.cwd(), 'lib');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify(info, null, 2));

console.log('Build info written:', info);