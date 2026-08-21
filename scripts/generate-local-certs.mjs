import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import selfsigned from 'selfsigned';

const certDir = resolve('.certs');
const keyPath = resolve(certDir, 'localhost-key.pem');
const certPath = resolve(certDir, 'localhost.pem');

if (!existsSync(keyPath) || !existsSync(certPath)) {
  mkdirSync(certDir, { recursive: true });
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = await selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'subjectAltName', altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ] },
    ],
  });
  writeFileSync(keyPath, pems.private, { mode: 0o600 });
  writeFileSync(certPath, pems.cert);
  console.log('Certificado HTTPS local criado em .certs/.');
}
