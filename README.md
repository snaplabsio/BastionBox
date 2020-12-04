# BastionBox

A simple bastion host setup designed for cloud-hosted and on-premises lab environments.

![Main Screen](/Images/main.png)

## AWS AMI

The easiest way to get started is to use our community AMI.

### us-east-1

`ami-0223eaf7dcb180393`

## Installation

### Ubuntu 20.04

This is currently the only tested/supported OS, though other debian based operating systems are likely to just work.

1. Clone Repository

    ```text
    git clone https://github.com/snaplabsio/BastionBox
    ```

2. Run Install Script

    ```text
    chmod +x ./BastionBox/install.sh
    sudo ./BastionBox/install.sh
    ```

## Usage

### Username and Password

The default username is `admin`.

If you use the prebuilt AMI, the admin password will be set to the InstanceId.

A manual install will prompt for a password.

The username and password can be changed in the `BastionBox/API/config.json` file. Run `pm2 restart 0` or reboot for web API changes to take affect.

### Routing traffic to VPN clients

If you want to initiate network connections with VPN clients from within your lab environment, you will need to add a route directing the vpn client IP range (default: 172.19.253.0/24) to the BastionBox. This could be required for things such as command and control (C2) callbacks.

You could do this locally on each system in the lab, but it is likely easier to do it at the router/default gateway level.

In AWS this means:

1. [Disabling the source/destination check](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html#modify-source-dest-check) on the BastionBox network interface
2. [Adding a route](https://docs.aws.amazon.com/vpc/latest/userguide/WorkWithRouteTables.html#AddRemoveRoutes) to the VPC/subnet's route table directing the vpn range to the BastionBox network interface

### Routing traffic through the VPN

The AMI will use your VPC CIDR range to push a route directing traffic through the VPN. The manual install will attempt to query AWS for the VPC CIDR, and if unavailable, use the subnet visible on the local interface.

You can manually modify this route or add more in the VPN server config `/etc/openvpn/server.conf`. Restart the vpn service `systemctl start openvpn@server` for changes to take affect.

### Security Considerations

#### Access

We recommend limiting access to this application to known IP addresses. In AWS, [security groups](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html#CreatingSecurityGroups) are an easy way to do this.

#### HTTPS

All of the web connections are proxied through Apache. To enable SSL/TLS, generate or upload your certificates and then uncomment the SSL options in `/etc/apache2/sites-enabled/000-default.conf` (or `BastionBox/Resources/apache.conf` pre-install).

#### Session Length

You can adjust the session length of the web interface by ediitng "sessionLength"   (measured in hours) in `BastionBox/API/config.json`. Run `pm2 restart 0` or reboot for web API changes to take affect.

## More Screenshots

Login Screen
![Login](/Images/login.png)

RDP Connection
![RDP](/Images/rdp.png)

Adding a Connection
![Console](/Images/console.png)

Creating a VPN Configuration
![VPN](/Images/vpn.png)
