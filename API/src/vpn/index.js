const forge = require('node-forge');
const pki = forge.pki;
const fs = require('fs');

module.exports = {
  createVpnConfig,
  revokeVpnConfig
};

const baseConfig = [
  'client',
  'dev tun',
  'proto udp',
  'resolv-retry infinite',
  'nobind',
  'persist-key',
  'persist-tun',
  'remote-cert-tls server',
  'cipher AES-128-CBC',
  'auth SHA256',
  'key-direction 1',
  'comp-lzo',
  'verb 3',
  'mute 20'
];

const linuxConfigAdditions = [
  'script-security 2',
  'up /etc/openvpn/update-resolv-conf',
  'down /etc/openvpn/update-resolv-conf'
];

async function revokeVpnConfig (req, res) {
  // req.body.id
  const hexId = parseInt(req.body.id, 16).toString(16);
  const decId = parseInt(req.body.id, 16).toString();
  fs.openSync(`/etc/openvpn/crl/${decId}`, 'w');
  fs.unlinkSync(`../Data/VPNConfigs/${hexId}`);
  return res.json({ result: 'success' });
}

async function createVpnConfig (req, res) {
  // req.body.type, req.body.name
  const config = {
    Type: req.body.type === 'Linux' ? 'Linux' : 'Windows',
    Name: req.body.name
  };

  config.ID = (Math.floor(100000000000 + Math.random() * 900000000000) & 0x7FFFFFFF).toString(16).toLowerCase();

  const caKeyFile = fs.readFileSync('/etc/openvpn/ca.key');
  const caPrivateKey = pki.privateKeyFromPem(caKeyFile);
  const caCertFile = fs.readFileSync('/etc/openvpn/ca.crt');
  const caCert = pki.certificateFromPem(caCertFile);
  const taKey = fs.readFileSync('/etc/openvpn/ta.key');

  const client = await newClientCert(config.ID, caPrivateKey, caCert.issuer.attributes);

  let clientConfig = [`remote ${req.hostname} 1194`];
  clientConfig = clientConfig.concat(baseConfig);
  if (config.Type === 'Linux') {
    clientConfig = clientConfig.concat(linuxConfigAdditions);
  }
  clientConfig.push('<ca>');
  clientConfig.push(caCertFile);
  clientConfig = clientConfig.concat(['</ca>', '<cert>']);
  clientConfig.push(client.cert);
  clientConfig = clientConfig.concat(['</cert>', '<key>']);
  clientConfig.push(client.key);
  clientConfig = clientConfig.concat(['</key>', '<tls-auth>']);
  clientConfig.push(taKey);
  clientConfig.push('</tls-auth>');

  let configFile = `${clientConfig.join('\n')}\n`;
  configFile = configFile.replace(/(\r\n|\r|\n){2,}/g, '\n');
  configFile = configFile.replace(/(\r\n)/g, '\n');
  config.Data = configFile;

  fs.writeFileSync(`../Data/VPNConfigs/${config.ID}`, JSON.stringify(config));
  return res.json({ result: 'success', config });
}

function newKeypair () {
  return new Promise((resolve) =>
    pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
      if (err) {
        console.log(err);
        resolve(err);
      } else {
        resolve(keypair);
      }
    })
  );
}

function createCert (publicKey, serialNumber = Date.now().toString(16)) {
  const cert = pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = serialNumber;
  const curYear = (new Date()).getFullYear();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notBefore.setFullYear(curYear - 1);
  cert.validity.notAfter.setFullYear(curYear + 10);
  return cert;
}

function newCert (publicKey, clientId, extensions, caPrivateKey, caAttrs) {
  const clientCert = createCert(publicKey, clientId);

  const attrs = [
    { name: 'commonName', value: `client-${clientId}` },
    { name: 'countryName', value: caAttrs.find((a) => a.name === 'countryName').value },
    { shortName: 'ST', value: caAttrs.find((a) => a.shortName === 'ST').value },
    { name: 'localityName', value: caAttrs.find((a) => a.name === 'localityName').value },
    { name: 'organizationName', value: caAttrs.find((a) => a.name === 'organizationName').value },
    { shortName: 'OU', value: caAttrs.find((a) => a.shortName === 'OU').value }
  ];
  clientCert.setSubject(attrs);
  clientCert.setIssuer(caAttrs);
  clientCert.setExtensions(extensions);
  clientCert.sign(caPrivateKey);
  return clientCert;
}

async function newClientCert (clientId, caPrivateKey, caAttrs) {
  const clientKeypair = await newKeypair();
  const clientExtensions = [
    {
      name: 'keyUsage',
      digitalSignature: true
    },
    {
      name: 'extKeyUsage',
      clientAuth: true
    },
    {
      name: 'nsCertType',
      client: true
    }
  ];
  const clientCert = newCert(clientKeypair.publicKey, clientId, clientExtensions, caPrivateKey, caAttrs);

  const clientKey = pki.privateKeyToPem(clientKeypair.privateKey);
  const clientCertPem = pki.certificateToPem(clientCert);

  return { key: clientKey, cert: clientCertPem };
}
