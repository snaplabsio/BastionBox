const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

module.exports = {
  createConnection,
  deleteConnection,
  connect
};

const data = fs.readFileSync('../Resources/Guacamole/guacamole.properties');
const regex = /secret-key:([a-zA-Z0-9]+)/g;
const result = regex.exec(data);
const guactoken = result[1];

async function createConnection (req, res) {
  // req.body.type, req.body.name
  const conn = req.body;
  if (conn.Port) conn.Port = parseInt(conn.Port);
  if (conn.SFTP && conn.SFTP.Port) conn.SFTP.Port = parseInt(conn.SFTP.Port);

  if (conn.ID) {
    conn.ID = parseInt(conn.ID, 16).toString(16);
  } else {
    conn.ID = (Math.floor(100000000000 + Math.random() * 900000000000) & 0x7FFFFFFF).toString(16).toLowerCase();
  }
  fs.writeFileSync(`../Data/Connections/${conn.ID}`, JSON.stringify(conn));
  return res.json({ result: 'success', conn });
}

async function deleteConnection (req, res) {
  // req.body.id
  const connId = parseInt(req.body.id, 16).toString(16);
  fs.unlinkSync(`../Data/Connections/${connId}`);
  return res.json({ result: 'success' });
}

async function connect (req, res) {
  // req.body.id
  const connId = parseInt(req.body.id, 16).toString(16);
  const conn = JSON.parse(fs.readFileSync(`../Data/Connections/${connId}`));

  const guacDomain = req.hostname;
  const payload = {
    'GUAC_ID': conn.Name || 'Console',
    'guac.hostname': conn.Host,
    'guac.protocol': conn.Protocol.toLowerCase(),
    'exp': Math.floor(Date.now() / 1000) + (60 * 60 * 24)
  };

  if (conn.Username && conn.Username.includes('\\')) {
    const parts = conn.Username.split('\\');
    conn.Domain = parts[0];
    conn.Username = parts[1];
  }

  switch (payload['guac.protocol']) {
    case 'rdp':
      payload['guac.port'] = conn.Port || '3389';
      if (conn.Username) payload['guac.username'] = conn.Username;
      if (conn.Password) payload['guac.password'] = conn.Password;
      if (conn.Domain) payload['guac.domain'] = conn.Domain;
      payload['guac.ignore-cert'] = 'true';
      if (conn.NLA) payload['guac.security'] = 'nla';
      // if server 2003: payload['guac.security'] = 'rdp';
      payload['guac.enable-drive'] = 'true';
      payload['guac.drive-path'] = '/tmp/guac/';
      payload['guac.create-drive-path'] = 'true';
      break;
    case 'vnc':
      payload['guac.port'] = conn.Port || '5900';
      if (conn.Username) payload['guac.username'] = conn.Username;
      if (conn.Password) payload['guac.password'] = conn.Password;
      if (conn.SFTP) {
        payload['guac.enable-sftp'] = 'true';
        if (conn.SFTP.Username) payload['guac.sftp-username'] = conn.SFTP.Username;
        if (conn.SFTP.Password) payload['guac.sftp-password'] = conn.SFTP.Password;
        if (conn.SFTP.Key) payload['guac.sftp-private-key'] = conn.SFTP.Key;
      }
      break;
    case 'ssh':
      payload['guac.port'] = conn.Port || '22';
      if (conn.Username) payload['guac.username'] = conn.Username;
      if (conn.Password) payload['guac.password'] = conn.Password;
      if (conn.Key) payload['guac.private-key'] = conn.Key;
      payload['guac.enable-sftp'] = 'true';
      break;
  }

  const token = jwt.sign(payload, guactoken, { algorithm: 'HS512' });

  const authToken = await getGuacAuthToken(token);
  if (authToken && typeof authToken === 'string') {
    const con = Buffer.from(`${payload['GUAC_ID']}\x00c\x00jwt`).toString('base64');
    const url = `http://${guacDomain}/guacamole/#/client/${con}?token=${authToken}`;
    return res.json({ result: 'success', url });
  }
  return res.json({ result: 'failed', message: 'Failed to connect to remote access server' });
}

function getGuacAuthToken (token) {
  return new Promise((resolve) =>
    axios.post(`http://localhost:8080/guacamole/api/tokens`, `token=${token}`)
      .then((res) => {
        console.log(res.data);
        if (res.data && res.data.authToken) {
          resolve(res.data.authToken);
        }
        resolve(null);
      })
      .catch((err) => {
        console.log(err);
        console.log('error with guac API');
        resolve(err);
      })
  );
}
