const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const cwd = process.cwd();

const webpackNodeConfig = {
    entry: path.resolve(__dirname, 'src') + '/index.node.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.node.js',
        library: {
            type: 'commonjs'
        }
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    }
                }]
            }
        ]
    },
    target: 'node',
    resolve: {
        extensions: ['.js'],
    },
    externals: {
        axios: 'axios',
        md5: 'md5',
        '@tusbar/cache-control': '@tusbar/cache-control'
    },
    devtool: 'source-map',
};

const webpackBrowserConfig = {
    entry: path.resolve(__dirname, 'src') + '/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        library: {
            type: 'umd'
        }
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    }
                }]
            }
        ]
    },
    target: 'web',
    resolve: {
        extensions: ['.js'],
    },
    externals: {
        axios: 'axios',
        md5: 'md5',
        '@tusbar/cache-control': '@tusbar/cache-control'
    },
    devtool: 'source-map',
};

// TEST CONFIG
const webpackTestingConfig = {
    entry: ['test/main.js'],
    output: {
        path: path.join(cwd, '.tmp'),
        filename: 'main.js'
    },
    resolve: {
        modules: ['node_modules', '.']
    },
    mode: 'development',
    module: {
        rules: [
            // Transpile ES2015 to ES5
            {
                test: /\.js$/,
                exclude: /(node_modules|\\utilities.spec\.js)$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    useBuiltIns: 'usage'
                                }]
                            ]
                        }
                    }
                ]
            },
            {
                test: /\.js$/,
                use: {
                    loader: 'istanbul-instrumenter-loader',
                    options: { esModules: true }
                },
                enforce: 'post',
                exclude: /(node_modules|\.spec\.js)$/
            },

            // Load font files
            { test: /\.(ttf|eot|svg)(\?[\s\S]+)?$/, loader: 'file-loader' },
            { test: /\.woff2?(\?v=\d\.\d\.\d)?$/, loader: 'url-loader' }
        ]
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin()
    ],
    devServer: {
    // contentBase: path.join(__dirname, 'public'), // boolean | string | array, static file location
        compress: true, // enable gzip compression
        historyApiFallback: true, // true for index.html upon 404, object for multiple paths
        hot: true, // hot module replacement. Depends on HotModuleReplacementPlugin
        https: false, // true for self-signed, object for cert authority
        noInfo: true, // only errors & warns on hot reload
        port: 3000
    },
    devtool: 'source-map'
};

module.exports = process.env.NODE_ENV === 'test' ? webpackTestingConfig : [webpackNodeConfig, webpackBrowserConfig];
