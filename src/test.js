var DecayInt = require('./decayInt.js')

var time = new Date().getTime()
var nextTime = time + 1000*60*20

var printedCoins = 0.001
var newPr = new DecayInt({v:40, t:1540139753895}, {halflife:1000*60*60*24}).decay(nextTime)
console.log(newPr, nextTime)
// var newBalance = 0 + 0 - newPr.v
// newPr.v += printedCoins
// // printedCoins isnt an int so we need to decay again to get a proper int (timestamp will be adjusted)
// newPr = new DecayInt(newPr, {halflife:1000*60*60*24}).decay(nextTime)
