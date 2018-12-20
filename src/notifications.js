notifications = {
    processBlock: (block) => {
        if (block._id % 3600)
            notifications.purgeOld(block)

        for (let i = 0; i < block.txs.length; i++)
            notifications.processTx(block.txs[i], block.timestamp);
    },
    purgeOld: (block) => {
        db.collection('notifications').remove({
            blockId: {$lt: block._id-(3600*56)}
        })
    },
    processTx: (tx, ts) => {
        switch (tx.type) {
            case 1:
            case 7:
                // approve node owner, follow
                var notif = {
                    u: tx.data.target,
                    tx: tx,
                    ts: ts
                }
                db.collection('notifications').insertOne(notif, function(err) {
                    if (err) throw err;
                })
                break;

            case 3:
                // transfer
                var notif = {
                    u: tx.data.receiver,
                    tx: tx,
                    ts: ts
                }
                db.collection('notifications').insertOne(notif, function(err) {
                    if (err) throw err;
                })
                break;

            case 4:
                // comment: see https://github.com/busyorg/busy-api/blob/develop/server.js#L125
                
                /** Find replies */
                if (tx.data.pa) {
                    var notif = {
                        u: tx.data.pa,
                        tx: tx,
                        ts: ts
                    };
                    notif.tx.data.json = {}
                    db.collection('notifications').insertOne(notif, function(err) {
                        if (err) throw err;
                    })
                }
        
                /** Find mentions */
                var content = JSON.stringify(tx.data.json)
                var words = content.split('@')
                var i = 1
                var mentions = 0
                while (mentions < 10 && i<words.length) {
                    for (let y = 0; y < words[i].length; y++) {
                        if (chain.allowedUsernameChars.indexOf(words[i][y]) == -1) {
                            if (y > 0) {
                                var notif = {
                                    u: words[i].substring(0,y),
                                    tx: tx,
                                    ts: ts
                                };
                                delete notif.tx.data.json
                                db.collection('notifications').insertOne(notif, function(err) {
                                    if (err) throw err;
                                })
                                mentions++
                            }
                            break
                        }
                    }
                    i++
                }
                break

            case 5:
                // vote
                var notif = {
                    u: tx.data.author,
                    tx: tx,
                    ts: ts
                }
                db.collection('notifications').insertOne(notif, function(err) {
                    if (err) throw err;
                })
                break;
        
            default:
                break;
        }
    }
}

module.exports = notifications