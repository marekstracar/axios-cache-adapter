const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const cwd = process.cwd();

// Base filenameTemplate and version variable to store what kind of version we'll be generating
const filenameTemplate = 'index[version].js';
const filenameParts = [''];

// Start with empty list of plugins and externals and an undefined devtool
const externals = {};

let target = 'web';
let entry = './src/index.js';

// List external dependencies
const dependencies = [
    'axios'
];

dependencies.forEach(dep => {
    externals[dep] = {
        umd: dep,
        amd: dep,
        commonjs: dep,
        commonjs2: dep
    };
});

if (process.env.NODE_BUILD_FOR === 'node') {
    filenameParts.push('node');
    target = 'node';
    entry = './src/index.node.js';
}

// Check if we should make a minified version
if (process.env.NODE_ENV === 'production') {
    filenameParts.push('min');
}

// Generate actual filenameTemplate
// index.js || index.min.js || index.node.js || index.node.min.js
const filename = filenameTemplate.replace('[version]', filenameParts.join('.'));

const webpackConfig = {
    entry,
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename,
    },
    mode: 'production',
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
                                targets: target === 'node'
                                    ? {node: 'current'}
                                    : {chrome: '58'}
                            }]
                        ]
                    }
                }]
            }
        ]
    },
    externals,
    devtool: 'source-map',
    target
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
                exclude: /node_modules|\\utilities.spec\.js$/,
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
                exclude: /node_modules|\.spec\.js$/
            },

            // Load font files
            { test: /\.(ttf|eot|svg)(\?[\s\S]+)?$/, loader: 'file-loader' },
            { test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: 'url-loader' }
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
    target: 'web',
    devtool: 'source-map'
};

module.exports = process.env.NODE_ENV === 'test' ? webpackTestingConfig : webpackConfig;
