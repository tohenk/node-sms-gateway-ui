/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2023-2024 Toha <tohenk@yahoo.com>
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

const Helper = require('@ntlab/express-middleware/lib/helper');
const HelperFunctions = require('@ntlab/express-middleware/lib/fn');
const Controller = require('@ntlab/express-controller');
const Translator = require('@ntlab/express-controller/translator');
const { ScriptManager } = require('@ntlab/ntjs');
const { minify_sync } = require('terser');

/**
 * Express app middleware.
 */
class AppFunctions extends HelperFunctions {

    initialize() {
        this.exportFn(this.app.locals, () => this.AppFunctions());
        this.exportFn(this.res.req, () => this.RequestFunctions());
        this.exportFn(this.res, () => this.ResponseFunctions());
    }

    AppFunctions() {
        return {
            _: Translator._,
            route: (name, parameters) => this.genRoute(name, parameters),
            path: path => this.genPath(path),
        }
    }

    RequestFunctions() {
        return {
            getUri: () => this.getUri(),
        }
    }

    ResponseFunctions() {
        return {
            onrender: res => ScriptManager.require('JQuery').setOption('xhr', res.req.xhr ? true : false),
            onscript: script => this.app.get('env') === 'development' ? script : minify_sync(script, {compress: true, mangle: true}).code,
        }
    }

    getUri() {
        const [host, port] = this.res.req.headers.host.split(':');
        let uri = `${this.res.req.protocol}://${this.res.req.hostname}`;
        if ((this.res.req.protocol === 'http' && port != 80) || (this.res.req.protocol === 'https' && port != 443)) {
            uri += `:${port}`;
        }
        return uri;
    }

    getController(name) {
        return Controller.get(name);
    }

    genRoute(name, parameters) {
        const controller = this.getController(name);
        if (!controller) {
            throw new Error(`Unable to find controller ${name}!`);
        }
        const p = Object.assign({}, parameters);
        const route = p.name;
        if (!route) {
            throw new Error('Route name must be specified in parameters!');
        }
        delete p.name;
        return controller.genRoute(route, p);
    }

    genPath(path) {
        return path;
    }
}

const helper = new Helper(AppFunctions);

module.exports = options => helper.handle(options);