/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const logger = require('think_logger');
const redis = require('ioredis');
const genericPool = require('generic-pool');

module.exports = class {
    constructor(options = {}) {
        //兼容旧版
        options.host = options.host || options.redis_host;
        options.port = options.port || options.redis_port;
        options.db = options.db || options.redis_db;
        options.conn_timeout = options.conn_timeout || options.redis_timeout;

        this.options = Object.assign({
            type: 'redis', //数据缓存类型 file,redis,memcache
            key_prefix: 'Think:', //缓存key前置
            timeout: 6 * 3600, //数据缓存有效期，单位: 秒
            poolsize: 10,
            conn_timeout: 5000
        }, options);

        this.pool = null;
        this.client = null;
    }

    /**
     * connect to server
     *
     * @param {*} options
     * @param {number} [connnum=0]
     * @returns
     */
    async connect(options, connnum = 0) {
        if (this.client && this.client.status === 'ready') {
            return this.client;
        }
        const deferred = lib.getDefer();
        const connection = new redis({
            host: options.host || '127.0.0.1',
            port: options.port || 6379,
            auth_pass: options.password || '',
            db: options.db || '0',
            family: 4, // 4 (IPv4) or 6 (IPv6)
            connectTimeout: options.conn_timeout || 5000,
            retryStrategy: 5, //自动尝试重连
        });

        // if (options.auth_pass) {
        //     connection.auth(options.auth_pass, function () {
        //     });
        // }
        // if (options.db) {
        //     connection.select(options.db, function () {
        //     });
        // }
        connection.on('ready', () => {
            this.client = connection;
            deferred.resolve(connection);
        });
        connection.on('connect', () => {
            this.client = connection;
            deferred.resolve(connection);
        });
        connection.on('error', err => {
            this.close(connection);
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(options, connnum));
            } else {
                this.close(connection);
                deferred.reject(err);
            }
        });
        connection.on('end', () => {
            this.close(connection);
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(options, connnum));
            } else {
                this.close(connection);
                deferred.reject('redis connection end');
            }
        });

        return deferred.promise;
    }

    /**
     * get connection from pool
     *
     * @returns
     */
    getConnection() {
        if (!this.pool || !this.pool.acquire) {
            const factory = {
                create: () => {
                    return this.connect(this.options);
                },
                destroy: (client) => {
                    return this.close(client);
                },
                validate: (resource) => {
                    return resource.status === 'ready';
                }
            };
            this.pool = genericPool.createPool(factory, {
                max: this.options.poolsize || 10, // maximum size of the pool
                min: 2 // minimum size of the pool
            });
            this.pool.on('factoryCreateError', function (err) {
                logger.error(err);
            });
            this.pool.on('factoryDestroyError', function (err) {
                logger.error(err);
            });
        }

        return this.pool.acquire();
    }

    /**
     *
     *
     * @param {*} client
     * @returns
     */
    close(client) {
        client = client || this.client;
        if (client) {
            client.end();
        }
        if (this.pool) {
            this.pool.destroy();
        }
        this.client = null;
        this.pool = null;
        return;
    }

    /**
     *
     * @param name
     * @param data
     */
    async wrap(name, data) {
        let conn;
        try {
            conn = await this.getConnection();
            const res = await conn[name](...data);
            if (this.pool.isBorrowedResource(conn)) {
                this.pool.release(conn);
            }
            return res;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * reids defined command
     *
     * @param {*} name
     * @param {*} data
     * @returns
     */
    async command(name, data) {
        const conn = await this.connect(this.options);
        conn.defineCommand(name, data);
        return conn;
    }

    /**
     * 字符串获取
     * @param name
     */
    get(name) {
        return this.wrap('get', [this.options.key_prefix + name]);
    }

    /**
     * 字符串写入
     * @param name
     * @param value
     * @param timeout
     * @returns {Promise}
     */
    set(name, value, timeout = this.options.timeout) {
        let setP = [this.wrap('set', [this.options.key_prefix + name, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.key_prefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 以秒为单位，返回给定 key 的剩余生存时间
     * @param name
     * @returns {*}
     */
    ttl(name) {
        return this.wrap('ttl', [this.options.key_prefix + name]);
    }

    /**
     * 设置key超时属性
     * @param name
     * @param timeout
     */
    expire(name, timeout = this.options.timeout) {
        return this.wrap('expire', [this.options.key_prefix + name, timeout]);
    }

    /**
     * 删除key
     * @param name
     */
    rm(name) {
        return this.wrap('del', [this.options.key_prefix + name]);
    }

    /**
     * 批量删除，可模糊匹配
     * @param keyword
     * @returns {*}
     */
    batchrm(keyword) {
        return this.wrap('keys', keyword + '*').then(keys => {
            if (lib.isEmpty(keys)) {
                return null;
            }
            return this.wrap('del', [keys]);
        });
    }

    /**
     * 判断key是否存在
     * @param name
     */
    exists(name) {
        return this.wrap('exists', [this.options.key_prefix + name]);
    }

    /**
     * 查找所有符合给定模式 pattern 的 key
     * @param pattern
     */
    keys(pattern) {
        return this.wrap('keys', [pattern]);
    }

    /**
     * 自增
     * @param name
     */
    incr(name) {
        return this.wrap('incr', [this.options.key_prefix + name]);
    }

    /**
     * 自减
     * @param name
     * @returns {*}
     */
    decr(name) {
        return this.wrap('decr', [this.options.key_prefix + name]);
    }

    /**
     * 将 key 所储存的值增加增量 
     * @param name
     * @param incr
     * @returns {*}
     */
    incrby(name, incr) {
        incr = incr || 1;
        return this.wrap('incrby', [this.options.key_prefix + name, incr]);
    }

    /**
     * 将 key 所储存的值减去减量 
     * 
     * @param {any} name 
     * @param {any} decr 
     */
    decrby(name, decr) {
        decr = decr || 1;
        return this.wrap('decrby', [this.options.key_prefix + name, decr]);
    }

    /**
     * 哈希写入
     * @param name
     * @param key
     * @param value
     * @param timeout
     */
    hset(name, key, value, timeout = this.options.timeout) {
        let setP = [this.wrap('hset', [this.options.key_prefix + name, key, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.key_prefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 哈希获取
     * @param name
     * @param key
     * @returns {*}
     */
    hget(name, key) {
        return this.wrap('hget', [this.options.key_prefix + name, key]);
    }

    /**
     * 查看哈希表 hashKey 中，给定域 key 是否存在
     * @param name
     * @param key
     * @returns {*}
     */
    hexists(name, key) {
        return this.wrap('hexists', [this.options.key_prefix + name, key]);
    }

    /**
     * 返回哈希表 key 中域的数量
     * @param name
     * @returns {*}
     */
    hlen(name) {
        return this.wrap('hlen', [this.options.key_prefix + name]);
    }

    /**
     * 给哈希表指定key，增加increment
     * @param name
     * @param key
     * @param incr
     * @returns {*}
     */
    hincrby(name, key, incr = 1) {
        return this.wrap('hincrby', [this.options.key_prefix + name, key, incr]);
    }

    /**
     * 返回哈希表所有key-value
     * @param name
     * @returns {*}
     */
    hgetall(name) {
        return this.wrap('hgetall', [this.options.key_prefix + name]);
    }

    /**
     * 返回哈希表所有key
     * @param name
     * @returns {*}
     */
    hkeys(name) {
        return this.wrap('hkeys', [this.options.key_prefix + name]);
    }

    /**
     * 返回哈希表所有value
     * @param name
     * @returns {*}
     */
    hvals(name) {
        return this.wrap('hvals', [this.options.key_prefix + name]);
    }

    /**
     * 哈希删除
     * @param name
     * @param key
     * @returns {*}
     */
    hdel(name, key) {
        return this.wrap('hdel', [this.options.key_prefix + name, key]);
    }

    /**
     * 判断列表长度，若不存在则表示为空
     * @param name
     * @returns {*}
     */
    llen(name) {
        return this.wrap('llen', [this.options.key_prefix + name]);
    }

    /**
     * 将值插入列表表尾
     * @param name
     * @param value
     * @returns {*}
     */
    rpush(name, value) {
        return this.wrap('rpush', [this.options.key_prefix + name, value]);
    }

    /**
     * 将列表表头取出，并去除
     * @param name
     * @returns {*}
     */
    lpop(name) {
        return this.wrap('lpop', [this.options.key_prefix + name]);
    }

    /**
     * 返回列表 key 中指定区间内的元素，区间以偏移量 start 和 stop 指定
     * @param name
     * @param start
     * @param stop
     * @returns {*}
     */
    lrange(name, start, stop) {
        return this.wrap('lrange', [this.options.key_prefix + name, start, stop]);
    }

    /**
     * 集合新增
     * @param name
     * @param value
     * @param timeout
     * @returns {*}
     */
    sadd(name, value, timeout = this.options.timeout) {
        let setP = [this.wrap('sadd', [this.options.key_prefix + name, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.key_prefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 返回集合的基数(集合中元素的数量)
     * @param name
     * @returns {*}
     */
    scard(name) {
        return this.wrap('scard', [this.options.key_prefix + name]);
    }

    /**
     * 判断 member 元素是否集合的成员
     * @param name
     * @param key
     * @returns {*}
     */
    sismember(name, key) {
        return this.wrap('sismember', [this.options.key_prefix + name, key]);
    }

    /**
     * 返回集合中的所有成员
     * @param name
     * @returns {*}
     */
    smembers(name) {
        return this.wrap('smembers', [this.options.key_prefix + name]);
    }

    /**
     * 移除并返回集合中的一个随机元素
     * @param name
     * @returns {*}
     */
    spop(name) {
        return this.wrap('spop', [this.options.key_prefix + name]);
    }

    /**
     * 移除集合 key 中的一个 member 元素
     * @param name
     * @param key
     * @returns {*}
     */
    srem(name, key) {
        return this.wrap('srem', [this.options.key_prefix + name, key]);
    }

    /**
     * 将 member 元素从 source 集合移动到 destination 集合
     * @param source
     * @param destination
     * @param member
     * @returns {*}
     */
    smove(source, destination, member) {
        return this.wrap('smove', [this.options.key_prefix + source, this.options.key_prefix + destination, member]);
    }


};