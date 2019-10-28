# 介绍
-----

[![npm version](https://badge.fury.io/js/think_store.svg)](https://badge.fury.io/js/think_store)
[![Dependency Status](https://david-dm.org/thinkkoa/think_store.svg)](https://david-dm.org/thinkkoa/think_store)

Cache's Storage for ThinkKoa.

# 安装
-----

```
npm i think_store
```

# 使用
-----


```js
const store = require('think_store');

const options = {
    type: 'file', //数据缓存类型 file,redis,memcache
    key_prefix: 'ThinkKoa:', //缓存key前置
    timeout: 6 * 3600, //数据缓存有效期，单位: 秒

    //type=file
    file_suffix: '.json', //File缓存方式下文件后缀名
    gc_hour: [4], //缓存清除的时间点，数据为小时
    file_path: process.env.ROOT_PATH + '/cache'

    //type=redis
    // host: '127.0.0.1',
    // port: 6379,
    // password: '',
    // db: '0',

    //type=memcache
    // host: '127.0.0.1',
    // port: 11211,

    poolsize: 10, //pool size
    conn_timeout: 5000, //try connection timeout, 
}


const ins = store.getInstance(options);

ins.set('test', 111); //promise

ins.get('test'); //promise

```