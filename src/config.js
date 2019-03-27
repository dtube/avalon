var config = {
    // the fake hash of block 0 (new origin hash -> new chain)
    originHash: "0000000000000000000000000000000000000000000000000000000000000020",
    // the block time in ms
    blockTime: 3000,
    // the base58 encoding alphabet
    b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    // allowed username chars
    allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
    allowedUsernameCharsOnlyMiddle: '-.',
    // the init account username
    masterName: 'master',
    // the init account starting stake (total starting supply)
    masterBalance: 1000000,
    // the init account public key
    masterPub: 'qFsrM3bBfJmWsEZLxpv2QDrDnUtZTwqrrPiLsZpaGGSR',
    // the number of ms needed for 1 DTC to generate 1 byte of bw
    bwGrowth: 60000,
    // the maximum bandwidth an account can have available
    maxBw: 1048576,
    // the number of ms needed for 1 DTC to generate 1 vt
    vtGrowth: 3600000,
    // the time after which transactions expire and wont be accepted by nodes anymore
    txExpirationTime: 60000,
    // the number of blocks from the past taken into consideration for econonomics
    ecoBlocks: 1200,
    // if you want to create more startup accounts
    // extraAccounts: [
    //     {name: 'miner1', pub: 'reztkvUuGDReb7vihBiVS6kJkFLfJchYrQDgFzA76Kfx', balance: 1000},
    //     {name: 'miner2', pub: '27nC6LqdkTNsQF2srecqPxxCpcTbNYHSa5fa2G6q3vVwu', balance: 1000},
    // ]
} 

module.exports = config