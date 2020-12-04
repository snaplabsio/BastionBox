#!/bin/bash

project_root=$(dirname $(realpath $0 ))
echo $project_root

# get some variables
echo "Choose a password for the web interface"
read -s -p "Password: " PASSWORD; echo
read -s -p "Confirm Password: " PASSCONFIRM; echo

if [[ "$PASSWORD" != "$PASSCONFIRM" ]]; then
 echo "Passwords do not match, exiting"
 exit -1
fi

sed -i "s/\"password\":.*,/\"password\": \"$PASSWORD\",/" $project_root/API/config.json

# install dependencies
apt-get update
apt-get install -y zip unzip python3-pip apache2 docker.io openvpn nodejs npm

iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

echo iptables-persistent iptables-persistent/autosave_v4 boolean true | sudo debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | sudo debconf-set-selections

apt-get -y install iptables-persistent

npm install pm2 -g
a2enmod proxy_http

# create guac properties file
NEW_UUID=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
echo "auth-provider:com.aiden0z.guacamole.net.jwt.JwtAuthenticationProvider" > $project_root/Resources/Guacamole/guacamole.properties
echo "secret-key:$NEW_UUID" >> $project_root/Resources/Guacamole/guacamole.properties

# modify guacamole war file
cd $project_root/Resources
wget http://apache.spinellicreations.com/guacamole/1.2.0/binary/guacamole-1.2.0.war
unzip guacamole-1.2.0.war -d edits/
cd edits

sed -i -e 's/\.localStorage/.sessionStorage/g' guacamole.js
sed -i -e 's/\.localStorage/.sessionStorage/g' guacamole.min.js
sed -i -e 's/localStorage\./sessionStorage./g' guacamole.js
sed -i -e 's/localStorage\./sessionStorage./g' guacamole.min.js
sed -i -e 's/\.localStorage/.sessionStorage/g' app/storage/services/localStorageService.js
sed -i -e 's/localStorage\./sessionStorage./g' app/storage/services/localStorageService.js

zip -r $project_root/Resources/guacamole.war *
cd $project_root

# start guac dockers
docker run --name some-guacd --restart always -d guacamole/guacd
docker run --name some-guacamole --restart always --link some-guacd:guacd -v $project_root/Resources/Guacamole:/guac-home -v $project_root/Resources/guacamole.war:/opt/guacamole/guacamole.war -e GUACAMOLE_HOME=/guac-home -d -p 127.0.0.1:8080:8080 guacamole/guacamole

mkdir $project_root/Data
mkdir $project_root/Data/Connections
mkdir $project_root/Data/VPNConfigs

# create certs and configs for vpn
cd $project_root/Resources/VPNSetup
cp server.conf /etc/openvpn/server.conf
mkdir /etc/openvpn/crl
npm i --production
npm run newvpn
cd $project_root

# enable traffic forwarding for vpn
sysctl -w net.ipv4.ip_forward=1
sed -i 's/#* *net.ipv4.ip_forward.*$/net.ipv4.ip_forward = 1/' /etc/sysctl.conf

# start vpn server service
systemctl start openvpn@server
systemctl enable openvpn@server

# start api
cd $project_root/API
npm i --production
pm2 start src
pm2 start src
pm2 startup
pm2 save
cd $project_root

# copy frontend to web dir
mkdir -p /var/www/html/bastionbox
cp -r $project_root/Frontend/* /var/www/html/bastionbox

# update apache config
cp $project_root/Resources/apache.conf /etc/apache2/sites-enabled/000-default.conf
systemctl restart apache2
