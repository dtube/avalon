let config = require('./config.js').read(0)
const CryptoJS = require('crypto-js')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
//const bs58 = require('bs58')
let sign = (privKey, sender, tx) => {
    // parsing the tx
    tx = JSON.parse(tx)
    // add timestamp to seed the hash (avoid transactions reuse)
    tx.sender = sender
    tx.ts = new Date().getTime()
    let txString = JSON.stringify(tx)

    // hash the transaction
    tx.hash = CryptoJS.SHA256(txString).toString()

    // decode the key
    let rawPriv = bs58.decode(privKey)

    // sign the tx
    let signature = secp256k1.ecdsaSign(Buffer.from(tx.hash, 'hex'), rawPriv)

    // convert signature to base58
    tx.signature = bs58.encode(signature.signature)
    return tx
}

let cmds = {
    sign: (priv, sender, tx) => {
        return sign(priv, sender, tx)
    },

    createAccount: (privKey, sender, pub, name) => {
        let tx = '{"type":0,"data":{"pub":"'+pub+'","name":"'+name+'"}}'
        return sign(privKey, sender, tx)
    }, 

    approveNode: (privKey, sender, nodeName) => {
        let tx = '{"type":1,"data":{"target":"'+ nodeName +'"}}'
        return sign(privKey, sender, tx)
    }, 
	
    disapproveNode: (privKey, sender, nodeName) => {
        let tx = '{"type":2,"data":{"target":"'+ nodeName +'"}}'
        return sign(privKey, sender, tx)
    },

    transfer: (privKey, sender, receiver, amount, memo) => {
        if (!memo) memo=''
        let tx = '{"type":3,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+', "memo":"'+memo+'"}}'
        return sign(privKey, sender, tx)
    },

    post: (privKey, sender, uri, content) => {
        let tx = '{"type":4,"data":{"link":"'+
			uri+'","json":'+content+'}}'
        return sign(privKey, sender, tx)
    },

    comment: (privKey, sender, uri, pa, pp, content, weight, tag) => {
        let tx = '{"type":4,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'", "vt":'+
			parseInt(weight)+', "tag":"'+
			tag+'","json":'+content+'}}'
        return sign(privKey, sender, tx)
    },

    vote: (privKey, sender, link, author, weight, tag) => {
        if (!tag) tag = ''
        let tx = '{"type":5,"data":{"link":"'+
			link+'", "author":"'+
			author+'", "vt": '+
			parseInt(weight)+', "tag": "'+tag+'"}}'
        return sign(privKey, sender, tx)
    },
	
    profile: (privKey, sender, content) => {
        let tx = '{"type":6,"data":{"json":'+content+'}}'
        return sign(privKey, sender, tx)
    },
	
    follow: (privKey, sender, username) => {
        let tx = '{"type":7,"data":{"target":"'+username+'"}}'
        return sign(privKey, sender, tx)
    },
	
    unfollow: (privKey, sender, username) => {
        let tx = '{"type":8,"data":{"target":"'+username+'"}}'
        return sign(privKey, sender, tx)
    },
	
    newKey: (privKey, sender, id, pub, types) => {
        let tx = '{"type":10,"data":{"id":"'+
			id+'","pub":"'+
			pub+'","types":'+types+'}}'
        return sign(privKey, sender, tx)
    },
	
    removeKey: (privKey, sender, id) => {
        let tx = '{"type":11,"data":{"id":"'+id+'"}}'
        return sign(privKey, sender, tx)
    },
	
    changePassword: (privKey, sender, pub) => {
        let tx = '{"type":12,"data":{"pub":"'+pub+'"}}'
        return sign(privKey, sender, tx)
    },
	
    promotedComment: (privKey, sender, uri, pa, pp, content, weight, tag, burn) => {
        let tx = '{"type":13,"data":{"link":"'+
			uri+'", "pa":"'+
			pa+'", "pp":"'+
			pp+'", "vt":'+
			parseInt(weight)+', "tag":"'+
			tag+'","burn":'+burn+',"json":'+content+'}}'
        return sign(privKey, sender, tx)
    },

    transferVt: (privKey, sender, receiver, amount) => {
        let tx = '{"type":14,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    transferBw: (privKey, sender, receiver, amount) => {
        let tx = '{"type":15,"data":{"receiver":"'+
			receiver+'", "amount":'+
			parseInt(amount)+'}}'
        return sign(privKey, sender, tx)
    },

    limitVt: (privKey, sender, amount) => {
        amount = parseInt(amount)
        if (amount === -1) amount = null
        let tx = '{"type":16,"data":{"amount":'+
			amount+'}}'
        return sign(privKey, sender, tx)
    },

    claimReward: (privKey, sender, author, link) => {
        let tx = '{"type":17,"data":{"author":"'+
			author+'", "link": "'+link+'"}}'
        return sign(privKey, sender, tx)
    },

    enableNode: (privKey, sender, pub) => {
        let tx = '{"type":18,"data":{"pub":"'+
			pub+'"}}'
        return sign(privKey, sender, tx)
    },

    tippedVote: (privkey, sender, link, author, weight, tag, tip) => {
        if (!tag) tag = ''
        let tx = '{"type":19,"data":{"link":"'+
            link+'", "author":"'+
            author+'", "vt": '+
            parseInt(weight)+', "tag": "'+tag+'", "tip": ' + parseInt(tip) + '}}'
        return sign(privkey, sender, tx)
    },

    newWeightedKey: (privKey, sender, id, pub, types, weight) => {
        let tx = '{"type":20,"data":{"id":"'+
			id+'","pub":"'+
			pub+'","types":'+types+',"weight":'+weight+'}}'
        return sign(privKey, sender, tx)
    },

    setSignatureThreshold: (privKey, sender, thresholds) => {
        let tx = '{"type":21,"data":{"thresholds":'+thresholds+'}}'
        return sign(privKey, sender, tx)
    },

    setPasswordWeight: (privKey, sender, weight) => {
        let tx = '{"type":22,"data":{"weight":'+weight+'}}'
        return sign(privKey, sender, tx)
    },

    unsetSignatureThreshold: (privKey, sender, types) => {
        let tx = '{"type":23,"data":{"types":'+types+'}}'
        return sign(privKey, sender, tx)
    },

    createAccountWithBw: (privKey, sender, pub, name, bw) => {
        let tx = '{"type":24,"data":{"pub":"'+pub+'","name":"'+name+'","bw":'+parseInt(bw)+'}}'
        return sign(privKey, sender, tx)
    },

    playlistJson: (privKey, sender, link, json) => {
        let tx = '{"type":25,"data":{"link":"'+link+'","json":'+json+'}}'
        return sign(privKey, sender, tx)
    },

    playlistPush: (privKey, sender, link, seq) => {
        let tx = '{"type":26,"data":{"link":"'+link+'","seq":'+seq+'}}'
        return sign(privKey, sender, tx)
    },

    playlistPop: (privKey, sender, link, seq) => {
        let tx = '{"type":27,"data":{"link":"'+link+'","seq":'+seq+'}}'
        return sign(privKey, sender, tx)
    },

    commentEdit: (privKey, sender, link, json) => {
        let tx = '{"type":28,"data":{"link":"'+link+'","json":'+json+'}}'
        return sign(privKey, sender, tx)
    },

    accountAuthorize: (privKey, sender, user, id, types, weight) => {
        let tx = '{"type":29,"data":{"user":"'+user+'","id":"'+id+'","types":'+types+',"weight":'+weight+'}}'
        return sign(privKey, sender, tx)
    },

    accountRevoke: (privKey, sender, user, id) => {
        let tx = '{"type":30,"data":{"user":"'+user+'","id":"'+id+'"}}'
        return sign(privKey, sender, tx)
    },

    fundRequestCreate: (privKey, sender, title, description, url, requested, receiver) => {
        let tx = '{"type":31,"data":{"title":"'+title+'","description":"'+description+'","url":"'+url+'","requested":'+requested+',"receiver":"'+receiver+'"}}'
        return sign(privKey, sender, tx)
    },

    fundRequestContrib: (privKey, sender, id, amount) => {
        let tx = '{"type":32,"data":{"id":'+id+',"amount":'+amount+'}}'
        return sign(privKey, sender, tx)
    },

    fundRequestWork: (privKey, sender, id, work) => {
        let tx = '{"type":33,"data":{"id":'+id+',"work":'+work+'}}'
        return sign(privKey, sender, tx)
    },

    fundRequestWorkReview: (privKey, sender, id, approve, memo) => {
        let tx = '{"type":34,"data":{"id":'+id+',"approve":'+approve+',"memo":"'+memo+'}}'
        return sign(privKey, sender, tx)
    },

    proposalVote: (privKey, sender, id, amount) => {
        let tx = '{"type":35,"data":{"id":'+id+',"amount":'+amount+'}}'
        return sign(privKey, sender, tx)
    },

    proposalEdit: (privKey, sender, id, title, description, url) => {
        let tx = '{"type":36,"data":{"id":'+id+',"title":"'+title+'","description":"'+description+'","url":"'+url+'"}}'
        return sign(privKey, sender, tx)
    },

    chainUpdateCreate: (privKey, sender, title, description, url, changes) => {
        let tx = '{"type":37,"data":{"title":"'+title+'","description":"'+description+'","url":"'+url+'","changes":'+changes+'}}'
        return sign(privKey, sender, tx)
    },

    mdQueue: (privKey, sender, txtype, payload) => {
        let tx = '{"type":38,"data":{"txtype":'+txtype+',"payload":'+payload+'}}'
        return sign(privKey, sender, tx)
    },

    mdSign: (privKey, sender, id) => {
        let tx = '{"type":39,"data":{"id":'+id+'}}'
        return sign(privKey, sender, tx)
    }
}

module.exports = cmds
