const BaseExporter = require('headless-chrome-crawler/exporter/base');

/**
 * @implements {BaseExporter}
 */
class SocketExporter {
    constructor(settings) {
        this._settings = settings;
    }

    /**
     * @param {!Object} result
     * @override
     */
    writeLine(result) {
        this._settings.socket.emit("complete", {'result': result, 'url': result.options.url});
    }

    /**
     * @override
     */
    writeHeader() {}

    /**
     * @override
     */
    writeFooter() {}

    end() {    }

    async onEnd() {
        return Promise.resolve(undefined);
    }
}

module.exports = SocketExporter;