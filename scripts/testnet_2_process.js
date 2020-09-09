// start this script directly from mongo cli
// with load("<path/to/file>")

db.contents.update({},{$set: {votes: []}}, {multi: true})
db.contents.update({},{$set: {dist: 0}}, {multi: true})
db.contents.update({},{$set: {tags: {}}}, {multi: true})
db.accounts.update({name: 'dtube'}, {$set: {pub_leader: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz'}})
db.accounts.update({'json.node.ws': {$exists:true}}, {$unset: {'json.node.ws': ''}}, {multi: true})


// db.accounts.update({name: 'dtube'},{$set: {pub: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz'}}, {multi: true})
