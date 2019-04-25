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
export LOG_LEVEL=info

# default peers to connect with on startup
#export PEERS=ws://51.255.82.70:6001
export PEERS=ws://35.203.37.221:6001
# your user and keys (only useful for active node owners)
export NODE_OWNER=observer-node
export NODE_OWNER_PUB=dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz
export NODE_OWNER_PRIV=34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

npm start
