// pm2 process file: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'bikepharma',
    script: 'server.mjs',
    interpreter: process.execPath,
    cwd: __dirname,
    node_args: process.env.NODE_ARGS || '',
    env: { NODE_ENV: 'production', NODE_NO_WARNINGS: '1' },
    autorestart: true,
    max_memory_restart: '500M',
    time: true,
    out_file: 'data/logs/out.log',
    error_file: 'data/logs/error.log',
    merge_logs: true,
  }],
};
