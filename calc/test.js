// Textbook-style examples; expected values computed independently with SciPy 1.x.
const S=require('./stats.js'),T=S.tests;let fail=0;
function eq(name,got,exp,tol=1e-4){const ok=Math.abs(got-exp)<=tol*Math.max(1,Math.abs(exp));if(!ok)fail++;console.log((ok?'PASS ':'FAIL ')+name,got,'expected',exp);}
let r=T['1-PropZTest']({p0:.5,x:520,n:1000});eq('1-PropZTest z',r.z,1.264911064);eq('1-PropZTest p',r.p,.2059032107);
r=T.ZTest({mu0:100,sigma:15,xbar:105,n:36});eq('ZTest z',r.z,2);eq('ZTest p',r.p,.0455002639);
r=T.TTest({mu0:5,xbar:5.4,sx:1.2,n:16});eq('TTest t',r.t,1.333333333);eq('TTest p',r.p,.2023185835);
r=T['2-SampZTest']({s1:8,s2:10,x1:75,n1:40,x2:72,n2:50});eq('2-SampZTest z',r.z,1.58113883);eq('2-SampZTest p',r.p,.113846298);
r=T['2-SampTTest']({x1:75,sx1:8,n1:40,x2:72,sx2:10,n2:50});eq('2-SampTTest t',r.t,1.58113883);eq('2-SampTTest df',r.df,87.99943150);eq('2-SampTTest p',r.p,.1174340825);
r=T['2-SampTTest']({x1:75,sx1:8,n1:40,x2:72,sx2:10,n2:50,pooled:true});eq('2-SampTTest pooled t',r.t,1.542616182);eq('2-SampTTest pooled p',r.p,.1265124789);
r=T['2-PropZTest']({x1:45,n1:100,x2:30,n2:100});eq('2-PropZTest z',r.z,2.19089023);eq('2-PropZTest p',r.p,.0284597369);
r=T.ZInterval({sigma:15,xbar:105,n:36});eq('ZInterval lo',r.lower,100.1000900);eq('ZInterval hi',r.upper,109.8999100);
r=T.TInterval({xbar:5.4,sx:1.2,n:16});eq('TInterval lo',r.lower,4.760565136);eq('TInterval hi',r.upper,6.039434864);
eq('normalcdf(-1,1)',S.normcdf(-1,1),.6826894921);eq('invNorm(.975)',S.invNorm(.975),1.959963985);
r=T.ZTest({mu0:100,sigma:15,xbar:105,n:36,alt:'>'});eq('ZTest one-sided p',r.p,.0227501319);
// ---- parser + graphing tests ----
const P=require('./parser.js'),G=require('./graph.js');
function ok(name,c){if(!c)fail++;console.log((c?'PASS ':'FAIL ')+name)}
eq('parse 2+3×4',P.parse('2+3×4'),14);eq('parse 2^3^2 right-assoc',P.parse('2^3^2'),512);eq('parse ⁻3²',P.parse('⁻3²'),-9);
eq('parse implicit 2π',P.parse('2π'),2*Math.PI);eq('parse sin(π/2)',P.parse('sin(π/2)'),1);eq('parse deg sin(30)',P.parse('sin(30)',{deg:true}),.5);
let f=P.compile('X^2/4');eq('Y=X^2/4 at 3',f(3),2.25);eq('Y=X^2/4 at -2',f(-2),1);
f=P.compile('sin(X)');eq('Y=sin(X) at π/6',f(Math.PI/6),.5);f=P.compile('2X+1');eq('Y=2X+1 at 5 (implicit ×)',f(5),11);
f=P.compile('1/X');ok('1/X at 0 is NaN, not a throw',Number.isNaN(f(0)));f=P.compile('√(X)');ok('√(X) at -1 is NaN',Number.isNaN(f(-1)));
let thr=false;try{P.compile('3+*')}catch(e){thr=true}ok('bad Y= expression throws SYNTAX at compile',thr);
const Z=G.ZSTANDARD;ok('ZStandard window',Z.Xmin===-10&&Z.Xmax===10&&Z.Ymin===-10&&Z.Ymax===10&&Z.Xscl===1);
eq('ZDecimal trace step = 0.1',G.traceX(G.ZDECIMAL,1)-G.ZDECIMAL.Xmin,.1);eq('ZDecimal trace center X=0',G.traceX(G.ZDECIMAL,47),0,1e-9);
let w=G.zoom(Z,4);ok('ZoomIn x4 -> ±2.5',w.Xmin===-2.5&&w.Xmax===2.5&&w.Ymin===-2.5);w=G.zoom(Z,1/4);ok('ZoomOut x4 -> ±40',w.Xmin===-40&&w.Ymax===40);
w=G.zoom(Z,4,2,3);ok('ZoomIn about (2,3)',w.Xmin===-.5&&w.Xmax===4.5&&w.Ymin===.5&&w.Ymax===5.5);
ok('valid rejects Xmin>=Xmax',!G.valid({...Z,Xmin:5,Xmax:5}));ok('valid accepts ZStandard',G.valid(Z));
let p=G.toPx(Z,201,201,0,0);ok('origin maps to canvas center',p[0]===100&&p[1]===100);p=G.toXY(Z,201,201,0,0);ok('top-left pixel = (Xmin,Ymax)',p[0]===-10&&p[1]===10);
let segs=G.sample(P.compile('X^2/4'),Z,201,201);ok('parabola: one segment, one sample per column',segs.length===1&&segs[0].length===201);
eq('parabola vertex pixel row',segs[0][100][1],100);
segs=G.sample(P.compile('1/X'),Z,200,201);ok('1/X breaks at the asymptote',segs.length===2);
segs=G.sample(P.compile('√(X)'),Z,201,201);ok('√X only plots X>=0',segs.length===1&&segs[0][0][0]===100);
ok('ticks Xscl=1 on ±10 -> 21',G.ticks(-10,10,1).length===21);ok('ticks Xscl=0 -> none',G.ticks(-10,10,0).length===0);
console.log(fail?fail+' FAILED':'ALL PASS');process.exit(fail?1:0);
