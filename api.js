const request = require('request');
const chai = require('chai');
chai.should();

const shared = require('./shared');
const config = require('./').config;
const okapi = require('./');

class Request {
    constructor(url, options) {
        this._data = []; // data setters
        this._checkers = []; // check functions to check response

        this._storers = []; // store function to store data for further usage

        this._options = []; //option setters
        this._options.push(opts => opts.headers = {'Accept': 'application/json', 'Content-Type': 'application/json'});
        this._options.push(opts => opts.url = (options ? options.apiUrl : '') + url);

        this.status(200);
    }

    data(d) {
        this._data.push(d);
        return this;
    }

    options(opt) {
        chai.assert.typeOf(opt, "function");
        this._options.push(opt);
        return this;
    };

    store(store) {
        chai.assert.typeOf(store, "function");
        this._storers.push(store);
        return this;
    }

    _addChecker(name, data) {

        let checker;
        for (let ch of this._checkers) {
            if (ch.name == name) {
                checker = ch;
                break;
            }
        }

        if (!checker) {
            this._checkers.push({
                name,
                values: []
            });
            checker = this._checkers[this._checkers.length - 1];
        }

        checker.values.push({
            place: new Error().stack.split("\n")[3],
            data
        });
    }

    _setChecker(name, data) {
        let checker;
        for (let ch of this._checkers) {
            if (ch.name == name) {
                checker = ch;
                break;
            }
        }

        if (!checker) {
            this._checkers.push({
                name,
                values: []
            });
            checker = this._checkers[this._checkers.length - 1];
        }

        checker.values = [{
            data,
            place: new Error().stack.split("\n")[3]
        }];
    }

    status(status) {
        this._setChecker('status', status);
        return this;
    }

    check_status(response, status) {
        chai.assert.equal(response.httpResponse.statusCode, status);
    }

    response(resp) {
        chai.assert.typeOf(resp, "function");
        this._addChecker('response', resp);
        return this;
    };

    check_response(response, checker) {
        checker(response);
    };


    //////////////////////////////////
    go() {

        return new Promise((resolve, reject) => {

            let data = {};
            let opts = {};

            try {
                this._data.forEach(d => {
                    if (typeof d === 'function')
                        Object.assign(data, d(data));
                    else
                        Object.assign(data, d);
                });

                opts.json = data;
                this._options.forEach(option => option(opts));
            } catch (e) {
                reject({
                    success: false,
                    message: e.message + "\n" + e.stack
                });
                return;
            }

            request.post(opts, (err, httpResponse, body) => {

                let response = {
                    httpResponse,
                    body
                };

                this._checkers.forEach(checker => {
                    const checkerMethod = 'check_' + checker.name;
                    chai.assert.typeOf(this[checkerMethod], "function");
                    checker.values.forEach(checkData => {
                        try {
                            this[checkerMethod](response, checkData.data);
                        } catch (e) {
                            let message = "checker '" + checker.name + "' error " + checkData.place.trim() + ". " + e.message + ". data is " + checkData.data.toString() + "\n\n";
                            message += "request: " + opts.url + "\n";
                            message += "data: " + JSON.stringify(opts.json) + "\n";
                            message += "response: " + JSON.stringify(body) + "\n";

                            reject({success: false, message});
                        }
                    });
                });


                try {
                    let storedData = null;
                    this._storers.forEach(store => {
                        let d = store(response);

                        if (d) {
                            if (!storedData)
                                storedData = {};
                            Object.assign(storedData, d);
                        }
                    });

                    resolve({
                        success: true,
                        data: storedData
                    });

                } catch (e) {
                    reject({
                        success: false,
                        message: e.message
                    });
                }
            });
        });
    };

}

module.exports = Request;