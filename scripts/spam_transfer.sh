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
times=$6

i=0

while [ $i -lt $times ]
do API_PORT=3002 API_IP=saver1.d.tube API_PROTOCOL=http node ./src/cli.js transfer $priv1 $acc1 $acc2 1 &
API_PORT=3002 API_IP=saver1.d.tube API_PROTOCOL=http node ./src/cli.js transfer $priv2 $acc2 $acc1 1 &
sleep $sleep
i=$(($i+1))
done
