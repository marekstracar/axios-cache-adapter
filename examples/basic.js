import { setupCache } from '../src/index.js';
import Axios from 'axios';

// Create an `axios` instance with `axios-cache-adapter` pre-configured
const cacheAdapter = setupCache({
    // `axios` options
    baseURL: 'https://httpbin.org',
    // Cache expiration in milliseconds, here 15min
    maxAge: 15 * 60 * 1000,
    // Cache exclusion rules
    exclude: {
        // Store responses from requests with query parameters in cache
        query: false,
    },
});

const apiConfig = {
    adapter: cacheAdapter.adapter,
};

const api = Axios.create(apiConfig);

// Make a request to https://httpbin.org/get?foo=bar (runkit handles what appears to be a top-level await)
(async function getCall () {
    const response = await api.get('/get?foo=bar');
    const response2 = await api.get('/get?foo=bar');

    console.log('Cached?', response.cached);
    console.log('Cached?', response2.cached);
}());
