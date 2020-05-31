var eco = require('./economics.js')

var ts1 = 0
var ts2 = 0

var h = 0
while (h < 8*24) {
    console.log(h, eco.rentability(ts1, ts2))
    ts2 += 1000*60*60
    h++
}