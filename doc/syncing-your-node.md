# Sync your Avalon node

Once your avalon node and dependencies are setup correctly, if you run it with `./scripts/start.sh`, it will start a new developement chain. Instead, you probably want to sync your node to the mainnet.

First, we need to download the genesis block (block #0) and save it as `./genesis/genesis.zip`:
```bash
mkdir genesis
cd genesis
wget https://backup.d.tube/genesis.zip
cd ..
```

To do so, you have multiple options:

## 1- Natural replay
This is the easiest method. Just start the node with `./scripts/start.sh` and you should see your node unzipping the genesis data, and then starting to download blocks from the peers. This method can be very slow, and probably not scalable in the long term.

## 2- Replay from zipped blocks
This is the fastest method that reverifies locally all the past blocks and transactions, and therefore the current blockchain state. You need to download a blocks.zip file into `./dump/blocks.zip`:
```bash
mkdir dump
cd dump
wget https://backup.d.tube/blocks.zip
cd ..
./scripts/start.sh
```
## 3- Replay from database snapshot
This is the fastest method (takes <5 mins). You will download the latest hourly snapshot and import the data in your node, without any verification.

```bash
mkdir dump
cd dump
wget https://backup.d.tube/$(date +%H).tar.gz
tar xfvz ./*
mongorestore -d avalon ./
cd ..
rm -rf ./dump
./scripts/start.sh
```

## Warning: Don't forget to wipe the MongoDB data before doing a replay
Unless this is a brand new node install, your avalon database will probably contain data if you want to replay. You will need to wipe it before starting a replay.

You can wipe the mongodb by doing `mongo avalon` (assuming you are using the default 'avalon' db name) and then `db.dropDatabase()` once inside the mongo cli tool.
