const { Client } = require('ssh2');
const { readFileSync } = require('fs');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection ready');
  
  const command = 'echo "Hello World" && exit 0';
  
  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    
    console.log('Command started');
    
    stream.on('data', (data) => {
      console.log('STDOUT:', data.toString());
    });
    
    stream.stderr.on('data', (data) => {
      console.log('STDERR:', data.toString());
    });
    
    stream.on('close', (code, signal) => {
      console.log('Stream closed with code:', code, 'signal:', signal);
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
