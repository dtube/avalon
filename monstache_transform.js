module.exports = function(doc) {
    if (!doc.tags) return doc
    var newTags = ''
    for (var key in doc.tags)
        newTags += ' '+key
    doc.tags = newTags.trim()
    return doc
}