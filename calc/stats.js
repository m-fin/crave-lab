// Own math engine: normal / t distributions and STAT TESTS. No TI code or ROM.
(function(root){
function lgamma(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5];let y=x,t=x+5.5;t-=(x+.5)*Math.log(t);let s=1.000000000190015;for(const k of c)s+=k/++y;return -t+Math.log(2.5066282746310005*s/x);}
function betacf(a,b,x){let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<1e-300)d=1e-300;d=1/d;let h=d;for(let m=1;m<=300;m++){let m2=2*m,aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<1e-300)d=1e-300;c=1+aa/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<1e-300)d=1e-300;c=1+aa/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<3e-16)break;}return h;}
function ibeta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b;}
function erfc(x){ // Numerical Recipes erfc, ~1.2e-7 rel; refine with continued fraction for tails
  const z=Math.abs(x),t=1/(1+.5*z);const r=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277)))))))));return x>=0?r:2-r;}
// high-precision normal upper tail (Cody-style via series / continued fraction)
function normSF(x){if(x<0)return 1-normSF(-x);if(x<3){let s=x,t=x;for(let n=1;n<200;n++){t*=x*x/(2*n+1);s+=t;if(t<1e-17*s)break;}return .5-s*Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);}let f=0;for(let k=200;k>0;k--)f=k/(x+f);return Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)/(x+f);}
function normcdf(lo,hi,mu=0,sd=1){return normSF((lo-mu)/sd)-normSF((hi-mu)/sd);}
function tSF(t,df){const x=df/(df+t*t),p=.5*ibeta(x,df/2,.5);return t>=0?p:1-p;}
function invNorm(p,mu=0,sd=1){let lo=-40,hi=40;for(let i=0;i<200;i++){const m=(lo+hi)/2;(1-normSF(m))<p?lo=m:hi=m;}return mu+sd*(lo+hi)/2;}
function invT(p,df){let lo=-1e4,hi=1e4;for(let i=0;i<300;i++){const m=(lo+hi)/2;(1-tSF(m,df))<p?lo=m:hi=m;}return (lo+hi)/2;}
function pv(stat,alt,sf){return alt==='<'?1-sf(stat):alt==='>'?sf(stat):2*sf(Math.abs(stat));}
const Z=s=>normSF(s);
const T={
 ZTest({mu0,sigma,xbar,n,alt='≠'}){const z=(xbar-mu0)/(sigma/Math.sqrt(n));return{z,p:pv(z,alt,Z),xbar,n};},
 TTest({mu0,xbar,sx,n,alt='≠'}){const df=n-1,t=(xbar-mu0)/(sx/Math.sqrt(n));return{t,p:pv(t,alt,s=>tSF(s,df)),df,xbar,sx,n};},
 '2-SampZTest'({s1,s2,x1,n1,x2,n2,alt='≠'}){const z=(x1-x2)/Math.sqrt(s1*s1/n1+s2*s2/n2);return{z,p:pv(z,alt,Z)};},
 '2-SampTTest'({x1,sx1,n1,x2,sx2,n2,alt='≠',pooled=false}){let df,se;if(pooled){df=n1+n2-2;const sp2=((n1-1)*sx1*sx1+(n2-1)*sx2*sx2)/df;se=Math.sqrt(sp2*(1/n1+1/n2));}else{const a=sx1*sx1/n1,b=sx2*sx2/n2;se=Math.sqrt(a+b);df=(a+b)**2/(a*a/(n1-1)+b*b/(n2-1));}const t=(x1-x2)/se;return{t,p:pv(t,alt,s=>tSF(s,df)),df};},
 '1-PropZTest'({p0,x,n,alt='≠'}){const ph=x/n,z=(ph-p0)/Math.sqrt(p0*(1-p0)/n);return{z,p:pv(z,alt,Z),'p̂':ph,n};},
 '2-PropZTest'({x1,n1,x2,n2,alt='≠'}){const p1=x1/n1,p2=x2/n2,pp=(x1+x2)/(n1+n2),z=(p1-p2)/Math.sqrt(pp*(1-pp)*(1/n1+1/n2));return{z,p:pv(z,alt,Z),'p̂1':p1,'p̂2':p2,'p̂':pp};},
 ZInterval({sigma,xbar,n,level=.95}){const m=invNorm(1-(1-level)/2)*sigma/Math.sqrt(n);return{lower:xbar-m,upper:xbar+m};},
 TInterval({xbar,sx,n,level=.95}){const m=invT(1-(1-level)/2,n-1)*sx/Math.sqrt(n);return{lower:xbar-m,upper:xbar+m,df:n-1};},
 '1-PropZInt'({x,n,level=.95}){const ph=x/n,m=invNorm(1-(1-level)/2)*Math.sqrt(ph*(1-ph)/n);return{lower:ph-m,upper:ph+m,'p̂':ph};}
};
const S={normSF,normcdf,tSF,invNorm,invT,tcdf:(lo,hi,df)=>tSF(lo,df)-tSF(hi,df),tests:T};
if(typeof module!=='undefined')module.exports=S;else root.STATS=S;
})(this);
