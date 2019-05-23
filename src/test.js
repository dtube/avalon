const bs58 = require('base-x')('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')
const secp256k1 = require('secp256k1')
const priv = 'GCCURCQonXq9hujm8EDoRjBq83NAbkVj1nrAS1WXG5Z6'
const rawPriv = bs58.decode(priv)
const rawPub = secp256k1.publicKeyCreate(rawPriv)
const pub = bs58.encode(rawPub)

console.log(priv)
console.log(rawPriv)
console.log(rawPub)
console.log(pub)