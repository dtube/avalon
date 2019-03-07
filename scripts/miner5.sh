#!/bin/bash
export LOG_LEVEL=debug
## Example of a secondary node on the same machine, just a different database and two different ports

export HTTP_PORT=3006
export P2P_PORT=6006
export DB_NAME=avalon6
#DB_URL=mongodb://localhost:27017
export PEERS=ws://127.0.0.1:6001
export NODE_OWNER=miner5
export NODE_OWNER_PUB=gM8kW2cvMRuv8yaGtoQ6t6j1hxfyocqhsKHi2qP9mb1E
export NODE_OWNER_PRIV=6fa9qyazHv2dBcJ4YGeH3hiUKCj6UkrbRjV9xtM8Aeg6
npm start
