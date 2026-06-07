#!/usr/bin/env node
const { execSync } = require('child_process');

const ports = [4021, 3000];

function pidsForPort(port) {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN -Pn`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (!out) return [];
    return out.split(/\s+/).filter(Boolean).map((s) => Number(s));
  } catch (e) {
    return [];
  }
}

for (const port of ports) {
  const pids = pidsForPort(port);
  if (pids.length === 0) {
    console.log(`Port ${port} free`);
    continue;
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Sent SIGTERM to ${pid} on port ${port}`);
    } catch (e) {
      try {
        process.kill(pid, 'SIGKILL');
        console.log(`Sent SIGKILL to ${pid} on port ${port}`);
      } catch (err) {
        console.warn(`Failed to kill ${pid} on port ${port}:`, err.message || err);
      }
    }
  }
}

// small delay to allow OS to free sockets
setTimeout(() => process.exit(0), 300);
