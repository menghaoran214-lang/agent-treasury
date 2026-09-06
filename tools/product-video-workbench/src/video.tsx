import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';

const C={bg:'#070d13',panel:'#0e1822',line:'#25384a',gold:'#f5ba16',white:'#f5f7fa',muted:'#91a0b2',green:'#35d58a',red:'#ff5360'};
const fade=(f:number,a:number,b:number)=>interpolate(f,[a,a+12,b-12,b],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

const Logo=()=> <div style={{display:'flex',alignItems:'center',gap:16,fontWeight:800,fontSize:28,letterSpacing:2}}><div style={{color:C.gold,fontSize:38}}>M</div> AGENT TREASURY</div>;
const Tag=({children,color=C.gold}:{children:React.ReactNode;color?:string})=><span style={{border:`1px solid ${color}66`,background:`${color}18`,color,padding:'8px 14px',borderRadius:999,fontSize:18}}>{children}</span>;
const Card=({children,style={}}:{children:React.ReactNode;style?:React.CSSProperties})=><div style={{background:`linear-gradient(145deg,${C.panel},#09121a)`,border:`1px solid ${C.line}`,borderRadius:24,boxShadow:'0 26px 70px #0008',...style}}>{children}</div>;

const ChatScene=({approval=false,success=false,blocked=false}:{approval?:boolean;success?:boolean;blocked?:boolean})=>{
 const f=useCurrentFrame();
 return <AbsoluteFill style={{background:'radial-gradient(circle at 70% 15%,#14283c 0,#070d13 44%)',padding:70,color:C.white,fontFamily:'Arial, Microsoft YaHei'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><Logo/><Tag>运行在用户熟悉的 AI 对话中</Tag></div>
  <div style={{display:'grid',gridTemplateColumns:'390px 1fr',gap:34,marginTop:42,height:850}}>
   <Card style={{padding:30}}><div style={{fontSize:17,color:C.muted,marginBottom:28}}>今天</div>{['Robinhood 市场数据','研究资料采购','本月支出'].map((x,i)=><div key={x} style={{padding:'18px 20px',borderRadius:14,background:i===0?'#1b2936':'transparent',marginBottom:8,fontSize:20}}>{x}</div>)}</Card>
   <Card style={{padding:'38px 48px',position:'relative',overflow:'hidden'}}>
    <div style={{fontSize:22,color:C.muted,marginBottom:40}}>我的 AI 助手</div>
    <div style={{display:'flex',justifyContent:'flex-end'}}><div style={{background:'#243444',padding:'20px 26px',borderRadius:'22px 22px 4px 22px',fontSize:25,maxWidth:760}}>帮我买一份 Robinhood 最新市场数据。</div></div>
    <div style={{marginTop:34,display:'flex',gap:16}}><div style={{width:44,height:44,borderRadius:14,background:C.gold,color:'#111',display:'grid',placeItems:'center',fontWeight:900}}>M</div><div><div style={{fontSize:25,fontWeight:700}}>Agent Treasury 正在处理</div><div style={{display:'flex',gap:12,marginTop:18}}>{['发现供应商','比较报价','策略检查'].map((x,i)=><Tag key={x} color={f%90>i*22?C.green:C.muted}>{f%90>i*22?'✓ ':''}{x}</Tag>)}</div></div></div>
    {success&&<div style={{position:'absolute',right:28,bottom:28,width:470,opacity:interpolate(f,[8,22],[0,1]),transform:`translateY(${interpolate(f,[8,22],[30,0])}px)`}}><Card style={{padding:24,border:`1px solid ${C.green}`}}><div style={{fontSize:24,fontWeight:800,color:C.green}}>✓ 采购完成 · 0.30 USDT</div><div style={{marginTop:10,color:C.muted}}>数据已返回当前对话，账本已记录</div></Card></div>}
    {approval&&<AbsoluteFill style={{background:'#02070cbb',display:'grid',placeItems:'center'}}><Card style={{width:720,padding:38,border:`1px solid ${C.gold}`}}><div style={{fontSize:20,color:C.gold}}>需要你的批准</div><div style={{fontSize:46,fontWeight:900,margin:'12px 0'}}>2.60 USDT</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:20,color:C.muted}}><span>供应商：DataPro</span><span>网络：BSC</span><span>用途：Robinhood 数据</span><span>原因：超过自动支付上限</span></div><div style={{display:'flex',gap:16,marginTop:30}}><button style={{flex:1,padding:18,borderRadius:12,border:`1px solid ${C.line}`,background:'#13202c',color:C.white,fontSize:20}}>拒绝</button><button style={{flex:2,padding:18,borderRadius:12,border:0,background:C.gold,color:'#111',fontWeight:900,fontSize:20}}>批准支付 2.60 USDT</button></div></Card></AbsoluteFill>}
    {blocked&&<AbsoluteFill style={{background:'#02070cbb',display:'grid',placeItems:'center'}}><Card style={{width:720,padding:38,border:`1px solid ${C.red}`}}><div style={{fontSize:30,fontWeight:900,color:C.red}}>交易已被安全策略阻断</div><p style={{fontSize:21,color:C.muted,lineHeight:1.7}}>报价超过预算上限，钱包未被调用，资金没有移动。</p><div style={{padding:18,borderRadius:12,background:'#ff536014',color:C.red}}>建议：更换供应商或调整本次预算</div></Card></AbsoluteFill>}
   </Card>
  </div>
 </AbsoluteFill>
}

const PhoneScene=()=> <AbsoluteFill style={{background:'linear-gradient(125deg,#071019,#0d2030)',color:C.white,fontFamily:'Arial, Microsoft YaHei',display:'grid',gridTemplateColumns:'1fr 600px',padding:'70px 150px',alignItems:'center'}}><div><Logo/><div style={{fontSize:66,fontWeight:900,lineHeight:1.15,marginTop:70}}>一句话发起采购<br/><span style={{color:C.gold}}>结果回到原对话</span></div><p style={{fontSize:25,color:C.muted,lineHeight:1.7}}>手机、桌面或任何接入 Treasury Skill 的 AI，<br/>都使用同一套预算、审批与记账规则。</p></div><div style={{width:430,height:880,borderRadius:62,border:'10px solid #243241',background:'#071019',boxShadow:'0 40px 100px #000',padding:28,justifySelf:'center'}}><div style={{width:130,height:28,borderRadius:20,background:'#1c2935',margin:'0 auto 50px'}}/><div style={{color:C.muted,fontSize:17}}>AI 助手</div><div style={{marginTop:40,background:'#263747',padding:20,borderRadius:'22px 22px 4px 22px',fontSize:21}}>帮我买一份 Robinhood 最新市场数据。</div><div style={{marginTop:28,background:'#102219',border:`1px solid ${C.green}66`,padding:20,borderRadius:22,fontSize:19,lineHeight:1.6}}><b style={{color:C.green}}>✓ 已完成采购</b><br/>0.30 USDT · BSC<br/>数据与摘要已返回</div></div></AbsoluteFill>;

const ProofScene=()=> <AbsoluteFill style={{background:C.bg,padding:50,color:C.white,fontFamily:'Arial, Microsoft YaHei'}}><div style={{display:'flex',justifyContent:'space-between'}}><Logo/><Tag color={C.green}>后台自动完成 · 用户无需停留</Tag></div><Img src={staticFile('ledger.png')} style={{width:1500,margin:'48px auto 0',borderRadius:22,border:`1px solid ${C.line}`,boxShadow:'0 30px 90px #000'}}/></AbsoluteFill>;
const RealHostScene=()=> <AbsoluteFill style={{background:C.bg,padding:34,color:C.white,fontFamily:'Arial, Microsoft YaHei'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}><Logo/><Tag color={C.green}>真实本地交互录制 · Mock Payment</Tag></div><OffthreadVideo muted playbackRate={0.48} src={staticFile('host-ai-flow.webm')} style={{width:'100%',height:940,objectFit:'contain',borderRadius:18,border:`1px solid ${C.line}`,background:'#05090d'}}/></AbsoluteFill>;

const TitleScene=()=> <AbsoluteFill style={{background:'radial-gradient(circle at center,#15293a,#05090d 65%)',color:C.white,fontFamily:'Arial, Microsoft YaHei',display:'grid',placeItems:'center',textAlign:'center'}}><div><Logo/><div style={{fontSize:80,fontWeight:950,lineHeight:1.15,marginTop:70}}>钱包负责付款<br/><span style={{color:C.gold}}>它负责判断该不该付</span></div><div style={{fontSize:29,color:C.muted,marginTop:34}}>AI 的财务 · 采购 · 会计</div></div></AbsoluteFill>;

export const AgentTreasuryV2:React.FC=()=>{const f=useCurrentFrame(); const scenes=[
 {a:0,b:210,node:<TitleScene/>},{a:210,b:480,node:<PhoneScene/>},{a:480,b:1530,node:<RealHostScene/>},{a:1530,b:1860,node:<ProofScene/>},{a:1860,b:2100,node:<TitleScene/>}
]; return <AbsoluteFill style={{background:C.bg}}><Audio src={staticFile('narration.mp3')}/>{scenes.map((s,i)=><AbsoluteFill key={i} style={{opacity:fade(f,s.a,s.b)}}>{s.node}</AbsoluteFill>)}</AbsoluteFill>}
