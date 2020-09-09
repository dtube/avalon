#!/bin/bash

# Ports configuration
#export HTTP_PORT=3001
#export P2P_PORT=6001

# MongoDB configuration
#export DB_NAME=avalon
#export DB_URL=mongodb://localhost:27017

# Peering configuration
#export OFFLINE=1
export NO_DISCOVERY=1
#export DISCOVERY_EXCLUDE=dtube

# Enable more modules
#export NOTIFICATIONS=1
export RANKINGS=1

# Cache warmup option
export WARMUP_ACCOUNTS=100000
export WARMUP_CONTENTS=0

# Warn when a transactions takes more than X ms
export WARN_SLOW_VALID=5
export WARN_SLOW_EXEC=5

# trace / perf / econ / cons / debug / info / warn
export LOG_LEVEL=cons

# groups blocks during replay output to lower screen spam
export REPLAY_OUTPUT=1

# default peers to connect with on startup
export PEERS=ws://34.65.228.228:6001
#ws://34.65.228.228:6001
#ws://35.200.80.95:6001
#ws://35.203.60.208:6001
export MAX_PEERS=20

# your user and keys (only useful for active node owners)
export NODE_OWNER=heimindanger
export NODE_OWNER_PUB=2BvCHjL8rS8jiCSkzRmiKm8A3sikkvUENNp7X7mkm32TN
export NODE_OWNER_PRIV=FW1mRZ9XDw6zTLsj33bRDLiMakCF6WfXq2BLHVNjDpBZ

node --stack-size=65500 src/main
