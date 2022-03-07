const fs = require('fs')

// Create index
let blocksIndexDir = process.env.BLOCKS_DIR+'/blocks.index'
let blocksBsonDir = process.env.BLOCKS_DIR+'/blocks.bson'
let blocksBsonSize = fs.statSync(blocksBsonDir).size
let docPosition = BigInt(0)
let docSizeBuf = Buffer.alloc(4)
let docIndexBuf = Buffer.alloc(8)
let fd = fs.openSync(blocksBsonDir,'r')
let fdIndex = fs.openSync(blocksIndexDir,'w')
let startTime = new Date().getTime()

while (docPosition < blocksBsonSize) {
    fs.readSync(fd,docSizeBuf,{offset: 0, position: Number(docPosition), length: 4})
    docIndexBuf.writeUInt32LE(Number(docPosition >> 8n), 0)
    docIndexBuf.writeUInt32LE(Number(docPosition & 0xFFn), 4)
    fs.writeSync(fdIndex,docIndexBuf)
    docPosition += BigInt(docSizeBuf.readInt32LE(0))
}
fs.closeSync(fd)
console.log('Index created in',new Date().getTime()-startTime,'ms!')