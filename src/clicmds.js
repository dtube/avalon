var privKey = process.argv[3]
var sender = process.argv[4]
var CryptoJS = require("crypto-js")
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')
//const bs58 = require('bs58')
let sign = (privKey, sender, tx) => {
	var times = [now('micro')]
	// parsing the tx
	tx = JSON.parse(tx)
	times.push(now('micro'))

	// add timestamp to seed the hash (avoid transactions reuse)
	tx.sender = sender
	tx.ts = new Date().getTime()
	var txString = JSON.stringify(tx)
	times.push(now('micro'))

	// hash the transaction
	tx.hash = CryptoJS.SHA256(txString).toString()
	times.push(now('micro'))

	// decode the key
	var rawPriv = bs58.decode(privKey)
	times.push(now('micro'))

	// sign the tx
	var signature = secp256k1.sign(new Buffer(tx.hash, "hex"), rawPriv)
	times.push(now('micro'))

	// convert signature to '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
	tx.signature = bs58.encode(signature.signature)
	times.push(now('micro'))

	var timeResults = []
	for (let i = 1; i < times.length; i++) {
		timeResults.push(times[i]-times[i-1])
	}
	console.log(timeResults)
	return tx
}

const now = (unit) => {
	
	  const hrTime = process.hrtime();
	
	  switch (unit) {
	
		case 'milli':
		  return hrTime[0] * 1000 + hrTime[1] / 1000000;
	
		case 'micro':
		  return hrTime[0] * 1000000 + hrTime[1] / 1000;
	
		case 'nano':
		  return hrTime[0] * 1000000000 + hrTime[1];
	
		default:
		  return hrTime[0] * 1000000000 + hrTime[1];
	  }
	
	};

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

	comment: (uri, pa, pp, content) => {
		var tx = '{"type":4,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'","json":'+content+'}}'
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
