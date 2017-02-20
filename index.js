const fs = require('fs');
const path = require('path');

const Request = require('./api');
const Test = require('./test');
const shared = require('./shared');

const walkSync = function (dir = "", suites, path) {
    let fullPath = path + (dir ? "/" + dir : "");

    fs.readdirSync(fullPath).forEach(function (file) {
        if (fs.statSync(fullPath + '/' + file).isDirectory()) {
            suites = walkSync(dir + '/' + file, suites, path);
        } else {
            suites.push((dir + '/' + file.substring(0, file.length - 3)).substring(1));
        }
    });
    return suites;
};


let tests = [];
let testMap = new Map();

const addSuite = name => {
    let s = require(_config.suitesDir + '/' + name);
    Object.keys(s).forEach(test => addTest(name + '.' + test));
};

const addTestByName = name => {
    if (tests.indexOf(name) === -1)
        tests.push(name);
};

const addTest = (fullName, chain = []) => {
    if (testMap.has(fullName))
        return;
    
    if (!chain)
        chain = [];
    if (chain.length > 5)
        return;

    if (chain.find(el => el == fullName)) {
        throw new Error("cyclic dependency found in tests. check " + fullName + " and its dependencies " + chain.toString());
    }

    let [suiteName, testName] = fullName.split('.');
    let suite = require(_config.suitesDir + '/' + suiteName);
    let testData = suite[testName];
    if (!testData)
        throw new Error("invalid test name " + fullName);
    let before = testData.before || [];

    for (let beforeTest of before) {
        addTest(beforeTest, chain.concat([fullName]));
    }

    let test = new (_config.testClass)(fullName, testData);
    testMap.set(fullName, test);
    tests.push(fullName);
};

const runTest = () => {
    if (!tests.length)
        return;

    let testName = tests.shift();
    let test = testMap.get(testName);
    test.passed(() => {
        test.end();

        if (test.error) {
            console.error(test.error);
        } else {
            runTest();
        }
    });

    test.run({
        suitesDir: _config.suitesDir,
        apiUrl: _config.apiUrl,
    });
};

let _config = null;

module.exports = {
    init: config => {
        _config = config || {};

        if (!_config.initialTests) {
            _config.initialTests = [];
        }

        if (!_config.suitesDir) {
            _config.suitesDir = process.cwd();
        } else if (_config.suitesDir.substr(0, 1) == '.') {
            _config.suitesDir = path.resolve(process.cwd() + '/' + _config.suitesDir);
        }

        if (!_config.testClass) {
            _config.testClass = Test.Test;
        }
    },

    run: () => {
        const suites = walkSync("", [], _config.suitesDir);

        for (let testName of _config.initialTests) {
            addTest(testName);
        }

        for (let suiteName of suites) {
            addSuite(suiteName);
        }

        console.log(tests.toString());
        runTest();
    },

    config: () => {
        return _config;
    },

    Request,
    Test: Test.Test,
    TestData: Test.TestData,
    shared
};