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

#### Get a new random key pair
```
curl http://localhost:3001/newKeyPair
```

#### Get new contents
```
curl http://localhost:3001/new
```

#### Get an account
```
curl http://localhost:3001/account/<name>
```

#### Get connected peers
```
curl http://localhost:3001/peers
```

#### Get miner schedule
```
curl http://localhost:3001/schedule
```

#### Get block count
```
curl http://localhost:3001/count
```

## Transacting
Once you have an account and balance, your account will start generating bandwidth and vote tokens which you can consume by transacting.

Necessary for all transactions:
* *key*: your private key
* *user*: your username

#### Approve a node owner
* *target*: the node owner to approve
```
node src/cli.js approveNode <key> <user> <target>
```

#### Disapprove a node owner
* *target*: the node owner to approve
```
node src/cli.js disapproveNode <key> <user> <target>
```

#### Transfer tokens
* *receiver*: username of the receiver of the transfer
* *amount*: number of tokens to transfer to the receiver
```
node src/cli.js transfer <key> <user> <receiver> <amount>
```

#### Add a post
* *link*: a short string to be used as the index of the content
* *json*: arbitrary json input. example: `{"string":"aye", array:[1,2,3]}`
```
node src/cli.js post <key> <user> <link> <json>
```

#### Comment on a post
* *link*: a short string to be used as the index of the content
* *parent_author*: the username of the author of the parent post
* *parent_link*: the link of the parent post
* *json*: arbitrary json input. example: `{"string":"aye", array:[1,2,3]}`
```
node src/cli.js comment <key> <user> <link> <parent_author> <parent_link> <json>
```

#### Vote a post
* *link*: the link of the post to vote on
* *author*: the username of the author to vote on
* *weight*: the number of vote tokens to spend on this vote
```
node src/cli.js vote <key> <user> <link> <author> <weight>
```

#### Edit your user json object
* *json*: arbitrary json input. example: `{"string":"aye", array:[1,2,3]}`
```
node src/cli.js profile <key> <user> <json>
```

#### Signing a raw transaction

To create a transaction and export it to a file, you can use the `sign` CLI tool
```
node src/cli.js sign <priv_key> <user> <tx> > tmptx.json
```
For example to approve a node owner and publishing it only 5 seconds later:
```
node src/cli.js sign 4L1C3553KRETK3Y alice '{"type":1,"data":{"target":"miner1"}}' > tmptx.json
sleep 5
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

## POST Calls

#### Mine Block
Will force the node to try to produce a block even if it's unscheduled. Useful for block #1.
```
curl  http://localhost:3001/mineBlock
``` 

#### Add peer
Manually force connection to a peer
```
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3001/addPeer
```

## Using MongoDB to grab any data
```
mongo <db_name>
db.accounts.findOne({name:'master'})
db.blocks.findOne({_id: 0})
```

## Resetting and replaying the chain
Shut everything down, then `db.dropDatabase()` in mongo, and restart
