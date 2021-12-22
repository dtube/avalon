const fs = require('fs')

// Open file
let blocksBsonDir = process.env.BLOCKS_DIR+'/blocks.bson'
let blocksBsonSize = fs.statSync(blocksBsonDir).size
let blockHeight = 0
let docPosition = 0
let docSizeBuf = Buffer.alloc(4)
let fd = fs.openSync(blocksBsonDir,'r')

while (docPosition < blocksBsonSize) {
    fs.readSync(fd,docSizeBuf,{offset: 0, position: docPosition, length: 4})
    let currentSize = docSizeBuf.readInt32LE(0)
    console.log('Block #'+blockHeight+' - At byte',docPosition,'with size',currentSize)
    docPosition += currentSize
    blockHeight++
}
fs.closeSync(fd)
