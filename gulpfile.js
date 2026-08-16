const gulp = require('gulp');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));

// Prefixing runs through gulp-postcss rather than gulp-autoprefixer, which went ESM-only at v8 and
// cannot be required from a CommonJS gulpfile. gulp-postcss and autoprefixer are both still
// CommonJS, so this keeps the pipeline on current postcss 8 without converting this file.
//
// The browsers it targets live in package.json under "browserslist", and they mirror the minimum
// versions Foundry itself enforces (see #BROWSER_TESTS in client/helpers/client-issues.mjs of the
// core install). Those minimums are high enough that autoprefixer normally has nothing to add. That
// is the point: it is a safety net for future CSS, not a transformer we depend on. If you ever bump
// it and see the output balloon, check that query first. The old "last 3 versions" matched IE 9-11,
// Opera Mini and BlackBerry, which added roughly 790 lines of dead vendor prefixes.


// const nodePackages = ["./node_modules/*puppeteer/*.*"];
// function copyPackages(){
//
//   return gulp.src(nodePackages, {base: './'}).pipe(gulp.dest('module/lib'))
// }

//const package = gulp.series(copyPackages);

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

// Small error handler helper function.
function handleError(err) {
  console.log(err.toString());
  this.emit('end');
}

const SYSTEM_SCSS = ["scss/**/*.scss"];
function compileScss() {
  // Configure options for sass output. For example, 'expanded' or 'nested'
  let options = {
    outputStyle: 'expanded'
  };
  return gulp.src(SYSTEM_SCSS)
    .pipe(
      sass(options)
        .on('error', handleError)
    )
    .pipe(postcss([
      autoprefixer({cascade: false})
    ]))
    .pipe(gulp.dest("./css"))
}
const css = gulp.series(compileScss);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_SCSS, css);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  compileScss,
  watchUpdates
);
exports.css = css;
//exports.package = package;
