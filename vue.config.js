const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8084,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true
      }
    }
  },
  // 生产环境配置
  productionSourceMap: false, // 不生成 source map

  // 配置 webpack
  configureWebpack: (config) => {
    // 生产环境去除 console.log
    if (process.env.NODE_ENV === 'production') {
      config.optimization = {
        ...config.optimization,
        minimizer: [
          ...config.optimization.minimizer,
          // 使用 terser 插件去除 console
          new (require('terser-webpack-plugin'))({
            terserOptions: {
              compress: {
                drop_console: true,   // 去除所有 console
                drop_debugger: true,  // 去除 debugger
                pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'] // 去除指定函数
              }
            }
          })
        ]
      }
    }
  }
})