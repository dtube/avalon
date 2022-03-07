# AVALON

## Get a node running

#### Dependencies
* [MongoDB](https://mongodb.com)
* [NodeJS](https://nodejs.org/en/download/) **v14/16** (LTS)
* [ntpd](https://linux.die.net/man/8/ntpd) or any NTP alternative for your system. ntpd comes pre-installed on most linux distributions

## Install and run an Avalon node for Linux
* `npm install` to install nodejs dependencies
* `chmod +x scripts/start.sh`
* `./scripts/start.sh`

### Environment Variables
The `start.sh` shows the list of available environment variables you can set to make avalon behave slightly differently from the default install.

## Install and run an Avalon node for Windows
* `npm install` to install nodejs dependencies
* Get your own keys with `node src/cli.js keypair`
* Save your keys
* Add your keys to `scripts/start.bat`
* Define the path to your directory in `scripts/start.bat`
* Run `scripts/start.bat`
* Note: to restore a genesis.zip file you may need to download the [mongo databasetools](https://www.mongodb.com/try/download/database-tools?tck=docs_databasetools) and put the mongorestore.exe binary into your main directory.


## [Syncing your node](./doc/syncing-your-node.md)
## [Become a leader and produce blocks](./doc/leader-101.md)
## [Debian 10 quick install procedure](./doc/debian-10.md)

## Get helped
We have a discord channel dedicated to node owners (aka leaders), where you can get support to get set up. Join [discorg.gg/dtube](https://discord.gg/dtube) and go to `DTube Chain -> #leader-candidates`

## Using Avalon
Once you have a node running, there are many ways to interact with Avalon:

### With the CLI tool
You can use the CLI tool to transact with Avalon. Simply try `node src/cli --help` or `node src/cli <command> --help` for a full help.

### Using Javalon
[Javalon](https://www.npmjs.com/package/javalon) is the javascript wrapper for Avalon's API. Working on both browser and nodejs.

### HTTP API
Avalon's API uses 100% JSON. The GET calls will allow you to fetch the public information which is already available through the d.tube UI.

Examples:
* Account data: /account/:username, i.e https://avalon.d.tube/account/rt-international
* Video data: /content/:username/:link i.e. https://avalon.d.tube/content/rongibsonchannel/QmdjVMdeTtTEy1CJTDbtjuaiRKMP6H364Dv4n7FsWGpnPH

### Full list of API endpoints
[https://docs.google.com/spreadsheets/d/1ORoHjrdq5V5OkTChijTUOEYRzTujVXTzCyNYt-ysVhw/edit?usp=drive_web&ouid=109732502499946497195](https://docs.google.com/spreadsheets/d/1ORoHjrdq5V5OkTChijTUOEYRzTujVXTzCyNYt-ysVhw/edit?usp=drive_web&ouid=109732502499946497195)

This lists all the available API endpoints for Avalon. We also have recommended security practises if you want to open your node's API to the world. You can do it easily with nginx and [avalon-nginx-config](https://github.com/dtube/avalon-nginx-config).

### Sending Transactions to the network (POST /transact)
Once you have an account and balance (if you don't, you can create one on [https://signup.d.tube](https://signup.d.tube), your account will start generating bandwidth and voting power (respectively the bw and vt fields in your account data). You can consume those resources by transacting.

Every transaction will have a bandwidth cost, calculated based on the number of bytes required for the storage of your transaction inside a block.
Certain transaction types will require you to spend voting power, such as publishing a content, voting or tagging a content.

To transact, you need to use the /transact POST call of the Avalon API. All the examples here are for the CLI tool, but the same can be achieved with [Javalon](https://npmjs.org/javalon) in Javascript.

Necessary for all transactions:
* *key*: your private key
* * Use -K MyKeyHere to use a plain-text key
* * Or use -F file.json to use a key inside a file to sign (this will prevent your key from showing on the screen too much)
* *user*: your username

#### Vote for a leader
* *target*: the node owner to approve
```
node src/cli.js vote-leader -K <key> -M <user> <target>

// alice votes for bob as a leader
node src/cli.js vote-leader -K 5DPwDJqTvMuykHimmZxThfKttPSNLzJjpbNtkGNnjPAf -M alice bob
```

#### Unvote a leader
* *target*: the node owner to approve
```
node src/cli.js vote-leader -K <key> -M <user> <target>

// charlie does not want to vote for daniel as a leader anymore
node src/cli.js unvote-leader -F charlie_key.txt -M charlie daniel
```

#### Transfer tokens
* *receiver*: username of the receiver of the transfer
* *amount*: number of tokens to transfer to the receiver. Warning! 1 DTC in UI = 100 tokens
* *memo*: arbitrary short text content
```
node src/cli.js transfer -K <bob_key> -M <user> <receiver> <amount> <memo>
// bob sends 50 DTC to charles
node src/cli.js transfer -K HkUbQ5YpejWVSPt8Qgz8pkPGwkDrMn3XECd4Asn3ANB3 -M bob charles 50 'thank you'
```

#### Add a post / Commenting
* *link*: a short string to be used as the index of the content
* *parent_author*: the username of the author of the parent post
* *parent_link*: the link of the parent post
* *json*: arbitrary json input. example: `{"string":"aye", array:[1,2,3]}`
* *tag*: arbitrary short text content
* *weight* : the number of vote tokens to spend on this vote
```
node src/cli.js comment -K <key> -M <user> <link> <parent_author> <parent_link> <json>
```

#### Vote a post
* *link*: the link of the post to vote on
* *author*: the username of the author to vote on
* *weight*: the number of vote tokens to spend on this vote
* *tag*: arbitrary short text content
```
node src/cli.js vote -K <key> -M <user> <link> <author> <weight> <tag>
```

#### Edit your user json object
* *json*: arbitrary json input. example: `{"string":"aye", array:[1,2,3]}`
```
node src/cli.js profile -K <key> -M <user> <json>
```

#### Follow a user
* *target*: the user to follow
```
node src/cli.js follow -K <key> -M <user> <target>
```

#### Unfollow a user
* *target*: the user to unfollow
```
node src/cli.js unfollow -K <key> -M <user> <target>
```

#### Signing a raw transaction

To create a transaction and export it to a file, you can use the `sign` CLI tool
```
node src/cli.js sign <priv_key> <user> <tx> > tmptx.json
```
For example to approve a node owner and publishing it only 5 seconds later:
```
node src/cli.js sign -K 4L1C3553KRETK3Y -M alice '{"type":1,"data":{"target":"miner1"}}' > tmptx.json
sleep 5
curl -H "Content-type:application/json" --data @tmptx.json http://localhost:3001/transact
```

### Other POST Calls

#### Mine Block
Will force the node to try to produce a block even if it's unscheduled. Useful for block #1 and working on development
```
curl  http://localhost:3001/mineBlock
``` 

#### Add peer
Manually force connection to a peer without having to restart the node
```
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3001/addPeer
```

### Data storage

### MongoDB
Avalon saves the state of the chain into mongodb after each block. You can easily query mongodb directly to get any data you want, that wouldn't be provided by the API itself.
```
mongo <db_name>
db.accounts.findOne({name:'master'})
db.blocks.findOne({_id: 0})
```
However be sure not to write to any collection used by avalon in this database (namely the accounts, blocks and contents). If you do, your node will irremediably fork sooner or later.

### Elastic Search
Avalon can also copy the accounts and contents into an elastic search database with [monstache](https://github.com/rwynn/monstache). A configuration file for monstache is provided in the root of this repository. Once running you can do text queries on accounts or contents like so: 

```
# search contents
curl http://localhost:9200/avalon.contents/_search?q=football
# search accounts
curl http://localhost:9200/avalon.accounts/_search?q=satoshi
```
Please refer to Elastic Search documentation for more complex queries.

D.Tube runs a public Elastic Search mirror of the current testnet on https://search.d.tube
