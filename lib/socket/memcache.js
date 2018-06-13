/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const memcached = require('memcached');

module.exports = class {
    constructor(options = {}) {
        options.memcache_timeout && (options.memcache_timeout = options.memcache_timeout * 1000);
        this.options = {
            memcache_host: options.memcache_host || '127.0.0.1',
            memcache_port: options.memcache_port || 11211,
            memcache_poolsize: options.memcache_poolsize || 10, //memcache pool size
            memcache_timeout: options.memcache_timeout || 5000, //try connection timeout
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
        //[ '192.168.0.102:11211', '192.168.0.103:11211', '192.168.0.104:11211' ]
        let connection = new memcached([`${this.options.memcache_host}:${this.options.memcache_port}`], {
            poolSize: this.options.memcache_poolsize,
            timeout: this.options.memcache_timeout,
        });
        connection.on('issue', () => {
            this.close();
            if (connnum < 3){
                connnum ++;
                deferred.resolve(this.connect(connnum));
            } else {
                deferred.reject('memcache connection issue');
            }
        });
        connection.on('failure', err => {
            this.close();
            if (connnum < 3){
                connnum ++;
                deferred.resolve(this.connect(connnum));
            } else {
                deferred.reject(err);
            }
        });

        this.handle = connection;
        this.deferred = deferred;
        return this.deferred.promise;
    }

    close() {
        if (this.handle) {
            this.handle.end();
            this.handle = null;
        }
    }

    /**
     *
     * @param name
     * @param data
     * @returns {*}
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
            deferred.reject('connection end');
        }
        return deferred.promise;
    }
};