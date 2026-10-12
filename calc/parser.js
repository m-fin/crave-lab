// Retrograph's own expression parser (no eval). Shared by the app and tests.
// env: {vars, ans, deg, store(name,v)}
(function(root){
const ST=()=>typeof STATS!=='undefined'?STATS:require('./stats.js');
function tok(s){const t=[];let i=0;while(i<s.length){const c=s[i];if(/\s/.test(c)){i++;continue}
 const m=s.slice(i).match(/^(\d*\.\d+|\d+\.?)(ᴇ-?\d+)?/);if(m&&/[\d.]/.test(c)){t.push({n:parseFloat(m[0].replace('ᴇ','e'))});i+=m[0].length;continue}
 const w=s.slice(i).match(/^(sin⁻¹|cos⁻¹|tan⁻¹|sin|cos|tan|log|ln|√|abs|Ans|normalcdf|invNorm|tcdf|[A-Z]|π|e)/);if(w){t.push({w:w[0]});i+=w[0].length;continue}
 t.push({o:c});i++;}return t;}
function parse(s,env){env=env||{};const vars=env.vars||{},deg=!!env.deg,ans=env.ans||0;
 const t=typeof s==='string'?tok(s):s;let p=0;const pk=()=>t[p],nx=()=>t[p++];
 const F={sin:x=>Math.sin(deg?x*Math.PI/180:x),cos:x=>Math.cos(deg?x*Math.PI/180:x),tan:x=>Math.tan(deg?x*Math.PI/180:x),'sin⁻¹':x=>Math.asin(x)*(deg?180/Math.PI:1),'cos⁻¹':x=>Math.acos(x)*(deg?180/Math.PI:1),'tan⁻¹':x=>Math.atan(x)*(deg?180/Math.PI:1),log:Math.log10,ln:Math.log,'√':Math.sqrt,abs:Math.abs};
 const MF={normalcdf:a=>ST().normcdf(a[0],a[1],a[2]??0,a[3]??1),invNorm:a=>ST().invNorm(a[0],a[1]??0,a[2]??1),tcdf:a=>ST().tcdf(a[0],a[1],a[2])};
 function args(){const a=[expr()];while(pk()&&pk().o===','){nx();a.push(expr())}if(pk()&&pk().o===')')nx();return a}
 function prim(){const k=nx();if(!k)throw'SYNTAX';if(k.n!==undefined)return k.n;if(k.o==='('){const v=expr();if(pk()&&pk().o===')')nx();return v}
  if(k.o==='⁻'||k.o==='−')return -pow();
  if(k.w){if(F[k.w]){if(pk()&&pk().o==='(')nx();const v=expr();if(pk()&&pk().o===')')nx();return F[k.w](v)}
   if(MF[k.w]){if(pk()&&pk().o==='(')nx();return MF[k.w](args())}
   if(k.w==='π')return Math.PI;if(k.w==='e')return Math.E;if(k.w==='Ans')return ans;return vars[k.w]||0}
  throw'SYNTAX'}
 function post(){let v=prim();while(pk()&&(pk().o==='²'||pk().o==='!')){const o=nx().o;if(o==='²')v=v*v;else{let f=1;for(let i=2;i<=v;i++)f*=i;v=f}}return v}
 function pow(){const b=post();if(pk()&&pk().o==='^'){nx();return Math.pow(b,unary())}return b}
 function unary(){if(pk()&&(pk().o==='⁻'||pk().o==='−')){nx();return -unary()}return pow()}
 function term(){let v=unary();for(;;){const k=pk();if(!k)break;if(k.o==='×'||k.o==='*'){nx();v*=unary()}else if(k.o==='÷'||k.o==='/'){nx();const d=unary();if(d===0){if(env.graph)return NaN;throw'DIVIDE BY 0'}v/=d}else if(k.n!==undefined||k.w||k.o==='('){v*=unary()}else break}return v}
 function expr(){let v=term();while(pk()&&(pk().o==='+'||pk().o==='-')){const o=nx().o;v=o==='+'?v+term():v-term()}return v}
 const v=expr();if(p<t.length){if(t[p].o==='→'&&t[p+1]&&/^[A-Z]$/.test(t[p+1].w)&&env.store){env.store(t[p+1].w,v);return v}throw'SYNTAX'}return v}
// Compile once (tokenize once) for fast plotting: returns x=>y (NaN on error)
function compile(s,env){const t=tok(s);parse(t,Object.assign({},env,{vars:Object.assign({},env&&env.vars,{X:1}),graph:true}));
 return x=>{try{return parse(t,Object.assign({},env,{vars:Object.assign({},env&&env.vars,{X:x}),graph:true}))}catch(e){return NaN}}}
const P={tok,parse,compile};if(typeof module!=='undefined')module.exports=P;else root.CALCP=P;
})(this);
