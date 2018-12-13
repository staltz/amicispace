/* Copyright (C) 2018 Andre Staltz.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// server.js
const fs = require('fs');
const http = require('http');
const pull = require('pull-stream');
const ssbKeys = require('ssb-keys');
const ssbConfigInject = require('ssb-config/inject');
const path = require('path');
const {buildGraphNodes, buildGraphEdges, fetchNode} = require('./graph');

function startScuttlebot() {
  const config = ssbConfigInject();
  config.keys = ssbKeys.loadOrCreateSync(path.join(config.path, 'secret'));
  return require('scuttlebot/index')
    .use(require('scuttlebot/plugins/plugins'))
    .use(require('scuttlebot/plugins/master'))
    .use(require('scuttlebot/plugins/replicate')) // ssb-friends needs this
    .use(require('ssb-friends'))
    .use(require('ssb-names'))
    .call(null, config);
}

const sbot = startScuttlebot();
const graphNodes = buildGraphNodes(sbot);
const graphEdges = buildGraphEdges(sbot);

http
  .createServer(async (request, response) => {
    if (request.url.endsWith('/nextNode')) {
      const {value, done} = await graphNodes.next();
      response.end(JSON.stringify(done ? null : value));
    } else if (request.url.match(/\/node\/(.*)$/)) {
      const [_, id] = request.url.match(/\/node\/(.*)$/);
      const node = await fetchNode(sbot, decodeURIComponent(id));
      response.end(JSON.stringify(node));
    } else if (request.url.endsWith('/nextEdge')) {
      const {value, done} = await graphEdges.next();
      response.end(JSON.stringify(done ? null : value));
    } else if (request.url.endsWith('/cola.min.js')) {
      response.end(fs.readFileSync('./cola.min.js'));
    } else if (request.url.endsWith('/cytoscape-cola.js')) {
      response.end(fs.readFileSync('./cytoscape-cola.js'));
    } else if (request.url.endsWith('/cytoscape.js')) {
      response.end(fs.readFileSync('./cytoscape.js'));
    } else {
      response.end(fs.readFileSync('./page.html'));
    }
  })
  .listen(9000);
