var privKey = process.argv[3]
var sender = process.argv[4]
var config = require('./config.js').read(0)
var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
//const bs58 = require('bs58')
let sign = (privKey, sender, tx) => {
	// parsing the tx
	tx = JSON.parse(tx)

	// add timestamp to seed the hash (avoid transactions reuse)
	tx.sender = sender
	tx.ts = new Date().getTime()
	var txString = JSON.stringify(tx)

	// hash the transaction
	tx.hash = CryptoJS.SHA256(txString).toString()

	// decode the key
	var rawPriv = bs58.decode(privKey)

	// sign the tx
	var signature = secp256k1.sign(new Buffer(tx.hash, "hex"), rawPriv)

	// convert signature to base58
	tx.signature = bs58.encode(signature.signature)
	return tx
}

let cmds = {
	sign: (priv, sender, tx) => {
		return sign(priv, sender, tx)
	},

	createAccount: (pub, name) => {
		var tx = '{"type":0,"data":{"pub":"'+pub+'","name":"'+name+'"}}'
		return sign(privKey, sender, tx)
	}, 

	approveNode: (nodeName) => {
		var tx = '{"type":1,"data":{"target":"'+ nodeName +'"}}'
		return sign(privKey, sender, tx)
	}, 
	
	disapproveNode: (nodeName) => {
		var tx = '{"type":2,"data":{"target":"'+ nodeName +'"}}'
		return sign(privKey, sender, tx)
	},

	transfer: (receiver, amount, memo) => {
		if (!memo) memo=""
		var tx = '{"type":3,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+', "memo":"'+memo+'"}}'
		return sign(privKey, sender, tx)
	},

	post: (uri, content) => {
		var tx = '{"type":4,"data":{"link":"'+
			uri+'","json":'+content+'}}'
		return sign(privKey, sender, tx)
	},

	comment: (uri, pa, pp, content, weight, tag) => {
		var tx = '{"type":4,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'", "vt":'+
			parseInt(weight)+', "tag":"'+
			tag+'","json":'+content+'}}'
		return sign(privKey, sender, tx)
	},

	vote: (uri, author, weight, tag) => {
		if (!tag) tag = ""
		var tx = '{"type":5,"data":{"link":"'+
			uri+'", "author":"'+
			author+'", "vt": '+
			parseInt(weight)+', "tag": "'+tag+'"}}'
		return sign(privKey, sender, tx)
	},
	
	profile: (content) => {
		var tx = '{"type":6,"data":{"json":'+content+'}}'
		return sign(privKey, sender, tx)
	},
	
	follow: (username) => {
		var tx = '{"type":7,"data":{"target":"'+username+'"}}'
		return sign(privKey, sender, tx)
	},
	
	unfollow: (username) => {
		var tx = '{"type":8,"data":{"target":"'+username+'"}}'
		return sign(privKey, sender, tx)
	},
	
	newKey: (id, pub, types) => {
		var tx = '{"type":10,"data":{"id":"'+
			id+'","pub":"'+
			pub+'","types":'+types+'}}'
		return sign(privKey, sender, tx)
	},
	
	removeKey: (id) => {
		var tx = '{"type":11,"data":{"id":"'+id+'"}}'
		return sign(privKey, sender, tx)
	}
}

module.exports = cmds
