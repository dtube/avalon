# API node indexing

Additional indexes that can be added to public API nodes to optimize account history API performance. This requires approximately 200MB in additional disk space and will increase as chain grows. Requires `TX_HISTORY` module to be enabled. To be run in the `mongosh` shell.

```
db.txs.createIndex({'sender':1})
db.txs.createIndex({'data.target':1})
db.txs.createIndex({'data.receiver':1})
db.txs.createIndex({'data.pa':1})
db.txs.createIndex({'data.author':1})
db.txs.createIndex({'includedInBlock':-1})
```
