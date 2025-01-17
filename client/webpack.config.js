const path = require('path');
const glob = require('glob');

const webpack = require('webpack');
const merge = require('webpack-merge');
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin');
const StylelintPlugin = require('stylelint-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const CleanPlugin = require('clean-webpack-plugin');

const parts = require('./webpack.parts.js');
const pageNames = require('./page.config.js');

const pageNameToHtmlPathMap = pageNames.reduce((acc, page) => {
  const pageName = page !== 'home' ? page : 'index';
  const extension = process.env.NODE_ENV === 'development' ? '.html' : '';
  const resourcePath = `/${pageName}${extension}`;
  const pugPageHrefVariable = page.replace(/-/g, '_');

  acc[pugPageHrefVariable] = resourcePath;
  return acc;
}, {});

const getPaths = ({
  sourceDir = 'app',
  buildDir = parts.BUILD_PATH,
  staticDir = '',
  images = 'images',
  fonts = 'fonts',
  js = 'scripts',
  css = 'styles',
} = {}) => {
  const assets = { images, fonts, js, css };

  return Object.keys(assets).reduce(
    (acc, assetName) => {
      const assetPath = assets[assetName];

      acc[assetName] = !staticDir ? assetPath : `${staticDir}/${assetPath}`;

      return acc;
    },
    {
      app: path.join(__dirname, sourceDir),
      build: path.join(__dirname, buildDir),
      staticDir,
    }
  );
};

/*
  To move all assets to some static folder
  getPaths({ staticDir: 'some-name' })

  To rename asset build folder
  getPaths({ js: 'some-name' })

  To move assets to the root build folder
  getPaths({ css: '' })

  Defaults values:
     sourceDir - 'app',
      buildDir - 'build',
     staticDir - '',

        images - 'images',
         fonts - 'fonts',
           css - 'styles',
            js - 'scripts'
*/
const paths = getPaths({
  sourceDir: 'app',
  buildDir: parts.BUILD_PATH,
});

const lintStylesOptions = {
  context: paths.app,
  files: ['common/styles/**/*.scss', 'pages/**/*.scss', 'templates/**/*.scss'],
  syntax: 'scss',
  fix: true,
  emitError: false,
};

const commonConfig = merge([
  {
    context: paths.app,
    resolve: {
      unsafeCache: true,
      symlinks: false,
      extensions: ['.pug', '.js', '.json', '.scss'],
      alias: {
        '@': path.resolve(paths.app),
        '@assets': path.resolve(paths.app, 'assets'),
        '@fonts': path.resolve(paths.app, 'assets', 'fonts'),
        '@images': path.resolve(paths.app, 'assets', 'images'),
        '@templates': path.resolve(paths.app, 'templates'),
        '@pages': path.resolve(paths.app, 'pages'),
        '@common': path.resolve(paths.app, 'common'),
        '@lib': path.resolve(paths.app, 'lib'),
      },
    },
    entry: {
      // 각 페이지별 entry는 parts.createPages의 html-webpack-plugin 에서 지정되며, 추후 webpack-merge에 의해 병합됩니다.
      common: path.join(paths.app, 'common', 'entry.js'), // common entry
    },
    output: {
      path: paths.build,
      publicPath: parts.PUBLIC_PATH,
    },
    stats: {
      warningsFilter: (warning) => warning.includes('entrypoint size limit'),
      children: false,
      modules: false,
    },
    plugins: [
      new ManifestPlugin({
        fileName: 'manifest.json',
        // filter: (file) => !file.path.match(/\.map$/), // 맵 파일 제거
        // map: (file) => {
        //   const extension = path.extname(file.name).slice(1);

        //   return {
        //     ...file,
        //     name: ['css', 'js'].includes(extension)
        //       ? `${extension}/${file.name}`
        //       : file.name
        //   }
        // },
        // useEntryKeys: true,
      }),
      new FriendlyErrorsPlugin(),
      new StylelintPlugin(lintStylesOptions),
    ],
    module: {
      noParse: /\.min\.js/,
    },
  },
  parts.loadPug({
    data: pageNameToHtmlPathMap,
    basedir: paths.app,
    root: paths.app,
  }),
  parts.loadFonts({
    include: paths.app,
    options: {
      name: `${paths.fonts}/[name].[hash:8].[ext]`,
    },
  }),
]);

const productionBuildConfig = merge([
  {
    mode: 'production',
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
      runtimeChunk: 'single',
    },
    output: {
      chunkFilename: `${paths.js}/[name].[chunkhash:8].js`,
      filename: `${paths.js}/[name].[chunkhash:8].js`,
    },
    performance: {
      hints: 'warning', // 'error' or false are valid too
      maxEntrypointSize: 100000, // in bytes
      maxAssetSize: 450000, // in bytes
    },
    plugins: [new webpack.HashedModuleIdsPlugin(), new CleanPlugin()],
  },
  parts.minifyJS({
    terserOptions: {
      parse: {
        // we want terser to parse ecma 8 code. However, we don't want it
        // to apply any minfication steps that turns valid ecma 5 code
        // into invalid ecma 5 code. This is why the 'compress' and 'output'
        // sections only apply transformations that are ecma 5 safe
        // https://github.com/facebook/create-react-app/pull/4234
        ecma: 8,
      },
      compress: {
        ecma: 5,
        warnings: false,
        // Disabled because of an issue with Uglify breaking seemingly valid code:
        // https://github.com/facebook/create-react-app/issues/2376
        // Pending further investigation:
        // https://github.com/mishoo/UglifyJS2/issues/2011
        comparisons: false,
      },
      mangle: {
        safari10: true,
      },
      output: {
        ecma: 5,
        comments: false,
        // Turned on because emoji and regex is not minified properly using default
        // https://github.com/facebook/create-react-app/issues/2488
        ascii_only: true,
      },
    },
    // Use multi-process parallel running to improve the build speed
    // Default number of concurrent runs: os.cpus().length - 1
    parallel: true,
  }),
  parts.loadJS({
    include: paths.app,
    options: {
      cacheDirectory: true,
    },
  }),
  parts.extractCSS({
    include: paths.app,
    options: {
      filename: `${paths.css}/[name].[contenthash:8].css`,
      chunkFilename: `${paths.css}/[id].[contenthash:8].css`,
    },
  }),
  parts.purifyCSS({
    paths: glob.sync(`${paths.app}/**/*.+(pug|js)`, { nodir: true }),
    styleExtensions: ['.css', '.scss'],
  }),
  parts.minifyCSS({
    options: {
      discardComments: {
        removeAll: true,
      },
    },
  }),
  parts.loadImages({
    include: paths.app,
    options: {
      name: `${paths.images}/[name].[hash:8].[ext]`,
    },
  }),
  // should go after loading images
  parts.optimizeImages(),
]);

const developmentBuildConfig = merge([
  {
    mode: 'development',
    output: {
      chunkFilename: `${paths.js}/[name].[chunkhash:8].js`,
      filename: `${paths.js}/[name].[chunkhash:8].js`,
    },
    devtool: 'inline-source-map',
  },
  parts.extractCSS({
    include: paths.app,
    options: {
      filename: `${paths.css}/[name].[contenthash:8].css`,
      chunkFilename: `${paths.css}/[id].[contenthash:8].css`,
    },
  }),
  parts.loadImages({
    include: paths.app,
    options: {
      name: `${paths.images}/[name].[hash:8].[ext]`,
    },
  }),
  parts.loadJS({ include: paths.app }),
]);

const devServerConfig = merge([
  {
    mode: 'development',
    output: {
      chunkFilename: `${paths.js}/[name].js`,
      filename: `${paths.js}/[name].js`,
    },
    devtool: 'inline-source-map',
  },
  parts.devServer(),
  parts.extractCSS({
    include: paths.app,
    options: {
      filename: `${paths.css}/[name].css`,
      chunkFilename: `${paths.css}/[id].css`,
    },
    isDevServer: true,
  }),
  parts.loadImages({
    include: paths.app,
    options: {
      name: `${paths.images}/[name].[ext]`,
    },
  }),
  parts.loadJS({ include: paths.app }),
]);

const pages = parts.createPages(paths.app, pageNames);

module.exports = (env) => {
  process.env.NODE_ENV = env === 'production' ? 'production' : 'development'; // env === 'devServer' 일때 NODE_ENV는 'development'로 매핑

  const configMap = {
    devServer: devServerConfig,
    development: developmentBuildConfig,
    production: productionBuildConfig,
  };

  return merge(commonConfig, configMap[env], ...pages);
};
