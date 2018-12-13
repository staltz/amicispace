// const ssbKeys = require('ssb-keys');
// const ssbConfigInject = require('ssb-config/inject');
// const path = require('path');
const pull = require('pull-stream');
const pify = require('pify');

function buildGraphAttrs(sbot) {
  const attributesWithoutIds = [
    {
      id: undefined,
      about: 'node',
      name: 'label',
      type: 'string',
      build: async feedid => {
        try {
          return await pify(sbot.names.getSignifier)(feedid);
        } catch (error) {
          return '';
        }
      },
    },

    {
      id: undefined,
      about: 'node',
      name: 'birth',
      type: 'double',
      build: async feedid => {
        try {
          let done = false;
          return await pify(cb =>
            pull(
              sbot.createUserStream({id: feedid, reverse: false, limit: 1}),
              pull.drain(
                msg => {
                  const arrivalTimestamp = msg.timestamp;
                  const declaredTimestamp = msg.value.timestamp;
                  const ts = Math.min(arrivalTimestamp, declaredTimestamp);
                  done = true;
                  cb(null, ts);
                },
                () => {
                  if (!done) {
                    cb(null, Date.now());
                  }
                },
              ),
            ),
          )();
        } catch (error) {
          return Date.now();
        }
      },
    },

    {
      id: undefined,
      about: 'node',
      name: 'lastactive',
      type: 'double',
      build: async feedid => {
        try {
          let done = false;
          return await pify(cb =>
            pull(
              sbot.createUserStream({id: feedid, reverse: true, limit: 1}),
              pull.drain(
                msg => {
                  const arrivalTimestamp = msg.timestamp;
                  const declaredTimestamp = msg.value.timestamp;
                  const ts = Math.min(arrivalTimestamp, declaredTimestamp);
                  done = true;
                  cb(null, ts);
                },
                () => {
                  if (!done) {
                    cb(null, Date.now());
                  }
                },
              ),
            ),
          )();
        } catch (error) {
          return '';
        }
      },
    },

    {
      id: undefined,
      about: 'node',
      name: 'seq',
      type: 'int',
      build: async feedid => {
        try {
          return await pify(sbot.latestSequence)(feedid);
        } catch (error) {
          return 0;
        }
      },
    },
  ];
  const attributes = attributesWithoutIds.map((attr, i) => {
    attr.id = `d${i}`;
    return attr;
  });
  return attributes;
}

async function* buildGraphNodes(sbot) {
  const attrs = buildGraphAttrs(sbot);
  const hopsData = await pify(sbot.friends.hops)();
  const nodes = Object.keys(hopsData).map(id => ({id}));
  for (let node of nodes) {
    for (let attr of attrs) {
      node[attr.name] = await attr.build(node.id);
    }
    yield node;
  }
}

async function fetchNode(sbot, id) {
  const node = {id};
  const attrs = buildGraphAttrs(sbot);
  for (let attr of attrs) {
    node[attr.name] = await attr.build(node.id);
  }
  return node;
}

async function* buildGraphEdges(sbot) {
  const follows = await pify(sbot.friends.get)();
  for (let orig of Object.keys(follows)) {
    for (let dest of Object.keys(follows[orig])) {
      if (follows[orig][dest] === true) {
        yield [orig, dest];
      }
    }
  }
}

module.exports = {
  buildGraphNodes,
  fetchNode,
  buildGraphEdges,
};

// async function buildGraph(sbot) {
//   const attrs = buildGraphAttrs(sbot);
//   const nodes = await graphNodes(sbot, attrs);
//   const edges = await graphEdges(sbot);
//   return {attrs, nodes, edges};
// }

// function* toGraphml({attrs, nodes, edges}) {
//   yield '<?xml version="1.0" encoding="UTF-8"?>\n';
//   yield `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
//     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
//     xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
//     http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">\n`;
//   yield '  <graph id="G" edgedefault="directed">\n';
//   for (let attr of attrs) {
//     const i = attr.id;
//     const f = attr.about;
//     const n = attr.name;
//     const t = attr.type;
//     yield `    <key id="${i}" for="${f}" attr.name="${n}" attr.type="${t}"/>\n`;
//   }
//   for (let node of nodes) {
//     yield `    <node id="${node.id}">\n`;
//     for (attr of attrs) {
//       const attrKey = attr.id;
//       const attrValue = encodeURIComponent(node[attr.name]);
//       yield `      <data key="${attrKey}">${attrValue}</data>\n`;
//     }
//     yield `    </node>\n`;
//   }
//   for (let [orig, dest] of edges) {
//     yield `    <edge source="${orig}" target="${dest}"/>\n`;
//   }
//   yield '  </graph>\n</graphml>';
// }

// module.exports = async function run() {
//   const sbot = startScuttlebot();
//   const graph = await buildGraph(sbot);
//   sbot.close();
//   return toGraphml(graph);
// };
