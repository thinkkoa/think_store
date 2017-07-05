/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
'use strict';
//rewite promise, bluebird is much faster
global.Promise = require('bluebird');
require('babel-runtime/core-js/promise').default = Promise;

//export
module.exports = require('./lib/store.js');