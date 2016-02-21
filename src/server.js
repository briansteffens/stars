var fs = require('fs');

require('http').createServer(function(req, res) {
  console.log("request: " + req.method + " " + req.url);

  if (req.url === '/') {
    var path = 'src/index.html';

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': fs.statSync(path).size,
    });

    fs.createReadStream(path).pipe(res)
  }
  else {
    res.writeHead(404);
    res.end();
  }
}).listen(80);

var wss = new require('ws').Server({port: 8080});
wss.on('connection', function(ws) {
  ws.on('message', function(message) {
    console.log('received: %s', message);
  });
  ws.send('something');
});
