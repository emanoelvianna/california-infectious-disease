(function () {

    var gulp = require('gulp');
    var browserSync = require('browser-sync').create();
    var browserSyncSpa = require('browser-sync-middleware-spa');
    var packageJson = require('./package.json');

    /* Task registry */
    gulp.task('browser-sync', function () {
        browserSync.init({
            server: {
                baseDir: './',
                middleware: [
                    function (req, res, next) {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Headers', '*');
                        next();
                    }
                ]
            },
            startPath: 'index.html'
        });

        gulp.watch([
            'app/**/*.html',
            'app/**/*.js',
            'app/**/*.css'
        ]).on('change', browserSync.reload);
    });
}());