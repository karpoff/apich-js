const EventEmitter = require('events');
const Request = require('./api');
const shared = require('./shared');

class TestData {
    constructor(test, options) {
        this._test = test;
        this._options = options;
        this._requests = [];
    }

    addRequest(req) {
        this._requests.push(req);
        return req;
    }

    call(url) {
        return this.addRequest(new Request(url, this._options));
    }

    shared(name, item) {
        if (!item) {
            item = name;
            name = this._test._name;
        }
        let d = shared.get(name);
        return d ? d[item] : null;
    }

    _shiftRequest() {
        return this._requests.length ? this._requests.shift() : null;
    }
}


class Test {
    getTestDataClass() {
        return TestData;
    }

    constructor(name, data) {
        this._name = name;
        this._data = data;
        this._events = new EventEmitter();

        this._events.on("request", this._makeRequest.bind(this));
        this._events.on("passed", this._onPassed.bind(this));
    }

    run(options) {

        try {
            this._testData = new (this.getTestDataClass())(this, options);

            this._data.run(this._testData);

            this._events.emit("request");
        } catch (e) {
            this._error = e.message + "\n\n" + e.stack;
            this._events.emit("passed");
        }

    }

    end() {
        this._events.removeAllListeners();
        delete this._passedCallback;
        delete this._events;
    }

    _makeRequest() {
        let request = this._testData._shiftRequest();

        if (!this._error && request) {
            request.go()
                .then(result => {
                    if (result.data !== null) {
                        shared.set(this._name, Object.assign(shared.get(this._name, {}), result.data));
                    }

                    this._events.emit("request");
                })
                .catch(result => {
                    this._error = result.message;
                    this._events.emit("passed");
                });
        } else {
            this._events.emit("passed");
        }
    }

    get error() {
        return this._error;
    }

    passed(callback) {
        this._passedCallback = callback;
    }

    _onPassed() {
        if (this._passedCallback) {
            this._passedCallback();
        }
    }
}

module.exports = {
    Test,
    TestData
};