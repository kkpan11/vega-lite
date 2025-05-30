// modified from vega-cli

import * as vega from 'vega';
import path from 'path';
import args from './args.js';
import read from './read.js';
import {compile} from '../build/index.js';
import {readFileSync} from 'fs';
import {exit} from 'process';

function load(file) {
  return readFileSync(file, 'utf8');
}

const Levels = {
  error: vega.Error,
  warn: vega.Warn,
  info: vega.Info,
  debug: vega.Debug,
};

export function render(type, callback, opt) {
  // parse command line arguments
  const arg = args(type);

  // set baseURL, if specified. default to input spec directory
  const base = arg.base || (arg._[0] ? path.dirname(arg._[0]) : null);

  // set log level, defaults to logging warning messages
  const loglevel = Levels[String(arg.loglevel).toLowerCase()] || vega.Warn;

  // load config file, if specified
  const config = arg.config ? load(arg.config) : null;

  // set output image scale factor
  const scale = arg.scale || undefined;

  // Allows for other ppi settings than 72 for png files
  const ppi = arg.ppi || 72;

  // use a seeded random number generator, if specified
  if (typeof arg.seed !== 'undefined') {
    if (Number.isNaN(arg.seed)) throw 'Illegal seed value: must be a valid number.';
    vega.setRandom(vega.randomLCG(arg.seed));
  }

  // locale options, load custom number/time formats if specified
  const locale = {
    number: arg.format ? load(arg.format) : null,
    time: arg.timeFormat ? load(arg.timeFormat) : null,
  };

  // instantiate view and invoke headless render method
  function r(vlSpec) {
    const vgSpec = compile(vlSpec, {config}).spec;
    const view = new vega.View(vega.parse(vgSpec), {
      locale: locale, // set locale options
      loader: vega.loader({baseURL: base}), // load files from base path
      logger: vega.logger(loglevel, 'error'), // route all logging to stderr
      renderer: 'none', // no primary renderer needed
    }).finalize(); // clear any timers, etc

    return (type === 'svg' ? view.toSVG(scale) : view.toCanvas((scale * ppi) / 72, opt)).then((_) => callback(_, arg));
  }

  // read input from file or stdin
  read(arg._[0] || null)
    .then((text) => r(JSON.parse(text)))
    .catch((err) => {
      console.error(err);
      exit(1);
    });
}
