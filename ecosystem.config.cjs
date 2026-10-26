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
    // 12z: was 500M; with the split brand files (Hero, Yamaha, Bajaj, TVS...) in memory the site went over it and pm2 restarted it again and again
    max_memory_restart: process.env.BP_MAX_MEM || '3000M',
    max_restarts: 15,
    min_uptime: '60s',
    restart_delay: 5000,
    time: true,
    out_file: 'data/logs/out.log',
    error_file: 'data/logs/error.log',
    merge_logs: true,
  }],
};
