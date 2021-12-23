let eco = require('./economics.js')

let ts1 = 0
let ts2 = 0

let h = 0
while (h < 8*24) {
    console.log(h, eco.rentability(ts1, ts2))
    ts2 += 1000*60*60
    h++
}