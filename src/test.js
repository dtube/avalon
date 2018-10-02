var GrowInt = require('./growInt.js')


var voteTokens = new GrowInt({v:0, t:0}, {growth:1000000/60000})
var vt = voteTokens.grow(ts)
console.log(vt)