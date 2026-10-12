const APP=require('./config.js');const fs=require('fs');
fs.writeFileSync(__dirname+'/manifest.webmanifest',JSON.stringify({name:APP.NAME,short_name:APP.NAME,start_url:'./',scope:'./',display:'standalone',background_color:'#1b1d22',theme_color:'#1b1d22',icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]})+'\n');
console.log('manifest name =',APP.NAME);
