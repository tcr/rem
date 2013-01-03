cat src/browser/jsonp.js src/browser/oauthlib.js src/browser/sha1.js src/browser/env.js src/browser/store.min.js src/rem.js src/browser/oauth.js > lib/rem.js
echo 'Compressing...'
closure-compiler --js src/browser/jsonp.js --js src/browser/oauthlib.js --js src/browser/sha1.js --js src/browser/store.min.js --js src/browser/env.js --js src/rem.js --js src/browser/oauth.js --js_output_file lib/rem.min.js --compilation_level ADVANCED_OPTIMIZATIONS
echo `cat lib/rem.min.js | wc -c` minified
echo `gzip -c lib/rem.min.js | wc -c` gzipped
