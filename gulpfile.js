const gulp = require('gulp');
const babel = require('gulp-babel');
const rimraf = require('rimraf');
const rollup = require('gulp-better-rollup');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify-es').default;
const Server = require('karma').Server;

gulp.task('clean', function() {
    return rimraf('./dist');
});

gulp.task('minify', function () {
    return gulp.src('dist/index.js')
        .pipe(uglify())
        .pipe(rename('index.min.js'))
        .pipe(gulp.dest('dist'));
});

gulp.task('transpile', function() {
    return gulp.src('src/index.js')
        .pipe(rollup({
            plugins: [babel()],
            external: ['axios', 'md5', '@tusbar/cache-control'],
        }, {
            format: 'umd',
            sourcemaps: true,
        }))
        .pipe(rename('index.js'))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

gulp.task('test', function (done) {
    new Server({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true
    }, done).start();
});

gulp.task('build', gulp.series('clean', 'transpile', 'minify'));
