// Retrograph graphing math: window, zoom, pixel mapping, sampling, trace. No DOM.
(function(root){
const TRACE_STEPS=94; // pixel columns between Xmin and Xmax for TRACE/ZDecimal (dx=0.1 in ZDecimal)
const ZSTANDARD={Xmin:-10,Xmax:10,Xscl:1,Ymin:-10,Ymax:10,Yscl:1};
const ZDECIMAL={Xmin:-4.7,Xmax:4.7,Xscl:1,Ymin:-3.1,Ymax:3.1,Yscl:1};
const r=v=>+v.toPrecision(12);
function valid(w){return['Xmin','Xmax','Xscl','Ymin','Ymax','Yscl'].every(k=>isFinite(w[k]))&&w.Xmin<w.Xmax&&w.Ymin<w.Ymax&&w.Xscl>=0&&w.Yscl>=0}
// factor>1 zooms in, <1 zooms out, about center (cx,cy)
function zoom(w,f,cx,cy){cx=cx??(w.Xmin+w.Xmax)/2;cy=cy??(w.Ymin+w.Ymax)/2;const hx=(w.Xmax-w.Xmin)/2/f,hy=(w.Ymax-w.Ymin)/2/f;
 return Object.assign({},w,{Xmin:r(cx-hx),Xmax:r(cx+hx),Ymin:r(cy-hy),Ymax:r(cy+hy)})}
const toPx=(w,W,H,x,y)=>[(x-w.Xmin)/(w.Xmax-w.Xmin)*(W-1),(w.Ymax-y)/(w.Ymax-w.Ymin)*(H-1)];
const toXY=(w,W,H,px,py)=>[w.Xmin+px/(W-1)*(w.Xmax-w.Xmin),w.Ymax-py/(H-1)*(w.Ymax-w.Ymin)];
// One sample per pixel column; returns array of segments of [px,py]; breaks on NaN or big jumps (asymptotes)
function sample(f,w,W,H){const segs=[];let cur=[],prev=null;for(let i=0;i<W;i++){const x=w.Xmin+i/(W-1)*(w.Xmax-w.Xmin),y=f(x);
 if(!isFinite(y)){if(cur.length)segs.push(cur);cur=[];prev=null;continue}const py=toPx(w,W,H,x,y)[1];
 if(cur.length&&(Math.abs(py-prev)>H*2||(prev<0&&py>H-1)||(prev>H-1&&py<0))){segs.push(cur);cur=[]}prev=py;cur.push([i,Math.max(-H,Math.min(2*H,py))])}
 if(cur.length)segs.push(cur);return segs}
const traceX=(w,i)=>r(w.Xmin+i*(w.Xmax-w.Xmin)/TRACE_STEPS);
const ticks=(min,max,scl)=>{if(!scl||(max-min)/scl>200)return[];const a=[];for(let v=Math.ceil(min/scl)*scl;v<=max+1e-12;v+=scl)a.push(r(v));return a};
const G={TRACE_STEPS,ZSTANDARD,ZDECIMAL,valid,zoom,toPx,toXY,sample,traceX,ticks};
if(typeof module!=='undefined')module.exports=G;else root.GRAPH=G;
})(this);
