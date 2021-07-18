var config = require('./config.js').read(0)
var TransactionType = require('./transactions').Types
var cmds = require('./clicmds.js')
var program = require('commander')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
var fetch = require('node-fetch')
var fs = require('fs')
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

program.command('keypair')
    .description('generate a new keypair')
    .alias('key')
    .option('-H, --has [text]', 'generated public key will contain the specified text')
    .action(function(options) {
        var has = (options.has || '')
        has = has.toLowerCase()
        var priv
        var pub
        var pub58
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
        var memo = ''
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
    var port = process.env.API_PORT || defaultPort
    var ip = process.env.API_IP || '[::1]'
    var protocol = process.env.API_PROTOCOL || 'http'
    var url = protocol+'://'+ip+':'+port+'/transact'
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
            var newTx = JSON.stringify(tx)
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
        var file = fs.readFileSync(program.file, 'utf8')
        try {
            program.key = JSON.parse(file).priv
        } catch (error) {
            program.key = file.trim()
        }
    }
}
