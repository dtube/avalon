1- Took the data off the testnet on 30/09/2020 around 1PM

2- Set every account to 0 DTC
```
db.accounts.update({}, {$set: {balance: 0}}, {multi: true})
```

3- Wipe node_appr and leader votes
```
db.accounts.update({}, {$set: {node_appr: 0}}, {multi: true})
db.accounts.update({}, {$set: {approves: []}}, {multi: true})
```

4- Wipe content votes and distributed amounts
```
db.contents.update({}, {$set: {dist: 0}}, {multi: true})
db.contents.update({}, {$set: {votes: []}}, {multi: true})
```

5- Give 3M DTC to @dtube and make it a leader
```
db.accounts.update({name: 'dtube'}, {$set: {balance: 300000000}})
db.accounts.update({name: 'dtube'}, {$set: {node_appr: 300000000}})
db.accounts.update({name: 'dtube'}, {$set: {approves: ["dtube"]}})
```

6- Distribute investors funds - used scripts/investorsDist.js

7- Added reserved usernames - used scripts/reservedNames.js

8- Modified public keys for special new accounts, and lost keys during testnet - used scripts/updateKeys.js

9- Deleting some mistake videos during testnet
```
db.contents.remove({_id: 'techcoderx/missblockalert1'})
db.contents.remove({_id: 'techcoderx/QmedMWg9BAicneQQax7LouQpUsMGGiBJkke6bPACnVFB95'})
db.contents.remove({_id: 'techcoderx/QmccVLpuq2bwNvHFM2yNnYGa1A4KPGnvueohWxnmJ8m9Sg'})
```

10- Wipe BW and VP for everyone
```
db.accounts.update({}, {$set: {bw: {v:0, t:1601477849000}}}, {multi: true})
db.accounts.update({}, {$set: {vt: {v:0, t:1601477849000}}}, {multi: true})
```