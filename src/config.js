var config = {
    history: {
        0: {
            // this is configuration for testnet2

            // the account pricing options
            // see: https://www.wolframalpha.com/input/?i=plot+10%2B100*(1.1%5E(14-x))+from+x%3D1+to+x%3D40
            accountPriceBase: 10000,
            accountPriceCharMult: 1.3,
            accountPriceChars: 8,
            accountPriceMin: 1,
            accountMaxLength: 50,
            accountMinLength: 1,
            activeUserMinBalance: 100, // 1.00 DTC to be counted as an active user and count towards inflation
            // allowed username chars
            allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
            allowedUsernameCharsOnlyMiddle: '-.',
            // should we allow people to vote multiple times on the same content ?
            allowRevotes: false,
            // the base58 encoding alphabet
            b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
            // the start time of the chain
            block0ts: 1590862621000,
            // the block time in ms
            blockTime: 3000,
            // the number of ms needed for 0.01 DTC to generate 1 byte of bw
            bwGrowth: 36000000, // +10 bytes per hour per DTC (3600 * 1000 * 100 / 10)
            // the maximum bandwidth an account can have available
            bwMax: 128000,
            // the number of rounds of consensus before block is valid (min 2)
            consensusRounds: 2,
            // base rentability of votes
            ecoBaseRent: 0.50,
            // the number of blocks from the past taken into consideration for econonomics
            ecoBlocks: 9600, // 8 hours
            // the precision of the claimable amounts
            ecoClaimPrecision: 3,
            // the required number of ms before a vote reward can be claimed
            ecoClaimTime: 604800000,
            // the percentage of coins that are burnt when there are opposite votes with rewards
            ecoPunishPercent: 0.5,
            // the number of ms before a vote reaches 100% rentability
            ecoRentStartTime: 86400000,
            // the number of ms when a vote rentability starts going down
            ecoRentEndTime: 302400000,
            ecoRentPrecision: 6,
            // starting rentability of votes
            ecoStartRent: 0.75,
            // the maximum number of follows a single account can do
            followsMax: 2000,
            // the max size of a stringified json input (content / user profile)
            // best if kept slightly lower than bwMax
            jsonMaxBytes: 120000,
            // the max length of a key identifier
            keyIdMaxLength: 25,
            // how many max leaders there can be, and how much tokens and VT they earn per "mined" block
            leaderReward: 1,
            leaderRewardVT: 500,
            leaders: 10,
            // how long of the end of the block hash is used for the leader pseudo random generator shuffle
            leaderShufflePrecision: 6,
            // the maximum number of leaders an account can vote for
            leaderMaxVotes: 5,
            // the "master" account starting stake (total starting supply)
            // not applied if starting from a genesis.zip file
            masterBalance: 10000000000,
            // the number of tokens distributed before master gets 1 free token printed.
            // masterFee = 2 => <33% fee
            // masterFee = 4 => <20% fee
            // masterFee = 9 => <10% fee
            // masterFee = 19 => <5% fee
            masterFee: 9,
            // the init account username
            masterName: 'dtube',
            // if false master can create accounts with usernames without burning tokens
            masterPaysForUsernames: false,
            // the master account public original key
            masterPub: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz',
            // the master account public leader key (for block production)
            masterPubLeader: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz',
            // the maximum time drift in ms before a block is invalid
            maxDrift: 200,
            // the max length of a transfer memo
            memoMaxLength: 250,
            // defines how long it takes for a notification to get deleted, and how often the purge happens
            // e.g.: purge notifications older than 56*3600 blocks every 3600 blocks
            notifPurge: 3600,
            notifPurgeAfter: 56,
            // the maximum number of mentions triggering a notification
            notifMaxMentions: 10,
            // the sha256sum hash of block 0 (new origin hash -> new chain)
            originHash: '1d76da9582163496ad4e3d5ce7460150efc805c41b74d1e9cd590efb7fffe0ad',
            // the default number of random bytes to use for new key generation
            randomBytesLength: 32,
            // the minimum hourly reward pool (including leader rewards)
            rewardPoolMin: 1,
            // the multiplier for the reward pool, modifying it is a bad practise
            rewardPoolMult: 80, // 0.40 DTC / active user / cycle => 1.2 DTC / active user / day
            // the maximum share of the reward pool a single distribution can generate
            rewardPoolMaxShare: 0.1,
            // the maximum length of tags (on votes)
            tagMaxLength: 25,
            tagMaxPerContent: 5,
            // the time after which transactions expire and wont be accepted by nodes anymore
            txExpirationTime: 60000,
            // limit which transactions are available
            // key: transaction id (see transaction.js:TransactionType)
            // value: null/0 (default): enabled, 1: disabled, 2: master-only
            txLimits: {
                0: 2,
                14: 2,
                15: 2,
            },
            // the number of ms needed for 0.01 DTC to generate 1 vt
            vtGrowth: 360000000, // +1 vt per hour per DTC (3600 * 1000 * 100)
            vtPerBurn: 6 // can be updated in the future to modify incentives
        }
    },
    read: (blockNum) => {
        var finalConfig = {}
        for (const key in config.history) 
            if (blockNum >= key) {
                if (blockNum === parseInt(key) && blockNum !== 0)
                    logr.info('Hard Fork #'+key)
                Object.assign(finalConfig, config.history[key])
            }
            else {
                if (config.history[key].ecoBlocks > finalConfig.ecoBlocks
                && config.history[key].ecoBlocks - finalConfig.ecoBlocks >= key-blockNum)
                    finalConfig.ecoBlocksIncreasesSoon = config.history[key].ecoBlocks
                
                break
            }
            
        
        return finalConfig
    }
} 

module.exports = config