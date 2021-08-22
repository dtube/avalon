#!/bin/bash
mkdir genesis
cd genesis
wget -c https://backup.d.tube/genesis.zip
cd ..
mkdir dump
cd dump
wget https://backup.d.tube/$(date -u +%H).tar.gz
tar xfvz ./*
mongo avalon --eval "printjson(db.dropDatabase())"
mongorestore -d avalon ./
cd ..
rm -rf ./dump
echo "DONE! You're now free to run: ./scripts/start.sh"
