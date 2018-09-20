/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const redis = require('ioredis');

module.exports = class {
    constructor(options = {}) {
        this.options = {
            host: options.redis_host || '127.0.0.1',
            port: options.redis_port || 6379,
            auth_pass: options.redis_password || '',
            db: options.redis_db || '0',
            connectTimeout: options.redis_timeout || 5000,
            retryStrategy: 5, //自动尝试重连
            reconnectOnError: true
        };
        this.handle = null;
        this.deferred = null;
    }

    /**
     *
     *
     * @param {number} [connnum=0]
     * @returns
     */
    connect(connnum = 0) {
        if (this.handle) {
            return this.deferred.promise;
        }
        let deferred = lib.getDefer();

        let connection = new redis(this.options);
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
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(connnum));
            } else {
                deferred.reject(err);
            }
        });
        connection.on('end', () => {
            this.close();
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(connnum));
            } else {
                deferred.reject('redis connection end');
            }
        });

        this.handle = connection;
        this.deferred = deferred;
        return this.deferred.promise;
    }

    /**
     *
     *
     */
    close() {
        if (this.handle) {
            this.handle.disconnect();
            this.handle = null;
        }
    }

    /**
     *
     * @param name
     * @param data
     */
    async wrap(name, data) {
        let deferred = lib.getDefer();
        await this.connect().catch(e => deferred.reject(e));
        if (!lib.isArray(data)) {
            data = data === undefined ? [] : [data];
        }
        data.push((err, da) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(da);
            }
        });
        if (this.handle) {
            this.handle[name].apply(this.handle, data);
        } else {
            deferred.reject('redis connection end');
        }
        return deferred.promise;
    }
};