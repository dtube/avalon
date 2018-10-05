# AVALON Blockchain

## Quick start
* Install MongoDB and run it on your machine
* `npm install`
* Get your own keys with `node src/cli.js keypair`
* Save your keys
* Add your keys to `start.sh`
* `chmod +x start.sh`
* `./start.sh`

## GET API

#### Get block
```
curl http://localhost:3001/block/<block_num>
```

#### Get block count
```
curl http://localhost:3001/count
```

#### Get a new random key pair
```
curl http://localhost:3001/newKeyPair
```

#### Get connected peers
```
curl http://localhost:3001/peers
```

#### Get miner schedule
```
curl http://localhost:3001/schedule
```

## POST API

#### Add a transaction to the pool
First create a valid transaction from cli and put it into a json file
```
node src/cli.js sign <priv_key> <user> <tx> > tmptx.json
```

Then send the json to the node

```
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

Or all-in-one example:
```
curl -H "Content-type:application/json" --data $(node src/cli.js sign <key> <user> '{"type":3,"data":{"receiver": "miner1", "amount":55}}') http://localhost:3001/transact
```

#### Approve a node owner
```
node src/cli.js sign <key> <user> '{"type":1,"data":{"target":"miner1"}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Disapprove a node owner
```
node src/cli.js sign <key> <user> '{"type":2,"data":{"target":"miner1"}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Transfer tokens
```
node src/cli.js sign <key> <user> <user> '{"type":3,"data":{"receiver":"bob", "amount":420}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Add a post
```
node src/cli.js sign <key> <user> '{"type":4,"data":{"link":"hello-world", "pa":"", "pp":"","json":{"whatever": "you want", "ok": [1,2,3]}}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Vote a post
```
node src/cli.js sign <key> <user> '{"type":5,"data":{"link":"hello-world", "author":"master", "vt": 100}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Edit your user json object
```
node src/cli.js sign <key> <user> '{"type":6,"data":{"json":{"profile":{"profile_image":"https://openclipart.org/image/300px/svg_to_png/215819/Linux-Avatar.png"}}}}' > tmptx.json
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

#### Try to mine a block (will fail if you cant)
```
curl  http://localhost:3001/mineBlock
``` 

#### Add peer
```
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3001/addPeer
```

## Using MongoDB to grab any data
```
mongo <db_name>
db.accounts.findOne({name:'master'})
db.blocks.findOne({_id: 0})
```

## Reset the chain
Shut everything down, then `db.dropDatabase()` in mongo, and restart
