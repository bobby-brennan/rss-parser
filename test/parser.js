"use strict";

var fs = require('fs');
var HTTP = require('http');

var Parser = require('../index.js');

var Expect = require('chai').expect;

var IN_DIR = __dirname + '/input';
var OUT_DIR = __dirname + '/output';

describe('Parser', function() {
  var testParseForFile = function(name, ext, options, done) {
    if (typeof done === 'undefined') {
      done = options;
      options = {};
    }
    let parser = new Parser(options);
    let xml = fs.readFileSync(IN_DIR + '/' + name + '.' + ext, 'utf8');
    parser.parseString(xml, function(err, parsed) {
      if (err) console.log(err);
      Expect(err).to.equal(null);
      if (process.env.WRITE_GOLDEN) {
        fs.writeFileSync(OUT_DIR + '/' + name + '.json', JSON.stringify({feed: parsed}, null, 2));
      } else {
        var expected = fs.readFileSync(OUT_DIR + '/' + name + '.json', 'utf8')
        expected = JSON.parse(expected);
        Expect({feed: parsed}).to.deep.equal(expected);
      }
      done();
    })
  }

  it('should parse Reddit', function(done) {
    testParseForFile('reddit', 'rss', done);
  })

  it('should parse sciencemag.org (RSS 1.0)', function(done) {
    testParseForFile('rss-1', 'rss', done);
  })

  it('should parse craigslist (RSS 1.0)', function(done) {
    testParseForFile('craigslist', 'rss', done);
  })

  it('should parse atom', function(done) {
    testParseForFile('reddit-atom', 'rss', done);
  })

  it('should parse atom feed', function(done) {
    testParseForFile('gulp-atom', 'atom', done);
  })

  it('should parse reddits new feed', function(done) {
    testParseForFile('reddit-home', 'rss', done);
  })

  it('should parse with missing fields', function(done) {
    testParseForFile('missing-fields', 'atom', done)
  })

  it('should parse with incomplete fields', function(done) {
    testParseForFile('incomplete-fields', 'atom', done)
  })

  it('should parse heise', function(done) {
    testParseForFile('heise', 'atom', done);
  })

  it('should parse heraldsun', function(done) {
    testParseForFile('heraldsun', 'rss', done);
  });

  it('should parse UOL Noticias', function(done) {
    testParseForFile('uolNoticias', 'rss', { defaultRSS: 2.0 }, done);
  });

  it('should NOT parse UOL Noticias, if no default RSS is provided', function(done) {
    function willFail() {
      testParseForFile('uolNoticias', 'rss', done);
    }
    Expect(willFail).to.throw;
    done();
  });

  it('should parse Instant Article', function(done) {
    testParseForFile('instant-article', 'rss', done);
  });

  it('should parse Feedburner', function(done) {
    testParseForFile('feedburner', 'atom', done);
  });

  it('should parse podcasts', function(done) {
    testParseForFile('narro', 'rss', done);
  });

  it('should parse multiple links', function(done) {
    testParseForFile('many-links', 'rss', done);
  });

  it('should parse itunes with empty href', function(done) {
    testParseForFile('itunes-href', 'rss', done);
  });

  it('should pass xml2js options', function(done) {
    testParseForFile('xml2js-options', 'rss', {xml2js: {emptyTag: 'EMPTY'}}, done);
  });

  it('should throw error for unrecognized', function(done) {
    let parser = new Parser();
    let xml = fs.readFileSync(__dirname + '/input/unrecognized.rss', 'utf8');
    parser.parseString(xml, function(err, parsed) {
      Expect(err.message).to.contain('Feed not recognized as RSS');
      done();
    });
  });

  it('should omit iTunes image if none available during decoration', function(done) {
    const rssFeedWithMissingImage = __dirname + '/input/itunes-missing-image.rss';
    const xml = fs.readFileSync(rssFeedWithMissingImage, 'utf8');
    let parser = new Parser();
    parser.parseString(xml, function(err, parsed) {
      Expect(err).to.be.null;
      Expect(parsed).to.not.have.deep.property('feed.itunes.image');
      done();
    });
  });

  it('should parse custom fields', function(done) {
    var options = {
      customFields: {
        feed: ['language', 'copyright', 'nested-field'],
        item: ['subtitle']
      }
    };
    testParseForFile('customfields', 'rss', options, done);
  });

  it('should parse Atom feed custom fields', function(done) {
    var options = {
      customFields: {
        feed: ['totalViews'],
        item: ['media:group']
      }
    };
    testParseForFile('atom-customfields', 'atom', options, done);
  });

  it('should parse sibling custom fields', function(done) {
    var options = {
      customFields: {
        item: [['media:content', 'media:content', {keepArray: true}]]
      }
    };
    testParseForFile('guardian', 'rss', options, done);
  });

  it('should parse URL', function(done) {
    var INPUT_FILE = __dirname + '/input/reddit.rss';
    var OUTPUT_FILE = __dirname + '/output/reddit.json';
    var server = HTTP.createServer(function(req, res) {
      var file = fs.createReadStream(INPUT_FILE, 'utf8');
      file.pipe(res);
    });
    server.listen(function() {
      var port = server.address().port;
      var url = 'http://localhost:' + port;
      let parser = new Parser();
      parser.parseURL(url, function(err, parsed) {
        Expect(err).to.equal(null);
        if (process.env.WRITE_GOLDEN) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify({feed: parsed}, null, 2));
        } else {
          var expected = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
          Expect({feed: parsed}).to.deep.equal(expected);
        }
        server.close();
        done();
      });
    });
  });

  it('should parse URL with relative redirect', function(done) {
    var INPUT_FILE = __dirname + '/input/reddit.rss';
    var OUTPUT_FILE = __dirname + '/output/reddit.json';
    var server = HTTP.createServer(function(req, res) {
      if (req.url !== '/new-location') {
        res.writeHead(301, { 'Location': '/new-location'});
        res.end();
      } else {
        var file = fs.createReadStream(INPUT_FILE, 'utf8');
        file.pipe(res);
      }
    });
    server.listen(function() {
      var port = server.address().port;
      var url = 'http://localhost:' + port;
      let parser = new Parser();
      parser.parseURL(url, function(err, parsed) {
        Expect(err).to.equal(null);
        if (process.env.WRITE_GOLDEN) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify({feed: parsed}, null, 2));
        } else {
          var expected = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
          Expect({feed: parsed}).to.deep.equal(expected);
        }
        server.close();
        done();
      });
    });
  });

  it('should use proper encoding', function(done) {
    var INPUT_FILE = __dirname + '/input/encoding.rss';
    var OUTPUT_FILE = __dirname + '/output/encoding.json';
    var ENCODING = 'latin1';
    var server = HTTP.createServer(function(req, res) {
      res.setHeader('Content-Type', 'text/xml; charset=' + ENCODING)
      var file = fs.readFileSync(INPUT_FILE, ENCODING);
      res.end(file, ENCODING);
    });
    server.listen(function() {
      var port = server.address().port;
      var url = 'http://localhost:' + port;
      var parser = new Parser();
      parser.parseURL(url, function(err, parsed) {
        Expect(err).to.equal(null);
        if (process.env.WRITE_GOLDEN) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify({feed: parsed}, null, 2), {encoding: ENCODING});
        } else {
          var expected = JSON.parse(fs.readFileSync(OUTPUT_FILE, ENCODING));
          Expect({feed: parsed}).to.deep.equal(expected);
        }
        server.close();
        done();
      })
    })
  });

  it('should respect timeout option', function(done) {
    var server = HTTP.createServer(function(req, res) {});
    server.listen(function() {
      var port = server.address().port;
      var url = 'http://localhost:' + port;
      var parser = new Parser({timeout: 1});
      parser.parseURL(url, function(err, parsed) {
        Expect(err).to.not.equal(null);
        Expect(err.message).to.equal("Request timed out after 1ms");
        done();
      });
    });
  });

  it('should parse episodeType', function(done) {
    testParseForFile('item-itunes-episodeType', 'rss', done);
  });

  it('should parse itunes categories', function(done) {
    testParseForFile('itunes-category', 'rss', done);
  });

  it('should parse itunes keywords', function(done) {
    testParseForFile('itunes-keywords', 'rss', done);
  });

  it('should parse itunes keywords as array', function(done) {
    testParseForFile('itunes-keywords-array', 'rss', done);
  });

  it('should parse itunes keywords with attribute `text`', function(done) {
    testParseForFile('itunes-keywords-astext', 'rss', done);
  });

  it('should parse giantbomb-podcast', function(done) {
    testParseForFile('giantbomb-podcast', 'rss', done);
  });

  it('should parse content:encoded', function(done) {
    testParseForFile('content-encoded', 'rss', done);
  });

  it('should parse atom:link pagination links', function (done) {
    testParseForFile('pagination-links', 'rss', done);
  });
})
