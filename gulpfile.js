const gulp = require('gulp');
const babel = require('gulp-babel');
const rimraf = require('rimraf');
const rollup = require('gulp-better-rollup');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify-es').default;

gulp.task('clean', function() {
    return rimraf('./dist');
});

gulp.task('minify_cjs', function () {
    return gulp.src('dist/cjs/index.js')
        .pipe(uglify())
        .pipe(rename('index.min.js'))
        .pipe(gulp.dest('dist/cjs'));
});

gulp.task('minify_esm', function () {
    return gulp.src('dist/esm/index.js')
        .pipe(uglify())
        .pipe(rename('index.min.js'))
        .pipe(gulp.dest('dist/esm'));
});

gulp.task('transpile_esm', function() {
    return gulp.src('src/index.js')
        .pipe(rollup({
            plugins: [babel()],
            external: ['axios', 'md5', '@tusbar/cache-control'],
        }, {
            name: 'index.js',
            format: 'esm',
            sourcemaps: true,
        }))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/esm'));
});

gulp.task('transpile_cjs', function() {
    return gulp.src('src/index.node.js')
        .pipe(rollup({
            plugins: [babel()],
            external: ['axios', 'md5', '@tusbar/cache-control'],
        }, {
            format: 'cjs',
            sourcemaps: true,
        }))
        .pipe(rename('index.js'))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/cjs'));
});

gulp.task('transpile', gulp.series('clean', gulp.parallel(gulp.series('transpile_esm', 'minify_esm'), gulp.series('transpile_cjs', 'minify_cjs'))) );
