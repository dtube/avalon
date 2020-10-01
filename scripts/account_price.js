config = require('../src/config.js').read(0)
eco = require('../src/economics.js')

var name = ''
console.log('Length\tPrice')
console.log('=====================')
while (name.length < 20) {
    name += 'a'
    var price = (eco.accountPrice(name)/100)+' DTC'
    console.log(name.length+'\t'+price)
}