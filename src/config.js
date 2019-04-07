var config = {
    history: {
        0: {
            // the account pricing options
            // see: https://www.wolframalpha.com/input/?i=plot+10%2B100*(1.1%5E(14-x))+from+x%3D1+to+x%3D40
            accountPriceBase: 10,
            accountPriceCharMult: 1.1,
            accountPriceChars: 14,
            accountPriceMin: 1,
            accountMaxLength: 50,
            // allowed username chars
            allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
            allowedUsernameCharsOnlyMiddle: '-.',
            // should we allow people to vote multiple times on the same content ?
            allowRevotes: false,
            // the base58 encoding alphabet
            b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
            // the start time of the chain
            block0ts: 1554643902092,
            // the block time in ms
            blockTime: 3000,
            // the number of ms needed for 1 DTC to generate 1 byte of bw
            bwGrowth: 60000,
            // the maximum bandwidth an account can have available
            bwMax: 1048576,
            // the number of blocks from the past taken into consideration for econonomics
            ecoBlocks: 1200,
            // the maximum number of follows a single account can do
            followsMax: 2000,
            // the max size of a stringified json input (content / user profile)
            jsonMaxBytes: 250000,
            // the max length of a key identifier
            keyIdMaxLength: 25,
            // how many max leaders there can be, and how much tokens and VT they earn per "mined" block
            leaderReward: 0,
            leaderRewardVT: 1,
            leaders: 4,
            // how long of the end of the block hash is used for the leader pseudo random generator shuffle
            leaderShufflePrecision: 6,
            // the maximum number of leaders an account can vote for
            leaderMaxVotes: 5,
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
            // the maximum time drift in ms before a transaction is invalid
            maxDrift: 200,
            // the max length of a transfer memo
            memoMaxLength: 250,
            // defines how long it takes for a notification to get deleted, and how often the purge happens
            // e.g.: purge notifications older than 56*3600 blocks every 3600 blocks
            notifPurge: 3600,
            notifPurgeAfter: 56,
            // the maximum number of mentions triggering a notification
            notifMaxMentions: 10,
            // the fake hash of block 0 (new origin hash -> new chain)
            originHash: '0000000000000000000000000000000000000000000000000000000000000022',
            randomBytesLength: 32,
            // the minimum hourly reward pool (including leader rewards)
            rewardPoolMin: 10,
            // the multiplier for the reward pool,
            rewardPoolMult: 1,
            // the maximum share of the reward pool a single distribution can generate
            rewardPoolMaxShare: 0.1,
            // the maximum length of tags (on votes)
            tagMaxLength: 25,
            // the time after which transactions expire and wont be accepted by nodes anymore
            txExpirationTime: 60000,
            // limit which transactions are available
            // key: transaction id (see transaction.js:TransactionType)
            // value: null/0 (default): enabled, 1: disabled, 2: master-only
            txLimits: {
                3: 2,
                14: 2,
                15: 2
            },
            // the number of ms needed for 1 DTC to generate 1 vt
            vtGrowth: 3600000, // +1 vt per hour per coin
            vtPerBurn: 168 // 24*7 (1 week worth of generation)
            // freezeAccounts: ['hacker1', 'hacker2']
        }
    },
    read: (blockNum) => {
        var finalConfig = {}
        for (const key in config.history) 
            if (blockNum >= key)
                Object.assign(finalConfig, config.history[key])
            else break
        
        return finalConfig
    }
} 

module.exports = config