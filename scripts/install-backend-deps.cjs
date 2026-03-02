const { spawnSync } = require('node:child_process');

const userAgent = process.env.npm_config_user_agent || '';
const isPnpm = userAgent.includes('pnpm');
const command = isPnpm ? 'pnpm' : 'npm';
const args = isPnpm ? ['install', '--dir', 'backend'] : ['install', '--prefix', 'backend'];

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
