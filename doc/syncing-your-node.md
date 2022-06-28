# Sync your Avalon node

Once your avalon node and dependencies are setup correctly, if you run it with `./scripts/start.sh`, it will start a new developement chain. Instead, you probably want to sync your node to the mainnet.

First, we need to download the genesis block (block #0) and save it as `./genesis/genesis.zip`:
```bash
mkdir genesis
cd genesis
wget https://backup.d.tube/genesis.zip
cd ..
```

Secondly, you will need to add some default peers to use to connect to the network.
Near the bottom of the `scripts/start.sh` script:
```bash
export PEERS=ws://34.65.228.228:6001,ws://dseed.techcoderx.com:6001
export MAX_PEERS=50
```
If you need a bigger peer list, come to our [discord server](https://discord.gg/dtube) and look at the pinned messages of the #leader-candidates channel.

You would also need to specify the path to the folder containing `blocks.bson` file in `BLOCKS_DIR`, which is a read and append only file that stores all blocks.

```bash
export BLOCKS_DIR=/path/to/blocks/dir
```

Then finally you want to start replaying the blocks. Unless this is a brand new node install, your avalon database will probably contain data. You will need to wipe it before starting a replay.

You can wipe the mongodb by doing `mongosh avalon --eval "db.dropDatabase()"` (assuming you are using the default 'avalon' db name).

Finally, to replay the blocks and transactions, you have 3 options:

## 1. Natural replay
This is the easiest method. Just start the node with `./scripts/start.sh` and you should see your node unzipping the genesis data, and then starting to download blocks from the peers. This method can be very slow, and probably not scalable in the long term.

## 2. Rebuild from blocks BSON
This is the fastest method that reverifies locally all the past blocks and transactions, and therefore the current blockchain state. You will need to download the `blocks.bson` file into the folder specified in `BLOCKS_DIR` env var.

```bash
cd /path/to/blocks/dir
wget -c https://backup.d.tube/blocks.bson
cd /path/to/avalon/directory
REBUILD_STATE=1 ./scripts/start.sh
```

A file named `blocks.index` will be constructed (if not already exists) which stores the pointers to each block in `blocks.bson`. This may take a few minutes.

To speed up the rebuild process further, you may opt to skip block validations with `REBUILD_NO_VALIDATE=1` env var.

## 3. Replay from database snapshot
This is the fastest method (takes <5 mins). You will download the latest hourly snapshot and import the data in your node, without any verification.

```bash
mkdir dump
cd dump
wget https://backup.d.tube/$(date -u +%H).tar.gz
tar xfvz ./*
mongorestore -d avalon ./
cd ..
rm -rf ./dump
./scripts/start.sh
```

## Creating your own dumps for quick replays
Alternatively, if you do not want to have to trust our backups (coming from d.tube domain), you can create your own:

First, shut-down your node to avoid any new incoming data contaminating your backup. Then just run:
```
mongodump -d avalon -o ~/avalon-backup/
```
And restart your node
