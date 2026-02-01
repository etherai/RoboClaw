const { Client } = require('ssh2');
const { readFileSync } = require('fs');

const conn = new Client();
const remotePort = 7735;
const instanceName = 'OpenClaw01';

conn.on('ready', () => {
  console.log('SSH connection ready');
  
  const scriptPath = `/usr/local/bin/openclaw-onboard-${instanceName}.sh`;
  const logPath = `/tmp/ttyd-${instanceName}.log`;
  
  // Test the actual ttyd command step by step
  const command = `bash -c '
echo "Step 1: Creating wrapper script..."
cat > ${scriptPath} << "SCRIPT_END"
#!/bin/bash
su -l openclaw -c "openclaw onboard"
SCRIPT_END
echo "Step 1: Done"

echo "Step 2: Making executable..."
chmod +x ${scriptPath}
echo "Step 2: Done"

echo "Step 3: Killing existing ttyd..."
pkill -f "ttyd.*--port ${remotePort}" || true
echo "Step 3: Done"

echo "Step 4: Starting ttyd..."
nohup ttyd --writable --port ${remotePort} --interface 127.0.0.1 ${scriptPath} > ${logPath} 2>&1 &
echo "Step 4: Done (pid: $!)"

echo "Step 5: Sleeping..."
sleep 2
echo "Step 5: Done"

echo "Step 6: Checking if running..."
if pgrep -f "ttyd.*--port ${remotePort}" > /dev/null; then
  echo "SUCCESS: ttyd started on port ${remotePort}"
  exit 0
else
  echo "ERROR: ttyd failed to start. Log contents:"
  cat ${logPath} || echo "No log file"
  exit 1
fi
'`;
  
  console.log('Executing ttyd command...');
  
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
    let errorOutput = '';
    
    stream.on('data', (data) => {
      output += data.toString();
      console.log('STDOUT:', data.toString().trim());
    });
    
    stream.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('STDERR:', data.toString().trim());
    });
    
    stream.on('close', (code, signal) => {
      clearTimeout(timeout);
      console.log('Closed - code:', code, 'signal:', signal);
      console.log('Output:', output);
      console.log('Error:', errorOutput);
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
