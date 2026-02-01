const { Client } = require('ssh2');
const { readFileSync } = require('fs');

const conn = new Client();
const remotePort = 7735;
const instanceName = 'OpenClaw01';

conn.on('ready', () => {
  console.log('SSH connection ready');
  
  const scriptPath = `/usr/local/bin/openclaw-onboard-${instanceName}.sh`;
  const logPath = `/tmp/ttyd-${instanceName}.log`;
  
  const command = `bash -c '
# Create wrapper script
cat > ${scriptPath} << "SCRIPT_END"
#!/bin/bash
su -l openclaw -c "openclaw onboard"
SCRIPT_END

# Make it executable
chmod +x ${scriptPath}

# Kill any existing ttyd on this port
pkill -f "ttyd.*--port ${remotePort}" || true

# Start ttyd in background with nohup
nohup ttyd --writable --port ${remotePort} --interface 127.0.0.1 ${scriptPath} > ${logPath} 2>&1 &

# Wait a moment for it to start
sleep 2

# Verify it started
if pgrep -f "ttyd.*--port ${remotePort}" > /dev/null; then
  echo "SUCCESS: ttyd started on port ${remotePort}"
  exit 0
else
  echo "ERROR: ttyd failed to start. Log contents:"
  cat ${logPath}
  exit 1
fi
'`;
  
  console.log('Executing command...');
  
  const timeout = setTimeout(() => {
    console.log('TIMEOUT: Command took too long');
    conn.end();
  }, 10000);
  
  conn.exec(command, (err, stream) => {
    if (err) {
      clearTimeout(timeout);
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    
    console.log('Command started');
    
    let output = '';
    let errorOutput = '';
    
    stream.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('STDOUT:', text.trim());
    });
    
    stream.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('STDERR:', text.trim());
    });
    
    stream.on('close', (code, signal) => {
      clearTimeout(timeout);
      console.log('Stream closed with code:', code, 'signal:', signal);
      console.log('Full output:', output);
      console.log('Full error output:', errorOutput);
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
