const randomBytes = require('randombytes')
const secp256k1 = require('secp256k1')
const bs58 = require('bs58')
var CryptoJS = require('crypto-js')
const { performance } = require('perf_hooks')

const iterations = parseInt(process.argv[2])
let timeDiff = null
var startTime = performance.now()
console.log('Iterations = '+iterations+'\n')

function output(type, n) {
    var outputs = [1, 10, 100, 1000, 10000, 100000, 1000000]
    if (outputs.indexOf(n) === -1) return

    timeDiff = performance.now()-startTime
    console.log(n+' '+type+': '+timeDiff.toFixed(3)+' ms')
}

function keypair() {
    let priv, pub
    do {
        priv = Buffer.from(randomBytes(32).buffer)
        pub = secp256k1.publicKeyCreate(priv)
    } while (!secp256k1.privateKeyVerify(priv))

    return {
        pub: bs58.encode(pub),        
        priv: bs58.encode(priv)
    }
}

function sign(privKey, sender, tx) {
    if (typeof tx !== 'object') 
        try {
            tx = JSON.parse(tx)
        } catch(e) {
            console.log('invalid transaction')
            return
        }
    
    
    tx.sender = sender
    // add timestamp to seed the hash (avoid transactions reuse)
    tx.ts = new Date().getTime()
    // hash the transaction
    tx.hash = CryptoJS.SHA256(JSON.stringify(tx)).toString()
    // sign the transaction
    var signature = secp256k1.ecdsaSign(Buffer.from(tx.hash, 'hex'), bs58.decode(privKey))
    tx.signature = bs58.encode(signature.signature)
    return tx
}

function verify(tx) {
    var bufferHash = Buffer.from(tx.hash, 'hex')
    var b58sign = bs58.decode(tx.signature)
    var b58pub = bs58.decode(tx.testPub)
    if (secp256k1.ecdsaVerify(b58sign, bufferHash, b58pub)) {
        // all good
    } else
        throw 'Fail ecdsaVerify()'
}


// key generation
let keys = []
while (keys.length < iterations) {
    keys.push(keypair())
    output('key', keys.length)
}
timeDiff = performance.now()-startTime
console.log('Keygen took: '+timeDiff.toFixed(3)+' ms\n')

// signing transactions
startTime = performance.now()
let signs = []
while (signs.length < iterations) {
    let key = keys[signs.length]
    signs.push(
        sign(key.priv, 'test', {testPub: key.pub})
    )
    output('sign', signs.length)
}

timeDiff = performance.now()-startTime
console.log('Sign took: '+timeDiff.toFixed(3)+' ms\n')

// verifying transactions
startTime = performance.now()
let verified = []
while (signs.length > 0) {
    let tx = signs[0]
    verified.push(signs.splice(0, 1))
    verify(tx)
    output('verify', verified.length)
}

timeDiff = performance.now()-startTime
console.log('Verify took: '+timeDiff.toFixed(3)+' ms\n')