const fs = require('fs')

// Create index
let blocksIndexDir = process.env.BLOCKS_DIR+'/blocks.index'
let blocksBsonDir = process.env.BLOCKS_DIR+'/blocks.bson'
let blocksBsonSize = fs.statSync(blocksBsonDir).size
let existingIndexSize = fs.statSync(blocksIndexDir).size
let docPosition = BigInt(0)
let docSizeBuf = Buffer.alloc(4)
let docIndexBuf = Buffer.alloc(8)
let fd = fs.openSync(blocksBsonDir,'r')
let fdIndex = fs.openSync(blocksIndexDir,'a+')
let startTime = new Date().getTime()

if (existingIndexSize > 0) {
    if (existingIndexSize % 8 > 0)
        throw new Error('Index is inconsistent with blocks.bson')
    fs.readSync(fdIndex,docIndexBuf,{offset: 0, position: existingIndexSize-8, length: 8})
    docPosition = BigInt(Number(BigInt(docIndexBuf.readUInt32LE(0)) << 8n) + docIndexBuf.readUInt32LE(4))
    if (Number(docPosition) >= blocksBsonSize)
        throw new Error('Bson out of range')
    fs.readSync(fd,docSizeBuf,{offset: 0, position: docPosition, length: 4})
    let docSize = BigInt(docSizeBuf.readInt32LE(0))
    docPosition += docSize
    console.log('Resuming index creation from block',existingIndexSize/8)
}

while (docPosition < blocksBsonSize) {
    fs.readSync(fd,docSizeBuf,{offset: 0, position: Number(docPosition), length: 4})
    docIndexBuf.writeUInt32LE(Number(docPosition >> 8n), 0)
    docIndexBuf.writeUInt32LE(Number(docPosition & 0xFFn), 4)
    fs.writeSync(fdIndex,docIndexBuf)
    docPosition += BigInt(docSizeBuf.readInt32LE(0))
}
fs.closeSync(fd)
console.log('Index created in',new Date().getTime()-startTime,'ms!')