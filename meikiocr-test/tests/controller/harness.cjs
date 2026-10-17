const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let canvas;
try { canvas = require('@napi-rs/canvas'); }
catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  canvas = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas'));
}
function load(file = process.env.APP_HTML || path.join(__dirname, '../../.testing/camera.html')) {
  const elements = new Map(), timers = new Map(), messages = [], drawn = [];
  let timerId = 0, now = 1000;
  function decorate(el) {
    el.style = {}; el.hidden = false; el.textContent = ''; el.attrs = {}; el.listeners = {};
    const classes = new Set();
    el.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle(x, on) { if (on) classes.add(x); else classes.delete(x); } };
    el.setAttribute = (k, v) => { el.attrs[k] = v; };
    el.addEventListener = (name, fn) => (el.listeners[name] ||= []).push(fn);
    el.getBoundingClientRect = () => ({left: 10, top: 20, width: 640, height: 360, right:650, bottom:380});
    return el;
  }
  function makeCanvas() { return decorate(canvas.createCanvas(640, 360)); }
  function get(id) {
    if (!elements.has(id)) {
      const el = ['video', 'overlay', 'still-frame'].includes(id) ? makeCanvas() : decorate({});
      if (id === 'video') { el.videoWidth = 640; el.videoHeight = 360; el.play = async () => {}; }
      elements.set(id, el);
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    document: {getElementById:get, createElement: tag => { if(tag !== 'canvas') throw Error('Unexpected tag '+tag); return makeCanvas(); }},
    window: {}, navigator: {}, performance: {now:() => now},
    console: Object.fromEntries(['log','warn','debug','error'].map(k => [k,(...args)=>messages.push([k,...args])])),
    setTimeout: (fn,delay) => { timers.set(++timerId,{fn,delay}); return timerId; },
    clearTimeout: id => timers.delete(id), Uint8Array, Uint8ClampedArray, Float32Array,
    featurematchReady: async () => { throw Error('External feature library intentionally absent in unit harness'); }
  });
  const html = fs.readFileSync(file,'utf8');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  vm.runInContext(script,context,{filename:file});
  const overlayContext = get('overlay').getContext('2d'), originalFillText = overlayContext.fillText.bind(overlayContext);
  overlayContext.fillText = (text,...args) => { drawn.push(text); originalFillText(text,...args); };
  return {
    run: code => vm.runInContext(code,context),
    put: (name,value) => {context[name] = value;}, get, timers, messages, drawn,
    advance: ms => {now += ms;},
    emit(id,type,event) { for(const fn of get(id).listeners[type] || []) fn(event); },
    html, makeCanvas,
  };
}
function reading(text='ください', confidence=90, box={x0:100,y0:100,x1:300,y1:130}, more={}) {return {text,confidence,box:{...box},...more};}
function data(items) {return {text:items.map(x=>x.text).join(' '), blocks:[{paragraphs:[{lines:items.map(it=>({words:[{text:it.text,confidence:it.confidence,bbox:it.box}]}))}]}]};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
module.exports={load,reading,data,deferred};
