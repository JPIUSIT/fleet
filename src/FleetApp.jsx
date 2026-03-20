import { useState, useEffect, useRef, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { BACKEND_URL, loginRequest } from "./authConfig";

const COLORS = {
  primary: "#2a7d6f", primaryLight: "#e8f5f2", primaryDark: "#1d5c52",
  accent: "#4db6a4", warning: "#f59e0b", danger: "#ef4444",
  success: "#10b981", bg: "#f4f7f6", card: "#ffffff",
  text: "#1a2e2b", textMuted: "#6b7f7c",
};
const CAR_COLORS = ["#2a7d6f","#4a90d9","#9b59b6","#e67e22","#e74c3c","#1abc9c","#3498db","#f39c12"];
const emptyNewCar = { model:"", plate:"", status:"active", insurance:"", bollo:"", revision:"", km:0, color:CAR_COLORS[0], maintenance:{ oil:{date:"",km:null}, tires:{date:"",km:null}, service:{date:"",km:null}, notes:"" }};
const HOUR_HEIGHT = 60; // px per ora nelle viste settimana/giorno
const START_HOUR = 7;
const HOURS = Array.from({length:14},(_,i)=>i+START_HOUR); // 7:00 - 20:00
const WEEKDAYS = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const inputStyle = { width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:13, boxSizing:"border-box", fontFamily:"inherit" };
const navBtnStyle = { padding:"6px 12px", background:"#fff", border:`1px solid ${COLORS.primary}`, borderRadius:20, cursor:"pointer", color:COLORS.primary, fontWeight:600, fontSize:13 };

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatTime(h, m=0) { return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function checkExpiry(dateStr) {
  if(!dateStr) return null;
  const date = parseLocalDate(dateStr);
  const diff = (date - new Date()) / (1000*60*60*24);
  if(diff < 0) return "expired";
  if(diff < 30) return "warning";
  return "ok";
}
function getCarAlerts(car) {
  const checks = [
    ["Assicurazione", car.insurance], ["Bollo", car.bollo], ["Revisione", car.revision],
    ["Cambio olio", car.oil_date], ["Gomme", car.tires_date], ["Tagliando", car.service_date],
  ];
  return checks.map(([label, date]) => ({ label, status: checkExpiry(date) })).filter(a => a.status && a.status !== "ok");
}
// Arrotonda minuti ai più vicini 15
function snapMinutes(m) { return Math.round(m / 15) * 15; }
// Pixel → ora+minuti (relativi a START_HOUR)
function pxToTime(px) {
  const totalMins = Math.round((px / HOUR_HEIGHT) * 60);
  const snapped = snapMinutes(totalMins);
  const h = START_HOUR + Math.floor(snapped / 60);
  const m = snapped % 60;
  return { h: Math.max(START_HOUR, Math.min(23, h)), m: Math.max(0, Math.min(59, m)) };
}

function Modal({title, onClose, children, wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",overflowY:"auto",padding:16}}>
      <div style={{background:"#fff",borderRadius:12,padding:28,maxWidth:wide?520:440,width:"100%",margin:"auto",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:COLORS.primary,fontSize:16}}>{title}</h3>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",fontSize:20,cursor:"pointer",color:COLORS.textMuted,lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CarFormFields({data, setData}) {
  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Modello *","model","text"],["Targa *","plate","text"]].map(([l,k,t])=>(
          <div key={k}><label style={{fontSize:12,color:COLORS.textMuted}}>{l}</label>
            <input type={t} value={data[k]||""} onChange={e=>setData({...data,[k]:e.target.value})} style={inputStyle}/></div>
        ))}
        <div><label style={{fontSize:12,color:COLORS.textMuted}}>Stato</label>
          <select value={data.status||"active"} onChange={e=>setData({...data,status:e.target.value})} style={inputStyle}>
            <option value="active">Attiva</option><option value="unavailable">Non disponibile</option>
          </select></div>
        <div><label style={{fontSize:12,color:COLORS.textMuted}}>Km attuale</label>
          <input type="number" value={data.km||0} onChange={e=>setData({...data,km:parseInt(e.target.value)||0})} style={inputStyle}/></div>
        {[["Scad. Assicurazione","insurance"],["Scad. Bollo","bollo"],["Scad. Revisione","revision"]].map(([l,k])=>(
          <div key={k}><label style={{fontSize:12,color:COLORS.textMuted}}>{l}</label>
            <input type="date" value={data[k]||""} onChange={e=>setData({...data,[k]:e.target.value})} style={inputStyle}/></div>
        ))}
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:12,color:COLORS.textMuted}}>Colore</label>
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
            {CAR_COLORS.map(c=>(
              <div key={c} onClick={()=>setData({...data,color:c})} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:data.color===c?"3px solid #000":"3px solid transparent",boxSizing:"border-box"}}/>
            ))}
          </div>
        </div>
      </div>
      <div style={{marginTop:12,borderTop:"1px solid #eee",paddingTop:12}}>
        <b style={{fontSize:13}}>🔧 Manutenzioni</b>
        {[["Cambio Olio","oil_date","oil_km"],["Cambio Gomme","tires_date","tires_km"],["Tagliando","service_date","service_km"]].map(([l,kd,kkm])=>(
          <div key={kd} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>{l} - Data</label>
              <input type="date" value={data[kd]||""} onChange={e=>setData({...data,[kd]:e.target.value})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>{l} - Km</label>
              <input type="number" value={data[kkm]||""} onChange={e=>setData({...data,[kkm]:parseInt(e.target.value)||null})} style={inputStyle}/></div>
          </div>
        ))}
        <div style={{marginTop:8}}><label style={{fontSize:12,color:COLORS.textMuted}}>Note tecniche</label>
          <textarea value={data.notes||""} onChange={e=>setData({...data,notes:e.target.value})} rows={2} style={{...inputStyle,resize:"vertical"}}/></div>
      </div>
    </>
  );
}

export default function FleetApp({ currentUser }) {
  const { instance } = useMsal();
  const [view, setView] = useState("calendar");
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calView, setCalView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [fleetTab, setFleetTab] = useState("fleet");
  const [fleetCalCar, setFleetCalCar] = useState("all");
  const [notification, setNotification] = useState(null);

  const [bookModal, setBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({ carId:"", start:"", startTime:"09:00", end:"", endTime:"18:00", destination:"" });
  // ✅ Modal modifica prenotazione (User/Admin)
  const [editBookingModal, setEditBookingModal] = useState(null);
  const [editBookingForm, setEditBookingForm] = useState({ carId:"", start:"", startTime:"09:00", end:"", endTime:"18:00", destination:"" });
  const [priorityRequestModal, setPriorityRequestModal] = useState(false);
  const [priorityForm, setPriorityForm] = useState({ carId:"", start:"", startTime:"09:00", end:"", endTime:"18:00", destination:"", reason:"" });
  const [approveModal, setApproveModal] = useState(null);
  const [addCarModal, setAddCarModal] = useState(false);
  const [newCar, setNewCar] = useState(emptyNewCar);
  const [editCar, setEditCar] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteBookingConfirm, setDeleteBookingConfirm] = useState(null);

  // ✅ Drag & drop state
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { bookingId, type: 'move'|'resize', startY, origStart, origEnd }

  const isAdmin = currentUser.role === "admin";
  const isStaff = currentUser.role === "staff" || isAdmin;

  async function getToken() {
    const response = await instance.acquireTokenSilent({ ...loginRequest, account: instance.getAllAccounts()[0] });
    return response.accessToken;
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [carsRes, bookingsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/cars`),
        fetch(`${BACKEND_URL}/api/bookings`)
      ]);
      setCars(await carsRes.json());
      setBookings(await bookingsRes.json());
    } catch(err) { notify("Errore connessione al server", "error"); }
    finally { setLoading(false); }
  }

  function notify(msg, type="success") {
    setNotification({msg, type});
    setTimeout(() => setNotification(null), 4000);
  }

  function isPast(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    return parseLocalDate(dateStr) < today;
  }
  function isPastDateTime(dateStr, timeStr) { return new Date(`${dateStr}T${timeStr}`) < new Date(); }

  function hasConflict(carId, start, end, excludeId=null) {
    return bookings.some(b => {
      if(b.id === excludeId || b.car_id !== parseInt(carId) || b.status === "cancelled") return false;
      return new Date(start) < new Date(b.end_date) && new Date(end) > new Date(b.start_date);
    });
  }
  function getAvailableCars(start, end, excludeId=null) {
    return cars.filter(c => c.status === "active" && !hasConflict(c.id, start, end, excludeId));
  }
  function getBusyCars(start, end) {
    return cars.filter(c => c.status === "active" && hasConflict(c.id, start, end));
  }
  function getCarColor(carId) { return cars.find(c=>c.id===carId)?.color || "#999"; }

  // ✅ Aggiorna prenotazione sul backend
  async function updateBooking(bId, newStart, newEnd, newCarId, newDestination) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings/${bId}`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          start_date: newStart, end_date: newEnd,
          car_id: newCarId, destination: newDestination,
          user_id: currentUser.id, user_name: currentUser.name, user_role: currentUser.role
        })
      });
      if(!res.ok) { const e = await res.json(); notify(e.error||"Errore aggiornamento","error"); return false; }
      return true;
    } catch { notify("Errore aggiornamento","error"); return false; }
  }

  async function handleBookSubmit() {
    const start = `${bookForm.start}T${bookForm.startTime}`;
    const end = `${bookForm.end}T${bookForm.endTime}`;
    if(!bookForm.carId || !bookForm.start || !bookForm.end || !bookForm.destination) { notify("Compila tutti i campi","error"); return; }
    if(isPastDateTime(bookForm.start, bookForm.startTime)) { notify("Non puoi prenotare nel passato","error"); return; }
    if(new Date(start) >= new Date(end)) { notify("La data di fine deve essere dopo quella di inizio","error"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ car_id: parseInt(bookForm.carId), user_id: currentUser.id, user_name: currentUser.name, user_email: currentUser.email, start_date: start, end_date: end, destination: bookForm.destination, status: "confirmed" })
      });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      const booking = await res.json();
      try {
        const token = await getToken();
        await fetch(`${BACKEND_URL}/api/graph/booking-confirmed`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken: token, bookingId: booking.id }) });
      } catch(e) { console.warn("Email/calendario non inviato:", e); }
      setBookModal(false);
      setBookForm({ carId:"", start:"", startTime:"09:00", end:"", endTime:"18:00", destination:"" });
      notify("Prenotazione confermata!");
      loadData();
    } catch(err) { notify("Errore durante la prenotazione","error"); }
  }

  // ✅ Apri modal modifica prenotazione
  function openEditBooking(b) {
    const [startDate, startTime] = b.start_date.split("T");
    const [endDate, endTime] = b.end_date.split("T");
    setEditBookingForm({
      carId: String(b.car_id), start: startDate, startTime: startTime?.slice(0,5)||"09:00",
      end: endDate, endTime: endTime?.slice(0,5)||"18:00", destination: b.destination
    });
    setEditBookingModal(b);
  }

  async function handleEditBookingSubmit() {
    const b = editBookingModal;
    const start = `${editBookingForm.start}T${editBookingForm.startTime}`;
    const end = `${editBookingForm.end}T${editBookingForm.endTime}`;
    if(!editBookingForm.carId || !editBookingForm.start || !editBookingForm.end || !editBookingForm.destination) { notify("Compila tutti i campi","error"); return; }
    if(new Date(start) >= new Date(end)) { notify("La data di fine deve essere dopo quella di inizio","error"); return; }
    const ok = await updateBooking(b.id, start, end, parseInt(editBookingForm.carId), editBookingForm.destination);
    if(ok) { setEditBookingModal(null); notify("Prenotazione aggiornata!"); loadData(); }
  }

  async function handlePrioritySubmit() {
    const start = `${priorityForm.start}T${priorityForm.startTime}`;
    const end = `${priorityForm.end}T${priorityForm.endTime}`;
    if(!priorityForm.carId || !priorityForm.start || !priorityForm.end || !priorityForm.destination || !priorityForm.reason) { notify("Compila tutti i campi inclusa la motivazione","error"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ car_id: parseInt(priorityForm.carId), user_id: currentUser.id, user_name: currentUser.name, user_email: currentUser.email, start_date: start, end_date: end, destination: priorityForm.destination, status: "priority_request", reason: priorityForm.reason })
      });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      const booking = await res.json();
      try {
        const token = await getToken();
        const staffEmails = bookings.filter(b => b.user_id !== currentUser.id).map(b => b.user_email).filter((v,i,a) => a.indexOf(v)===i).slice(0,5);
        if(staffEmails.length > 0) await fetch(`${BACKEND_URL}/api/graph/priority-request`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken: token, bookingId: booking.id, staffEmails }) });
      } catch(e) { console.warn("Notifica staff non inviata:", e); }
      setPriorityRequestModal(false);
      setPriorityForm({ carId:"", start:"", startTime:"09:00", end:"", endTime:"18:00", destination:"", reason:"" });
      notify("Richiesta priorità inviata, in attesa di approvazione");
      loadData();
    } catch(err) { notify("Errore durante la richiesta","error"); }
  }

  async function handleApprove(bId, approve) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings/${bId}/status`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ status: approve ? "confirmed" : "cancelled", user_id: currentUser.id, user_name: currentUser.name }) });
      if(!res.ok) { notify("Errore aggiornamento","error"); return; }
      try {
        const token = await getToken();
        await fetch(`${BACKEND_URL}/api/graph/priority-response`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken: token, bookingId: bId, approved: approve, adminName: currentUser.name }) });
        if(approve) await fetch(`${BACKEND_URL}/api/graph/booking-confirmed`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken: token, bookingId: bId }) });
      } catch(e) { console.warn("Email risposta non inviata:", e); }
      setApproveModal(null);
      notify(approve ? "Richiesta approvata!" : "Richiesta rifiutata", approve ? "success" : "error");
      loadData();
    } catch(err) { notify("Errore","error"); }
  }

  async function cancelBooking(bId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings/${bId}`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: currentUser.id, user_name: currentUser.name, user_role: currentUser.role }) });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      try {
        const token = await getToken();
        await fetch(`${BACKEND_URL}/api/graph/booking-cancelled`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ accessToken: token, bookingId: bId, cancelledByName: currentUser.name }) });
      } catch(e) { console.warn("Email cancellazione non inviata:", e); }
      notify("Prenotazione annullata");
      loadData();
    } catch(err) { notify("Errore","error"); }
  }

  async function addCar() {
    if(!newCar.model || !newCar.plate) { notify("Modello e targa obbligatori","error"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/cars`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...newCar, user_id: currentUser.id, user_name: currentUser.name}) });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      setAddCarModal(false); setNewCar(emptyNewCar); notify("Auto aggiunta!"); loadData();
    } catch(err) { notify("Errore","error"); }
  }

  async function saveCar() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/cars/${editCar.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...editCar, user_id: currentUser.id, user_name: currentUser.name}) });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      setEditCar(null); notify("Auto aggiornata!"); loadData();
    } catch(err) { notify("Errore","error"); }
  }

  async function deleteCar(car) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/cars/${car.id}`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: currentUser.id, user_name: currentUser.name }) });
      if(!res.ok) { const e = await res.json(); notify(e.error,"error"); return; }
      setDeleteConfirm(null); notify("Auto eliminata", "error"); loadData();
    } catch(err) { notify("Errore","error"); }
  }

  function getMonthDays(d) {
    const [y,m] = [d.getFullYear(), d.getMonth()];
    const first = new Date(y,m,1), last = new Date(y,m+1,0);
    const days = [];
    for(let i=0; i<(first.getDay()+6)%7; i++) days.push(null);
    for(let i=1; i<=last.getDate(); i++) days.push(new Date(y,m,i));
    return days;
  }

  function getWeekDays(d) {
    const day = (d.getDay()+6)%7;
    const mon = new Date(d); mon.setDate(d.getDate()-day);
    return Array.from({length:7},(_,i)=>addDays(mon,i));
  }

  function bookingsForDate(ds, carFilter="all") {
    return bookings.filter(b => {
      if(b.status==="cancelled") return false;
      if(carFilter!=="all" && b.car_id!==parseInt(carFilter)) return false;
      return ds >= b.start_date.split("T")[0] && ds <= b.end_date.split("T")[0];
    });
  }

  // Calcola stile evento per viste ora (giorno/settimana) — solo per il giorno corrente
  function getEventStyle(b, allSameDay) {
    const idx = allSameDay.indexOf(b), count = allSameDay.length;
    const startH = parseInt(b.start_date.split("T")[1]?.split(":")[0]||9);
    const startM = parseInt(b.start_date.split("T")[1]?.split(":")[1]||0);
    const endH = parseInt(b.end_date.split("T")[1]?.split(":")[0]||18);
    const endM = parseInt(b.end_date.split("T")[1]?.split(":")[1]||0);
    const top = (startH - START_HOUR) * HOUR_HEIGHT + (startM / 60) * HOUR_HEIGHT;
    const height = Math.max(((endH - startH) * 60 + (endM - startM)) / 60 * HOUR_HEIGHT, 20);
    const w = count > 1 ? 88 / count : 90;
    const l = count > 1 ? idx * (88 / count) + 2 : 5;
    return { top, height, width:`${w}%`, left:`${l}%` };
  }

  function navigateCal(dir) {
    setCurrentDate(d => {
      const n = new Date(d);
      if(calView==="month") n.setMonth(n.getMonth()+dir);
      else if(calView==="week") n.setDate(n.getDate()+dir*7);
      else n.setDate(n.getDate()+dir);
      return n;
    });
  }

  // ✅ Drag & Drop handlers
  function canDrag(b) {
    return (b.user_id === currentUser.id || isAdmin) && b.status !== "cancelled";
  }

  function onDragStart(e, b, type) {
    if(!canDrag(b)) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      bookingId: b.id, type,
      startY: e.clientY,
      origStart: b.start_date,
      origEnd: b.end_date,
      carId: b.car_id,
      destination: b.destination
    };
    setDragging({ bookingId: b.id, type });
  }

  const onDragMove = useCallback((e) => {
    if(!dragRef.current) return;
    const { bookingId, type, startY, origStart, origEnd } = dragRef.current;
    const dy = e.clientY - startY;
    const deltaMins = snapMinutes((dy / HOUR_HEIGHT) * 60);

    setBookings(prev => prev.map(b => {
      if(b.id !== bookingId) return b;
      const origStartDate = new Date(origStart);
      const origEndDate = new Date(origEnd);
      if(type === "move") {
        // Sposta tutta la prenotazione
        const newStart = new Date(origStartDate.getTime() + deltaMins * 60000);
        const newEnd = new Date(origEndDate.getTime() + deltaMins * 60000);
        return { ...b, start_date: newStart.toISOString().slice(0,16), end_date: newEnd.toISOString().slice(0,16) };
      } else if(type === "resize-start") {
        // Modifica l'inizio — non può superare la fine
        const newStart = new Date(origStartDate.getTime() + deltaMins * 60000);
        if(newStart >= origEndDate) return b;
        return { ...b, start_date: newStart.toISOString().slice(0,16) };
      } else { // resize-end
        // Modifica la fine — non può andare prima dell'inizio
        const newEnd = new Date(origEndDate.getTime() + deltaMins * 60000);
        if(newEnd <= origStartDate) return b;
        return { ...b, end_date: newEnd.toISOString().slice(0,16) };
      }
    }));
  }, []);

  const onDragEnd = useCallback(async () => {
    if(!dragRef.current) return;
    const { bookingId } = dragRef.current;
    dragRef.current = null;
    setDragging(null);
    const b = bookings.find(bk => bk.id === bookingId);
    if(!b) return;
    // Salva sul backend
    const ok = await updateBooking(b.id, b.start_date, b.end_date, b.car_id, b.destination);
    if(ok) { notify("Prenotazione aggiornata!"); loadData(); }
    else { loadData(); } // ripristina se errore
  }, [bookings]);

  useEffect(() => {
    if(dragging) {
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragEnd);
      return () => { window.removeEventListener("mousemove", onDragMove); window.removeEventListener("mouseup", onDragEnd); };
    }
  }, [dragging, onDragMove, onDragEnd]);

  // ✅ Click su slot orario per aprire modal prenotazione
  function onTimeSlotClick(dateStr, hour) {
    if(isPast(dateStr)) return;
    const endHour = Math.min(hour + 1, 20);
    setBookForm({ carId:"", start: dateStr, startTime: formatTime(hour), end: dateStr, endTime: formatTime(endHour), destination:"" });
    setBookModal(true);
  }

  // ✅ Click su cella del mese per aprire modal prenotazione
  function onMonthDayClick(d) {
    if(!d || isPast(formatDate(d))) return;
    const ds = formatDate(d);
    setBookForm({ carId:"", start: ds, startTime:"09:00", end: ds, endTime:"18:00", destination:"" });
    setBookModal(true);
  }

  const pendingPriority = bookings.filter(b => b.status==="priority_request");

  // ✅ Intestazione navigazione calendario
  function CalHeader() {
    let label = "";
    if(calView === "month") label = currentDate.toLocaleDateString("it-IT", {month:"long", year:"numeric"});
    else if(calView === "week") {
      const days = getWeekDays(currentDate);
      label = `${days[0].getDate()} — ${days[6].toLocaleDateString("it-IT", {day:"numeric", month:"long", year:"numeric"})}`;
    } else {
      label = currentDate.toLocaleDateString("it-IT", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
    }
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <h2 style={{margin:0,color:COLORS.primary,fontSize:18}}>📅 Calendario Prenotazioni</h2>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {/* 1. Label periodo corrente */}
          <span style={{fontSize:14,fontWeight:600,color:COLORS.text,minWidth:180,textAlign:"center"}}>{label}</span>
          {/* 2. Switcher vista: Mese | Settimana | Giorno */}
          <div style={{display:"flex",background:"#f0f0f0",borderRadius:20,padding:2,gap:2}}>
            {["month","week","day"].map(v=>(
              <button key={v} onClick={()=>setCalView(v)} style={{padding:"5px 14px",background:calView===v?COLORS.primary:"transparent",color:calView===v?"#fff":COLORS.text,border:"none",borderRadius:18,cursor:"pointer",fontWeight:calView===v?700:400,fontSize:13,transition:"all 0.15s"}}>
                {v==="month"?"Mese":v==="week"?"Settimana":"Giorno"}
              </button>
            ))}
          </div>
          {/* 3. Oggi ‹ › */}
          <button onClick={()=>setCurrentDate(new Date())} style={{...navBtnStyle,background:COLORS.primary,color:"#fff",border:"none"}}>Oggi</button>
          <button onClick={()=>navigateCal(-1)} style={navBtnStyle}>‹</button>
          <button onClick={()=>navigateCal(1)} style={navBtnStyle}>›</button>
        </div>
      </div>
    );
  }

  // ✅ Rendering evento nella griglia oraria (settimana/giorno) con drag
  function TimeEvent({b, allSameDay, compact=false}) {
    const s = getEventStyle(b, allSameDay);
    const canEdit = canDrag(b);
    const HANDLE_H = 10; // altezza handle in px
    return (
      <div
        key={b.id}
        style={{position:"absolute",top:s.top,height:s.height,left:s.left,width:s.width,background:getCarColor(b.car_id),borderRadius:6,overflow:"hidden",color:"#fff",fontSize:compact?9:11,boxShadow:"0 2px 4px rgba(0,0,0,0.2)",zIndex:dragging?.bookingId===b.id?10:2,border:b.status==="priority_request"?"2px dashed "+COLORS.warning:"1px solid rgba(255,255,255,0.2)",userSelect:"none",boxSizing:"border-box",cursor:canEdit?"grab":"default"}}
        title={`${b.car_model} — ${b.user_name}\n${b.start_date.split("T")[1]?.slice(0,5)} - ${b.end_date.split("T")[1]?.slice(0,5)}`}
      >
        {/* ✅ Handle TOP — modifica ora inizio */}
        {canEdit && (
          <div
            onMouseDown={e=>{e.stopPropagation(); e.preventDefault(); onDragStart(e,b,"resize-start");}}
            style={{position:"absolute",top:0,left:0,right:0,height:HANDLE_H,cursor:"n-resize",background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3,flexShrink:0}}
          >
            <div style={{width:20,height:2,background:"rgba(255,255,255,0.7)",borderRadius:2}}/>
          </div>
        )}

        {/* Corpo — sposta tutta la prenotazione */}
        <div
          onMouseDown={canEdit ? (e)=>{e.stopPropagation(); e.preventDefault(); onDragStart(e,b,"move");} : undefined}
          onClick={e=>{e.stopPropagation(); if(canEdit) openEditBooking(b);}}
          style={{padding:`${canEdit ? HANDLE_H+2 : 3}px 6px ${canEdit ? HANDLE_H+2 : 3}px 6px`,overflow:"hidden",height:"100%",cursor:canEdit?"grab":"default"}}
        >
          {b.status==="priority_request" && <span style={{fontSize:9,background:COLORS.warning,borderRadius:3,padding:"0 3px",marginBottom:2,display:"inline-block"}}>⚡</span>}
          <div style={{fontWeight:700,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{b.car_model}</div>
          {!compact && <div style={{opacity:0.9,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>👤 {b.user_name}</div>}
          {!compact && <div style={{opacity:0.85,fontSize:10}}>{b.start_date.split("T")[1]?.slice(0,5)}–{b.end_date.split("T")[1]?.slice(0,5)}</div>}
        </div>

        {/* ✅ Handle BOTTOM — modifica ora fine */}
        {canEdit && (
          <div
            onMouseDown={e=>{e.stopPropagation(); e.preventDefault(); onDragStart(e,b,"resize-end");}}
            style={{position:"absolute",bottom:0,left:0,right:0,height:HANDLE_H,cursor:"s-resize",background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3}}
          >
            <div style={{width:20,height:2,background:"rgba(255,255,255,0.7)",borderRadius:2}}/>
          </div>
        )}
      </div>
    );
  }

  if(loading) return (
    <div style={{minHeight:"100vh",background:COLORS.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:50,height:50,border:`4px solid ${COLORS.primaryLight}`,borderTop:`4px solid ${COLORS.primary}`,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
        <p style={{color:COLORS.textMuted}}>Caricamento dati...</p>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Segoe UI',sans-serif",background:COLORS.bg,minHeight:"100vh",color:COLORS.text,cursor:dragging?"grabbing":"default"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; }`}</style>

      {notification && (
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:notification.type==="success"?COLORS.success:COLORS.danger,color:"#fff",padding:"12px 20px",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          {notification.msg}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && isStaff && (
        <Modal title="⚡ Richiesta Priorità" onClose={()=>setApproveModal(null)}>
          <p><b>Utente:</b> {approveModal.user_name}</p>
          <p><b>Auto:</b> {approveModal.car_model}</p>
          <p><b>Periodo:</b> {approveModal.start_date?.replace("T"," ")} → {approveModal.end_date?.replace("T"," ")}</p>
          <p><b>Destinazione:</b> {approveModal.destination}</p>
          <p><b>Motivazione:</b> {approveModal.reason}</p>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={()=>handleApprove(approveModal.id,true)} style={{flex:1,padding:"10px",background:COLORS.success,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>✅ Approva</button>
            <button onClick={()=>handleApprove(approveModal.id,false)} style={{flex:1,padding:"10px",background:COLORS.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>❌ Rifiuta</button>
          </div>
        </Modal>
      )}

      {/* Modal elimina prenotazione (Admin) */}
      {deleteBookingConfirm && isAdmin && (
        <Modal title="🗑️ Elimina Prenotazione" onClose={()=>setDeleteBookingConfirm(null)}>
          <p>Sei sicuro di voler eliminare la prenotazione di <b>{deleteBookingConfirm.user_name}</b>?</p>
          <div style={{background:COLORS.bg,borderRadius:8,padding:12,marginBottom:12,fontSize:13}}>
            <div>🚗 <b>{deleteBookingConfirm.car_model}</b> {deleteBookingConfirm.car_plate && `(${deleteBookingConfirm.car_plate})`}</div>
            <div>📅 {deleteBookingConfirm.start_date?.replace("T"," ")} → {deleteBookingConfirm.end_date?.replace("T"," ")}</div>
            <div>📍 {deleteBookingConfirm.destination}</div>
          </div>
          <p style={{fontSize:13,color:COLORS.danger}}>⚠️ L'utente riceverà una notifica di cancellazione.</p>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={()=>{ cancelBooking(deleteBookingConfirm.id); setDeleteBookingConfirm(null); }} style={{flex:1,padding:"10px",background:COLORS.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>🗑️ Elimina</button>
            <button onClick={()=>setDeleteBookingConfirm(null)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* ✅ Modal modifica prenotazione */}
      {editBookingModal && (
        <Modal title="✏️ Modifica Prenotazione" onClose={()=>setEditBookingModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data inizio</label>
              <input type="date" min={formatDate(new Date())} value={editBookingForm.start} onChange={e=>setEditBookingForm({...editBookingForm,start:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora inizio</label>
              <input type="time" value={editBookingForm.startTime} onChange={e=>setEditBookingForm({...editBookingForm,startTime:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data fine</label>
              <input type="date" min={editBookingForm.start||formatDate(new Date())} value={editBookingForm.end} onChange={e=>setEditBookingForm({...editBookingForm,end:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora fine</label>
              <input type="time" value={editBookingForm.endTime} onChange={e=>setEditBookingForm({...editBookingForm,endTime:e.target.value,carId:""})} style={inputStyle}/></div>
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:12,color:COLORS.textMuted}}>Destinazione *</label>
            <input value={editBookingForm.destination} onChange={e=>setEditBookingForm({...editBookingForm,destination:e.target.value})} placeholder="Es. Milano Centro" style={inputStyle}/>
          </div>
          {editBookingForm.start && editBookingForm.end && (() => {
            const avail = getAvailableCars(`${editBookingForm.start}T${editBookingForm.startTime}`, `${editBookingForm.end}T${editBookingForm.endTime}`, editBookingModal.id);
            return (
              <div style={{marginTop:10}}>
                <label style={{fontSize:12,color:COLORS.textMuted}}>Auto</label>
                <select value={editBookingForm.carId} onChange={e=>setEditBookingForm({...editBookingForm,carId:e.target.value})} style={inputStyle}>
                  <option value="">-- Seleziona auto --</option>
                  {avail.map(c => <option key={c.id} value={c.id}>{c.model} ({c.plate}){getCarAlerts(c).length?" ⚠️":""}</option>)}
                </select>
              </div>
            );
          })()}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={handleEditBookingSubmit} style={{flex:1,padding:"10px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>💾 Salva modifiche</button>
            <button onClick={()=>setEditBookingModal(null)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* Book Modal */}
      {bookModal && (
        <Modal title="🚘 Nuova Prenotazione" onClose={()=>setBookModal(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data inizio</label>
              <input type="date" min={formatDate(new Date())} value={bookForm.start} onChange={e=>setBookForm({...bookForm,start:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora inizio</label>
              <input type="time" value={bookForm.startTime} onChange={e=>setBookForm({...bookForm,startTime:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data fine</label>
              <input type="date" min={bookForm.start||formatDate(new Date())} value={bookForm.end} onChange={e=>setBookForm({...bookForm,end:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora fine</label>
              <input type="time" value={bookForm.endTime} onChange={e=>setBookForm({...bookForm,endTime:e.target.value,carId:""})} style={inputStyle}/></div>
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:12,color:COLORS.textMuted}}>Destinazione *</label>
            <input value={bookForm.destination} onChange={e=>setBookForm({...bookForm,destination:e.target.value})} placeholder="Es. Milano Centro" style={inputStyle}/>
          </div>
          {bookForm.start && bookForm.end && (() => {
            const avail = getAvailableCars(`${bookForm.start}T${bookForm.startTime}`, `${bookForm.end}T${bookForm.endTime}`);
            return (
              <div style={{marginTop:10}}>
                <label style={{fontSize:12,color:COLORS.textMuted}}>Auto disponibili</label>
                {avail.length===0
                  ? <div style={{padding:10,background:"#fee",borderRadius:6,color:COLORS.danger,fontSize:13}}>Nessuna auto disponibile nell'intervallo selezionato.</div>
                  : <select value={bookForm.carId} onChange={e=>setBookForm({...bookForm,carId:e.target.value})} style={inputStyle}>
                      <option value="">-- Seleziona auto --</option>
                      {avail.map(c => <option key={c.id} value={c.id}>{c.model} ({c.plate}){getCarAlerts(c).length?" ⚠️":""}</option>)}
                    </select>
                }
                {bookForm.carId && (() => {
                  const alerts = getCarAlerts(cars.find(c=>c.id===parseInt(bookForm.carId))||{});
                  return alerts.length>0 ? (
                    <div style={{marginTop:6,padding:8,background:"#fffbe6",border:"1px solid "+COLORS.warning,borderRadius:6}}>
                      {alerts.map((a,i)=><div key={i} style={{fontSize:12,color:COLORS.warning}}>⚠️ {a.label} {a.status==="expired"?"scaduto":"in scadenza"}</div>)}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })()}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={handleBookSubmit} style={{flex:1,padding:"10px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>✅ Conferma</button>
            <button onClick={()=>{ setBookModal(false); setPriorityRequestModal(true); setPriorityForm({...priorityForm,start:bookForm.start,startTime:bookForm.startTime,end:bookForm.end,endTime:bookForm.endTime,destination:bookForm.destination}); }} style={{flex:1,padding:"10px",background:COLORS.warning,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>⚡ Richiedi Priorità</button>
          </div>
        </Modal>
      )}

      {/* Priority Modal */}
      {priorityRequestModal && (
        <Modal title="⚡ Richiesta Priorità su Auto Occupata" onClose={()=>setPriorityRequestModal(false)}>
          <p style={{fontSize:13,color:COLORS.textMuted,marginTop:0}}>Usa questo modulo quando l'auto che ti serve è già prenotata.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data inizio</label>
              <input type="date" min={formatDate(new Date())} value={priorityForm.start} onChange={e=>setPriorityForm({...priorityForm,start:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora inizio</label>
              <input type="time" value={priorityForm.startTime} onChange={e=>setPriorityForm({...priorityForm,startTime:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Data fine</label>
              <input type="date" min={priorityForm.start||formatDate(new Date())} value={priorityForm.end} onChange={e=>setPriorityForm({...priorityForm,end:e.target.value,carId:""})} style={inputStyle}/></div>
            <div><label style={{fontSize:12,color:COLORS.textMuted}}>Ora fine</label>
              <input type="time" value={priorityForm.endTime} onChange={e=>setPriorityForm({...priorityForm,endTime:e.target.value,carId:""})} style={inputStyle}/></div>
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:12,color:COLORS.textMuted}}>Destinazione *</label>
            <input value={priorityForm.destination} onChange={e=>setPriorityForm({...priorityForm,destination:e.target.value})} placeholder="Es. Milano Centro" style={inputStyle}/>
          </div>
          {priorityForm.start && priorityForm.end && (() => {
            const start = `${priorityForm.start}T${priorityForm.startTime}`;
            const end = `${priorityForm.end}T${priorityForm.endTime}`;
            const busy = getBusyCars(start, end);
            const avail = getAvailableCars(start, end);
            return (
              <div style={{marginTop:10}}>
                <label style={{fontSize:12,color:COLORS.textMuted}}>Seleziona auto</label>
                <select value={priorityForm.carId} onChange={e=>setPriorityForm({...priorityForm,carId:e.target.value})} style={inputStyle}>
                  <option value="">-- Seleziona auto --</option>
                  {avail.length>0 && <optgroup label="✅ Disponibili">{avail.map(c=><option key={c.id} value={c.id}>{c.model} ({c.plate})</option>)}</optgroup>}
                  {busy.length>0 && <optgroup label="🔴 Già prenotate">{busy.map(c=><option key={c.id} value={c.id}>{c.model} ({c.plate}) — OCCUPATA</option>)}</optgroup>}
                </select>
              </div>
            );
          })()}
          <div style={{marginTop:10}}>
            <label style={{fontSize:12,color:COLORS.textMuted}}>Motivazione * (obbligatoria)</label>
            <textarea value={priorityForm.reason} onChange={e=>setPriorityForm({...priorityForm,reason:e.target.value})} rows={3} placeholder="Spiega perché hai urgente necessità di questa auto..." style={{...inputStyle,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={handlePrioritySubmit} style={{flex:1,padding:"10px",background:COLORS.warning,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>⚡ Invia Richiesta</button>
            <button onClick={()=>setPriorityRequestModal(false)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* Add Car Modal */}
      {addCarModal && (
        <Modal title="➕ Aggiungi Auto" onClose={()=>setAddCarModal(false)} wide>
          <CarFormFields data={newCar} setData={setNewCar}/>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={addCar} style={{flex:1,padding:"10px",background:COLORS.success,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>✅ Aggiungi</button>
            <button onClick={()=>setAddCarModal(false)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* Edit Car Modal */}
      {editCar && (
        <Modal title="✏️ Modifica Auto" onClose={()=>setEditCar(null)} wide>
          <CarFormFields data={editCar} setData={setEditCar}/>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={saveCar} style={{flex:1,padding:"10px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>Salva</button>
            <button onClick={()=>setEditCar(null)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* Delete Car Confirm */}
      {deleteConfirm && (
        <Modal title="🗑️ Elimina Auto" onClose={()=>setDeleteConfirm(null)}>
          <p>Sei sicuro di voler eliminare <b>{deleteConfirm.model} ({deleteConfirm.plate})</b>?</p>
          <p style={{fontSize:13,color:COLORS.textMuted}}>Tutte le prenotazioni associate verranno annullate.</p>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={()=>deleteCar(deleteConfirm)} style={{flex:1,padding:"10px",background:COLORS.danger,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>🗑️ Elimina</button>
            <button onClick={()=>setDeleteConfirm(null)} style={{padding:"10px 16px",background:"#eee",border:"none",borderRadius:8,cursor:"pointer"}}>Annulla</button>
          </div>
        </Modal>
      )}

      {/* HEADER */}
      <div style={{background:COLORS.primary,padding:"0 24px",display:"flex",alignItems:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0"}}>
          <div style={{width:40,height:40,background:"#fff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:COLORS.primary}}>J+S</div>
          <span style={{color:"#fff",fontWeight:700,fontSize:18}}>Fleet Manager</span>
        </div>
        <nav style={{display:"flex",gap:4,marginLeft:32,flex:1}}>
          {[{id:"calendar",label:"📅 Calendario"},{id:"book",label:"🚘 Prenota Auto"},{id:"fleet",label:"🚗 Gestione Parco",staffOnly:true}].filter(n=>!n.staffOnly||isStaff).map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{background:view===n.id?"rgba(255,255,255,0.2)":"transparent",color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:view===n.id?700:400,fontSize:14}}>{n.label}</button>
          ))}
        </nav>
        {isStaff && pendingPriority.length>0 && (
          <div style={{background:COLORS.warning,color:"#fff",borderRadius:16,padding:"4px 10px",fontSize:12,fontWeight:700,marginRight:10,cursor:"pointer"}} onClick={()=>setApproveModal(pendingPriority[0])}>
            ⚡ {pendingPriority.length} priorità in attesa
          </div>
        )}
        <div style={{color:"rgba(255,255,255,0.9)",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
          <span>👤</span><span>{currentUser.name}</span>
          <span style={{background:"rgba(255,255,255,0.2)",borderRadius:10,padding:"2px 8px",fontSize:11,marginLeft:4}}>{currentUser.role}</span>
        </div>
      </div>

      {/* MAIN */}
      <div style={{padding:"20px 24px",maxWidth:1400,margin:"0 auto"}}>

        {/* CALENDAR */}
        {view==="calendar" && (
          <div>
            <CalHeader/>

            {/* ✅ VISTA MESE */}
            {calView==="month" && (
              <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
                <div style={{background:COLORS.primary,padding:"8px 0",display:"grid",gridTemplateColumns:"repeat(7,1fr)",textAlign:"center"}}>
                  {WEEKDAYS.map(d=><div key={d} style={{color:"#fff",fontWeight:600,fontSize:13}}>{d}</div>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                  {getMonthDays(currentDate).map((d,i)=>{
                    const ds = d ? formatDate(d) : null;
                    const isToday = ds===formatDate(new Date());
                    const past = ds ? isPast(ds) : false;
                    // ✅ Prenotazioni multi-giorno orizzontali nel mese
                    const startingHere = ds ? bookings.filter(b => b.status!=="cancelled" && b.start_date.split("T")[0]===ds) : [];
                    const continuingHere = ds ? bookings.filter(b => b.status!=="cancelled" && b.start_date.split("T")[0]<ds && b.end_date.split("T")[0]>=ds) : [];
                    return (
                      <div key={i}
                        onClick={()=>onMonthDayClick(d)}
                        style={{minHeight:90,borderRight:"1px solid #f0f0f0",borderBottom:"1px solid #f0f0f0",padding:"4px 2px",background:d?(isToday?COLORS.primaryLight+"80":past?"#f9f9f9":"#fff"):"#fafafa",cursor:d&&!past?"pointer":"default",opacity:past?0.6:1,position:"relative"}}
                      >
                        {d && <div style={{fontWeight:isToday?700:400,color:isToday?COLORS.primary:past?COLORS.textMuted:COLORS.text,fontSize:13,marginBottom:3,paddingLeft:2}}>{d.getDate()}</div>}
                        {/* Prenotazioni che iniziano qui — si estendono orizzontalmente */}
                        {startingHere.map(b=>{
                          const startDs = b.start_date.split("T")[0];
                          const endDs = b.end_date.split("T")[0];
                          const weekDays = getWeekDays(d||new Date());
                          const weekEnd = formatDate(weekDays[6]);
                          const spanEnd = endDs > weekEnd ? weekEnd : endDs;
                          const spanDays = Math.round((parseLocalDate(spanEnd) - parseLocalDate(startDs)) / 86400000) + 1;
                          const isMultiDay = startDs !== endDs;
                          return (
                            <div key={b.id}
                              onClick={e=>{ e.stopPropagation(); if(canDrag(b)) openEditBooking(b); }}
                              style={{background:getCarColor(b.car_id),color:"#fff",borderRadius:isMultiDay?"3px 0 0 3px":3,fontSize:10,padding:"2px 5px",marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",position:"relative",zIndex:1,width:isMultiDay?`calc(${spanDays * 100}% + ${(spanDays-1)*1}px)`:"calc(100% - 4px)",cursor:canDrag(b)?"pointer":"default",fontWeight:600}}
                              title={`${b.car_model} — ${b.user_name}`}
                            >
                              {b.status==="priority_request"?"⚡ ":""}{b.car_model} {isMultiDay?`— ${b.user_name}`:""}
                            </div>
                          );
                        })}
                        {/* Prenotazioni che continuano da giorni precedenti — mostra placeholder */}
                        {continuingHere.filter(b=> {
                          const ds2 = d ? formatDate(d) : null;
                          const dow = (d?.getDay()+6)%7;
                          return dow !== 0; // non lunedì (già gestito dal giorno di inizio della settimana)
                        }).length > 0 && (
                          <div style={{height:6,borderRadius:3,background:"transparent",marginBottom:2}}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ✅ VISTA SETTIMANA */}
            {calView==="week" && (
              <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
                {/* Header giorni */}
                <div style={{display:"grid",gridTemplateColumns:"50px repeat(7,1fr)",background:COLORS.primary}}>
                  <div/>
                  {getWeekDays(currentDate).map(d=>{
                    const ds=formatDate(d);
                    const isToday = ds===formatDate(new Date());
                    return <div key={ds}
                      onClick={()=>{setCurrentDate(d);setCalView("day");}}
                      style={{padding:"8px 4px",textAlign:"center",color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",borderLeft:"1px solid rgba(255,255,255,0.2)",background:isToday?"rgba(255,255,255,0.15)":"transparent"}}>
                      {WEEKDAYS[(d.getDay()+6)%7]}<br/><span style={{fontSize:16,fontWeight:700}}>{d.getDate()}</span>
                    </div>;
                  })}
                </div>
                {/* Griglia oraria */}
                <div style={{overflowY:"auto",maxHeight:650}}>
                  <div style={{display:"grid",gridTemplateColumns:"50px repeat(7,1fr)",minHeight:HOURS.length*HOUR_HEIGHT}}>
                    {/* Colonna ore */}
                    <div style={{borderRight:"1px solid #eee"}}>
                      {HOURS.map(h=><div key={h} style={{height:HOUR_HEIGHT,borderBottom:"1px solid #f5f5f5",fontSize:11,color:COLORS.textMuted,padding:"2px 4px",flexShrink:0}}>{h}:00</div>)}
                    </div>
                    {/* Colonne giorni */}
                    {getWeekDays(currentDate).map(d=>{
                      const ds=formatDate(d);
                      const past = isPast(ds);
                      const dayBs = bookingsForDate(ds);
                      return (
                        <div key={ds} style={{position:"relative",borderLeft:"1px solid #eee",background:past?"#fafafa":"#fff"}}>
                          {/* Slot orari cliccabili */}
                          {HOURS.map(h=>(
                            <div key={h}
                              onClick={()=>!past && onTimeSlotClick(ds, h)}
                              style={{height:HOUR_HEIGHT,borderBottom:"1px solid #f5f5f5",cursor:past?"default":"pointer"}}
                              onMouseEnter={e=>{ if(!past) e.currentTarget.style.background="#f0faf8"; }}
                              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
                            />
                          ))}
                          {/* Prenotazioni */}
                          {dayBs.map(b=>(
                            <TimeEvent key={b.id} b={b} allSameDay={dayBs} compact={true}/>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ✅ VISTA GIORNO */}
            {calView==="day" && (
              <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
                <div style={{background:COLORS.primary,padding:"10px 16px",color:"#fff",fontWeight:700,fontSize:16}}>
                  {currentDate.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"60px 1fr",overflowY:"auto",maxHeight:650}}>
                  <div style={{borderRight:"1px solid #eee"}}>
                    {HOURS.map(h=><div key={h} style={{height:HOUR_HEIGHT,borderBottom:"1px solid #f5f5f5",fontSize:12,color:COLORS.textMuted,padding:"2px 6px",flexShrink:0}}>{h}:00</div>)}
                  </div>
                  <div style={{position:"relative"}}>
                    {/* Slot orari cliccabili */}
                    {HOURS.map(h=>(
                      <div key={h}
                        onClick={()=>!isPast(formatDate(currentDate)) && onTimeSlotClick(formatDate(currentDate), h)}
                        style={{height:HOUR_HEIGHT,borderBottom:"1px solid #f5f5f5",cursor:isPast(formatDate(currentDate))?"default":"pointer"}}
                        onMouseEnter={e=>{ if(!isPast(formatDate(currentDate))) e.currentTarget.style.background="#f0faf8"; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
                      />
                    ))}
                    {/* Prenotazioni */}
                    {bookingsForDate(formatDate(currentDate)).map(b=>(
                      <TimeEvent key={b.id} b={b} allSameDay={bookingsForDate(formatDate(currentDate))}/>
                    ))}
                  </div>
                </div>
                <div style={{padding:12,borderTop:"1px solid #eee",background:COLORS.primaryLight,display:"flex",gap:8}}>
                  <button onClick={()=>{setBookForm({...bookForm,start:formatDate(currentDate),end:formatDate(currentDate)});setBookModal(true);}} style={{padding:"8px 18px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>+ Prenota</button>
                  <button onClick={()=>{setPriorityForm({...priorityForm,start:formatDate(currentDate),end:formatDate(currentDate)});setPriorityRequestModal(true);}} style={{padding:"8px 18px",background:COLORS.warning,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>⚡ Richiedi Priorità</button>
                </div>
              </div>
            )}

            {isStaff && (
              <div style={{marginTop:12,padding:12,background:"#fff",borderRadius:8,boxShadow:"0 2px 6px rgba(0,0,0,0.06)"}}>
                <b style={{fontSize:13,color:COLORS.primary}}>⚠️ Alert Parco Auto</b>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                  {cars.flatMap(c=>getCarAlerts(c).map((a,i)=>({...a,car:c.model,key:c.id+"-"+i}))).map(a=>(
                    <span key={a.key} style={{background:a.status==="expired"?COLORS.danger+"20":COLORS.warning+"20",color:a.status==="expired"?COLORS.danger:COLORS.warning,border:`1px solid ${a.status==="expired"?COLORS.danger:COLORS.warning}`,borderRadius:16,fontSize:11,padding:"3px 10px"}}>
                      {a.car}: {a.label} {a.status==="expired"?"scaduto":"in scadenza"}
                    </span>
                  ))}
                  {cars.flatMap(c=>getCarAlerts(c)).length===0 && <span style={{fontSize:13,color:COLORS.textMuted}}>Nessun alert attivo</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOOK VIEW */}
        {view==="book" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <h2 style={{margin:0,color:COLORS.primary}}>🚘 Prenota Auto</h2>
              <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                <button onClick={()=>setBookModal(true)} style={{padding:"8px 18px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:20,cursor:"pointer",fontWeight:600}}>+ Nuova Prenotazione</button>
                <button onClick={()=>setPriorityRequestModal(true)} style={{padding:"8px 18px",background:COLORS.warning,color:"#fff",border:"none",borderRadius:20,cursor:"pointer",fontWeight:600}}>⚡ Richiedi Priorità</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <h3 style={{margin:"0 0 12px",fontSize:15,color:COLORS.textMuted}}>Parco Auto</h3>
                {cars.map(c=>{
                  const alerts = getCarAlerts(c);
                  return (
                    <div key={c.id} style={{background:"#fff",borderRadius:10,padding:16,marginBottom:10,boxShadow:"0 2px 6px rgba(0,0,0,0.06)",borderLeft:`4px solid ${c.color}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1}}>
                          <b>{c.model}</b> <span style={{fontSize:12,color:COLORS.textMuted}}>• {c.plate}</span>
                          <div style={{fontSize:12,color:c.status==="active"?COLORS.success:COLORS.danger}}>{c.status==="active"?"✅ Disponibile":"🔴 Non disponibile"}</div>
                        </div>
                        {c.status==="active" && <button onClick={()=>setBookModal(true)} style={{padding:"6px 14px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:16,cursor:"pointer",fontSize:13,fontWeight:600}}>Prenota</button>}
                      </div>
                      {alerts.length>0 && <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4}}>
                        {alerts.map((a,i)=><span key={i} style={{background:COLORS.warning+"20",color:COLORS.warning,border:"1px solid "+COLORS.warning,borderRadius:12,fontSize:11,padding:"2px 8px"}}>⚠️ {a.label}</span>)}
                      </div>}
                    </div>
                  );
                })}
              </div>
              <div>
                <h3 style={{margin:"0 0 12px",fontSize:15,color:COLORS.textMuted}}>Le Mie Prenotazioni</h3>
                {bookings.filter(b=>b.user_id===currentUser.id && b.status!=="cancelled").map(b=>(
                  <div key={b.id} style={{background:"#fff",borderRadius:10,padding:14,marginBottom:8,boxShadow:"0 2px 6px rgba(0,0,0,0.06)",borderLeft:`4px solid ${b.status==="priority_request"?COLORS.warning:COLORS.success}`}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <b>{b.car_model}</b> <span style={{fontSize:11,color:COLORS.textMuted}}>{b.car_plate}</span>
                        <div style={{fontSize:12,marginTop:2}}>📅 {b.start_date?.replace("T"," ")} → {b.end_date?.replace("T"," ")}</div>
                        <div style={{fontSize:12}}>📍 {b.destination}</div>
                        {b.reason && <div style={{fontSize:11,color:COLORS.textMuted,marginTop:2}}>💬 {b.reason}</div>}
                        <div style={{fontSize:11,marginTop:2,color:b.status==="priority_request"?COLORS.warning:COLORS.success,fontWeight:600}}>
                          {b.status==="confirmed"?"✅ Confermata":"⚡ In attesa approvazione priorità"}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                        {/* ✅ Pulsante modifica per l'utente sulle proprie prenotazioni */}
                        <button onClick={()=>openEditBooking(b)} style={{padding:"4px 10px",background:COLORS.primaryLight,color:COLORS.primary,border:"1px solid "+COLORS.primary,borderRadius:6,cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}}>✏️ Modifica</button>
                        <button onClick={()=>cancelBooking(b.id)} style={{padding:"4px 10px",background:"#fee",color:COLORS.danger,border:"1px solid "+COLORS.danger,borderRadius:6,cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}}>Annulla</button>
                      </div>
                    </div>
                  </div>
                ))}
                {bookings.filter(b=>b.user_id===currentUser.id && b.status!=="cancelled").length===0 && (
                  <div style={{color:COLORS.textMuted,fontSize:14,padding:20,textAlign:"center"}}>Nessuna prenotazione attiva</div>
                )}
              </div>
            </div>

            {isStaff && (
              <div style={{marginTop:24}}>
                <h3 style={{margin:"0 0 12px",color:COLORS.primary}}>
                  📋 Tutte le Prenotazioni
                  {isAdmin && <span style={{fontSize:12,fontWeight:400,color:COLORS.textMuted,marginLeft:8}}>(Admin: puoi eliminare qualsiasi prenotazione)</span>}
                </h3>
                <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 2px 6px rgba(0,0,0,0.06)"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead style={{background:COLORS.primaryLight}}>
                      <tr>{["Auto","Utente","Inizio","Fine","Destinazione","Stato","Azioni"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:13,color:COLORS.primary,fontWeight:600}}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {bookings.filter(b=>b.status!=="cancelled").map(b=>(
                        <tr key={b.id} style={{borderTop:"1px solid #f0f0f0",background:b.status==="priority_request"?"#fffbe6":"#fff"}}>
                          <td style={{padding:"8px 12px",fontSize:13}}><span style={{display:"inline-block",width:10,height:10,borderRadius:"50%",background:getCarColor(b.car_id),marginRight:6}}></span>{b.car_model}</td>
                          <td style={{padding:"8px 12px",fontSize:13}}>{b.user_name}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>{b.start_date?.replace("T"," ")}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>{b.end_date?.replace("T"," ")}</td>
                          <td style={{padding:"8px 12px",fontSize:13}}>{b.destination}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>
                            <span style={{background:b.status==="confirmed"?COLORS.success+"20":COLORS.warning+"20",color:b.status==="confirmed"?COLORS.success:COLORS.warning,borderRadius:12,padding:"2px 8px",fontWeight:600}}>
                              {b.status==="confirmed"?"✅ Confermata":"⚡ Priorità"}
                            </span>
                          </td>
                          <td style={{padding:"8px 12px",display:"flex",gap:4,flexWrap:"wrap"}}>
                            {b.status==="priority_request" && <button onClick={()=>setApproveModal(b)} style={{padding:"3px 8px",background:COLORS.warning,color:"#fff",border:"none",borderRadius:4,cursor:"pointer",fontSize:12}}>Gestisci</button>}
                            <button onClick={()=>openEditBooking(b)} style={{padding:"3px 8px",background:COLORS.primaryLight,color:COLORS.primary,border:"1px solid "+COLORS.primary,borderRadius:4,cursor:"pointer",fontSize:12}}>✏️</button>
                            {isAdmin
                              ? <button onClick={()=>setDeleteBookingConfirm(b)} style={{padding:"3px 8px",background:COLORS.danger,color:"#fff",border:"none",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:600}}>🗑️</button>
                              : <button onClick={()=>cancelBooking(b.id)} style={{padding:"3px 8px",background:"#fee",color:COLORS.danger,border:"none",borderRadius:4,cursor:"pointer",fontSize:12}}>Annulla</button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FLEET VIEW */}
        {view==="fleet" && isStaff && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <h2 style={{margin:0,color:COLORS.primary}}>🚗 Gestione Parco Auto</h2>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <button onClick={()=>setAddCarModal(true)} style={{padding:"6px 16px",background:COLORS.success,color:"#fff",border:"none",borderRadius:20,cursor:"pointer",fontWeight:600,fontSize:13}}>➕ Aggiungi Auto</button>
                <button onClick={()=>setFleetTab("fleet")} style={{padding:"6px 14px",background:fleetTab==="fleet"?COLORS.primary:"#fff",color:fleetTab==="fleet"?"#fff":COLORS.text,border:"1px solid "+COLORS.primary,borderRadius:20,cursor:"pointer",fontWeight:600,fontSize:13}}>🚗 Auto</button>
                <button onClick={()=>setFleetTab("fleetcal")} style={{padding:"6px 14px",background:fleetTab==="fleetcal"?COLORS.primary:"#fff",color:fleetTab==="fleetcal"?"#fff":COLORS.text,border:"1px solid "+COLORS.primary,borderRadius:20,cursor:"pointer",fontWeight:600,fontSize:13}}>📅 Calendario</button>
              </div>
            </div>

            {fleetTab==="fleet" && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                {cars.map(c=>{
                  const alerts=getCarAlerts(c);
                  return (
                    <div key={c.id} style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.07)",borderTop:`4px solid ${c.color}`}}>
                      <div style={{padding:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontSize:24}}>🚗</span>
                          <div>
                            <b style={{fontSize:15}}>{c.model}</b>
                            <div style={{fontSize:12,color:COLORS.textMuted}}>{c.plate} • {(c.km||0).toLocaleString()} km</div>
                          </div>
                          <span style={{marginLeft:"auto",fontSize:12,background:c.status==="active"?COLORS.success+"20":COLORS.danger+"20",color:c.status==="active"?COLORS.success:COLORS.danger,borderRadius:12,padding:"2px 8px"}}>{c.status==="active"?"Attiva":"Non disp."}</span>
                        </div>
                        {alerts.length>0 && (
                          <div style={{marginBottom:10}}>
                            {alerts.map((a,i)=>(
                              <div key={i} style={{background:COLORS.warning+"15",border:"1px solid "+COLORS.warning,borderRadius:6,padding:"4px 8px",marginBottom:4,fontSize:12,color:COLORS.warning}}>
                                ⚠️ <b>{a.label}</b> — {a.status==="expired"?"SCADUTO":"in scadenza"}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,fontSize:12}}>
                          {[["🛡️","Assic.",c.insurance],["💶","Bollo",c.bollo],["🔍","Revisione",c.revision]].map(([ic,l,v])=>(
                            <div key={l} style={{background:COLORS.bg,borderRadius:6,padding:6,textAlign:"center"}}>
                              <div>{ic}</div>
                              <div style={{fontSize:10,color:COLORS.textMuted}}>{l}</div>
                              <div style={{fontSize:11,fontWeight:600,color:checkExpiry(v)==="expired"?COLORS.danger:checkExpiry(v)==="warning"?COLORS.warning:COLORS.text}}>{v||"N/D"}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:10}}>
                          <button onClick={()=>setEditCar({...c})} style={{flex:1,padding:"8px",background:COLORS.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>✏️ Modifica</button>
                          <button onClick={()=>setDeleteConfirm(c)} style={{padding:"8px 12px",background:"#fee",color:COLORS.danger,border:"1px solid "+COLORS.danger,borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {fleetTab==="fleetcal" && (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                  <label style={{fontSize:13,fontWeight:600}}>Filtra per auto:</label>
                  <select value={fleetCalCar} onChange={e=>setFleetCalCar(e.target.value)} style={{...inputStyle,width:"auto"}}>
                    <option value="all">Tutte le auto</option>
                    {cars.map(c=><option key={c.id} value={c.id}>{c.model} ({c.plate})</option>)}
                  </select>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    <button onClick={()=>setCurrentDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n;})} style={navBtnStyle}>‹</button>
                    <button onClick={()=>setCurrentDate(new Date())} style={navBtnStyle}>Oggi</button>
                    <button onClick={()=>setCurrentDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n;})} style={navBtnStyle}>›</button>
                  </div>
                </div>
                <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
                  <div style={{background:COLORS.primaryDark,padding:"10px 16px",color:"#fff",fontWeight:700}}>
                    {currentDate.toLocaleDateString("it-IT",{month:"long",year:"numeric"})}
                  </div>
                  <div style={{background:COLORS.primaryDark,display:"grid",gridTemplateColumns:"repeat(7,1fr)",textAlign:"center"}}>
                    {WEEKDAYS.map(d=><div key={d} style={{color:"rgba(255,255,255,0.8)",fontWeight:600,fontSize:12,padding:"6px 0"}}>{d}</div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {getMonthDays(currentDate).map((d,i)=>{
                      const ds = d ? formatDate(d) : null;
                      const dayBs = ds ? bookingsForDate(ds, fleetCalCar) : [];
                      const carAlerts = [];
                      if(ds && fleetCalCar!=="all") {
                        const car = cars.find(c=>c.id===parseInt(fleetCalCar));
                        if(car) {
                          [["insurance","Assicurazione"],["bollo","Bollo"],["revision","Revisione"]].forEach(([k,l])=>{ if(car[k]===ds) carAlerts.push(l); });
                          [["oil_date","Olio"],["tires_date","Gomme"],["service_date","Tagliando"]].forEach(([k,l])=>{ if(car[k]===ds) carAlerts.push(l); });
                        }
                      }
                      return (
                        <div key={i} style={{minHeight:85,borderRight:"1px solid #f0f0f0",borderBottom:"1px solid #f0f0f0",padding:4,background:"#fff"}}>
                          {d && <div style={{fontSize:12,fontWeight:500,marginBottom:2}}>{d.getDate()}</div>}
                          {carAlerts.map((a,ai)=><div key={ai} style={{background:COLORS.warning+"20",color:COLORS.warning,borderRadius:3,fontSize:10,padding:"1px 4px",marginBottom:1}}>🔔 {a}</div>)}
                          {dayBs.map(b=>(
                            <div key={b.id} style={{background:getCarColor(b.car_id),color:"#fff",borderRadius:3,fontSize:10,padding:"1px 4px",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                              {b.car_model} - {b.user_name}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
