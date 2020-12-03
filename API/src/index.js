const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const { isAuthenticatedMiddleware, jwtAuthenticationMiddleware, jwtLogin } = require('./jwt-auth');
const { listConfigsAndConnections } = require('./list');
const { createVpnConfig, revokeVpnConfig } = require('./vpn');
const { createConnection, deleteConnection, connect } = require('./guac');

const data = fs.readFileSync('../Resources/Guacamole/guacamole.properties');
const regex = /secret-key:([a-zA-Z0-9]+)/g;
const result = regex.exec(data);
const guactoken = result[1];
console.log(guactoken);

const app = express();
app.server = http.createServer(app);

app.use(cors());

app.use(bodyParser.json({
  limit: '100kb'
}));
app.use(jwtAuthenticationMiddleware);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError) {
    return res.status(400).send('syntax error');
  } else {
    return next();
  }
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.post('/login', jwtLogin);

app.get('/list', isAuthenticatedMiddleware, listConfigsAndConnections);

app.post('/createvpnconfig', isAuthenticatedMiddleware, createVpnConfig);
app.post('/revokevpnconfig', isAuthenticatedMiddleware, revokeVpnConfig);

app.post('/createconnection', isAuthenticatedMiddleware, createConnection);
app.post('/deleteconnection', isAuthenticatedMiddleware, deleteConnection);
app.post('/connect', isAuthenticatedMiddleware, connect);

app.use((req, res, next) => res.status(404).send('not found'));

app.server.listen(process.env.PORT || 8004, '127.0.0.1', () => {
  console.log(`Started on port ${app.server.address().port}`);
});

module.exports = app;
