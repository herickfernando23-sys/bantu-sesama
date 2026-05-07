const { generateKeyPairSync } = require('crypto');
const { writeFileSync } = require('fs');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

writeFileSync('merchant_private.pem', privateKey, { mode: 0o600 });
writeFileSync('merchant_public.pem', publicKey);

console.log('Wrote merchant_private.pem and merchant_public.pem to current directory.');
console.log('\n---PUBLIC KEY START---\n');
console.log(publicKey);
console.log('---PUBLIC KEY END---');
