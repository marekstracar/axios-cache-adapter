(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('axios'), require('md5'), require('@tusbar/cache-control')) :
    typeof define === 'function' && define.amd ? define('index', ['exports', 'axios', 'md5', '@tusbar/cache-control'], factory) :
    (global = global || self, factory(global.index = {}, global.Axios, global.md5, global.cacheControl));
}(this, (function (exports, Axios, md5, cacheControl) { 'use strict';

    Axios = Axios && Object.prototype.hasOwnProperty.call(Axios, 'default') ? Axios['default'] : Axios;
    md5 = md5 && Object.prototype.hasOwnProperty.call(md5, 'default') ? md5['default'] : md5;

    async function limit (config) {
        const length = await config.store.length();

        if (length < config.limit) return;

        config.debug(`Current store size: ${length}`);

        let firstItem;

        await config.store.iterate((value, key) => {
            if (!firstItem) firstItem = { value, key };
            if (value.expires < firstItem.value.expires) firstItem = { value, key };
        });

        if (firstItem) {
            config.debug(`Removing item: ${firstItem.key}`);

            await config.store.removeItem(firstItem.key);
        }
    }

    // https://github.com/lodash/lodash/blob/master/isObject.js
    function isObject (value) {
        const type = typeof value;
        return value != null && (type === 'object' || type === 'function');
    }

    // https://github.com/lodash/lodash/blob/master/.internal/getTag.js
    function getTag (value) {
        if (value === null) {
            return value === undefined ? '[object Undefined]' : '[object Null]';
        }
        return Object.prototype.toString.call(value);
    }

    // https://github.com/lodash/lodash/blob/master/isFunction.js
    function isFunction (value) {
        if (!isObject(value)) {
            return false;
        }

        const tag = getTag(value);
        return (
            tag === '[object Function]' ||
        tag === '[object AsyncFunction]' ||
        tag === '[object GeneratorFunction]' ||
        tag === '[object Proxy]'
        );
    }

    // https://github.com/lodash/lodash/blob/master/isString.js
    function isString (value) {
        const type = typeof value;
        return (
            type === 'string' ||
        (type === 'object' &&
          value != null &&
          !Array.isArray(value) &&
          getTag(value) === '[object String]')
        );
    }

    function mapObject (value, fn) {
        if (!isObject(value)) {
            return [];
        }
        return Object.keys(value).map(key => fn(value[key], key));
    }

    function serialize (config, req, res) {
        if (res.data) {
        // FIXME: May be useless as localForage and axios already parse automatically
            try {
                res.data = JSON.parse(res.data);
            } catch (err) {
                config.debug('Could not parse data as JSON', err);
            }
        }

        const { request, config: _, ...serialized } = res;
        return serialized;
    }

    async function write (config, req, res) {
        try {
            const entry = {
                expires: config.expires,
                data: serialize(config, req, res)
            };

            await config.store.setItem(config.uuid, entry);
        } catch (err) {
            config.debug('Could not store response', err);

            if (config.clearOnError) {
                try {
                    await config.store.clear();
                } catch (err) {
                    config.debug('Could not clear store', err);
                }
            }

            return false;
        }

        return true;
    }

    async function read (config, req) {
        const { uuid, ignoreCache } = config;

        const entry = await config.store.getItem(uuid);

        if (ignoreCache || !entry || !entry.data) {
            config.debug('cache-miss', req.url);
            const error = new Error();

            error.reason = 'cache-miss';
            error.message = 'Entry not found from cache';

            throw error;
        }

        const { expires, data } = entry;

        // Do not check for stale cache if offline on client-side
        const offline = typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;

        if (!offline && !config.acceptStale && expires !== 0 && (expires < Date.now())) {
            config.debug('cache-stale', req.url);
            const error = new Error();

            error.reason = 'cache-stale';
            error.message = 'Entry is stale';

            throw error;
        }

        config.debug(config.acceptStale ? 'cache-hit-stale' : 'cache-hit', req.url);

        return data;
    }

    function key (config) {
        if (isFunction(config.key)) return config.key;

        let cacheKey;
        if (isString(config.key)) {
            cacheKey = req => {
                const url = `${req.baseURL ? req.baseURL : ''}${req.url}`;
                const key = `${config.key}/${url}${serializeQuery(req)}`;
                return req.data ? key + md5(req.data) : key;
            };
        } else {
            cacheKey = req => {
                const url = `${req.baseURL ? req.baseURL : ''}${req.url}`;
                const key = url + serializeQuery(req);
                return req.data ? key + md5(req.data) : key;
            };
        }

        return cacheKey;
    }

    async function defaultInvalidate (config, req) {
        const method = req.method.toLowerCase();
        if (config.exclude.methods.includes(method)) {
            await config.store.removeItem(config.uuid);
        }
    }

    function invalidate (config = {}) {
        if (isFunction(config.invalidate)) return config.invalidate;
        return defaultInvalidate;
    }

    function serializeQuery (req) {
        if (!req.params) return '';

        // Probably server-side, just stringify the object
        if (typeof URLSearchParams === 'undefined') return JSON.stringify(req.params);

        let params = req.params;

        const isInstanceOfURLSearchParams = req.params instanceof URLSearchParams;

        // Convert to an instance of URLSearchParams so it get serialized the same way
        if (!isInstanceOfURLSearchParams) {
            params = new URLSearchParams();
            Object.keys(req.params).forEach(key => params.append(key, req.params[key]));
        }

        return `?${params.toString()}`;
    }

    async function response (config, req, res) {
        const { request = {}, headers = {} } = res;

        // exclude binary response from cache
        if (['arraybuffer', 'blob'].indexOf(request.responseType) > -1) {
            return res;
        }

        let cacheControl$1 = {};

        // Should we try to determine request cache expiration from headers or not
        if (config.readHeaders) {
            if (headers['cache-control']) { // Try parsing `cache-control` header from response
                cacheControl$1 = cacheControl.parse(headers['cache-control']);

                // Force cache exlcusion for `cache-control: no-cache` and `cache-control: no-store`
                if (cacheControl$1.noCache || cacheControl$1.noStore) {
                    config.excludeFromCache = true;
                }
            } else if (headers.expires) { // Else try reading `expires` header
                config.expires = new Date(headers.expires).getTime();
            } else {
                config.expires = new Date().getTime();
            }
        }

        if (!config.excludeFromCache) {
            if (cacheControl$1.maxAge || cacheControl$1.maxAge === 0) {
                // Use `cache-control` header `max-age` value and convert to milliseconds
                config.expires = Date.now() + (cacheControl$1.maxAge * 1000);
            } else if (!config.readHeaders) {
                // Use fixed `maxAge` defined in the global or per-request config
                config.expires = config.maxAge === 0 ? Date.now() : Date.now() + config.maxAge;
            }

            // Check if a cache limit has been configured
            if (config.limit) {
                config.debug(`Detected limit: ${config.limit}`);

                await limit(config);
            }

            // Write response to cache
            await write(config, req, res);
        } else {
        // Mark request as excluded from cache
            res.request.excludedFromCache = true;
        }

        return res;
    }

    function exclude (config = {}, req) {
        const { exclude = {}, debug } = config;
        const method = req.method.toLowerCase();

        if (method === 'head' || exclude.methods.includes(method)) {
            debug(`Excluding request by HTTP method ${req.url}`);

            return true;
        }

        if ((typeof exclude.filter === 'function') && exclude.filter(req)) {
            debug(`Excluding request by filter ${req.url}`);

            return true;
        }

        // do not cache request with query
        const hasQueryParams = /\?.*$/.test(req.url) ||
        (isObject(req.params) && Object.keys(req.params).length !== 0) ||
        (typeof URLSearchParams !== 'undefined' && req.params instanceof URLSearchParams);

        if (exclude.query && hasQueryParams) {
            debug(`Excluding request by query ${req.url}`);

            return true;
        }

        const paths = exclude.paths || [];
        const found = paths.some(regexp => req.url.match(regexp));

        if (found) {
            debug(`Excluding request by url match ${req.url}`);

            return true;
        }

        return false;
    }

    async function request (config, req) {
        config.debug('uuid', config.uuid);

        const next = (...args) => response(config, req, ...args);

        // run invalidate function to check if any cache items need to be invalidated.
        await config.invalidate(config, req);

        if (exclude(config, req)) {
            return excludeFromCache();
        }

        try {
            const res = await read(config, req);

            res.config = req;
            res.request = { fromCache: true };

            return { config, next: res };
        } catch (err) {
        // clean up cache if stale
            if (config.clearOnStale && err.reason === 'cache-stale') {
                await config.store.removeItem(config.uuid);
            }

            return { config, next };
        }

        // Helpers

        function excludeFromCache () {
            config.excludeFromCache = true;

            return { config, next };
        }
    }

    class MemoryStore {
        constructor () {
            this.store = {};
        }

        async getItem (key) {
            const item = this.store[key] || null;

            return JSON.parse(item);
        }

        async setItem (key, value) {
            this.store[key] = JSON.stringify(value);

            return value;
        }

        async removeItem (key) {
            delete this.store[key];
        }

        async clear () {
            this.store = {};
        }

        async length () {
            return Object.keys(this.store).length;
        }

        iterate (fn) {
            return Promise.all(mapObject(this.store, fn));
        }
    }

    const noop = () => {};
    const debug = (...args) => console.log('[axios-cache-adapter]', ...args);

    const defaults = {
        // Default settings when solely creating the cache adapter with setupCache.
        cache: {
            maxAge: 0,
            limit: false,
            store: null,
            key: null,
            invalidate: null,
            exclude: {
                paths: [],
                query: true,
                filter: null,
                methods: ['post', 'patch', 'put', 'delete']
            },
            clearOnStale: true,
            clearOnError: true,
            readOnError: false,
            readHeaders: false,
            debug: false,
            ignoreCache: false,
            adapter: async (config, requestData) => {
                const { method, url, ...rest } = requestData;
                const { baseURL } = config;

                const api = Axios.create({...rest, baseURL, adapter: Axios.defaults.adapter});

                return api[method](url);
            }
        },

        // Additional defaults when creating the axios instance with the cache adapter.
        axios: {
            cache: {
                maxAge: 15 * 60 * 1000
            }
        }
    };

    // List of disallowed in the per-request config.
    const disallowedPerRequestKeys = ['limit', 'store', 'adapter', 'uuid', 'acceptStale'];

    /**
     * Make a global config object.
     *
     * @param {Object} [override={}] Optional config override.
     * @return {Object}
     */
    const makeConfig = function (override = {}) {
        const config = {
            ...defaults.cache,
            ...override,
            exclude: {
                ...defaults.cache.exclude,
                ...override.exclude
            }
        };

        // Create a cache key method
        config.key = key(config);
        config.invalidate = invalidate(config);
        // If debug mode is on, create a simple logger method
        if (config.debug !== false) {
            config.debug = typeof config.debug === 'function' ? config.debug : debug;
        } else {
            config.debug = noop;
        }

        // Create an in memory store if none was given
        if (!config.store) config.store = new MemoryStore();

        config.debug('Global cache config', config);

        return config;
    };

    /**
     * Merge the per-request config in another config.
     *
     * This method exists because not all keys should be allowed as it
     * may lead to unexpected behaviours. For instance, setting another
     * store or adapter per request is wrong, instead another instance
     * axios, or the adapter, should be used.
     *
     * @param {Object} config Config object.
     * @param {Object} req    The current axios request
     * @return {Object}
     */
    const mergeRequestConfig = function (config, req) {
        const requestConfig = req.cache || {};
        if (requestConfig) {
            disallowedPerRequestKeys.forEach(key => requestConfig[key] ? (delete requestConfig[key]) : undefined);
        }

        const mergedConfig = {
            ...config,
            ...requestConfig,
            exclude: {
                ...config.exclude,
                ...requestConfig.exclude
            }
        };

        if (mergedConfig.debug === true) {
            mergedConfig.debug = debug;
        }

        // Create a cache key method
        if (requestConfig.key) {
            mergedConfig.key = key(requestConfig);
        }

        // Generate request UUID
        mergedConfig.uuid = mergedConfig.key(req);

        config.debug(`Request config for ${req.url}`, mergedConfig);

        return mergedConfig;
    };

    /**
     * Configure cache adapter
     *
     * @param   {object} [config={}] Cache adapter options
     * @returns {object} Object containing cache `adapter` and `store`
     */
    function setupCache (config = {}) {
        // Extend default configuration
        config = makeConfig(config);

        // Axios adapter. Receives the axios request configuration as only parameter
        async function adapter (req) {
            // Merge the per-request config with the instance config.
            const reqConfig = mergeRequestConfig(config, req);

            // Execute request against local cache
            let res = await request(reqConfig, req);
            const next = res.next;

            // Response is not function, something was in cache, return it
            if (!isFunction(next)) return {
                ...next,
                cached: true
            };

            // Nothing in cache so we execute the default adapter or any given adapter
            // Will throw if the request has a status different than 2xx
            let networkError;

            try {
                res = await reqConfig.adapter(reqConfig, req);
                res.cached = false;
            } catch (err) {
                networkError = err;
            }

            if (networkError) {
                // Check if we should attempt reading stale cache data
                const readOnError = isFunction(reqConfig.readOnError)
                    ? reqConfig.readOnError(networkError, req)
                    : reqConfig.readOnError;

                if (readOnError) {
                    try {
                        // Force cache tu return stale data
                        reqConfig.acceptStale = true;

                        // Try to read from cache again
                        res = await request(reqConfig, req);

                        // Signal that data is from stale cache
                        res.next.request.stale = true;

                        // No need to check if `next` is a function just return cache data
                        return res.next;
                    } catch (cacheReadError) {
                        // Failed to read stale cache, do nothing here, just let the network error be thrown
                    }
                }

                // Re-throw error so that it can be caught in userland if we didn't find any stale cache to read
                throw networkError;
            }

            // Process response to store in cache
            return next(res);
        }

        // Return adapter and store instance
        return {
            adapter,
            config,
            store: config.store
        };
    }

    // ---------------------
    // Easy API Setup
    // ---------------------

    /**
     * Setup an axios instance with the cache adapter pre-configured
     *
     * @param {object} [options={}] Axios and cache adapter options
     * @returns {object} Instance of Axios
     */
    function setup (config = {}) {
        const instanceConfig = {
            ...defaults.axios,
            ...config,
            cache: {
                ...defaults.axios.cache,
                ...config.cache
            }
        };

        const cache = setupCache(instanceConfig.cache);
        const { cache: _, ...axiosConfig } = instanceConfig;

        const api = Axios.create(
            { ...axiosConfig, adapter: cache.adapter }
        );

        api.cache = cache.store;

        return api;
    }

    exports.serializeQuery = serializeQuery;
    exports.setup = setup;
    exports.setupCache = setupCache;

    Object.defineProperty(exports, '__esModule', { value: true });

})));

//# sourceMappingURL=index.js.map
