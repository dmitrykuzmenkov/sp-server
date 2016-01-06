var cluster = require('cluster');
var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var mime = require('mime');
var cpu_num = require('os').cpus().length;

var param_re =/\:[^\:\/]+/g;

module.exports = function (html_root, entry_file) {
  var html_file = path.join(html_root, entry_file);
  var html = fs.readFileSync(html_file, 'utf8');

  return {
    routes: [],
    // callback applies html of entry file, matched params, callback to call after finish
    on: function (route, callback) {
      var match;
      var params = [];
      while (match = param_re.exec(route)) {
        params.push(match[0].substring(1));
      }

      this.routes.push({
        route: route,
        regexp: new RegExp('^\/?' + route.replace(param_re, '([^\:\/]+?)') + '\/?$'),
        params: params,
        callback: callback
      });
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

          _this.routes.forEach(function(r) {
            var matches;
            var params = {};
            matches = r.regexp.exec(req_path);
            if (matches) {
              console.log(req_path, 'matches', r.route);
              for (var k in r.params) {
                params[r.params[k]] = matches[(k + 1) | 0];
              }

              r.callback(html, params, callback);
              has_match = true;
              return;
            }
          });

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
                  clearTimeout(timeout);
                  res.writeHead(200, {'Content-type': mime.lookup(filename)});
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
