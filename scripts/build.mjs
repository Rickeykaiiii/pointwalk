import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/scene.js'],bundle:true,format:'iife',minify:true,write:false});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=await readFile('src/index.html','utf8');
await mkdir('dist',{recursive:true});
await writeFile('dist/index.html',html.replace(/  <script type="module">[\s\S]*?<\/script>/,()=>'<script>'+js+'</script>'));
console.log('Built dist/index.html');
