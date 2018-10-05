var privKey = process.argv[3]
var sender = process.argv[4]
var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('bs58')

let sign = (privKey, sender, tx) => {
	// will return a new transaction with a hash and a signature
	tx = JSON.parse(tx)
	tx.sender = sender
	// add timestamp to seed the hash (avoid transactions reuse)
	tx.ts = new Date().getTime()
	// hash the transaction
	tx.hash = CryptoJS.SHA256(JSON.stringify(tx)).toString()
	// sign the transaction
	var signature = secp256k1.sign(new Buffer(tx.hash, "hex"), bs58.decode(privKey))
	tx.signature = bs58.encode(signature.signature)
	return console.log(JSON.stringify(tx))
}

let cmds = {
	approveNode: (nodeName) => {
		var tx = '{"type":1,"data":{"target":"'+ nodeName +'"}}'
		sign(privKey, sender, tx)
	}, 
	
	disapproveNode: (nodeName) => {
		var tx = '{"type":2,"data":{"target":"'+ nodeName +'"}}'
		sign(privKey, sender, tx)
	},

	transfer: (reciever, amount) => {
		var tx = '{"type":3,"data":{"receiver":"'+
			reciever+'", "amount":'+
			parseFloat(amount)+'}}'
		sign(privKey, sender, tx)
	},

	post: (uri, content) => {
		var tx = '{"type":4,"data":{"link":"'+
			uri+'","json":'+content+'}}'
		sign(privKey, sender, tx)
	},

	comment: (uri, pa, pp, content) => {
		var tx = '{"type":4,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'","json":'+content+'}}'
		sign(privKey, sender, tx)
	},

	vote: (uri, author, weight) => {
		var tx = '{"type":5,"data":{"link":"'+
			uri+'", "author":"'+
			author+'", "vt": '+
			parseFloat(weight)+'}}'
		sign(privKey, sender, tx)
	},

	profile: (content) => {
		var tx = '{"type":6,"data":{"json":{"profile":{"'+content+'"}}}}'
		sign(privKey, sender, tx)
	}
}

module.exports = cmds
