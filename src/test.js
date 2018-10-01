var GrowInt = require('./growInt.js')
var test = new GrowInt(
    {v:0, t:new Date().getTime()},
    {growth: 0.157496874}
)
console.log(test)

setTimeout(function() {
    var time = new Date().getTime()
    var test2 = test.grow(time)
    console.log(test2)
    console.log(test2.t - time)
}, 5555)