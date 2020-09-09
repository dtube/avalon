#!/bin/bash

## Example script to create multiple accounts and transfer 1000 tokens quickly

# create accounts
node src/cli.js account sXHqzsMDENCVUCXuY8KL52afpFWzeeVRaPaD44rV5ZQX miner1 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5
node src/cli.js account tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g miner2 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5
node src/cli.js account d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce miner3 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

sleep 3

node src/cli.js transfer miner1 100000000 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5
node src/cli.js transfer miner2 100000000 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5
node src/cli.js transfer miner3 100000000 -M dtube -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

sleep 15

node src/cli.js vote-leader miner1 -M miner1 -K 8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS
node src/cli.js vote-leader miner2 -M miner2 -K GhjBE9hvQcLhBicFdSB1ZmSnLmAN3vD2mjjNoQKxEuSc
node src/cli.js vote-leader miner3 -M miner3 -K 7vMKdxKCYTyzayaeiDirTgRhPwnFumzgh2TebT58EFKw

sleep 15

node src/cli.js enable-node sXHqzsMDENCVUCXuY8KL52afpFWzeeVRaPaD44rV5ZQX -M miner1 -K 8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS
node src/cli.js enable-node tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g -M miner2 -K GhjBE9hvQcLhBicFdSB1ZmSnLmAN3vD2mjjNoQKxEuSc
node src/cli.js enable-node d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce -M miner3 -K 7vMKdxKCYTyzayaeiDirTgRhPwnFumzgh2TebT58EFKw
