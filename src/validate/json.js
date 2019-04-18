// content json and profile

module.exports = (value, max) => {
    if (!value)
        return false
    if (typeof value !== 'object')
        return false
    try {
        if (JSON.stringify(value).length > max)
            return false
    } catch (error) {
        return false
    }

    return true
}