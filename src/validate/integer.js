// validates amount, burn (strictly positive)
// vt (can be negative but still non zero) 

module.exports = (value, canBeZero, canBeNegative, max, min) => {
    if (!max)
        max = Number.MAX_SAFE_INTEGER
    if (!min)
        if (canBeNegative)
            min = Number.MIN_SAFE_INTEGER
        else
            min = 0
    
    if (typeof value !== 'number')
        return false
    if (!Number.isSafeInteger(value))
        return false
    if (!canBeZero && value === 0)
        return false
    if (!canBeNegative && value < 0)
        return false
    if (value > max)
        return false
    if (value < min)
        return false

    return true
}