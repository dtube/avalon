#!/usr/bin/env bash
PRIVATE_KEY=$1
acc_Name=()
acc_Pub=()

# Get acc names
mongo avalon --eval "db.accounts.find({},{_id: 0,name: 1, pub:1}).pretty()"|grep name|cut -f 4 -d '"' >> /tmp/name.txt

# Get acc names
mongo avalon --eval "db.accounts.find({},{_id: 0,name: 1, pub:1}).pretty()"|sed s/','/\\n","/g|grep pub|cut -f 4 -d '"' >> /tmp/pub.txt

# Data extracted from old DB, sleep here so new DB can be setup?
read

while read name
  do acc_Name+=($name)
done < /tmp/name.txt

while read pub
  do acc_Pub+=($pub)
done < /tmp/pub.txt

# Make new accounts

name=0
for key in "${acc_Pub[@]}"
do node src/cli.js createAccount $PRIVATE_KEY master $key ${acc_Name[name]}
name=$name+1
done
