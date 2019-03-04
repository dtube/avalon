#!/bin/bash
PRIVATE_KEY=34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

# create accounts
node src/cli.js createAccount $PRIVATE_KEY master sXHqzsMDENCVUCXuY8KL52afpFWzeeVRaPaD44rV5ZQX miner1
node src/cli.js createAccount $PRIVATE_KEY master tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g miner2
node src/cli.js createAccount $PRIVATE_KEY master d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce miner3

sleep 6

# send some tokens
node src/cli.js transfer $PRIVATE_KEY master miner1 10000
node src/cli.js transfer $PRIVATE_KEY master miner2 10000
node src/cli.js transfer $PRIVATE_KEY master miner3 10000

sleep 15

# display nodes ip and port in profile
node src/cli.js profile $PRIVATE_KEY master '{"node":{"ws":"ws://127.0.0.1:6001"}}'
node src/cli.js profile 8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS miner1 '{"node":{"ws":"ws://127.0.0.1:6002"}}'
node src/cli.js profile GhjBE9hvQcLhBicFdSB1ZmSnLmAN3vD2mjjNoQKxEuSc miner2 '{"node":{"ws":"ws://127.0.0.1:6003"}}'
node src/cli.js profile 7vMKdxKCYTyzayaeiDirTgRhPwnFumzgh2TebT58EFKw miner3 '{"node":{"ws":"ws://127.0.0.1:6004"}}'

# everyone votes for itself
node src/cli.js approveNode 8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS miner1 miner1
node src/cli.js approveNode GhjBE9hvQcLhBicFdSB1ZmSnLmAN3vD2mjjNoQKxEuSc miner2 miner2
node src/cli.js approveNode 7vMKdxKCYTyzayaeiDirTgRhPwnFumzgh2TebT58EFKw miner3 miner3
