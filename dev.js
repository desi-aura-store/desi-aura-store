// dev.js
const { spawn } = require('child_process');
const path = require('path');
const process = require('process');

console.log('Starting development server...');

// Function to spawn a process with proper error handling
function spawnProcess(command, args, options, name) {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'cmd.exe' : command;
  const cmdArgs = isWindows ? ['/c', command, ...args] : args;
  
  console.log(`Starting ${name}...`);
  console.log(`Command: ${cmd}`);
  console.log(`Args: ${cmdArgs.join(' ')}`);
  
  const proc = spawn(cmd, cmdArgs, {
    ...options,
    shell: isWindows,
    stdio: 'inherit'
  });
  
  proc.on('error', (err) => {
    console.error(`Failed to start ${name}:`, err);
  });
  
  proc.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });
  
  return proc;
}

// Start backend (which now serves both API and frontend)
const backend = spawnProcess('npm', ['start'], {
  cwd: path.join(__dirname, 'backend')
}, 'backend');

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down development server...');
  backend.kill();
  process.exit(0);
});

process.on('exit', () => {
  console.log('Development server stopped.');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  backend.kill();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  backend.kill();
  process.exit(1);
});