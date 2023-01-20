let config = require('./config.js').read(0)
const TransactionType = require('./transactions').Types
const cmds = require('./clicmds.js')
const program = require('commander')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const fetch = require('node-fetch-commonjs')
const fs = require('fs')
const defaultPort = 3001

program
    .version('0.2.0', '-V, --version')
    .description('a cli tool to forge transactions and broadcast to avalon')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'avalon api url')
    .option('-W, --wait', 'wait for transaction confirmation')
    .option('-S, --spam [delay_in_ms]', 'repeats the tx every delay')

program.command('account <pub_key> <new_user>')
    .description('create a new account')
    .action(function(pubKey, newUser) {
        verifyAndSendTx('createAccount', pubKey, newUser)
    }).on('--help', function(){
        writeLine('')
        writeLine('Extra Info:')
        writeLine('  Account creation will burn coins depending on the chain config')
        writeLine('  However, usernames matching public key are free (see second example)')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ account d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce cool-name -F key.json -M alice')
        writeLine('  $ account fR3e4CcvMRuv8yaGtoQ6t6j1hxfyocqhsKHi2qP9mb1E fr3e4ccvmruv8yagtoq6t6j1hxfyocqhskhi2qp9mb1e -F key.json -M alice')
    })

program.command('account-bw <pub_key> <new_user> <bw>')
    .description('create a new account with bandwidth from account creator')
    .action(function(pubKey, newUser, bw) {
        verifyAndSendTx('createAccountWithBw', pubKey, newUser, bw)
    }).on('--help', function(){
        writeLine('')
        writeLine('Extra Info:')
        writeLine('  Account creation will burn coins depending on the chain config')
        writeLine('  and will transfer <bw> bytes from the account creator to the new account.')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ account d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce cool-name 30000 -F key.json -M alice')
    })

program.command('account-authorize <user> <id> <allowed_txs> <weight>')
    .description('authorize an account auth with custom perms and weight to transact using their custom key id <id>')
    .action(function(user, id, allowedTxs, weight) {
        verifyAndSendTx('accountAuthorize', user, id, allowedTxs, weight)
    }).on('--help', function(){
        writeLine('')
        writeLine('Transaction Types:')
        for (const key in TransactionType)
            writeLine('  '+TransactionType[key]+': '+key)
        writeLine('')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ account-authorize bob posting [4,5,6,7,8] 1 -F key.json -M alice')
        writeLine('  $ account-authorize bob finance [3] 2 -F key.json -M alice')
    })

program.command('account-revoke <user> <id>')
    .description('revoke an account auth by their custom key id <id>')
    .action(function(user, id) {
        verifyAndSendTx('accountRevoke', user, id)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <user>: authorized username')        
        writeLine('  <id>: custom key id of the authorized user')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ account-revoke bob posting -F key.json -M alice')
        writeLine('  $ account-revoke bob finance -F key.json -M alice')
    })

program.command('chainupdate-create <title> <description> <url> <changes>')
    .description('create a new chain update proposal')
    .action(function(title, description, url, changes) {
        verifyAndSendTx('chainUpdateCreate', title, description, url, changes)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <title>: proposal title')
        writeLine('  <description>: proposal description')
        writeLine('  <url>: proposal reference url')
        writeLine('  <changes>: array of 2-element key-value arrays of proposed parameter changes')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ chainupdate-create \'An example chain update title\' \'Some description to describe it\' \'https://d.tube/#!/v/alice/chain-update-proposal\' [["vtPerBurn",100],["rewardPoolAmount",100000]] -F key.json -M alice')
    })

program.command('claim <author> <link>')
    .description('claims rewards associated with a past vote')
    .action(function(author, link) {
        verifyAndSendTx('claimReward', author, link)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <author>: the author of the voted content')        
        writeLine('  <link>: the link of the voted content')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ claim bob bobs-video -F key.json -M alice')
    })

program.command('comment <link> <pa> <pp> <json> <vt> <tag>')
    .description('publish a new JSON content')
    .action(function(link, pa, pp, json, vt, tag) {
        verifyAndSendTx('comment', link, pa, pp, json, vt, tag)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: an arbitrary string identifying your content')        
        writeLine('  <pa>: parent author (if you are replying to another comment)')
        writeLine('  <pp>: parent link (if you are replying to another comment)')
        writeLine('  <json>: a json object')
        writeLine('  <vt>: the amount of VT to spend on the forced vote')
        writeLine('  <tag>: the tag of the forced vote')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ comment root-comment \'\' \'\' \'{"body": "Hello World"}\' 777 my-tag -F key.json -M alice')
        writeLine('  $ comment reply-to-bob bobs-post bob \'{"body": "Hello Bob"}\' 1 my-tag -F key.json -M alice')
    })

program.command('comment-edit <link> <json>')
    .description('edit the JSON metadata of a content')
    .action(function(link, json) {
        verifyAndSendTx('commentEdit', link, json)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: content identifier')
        writeLine('  <json>: the edited json object')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ comment-edit root-comment \'{"body": "Hello World"}\' -F key.json -M alice')
        writeLine('  $ comment-edit reply-to-bob \'{"body": "Hello Bob"}\' -F key.json -M alice')
    })

program.command('enable-node <pub>')
    .description('enable a node for producing blocks')
    .action(function(pub) {
        verifyAndSendTx('enableNode', pub)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <pub>: the public key to use for producing blocks')
        writeLine('')
        writeLine('Important:')
        writeLine('  You need to do this if you want a node to start producing blocks')
        writeLine('  You want this key to be different from your master key for security reasons')
        writeLine('')
        writeLine('Tip:')
        writeLine('  Send an invalid <pub> to null your leader_key and disable a node')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ enable-node dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz -F key.json -M alice')
        writeLine('  $ enable-node "" -F key.json -M alice')
    })

program.command('follow <target>')
    .alias('subscribe')
    .description('start following another user')
    .action(function(target) {
        verifyAndSendTx('follow', target)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ follow bob -F key.json -M alice')
    })

program.command('fundrequest-create <title> <description> <url> <requested> <receiver>')
    .description('create a new funding request')
    .action(function(title, description, url, requested, receiver) {
        verifyAndSendTx('fundRequestCreate', title, description, url, requested, receiver)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <title>: proposal title')
        writeLine('  <description>: proposal description')
        writeLine('  <url>: proposal reference url')
        writeLine('  <requested>: requested amount for this fund request')
        writeLine('  <receiver>: beneficiary of the fund request')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ fundrequest-create \'An example proposal title\' \'Some description to describe it\' \'https://d.tube/#!/v/alice/proposal-video\' 10000 alice -F key.json -M alice')
    })

program.command('fundrequest-contrib <id> <amount>')
    .description('contribute to a funding request')
    .action(function(id, amount) {
        verifyAndSendTx('fundRequestContrib', id, amount)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: id of the fund request proposal')
        writeLine('  <amount>: amount to contribute')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ fundrequest-contrib 1 50000 -F key.json -M john')
    })

program.command('fundrequest-work <id> <work>')
    .description('submit work details to a fund request for review')
    .action(function(id, work) {
        verifyAndSendTx('fundRequestWork', id, work)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: id of the fund request proposal')
        writeLine('  <work>: json work details')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ fundrequest-work 1 \'{"work":"this is some work for a proposal, more details in a url."}\' -F key.json -M alice')
    })

program.command('fundrequest-work-review <id> <approve> <memo>')
    .alias('fundrequest-review')
    .description('submit review details of work related to fund request')
    .action(function(id, approve, memo) {
        verifyAndSendTx('fundRequestWorkReview', id, approve, memo)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: id of the fund request proposal')
        writeLine('  <approve>: boolean value to approve or disapprove work')
        writeLine('  <memo>: feedback for work done')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ fundrequest-work-review 1 true \'some feedback here\' -F key.json -M alice')
    })

program.command('keypair')
    .description('generate a new keypair')
    .alias('key')
    .option('-H, --has [text]', 'generated public key will contain the specified text')
    .action(function(options) {
        let has = (options.has || '')
        has = has.toLowerCase()
        let priv, pub, pub58
        do {
            priv = randomBytes(config.randomBytesLength)
            pub = secp256k1.publicKeyCreate(priv)
            pub58 = bs58.encode(pub)
        } while ((pub58.toLowerCase().indexOf(has) === -1) 
            || !secp256k1.privateKeyVerify(priv))

        writeLine(JSON.stringify({
            pub: pub58,
            priv: bs58.encode(priv)
        }))
    }).on('--help', function(){
        writeLine('')
        writeLine('Tip:')
        writeLine('  You can save your keys to a file with the \'>\' operator, and then use -F option instead of -K for signing txs.')
        writeLine('  This will prevent your private key from getting in your clipboard or showing up on the screen.')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ keypair')
        writeLine('  $ keypair > file.json')
        writeLine('  $ keypair --has bob')
    })

program.command('license')
    .description('read the software license')
    .action(function() {
        writeLine('Copyright (c) 2018 Adrien Marie. https://d.tube')
        writeLine('')
        writeLine('Permission is hereby granted, free of charge, to any person obtaining a copy')
        writeLine('of this software and associated documentation files (the "Software"), to deal')
        writeLine('in the Software without restriction, including without limitation the rights')
        writeLine('to use, copy, modify, merge, publish, distribute, sublicense, and/or sell')
        writeLine('copies of the Software, and to permit persons to whom the Software is')
        writeLine('furnished to do so, subject to the following conditions:')
        writeLine('')
        writeLine('The above copyright notice and this permission notice shall be included in')
        writeLine('all copies or substantial portions of the Software.')
        writeLine('')
        writeLine('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR')
        writeLine('IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,')
        writeLine('FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE')
        writeLine('AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER')
        writeLine('LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,')
        writeLine('OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN')
        writeLine('THE SOFTWARE.')
    })

program.command('limit-vt')
    .description('limit your account maximum VT')
    .action(function(amount) {
        verifyAndSendTx('limitVt', amount)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <amount>: the new maximum VT. If -1, then the maxVt will be unset')
        writeLine('')
        writeLine('Warning: Limit VT is only useful for corporate accounts that want to prove they will not be involved in content voting.')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ limit-vt 1000 -F key.json -M alice')
        writeLine('  $ limit-vt -1 -F key.json -M alice')
    })

program.command('md-queue <txtype> <payload>')
    .description('queue a transaction in master dao')
    .action(function(txtype, payload) {
        verifyAndSendTx('mdQueue', txtype, payload)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <txtype>: the transaction type to be queued')
        writeLine('  <payload>: the payload of the new transaction to be queued')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ mdqueue 6 \'{"json":{"foo":"bar"}}\' -F key.json -M bob')
        writeLine('  $ mdqueue 32 \'{"id":2,"amount":10000}\' -F key.json -M john')
    })

program.command('md-sign <id>')
    .description('approve a queued transaction in master dao')
    .action(function(id) {
        verifyAndSendTx('mdSign', id)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: identifier of the queued transaction')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ mdqueue 1 -F key.json -M alice')
    })

program.command('new-key <id> <pub> <allowed_txs>')
    .description('add new key with custom perms')
    .action(function(id, pub, allowedTxs) {
        verifyAndSendTx('newKey', id, pub, allowedTxs)
    }).on('--help', function(){
        writeLine('')
        writeLine('Transaction Types:')
        for (const key in TransactionType)
            writeLine('  '+TransactionType[key]+': '+key)
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ new-key posting tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g [4,5,6,7,8] -F key.json -M alice')
        writeLine('  $ new-key finance wyPSnqfmAKoz5gAWyPcND7Rot6es2aFgcDGDTYB89b4q [3] -F key.json -M alice')
    })

program.command('new-weighted-key <id> <pub> <allowed_txs> <weight>')
    .description('add new key with custom perms and weight')
    .action(function(id, pub, allowedTxs, weight) {
        verifyAndSendTx('newWeightedKey', id, pub, allowedTxs, weight)
    }).on('--help', function(){
        writeLine('')
        writeLine('Transaction Types:')
        for (const key in TransactionType)
            writeLine('  '+TransactionType[key]+': '+key)
        writeLine('')
        writeLine('WARNING: Multi-signature setup is for advanced users only.')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ new-key posting tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g [4,5,6,7,8] 1 -F key.json -M alice')
        writeLine('  $ new-key finance wyPSnqfmAKoz5gAWyPcND7Rot6es2aFgcDGDTYB89b4q [3] 2 -F key.json -M alice')
    })

program.command('password <pub>')
    .description('change your master key')
    .action(function(pub) {
        verifyAndSendTx('changePassword', pub)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <pub>: the new public key that will have full control over your account')
        writeLine('')
        writeLine('WARNING:')
        writeLine('  DO NOT lose the new associated private key!')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ change-password tK9DqTygrcwGWZPsyVtZXNpfiZcAZN83nietKbKY8aiH -F key.json -M alice')
    })

program.command('password-weight <weight>')
    .description('set signature thresholds for transaction types')
    .action(function(weight) {
        verifyAndSendTx('setPasswordWeight', weight)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <weight>: the new weight of the master key')
        writeLine('')
        writeLine('WARNING: Multi-signature setup is for advanced users only.')
        writeLine('Please choose the weight carefully to prevent being locked out from your account!')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ password-weight 1 -F key.json -M alice')
    })

program.command('playlist-json <link> <json>')
    .description('set json metadata of a playlist, creating one if it doesn\'t exist already')
    .action(function(link, json) {
        verifyAndSendTx('playlistJson', link, json)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: the link of the playlist')
        writeLine('  <json>: the new json metadata of the playlist')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ playlist-json myplaylist \'{"title": "My awesome video collection"}\' -F key.json -M alice')
    })

program.command('playlist-push <link> <seq>')
    .description('append or modify a playlist by its corresponding sequence id in the playlist')
    .action(function(link, seq) {
        verifyAndSendTx('playlistPush', link, seq)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: the link of the playlist')
        writeLine('  <seq>: the json of the sequences to be added or modified, where key is the sequence id (integer)')
        writeLine('    and its value is the content identifier (string in format of \'author/link\')')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ playlist-push myplaylist \'{"100": "alice/ep-1","200": "alice/ep-2","300": "alice/ep-3"}\' -F key.json -M alice')
    })

program.command('playlist-pop <link> <seq>')
    .description('delete a content in a playlist by its corresponding sequence id')
    .action(function(link, seq) {
        verifyAndSendTx('playlistPop', link, seq)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: the link of the playlist')
        writeLine('  <seq>: the array of sequence ids to be removed from the playlist')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ playlist-pop myplaylist \'[100,200]\' -F key.json -M alice')
    })

program.command('profile <json>')
    .alias('user-json')
    .description('modify an account profile')
    .action(function(json) {
        verifyAndSendTx('profile', json)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ profile \'{"profile":{"avatar":"https://i.imgur.com/4Bx2eQt.jpg"}}\' -F key.json -M bob')
    })

program.command('promote <link> <pa> <pp> <json> <vt> <tag> <burn>')
    .description('publish and promote')
    .action(function(link, pa, pp, json, vt, tag, burn) {
        verifyAndSendTx('promotedComment', link, pa, pp, json, vt, tag, burn)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: an arbitrary string identifying your content')        
        writeLine('  <pa>: parent author (if you are replying to another comment)')
        writeLine('  <pp>: parent link (if you are replying to another comment)')
        writeLine('  <json>: a json object')
        writeLine('  <vt>: the amount of VT to spend on the forced vote')
        writeLine('  <tag>: the tag of the forced vote')
        writeLine('  <burn>: the amount of coins to burn for promotion')
        writeLine('')
        writeLine('WARNING:')
        writeLine('  Your balance will be reduced by <burn> coins')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ promote big-video \'\' \'\' \'{"title": "Check this out"}\' 777 my-tag 10 -F key.json -M alice')
    })

program.command('proposal-vote <id> <amount>')
    .alias('dao-vote')
    .description('vote for a dao proposal')
    .action(function(id, amount) {
        verifyAndSendTx('proposalVote', id, amount)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: the identifier of the dao proposal to vote on')        
        writeLine('  <amount>: voting weight for the vote. <amount> tokens will be locked until voting period ends.')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ dao-vote 2 5000000 -F key.json -M bob')
        writeLine('  $ proposal-vote 3 2000000 -F key.json -M john')
    })

program.command('proposal-edit <id> <title> <description> <url>')
    .alias('dao-edit')
    .description('edit metadata of a dao proposal')
    .action(function(id, title, description, url) {
        verifyAndSendTx('proposalEdit', id, title, description, url)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <id>: the identifier of the dao proposal to edit metadata of')        
        writeLine('  <title> updated title of proposal')
        writeLine('  <description> updated description of proposal')
        writeLine('  <url> updated url of proposal')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ dao-vote 2 \'Updated proposal title\' \'Edited escription with some more details\' \'https://d.tube/#!/v/bob/updated-proposal-video\' -F key.json -M bob')
        writeLine('  $ proposal-vote 3 \'Updated proposal title\' \'Edited escription with some more details\' \'https://d.tube/#!/v/john/work-update\' -F key.json -M john')
    })

program.command('public')
    .description('get public key from private key')
    .action(function() {
        readKeyFromFile()
        writeLine(bs58.encode(secp256k1.publicKeyCreate(bs58.decode(program.key))))
    }).on('--help', function(){
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ public -K 34EpMEDFJwKbxaF7FhhLyEe3AhpM4dwHMLVfs4JyRto5')
        writeLine('  $ public -F key.json')
    })

program.command('remove-key <id>')
    .description('remove a previously added key')
    .action(function(id) {
        verifyAndSendTx('removeKey', id)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ remove-key posting -F key.json -M alice')
    })

program.command('signature-threshold <thresholds>')
    .alias('sig-threshold')
    .description('set signature thresholds for transaction types')
    .action(function(thresholds) {
        verifyAndSendTx('setSignatureThreshold', thresholds)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <thresholds>: Stringified json of the list of thresholds for the tx types as well as a default value if any')
        writeLine('')
        writeLine('WARNING: Multi-signature setup is for advanced users only.')
        writeLine('  Please choose the thresholds carefully to prevent being locked out of your account due to insufficient key weight to meet the new signature threshold!')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ set-signature-threshold \'{"default":1,"2":3}\' -F key.json -M alice')
    })

program.command('sign <transaction>')
    .description('sign a tx w/o broadcasting')
    .action(function(transaction) {
        readKeyFromFile()
        writeLine(JSON.stringify(cmds.sign(program.key, program.me, transaction)))
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ sign \'{"type":1,"data":{"target":"bob"}}\' -F key.json -M alice')
    })

program.command('tipped-vote <link> <author> <vt> <tag> <tip>')
    .description('vote for a content with a % of curation rewards tipped to author')
    .action(function(link, author, vt, tag, tip) {
        verifyAndSendTx('tippedVote', link, author, vt, tag, tip)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: the identifier of the comment to vote on')        
        writeLine('  <author>: the author of the comment to vote on')
        writeLine('  <vt>: the amount of VT to spend on the vote')
        writeLine('  <tag>: the tag to associate with the vote')
        writeLine('  <tip>: the tip weight (1 => 1%, 100 => 100% of rewards claimable by author)')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ tipped-vote awesome-video alice 1000 introduce-yourself 15 -F key.json -M bob')
    })

program.command('transfer <receiver> <amount>')
    .alias('xfer')
    .option('--memo [text]', 'add a short message to the transfer')    
    .description('transfer coins')
    .action(function(receiver, amount, options) {
        let memo = ''
        if (options && options.memo) memo = options.memo
        verifyAndSendTx('transfer', receiver, amount, memo)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ transfer alice 1000 -F key.json -M bob')
        writeLine('  $ transfer bob 777 --memo "thank you" -F key.json -M alice')
    })

program.command('transfer-bw <receiver> <amount>')
    .alias('xfer-bw')
    .description('transfer bandwidth')
    .action(function(receiver, amount) {
        verifyAndSendTx('transferBw', receiver, amount)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ xfer-bw dan 777 -F key.json -M alice')
    })

program.command('transfer-vp <receiver> <amount>')
    .alias('xfer-vp')
    .description('transfer voting power')
    .action(function(receiver, amount) {
        verifyAndSendTx('transferVt', receiver, amount)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ xfer-vp charlotte 777 -F key.json -M alice')
    })

program.command('unfollow <target>')
    .alias('unsubscribe')
    .description('stop following another user ')
    .action(function(target) {
        verifyAndSendTx('unfollow', target)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ unfollow bob -F key.json -M alice')
    })

program.command('unset-signature-threshold <types>')
    .alias('unset-sig-threshold')
    .description('unset signature thresholds for transaction types')
    .action(function(thresholds) {
        verifyAndSendTx('unsetSignatureThreshold', thresholds)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <types>: Array of tx types to unset signature threshold of, falling back to default threshold set using SET_SIG_THRESHOLD or 1.')
        writeLine('')
        writeLine('WARNING: Multi-signature setup is for advanced users only.')
        writeLine('  Please choose the thresholds carefully to prevent being locked out of your account due to insufficient key weight to meet the new signature threshold!')
        writeLine('')
        writeLine('Example:')
        writeLine('  $ unset-signature-threshold [1,3,4] -F key.json -M alice')
    })

program.command('unvote-leader <leader>')
    .description('remove a leader vote')
    .action(function(leader) {
        verifyAndSendTx('disapproveNode', leader)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ unvote-leader bob -F key.json -M alice')
    })

program.command('vote <link> <author> <vt> <tag>')
    .description('vote for a content')
    .action(function(link, author, vt, tag) {
        verifyAndSendTx('vote', link, author, vt, tag)
    }).on('--help', function(){
        writeLine('')
        writeLine('Arguments:')
        writeLine('  <link>: the identifier of the comment to vote on')        
        writeLine('  <author>: the author of the comment to vote on')
        writeLine('  <vt>: the amount of VT to spend on the vote')
        writeLine('  <tag>: the tag to associate with the vote')
        writeLine('')
        writeLine('Examples:')
        writeLine('  $ vote root-comment alice 1000 introduce-yourself -F key.json -M bob')
    })

program.command('vote-leader <leader>')
    .description('vote for a leader')
    .action(function(leader) {
        verifyAndSendTx('approveNode', leader)
    }).on('--help', function(){
        writeLine('')
        writeLine('Example:')
        writeLine('  $ vote-leader bob -F key.json -M alice')
    })

// error on unknown commands
program.on('command:*', function () {
    writeLine('Unknown command: '+program.args[0])
    writeLine('See --help for a list of available commands.')
    process.exit(1)
})

program.parse(process.argv)

function writeLine(str){process.stdout.write(str+'\n')}

function verifyAndSendTx(txType, ...args) {
    verifyKeyAndUser(function() {
        let tx = cmds[txType](program.key, program.me, ...args)
        sendTx(tx)
    })
}

function sendTx(tx) {
    let port = process.env.API_PORT || defaultPort
    let ip = process.env.API_IP || '[::1]'
    let protocol = process.env.API_PROTOCOL || 'http'
    let url = protocol+'://'+ip+':'+port+'/transact'
    if (program.api)
        url = program.api+'/transact'
    if (program.wait)
        url += 'WaitConfirm'
    fetch(url, {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tx)
    }).then(function(res) {
        return res.json()
    }).then(function(res) {
        if (res.error)
            writeLine('Error: '+res.error)
        else
            writeLine(res)
    }).catch(function(error) {
        writeLine('Err: ' + error)
    })
    if (program.spam && program.spam > 0)
        setTimeout(function(){
            let newTx = JSON.stringify(tx)
            sendTx(cmds.sign(program.key, program.me, newTx))
        }, program.spam)
}

function verifyKeyAndUser(cb) {
    readKeyFromFile()
    if (!program.key) {
        writeLine('no key?')
        process.exit(1)
    }
    if (!program.me) {
        writeLine('no user?')
        process.exit(1)
    }

    // Check if account exists for username
    let port = process.env.API_PORT || defaultPort
    let ip = process.env.API_IP || '[::1]'
    let protocol = process.env.API_PROTOCOL || 'http'
    let apiUrl = protocol + '://' + ip + ':' + port
    if (program.api)
        apiUrl = program.api
    let getAccUrl = apiUrl + '/accounts/' + program.me
    fetch(getAccUrl)
        .then((res) => {return res.json()})
        .then((json) => {
            if (json.length === 0) {
                writeLine('Username doesn\'t exist. Is your node fully replayed?')
                process.exit(1)
            }
            cb()
        }).catch((err) => {
            writeLine(err.message)
            process.exit(1)
        })
}

function readKeyFromFile() {
    if (program.file) {
        let file = fs.readFileSync(program.file, 'utf8')
        try {
            program.key = JSON.parse(file).priv
        } catch (error) {
            program.key = file.trim()
        }
    }
}
