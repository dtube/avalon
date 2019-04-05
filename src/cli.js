var config = require('./config.js').read(0)
var TransactionType = require('./transactionType.js')
var cmds = require('./clicmds.js')
var program = require('commander')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
var fetch = require('node-fetch')
var fs = require('fs')
const defaultPort = 3001
process.stdout.writeLine = function(str) {
    process.stdout.write(str+'\n')
}

program
    .version('0.2.0', '-V, --version')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .option('-S, --spam [delay_in_ms]', 'repeats the tx every delay')
    
program
    .command('keypair')
    .description('generate a new keypair')
    .alias('key')
    .option('-P, --prefix [prefix]', 'public key prefix')
    .action(function(options) {
        var prefix = (options.prefix || '')
        var priv
        var pub
        var pub58
        do {
            priv = randomBytes(config.randomBytesLength)
            pub = secp256k1.publicKeyCreate(priv)
            pub58 = bs58.encode(pub)
        } while (!pub58.startsWith(prefix) || !secp256k1.privateKeyVerify(priv))

        process.stdout.writeLine(JSON.stringify({
            pub: pub58,
            priv: bs58.encode(priv)
        }))
    })

program
    .command('sign <transaction>')
    .description('sign a transaction w/o broadcasting')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .action(function(transaction) {
        verifyKeyAndUser()
        process.stdout.writeLine(JSON.stringify(cmds.sign(program.key, program.me, transaction)))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ sign \'{"type":1,"data":{"target":"bob"}}\' -F key.json -M alice')
    })

program
    .command('account <pub_key> <new_user>')
    .description('create a new account')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Extra Info:')
        process.stdout.writeLine('  Account creation will burn coins depending on the chain config')
        process.stdout.writeLine('  However, usernames matching public key are free (see second example)')
        process.stdout.writeLine('')
        process.stdout.writeLine('Examples:')
        process.stdout.writeLine('  $ account d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce cool-name -F key.json -M alice')
        process.stdout.writeLine('  $ account fR3e4CcvMRuv8yaGtoQ6t6j1hxfyocqhsKHi2qP9mb1E fr3e4ccvmruv8yagtoq6t6j1hxfyocqhskhi2qp9mb1e -F key.json -M alice')
    })

program
    .command('vote-leader <leader>')
    .description('vote for a leader')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.approveNode(program.key, program.me, leader))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ vote-leader bob -F key.json -M alice')
    })

program
    .command('unvote-leader <leader>')
    .description('remove a leader vote')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, leader))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ unvote-leader bob -F key.json -M alice')
    })

program
    .command('transfer <receiver> <amount>')
    .alias('xfer')
    .description('transfer coins')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(receiver, amount) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, receiver, amount))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ transfer bob 777 -F key.json -M alice')
    })

program
    .command('comment <link> <pa> <pp> <json> <vt> <tag>')
    .description('publish a new JSON content')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(link, pa, pp, json, vt, tag) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, link, pa, pp, json, vt, tag))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Extra Info:')
        process.stdout.writeLine('  <link>: an arbitrary string identifying your content')        
        process.stdout.writeLine('  <pa>: parent author (if you are replying to another comment)')
        process.stdout.writeLine('  <pp>: parent link (if you are replying to another comment)')
        process.stdout.writeLine('  <json>: a json object')
        process.stdout.writeLine('  <vt>: the amount of VT to spend on the forced vote')
        process.stdout.writeLine('  <tag>: the tag of the forced vote')
        process.stdout.writeLine('')
        process.stdout.writeLine('Examples:')
        process.stdout.writeLine('  $ comment root-comment \'\' \'\' \'{"body": "Hello World"}\' 777 my-tag -F key.json -M alice')
        process.stdout.writeLine('  $ comment reply-to-bob bobs-post bob \'{"body": "Hello Bob"}\' 1 my-tag -F key.json -M alice')
    })

program
    .command('profile <json>')
    .alias('userJson')
    .description('modify an account profile')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(json) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, json))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ profile \'{"profile":{"avatar":"https://i.imgur.com/4Bx2eQt.jpg"}}\' -F key.json -M bob')
    })

program
    .command('follow <target>')
    .alias('subscribe')
    .description('start following another user')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(target) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, target))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ follow bob -F key.json -M alice')
    })

program
    .command('unfollow <target>')
    .alias('unsubscribe')
    .description('stop following another user ')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(target) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, target))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ unfollow bob -F key.json -M alice')
    })

program
    .command('new-key <id> <pub> <allowed_txs>')
    .description('add new key with custom perms')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(id, pub, allowedTxs) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, id, pub, allowedTxs))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Transaction Types:')
        for (const key in TransactionType)
            process.stdout.writeLine('  '+TransactionType[key]+': '+key)
        process.stdout.writeLine('')
        process.stdout.writeLine('Examples:')
        process.stdout.writeLine('  $ new-key posting tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g [4,5,6,7,8] -F key.json -M alice')
        process.stdout.writeLine('  $ new-key finance wyPSnqfmAKoz5gAWyPcND7Rot6es2aFgcDGDTYB89b4q [3] -F key.json -M alice')
    })

program
    .command('remove-key <id>')
    .description('remove a previously added key')
    .option('-K, --key [plaintext_key]', 'plain-text private key')
    .option('-F, --file [file_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-A, --api [api_url]', 'Avalon API Url')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ remove-key posting -F key.json -M alice')
    })
      

program.parse(process.argv)

function sendTx(tx) {
    var port = process.env.API_PORT || defaultPort
    var ip = process.env.API_IP || '[::1]'
    var protocol = process.env.API_PROTOCOL || 'http'
    var url = protocol+'://'+ip+':'+port+'/transact'
    if (program.api)
        url = program.api+'/transact'
    fetch(url, {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tx)
    }).then(function(res) {
        if (res.statusText !== 'OK')
            process.stdout.writeLine('Err: ' + res.statusText)
    }).catch(function(error) {
        process.stdout.writeLine('Err: ' + error)
    })
    if (program.spam && program.spam > 0)
        setTimeout(function(){sendTx(tx)}, program.spam)
}

function verifyKeyAndUser() {
    if (program.file) {
        var file = fs.readFileSync(program.file, 'utf8')
        try {
            program.key = JSON.parse(file).priv
        } catch (error) {
            program.key = file.trim()
        }
    }
    if (!program.key) {
        process.stdout.writeLine('no key?')
        process.exit()
    }
    if (!program.me) {
        process.stdout.writeLine('no user?')
        process.exit()
    }
}
