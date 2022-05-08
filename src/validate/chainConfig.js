const int = require('./integer')
const float = require('./float')

let types = {
    posInt: (val) => int(val,true,false),
    posNonZeroInt: (val) => int(val,false,false),
    posFloat: (val) => float(val,true,false),
    posNonZeroFloat: (val) => float(val,false,false)
}

// proposals to update any of these must be specified along with the other fields in the same group
let groups = {
    ecoRentTimes: {
        members: ['ecoRentStartTime','ecoRentEndTime','ecoClaimTime'],
        validate: (v1,v2,v3) => v1 < v2 && v2 < v3
    }
}

let groupsInv = (() => {
    let result = {}
    for (let g in groups)
        for (let p in groups[g].members)
            result[groups[g].members[p]] = g
    return result
})()

let parameters = {
    accountPriceBase: types.posNonZeroInt,
    accountPriceCharMult: types.posFloat,
    accountPriceChars: types.posNonZeroInt,
    accountPriceMin: types.posInt,

    ecoStartRent: types.posFloat,
    ecoBaseRent: types.posFloat,
    ecoDvRentFactor: types.posFloat,
    ecoPunishPercent: types.posFloat,
    ecoRentStartTime: types.posNonZeroInt,
    ecoRentEndTime: types.posNonZeroInt,
    ecoClaimTime: types.posNonZeroInt,

    rewardPoolMaxShare: types.posFloat,
    rewardPoolAmount: types.posNonZeroInt,

    masterFee: types.posInt,
    masterDaoTxExp: types.posInt,
    vtPerBurn: types.posNonZeroInt,
    preloadVt: types.posInt,
    preloadBwGrowth: types.posFloat,

    daoVotingPeriodSeconds: types.posNonZeroInt,
    daoVotingThreshold: types.posNonZeroInt,
    chainUpdateFee: types.posNonZeroInt,
    chainUpdateMaxParams: types.posNonZeroInt,
    chainUpdateGracePeriodSeconds: types.posNonZeroInt,
    fundRequestBaseFee: types.posNonZeroInt,
    fundRequestSubFee: types.posInt,
    fundRequestSubMult: types.posNonZeroInt,
    fundRequestSubStart: types.posInt,
    fundRequestContribPeriodSeconds: types.posNonZeroInt,
    fundRequestDeadlineSeconds: types.posNonZeroInt,
    fundRequestDeadlineExtSeconds: types.posNonZeroInt,
    fundRequestReviewPeriodSeconds: types.posNonZeroInt
}

module.exports = {
    groups,
    groupsInv,
    parameters
}