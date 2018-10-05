var cmds = require('./clicmds.js');
var command = process.argv[2]
var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('bs58')

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
		// private key, sender, transaction to send
		cmds.sign(process.argv[3], process.argv[4], process.argv[5])
		break;

    case 'approveNode':
		// node user
		cmds.approveNode(process.argv[5])
		break;

	case 'disapproveNode':
		// node user
		cmds.disapproveNode(process.argv[5])
		break;
	
	case 'transfer':
		// reciever, amount
		cmds.transfer(process.argv[5], process.argv[6])
		break;

	case 'post':
		// uri, conent json
		cmds.post(process.argv[5], process.argv[6])
		break;

	case 'comment':
		// uri, parent author, parent permalink, content json
		cmds.post(process.argv[5], process.argv[6], process.argv[7], process.argv[8])
		break;

	case 'vote':
		// uri, author, weight
		cmds.post(process.argv[5], process.argv[6], process.argv[7])
		break;

	case 'profile':
		// uri, author, weight
		cmds.post(process.argv[5], process.argv[6], process.argv[7])
		break;

    default:
        break;
}

