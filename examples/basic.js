const { setup } = require('@marekstracar/axios-cache-adapter')

// Create an `axios` instance with `axios-cache-adapter` pre-configured
const api = setup({
  // `axios` options
  baseURL: 'https://httpbin.org',

  // `axios-cache-adapter` options
  cache: {
    // Cache expiration in milliseconds, here 15min
    maxAge: 15 * 60 * 1000,
    // Cache exclusion rules
    exclude: {
      // Store responses from requests with query parameters in cache
      query: false
    }
  }
});

// Make a request to https://httpbin.org/get?foo=bar (runkit handles what appears to be a top-level await)
(async function getCall () {
    const response = await api.get('/get?foo=bar')
    console.log(response)
}())
