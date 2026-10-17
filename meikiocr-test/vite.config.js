import {defineConfig} from 'vite';
export default defineConfig({base:'./',resolve:{alias:[{find:/^onnxruntime-web$/,replacement:'onnxruntime-web/wasm'}],conditions:['onnxruntime-web-use-extern-wasm']},worker:{format:'es',plugins:()=>[]},build:{outDir:'dist',target:'es2022'}});
