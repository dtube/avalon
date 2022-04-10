// allowed transaction types (array of strictly positive integers)
// with at least 1 element
module.exports = (value,maxLength) => {
    if (!value)
        return false
    if (!Array.isArray(value))
        return false
    if (value.length < 1)
        return false
    if (maxLength && value.length > maxLength)
        return false

    return true
}
