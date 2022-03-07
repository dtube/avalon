module.exports = {
    init: (app) => {
        /**
         * @api {get} /account/:name Account Info
         * @apiName account
         * @apiGroup Accounts
         * 
         * @apiParam {String} name Username to query
         * 
         * @apiSuccess {String} name Username of account
         * @apiSuccess {String} pub Master public key of account
         * @apiSuccess {Integer} balance Account balance in terms of 0.01 DTUBE
         * @apiSuccess {Object} bw Bandwidth object
         * @apiSuccess {Object} vt Voting Power (VP) object
         * @apiSuccess {Array} follows List of following accounts
         * @apiSuccess {Array} followers List of follower accounts
         * @apiSuccess {Object[]} keys List of account custom keys
         * @apiSuccess {String} keys.id Custom key identifier
         * @apiSuccess {String} keys.pub Custom public key
         * @apiSuccess {Integer[]} keys.types Allowed transaction types for the custom key
         * @apiSuccess {Integer} [keys.weight] Custom key weight
         * @apiSuccess {Object} [json] Account metadata JSON
         * @apiSuccess {Array} approves List of leaders the account has approved
         * @apiSuccess {Integer} [node_appr] Leader approval
         * @apiSuccess {String} [pub_leader] Leader signing public key of account
         */
        app.get('/account/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else res.send(account)
            })
        })
    }
}
