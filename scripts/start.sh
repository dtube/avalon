#!/bin/bash

# Ports configuration
#export HTTP_PORT=3001
#export P2P_PORT=6001
#export HTTP_HOST=0.0.0.0
#export P2P_HOST=0.0.0.0

# MongoDB configuration
#export DB_NAME=avalon
#export DB_URL=mongodb://localhost:27017

# Directory to folder containing blocks.bson file
#export BLOCKS_DIR=

# Peering configuration
#export OFFLINE=1
#export NO_DISCOVERY=1
#export DISCOVERY_EXCLUDE=dtube

# Enable more modules
#export NOTIFICATIONS=1
#export RANKINGS=1
#export CONTENTS=1
#export LEADER_STATS=1
#export TX_HISTORY=1
#export PLAYLIST_JSON=1

# Cache warmup option
export WARMUP_ACCOUNTS=100000
export WARMUP_CONTENTS=0

# Warn when a transactions takes more than X ms
export WARN_SLOW_VALID=5
export WARN_SLOW_EXEC=5

# trace / perf / econ / cons / debug / info / warn
export LOG_LEVEL=info

# groups blocks during replay output to lower screen spam
export REPLAY_OUTPUT=10000

# Rebuild chain state from dump, verifying every block and transactions
# Do not forget to comment this out after rebuild
#export REBUILD_STATE=1
#export REBUILD_WRITE_INTERVAL=10000
#export REBUILD_NO_VALIDATE=1

# default peers to connect with on startup
export PEERS=
export MAX_PEERS=20

# your user and keys (only useful for active node owners)
export NODE_OWNER=dtube
export NODE_OWNER_PUB=dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz
export NODE_OWNER_PRIV=34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

# Memory limit for in-memory rebuild (in MB)
export NODE_OPTIONS=--max_old_space_size=8192

node --stack-size=65500 src/main
