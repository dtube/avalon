#!/bin/bash

#Defaults
acc_Req=5
acc_Made=0
acc_Def_Name="miner"
PRIVATE_KEY=34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5

#Array Declaration
acc_Name=()
acc_Pub=()
acc_Priv=()

#Parse flags
while test $# -gt 0; do
        case "$1" in
                -h|--help)
                        echo "options:"
                        echo "-h, --help                Show this message"
                        echo "-a,      Specify the number of accounts to make"
                        echo "-n,      Set the Default name of the accounts"
                        exit 0
                        ;;
                -a)
                        shift
                        if test $# -gt 0; then
                                export acc_Req=$1
                        fi
                        shift
                        ;;
                -n)
                        shift
                        if test $# -gt 0; then
                                export acc_Def_Name=$1
                        fi
                        shift
                        ;;
        esac
done


while [ $acc_Made != $acc_Req ]
do
  #We need to do this to make JQ happy
  cmd=$(node ./src/cli.js keypair|sed s/\ pub:/\"pub\":/g|sed s/priv:/\"priv\":/g|sed s/' }'/'}'/g|tr -d '\n'|tr -d ' '|sed s/\'/\"/g)

  #Load up the arrays with our values
  acc_Made=$(($acc_Made+1))
  acc_Pub+=($(echo $cmd|jq -r .pub))
  acc_Priv+=($(echo $cmd|jq -r .priv))
  acc_Name+=($(echo $acc_Def_Name$acc_Made))
  echo "${acc_Name[$acc_Made-1]}: Pub: ${acc_Pub[$acc_Made-1]} Priv: ${acc_Priv[$acc_Made-1]}"
done
# create accounts
name=0
for key in "${acc_Pub[@]}"
do node src/cli.js createAccount $PRIVATE_KEY master $key ${acc_Name[name]}
name=$name+1
done


sleep 5

# send some tokens
for name in "${acc_Name[@]}"
do node src/cli.js transfer $PRIVATE_KEY master $name 10000
done

sleep 15

# display nodes ip and port in profile
node src/cli.js profile $PRIVATE_KEY master '{"node":{"ws":"ws://127.0.0.1:6001"}}'
name=0
for key in "${acc_Priv[@]}"
do port=$(($name+6002))
node src/cli.js profile $key ${acc_Name[name]} '{"node":{"ws":"ws://127.0.0.1:'$port'"}}'
name=$(($name+1))
done

# everyone votes for itself
name=0
for key in "${acc_Priv[@]}"
do node src/cli.js approveNode ${acc_Priv[name]} ${acc_Name[name]} ${acc_Name[name]}
name=$(($name+1))
done
