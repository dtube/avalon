var cmds = require('./clicmds.js');
var command = process.argv[2]
var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('bs58')
var fetch = require("node-fetch")

function sendTx(tx) {
	var port = process.env.HTTP_PORT || 3001
	fetch('http://localhost:'+port+'/transact', {
		method: 'post',
		headers: {
		  'Accept': 'application/json, text/plain, */*',
		  'Content-Type': 'application/json'
		},
		body: JSON.stringify(tx)
	}).then(function(res) {
		console.log(res.statusText)
	});
}

switch (command) {
    case 'keypair':
        const msg = randomBytes(32)
        let priv, pub
        do {
            priv = randomBytes(32)
            pub = secp256k1.publicKeyCreate(priv)
        } while (!secp256k1.privateKeyVerify(priv))
    
        var tx = {
            pub: bs58.encode(pub),        
            priv: bs58.encode(priv)
        }
		break;
		
    case 'sign':
		console.log(cmds.sign(process.argv[3], process.argv[4], process.argv[5]))
		break;

    case 'approveNode':
		// node user
		sendTx(cmds.approveNode(process.argv[5]))
		break;

	case 'disapproveNode':
		// node user
		sendTx(cmds.disapproveNode(process.argv[5]))
		break;
	
	case 'transfer':
		// reciever, amount
		sendTx(cmds.transfer(process.argv[5], process.argv[6]))
		break;

	case 'post':
		// uri, conent json
		sendTx(cmds.post(process.argv[5], process.argv[6]))
		break;

	case 'comment':
		// uri, parent author, parent permalink, content json
		sendTx(cmds.comment(process.argv[5], process.argv[6], process.argv[7], process.argv[8]))
		break;

	case 'vote':
		// uri, author, weight
		sendTx(cmds.vote(process.argv[5], process.argv[6], process.argv[7]))
		break;

	case 'profile':
		// content
		sendTx(cmds.profile(process.argv[5]))
		break;

    default:
        break;
}

