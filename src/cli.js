var config = require('./config.js').read(0)
var TransactionType = require('./transactionType.js')
var cmds = require('./clicmds.js')
var program = require('commander')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
var fetch = require('node-fetch')
const defaultPort = 3001
process.stdout.writeLine = function(str) {
    process.stdout.write(str+'\n')
}

program
    .version('0.2.0')
    .option('-K, --key [private_key_file]', 'plain-text private key')
    .option('-F, --file [private_key]', 'file private key')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-S, --spam [delay_in_ms]', 'repeats the tx every delay')
    
program
    .command('keypair')
    .description('generate a new keypair')
    .alias('key')
    .option('-p, --prefix [prefix]', 'public key prefix')
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
    .action(function(transaction) {
        verifyKeyAndUser()
        process.stdout.writeLine(JSON.stringify(cmds.sign(program.key, program.me, transaction)))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ sign {"type":1,"data":{"target":"bob"}} -F key.json -M alice')
    })

program
    .command('account <pub_key> <new_user>')
    .description('create a new account')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ account d2EdJPNgFBwd1y9vhMzxw6vELRneC1gSHVEjguTG74Ce new-username -F key.json -M alice')
    })

program
    .command('approveNode <leader>')
    .description('vote for a leader')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.approveNode(program.key, program.me, leader))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ approveNode bob -F key.json -M alice')
    })

program
    .command('disapproveNode <leader>')
    .description('remove a leader vote')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, leader))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ disapproveNode bob -F key.json -M alice')
    })

program
    .command('transfer <receiver> <amount>')
    .alias('xfer')
    .description('transfer coins')
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
    .action(function(link, pa, pp, json, vt, tag) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, link, parentUser, parentLink, json, vt, tag))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Examples:')
        process.stdout.writeLine('  $ comment root-comment \'\' \'\' {"body": "Hello World"} 777 my-tag -F key.json -M alice')
        process.stdout.writeLine('  $ comment reply-to-bob bobs-post bob {"body": "Hello Bob"} 1 my-tag -F key.json -M alice')
    })

program
    .command('profile <json>')
    .alias('userJson')
    .description('modify an account profile')
    .action(function(json) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, json))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ profile {"profile":{"avatar":"https://vignette.wikia.nocookie.net/the-demonic-paradise/images/f/f0/Avalon_by_iribel.jpg/revision/latest?cb=20161206193037"}} -F key.json -M alice')
    })

program
    .command('follow <target>')
    .alias('subscribe')
    .description('start following another user')
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
    .action(function(target) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, target))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ unfollow bob -F key.json -M alice')
    })

program
    .command('newKey <id> <pub> <allowed_txs>')
    .description('add new key with custom perm')
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
        process.stdout.writeLine('  $ newKey posting tWWLqc5wPTbXPaWrFAfqUwGtEBLmUbyavp3utwPUop2g [4,5,6,7,8] -F key.json -M alice')
        process.stdout.writeLine('  $ newKey finance wyPSnqfmAKoz5gAWyPcND7Rot6es2aFgcDGDTYB89b4q [3] -F key.json -M alice')
    })

program
    .command('removeKey <id>')
    .description('remove a previously added key')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
    }).on('--help', function(){
        process.stdout.writeLine('')
        process.stdout.writeLine('Example:')
        process.stdout.writeLine('  $ removeKey posting -F key.json -M alice')
    })
      

program.parse(process.argv)

function sendTx(tx) {
    var port = process.env.API_PORT || defaultPort
    var ip = process.env.API_IP || '[::1]'
    var protocol = process.env.API_PROTOCOL || 'http'
    var url = protocol+'://'+ip+':'+port+'/transact'
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
    if (!program.key) {
        process.stdout.writeLine('no key?')
        process.exit()
    }
    if (!program.me) {
        process.stdout.writeLine('no user?')
        process.exit()
    }
}
