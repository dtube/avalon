var javalon = require('javalon')
javalon.init({api: 'http://localhost:3001'})
var Chance = require('chance')
var chance = new Chance()

var start_account = 33
var starting_dtc = 333
var tpups = 0.05
var wait = 3000
var master_pub = 'yLuiXbuU1Pw8SbzJ3BYhcXdCQ81jFPsYwryKEibGWRNo'
var master_wif = 'DE2WEkbpFo2hec255b1XasotVa3ZqefPETsGQuSzrnMp'
var master_name = 'master'
var accounts = []
var contents = []
var beggars = []

// wait a bit
setTimeout(function() {
    // create some accounts
    accounts = createMassAccs(start_account)
    // wait a bit more
    setTimeout(function() {
        // send them money
        depositMoney(starting_dtc)
        foreverDo()
        function foreverDo() {
            var time = 1000/(tpups*accounts.length)
            setTimeout(function() {
                genericActivity()
                foreverDo()
            }, time)
        }
    }, wait)
}, wait)

function createMassAccs(nAcc) {
    // generate random usernames
    var names = []
    var i=0
    while (i<nAcc) {
        names.push(chance.name().toLowerCase().replace(' ', '-'))
        i++
    }

    // create accounts
    for (let i = 0; i < names.length; i++) {
        var tx = {
            type: javalon.TransactionType.NEW_ACCOUNT,
            data: {
                name: names[i],
                pub: master_pub
            }
        }
        tx = javalon.sign(master_wif, master_name, tx)
        console.log('creating '+tx.data.name)
        console.log(tx)
        javalon.sendRawTransaction(tx, function(err, res) {
        })
    }
    return names
}

function depositMoney(amount) {
    for (let i = 0; i < accounts.length; i++) {
        var tx = {
            type: javalon.TransactionType.TRANSFER,
            data: {
                receiver: accounts[i],
                amount: amount,
                memo: chance.word()
            }
        }
        tx = javalon.sign(master_wif, master_name, tx)
        console.log('deposit '+tx.data.receiver+' '+amount)
        javalon.sendRawTransaction(tx, function(err, res) {
            
        })
    }
}

function genericActivity() {
    var txType = chance.pickone([
        javalon.TransactionType.NEW_ACCOUNT,
        javalon.TransactionType.APPROVE_NODE_OWNER,
        javalon.TransactionType.DISAPROVE_NODE_OWNER,
        javalon.TransactionType.TRANSFER,
        javalon.TransactionType.TRANSFER,
        javalon.TransactionType.TRANSFER,
        javalon.TransactionType.TRANSFER,
        javalon.TransactionType.COMMENT,
        javalon.TransactionType.COMMENT,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.VOTE,
        javalon.TransactionType.FOLLOW,
        javalon.TransactionType.UNFOLLOW,
        // javalon.TransactionType.PROMOTED_COMMENT
    ])
    var tx = {
        type: txType,
        data: {}
    }
    var sender = chance.pickone(accounts)
    if (!sender) {
        console.log(accounts)
        throw 'bug'
    }
    var ifConfirm = null
    switch (txType) {
    case javalon.TransactionType.NEW_ACCOUNT:
        tx.data.pub = master_pub
        tx.data.name = chance.name().toLowerCase().replace(' ', '-')
        ifConfirm = () => {
            beggars.push(tx.data.name)
        }
        break

    case javalon.TransactionType.APPROVE_NODE_OWNER:
        tx.data.target = chance.pickone(accounts)
        break
        
    case javalon.TransactionType.DISAPROVE_NODE_OWNER:
        tx.data.target = chance.pickone(accounts)
        break

    case javalon.TransactionType.TRANSFER:
        if (beggars.length > 0) {
            tx.data.amount = 1
            tx.data.receiver = beggars[0]
            ifConfirm = function() {
                if (accounts.indexOf(tx.data.receiver) === -1)
                    accounts.push(tx.data.receiver)
                if (beggars.indexOf(tx.data.receiver) > -1)
                    beggars.splice(beggars.indexOf(tx.data.receiver), 1)
            }
        } else {
            tx.data.amount = Math.pow(2, chance.integer({min:0, max:10}))
            tx.data.receiver = chance.pickone(accounts)
        }
        
        tx.data.memo = chance.word()
        break

    case javalon.TransactionType.COMMENT:
        tx.data.link = chance.hash({length: 14})
        if (chance.bool() || contents.length === 0) {
            tx.data.pa = null
            tx.data.pp = null
        } else {
            var parent = chance.pickone(contents)
            tx.data.pa = parent.author
            tx.data.pp = parent.link
        }

        tx.data.json = {
            title: chance.sentence(),
            description: chance.paragraph(),
            author: sender,
            quality: Math.abs(chance.normal())
        }
        tx.data.vt = chance.integer({min:1, max:20})
        tx.data.tag = chance.word()
        ifConfirm = () => {
            contents.push(tx.data)
        }
        break

    case javalon.TransactionType.PROMOTED_COMMENT:
        tx.data.link = chance.hash({length: 14})
        tx.data.pa = null
        tx.data.pp = null
        tx.data.json = {
            title: chance.sentence(),
            description: chance.paragraph(),
            author: sender,
            quality: Math.abs(chance.normal())
        }
        tx.data.vt = chance.integer({min:1, max:20})
        tx.data.tag = chance.word()
        tx.data.burn = 1
        break

    case javalon.TransactionType.VOTE:
        if (contents.length === 0) return
        var target = chance.weighted(contents, contents.map(x=>x.json.quality))
        tx.data.author = target.json.author
        tx.data.link = target.link
        tx.data.vt = Math.pow(2, chance.integer({min:0, max:10}))
        tx.data.tag = chance.word()
        break

    case javalon.TransactionType.FOLLOW:
        tx.data.target = chance.pickone(accounts)
        break

    case javalon.TransactionType.UNFOLLOW:
        tx.data.target = chance.pickone(accounts)
        break

    default:
        break
    }
    signAndSend(tx, sender, ifConfirm, function(err, res) {
        if (err)
            console.log(err)
        else {
            console.log(accounts.length, beggars.length)
        } 
    })
}

function signAndSend(tx, sender, ifConfirm, cb) {
    tx = javalon.sign(master_wif, sender, tx)
    javalon.sendTransaction(tx, function(err, res) {
        if (!err && ifConfirm) ifConfirm()
        cb(err, res)
    })
}