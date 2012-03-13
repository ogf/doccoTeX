(function() {
  var destination, docco_template, ensure_directory, exec, ext, fs, generate_documentation, generate_latex, get_language, l, languages, markdown_to_latex, parse, path, section_marker, sources, spawn, template, _ref;

  generate_documentation = function(source, callback) {
    return fs.readFile(source, "utf-8", function(error, code) {
      var sections;
      if (error) throw error;
      sections = parse(source, code);
      return markdown_to_latex(source, sections, function() {
        generate_latex(source, sections);
        return callback();
      });
    });
  };

  parse = function(source, code) {
    var code_text, docs_text, has_code, language, line, lines, save, sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = get_language(source);
    has_code = docs_text = code_text = '';
    save = function(docs, code) {
      return sections.push({
        docs_text: docs,
        code_text: code
      });
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
        if (has_code) {
          save(docs_text, code_text);
          has_code = docs_text = code_text = '';
        }
        docs_text += line.replace(language.comment_matcher, '') + '\n';
      } else {
        has_code = true;
        code_text += line + '\n';
      }
    }
    save(docs_text, code_text);
    return sections;
  };

  markdown_to_latex = function(source, sections, callback) {
    var language, output, pandoc, section, to_write;
    language = get_language(source);
    pandoc = spawn('pandoc', ['-f', 'markdown', '-t', 'latex']);
    output = '';
    pandoc.stderr.addListener('data', function(error) {
      if (error) return console.error(error.toString());
    });
    pandoc.stdin.addListener('error', function(error) {
      console.error("Could not use Pandoc to convert the docs to LaTeX.");
      return process.exit(1);
    });
    pandoc.stdout.addListener('data', function(result) {
      if (result) return output += result;
    });
    pandoc.addListener('exit', function() {
      var fragments, i, section, _len;
      fragments = output.split(section_marker);
      for (i = 0, _len = sections.length; i < _len; i++) {
        section = sections[i];
        section.docs_text = fragments[i];
      }
      return callback();
    });
    if (pandoc.stdin.writable) {
      to_write = ((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = sections.length; _i < _len; _i++) {
          section = sections[_i];
          _results.push(section.docs_text);
        }
        return _results;
      })()).join(section_marker + "\n\n");
      pandoc.stdin.write(to_write);
      return pandoc.stdin.end();
    }
  };

  generate_latex = function(source, sections) {
    var dest, html, title;
    title = path.basename(source);
    dest = destination(source);
    html = docco_template({
      title: title,
      sections: sections,
      sources: sources,
      path: path,
      destination: destination,
      language: get_language(source)
    });
    console.log("doccotex: " + source + " -> " + dest);
    return fs.writeFile(dest, html);
  };

  fs = require('fs');

  path = require('path');

  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;

  languages = {
    '.coffee': {
      name: 'coffee-script',
      symbol: '#'
    },
    '.js': {
      name: 'javascript',
      symbol: '//'
    },
    '.rb': {
      name: 'ruby',
      symbol: '#'
    },
    '.py': {
      name: 'python',
      symbol: '#'
    },
    '.tex': {
      name: 'tex',
      symbol: '%'
    },
    '.latex': {
      name: 'tex',
      symbol: '%'
    },
    '.c': {
      name: 'c',
      symbol: '//'
    },
    '.h': {
      name: 'c',
      symbol: '//'
    }
  };

  for (ext in languages) {
    l = languages[ext];
    l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');
    l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{)');
  }

  get_language = function(source) {
    return languages[path.extname(source)];
  };

  destination = function(filepath) {
    return 'docs/' + path.basename(filepath, path.extname(filepath)) + '.tex';
  };

  ensure_directory = function(dir, callback) {
    return exec("mkdir -p " + dir, function() {
      return callback();
    });
  };

  template = function(str) {
    return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};' + 'with(obj){p.push(\'' + str.replace(/[\r\t]/g, " ").replace(/\\(?=[^<]*%>)/g, "\t").replace(/\\/g, "\\\\").replace(/\t/g, "\\").replace(/%>\s*?\n/g, "%>").replace(/\n/g, "\\n").replace(/'(?=[^<]*%>)/g, "\t").split("'").join("\\'").split("\t").join("'").replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');").split('%>').join("p.push('") + "');}return p.join('');");
  };

  docco_template = template(fs.readFileSync(__dirname + '/../resources/docco.jst').toString());

  section_marker = '\ndoccotexdivider';

  sources = process.ARGV.sort();

  if (sources.length) {
    ensure_directory('docs', function() {
      var files, next_file;
      files = sources.slice(0);
      next_file = function() {
        if (files.length) return generate_documentation(files.shift(), next_file);
      };
      return next_file();
    });
  }

}).call(this);
