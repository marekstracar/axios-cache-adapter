const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const cwd = process.cwd();

// List external dependencies
const externals = [
    'axios',
    'md5',
    '@tusbar/cache-control'
];

const webpackConfig = {
    entry: {
        'index.node': './src/index.node.js',
        'index': './src/index.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },
    mode: process.env.NODE_ENV || 'development',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {node: 'current', chrome: '58'}
                            }]
                        ]
                    }
                }]
            }
        ]
    },
    externals,
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
    mode: process.env.NODE_ENV || 'development',
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

module.exports = process.env.NODE_ENV === 'test' ? webpackTestingConfig : webpackConfig;
