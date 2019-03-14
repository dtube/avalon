#!/usr/bin/env bash
if [ -z $1 ]
then echo "./spam_transfer.sh account1 priv1 account2 priv2 sleep"
echo $1
exit
fi
acc1=$1
priv1=$2
acc2=$3
priv2=$4
sleep=$5

while true
do node ./src/cli.js transfer $priv1 $acc1 $acc2 1 &
node ./src/cli.js transfer $priv2 $acc2 $acc1 1 &
sleep $sleep
done
