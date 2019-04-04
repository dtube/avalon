var config = {
    read: (blockNum) => {
        var finalConfig = {}
        for (const key in config.history) {
            if (blockNum >= key)
                Object.assign(finalConfig, config.history[key])
            else break
        }
        return finalConfig
    },
    history: {
        0: {
            // the fake hash of block 0 (new origin hash -> new chain)
            originHash: "0000000000000000000000000000000000000000000000000000000000000021",
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
            // the number of tokens distributed before master gets 1 free token printed.
            // masterFee = 2 => 33% fee
            // masterFee = 4 => 20% fee
            // masterFee = 9 => 10% fee
            // masterFee = 19 => 5% fee
            masterFee: 9,
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
            baseAccountPrice: 100,
            baseAccountChars: 14,
            extraCharPriceMult: 1.1,
            minAccountPrice: 1,
            // if you want to create more startup accounts
            // extraAccounts: [
            //     {name: 'miner1', pub: 'reztkvUuGDReb7vihBiVS6kJkFLfJchYrQDgFzA76Kfx', balance: 1000},
            //     {name: 'miner2', pub: '27nC6LqdkTNsQF2srecqPxxCpcTbNYHSa5fa2G6q3vVwu', balance: 1000},
            // ]
        },
        100: {
            minAccountPrice: 10
        }
    }
} 

module.exports = config