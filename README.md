# sp-server
Node.js simple Single Page Server

## Installation
Just use npm install

```bash
npm install sp-server
```

## Usage
Follow example

```javascript
var server = require('sp-server');

server('./build', 'index.html')
  .on('/', function (page, params, callback) {
    callback(page.replace('<!-- OPENGRAPH -->', opengraph));
  })
  .on('/:id', function (page, params, callback) {
    console.log(params); // {id: 123}
    callback(page);
  })
  .start(8080)
;
```

Description of parameters in function
- *page* - content page of index.html placed in ./build
- *params* - matched params with RegExp
- *callback* - callback function to be called when all is done, applies string to response
