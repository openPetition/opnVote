#!/bin/sh

VERSION=`git describe --tags 2>/dev/null`

if [ "$?" != "0" ]; then
    VERSION=`git rev-parse --short=6 HEAD`
fi

echo "wrote version number to .env.production.local: $VERSION" >&2

echo "NEXT_PUBLIC_VERSION=$VERSION" > .env.local
echo "NEXT_PUBLIC_VERSION=$VERSION" >> .env.production.local
