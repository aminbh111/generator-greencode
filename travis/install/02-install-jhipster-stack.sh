#!/bin/bash
set -ev
#-------------------------------------------------------------------------------
# Maybe speed up the build
#-------------------------------------------------------------------------------
npm set progress=false
#-------------------------------------------------------------------------------
# Install yeoman, bower and gulp
#-------------------------------------------------------------------------------
npm install -g yo
npm install -g bower
npm install -g gulp-cli
#-------------------------------------------------------------------------------
# Install the latest version of Greencode
#-------------------------------------------------------------------------------
cd "$TRAVIS_BUILD_DIR"/
npm install
npm link
npm test
