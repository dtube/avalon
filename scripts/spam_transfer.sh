curl -H "Content-type:application/json" --data $(node src/cli.js sign 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5 master '{"type":3,"data":{"receiver":"miner1", "amount":1000}}') http://localhost:3001/transact
curl http://localhost:3001/mineBlock
sleep 3
curl -H "Content-type:application/json" --data $(node src/cli.js sign 8cxx3Ly7xkDAghFnZRqM8Wi1xhwM8CBCkaAPL6NMgCRS miner1 '{"type":3,"data":{"receiver":"master", "amount":999}}') http://localhost:3001/transact
curl http://localhost:3001/mineBlock
sleep 3