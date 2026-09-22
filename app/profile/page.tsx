"use client"

import { onAuthStateChanged, signOut } from "firebase/auth"
import { onValue, ref } from "firebase/database"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, realtimeDb } from "../../lib/firebase"
import type { Medication } from "../../lib/medications"

function Icon({type,size=27}:{type:"home"|"calendar"|"history"|"profile"|"logout";size?:number}){
 const c={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const}
 if(type==="home")return <svg {...c}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>
 if(type==="calendar")return <svg {...c}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/></svg>
 if(type==="history")return <svg {...c}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 5v5h5"/><path d="M12 7v5l3 2"/></svg>
 if(type==="logout")return <svg {...c}><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 4h6v16h-6"/></svg>
 return <svg {...c}><circle cx="12" cy="8" r="3.2"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
}

export default function ProfilePage(){
 const router=useRouter()
 const [user,setUser]=useState<{name:string;email:string}|null>(null)
 const [count,setCount]=useState(0)
 const [condition,setCondition]=useState("")
 const [name,setName]=useState("")
 const [reminders,setReminders]=useState(true)
 const [sound,setSound]=useState(true)
 const [vibration,setVibration]=useState(true)
 const [missed,setMissed]=useState(true)

 useEffect(()=>onAuthStateChanged(auth,u=>{
   if(!u){setUser(null);router.replace("/login");return}
   const n=u.displayName||u.email?.split("@")[0]||"there"
   setUser({name:n,email:u.email||""})
   setName(n)
 }),[router])

 useEffect(()=>{
   if(!user)return
   const uid=auth.currentUser?.uid
   if(!uid)return
   return onValue(ref(realtimeDb,`medications/${uid}`),s=>{
     const v=s.val() as Record<string,Medication>|null
     setCount(v?Object.values(v).filter(m=>m.active!==false).length:0)
   })
 },[user])

 useEffect(()=>{
   try{
     setCondition(localStorage.getItem("meditrack.condition")||"")
     setName(localStorage.getItem("meditrack.name")||user?.name||"")
     setReminders(localStorage.getItem("meditrack.reminders")!=="false")
     setSound(localStorage.getItem("meditrack.sound")!=="false")
     setVibration(localStorage.getItem("meditrack.vibration")!=="false")
     setMissed(localStorage.getItem("meditrack.missed")!=="false")
   }catch{}
 },[user])

 function save(key:string,value:boolean|string){try{localStorage.setItem(key,String(value))}catch{}}
 async function handleSignOut(){try{await signOut(auth);router.replace("/login")}catch{}}

 if(!user)return null
 const initial=(user.name||"G").trim().charAt(0).toUpperCase()

 return <main style={{minHeight:"100vh",background:"#edf5f2",color:"#142234",paddingBottom:92,fontFamily:"Arial,Helvetica,sans-serif"}}>
  <style>{`*{box-sizing:border-box}@media(max-width:600px){.profile-wrap{padding-left:16px!important;padding-right:16px!important}.profile-title{font-size:32px!important}.profile-card{padding:24px!important;border-radius:30px!important}.account-card{padding:24px!important}.account-avatar{width:76px!important;height:76px!important;font-size:38px!important}.account-name{font-size:23px!important}.account-email{font-size:16px!important}.section-title{font-size:23px!important}.field{height:56px!important}.setting-title{font-size:18px!important}.setting-subtitle{font-size:15px!important}}`}</style>

  <header style={{background:"#fff",borderBottom:"1px solid #dce8e4"}}>
   <div className="profile-wrap" style={{maxWidth:760,margin:"0 auto",padding:"38px 22px 30px"}}>
    <h1 className="profile-title" style={{margin:0,fontSize:38,lineHeight:1.05,letterSpacing:-1.1,fontWeight:800}}>Profile</h1>
    <p style={{margin:"9px 0 0",color:"#71808e",fontSize:18}}>Account and notifications</p>
   </div>
  </header>

  <div className="profile-wrap" style={{maxWidth:760,margin:"0 auto",padding:"30px 22px"}}>
   <section className="profile-card account-card" style={{background:"white",border:"1px solid #dce7e3",borderRadius:30,padding:28,display:"flex",alignItems:"center",gap:20}}>
    <div className="account-avatar" style={{width:86,height:86,borderRadius:"50%",background:"#f07808",color:"white",display:"grid",placeItems:"center",fontSize:43,fontWeight:500,flexShrink:0}}>{initial}</div>
    <div style={{minWidth:0}}>
     <div className="account-name" style={{fontSize:25,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
     <div className="account-email" style={{fontSize:17,color:"#71808e",marginTop:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
     <div style={{fontSize:17,color:"#45ae80",marginTop:8}}><strong>{count} active medicines</strong></div>
    </div>
   </section>

   <section className="profile-card" style={{background:"white",border:"1px solid #dce7e3",borderRadius:30,padding:28,marginTop:22}}>
    <h2 className="section-title" style={{margin:0,fontSize:24,fontWeight:800}}>Health details</h2>
    <label style={{display:"block",marginTop:26,color:"#587087",fontSize:17}}>Conditions
     <input className="field" value={condition} onChange={e=>{setCondition(e.target.value);save("meditrack.condition",e.target.value)}} placeholder="e.g. Hypertension" style={{display:"block",width:"100%",height:58,marginTop:10,border:"1px solid #d6e1de",borderRadius:29,padding:"0 20px",fontSize:17,color:"#142234",background:"#edf5f2",outline:"none"}}/>
    </label>
    <label style={{display:"block",marginTop:22,color:"#587087",fontSize:17}}>Full name
     <input className="field" value={name} onChange={e=>{setName(e.target.value);save("meditrack.name",e.target.value)}} style={{display:"block",width:"100%",height:58,marginTop:10,border:"1px solid #d6e1de",borderRadius:29,padding:"0 20px",fontSize:17,color:"#142234",background:"#edf5f2",outline:"none"}}/>
    </label>
   </section>

   <section className="profile-card" style={{background:"white",border:"1px solid #dce7e3",borderRadius:30,padding:28,marginTop:22}}>
    <h2 className="section-title" style={{margin:0,fontSize:24,fontWeight:800}}>Notification settings</h2>
    <Toggle title="Dose reminders" subtitle="Push alert at each scheduled time" value={reminders} setValue={v=>{setReminders(v);save("meditrack.reminders",v)}}/>
    <Toggle title="Reminder sound" subtitle="Play a chime with each alert" value={sound} setValue={v=>{setSound(v);save("meditrack.sound",v)}}/>
    <Toggle title="Vibration" subtitle="Vibrate when a reminder fires" value={vibration} setValue={v=>{setVibration(v);save("meditrack.vibration",v)}}/>
    <Toggle title="Missed dose alerts" subtitle="Follow up if a dose is missed" value={missed} setValue={v=>{setMissed(v);save("meditrack.missed",v)}}/>
   </section>

   <button onClick={handleSignOut} style={{width:"100%",height:58,marginTop:24,border:"1px solid #dce7e3",borderRadius:30;background:"white",color:"#ef3f3f",fontSize:17,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
    <Icon type="logout" size={20}/> Sign out
   </button>
  </div>
  <BottomNav router={router}/>
 </main>
}

function Toggle({title,subtitle,value,setValue}:{title:string;subtitle:string;value:boolean;setValue:(v:boolean)=>void}){
 return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:18,padding:"20px 0",borderTop:"1px solid #e5ece9",marginTop:17}}>
  <div style={{minWidth:0}}><div className="setting-title" style={{fontSize:19,fontWeight:800}}>{title}</div><div className="setting-subtitle" style={{fontSize:15,color:"#71808e",marginTop:5}}>{subtitle}</div></div>
  <button onClick={()=>setValue(!value)} aria-label={title} style={{width:59,height:34,border:0,borderRadius:20,background:value?"#45ae80":"#d5dfdc",padding:3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:value?"flex-end":"flex-start",flexShrink:0}}><span style={{width:28,height:28,borderRadius:"50%",background:"white",display:"block",boxShadow:"0 1px 3px rgba(0,0,0,.12)"}}/></button>
 </div>
}

function BottomNav({router}:{router:ReturnType<typeof useRouter>}){
 const items=[{label:"Home",path:"/dashboard",icon:"home" as const},{label:"Schedule",path:"/schedule",icon:"calendar" as const},{label:"History",path:"/history",icon:"history" as const},{label:"Profile",path:"/profile",icon:"profile" as const}]
 return <nav style={{position:"fixed",left:0,right:0,bottom:0,height:76,background:"rgba(255,255,255,.98)",borderTop:"1px solid #dce7e3",display:"flex",justifyContent:"center",zIndex:20}}><div style={{width:"100%",maxWidth:760,display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>{items.map(x=><button key={x.label} onClick={()=>router.push(x.path)} style={{border:0,background:"transparent",color:x.label==="Profile"?"#3eaa7d":"#657786",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontWeight:x.label==="Profile"?800:500,cursor:"pointer"}}><Icon type={x.icon} size={27}/><span style={{fontSize:13}}>{x.label}</span></button>)}</div></nav>
}