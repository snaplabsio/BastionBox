# BastionBox

A simple bastion host setup designed for cloud-hosted lab environments.

## AWS AMI

The easiest way to get started is to use our community AMI.

### us-east-1

`ami-12341234`

## Installation

### Ubuntu 20.04

This is currently the only tested/supported OS, though other debian based operating systems are likely to just work.

1. Clone Repository

    ```text
    git clone https://github.com/snaplabsio/BastionBox
    ```

2. Run Install Script

    ```text
    sudo BastionBox/install.sh
    ```

## Usage

### Security Considerations

We recommend limiting access to this application to known IP addresses. In AWS, [security groups](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html#CreatingSecurityGroups) are an easy way to do this.

### Username and Password

The default username is `admin`.

If you use the prebuilt AMI, the admin password will be set to the InstanceId.

A manual install will prompt for a password.

The username and password can be updated in the `API/config.json` file.

### Routing traffic to clients

If you want to initiate network connections with VPN clients from within your lab environment, you will need to add a route directing the vpn client IP range (default: 172.19.253.0/24) to the BastionBox. This could be required for things such as command and control (C2) callbacks.

You could do this locally on each system in the lab, but it is likely easier to do it at the router/default gateway level.

In AWS this means:

1. [Disabling the source/destination check](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html#modify-source-dest-check) on the BastionBox network interface
2. [Adding a route](https://docs.aws.amazon.com/vpc/latest/userguide/WorkWithRouteTables.html#AddRemoveRoutes) to the VPC/subnet's route table directing the vpn range to the BastionBox network interface
