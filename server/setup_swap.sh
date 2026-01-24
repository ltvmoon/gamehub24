#!/bin/bash
# Script to setup 2GB swap file on a Linux server

echo "Checking for existing swap..."
if sudo swapon --show | grep -q "swap"; then
    echo "Swap already exists. Skipping."
    exit 0
fi

echo "Creating 2GB swap file..."
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

echo "Making swap permanent in /etc/fstab..."
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "Adjusting swappiness (optional, good for servers)..."
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

echo "Swap setup complete!"
free -h
