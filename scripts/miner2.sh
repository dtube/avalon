#!/bin/bash
# Ports configuration
export HTTP_PORT=3003
export P2P_PORT=6003

# MongoDB configuration
export DB_NAME=avalon3
export DB_URL=mongodb://localhost:27017

# Peering configuration
#export OFFLINE=1
export NO_DISCOVERY=1
#export DISCOVERY_EXCLUDE=dtube

# Enable more modules
#export NOTIFICATIONS=1
#export RANKINGS=1

# Cache warmup option
export WARMUP_ACCOUNTS=100000
export WARMUP_CONTENTS=0

# Warn when a transactions takes more than X ms
export WARN_SLOW_VALID=5
export WARN_SLOW_EXEC=5

# trace / perf / econ / cons / debug / info / warn
export LOG_LEVEL=debug

# groups blocks during replay output to lower screen spam
export REPLAY_OUTPUT=1

# default peers to connect with on startup
export PEERS=ws://127.0.0.1:6001
export MAX_PEERS=20

export NODE_OWNER=miner2
export NODE_OWNER_PUB=tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g
export NODE_OWNER_PRIV=GhjBE9hvQcLhBicFdSB1ZmSnLmAN3vD2mjjNoQKxEuSc
npm start
