#!/bin/sh
set -eu
openresty -p /opt/om/nginx/ -t
pid=$(pgrep -f '^nginx: master process /usr/bin/openresty -p /opt/om/nginx/')
[ -n "$pid" ]
kill -HUP "$pid"
