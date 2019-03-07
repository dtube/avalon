#!/bin/bash
export LOG_LEVEL=debug
## Example of a secondary node on the same machine, just a different database and two different ports

export HTTP_PORT=3005
export P2P_PORT=6005
export DB_NAME=avalon5
#DB_URL=mongodb://localhost:27017
export PEERS=ws://127.0.0.1:6001
export NODE_OWNER=miner4
export NODE_OWNER_PUB=wyPSnqfmAKoz5gAWyPcND7Rot6es2aFgcDGDTYB89b4q
export NODE_OWNER_PRIV=5Tniq3ri837wbfHEpTfzKo2dv4wWphCKXawqGS7hwc2y
npm start
