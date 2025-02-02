/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2025 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Controller = require('@ntlab/express-controller');
const Express = require('express').application;

class GwController extends Controller
{
    buildRoutes() {
        this.addRoute('index', 'get', '/', async (req, res, next) => {
            const term = req.app.term;
            for (let i = 0; i < term.terminals.length; i++) {
                const terminal = term.terminals[i];
                terminal.stat = await terminal.getStat();
            }
            const socketOptions = {reconnection: true};
            if (req.app.get('root') !== '/') {
                socketOptions.path = req.getPath('/socket.io/');
            }
            res.render('gw/index', {
                socket: {
                    url: req.getUri({path: '/ui', noproto: true}),
                    options: socketOptions
                }
            });
        });
        this.addRoute('about', 'get', '/about', (req, res, next) => {
            let about;
            if (req.app.about) {
                about = req.app.about;
            } else {
                const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
                about = {
                    title: packageInfo.description,
                    version: packageInfo.version,
                    author: packageInfo.author.name ? packageInfo.author.name + ' <' + packageInfo.author.email + '>' :
                        packageInfo.author,
                    license: packageInfo.license
                }
            }
            res.json(about);
        });
        this.addRoute('queue', 'get', '/queue', (req, res, next) => {
            this.getQueue(req, res, next);
        });
        this.addRoute('queue-page', 'get', '/queue/:page', (req, res, next) => {
            this.getQueue(req, res, next);
        });
        this.addRoute('message', 'get', '/message', (req, res, next) => {
            this.getMessage(req, res, next);
        });
        this.addRoute('message-page', 'get', '/message/:page', (req, res, next) => {
            this.getMessage(req, res, next);
        });
        this.addRoute('message-get', 'get', '/read/:number', (req, res, next) => {
            this.readMessage(req, res, next);
        });
        this.addRoute('activity', 'get', '/activity-log', (req, res, next) => {
            this.getActivityLog(req, res, next);
        });
        this.addRoute('client', 'get', '/client', (req, res, next) => {
            const result = [];
            const term = req.app.term;
            let nr = 0;
            term.gwclients.forEach(socket => {
                const info = {
                    nr: ++nr,
                    id: socket.id,
                    address: socket.handshake.address,
                    time: socket.time ? moment(socket.time).format('DD MMM YYYY HH:mm') : null,
                    group: socket.group
                }
                result.push(info);
            });
            res.json({count: result.length, items: result});
        });
        this.addRoute('message-send', 'post', '/send-message', (req, res, next) => {
            const result = {};
            const term = req.app.term;
            const stor = term.Storage;
            if (req.body.number && req.body.message) {
                term.dispatcher.add({
                    type: stor.ACTIVITY_SMS,
                    address: req.body.number,
                    data: req.body.message
                }, null, queue => {
                    result.success = queue ? true : false;
                    if (result.success) {
                        result.notice = this._('Your message has successfully queued as %HASH%.', {HASH: queue.hash});
                    } else {
                        result.error = this._('Can\'t sent message.');
                    }
                    res.json(result);
                });
            } else {
                next();
            }
        });
        this.addRoute('term-stat', 'get', '/:imsi/stat', async (req, res, next) => {
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal) {
                res.json(await terminal.getStat());
            } else {
                next();
            }
        });
        this.addRoute('term-apply', 'post', '/:imsi/apply', (req, res, next) => {
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal) {
                const parameters = this.fixParameters(req.body);
                const result = {};
                if (isNaN(parameters.term.priority)) {
                    result.success = false;
                } else {
                    // check boolean operators
                    const options = terminal.defaultOptions();
                    Object.keys(options).forEach(opt => {
                        if (typeof options[opt] === 'boolean' && !parameters.term[opt]) {
                            parameters.term[opt] = false;
                        }
                    });
                    parameters.term.priority = parseInt(parameters.term.priority);
                    if (!parameters.term.operators) {
                        parameters.term.operators = [];
                    }
                    if (!parameters.term.groups) {
                        parameters.term.groups = [];
                    }
                    parameters.term.group = parameters.term.groups.join(',');
                    terminal.readOptions(parameters.term);
                    result.success = true;
                    result.notice = this._('Your changes has been successfuly applied.');
                }
                res.json(result);
            } else {
                next();
            }
        });
        this.addRoute('term-config', 'get', '/:imsi/config', (req, res, next) => {
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal) {
                res.json(terminal.options);
            } else {
                next();
            }
        });
        this.addRoute('term-dial', 'post', '/:imsi/dial', (req, res, next) => {
            const result = {};
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal && req.body.number) {
                terminal.addCallQueue(req.body.number, queue => {
                    result.success = queue ? true : false;
                    if (result.success) {
                        result.notice = this._('Your call has successfully queued as %HASH%.', {HASH: queue.hash});
                    } else {
                        result.error = this._('Can\'t place call queue.');
                    }
                    res.json(result);
                });
            } else {
                next();
            }
        });
        this.addRoute('term-send', 'post', '/:imsi/message', (req, res, next) => {
            const result = {};
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal && req.body.number && req.body.message) {
                terminal.addMessageQueue(req.body.number, req.body.message, queue => {
                    result.success = queue ? true : false;
                    if (result.success) {
                        result.notice = this._('Your message has successfully queued as %HASH%.', {HASH: queue.hash});
                    } else {
                        result.error = this._('Can\'t place message queue.');
                    }
                    res.json(result);
                });
            } else {
                next();
            }
        });
        this.addRoute('term-ussd', 'post', '/:imsi/ussd', (req, res, next) => {
            const result = {};
            const term = req.app.term;
            const terminal = term.get(req.params.imsi);
            if (terminal && req.body.service) {
                terminal.addUssdQueue(req.body.service, queue => {
                    result.success = queue ? true : false;
                    if (result.success) {
                        result.notice = this._('Your USSD has successfully queued as %HASH%.', {HASH: queue.hash});
                    } else {
                        result.error = this._('Can\'t place USSD queue.');
                    }
                    res.json(result);
                });
            } else {
                next();
            }
        });
        this.addRoute('task', 'post', '/task/:op', (req, res, next) => {
            const result = {
                success: false
            }
            const term = req.app.term;
            switch (req.params.op) {
                case 'readmsg':
                    if (req.body.type) {
                        term.pools.forEach(pool => {
                            if (pool.con) {
                                pool.con.emit('check-message', req.body.type);
                            }
                        });
                        result.success = term.pools.length ? true : false;
                    }
                    break;
                case 'resendmsg':
                    if (req.body.since) {
                        term.pools.forEach(pool => {
                            if (pool.con) {
                                pool.con.emit('resend-message', req.body.since);
                            }
                        });
                        result.success = term.pools.length ? true : false;
                    }
                    break;
                case 'report':
                    if (req.body.since) {
                        term.pools.forEach(pool => {
                            if (pool.con) {
                                pool.con.emit('check-report', req.body.since);
                            }
                        });
                        result.success = term.pools.length ? true : false;
                    }
                    break;
            }
            res.json(result);
        });
    }

    getQueue(req, res, next) {
        const result = {};
        const term = req.app.term;
        const stor = term.Storage;
        const page = req.params.page || 1;
        const pageSize = 25;
        stor.GwQueue.count().then(count => {
            result.count = count;
            result.items = [];
            let offset = (page - 1) * pageSize;
            stor.GwQueue.findAll({
                order: [['time', 'DESC']],
                offset: offset,
                limit: pageSize
            })
            .then(results => {
                results.forEach(queue => {
                    result.items.push({
                        nr: ++offset,
                        hash: queue.hash,
                        origin: queue.imsi,
                        type: queue.type,
                        address: queue.address,
                        data: queue.data,
                        processed: queue.processed,
                        status: queue.status,
                        time: moment(queue.time).format('DD MMM YYYY HH:mm')
                    });
                });
                // create pagination
                result.pages = req.app.locals.pager(result.count, pageSize, page);
                // send content
                res.json(result);
            });
        });
    }
    
    getMessage(req, res, next) {
        const result = {};
        const term = req.app.term;
        const stor = term.Storage;
        const page = req.params.page || 1;
        const pageSize = 25;
        stor.countRecents().then(count => {
            result.count = count.length ? count[0].count : 0;
            result.items = [];
            let offset = (page - 1) * pageSize;
            stor.getRecents(offset, pageSize).then(results => {
                results.forEach(queue => {
                    result.items.push({
                        nr: ++offset,
                        hash: queue.hash,
                        origin: queue.imsi,
                        type: queue.type,
                        address: queue.address,
                        data: queue.data,
                        status: queue.status,
                        code: queue.code,
                        time: moment(queue.time).format('DD MMM YYYY HH:mm')
                    });
                });
                // create pagination
                result.pages = req.app.locals.pager(result.count, pageSize, page);
                // send content
                res.json(result);
            });
        });
    }
    
    readMessage(req, res, next) {
        const result = {};
        const term = req.app.term;
        const stor = term.Storage;
        stor.GwQueue.findAll({
            where: {
                address: req.params.number,
                type: {[stor.Op.in]: [stor.ACTIVITY_SMS, stor.ACTIVITY_INBOX]}
            },
            order: [['time', 'ASC']]
        })
        .then(results => {
            const messages = {};
            results.forEach(GwQueue => {
                messages[GwQueue.hash] = {
                    imsi: GwQueue.imsi,
                    operator: term.getNetworkOperator(GwQueue.imsi),
                    hash: GwQueue.hash,
                    type: GwQueue.type,
                    message: GwQueue.data,
                    processed: GwQueue.processed,
                    status: GwQueue.status,
                    code: null,
                    time: GwQueue.time
                };
            });
            return messages;
        })
        .then(messages => {
            stor.GwLog.findAll({
                where: {
                    address: req.params.number,
                    type: stor.ACTIVITY_SMS
                }
            })
            .then(results => {
                results.forEach(GwLog => {
                    messages[GwLog.hash].code = GwLog.code;
                });
                Object.values(messages).forEach(msg => {
                    const time = moment(msg.time).format('DD MMM YYYY');
                    if (!result[time]) {
                        result[time] = [];
                    }
                    result[time].push(msg);
                });
                // send content
                res.json(result);
            });
        });
    }
    
    getActivityLog(req, res, next) {
        const term = req.app.term;
        const result = {
            time: Date.now(),
            logs: fs.readFileSync(term.logfile).toString()
        }
        res.json(result);
    }
    
    fixParameters(data) {
        if (typeof data === 'object') {
            Object.keys(data).forEach(k => {
                if (typeof data[k] === 'string') {
                    if (['on', 'true'].indexOf(data[k]) >= 0) {
                        data[k] = true;
                    }
                    if (['off', 'false'].indexOf(data[k]) >= 0) {
                        data[k] = false;
                    }
                } else {
                    this.fixParameters(data[k]);
                }
            });
        }
        return data;
    }

    /**
     * Create controller.
     *
     * @param {Express} app Express app
     * @param {string} prefix Path prefix 
     * @returns {GwController}
     */
    static create(app, prefix = '/') {
        const controller = new GwController({prefix: prefix, name: 'Gw'});
        app.use(prefix, controller.router);
        return controller;
    }
}

module.exports = GwController.create;
