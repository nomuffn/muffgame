const path = require('path')
const webpack = require('webpack')

module.exports = {
    devtool: 'eval-source-map',
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/js'),
        },
    },
    devServer: {
        static: './dist',
        client: {
            progress: true,
            overlay: {
                errors: true,
                warnings: false,
            },
        },
    },
    plugins: [new webpack.HotModuleReplacementPlugin()],
}
