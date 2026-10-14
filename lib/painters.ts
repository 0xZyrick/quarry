// Procedural "live workspace" painters. Each one draws a looping scene of a craft on a small canvas: no images, no assets.
// They are pure functions of time, so the clock can call them at any rate. Swap a tile to a real <video> or LiveKit track later.
export type PainterId="code"|"cad"|"paint"|"wire"|"ui";
export type Painter=(g:CanvasRenderingContext2D,w:number,h:number,t:number,seed:number,c:string)=>void;
const BG="#0D0E11",TAU=Math.PI*2;
const hash=(a:number,b=0,c=0)=>{let h=Math.imul(a+1,374761393)^Math.imul(b+7,668265263)^Math.imul(c+13,2246822519);
  h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const sm=(x:number)=>x*x*(3-2*x);

// A code editor scrolling upward: token blocks in syntax colours, a gutter, and a typing cursor.
const code:Painter=(g,w,h,t0,s,c)=>{
  const t=t0+hash(s,1)*50,lh=Math.max(6,h/24),off=t*lh*1.7,top=Math.floor(off/lh),fr=off%lh,pal=[c,"#8892a6","#00A3FF","#e8eaf0","#FF6B00"];
  g.fillStyle=BG;g.fillRect(0,0,w,h);
  for(let i=-1;i<h/lh+1;i++){const n=top+i,y=i*lh-fr;
    g.fillStyle="#242936";g.fillRect(lh*.6,y+lh*.25,lh*1.2,lh*.4); // gutter
    if(hash(s,n,1)<.14)continue;
    let x=lh*3+Math.floor(hash(s,n,2)*4)*lh*1.4;const k=2+Math.floor(hash(s,n,3)*5);
    for(let j=0;j<k;j++){const tw=lh*(1+hash(s,n,10+j)*5);g.fillStyle=pal[Math.floor(hash(s,n,20+j)*pal.length)];
      g.globalAlpha=.55+hash(s,n,30+j)*.4;g.fillRect(x,y+lh*.2,tw,lh*.5);x+=tw+lh*.7;if(x>w)break}}
  g.globalAlpha=1;
  const cy=h*.72,cx=lh*3+((t*lh*3)%(w*.5)); // cursor on the line being typed
  g.fillStyle=c;g.fillRect(cx,cy,lh*.5,lh*.9*(Math.sin(t*8)>0?1:.2));
  const v=g.createLinearGradient(0,0,0,h);v.addColorStop(0,"rgba(13,14,17,.85)");v.addColorStop(.25,"transparent");
  v.addColorStop(.8,"transparent");v.addColorStop(1,"rgba(13,14,17,.85)");g.fillStyle=v;g.fillRect(0,0,w,h)};

// A floor plan drawn wall by wall by a moving crosshair, with dimension ticks, then it fades and starts over.
const CYC=16;
const cad:Painter=(g,w,h,t0,s,c)=>{
  g.fillStyle=BG;g.fillRect(0,0,w,h);
  const st=Math.max(8,h/12);g.strokeStyle="rgba(0,163,255,.1)";g.lineWidth=1;g.beginPath();
  for(let x=0;x<w;x+=st){g.moveTo(x,0);g.lineTo(x,h)}for(let y=0;y<h;y+=st){g.moveTo(0,y);g.lineTo(w,y)}g.stroke();
  const segs:number[][]=[],R=3+Math.floor(hash(s,5)*2);
  for(let r=0;r<R;r++){const rw=w*(.25+hash(s,r,1)*.3),rh=h*(.2+hash(s,r,2)*.25),x=w*.08+hash(s,r,3)*(w*.84-rw),y=h*.08+hash(s,r,4)*(h*.84-rh);
    segs.push([x,y,x+rw,y],[x+rw,y,x+rw,y+rh],[x+rw,y+rh,x,y+rh],[x,y+rh,x,y])}
  const T=(t0+hash(s,2)*CYC)%CYC/CYC,prog=Math.min(1,T*1.25),fade=T>.9?1-(T-.9)/.1:1,drawn=prog*segs.length;
  g.globalAlpha=fade;g.strokeStyle=c;g.lineWidth=Math.max(1.2,h/110);g.lineCap="round";
  let tipX=0,tipY=0;
  segs.forEach((q,i)=>{if(i>drawn)return;const f=Math.min(1,drawn-i),x=q[0]+(q[2]-q[0])*f,y=q[1]+(q[3]-q[1])*f;
    g.beginPath();g.moveTo(q[0],q[1]);g.lineTo(x,y);g.stroke();tipX=x;tipY=y;
    if(f>=1){g.save();g.strokeStyle="#8892a6";g.lineWidth=1;const mx=(q[0]+q[2])/2,my=(q[1]+q[3])/2;
      g.beginPath();g.moveTo(mx-3,my-3);g.lineTo(mx+3,my+3);g.stroke();g.restore()}});
  if(prog<1){g.strokeStyle="#fff";g.lineWidth=1;const L=st*.7;g.beginPath();g.moveTo(tipX-L,tipY);g.lineTo(tipX+L,tipY);g.moveTo(tipX,tipY-L);g.lineTo(tipX,tipY+L);g.stroke()}
  g.globalAlpha=1};

// Acrylic paint: colour blobs drift and blend additively while a brush glaze sweeps across.
const paint:Painter=(g,w,h,t0,s,c)=>{
  const t=t0+hash(s,3)*60,m=Math.min(w,h);
  g.globalCompositeOperation="source-over";g.fillStyle="#0b0c10";g.fillRect(0,0,w,h);
  g.globalCompositeOperation="lighter";
  for(let i=0;i<6;i++){const ph=hash(s,i,1)*TAU,sp=.18+hash(s,i,2)*.25,x=w*(.5+.4*Math.sin(t*sp+ph)),y=h*(.5+.4*Math.cos(t*sp*.8+ph*1.7)),r=m*(.38+.16*Math.sin(t*.4+ph));
    const hue=(hash(s,i,3)*360+t*5)%360,gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,`hsla(${hue},85%,55%,.55)`);gr.addColorStop(1,`hsla(${hue},85%,55%,0)`);g.fillStyle=gr;g.fillRect(0,0,w,h)}
  g.globalCompositeOperation="source-over";
  const sx=((t*.12)%1.6-.3)*w;g.save();g.translate(sx,0);g.rotate(-.35);g.fillStyle="rgba(255,255,255,.05)";g.fillRect(0,-h,m*.12,h*3);
  g.fillStyle=c;g.globalAlpha=.25;g.fillRect(m*.12,-h,2,h*3);g.restore();g.globalAlpha=1};

// A wireframe solid (cube around an octahedron) turning in perspective, with motion trails.
const CUBE=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  CE=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],
  OCT=[[0,-1.25,0],[0,1.25,0],[-1.25,0,0],[1.25,0,0],[0,0,-1.25],[0,0,1.25]],
  OE=[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];
const wire:Painter=(g,w,h,t0,s,c)=>{
  const t=t0*.7+hash(s,4)*20;g.fillStyle="rgba(13,14,17,.32)";g.fillRect(0,0,w,h);
  const sc=Math.min(w,h)*.19,a=t,b=t*.63+hash(s,6)*3,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
  const P=(v:number[])=>{const x=v[0]*ca-v[2]*sa,z0=v[0]*sa+v[2]*ca,y=v[1]*cb-z0*sb,z=v[1]*sb+z0*cb,k=sc*3.6/(3.6+z);return[w/2+x*k,h/2+y*k]};
  g.lineWidth=Math.max(1,h/150);g.lineJoin="round";
  g.strokeStyle=c;g.beginPath();const pc=CUBE.map(P);for(const e of CE){g.moveTo(pc[e[0]][0],pc[e[0]][1]);g.lineTo(pc[e[1]][0],pc[e[1]][1])}g.stroke();
  g.strokeStyle="#00A3FF";g.beginPath();const po=OCT.map(P);for(const e of OE){g.moveTo(po[e[0]][0],po[e[0]][1]);g.lineTo(po[e[1]][0],po[e[1]][1])}g.stroke();
  g.fillStyle="#fff";for(const p of pc)g.fillRect(p[0]-1.5,p[1]-1.5,3,3)};

// Interface blocks sliding between two layouts, with a cursor riding the first card.
const ui:Painter=(g,w,h,t0,s,c)=>{
  const t=t0+hash(s,7)*30,k=sm(.5+.5*Math.sin(t*.7)),N=6;
  g.fillStyle=BG;g.fillRect(0,0,w,h);let cx=0,cy=0;
  for(let i=0;i<N;i++){const L=(a:number)=>hash(s,i,a),
      x=w*(.06+(L(1)+(L(11)-L(1))*k)*.5),y=h*(.06+(L(2)+(L(12)-L(2))*k)*.6),cw=w*(.22+(L(3)+(L(13)-L(3))*k)*.3),ch=h*(.12+(L(4)+(L(14)-L(4))*k)*.22),r=Math.min(cw,ch)*.18;
    g.beginPath();g.roundRect(x,y,cw,ch,r);
    if(i===0){g.fillStyle=c;g.globalAlpha=.9;g.fill();cx=x+cw*.8;cy=y+ch*.7}
    else{g.fillStyle="rgba(22,25,32,.9)";g.fill();g.globalAlpha=.55;g.strokeStyle=i%2?"#00A3FF":"#8892a6";g.lineWidth=1;g.stroke()}
    g.globalAlpha=1}
  g.fillStyle="#fff";g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+9,cy+4);g.lineTo(cx+4,cy+9);g.closePath();g.fill()};

export const painters:Record<PainterId,Painter>={code,cad,paint,wire,ui};
