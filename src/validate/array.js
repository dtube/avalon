// allowed transaction types (array of strictly positive integers)
// with at least 1 element
module.exports = (value) => {
    if (!value)
        return false
    if (!Array.isArray(value))
        return false
    if (value.length < 1)
        return false

    return true
}
