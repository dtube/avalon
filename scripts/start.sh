#!/bin/bash

#export HTTP_PORT=3001
#export P2P_PORT=6001
#export DB_NAME=avalon
#export DB_URL=mongodb://localhost:27017
export LOG_LEVEL=debug
export PEERS=ws://api.avalon.wtf:6001,ws://avalon.nannal.com:6001,ws://82.66.109.22:6001
export NODE_OWNER=<your_username>
export NODE_OWNER_PUB=<your_public_key>
export NODE_OWNER_PRIV=<your_private_key>
npm start
