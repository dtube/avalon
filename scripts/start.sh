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
#export DISCOVERY_EXCLUDE=dtube

# Disabling notifications
#export NOTIFICATIONS=1

# Cache warmup option
export WARMUP_ACCOUNTS=10000
export WARMUP_CONTENTS=10000

# trace / debug / info / warn
export LOG_LEVEL=debug

# groups blocks during replay output to lower screen spam
export REPLAY_OUTPUT=100

# default peers to connect with on startup
export PEERS=ws://127.0.0.1:6002
export MAX_PEERS=20

# your user and keys (only useful for active node owners)
export NODE_OWNER=dtube
export NODE_OWNER_PUB=dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz
export NODE_OWNER_PRIV=34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

node --stack-size=65500 src/main
