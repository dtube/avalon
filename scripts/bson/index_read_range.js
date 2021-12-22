const fs = require('fs')
const BSON = require('bson')

let blockHeight = process.argv[2] || 0
let blockHeightEnd = process.argv[3] || 1

if (isNaN(blockHeight) || parseInt(blockHeight) < 0)
    throw new Error('start block height must be a valid non-negative integer')
else if (isNaN(blockHeightEnd) || parseInt(blockHeightEnd) < 0)
    throw new Error('end block height must be a valid non-negative integer')
else if (blockHeight > blockHeightEnd)
    throw new Error('blockHeight > blockHeightEnd')

// Read a block from BSON file using the index file
let blocksIndexDir = process.env.BLOCKS_DIR+'/blocks.index'
let blocksIndexSize = fs.statSync(blocksIndexDir).size
let blocksBsonDir = process.env.BLOCKS_DIR+'/blocks.bson'
let blocksBsonSize = fs.statSync(blocksBsonDir).size
let indexBuf = Buffer.alloc(8)
let indexBufEnd = Buffer.alloc(8)
let fd = fs.openSync(blocksBsonDir,'r')
let fdIndex = fs.openSync(blocksIndexDir,'r')

console.log('Opened blockchain with',blocksIndexSize/8,'blocks')

if (blockHeight*8 >= blocksIndexSize)
    throw new Error('Index out of range')
else if (blockHeightEnd*8 >= blocksIndexSize)
    blockHeightEnd = (blocksIndexSize/8)-1

fs.readSync(fdIndex,indexBuf,{offset: 0, position: blockHeight*8, length: 8})
fs.readSync(fdIndex,indexBufEnd,{offset: 0, position: blockHeightEnd*8, length: 8})
let docPosition = Number(BigInt(indexBuf.readUInt32LE(0)) << 8n) + indexBuf.readUInt32LE(4)
let docPositionEnd = Number(BigInt(indexBufEnd.readUInt32LE(0)) << 8n) + indexBufEnd.readUInt32LE(4)
if (docPosition >= blocksBsonSize || docPositionEnd >= blocksBsonSize)
    throw new Error('Bson out of range')

let docSizeBufEnd = Buffer.alloc(4)
fs.readSync(fd,docSizeBufEnd,{offset: 0, position: docPositionEnd, length: 4})
let docSizeEnd = docSizeBufEnd.readInt32LE(0)
console.log(docPositionEnd,docPosition,docSizeEnd)
let rangeSize = docPositionEnd-docPosition+docSizeEnd
let docBuf = Buffer.alloc(rangeSize)
let docArr = []
fs.readSync(fd,docBuf,{offset: 0, position: docPosition, length: rangeSize})
BSON.deserializeStream(docBuf,0,blockHeightEnd-blockHeight+1,docArr,0)
// console.log(docArr[0])
// console.log(docArr[docArr.length-1])
console.log(docArr)
fs.closeSync(fd)
fs.closeSync(fdIndex)