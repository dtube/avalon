# Avalon Leader 101

## Enabling your node for block production

If you want to start producing blocks on avalon, your account will need to define a leader key. Generate one into a file with `node src/cli key > leader-key.json`

Secondly, you will need to enter your username, public leader key, and private leader key at the bottom of the `scripts/start.sh` file, and restart your node.

Finally, you will need to associate your public leader key with your account by using the on-chain transaction.
```bash
node src/cli enable-node YOUR_LEADER_PUB_KEY -M YOUR_USERNAME -K YOUR_KEY
```
This transaction must be signed with your master key, or a custom key that allows this transaction. Once this step is done, you can head to the [leader election page](https://d.tube/#!/election) and vote yourself. If your leader key is properly associated to your account, you should see yourself uncrossed.

Once enough votes for your account come in, and you reach the top leaders, your node will start regularly mining blocks.

## Auto-peer discovery
Avalon has a peer-discovery mechanism turned on by default. Elected leaders can declare a **public node** IP in their JSON profile, which will create a lot of incoming peers for this node.

```bash
node src/cli.js profile -K <key> -M <user> '{"node":{"ws":"ws://yourip:yourport"}}'
```

Make sure to have `MAX_PEERS` set to a high number (50+ recommended). The network needs a few of those public nodes, but it is strongly discouraged to produce blocks from a publicly declared node IP.

## Do a video to announce your leader node
You will need to get a lot of votes from the stake holders in order to produce blocks. A good idea for new leaders is to create a video to explain who they are, and why they run an Avalon node, and why they want to be elected. Most of the elected leaders have went through this process, and it's an easy way to gather organic votes at the beggining.
