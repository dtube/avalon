var config = require('./config.js').read(0)
var cmds = require('./clicmds.js')
var command = process.argv[2]
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
var fetch = require('node-fetch')
const argsStartIndex = 3
const defaultPort = 3001
const spamPrecision = 1000

for (let i = 0; i < process.argv.length; i++)
    if (process.argv[i] === '--spam') {
        var spamming = true
        var spamDelay = Math.round(spamPrecision/parseInt(process.argv[i+1]))
        process.argv.splice(i,2)
    }

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
    })
}

if (spamming) 
    setInterval(function() { handle() }, spamDelay)
else 
    handle()


function handle() {
    switch (command) {
    case 'keypair':
        var priv
        var pub
        do {
            priv = randomBytes(config.randomBytesLength)
            pub = secp256k1.publicKeyCreate(priv)
        } while (!secp256k1.privateKeyVerify(priv))
		
        process.stdout.write({
            pub: bs58.encode(pub),        
            priv: bs58.encode(priv)
        })
        break
			
    case 'sign':
        process.stdout.write(JSON.stringify(cmds.sign(...process.argv.slice(argsStartIndex))))
        break
	
    case 'createAccount':
        sendTx(cmds.createAccount(...process.argv.slice(argsStartIndex)))
        break
	
    case 'approveNode':
        // node user
        sendTx(cmds.approveNode(...process.argv.slice(argsStartIndex)))
        break
	
    case 'disapproveNode':
        // node user
        sendTx(cmds.disapproveNode(...process.argv.slice(argsStartIndex)))
        break
		
    case 'transfer':
        // reciever, amount
        sendTx(cmds.transfer(...process.argv.slice(argsStartIndex)))
        break
	
    case 'post':
        // uri, conent json
        sendTx(cmds.post(...process.argv.slice(argsStartIndex)))
        break
	
    case 'comment':
        // uri, parent author, parent permalink, content json
        sendTx(cmds.comment(...process.argv.slice(argsStartIndex)))
        break
	
    case 'vote':
        // uri, author, weight, tag
        sendTx(cmds.vote(...process.argv.slice(argsStartIndex)))
        break
	
    case 'profile':
        // content
        sendTx(cmds.profile(...process.argv.slice(argsStartIndex)))
        break
	
    case 'follow':
        // username
        sendTx(cmds.follow(...process.argv.slice(argsStartIndex)))
        break
	
    case 'unfollow':
        // username
        sendTx(cmds.unfollow(...process.argv.slice(argsStartIndex)))
        break
		
    case 'newKey':
        // username
        sendTx(cmds.newKey(...process.argv.slice(argsStartIndex)))
        break
	
    case 'removeKey':
        // username
        sendTx(cmds.removeKey(...process.argv.slice(argsStartIndex)))
        break
	
    default:
        break
    }	
}

