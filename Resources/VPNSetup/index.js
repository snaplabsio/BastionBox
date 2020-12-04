const forge = require('node-forge');
const pki = forge.pki;
const fs = require('fs');
const axios = require('axios');
const ip = require('ip-utils');
const os = require('os');

const CAattrs = [
  { name: 'commonName', value: 'bastionboxCA' },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'CA' },
  { name: 'localityName', value: 'San Francisco' },
  { name: 'organizationName', value: 'BastionBoxCA' },
  { shortName: 'OU', value: 'BastionBoxCA' }
];

const dhparams = [
  '-----BEGIN DH PARAMETERS-----',
  'MIIBCAKCAQEAmn0l3tfsiAgh1bOslzJqShOEhfGkujBZhvc8aIkypHsVk70O482E',
  'YQ7fLfEsLiNYgp2uVBiiFpvgJW7yLn2pn/rnbY17bf3KRhGJKNQIowIdFZPNMYIP',
  'uJeZfFtz7iqddqqj6f9CQE+5rk5r3/MeTv0SyONnbeVloZwGD0mgkGZE2EbRbBzY',
  'dDpqDwujvABNMasryQWG+NOfdsTokc0sS7IsoNPLppEzGDqeaNNWfs7bnTfWNvef',
  'GAPmZ5qxxVC4hljzjbf/uvg278OaP8S8PGgQvEM25hwaqf7YuShwAuJMxy6239l2',
  'mDtVSsbVNJpWMkjV84hv2hT8UB34IFwhAwIBAg==',
  '-----END DH PARAMETERS-----'
];

module.exports = {
  newVpnSetup
};

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

function newCaCert (keys) {
  const cert = createCert(keys.publicKey);

  cert.setSubject(CAattrs);
  cert.setIssuer(CAattrs);
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true
    },
    {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true
    }
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return cert;
}

function createCert (publicKey) {
  const cert = pki.createCertificate();
  cert.publicKey = publicKey;
  const d = new Date();
  cert.serialNumber = d.getTime().toString(16);
  const curYear = d.getFullYear();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notBefore.setFullYear(curYear - 1);
  cert.validity.notAfter.setFullYear(curYear + 10);
  return cert;
}

function newCert (publicKey, name, extensions, caPrivateKey) {
  const clientCert = createCert(publicKey);

  const attrs = [
    { name: 'commonName', value: name },
    { name: 'countryName', value: 'US' },
    { shortName: 'ST', value: 'CA' },
    { name: 'localityName', value: 'San Francisco' },
    { name: 'organizationName', value: 'BastionBox' },
    { shortName: 'OU', value: 'BastionBox' }
  ];
  clientCert.setSubject(attrs);
  clientCert.setIssuer(CAattrs);
  clientCert.setExtensions(extensions);
  clientCert.sign(caPrivateKey);
  return clientCert;
}

async function newVpnSetup () {
  // ta.key (shared static 2048 bit key)
  const bytes = forge.random.getBytesSync(256);
  const keyBody = forge.util.bytesToHex(bytes).match(/.{1,32}/g);
  let takey = ['-----BEGIN OpenVPN Static key V1-----'];
  takey = takey.concat(keyBody);
  takey.push('-----END OpenVPN Static key V1-----');

  fs.writeFileSync('/etc/openvpn/ta.key', takey.join('\n'));
  fs.writeFileSync('/etc/openvpn/dh2048.pem', dhparams.join('\n'));

  const caKeypair = await newKeypair();
  const caCert = newCaCert(caKeypair);
  const rootKey = pki.privateKeyToPem(caKeypair.privateKey);
  const rootCrt = pki.certificateToPem(caCert);

  fs.writeFileSync('/etc/openvpn/ca.key', rootKey);
  fs.writeFileSync('/etc/openvpn/ca.crt', rootCrt);

  const serverKeypair = await newKeypair();
  const serverExtensions = [
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true
    },
    {
      name: 'nsCertType',
      server: true
    }
  ];
  const serverCert = newCert(serverKeypair.publicKey, 'server', serverExtensions, caKeypair.privateKey);

  const serverKey = pki.privateKeyToPem(serverKeypair.privateKey);
  const serverCertPem = pki.certificateToPem(serverCert);

  fs.writeFileSync('/etc/openvpn/server.key', serverKey);
  fs.writeFileSync('/etc/openvpn/server.crt', serverCertPem);

  let cidr;
  // attempt to get VPC cidr for AWS
  try {
    const res1 = await axios.get('http://169.254.169.254/latest/meta-data/mac', { timeout: 500 });
    const mac = res1.data;
    const res2 = await axios.get(`http://169.254.169.254/latest/meta-data/network/interfaces/macs/${mac}/vpc-ipv4-cidr-block`, { timeout: 500 });
    cidr = res2.data;
  } catch (err) {
    console.log('could not reach AWS metadata');
  }

  // get subnet cidr from network interface
  if (!cidr) {
    const networkInterfaces = os.networkInterfaces();
    if (networkInterfaces['eth0']) {
      cidr = networkInterfaces['eth0'].find((ip) => ip.family === 'IPv4').cidr;
    } else {
      for (const niId in networkInterfaces) {
        const v4addr = networkInterfaces[niId].find((ip) => ip.family === 'IPv4');
        if (v4addr && !v4addr.internal) {
          cidr = v4addr.cidr;
          break;
        }
      }
    }
  }

  const mask = ip.subnet(cidr).mask();
  const start = ip.subnet(cidr).networkAddress();
  fs.appendFileSync('/etc/openvpn/server.conf', `push "route ${start} ${mask}"\n`);
}
