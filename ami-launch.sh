#!/bin/bash

# this is run on AMI launch to do per-instance stuff

project_root=$(dirname $(realpath $0 ))
echo $project_root

# get some variables
PASSWORD=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
sed -i "s/\"password\":.*,/\"password\": \"$PASSWORD\",/" $project_root/API/config.json

# add key to guac properties file
NEW_UUID=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
echo "secret-key:$NEW_UUID" >> $project_root/Resources/Guacamole/guacamole.properties

# restart dockers
docker restart some-guacd
docker restart some-guacamole

# create certs and configs for vpn
cd $project_root/Resources/VPNSetup
npm run newvpn
cd $project_root

# start vpn server service
systemctl start openvpn@server
systemctl enable openvpn@server
