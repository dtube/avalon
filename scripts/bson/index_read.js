const fs = require('fs')
const BSON = require('bson')

let blockHeight = process.argv[2] || 0

if (isNaN(blockHeight) || parseInt(blockHeight) < 0)
    throw new Error('block height must be a valid non-negative integer')

// Read a block from BSON file using the index file
let blocksIndexDir = process.env.BLOCKS_DIR+'/blocks.index'
let blocksIndexSize = fs.statSync(blocksIndexDir).size
let blocksBsonDir = process.env.BLOCKS_DIR+'/blocks.bson'
let blocksBsonSize = fs.statSync(blocksBsonDir).size
let indexBuf = Buffer.alloc(8)
let fd = fs.openSync(blocksBsonDir,'r')
let fdIndex = fs.openSync(blocksIndexDir,'r')

console.log('Opened blockchain with',blocksIndexSize/8,'blocks')

if (blockHeight*8 >= blocksIndexSize)
    throw new Error('Index out of range')

fs.readSync(fdIndex,indexBuf,{offset: 0, position: blockHeight*8, length: 8})
let docPosition = Number(BigInt(indexBuf.readUInt32LE(0)) << 8n) + indexBuf.readUInt32LE(4)
if (docPosition >= blocksBsonSize)
    throw new Error('Bson out of range')

let docSizeBuf = Buffer.alloc(4)
fs.readSync(fd,docSizeBuf,{offset: 0, position: docPosition, length: 4})
let docSize = docSizeBuf.readInt32LE(0)
let docBuf = Buffer.alloc(docSize)
fs.readSync(fd,docBuf,{offset: 0, position: docPosition, length: docSize})
console.log(BSON.deserialize(docBuf))
fs.closeSync(fd)
fs.closeSync(fdIndex)