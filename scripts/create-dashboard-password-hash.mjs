import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { stdin, stdout } from 'node:process';

const scrypt = promisify(crypto.scrypt);

async function readMaskedPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this helper in an interactive PowerShell or terminal window.');
  }
  return new Promise((resolve, reject) => {
    let password = '';
    stdout.write('Dashboard password (12-128 characters): ');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Password entry cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(password);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        } else if (char >= ' ') {
          password += char;
          stdout.write('*');
        }
      }
    };
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

const password = await readMaskedPassword();
if (password.length < 12 || password.length > 128) {
  throw new Error('Use a password between 12 and 128 characters.');
}
const salt = crypto.randomBytes(16);
const key = await scrypt(password, salt, 64);
console.log(`Password hash: scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`);
