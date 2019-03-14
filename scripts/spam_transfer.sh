#!/usr/bin/env bash
if [ $1="" ]
then echo "./spam_transfer.sh account1 priv1 account2 priv2"
exit
fi
$1=acc1
$2=priv1
$3=acc2
$4=priv2

while true
do node ./src/cli.js transfer $priv1 $acc1 $acc2 1 &
node ./src/cli.js transfer $priv2 $acc2 $acc1 1 &
done
