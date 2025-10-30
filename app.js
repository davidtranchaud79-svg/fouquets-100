const CONFIG = {
  API_URL: "PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE"
};

function app(){
  return {
    lang: localStorage.getItem("lang") || (navigator.language||"fr").substring(0,2),
    online: navigator.onLine,
    deferredPrompt: null,
    pertesMois: 0, poidsPertes: 0, valeurStock: 0, nbProduits: 0, nbRecettes: 0, derniereProduction: "-",
    pertesProduits: [],
    loss: { produit:"", qte:null, unite:"", prix_u:null, motif:"", zone:"" }, lossMsg:"",
    inv: { zone:"", produit:"", unite:"", qte_reelle:null, type_action:"CONTROLE", commentaire:"" }, invMsg:"",
    zoneMensuelle:"", invMonMsg:"",
    recettes: [], recettesFiltrees: [], recetteActive: null, recipeQuery:"", prodPortions: 1,
    voiceListening:false, lastVoice:"",
    async init(){
      if(!["fr","en","it","es"].includes(this.lang)) this.lang="fr";
      window.addEventListener('online', ()=>{ this.online = true; this.syncPending(); });
      window.addEventListener('offline', ()=>{ this.online = false; });
      window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); this.deferredPrompt = e; });
      await this.loadDashboard(); await this.loadPertesProduits();
      await this.loadRecettes();
      await chefAI.init(this); await this.syncPending();
    },
    t(key){ return (LANG[this.lang] && LANG[this.lang][key]) || key; },
    saveLang(){ localStorage.setItem("lang", this.lang); chefAI.updateLang(this); },
    formatCurrency(v){ return new Intl.NumberFormat(this.lang+"-"+this.lang.toUpperCase(),{style:'currency',currency:'EUR'}).format(v||0); },
    async loadDashboard(){ try{ const res=await fetch(`${CONFIG.API_URL}?action=getDashboardData`); const d=await res.json(); Object.assign(this,d); }catch(e){} },
    async loadPertesProduits(){ try{ const r=await fetch(`${CONFIG.API_URL}?action=getPertesProduits`); const d=await r.json(); this.pertesProduits=d.pertesData||[]; }catch(e){} },
    async submitLoss(){
      const payload = { action:"addLoss", record:this.loss };
      try{ const r=await fetch(CONFIG.API_URL,{method:"POST",body:JSON.stringify(payload)}); const d=await r.json(); this.lossMsg=d.message||this.t('save'); this.loss={produit:"",qte:null,unite:"",prix_u:null,motif:"",zone:""}; this.loadDashboard(); this.loadPertesProduits();
      }catch(e){ this.lossMsg=this.t('offline')+" – "+this.t('save'); await saveOffline("losses", payload); }
    },
    async submitInvJ(){
      const payload = { action:"inventaireJournalier", ligne:this.inv };
      try{ const r=await fetch(CONFIG.API_URL,{method:"POST",body:JSON.stringify(payload)}); const d=await r.json(); this.invMsg=d.message||this.t('save'); this.inv={zone:"",produit:"",unite:"",qte_reelle:null,type_action:"CONTROLE",commentaire:""}; this.loadDashboard();
      }catch(e){ this.invMsg=this.t('offline')+" – "+this.t('save'); await saveOffline("invj", payload); }
    },
    async ensureMonthlyInventory(){
      const payload = { action:"ensureInventaireMois", zone: this.zoneMensuelle };
      try{ const r=await fetch(CONFIG.API_URL,{method:"POST",body:JSON.stringify(payload)}); const d=await r.json(); this.invMonMsg=d.message||"OK";
      }catch(e){ this.invMonMsg=this.t('offline'); await saveOffline("invmon", payload); }
    },
    async loadRecettes(){ try{ const r=await fetch(`${CONFIG.API_URL}?action=getRecettesIndex`); const d=await r.json(); this.recettes=d.items||[]; this.recettesFiltrees=this.recettes; }catch(e){} },
    filterRecettes(){ const q=(this.recipeQuery||"").toLowerCase(); this.recettesFiltrees=this.recettes.filter(r=> (this.localizedName(r)||"").toLowerCase().includes(q)); },
    localizedName(r){ return r[`recette_nom_${this.lang}`] || r.recette_nom_fr || r.recette_nom_en || r.recette_nom_it || r.recette_nom_es || r.code; },
    async openRecette(code){ const r=await fetch(`${CONFIG.API_URL}?action=getRecetteDetails&code=${encodeURIComponent(code)}`); this.recetteActive=await r.json(); this.prodPortions=this.recetteActive.portions_base||1; },
    async produireRecette(code, portions){
      const payload = { action:"produireRecette", code, portions };
      try{ const r=await fetch(CONFIG.API_URL,{method:"POST",body:JSON.stringify(payload)}); const d=await r.json(); alert(d.message||"OK"); this.loadDashboard();
      }catch(e){ alert(this.t('offline')); await saveOffline("produce", payload); }
    },
    async syncPending(){ try{ await syncOffline(CONFIG.API_URL); }catch(e){} },
    async installPWA(){ if(this.deferredPrompt){ this.deferredPrompt.prompt(); const choice=await this.deferredPrompt.userChoice; if(choice.outcome==='accepted'){ this.deferredPrompt=null; } } },
    toggleVoice(){ chefAI.toggle(this); }
  }
}

/* Offline queue (IndexedDB) */
const DB_NAME="fsuite_offline", STORE="queue";
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{autoIncrement:true}); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function saveOffline(kind, payload){ const db=await idb(); const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).add({kind,payload,ts:Date.now()}); await new Promise(r=>tx.oncomplete=r); }
async function syncOffline(api){
  const db=await idb(); const tx=db.transaction(STORE,"readwrite"); const store=tx.objectStore(STORE);
  const items=[]; const req=store.openCursor();
  await new Promise(res=>{ req.onsuccess=e=>{ const cur=e.target.result; if(cur){ items.push({k:cur.key,v:cur.value}); cur.continue(); } else res(); }; });
  for(const it of items){ try{ await fetch(api,{method:"POST",body:JSON.stringify(it.v.payload)}); store.delete(it.k); }catch(e){} }
  await new Promise(r=>tx.oncomplete=r);
}
