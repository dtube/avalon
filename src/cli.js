var config = require('./config.js').read(0)
var cmds = require('./clicmds.js')
var program = require('commander')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
var fetch = require('node-fetch')
const defaultPort = 3001

program
    .version('0.2.0')
    .option('-K, --key [private_key]', 'private key used to sign the transaction')
    .option('-M, --me [my_username]', 'username of the transactor')
    .option('-S, --spam [delay_in_ms]', 'sends the transaction repeatedly with a delay')
    
program
    .command('keypair')
    .description('generate a new keypair')
    .alias('key')
    .option('-p, --prefix [prefix]', 'Search for a public key with a prefix')
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

        process.stdout.write(JSON.stringify({
            pub: pub58,
            priv: bs58.encode(priv)
        }))
    })

program
    .command('sign <transaction>')
    .description('sign a raw transaction')
    .action(function(transaction) {
        verifyKeyAndUser()
        process.stdout.write(JSON.stringify(cmds.sign(program.key, program.me, transaction)))
    })

program
    .command('createAccount <pub_key> <new_user>')
    .description('create a new account')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
    })

program
    .command('approveNode <leader>')
    .description('vote for a leader')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.approveNode(program.key, program.me, leader))
    })

program
    .command('disapproveNode <leader>')
    .description('remove a leader vote')
    .action(function(leader) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, leader))
    })

program
    .command('transfer <receiver> <amount>')
    .alias('xfer')
    .description('transfer coins')
    .action(function(receiver, amount) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, receiver, amount))
    })

program
    .command('comment <link> <parent_author> <parent_permlink> <json> <vt> <tag>')
    .alias('content')
    .description('publish a new JSON content')
    .action(function(link, parentAuthor, parentPermlink, json, vt, tag) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, link, parentAuthor, parentPermlink, json, vt, tag))
    })

program
    .command('profile <json>')
    .alias('userJson')
    .description('modify an account profile')
    .action(function(json) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, json))
    })

program
    .command('follow <target>')
    .alias('subscribe')
    .description('start following another user')
    .action(function(target) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, target))
    })

program
    .command('unfollow <target>')
    .alias('unsubscribe')
    .description('stop following another user ')
    .action(function(target) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, target))
    })

program
    .command('newKey <id> <pub> <allowed_txs>')
    .description('add a new key with custom permissions')
    .action(function(id, pub, allowedTxs) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, id, pub, allowedTxs))
    })

program
    .command('removeKey <id>')
    .description('remove a previously added key')
    .action(function(pubKey, newUser) {
        verifyKeyAndUser()
        sendTx(cmds.createAccount(program.key, program.me, pubKey, newUser))
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
            process.stdout.write('Err: ' + res.statusText)
    }).catch(function(error) {
        process.stdout.write('Err: ' + error)
    })
    if (program.spam && program.spam > 0)
        setTimeout(function(){sendTx(tx)}, program.spam)
}

function verifyKeyAndUser() {
    if (!program.key) {
        process.stdout.write('no key?')
        process.exit()
    }
    if (!program.me) {
        process.stdout.write('no user?')
        process.exit()
    }
}
