// RUN THIS WHEN UPDATING FOR AUTHOR TIP HARDFORK
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017'
const dbName = 'avalon'
let updateCount = 0
MongoClient.connect(url, {useUnifiedTopology: true}, function(err, client) {
    let db = client.db(dbName)
    db.collection('contents').find({}).toArray(async (e,contents) => {
        for (let c in contents) {
            let updateVotes = contents[c].votes
            for (let v in updateVotes)
                updateVotes[v].gross = updateVotes[v].claimable
            db.collection('contents').updateOne({_id: contents[c]._id},{$set:{votes:updateVotes}}).then(() => {
                updateCount++
                if (updateCount === contents.length) {
                    console.log('update complete')
                    process.exit(0)
                }
            })
        }
        console.log('updating',contents.length,'docs')
    })
})