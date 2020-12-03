const njwt = require('njwt');
const fs = require('fs');

/*
From https://developer.okta.com/blog/2019/10/03/painless-node-authentication#implement-token-based-authentication-in-your-nodejs-application-using-jwts
*/

const config = JSON.parse(fs.readFileSync('config.json'));
console.log(config);

const data = fs.readFileSync('../Resources/Guacamole/guacamole.properties');
const regex = /secret-key:([a-zA-Z0-9]+)/g;
const result = regex.exec(data);
const guactoken = result[1];

function encodeToken (tokenData) {
  const jwt = njwt.create(tokenData, guactoken);
  const sessionLength = config.sessionLength || 24;
  jwt.setExpiration(new Date().getTime() + (60 * 60 * 1000 * sessionLength)); // One day from now
  return jwt.compact();
}

function decodeToken (token) {
  return njwt.verify(token, guactoken).body;
}

// This express middleware attaches `username` to the `req` object if a user is
// authenticated. This middleware expects a JWT token to be stored in the
// `Access-Token` header.
const jwtAuthenticationMiddleware = (req, res, next) => {
  const token = req.header('Access-Token');
  if (!token) {
    return next();
  }

  try {
    const decoded = decodeToken(token);
    const { username } = decoded;

    console.log('decoded', decoded);
    console.log('username', username);

    if (config.username === username) {
      console.log('found user!');
      req.username = username;
    }
  } catch (e) {
    return next();
  }

  next();
};

// This middleware stops the request if a user is not authenticated.
async function isAuthenticatedMiddleware (req, res, next) {
  if (req.username) {
    return next();
  }

  res.status(401);
  res.json({ error: 'User not authenticated' });
}

// This endpoints generates and returns a JWT access token given authentication
// data.
async function jwtLogin (req, res) {
  const { username, password } = req.body;
  console.log(req);

  if (config.username !== username || config.password !== password) {
    res.status(401);
    return res.json({ error: 'Invalid email or password' });
  }

  const accessToken = encodeToken({ username });
  return res.json({ accessToken });
}

module.exports = {
  encodeToken,
  decodeToken,
  jwtAuthenticationMiddleware,
  isAuthenticatedMiddleware,
  jwtLogin
};
