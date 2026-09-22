"use client"

import { onValue, ref } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

type Status = "taken" | "missed" | "pending"
type Dose = { medication: Medication; date: string; time: string; status: Status }

function Icon({ type, size = 27 }: { type: "home" | "calendar" | "history" | "profile" | "check" | "clock"; size?: number }) {
  const common = { width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const }
  if(type==="home") return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
  if(type==="calendar") return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
  if(type==="history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
  if(type==="check") return <svg {...common}><path d="m5 12 4 4 10-10"/></svg>
  if(type==="clock") return <svg {...common}><circle cx="12" cy="12" r="8.7"/><path d="M12 7v5l3 2"/></svg>
  return <svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

function keyFor(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
function daysBack(n: number) { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return d }
function timeMinutes(t: string) { const [h,m]=t.split(":").map(Number); return (h||0)*60+(m||0) }
function formatDate(key: string) { const d=new Date(`${key}T00:00:00`); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) }

export default function HistoryPage() {
  const router=useRouter()
  const [uid,setUid]=useState<string|null>(null)
  const [medications,setMedications]=useState<Medication[]>([])
  const [records,setRecords]=useState<Record<string,Record<string,Record<string,{status?:Status}>>>>({})
  const [filter,setFilter]=useState<"all"|"taken"|"missed"|"pending">("all")
  const [medFilter,setMedFilter]=useState("all")

  useEffect(()=>onAuthStateChanged(auth,user=>setUid(user?.uid??null)),[])
  useEffect(()=>{ if(!uid)return; return onValue(ref(realtimeDb,`medications/${uid}`),s=>{ const v=s.val() as Record<string,Medication>|null; setMedications(v?Object.entries(v).map(([id,m])=>({...m,id})):[]) }) },[uid])
  useEffect(()=>{
    if(!uid||!medications.length){setRecords({});return}
    const unsubs=medications.map(m=>onValue(ref(realtimeDb,`doseStatus/${uid}/${m.id}`),s=>setRecords(prev=>({...prev,[m.id]:(s.val() as Record<string,Record<string,{status?:Status}>>)||{}}))))
    return ()=>unsubs.forEach(u=>u())
  },[uid,medications])

  const todayKey=keyFor(new Date())
  const doses=useMemo(()=>{
    const out:Dose[]=[]
    for(let i=0;i<7;i++){
      const d=daysBack(i), date=keyFor(d), currentMinutes=new Date().getHours()*60+new Date().getMinutes()
      for(const med of medications.filter(m=>m.active!==false && (medFilter==="all"||m.id===medFilter))){
        if(med.createdAt && med.createdAt>d.getTime()+86399999) continue
        const stored=records[med.id]?.[date]?.[med.time]?.status
        let status:Status=stored||"pending"
        if(!stored && date!==todayKey) status="missed"
        if(!stored && date===todayKey && timeMinutes(med.time)<currentMinutes) status="missed"
        out.push({medication:med,date,time:med.time,status})
      }
    }
    return out.sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  },[medications,records,medFilter,todayKey])

  const taken=doses.filter(d=>d.status==="taken").length
  const missed=doses.filter(d=>d.status==="missed").length
  const completed=taken+missed
  const adherence=completed?Math.round(taken/completed*100):0
  const visible=doses.filter(d=>filter==="all"||d.status===filter)
  const week=doses.reduce<Record<string,{taken:number,total:number}>>((acc,d)=>{ if(!acc[d.date])acc[d.date]={taken:0,total:0}; if(d.status!=="pending")acc[d.date].total++; if(d.status==="taken")acc[d.date].taken++; return acc },{})

  if(!uid)return null
  return <main style={{minHeight:"100vh",background:"#edf5f2",color:"#142234",paddingBottom:88,fontFamily:"Arial,Helvetica,sans-serif"}}>
    <style>{`*{box-sizing:border-box}@media(max-width:600px){.hist-wrap{padding-left:16px!important;padding-right:16px!important}.hist-title{font-size:34px!important}.hist-stat{padding:17px 10px!important}.hist-value{font-size:32px!important}.hist-card{padding:20px 16px!important}}`}</style>
    <header style={{background:"white",borderBottom:"1px solid #dce8e4"}}><div className="hist-wrap" style={{maxWidth:760,margin:"0 auto",padding:"38px 22px 30px"}}><h1 className="hist-title" style={{margin:0,fontSize:40,lineHeight:1.05,letterSpacing:-1.1,fontWeight:800}}>Intake history</h1><p style={{margin:"9px 0 0",color:"#71808e",fontSize:18}}>Last 7 days of activity</p></div></header>
    <div className="hist-wrap" style={{maxWidth:760,margin:"0 auto",padding:"30px 22px"}}>
      <section style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>{[{v:`${adherence}%`,l:"Adherence"},{v:taken,l:"Doses taken"},{v:missed,l:"Missed"}].map(x=><div className="hist-stat" key={x.l} style={{background:"white",border:"1px solid #dce7e3",borderRadius:28,padding:"22px 14px",textAlign:"center"}}><div className="hist-value" style={{fontSize:37,fontWeight:800}}>{x.v}</div><div style={{color:"#71808e",fontSize:16,marginTop:5}}>{x.l}</div></div>)}</section>
      <section className="hist-card" style={{background:"white",border:"1px solid #dce7e3",borderRadius:28,padding:"26px 24px",marginTop:24}}><h2 style={{margin:0,fontSize:22}}>Weekly adherence</h2><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:13,alignItems:"end",height:180,marginTop:22}}>{Array.from({length:7},(_,i)=>{const d=daysBack(6-i),k=keyFor(d),x=week[k]||{taken:0,total:0},pct=x.total?Math.round(x.taken/x.total*100):0;return <div key={k} style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:9}}><div style={{height:145,width:"100%",maxWidth:44,borderRadius:25,background:"#e7f1ee",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:0,right:0,bottom:0,height:`${Math.max(pct,2)}%`,background:"#45ae80",borderRadius:25}}/></div><span style={{color:"#71808e",fontSize:14,fontWeight:700}}>{d.toLocaleDateString("en-US",{weekday:"narrow"})}</span></div>})}</div></section>
      <div style={{display:"flex",gap:9,marginTop:22,overflowX:"auto",paddingBottom:2}}>{(["all","taken","missed","pending"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} style={{border:0,borderRadius:24,padding:"11px 20px",background:filter===x?"#45ae80":"white",color:filter===x?"white":"#667784",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>
      <select value={medFilter} onChange={e=>setMedFilter(e.target.value)} style={{width:"100%",height:54,marginTop:18,border:"1px solid #dce7e3",borderRadius:27,padding:"0 18px",background:"white",fontSize:16,color:"#142234",outline:"none"}}><option value="all">All medicines</option>{medications.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <div style={{display:"grid",gap:12,marginTop:18}}>{visible.map(d=><article key={`${d.medication.id}-${d.date}-${d.time}`} style={{background:"white",border:"1px solid #dce7e3",borderRadius:25,padding:"17px 19px",display:"flex",alignItems:"center",gap:14}}><div style={{width:54,height:54,borderRadius:"50%",background:"#e3eef9",color:"#4d79a7",display:"grid",placeItems:"center",flexShrink:0}}><span style={{fontSize:25}}>▯</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:19,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.medication.name}</div><div style={{color:"#71808e",fontSize:15,marginTop:3}}>{formatDate(d.date)} · {d.time} · {d.medication.dosage} {d.medication.unit}</div></div><div style={{padding:"9px 15px",borderRadius:22,background:d.status==="taken"?"#def2e8":d.status==="missed"?"#fde7e7":"#eef1f2",color:d.status==="taken"?"#3c9c77":d.status==="missed"?"#ce555d":"#657786",fontWeight:800,fontSize:14}}>{d.status[0].toUpperCase()+d.status.slice(1)}</div></article>)}{visible.length===0&&<div style={{background:"white",borderRadius:24,padding:28,textAlign:"center",color:"#71808e"}}>No intake records for this filter.</div>}</div>
    </div>
    <BottomNav router={router}/>
  </main>
}

function BottomNav({router}:{router:ReturnType<typeof useRouter>}){const items=[{label:"Home",path:"/dashboard",icon:"home" as const},{label:"Schedule",path:"/schedule",icon:"calendar" as const},{label:"History",path:"/history",icon:"history" as const},{label:"Profile",path:"/profile",icon:"profile" as const}];return <nav style={{position:"fixed",left:0,right:0,bottom:0,height:76,background:"rgba(255,255,255,.98)",borderTop:"1px solid #dce7e3",display:"flex",justifyContent:"center",zIndex:20}}><div style={{width:"100%",maxWidth:760,display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>{items.map(x=><button key={x.label} onClick={()=>router.push(x.path)} style={{border:0,background:"transparent",color:x.label==="History"?"#3eaa7d":"#657786",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontWeight:x.label==="History"?800:500,cursor:"pointer"}}><Icon type={x.icon} size={27}/><span style={{fontSize:13}}>{x.label}</span></button>)}</div></nav>}
