// validates pub

module.exports = (value, max) => {
    if (!value)
        return false
    if (typeof value !== 'string')
        return false
    if (max && value.length > max)
        return false
    if (!chain.isValidPubKey(value))
        return false
        
    return true
}