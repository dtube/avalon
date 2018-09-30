#!/bin/bash

# create accounts
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":0,"data":{"name":"miner1", "pub":"sXHqzsMDENCVUCXuY8KL52afpFWzeeVRaPaD44rV5ZQX"}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":0,"data":{"name":"miner2", "pub":"tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g"}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":0,"data":{"name":"miner3", "pub":"d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce"}}') http://localhost:3001/transact
curl http://localhost:3001/mineBlock
sleep 3

# give them a bit of money
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":3,"data":{"receiver":"miner1", "amount":1000}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":3,"data":{"receiver":"miner2", "amount":1000}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":3,"data":{"receiver":"miner3", "amount":1000}}') http://localhost:3001/transact
curl http://localhost:3001/mineBlock
sleep 3

# approve them as node owners
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":1,"data":{"target":"miner1"}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":1,"data":{"target":"miner2"}}') http://localhost:3001/transact
curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":1,"data":{"target":"miner3"}}') http://localhost:3001/transact
curl http://localhost:3001/mineBlock