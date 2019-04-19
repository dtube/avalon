// validates usernames / target / receiver / links
// memo / tag
// key identifier

module.exports = (value, maxLength, minLength, allowedChars, allowedCharsMiddle) => {
    if (!maxLength)
        maxLength = Number.MAX_SAFE_INTEGER
    if (!minLength)
        minLength = 0
    if (typeof value !== 'string')
        return false
    if (value.length > maxLength)
        return false
    if (value.length < minLength)
        return false
    if (allowedChars)
        for (let i = 0; i < value.length; i++)
            if (allowedChars.indexOf(value[i]) === -1)
                if (i === 0 || i === value.length-1)
                    return false
                else if (allowedCharsMiddle && allowedCharsMiddle.indexOf(value[i]) === -1)
                    return false
                    
    return true
}