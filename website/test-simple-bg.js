const { Client } = require('ssh2');
const { readFileSync } = require('fs');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection ready');
  
  // Simplified command - just start a background process
  const command = `bash -c '
echo "Starting background process..."
nohup sleep 100 > /tmp/test.log 2>&1 &
sleep 1
echo "Background process started"
if pgrep -f "sleep 100" > /dev/null; then
  echo "SUCCESS: Process is running"
  exit 0
else
  echo "ERROR: Process not running"
  exit 1
fi
'`;
  
  console.log('Executing simplified command...');
  
  const timeout = setTimeout(() => {
    console.log('TIMEOUT after 30s');
    conn.end();
  }, 30000);
  
  conn.exec(command, (err, stream) => {
    if (err) {
      clearTimeout(timeout);
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    
    console.log('Command executing...');
    
    let output = '';
    
    stream.on('data', (data) => {
      output += data.toString();
      console.log('STDOUT:', data.toString().trim());
    });
    
    stream.stderr.on('data', (data) => {
      console.log('STDERR:', data.toString().trim());
    });
    
    stream.on('close', (code, signal) => {
      clearTimeout(timeout);
      console.log('Closed - code:', code, 'signal:', signal);
      console.log('Output:', output);
      conn.end();
    });
  });
});

conn.on('error', (err) => {
  console.error('Connection error:', err);
});

const privateKey = readFileSync('/Users/balaa/freepinch/ssh-keys/OpenClaw01_key', 'utf-8');

conn.connect({
  host: '65.21.149.78',
  port: 22,
  username: 'root',
  privateKey,
  readyTimeout: 10000,
});
