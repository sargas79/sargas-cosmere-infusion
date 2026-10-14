// Packs dist/ into module.zip for a GitHub release (uses the system zip/tar tool).
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

if (!existsSync('dist/module.json')) throw new Error('Run "npm run build" first.');
rmSync('module.zip', { force: true });
const cmd = process.platform === 'win32' ? 'tar -a -c -f ../module.zip *' : 'zip -r ../module.zip .';
execSync(cmd, { cwd: 'dist', stdio: 'inherit' });
console.log('module.zip created');
