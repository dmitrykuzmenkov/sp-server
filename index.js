var cluster = require('cluster');
var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var cpu_num = require('os').cpus().length;

module.exports = function (html_root, entry_file) {
  var html_file = path.join(html_root, entry_file);
  var html = fs.readFileSync(html_file, 'utf8');

  return {
    routes: [],
    // callback applies html of entry file, matched params, callback to call after finish
    on: function (route, callback) {
      this.routes[route] = callback;
      return this;
    },
    start: function (port) {
      if (cluster.isMaster) {
        for (var i = 0; i < cpu_num; i++) {
          cluster.fork();
        }

        cluster.on('exit', function(worker, code, signal) {
          console.log('Worker ' + worker.process.pid + ' died');
        });
      } else {
        var _this = this;
        var server = http.createServer(function (req, res) {
          // Fallback
          var timeout = setTimeout(function() {
            console.log(req_path, 'failed');
            res.writeHead(503);
            res.end();
          }, 500);

          // 200 callback
          var callback = function (data) {
            clearTimeout(timeout);
            res.end(data);
          };

          var req_path = url.parse(req.url).pathname;
          var has_match = false;

          var matches;
          for (var r in _this.routes) {
            matches = (new RegExp('^\/?' + r + '\/?$')).exec(req_path);
            if (matches) {
              console.log(req_path, 'matches', r);
              _this.routes[r](html, matches, callback);
              has_match = true;
              break;
            }
          }

          // Static files
          if (!has_match) {
            var filename = path.join(html_root, req_path);
            var not_found = function () {
              clearTimeout(timeout);
              console.log('File', filename, 'not found');
              res.writeHead(404, {'Content-Type': 'text/plain'});
              res.write('404 Not Found\n');
              res.end();
            };

            fs.access(filename, fs.F_OK | fs.R_OK, function (err) {
              if (err) {
                not_found();
                return;
              }

              fs.stat(filename, function (err, stat) {
                if (!err && stat.isFile()) {
                  fs.createReadStream(filename).pipe(res);
                  return;
                }

                not_found();
              });
            });
          }
        });

        server.listen(port, function () {
          console.log('Server started on port ' + port);
        });
      }

      return this;
    }
  };
};
