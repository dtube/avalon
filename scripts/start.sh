#!/bin/bash

# Ports configuration
#export HTTP_PORT=3001
#export P2P_PORT=6001

# MongoDB configuration
#export DB_NAME=avalon
#export DB_URL=mongodb://localhost:27017

# Peering configuration
#export OFFLINE=1
#export NO_DISCOVERY=1

# trace / debug / info / warn /
export LOG_LEVEL=debug

# default peers to connect with on startup
export PEERS=ws://api.avalon.wtf:6001,ws://avalon.nannal.com:6001,ws://82.66.109.22:6001

# your user and keys (only useful for active node owners)
export NODE_OWNER=<your_username>
export NODE_OWNER_PUB=<your_public_key>
export NODE_OWNER_PRIV=<your_private_key>
npm start
