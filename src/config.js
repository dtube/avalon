var config = {
    history: {
        0: {
            // the account pricing options
            // see: https://www.wolframalpha.com/input/?i=plot+10%2B100*(1.1%5E(14-x))+from+x%3D1+to+x%3D40
            accountPriceBase: 100,
            accountPriceCharMult: 1.1,
            accountPriceChars: 14,
            accountPriceMin: 1,
            // allowed username chars
            allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
            allowedUsernameCharsOnlyMiddle: '-.',
            // should we allow people to vote multiple times on the same content ?
            allowRevotes: false,
            // the base58 encoding alphabet
            b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
            // the block time in ms
            blockTime: 3000,
            // the number of ms needed for 1 DTC to generate 1 byte of bw
            bwGrowth: 60000,
            // the maximum bandwidth an account can have available
            bwMax: 1048576,
            // the number of blocks from the past taken into consideration for econonomics
            ecoBlocks: 1200,
            // how many max leaders there can be, and how much tokens and VT they earn per "mined" block
            leaderReward: 1,
            leaderRewardVT: 1000,
            leaders: 4,
            // the "master" account starting stake (total starting supply)
            masterBalance: 1000000,
            // the number of tokens distributed before master gets 1 free token printed.
            // masterFee = 2 => 33% fee
            // masterFee = 4 => 20% fee
            // masterFee = 9 => 10% fee
            // masterFee = 19 => 5% fee
            masterFee: 9,
            // the init account username
            masterName: 'master',
            // if false master can create accounts with usernames without burning tokens
            masterPaysForUsernames: false,
            // the master account public original key
            masterPub: 'qFsrM3bBfJmWsEZLxpv2QDrDnUtZTwqrrPiLsZpaGGSR',
            // the fake hash of block 0 (new origin hash -> new chain)
            originHash: '0000000000000000000000000000000000000000000000000000000000000021',
            // the time after which transactions expire and wont be accepted by nodes anymore
            txExpirationTime: 60000,
            // limit which transactions are available
            // key: transaction id (see transaction.js:TransactionType)
            // value: null/0 (default): enabled, 1: disabled, 2: master-only
            txLimits: {
                0: 2,
                4: 2
            },
            // the number of ms needed for 1 DTC to generate 1 vt
            vtGrowth: 3600000
        },
        // example of increasing leader rewards to 5 after block 100
        100: {leaderReward: 5}
    },
    read: (blockNum) => {
        var finalConfig = {}
        for (const key in config.history) {
            if (blockNum >= key)
                Object.assign(finalConfig, config.history[key])
            else break
        }
        return finalConfig
    }
} 

module.exports = config