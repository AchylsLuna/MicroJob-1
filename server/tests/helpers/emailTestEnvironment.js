import { before, after } from 'node:test';

// Payment tests must never use a developer's configured mail provider.
// Individual receipt tests can install an explicit mocked/local transport.
export function isolateEmailEnvironment() {
  const names = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'SMTP_FROM'];
  let previous;
  before(() => {
    previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    for (const name of names) process.env[name] = '';
  });
  after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}
