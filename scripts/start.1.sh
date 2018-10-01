#!/bin/bash

export HTTP_PORT=3002
export P2P_PORT=6002
export DB_NAME=avalon2
#DB_URL=mongodb://localhost:27017
export PEERS=ws://localhost:6001
export NODE_OWNER=miner1
export NODE_OWNER_PUB=sXHqzsMDENCVUCXuY8KL52afpFWzeeVRaPaD44rV5ZQX
export NODE_OWNER_PRIV=8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS
npm start
