# API node indexing

Additional indexes that can be added to public API nodes to optimize transaction and account history API performance. This requires approximately 400MB in additional disk space and will increase as chain grows. To be run in the `mongo` shell.

## Index transactions by hash

```
db.blocks.createIndex({'txs.hash':1})
```

## Index account history data:

```
db.blocks.createIndex({'txs.sender':1})
db.blocks.createIndex({'txs.data.target':1})
db.blocks.createIndex({'txs.data.receiver':1})
db.blocks.createIndex({'txs.data.pa':1})
db.blocks.createIndex({'txs.data.author':1})
```
