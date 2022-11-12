// floating point

module.exports = (value, canBeZero, canBeNegative, max, min) => {
    if (!max)
        max = Math.pow(2,33)-1
    if (!min)
        if (canBeNegative)
            min = -Math.pow(2,33)+1
        else
            min = 0
    
    if (typeof value !== 'number')
        return false
    if (isNaN(value))
        return false
    let parts = value.toString().split('.')
    if (parts.length > 2)
        return false
    if (parts.length === 2 && parts[1].length > 6)
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