const crypto = require('crypto');
crypto.generateKeyPair('rsa', { modulusLength: 2048 }, (err, publicKey, privateKey) => {
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
  const pub = publicKey.export({ type: 'spki', format: 'pem' }).replace(/\n/g, '\\n');
  const ref = crypto.randomBytes(48).toString('base64');
  console.log('\nCopy these into your .env file:\n\nJWT_PRIVATE_KEY="' + priv + '"\n\nJWT_PUBLIC_KEY="' + pub + '"\n\nJWT_REFRESH_SECRET="' + ref + '"');
});
