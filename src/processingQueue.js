class ProcessingQueue {
    constructor() {
        this.queue = []
        this.processing = false
    }

    push(f = (cb) => cb()) {
        this.queue.push(f)
        if (!this.processing) {
            this.processing = true
            this.execute()
        }
    }

    execute() {
        let first = this.queue.shift()
        first(() => {
            if (this.queue.length > 0)
                this.execute()
            else
                this.processing = false
        })
    }
}

module.exports = ProcessingQueue