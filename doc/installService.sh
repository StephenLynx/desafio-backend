#!/bin/bash

rm -rf /usr/bin/wallets
ln -s $(readlink -f ..)/kernel.js /usr/bin/wallets

rm -rf /etc/systemd/system/wallets.service
cp ./lynxchan.systemd /etc/systemd/system/wallets.service
