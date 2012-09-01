cat src/remutil.js src/rem.js > lib/rem.js
closure-compiler --js src/remutil.js --js src/rem.js --js_output_file lib/rem.min.js --compilation_level ADVANCED_OPTIMIZATIONS
echo `cat lib/rem.min.js | wc -c` minified
echo `gzip -c lib/rem.min.js | wc -c` gzipped
