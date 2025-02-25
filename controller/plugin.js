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

const path = require('path');
const Controller = require('@ntlab/express-controller');
const Express = require('express').application;

class PluginController extends Controller
{
    buildRoutes() {
        this.addRoute('index', 'all', '/p/:plugin', (req, res, next) => {
            if (req.params.plugin) {
                const term = req.app.term;
                let plugin;
                term.plugins.forEach(p => {
                    if (p.name === req.params.plugin) {
                        plugin = p;
                        return true;
                    }
                });
                if (plugin) {
                    res.locals.viewdir = path.join(path.dirname(plugin.src), 'views');
                    return plugin.router(req, res, next);
                } else {
                    res.sendStatus(404);
                }
            } else {
                next();
            }
        });
    }

    /**
     * Create controller.
     *
     * @param {Express} app Express app
     * @param {string} prefix Path prefix 
     * @returns {PluginController}
     */
    static create(app, prefix = '/') {
        const controller = new PluginController({prefix: prefix, name: 'Plugin'});
        app.use(prefix, controller.router);
        return controller;
    }
}

module.exports = PluginController.create;
