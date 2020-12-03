const fs = require('fs');

module.exports = {
  listConfigsAndConnections
};

async function listConfigsAndConnections (req, res) {
  const configs = [];
  let configIds = fs.readdirSync('../Data/VPNConfigs/');
  configIds = configIds
    .map((name) => ({
      name,
      time: fs.statSync(`../Data/VPNConfigs/${name}`).ctime.getTime()
    }))
    .sort((a, b) => a.time - b.time)
    .map((v) => v.name);
  configIds.forEach((cid) => {
    configs.push(JSON.parse(fs.readFileSync(`../Data/VPNConfigs/${cid}`)));
  });
  const connections = [];
  let connIds = fs.readdirSync('../Data/Connections/');
  connIds = connIds
    .map((name) => ({
      name,
      time: fs.statSync(`../Data/Connections/${name}`).ctime.getTime()
    }))
    .sort((a, b) => a.time - b.time)
    .map((v) => v.name);
  connIds.forEach((cid) => {
    connections.push(JSON.parse(fs.readFileSync(`../Data/Connections/${cid}`)));
  });

  return res.json({ result: 'success', configs, connections });
}
