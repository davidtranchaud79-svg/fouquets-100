const chefAI = {
  listening:false, rec:null, ctx:null,
  async init(ctx){
    this.ctx=ctx;
    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){ ctx.lastVoice="Vocal non supporté."; return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR(); this.updateLang(ctx);
    this.rec.continuous=false; this.rec.interimResults=false;
    this.rec.onresult = async (e)=>{
      const text = e.results[0][0].transcript; ctx.lastVoice = "• " + text;
      await this.route(text, ctx);
    };
    this.rec.onend = ()=>{ ctx.voiceListening=false; };
  },
  updateLang(ctx){
    if(!this.rec) return;
    this.rec.lang = ctx.lang==="it"?"it-IT":ctx.lang==="es"?"es-ES":ctx.lang==="en"?"en-GB":"fr-FR";
  },
  toggle(ctx){
    if(!this.rec){ ctx.lastVoice="Vocal non supporté."; return; }
    if(this.listening){ this.rec.stop(); ctx.voiceListening=false; this.listening=false; }
    else { this.updateLang(ctx); this.rec.start(); ctx.voiceListening=true; this.listening=true; }
  },
  async route(text, ctx){
    const t = text.toLowerCase();
    // add: generic patterns per language (very basic)
    const patterns = [
      /ajout\w*\s+([\d\.,]+)\s*(kg|l|pi(?:èces|cs)?)?\s+de\s+(.+?)\s+(en|au|dans)\s+(\w+)/, // fr
      /add\s+([\d\.,]+)\s*(kg|l|pcs)?\s+of\s+(.+?)\s+(in|to)\s+(\w+)/,                      // en
      /aggiung\w*\s+([\d\.,]+)\s*(kg|l|pz|pcs)?\s+di\s+(.+?)\s+(in|a)\s+(\w+)/,            // it
      /añad\w*\s+([\d\.,]+)\s*(kg|l|uds|pcs)?\s+de\s+(.+?)\s+(en|a)\s+(\w+)/               // es
    ];
    const removePatterns = [
      /retir\w*\s+([\d\.,]+)\s*(kg|l|pi(?:èces|cs)?)?\s+de\s+(.+?)\s+(en|au|dans)\s+(\w+)/, // fr
      /remov\w*\s+([\d\.,]+)\s*(kg|l|pcs)?\s+of\s+(.+?)\s+(in|from)\s+(\w+)/,               // en
      /rimuo\w*\s+([\d\.,]+)\s*(kg|l|pz|pcs)?\s+di\s+(.+?)\s+(in|da)\s+(\w+)/,              // it
      /retir\w*\s+([\d\.,]+)\s*(kg|l|uds|pcs)?\s+de\s+(.+?)\s+(en|de)\s+(\w+)/              // es
    ];
    let m=null;
    for(const re of patterns){ m = t.match(re); if(m) break; }
    if(m){
      const q = parseFloat(m[1].replace(",", ".")); const u = m[2]||"pcs"; const prod = m[3]; const zone=(m[5]||"").toUpperCase();
      ctx.inv = { zone, produit: prod, unite: u, qte_reelle: q, type_action:"ENTREE", commentaire:"via voix" };
      await ctx.submitInvJ(); return;
    }
    for(const re of removePatterns){ m = t.match(re); if(m) break; }
    if(m){
      const q = parseFloat(m[1].replace(",", ".")); const u = m[2]||"pcs"; const prod = m[3]; const zone=(m[5]||"").toUpperCase();
      ctx.inv = { zone, produit: prod, unite: u, qte_reelle: q, type_action:"SORTIE", commentaire:"via voix" };
      await ctx.submitInvJ(); return;
    }
    if(/perd(u|ido|ido|to)/.test(t)){ // quick loss fallback multilingual-ish
      const m2 = t.match(/([\d\.,]+)\s*(kg|l|pcs|pièces|pz|uds)?\s+de\s+(.+?)\s+(en|au|dans|in|to|a)\s+(\w+)/);
      if(m2){
        const q = parseFloat(m2[1].replace(",", ".")); const u=m2[2]||"pcs"; const prod=m2[3]; const zone=(m2[5]||"").toUpperCase();
        ctx.loss = { produit: prod, qte: q, unite: u, prix_u: null, motif: "voix", zone };
        await ctx.submitLoss(); return;
      }
    }
  }
};