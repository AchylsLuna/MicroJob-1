import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { getEmailTransporter } from '../../lib/emailTransporter.js';

test('SMTP transport authenticates and sends a notification through a local mail server', { timeout: 10000 }, async (t) => {
  const sockets = new Set();
  const messages = [];
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost test SMTP\r\n');
    let buffer = ''; let receiving = false; let message = [];
    socket.on('data', (data) => {
      buffer += data.toString();
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (receiving) {
          if (line === '.') { messages.push(message.join('\n')); message = []; receiving = false; socket.write('250 Message accepted\r\n'); }
          else message.push(line);
        } else if (line.startsWith('EHLO')) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH PLAIN')) socket.write('235 Authentication successful\r\n');
        else if (/^(MAIL FROM|RCPT TO):/.test(line)) socket.write('250 OK\r\n');
        else if (line === 'DATA') { receiving = true; socket.write('354 End with a dot\r\n'); }
        else if (line === 'QUIT') socket.end('221 Goodbye\r\n');
        else socket.write('500 Unsupported test command\r\n');
      }
    });
  });
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const keys = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  delete process.env.RESEND_API_KEY;
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_USER: 'local-test', SMTP_PASS: 'local-test-password' });
  const transport = getEmailTransporter();
  t.after(() => transport.close());
  const result = await transport.sendMail({ from: 'sender@example.test', to: 'recipient@example.test', subject: 'Withdrawal update', text: 'Your withdrawal was confirmed.' });
  assert.deepEqual(result.accepted, ['recipient@example.test']);
  assert.deepEqual(result.rejected, []);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Subject: Withdrawal update/);
  assert.match(messages[0], /Your withdrawal was confirmed\./);
});
