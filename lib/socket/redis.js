'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');

module.exports = class {
    constructor(options = {}) {
        this.options = {
            host: options.redis_host || '127.0.0.1',
            port: options.redis_port || 6379,
            auth_pass: options.redis_password || '',
            db: options.redis_db || '0',
            connect_timeout: options.redis_timeout || 5000
        };
        this.handle = null;
        this.deferred = null;
    }

    connect() {
        if (this.handle) {
            return this.deferred.promise;
        }
        let deferred = lib.getDefer();

        let redis = require('redis');
        let connection = redis.createClient(this.options);
        // if (this.options.auth_pass) {
        //     connection.auth(this.options.auth_pass, function () {
        //     });
        // }
        // if (this.options.db) {
        //     connection.select(this.options.db, function () {
        //     });
        // }
        connection.on('ready', () => {
            deferred.resolve();
        });
        connection.on('connect', () => {
            deferred.resolve();
        });
        connection.on('error', err => {
            this.close();
            deferred.reject(err);
        });
        connection.on('end', () => {
            this.close();
            deferred.reject('connection end');
        });
        this.handle = connection;
        if (this.deferred) {
            this.deferred.reject(new Error('connection closed'));
        }
        this.deferred = deferred;
        return this.deferred.promise;
    }

    close() {
        if (this.handle) {
            this.handle.quit();
            this.handle = null;
        }
    }

    /**
     *
     * @param name
     * @param data
     */
    wrap(name, data) {
        var _this = this;

        return (0, _asyncToGenerator3.default)(function* () {
            let deferred = lib.getDefer();
            yield _this.connect().catch(function (e) {
                return deferred.reject(e);
            });
            if (!lib.isArray(data)) {
                data = data === undefined ? [] : [data];
            }
            data.push(function (err, da) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(da);
                }
            });
            if (_this.handle) {
                _this.handle[name].apply(_this.handle, data);
            } else {
                deferred.reject('connection end');
            }
            return deferred.promise;
        })();
    }
};