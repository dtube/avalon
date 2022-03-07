const fs = require('fs')

// Read index file and output to console
let indexDir = process.env.BLOCKS_DIR+'/blocks.index'
let indexSize = fs.statSync(indexDir).size
let indexBuf = Buffer.alloc(8)
let fd = fs.openSync(indexDir,'r')

const getBytePosition = (blockHeight) => {
    if (isNaN(blockHeight) || parseInt(blockHeight) < 0)
        throw new Error('block height must be a valid non-negative integer')
    if (blockHeight*8 >= indexSize)
        throw new Error('Out of bounds')
    fs.readSync(fd,indexBuf,{offset: 0, position: blockHeight*8, length: 8})
    let docPosition = Number(BigInt(indexBuf.readUInt32LE(0)) << 8n) + indexBuf.readUInt32LE(4)
    console.log('Block #'+blockHeight+' - At byte',docPosition)
}

const traverseIndex = (blockHeight = 0) => {
    if (blockHeight*8 < indexSize) {
        getBytePosition(blockHeight)
        traverseIndex(blockHeight+1)
    }
}

if (process.argv[2] === 'traverse')
    traverseIndex()
else
    getBytePosition(process.argv[2] || 0)

fs.closeSync(fd)