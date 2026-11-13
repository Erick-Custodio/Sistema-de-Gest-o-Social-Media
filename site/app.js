"use strict";
/* ---------- constantes ---------- */
const STATUSES=[
  {k:"desenvolvimento",l:"Desenvolvimento",c:"var(--s1)"},
  {k:"analise",l:"Análise (Roteiro)",c:"var(--s2)"},
  {k:"producao",l:"Em Produção",c:"var(--s3)"},
  {k:"produzido",l:"Conteúdo Produzido",c:"var(--s4)"},
  {k:"edicao",l:"Edição",c:"var(--s5)"},
  {k:"aprovacao",l:"Aprovação Final",c:"var(--s6)"},
  {k:"postagem",l:"Postagem",c:"var(--s7)"}
];
const ST=Object.fromEntries(STATUSES.map((s,i)=>[s.k,{...s,i}]));
const FORMATS=["Reels","Carrossel","Post estático","Stories","TikTok","YouTube"];
const COLORS=["#8E1538","#C2667F","#B8893A","#6B4FA0","#A8306A","#2E8B6A","#B5522E","#5B6B8C"];
const COLS=["clients","posts","tasks","approvals","taskdone","actions","leads","fin"];
const LSTAGES=[
  {k:"novo",l:"Novo lead",c:"var(--s1)"},
  {k:"contato",l:"Primeiro contato",c:"var(--s2)"},
  {k:"reuniao",l:"Reunião",c:"var(--s5)"},
  {k:"proposta",l:"Proposta enviada",c:"var(--s3)"},
  {k:"negociacao",l:"Negociação",c:"var(--s4)"},
  {k:"fechado",l:"Fechado",c:"var(--ok)"},
  {k:"perdido",l:"Perdido",c:"var(--warn)"}
];
const LS=Object.fromEntries(LSTAGES.map((x,i)=>[x.k,{...x,i}]));
const ACTIVE=["novo","contato","reuniao","proposta","negociacao"];
const ORIGENS=["Indicação","Instagram","WhatsApp","Google","Site","Evento","Outro"];
const CANAIS=["WhatsApp","Ligação","Reunião","E-mail","Instagram","Presencial"];
const PERMS=[
  {k:"verAgenda",l:"Ver agenda e calendário",d:"Gravações, publicações e tarefas por dia, mês e semana."},
  {k:"verAndamento",l:"Ver andamento dos conteúdos",d:"Em qual das 7 etapas cada conteúdo está."},
  {k:"concluir",l:"Marcar \"Ação concluída\"",d:"Avançar o conteúdo para a próxima etapa."},
  {k:"aprovar",l:"Aprovar ou pedir ajuste",d:"Decidir na Aprovação Final se pode postar."},
  {k:"verMidias",l:"Ver fotos e vídeos",d:"Arquivos anexados para aprovação."},
  {k:"verLegenda",l:"Ver legenda e roteiro",d:"Texto do post e orientações do conteúdo."},
  {k:"tarefas",l:"Ver e marcar tarefas",d:"Tarefas que você passa para o cliente."},
  {k:"faturas",l:"Ver faturas e pagamentos",d:"Faturas pagas e a vencer, com aviso perto do vencimento."}
];
const ALLP=Object.fromEntries(PERMS.map(p=>[p.k,true]));
let CUR=null;
function permsOf(cid){const c=D.clients[cid];return {...ALLP,...((c&&c.perms)||{})}}
function can(k){return !CUR||CUR[k]!==false}
const LEGACY={gravado:"produzido",preparacao:"edicao",autorizacao:"aprovacao"};
const APV="aprovacao";
const MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

/* ---------- estado ---------- */
const R={clients:{},posts:{},tasks:{},approvals:{},taskdone:{},actions:{},leads:{},fin:{}};
const D={...R};
const FROMCLIENT={};
/* status efetivo: o que o cliente concluiu vale até a social media editar o card de novo */
function derive(){
  for(const k of COLS)if(k!=="posts")D[k]=R[k];
  const out={};for(const k in FROMCLIENT)delete FROMCLIENT[k];
  for(const[id,p]of Object.entries(R.posts)){
    let st=LEGACY[p.status]||p.status;if(!ST[st])st="desenvolvimento";
    const a=R.actions[id];
    if(a&&ST[a.status]&&(a.at||0)>(p.updatedAt||p.createdAt||0)){st=a.status;FROMCLIENT[id]=a}
    out[id]={...p,status:st};
  }
  D.posts=out;
}
function nextStatus(k){const i=ST[k]?ST[k].i:-1;return STATUSES[i+1]||null}
function rawPost(p){const o={...p};return o}
const UI={lq:"",view:"painel",kClient:"all",calClient:"all",calMode:"mes",calAnchor:null,kMode:"todos",kAnchor:null,selDay:null,preview:null,ctab:"agenda",readOnly:false};
/* sb: cliente Supabase · PROFILE: perfil de quem entrou · AUTHV: tela de login/troca de senha/bloqueio · USERS: acessos (só a administradora vê) */
let sb=null,PROFILE=null,me=null,isOwner=false,demo=false,booted=false,stale=false,AUTHV=null,CLIENT_ID=null,USERS={},chans=[];
let MEDIA=[],MEDIA_NEW=[],MEDIA_DROP=[];
const loaded=new Set();
const BUCKET="media";

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function pad(n){return String(n).padStart(2,"0")}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parse(s){if(!s)return null;const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function short(s){const d=parse(s);return d?pad(d.getDate())+"/"+pad(d.getMonth()+1):""}
function longDay(s){const d=parse(s);return d?DIAS[d.getDay()]+", "+d.getDate()+" de "+MESES[d.getMonth()]:""}
function newId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
const TODAY=ymd(new Date());
UI.calAnchor=TODAY;UI.kAnchor=TODAY;UI.selDay=TODAY;
let tt;function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>t.classList.remove("on"),3200)}
function clientsSorted(){return Object.entries(D.clients).sort((a,b)=>(a[1].name||"").localeCompare(b[1].name||"","pt-BR"))}
function cColor(cid){return (D.clients[cid]&&D.clients[cid].color)||"#888"}
function cName(cid){return (D.clients[cid]&&D.clients[cid].name)||"Cliente removido"}
function approvalOf(pid){return D.approvals[pid]||null}
function initials(n){return (n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")}

/* ---------- gravação ---------- */
function handleErr(e){
  const code=e&&e.code;
  if(code==="42501"||/row-level security/i.test((e&&e.message)||"")){toast("Você não tem permissão para fazer isso. Fale com sua social media.");}
  else if(e&&/jwt|session/i.test(e.message||"")){toast("Sua sessão expirou. Entre de novo.");logout()}
  else toast("Não foi possível salvar agora. Tente de novo em instantes.");
  scheduleRender();
}
/* empresa dona do registro: usada pelas regras de acesso do banco */
function ownerOf(col,id,data){
  if(col==="clients")return id;
  if(col==="posts"||col==="tasks")return data.clientId||null;
  if(col==="approvals"||col==="actions"){const p=R.posts[id];return p?p.clientId:null}
  if(col==="taskdone"){const t=R.tasks[id];return t?t.clientId:null}
  /* só entradas (faturas) ficam ligadas à empresa — despesas nunca chegam ao cliente */
  if(col==="fin")return data.kind==="receita"&&data.clientId?data.clientId:null;
  return null;
}
function applyLocal(col,id,data){if(data===null){const c={...R[col]};delete c[id];R[col]=c}else R[col]={...R[col],[id]:data};derive();scheduleRender()}
async function put(col,id,data){
  if(demo){applyLocal(col,id,{...data});return true}
  const {error}=await sb.from("docs").upsert({col,id,client_id:ownerOf(col,id,data),data,updated_at:new Date().toISOString()});
  if(error){handleErr(error);return false}
  applyLocal(col,id,data);return true;
}
async function del(col,id){
  if(demo){applyLocal(col,id,null);return true}
  const {error}=await sb.from("docs").delete().eq("col",col).eq("id",id);
  if(error){handleErr(error);return false}
  applyLocal(col,id,null);return true;
}

/* ---------- dados de exemplo ---------- */
function seed(){
  const t=new Date(),d=n=>ymd(addDays(t,n));
  const c={
    cA:{name:"Padaria Trigo Bom",segment:"Alimentação",instagram:"@trigobom",contact:"Marta · (11) 98888-1020",color:COLORS[3],fee:1200,dueDay:10,notes:"Posts de manhã cedo. Foco em fornadas do dia."},
    cB:{name:"Clínica Sorriso Leve",segment:"Odontologia",instagram:"@sorrisoleve",contact:"Dr. Paulo · (11) 97777-3344",color:COLORS[1],fee:1800,dueDay:5,notes:"Evitar antes/depois sem autorização do paciente."},
    cC:{name:"Studio Movimento",segment:"Academia / Pilates",instagram:"@studiomovimento",contact:"Carla · (11) 96666-5566",color:COLORS[2],fee:900,dueDay:15,notes:"Tom leve e motivacional."}
  };
  const P=(clientId,title,format,status,recordDate,postDate,clientAction,brief,caption)=>({clientId,title,format,status,recordDate,postDate,clientAction,brief,caption,internal:"",link:"",posted:false,createdAt:Date.now()});
  const p={
    p1:P("cA","Fornada das 6h em câmera lenta","Reels","producao",d(2),d(5),"Separar a fornada de pão francês das 6h e deixar a bancada limpa.","Abrir com o forno abrindo, close no pão estalando.",""),
    p2:P("cA","3 tipos de pão para o café","Carrossel","postagem","",d(3),"","Fotos já enviadas pela Marta.","Qual é o seu favorito? 🥖 Conta aqui embaixo!"),
    p3:P("cA","Bastidores: quem faz o pão","Reels","aprovacao",d(-4),d(1),"","Entrevista curta com o padeiro Zé.","Conheça o Zé, que acorda às 3h pra sua manhã começar bem."),
    p4:P("cB","Mito ou verdade: clareamento","Reels","produzido",d(-1),d(4),"","Dr. Paulo responde 3 mitos.",""),
    p5:P("cB","Dicas de escovação para crianças","Carrossel","analise","",d(9),"Enviar 3 fotos do consultório infantil.","",""),
    p6:P("cB","Depoimento de paciente","Reels","aprovacao",d(-6),d(2),"","Paciente Joana autorizou uso de imagem.","Ver você sorrir de novo é o que nos move. 💙"),
    p7:P("cC","Aula experimental de pilates","Reels","producao",d(1),d(6),"Gravar 1 minuto da aula das 19h com 2 alunas que autorizaram.","Plano aberto e depois detalhes do aparelho.",""),
    p8:P("cC","Desafio 7 dias de alongamento","Stories","edicao","",d(7),"","Sequência de 7 stories.",""),
    p9:P("cC","Promoção de fim de ano","Post estático","desenvolvimento","",d(14),"Confirmar o valor da promoção até sexta.","","")
  };
  const T=(clientId,date,title,details)=>({clientId,date,title,details,createdAt:Date.now()});
  const tk={
    t1:T("cA",d(1),"Enviar fotos da nova vitrine","Mandar no WhatsApp ou na pasta do Drive."),
    t2:T("cB",d(3),"Aprovar roteiro dos mitos","Ler e responder no WhatsApp."),
    t3:T("cC",d(4),"Separar figurino para gravação","Roupa lisa, sem estampa."),
    t4:T("cA",d(8),"Reunião mensal de pauta","Chamada de 30 min às 10h.")
  };
  const L=(name,company,phone,origin,service,value,stage,next,notes,hist,extra)=>({name,company,phone,email:"",instagram:"",origin,service,value,stage,nextFollowUp:next,notes,lostReason:"",followups:hist,createdAt:Date.now()-864e5*10,...(extra||{})});
  const H=(n,channel,text)=>({date:d(n),channel,text});
  const ld={
    l1:L("Renata Alves","Boutique Flor de Lis","11991234567","Instagram","Gestão de Instagram",1200,"proposta",d(-1),"Quer começar em dezembro.",[H(-6,"WhatsApp","Primeiro contato, pediu valores."),H(-3,"Reunião","Apresentei a proposta de 12 posts/mês.")]),
    l2:L("Marcos Pinheiro","Auto Center Pinheiro","11987654321","Indicação","Reels + tráfego pago",1800,"negociacao",d(0),"Indicação da Marta (padaria).",[H(-8,"Ligação","Conversa inicial."),H(-2,"WhatsApp","Pediu desconto no 1º mês.")]),
    l3:L("Juliana Costa","Doce Ju Confeitaria","11976543210","Instagram","Gestão de Instagram",900,"contato",d(2),"",[H(-1,"Instagram","Respondeu o direct.")]),
    l4:L("Fernando Lima","Lima Advocacia","11965432109","Google","Conteúdo LinkedIn + Instagram",1500,"novo",d(1),"Preencheu o formulário do site.",[]),
    l5:L("Patrícia Rocha","Pet Shop Patas","11954321098","Indicação","Gestão de Instagram",1100,"fechado","","",[H(-5,"Reunião","Fechou o plano mensal.")],{closedAt:Date.now()-864e5*2}),
    l6:L("Ricardo Souza","Barbearia Navalha","11943210987","Evento","Reels",800,"perdido","","",[H(-9,"WhatsApp","Achou o valor alto.")],{lostReason:"Preço"})
  };
  /* financeiro de exemplo: mensalidades, anúncios e contas dos últimos meses */
  const ym=TODAY.slice(0,7),fin={};
  const F=(kind,category,description,amount,due,paid,extra)=>({kind,category,description,amount,due,paid,paidDate:paid?due:"",clientId:"",platform:"",notes:"",createdAt:Date.now(),...(extra||{})});
  for(let k=0;k<6;k++){
    const m=ymAdd(ym,-k);
    for(const cid of ["cA","cB","cC"]){if(cid==="cC"&&k>3)continue;const due=dueIn(m,c[cid].dueDay);
      fin["m-"+cid+"-"+m]=F("receita","Mensalidade de cliente","Mensalidade · "+c[cid].name,c[cid].fee,due,k>0?!(k===1&&cid==="cC"):due<TODAY,{clientId:cid})}
    if(k>0){fin["ad1"+k]=F("despesa",ADCAT,"Campanha mensal Padaria",280+k*15,dueIn(m,12),true,{clientId:"cA",platform:"Meta Ads (Instagram/Facebook)"});
      fin["ad2"+k]=F("despesa",ADCAT,"Campanha Clínica",450+k*20,dueIn(m,18),true,{clientId:"cB",platform:"Google Ads"});
      fin["tl"+k]=F("despesa","Ferramentas e assinaturas","Canva Pro",35,dueIn(m,8),true);
      fin["tx"+k]=F("despesa","Impostos e taxas","DAS MEI",76,dueIn(m,20),true)}
  }
  Object.assign(fin,{
    x1:F("receita","Serviço avulso","Ensaio de fotos da vitrine",450,d(6),false,{clientId:"cA"}),
    x2:F("despesa",ADCAT,"Impulsionar Reels da fornada",300,d(-3),true,{clientId:"cA",platform:"Meta Ads (Instagram/Facebook)"}),
    x3:F("despesa",ADCAT,"Campanha Clínica — pesquisa",500,d(-8),true,{clientId:"cB",platform:"Google Ads"}),
    x4:F("despesa",ADCAT,"Teste de anúncio no TikTok",200,d(4),false,{clientId:"cC",platform:"TikTok Ads"}),
    x5:F("despesa","Ferramentas e assinaturas","Canva Pro",35,d(2),false),
    x6:F("despesa","Equipe / freelancers","Editor de vídeo (freela)",600,d(-1),false),
    x7:F("despesa","Impostos e taxas","DAS MEI",76,dueIn(ym,20),false)
  });
  return {fin,leads:ld,clients:c,posts:p,tasks:tk,approvals:{p6:{decision:"ajuste",comment:"Trocar a música por algo mais calmo.",by:"",at:Date.now()}}};
}
async function loadSeed(){
  const s=seed();
  for(const col of ["clients","posts","tasks","approvals"]) for(const [id,v] of Object.entries(s[col])) { if(!(await put(col,id,v))) return; }
  toast("Exemplo carregado. Edite ou apague à vontade.");
}

/* ---------- render ---------- */
let rq=false;function scheduleRender(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render()})}
function role(){
  if(AUTHV)return AUTHV;
  if(!booted)return "loading";
  if(demo||isOwner)return UI.preview?"preview":"admin";
  if(CLIENT_ID&&D.clients[CLIENT_ID])return "client";
  if(loaded.has("clients"))return "pending";
  return "loading";
}
/* ----- menu sanduíche (telas pequenas): barra no topo com o botão que abre o menu lateral ----- */
function mobileBar(title,alerts){
  return `<header class="mbar"><button class="hamb" data-act="menu-toggle" aria-controls="side-menu" aria-expanded="${!!UI.menuOpen}" aria-label="${UI.menuOpen?"Fechar menu":"Abrir menu"}"><i></i><i></i><i></i>${alerts?`<em class="dot">${alerts>9?"9+":alerts}</em>`:""}</button>
    <div class="logo" aria-hidden="true"></div><span class="mtitle">${esc(title)}</span></header>
  <div class="side-scrim" data-act="menu-close" aria-hidden="true"></div>`;
}
function setMenu(open){
  UI.menuOpen=open;const sh=$(".shell");if(!sh)return;
  sh.classList.toggle("menu-open",open);
  const b=sh.querySelector(".hamb");if(b){b.setAttribute("aria-expanded",open);b.setAttribute("aria-label",open?"Fechar menu":"Abrir menu")}
  if(open){const f=sh.querySelector('.side .nav button[aria-current="true"]')||sh.querySelector(".side .nav button");if(f)setTimeout(()=>f.focus(),60)}
  else if(b&&matchMedia("(max-width:760px)").matches)b.focus();
}
/* ----- modo claro / escuro ----- */
function themeBtn(cls){return `<button type="button" class="btn ${cls||""} theme-btn" data-act="theme" aria-label="Alternar modo claro ou escuro"><span class="t-dark">☀ Modo claro</span><span class="t-light">☾ Modo escuro</span></button>`}
function toggleTheme(){
  const light=document.documentElement.dataset.theme!=="light";
  if(light)document.documentElement.dataset.theme="light";else delete document.documentElement.dataset.theme;
  try{localStorage.setItem("cc-theme",light?"light":"dark")}catch(e){}
}
function render(){
  CUR=null;
  const r=role(),app=$("#app");
  const fab=$("#theme-fab");if(fab)fab.hidden=r==="admin"||r==="client"||r==="preview"||(r==="login"&&!UI.loginOpen);
  if(r==="login"){if(!$(UI.loginOpen?"#login-form":".landing"))app.innerHTML=loginView();return}
  if(r==="changepw"||r==="mypw"){if(!$("#pw-form"))app.innerHTML=changePwView(r==="changepw");return}
  if(r==="blocked"){app.innerHTML=blockedView();return}
  if(r==="loading"){app.innerHTML=`<div class="center"><div class="card"><h2>Carregando…</h2><p class="muted">Buscando os dados do sistema.</p></div></div>`;return}
  if(r==="pending"){app.innerHTML=pendingView();return}
  if(r==="client"){app.innerHTML=portalView(CLIENT_ID,false);if(can("faturas"))maybeInvoicePopup(CLIENT_ID);return}
  if(r==="preview"){if(!D.clients[UI.preview]){UI.preview=null;return render()}app.innerHTML=portalView(UI.preview,true);return}
  const af=$("#acc-form"),keep=af?{clientId:af.elements.clientId.value,name:af.elements.name.value,email:af.elements.email.value}:null;
  app.innerHTML=adminView();
  const nf=$("#acc-form");if(nf&&keep){for(const k in keep)if(nf.elements[k]&&(k!=="clientId"||D.clients[keep[k]]))nf.elements[k].value=keep[k]}
}

function pendingView(){
  return `<div class="center"><div class="card"><div class="logo" style="margin:0 auto 14px" aria-hidden="true"></div>
  <h2>Sua área ainda não está pronta</h2>
  <p class="muted">Seu login funciona, mas ainda não há uma empresa ligada a ele. Fale com a sua social media.</p>
  ${stale?`<p class="small muted">Não foi possível confirmar os dados agora. Recarregue mais tarde.</p>`:""}
  <button class="btn" data-act="logout">Sair</button></div></div>`;
}

/* ----- login e senha ----- */
/* regra da senha: 8+ caracteres, com maiúscula, minúscula, número e caractere especial */
const PWRULES=[
  {k:"len",l:"Pelo menos 8 caracteres",t:s=>s.length>=8},
  {k:"up",l:"Uma letra maiúscula",t:s=>/[A-Z]/.test(s)},
  {k:"low",l:"Uma letra minúscula",t:s=>/[a-z]/.test(s)},
  {k:"num",l:"Um número",t:s=>/[0-9]/.test(s)},
  {k:"sym",l:"Um caractere especial (ex.: ! @ # $ %)",t:s=>/[^A-Za-z0-9]/.test(s)}
];
function pwOk(s){return PWRULES.every(r=>r.t(s))}
/* entrada: primeiro só a arte da Avélis com o botão "Entrar"; ao clicar, abre o formulário em fundo vinho */
const LANDING_FEATURES=[
  ["M4 6h16M7 12h10M10 18h4","CRM de prospecção","Leads, propostas e follow-ups em um funil visual, do primeiro contato ao contrato fechado."],
  ["M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8","Gestão de clientes","Cadastro completo, permissões sob medida e uma área exclusiva para cada cliente."],
  ["M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v7h-4z","Projetos e conteúdos","Kanban com as etapas de produção, do roteiro à postagem, sempre à vista."],
  ["M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2","Campanhas e tarefas","Gravações, publicações e tarefas organizadas por dia, semana e mês."],
  ["M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6","Financeiro","Entradas, custos com anúncios, contas a pagar e a receber em um só relatório."],
  ["M3 3v18h18M7 15l4-4 3 3 6-6","Resultados","Indicadores de produção, taxa de fechamento e resultado do mês para decidir com clareza."],
  ["M20 6 9 17l-5-5","Aprovação do cliente","O cliente acompanha cada etapa, aprova ou pede ajustes e vê as próprias faturas."],
  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10","Acesso seguro","Login próprio para cada cliente, que enxerga apenas o que é dele. Bloqueio com um clique."]
];
function landingView(){
  const ico=d=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<div class="landing">
  <button class="btn primary landing-btn" data-act="open-login">Entrar</button>
  <section class="hero" role="img" aria-label="Avélis — Creative Management Platform. Sua criatividade merece uma gestão à altura.">
    <button class="scroll-cue" data-act="landing-more">Conheça a plataforma<span aria-hidden="true">⌄</span></button></section>
  <section class="about" id="sobre">
    <div class="about-in">
      <span class="eyebrow">Sobre a Avélis</span>
      <h2 class="about-title">Uma nova maneira de administrar e desenvolver o dia a dia de profissionais e agências de marketing.</h2>
      <p class="about-lead">A Avélis é uma plataforma que centraliza desde os possíveis clientes, com CRM incluso, até o gerenciamento de clientes, projetos, campanhas, tarefas, financeiro e resultados — ajudando todos os profissionais da área a crescerem com <b>organização</b> e <b>inteligência</b>.</p>
      <p class="about-lead">Além disso, facilita todo o monitoramento, o acesso e a aprovação do cliente, em um ambiente exclusivo e seguro.</p>
      <div class="feat-grid">${LANDING_FEATURES.map(([d,t,x])=>`<div class="feat"><span class="feat-ico">${ico(d)}</span><h3>${t}</h3><p>${x}</p></div>`).join("")}</div>
      <div class="about-cta"><p>Sua criatividade merece uma gestão à altura.</p><button class="btn primary" data-act="open-login">Acessar a plataforma</button></div>
    </div>
  </section>
  <footer class="landing-foot">© ${new Date().getFullYear()} Avélis · Creative Management Platform</footer></div>`;
}
function loginView(){
  if(!UI.loginOpen)return landingView();
  return `<div class="center login-page"><button class="btn ghost login-back" data-act="close-login">‹ Voltar</button><form class="card" id="login-form" style="display:grid;gap:14px;text-align:left;width:100%" novalidate>
  <div class="logo lg" style="margin:0 auto" aria-hidden="true"></div>
  <div style="text-align:center"><h2>Acesse a Avélis</h2><p class="muted small" style="margin:4px 0 0">Entre com o e-mail e a senha que você recebeu.</p></div>
  <label class="fl">E-mail<input class="inp" type="email" name="email" autocomplete="username" required></label>
  <label class="fl">Senha<input class="inp" type="password" name="password" id="login-pw" autocomplete="current-password" required></label>
  <label class="showpw small"><input type="checkbox" data-act="show-pw" aria-controls="login-pw"> Mostrar senha</label>
  <div id="login-msg" class="small st-warn" role="alert"></div>
  <button class="btn primary" type="submit" style="justify-self:center;justify-content:center;min-width:180px">Entrar</button>
  <p class="small muted" style="margin:0;text-align:center">Esqueceu a senha? Fale com a sua social media para ela gerar uma nova.</p>
  </form></div>`;
}
function changePwView(first){
  return `<div class="center"><form class="card" id="pw-form" style="display:grid;gap:14px;text-align:left;width:100%" novalidate>
  <div style="text-align:center"><h2>${first?"Crie sua senha":"Alterar senha"}</h2><p class="muted small" style="margin:4px 0 0">${first?"Este é seu primeiro acesso. Troque a senha provisória por uma só sua.":"Escolha uma nova senha."}</p></div>
  <label class="fl">Nova senha<input class="inp" type="password" name="pw1" autocomplete="new-password" data-input="pw"></label>
  <ul class="pwrules small" id="pw-rules">${PWRULES.map(r=>`<li data-k="${r.k}">${r.l}</li>`).join("")}</ul>
  <label class="fl">Repita a nova senha<input class="inp" type="password" name="pw2" autocomplete="new-password"></label>
  <div id="pw-msg" class="small st-warn" role="alert"></div>
  <button class="btn primary" type="submit">Salvar senha</button>
  ${first?`<button type="button" class="btn ghost" data-act="logout">Sair</button>`:`<button type="button" class="btn ghost" data-act="pw-cancel">Cancelar</button>`}
  </form></div>`;
}
function blockedView(){
  return `<div class="center"><div class="card"><div class="logo" style="margin:0 auto 14px" aria-hidden="true"></div>
  <h2>Acesso bloqueado</h2>
  <p class="muted">Seu acesso à Avélis está suspenso no momento. Fale com a sua social media para liberar.</p>
  <button class="btn" data-act="logout">Sair</button></div></div>`;
}
async function doLogin(f){
  const msg=$("#login-msg"),btn=f.querySelector('button[type="submit"]');
  const email=f.elements.email.value.trim().toLowerCase(),password=f.elements.password.value;
  if(!email||!password){msg.textContent="Preencha e-mail e senha.";return}
  btn.disabled=true;msg.textContent="";
  const {error}=await sb.auth.signInWithPassword({email,password});
  btn.disabled=false;
  if(error){msg.textContent=/banned/i.test(error.message)?"Seu acesso está bloqueado. Fale com a sua social media.":/invalid/i.test(error.message)?"E-mail ou senha incorretos.":"Não foi possível entrar agora. Tente de novo.";return}
  AUTHV="loading";render();await startSession();
}
async function doChangePw(f){
  const msg=$("#pw-msg"),btn=f.querySelector('button[type="submit"]');
  const a=f.elements.pw1.value,b=f.elements.pw2.value;
  if(!pwOk(a)){msg.textContent="A senha ainda não cumpre todas as regras da lista.";return}
  if(a!==b){msg.textContent="As duas senhas não são iguais.";return}
  btn.disabled=true;msg.textContent="";
  const {error}=await sb.auth.updateUser({password:a});
  if(error){btn.disabled=false;msg.textContent=/different/i.test(error.message)?"A nova senha precisa ser diferente da atual.":/weak|password/i.test(error.message)?"Senha fraca demais. Siga as regras da lista.":"Não foi possível salvar a senha. Tente de novo.";return}
  await sb.rpc("password_changed");
  const first=AUTHV==="changepw";
  AUTHV=null;toast("Senha salva.");
  if(first){AUTHV="loading";render();await startSession()}else render();
}
function paintPwRules(v){document.querySelectorAll("#pw-rules li").forEach(li=>{const r=PWRULES.find(x=>x.k===li.dataset.k);li.classList.toggle("ok",!!(r&&r.t(v)))})}
async function logout(){
  if(AUTHV==="login"&&!booted)return;
  AUTHV="login";booted=false;
  chans.forEach(c=>{try{sb.removeChannel(c)}catch(e){}});chans=[];
  PROFILE=null;me=null;isOwner=false;CLIENT_ID=null;USERS={};loaded.clear();INV_ALERTED=false;UI.loginOpen=false;UI.menuOpen=false;
  for(const k of COLS)R[k]={};derive();UI.preview=null;UI.view="painel";
  $("#app").innerHTML="";render();
  if(sb)try{await sb.auth.signOut()}catch(e){}
}

/* ----- admin ----- */
function pendingApprovals(cid){return Object.entries(D.posts).filter(([id,p])=>p.status===APV&&!p.posted&&(!cid||p.clientId===cid)&&D.clients[p.clientId])}
function adminView(){
  const nav=[["painel","Painel"],["kanban","Kanban"],["calendario","Calendário"],["crm","CRM"],["financeiro","Financeiro"],["clientes","Clientes"],["acessos","Acessos dos clientes"]];
  const fl=finArr().filter(([,r])=>finLate(r)).length;
  const pa=pendingApprovals().length,fu=followupsDue().length,pgn=(()=>{const g=postingGroups();return g.late.length+g.today.length})();
  let body="";
  if(UI.view==="painel")body=overview();
  else if(UI.view==="kanban")body=kanbanView();
  else if(UI.view==="calendario")body=calendarPage();
  else if(UI.view==="clientes")body=clientsView();
  else if(UI.view==="crm")body=crmView();
  else if(UI.view==="financeiro")body=finView();
  else body=accessView();
  return `<div class="shell ${UI.menuOpen?"menu-open":""}">${mobileBar("Avélis",pa+pgn+fu+fl)}<aside class="side" id="side-menu">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Avélis</b><span>Creative Management</span></div></div>
    <nav class="nav" aria-label="Seções">${nav.map(([k,l])=>`<button data-act="nav" data-v="${k}" aria-current="${UI.view===k}">${l}${k==="kanban"&&pa?`<span class="count" title="Aguardando cliente">${pa}</span>`:""}${k==="painel"&&pgn?`<span class="count" title="Postagens de hoje ou sem confirmação">${pgn}</span>`:""}${k==="crm"&&fu?`<span class="count" title="Follow-ups para hoje ou atrasados">${fu}</span>`:""}${k==="financeiro"&&fl?`<span class="count" title="Contas vencidas">${fl}</span>`:""}</button>`).join("")}</nav>
    <div class="foot"><div style="margin-bottom:8px">${themeBtn("ghost small")}</div>${demo?"Modo demonstração: nada é salvo.":`<div style="margin-bottom:6px">${esc((PROFILE&&PROFILE.email)||"Painel da social media")}</div><div class="row" style="gap:4px"><button class="btn ghost small" data-act="my-pw">Alterar senha</button><button class="btn ghost small" data-act="logout">Sair</button></div>`}</div>
  </aside><main class="main">
    ${demo?`<div class="banner"><span><b>Modo demonstração.</b> Os dados ficam só nesta tela e somem ao recarregar.</span></div>`:""}
    ${stale?`<div class="banner"><span>Não foi possível confirmar os dados mais recentes. O que aparece pode estar desatualizado.</span></div>`:""}
    ${body}</main></div>`;
}
function emptyClients(){
  return `<div class="card pad" style="text-align:center;padding:40px 20px"><h2>Comece cadastrando seus clientes</h2>
  <p class="muted">Cada cliente ganha um kanban, um calendário e uma área própria para acompanhar e aprovar os conteúdos.</p>
  <div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary" data-act="new-client">Novo cliente</button><button class="btn" data-act="seed">Carregar exemplo</button></div></div>`;
}
function postingGroups(){
  const P=Object.entries(D.posts).filter(([,p])=>D.clients[p.clientId]);
  const late=P.filter(([,p])=>!p.posted&&p.postDate&&p.postDate<TODAY).sort((a,b)=>a[1].postDate.localeCompare(b[1].postDate));
  const today=P.filter(([,p])=>!p.posted&&p.postDate===TODAY);
  const ready=P.filter(([,p])=>!p.posted&&p.status==="postagem"&&(!p.postDate||p.postDate>TODAY)).sort((a,b)=>(a[1].postDate||"9999").localeCompare(b[1].postDate||"9999"));
  const wk=Date.now()-7*864e5,done=P.filter(([,p])=>p.posted&&(p.postedAt||0)>=wk).sort((a,b)=>(b[1].postedAt||0)-(a[1].postedAt||0));
  return {late,today,ready,done};
}
function postingsCard(){
  const g=postingGroups();
  const row=([id,p],kind)=>`<div class="li"><span class="cdot" style="--cc:${esc(cColor(p.clientId))};margin-top:6px"></span><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(p.title)}</div>
    <div class="small muted">${esc(cName(p.clientId))} · ${esc(p.format||"")} · ${kind==="done"?"publicado em "+new Date(p.postedAt).toLocaleDateString("pt-BR"):p.postDate?(kind==="late"?`<span class="late-txt">era para ${short(p.postDate)}</span>`:"post "+short(p.postDate)):"sem data"}
    ${kind!=="done"&&p.status!=="postagem"?` · <span class="chip st-${p.status}" style="font-size:11px">${ST[p.status].l}</span>`:""}</div></div>
    ${kind==="done"?(p.postedUrl?`<a class="btn ghost" href="${esc(safeUrl(p.postedUrl))}" target="_blank" rel="noopener">Ver post</a>`:`<span class="chip st-ok">Publicado</span>`):`<button class="btn ${kind==="late"?"primary":""}" data-act="mark-posted" data-id="${id}">Confirmar postagem</button>`}</div>`;
  const grp=(cls,t,l,kind)=>l.length?`<div class="fu-group ${cls}">${t} (${l.length})</div>${l.slice(0,8).map(x=>row(x,kind)).join("")}${l.length>8?`<div class="small muted" style="padding:6px 14px">+${l.length-8}</div>`:""}`:"";
  const body=grp("late","Não confirmadas · data já passou",g.late,"late")+grp("today","Para postar hoje",g.today,"today")+grp("","Prontos para postar",g.ready,"ready")+grp("","Publicados nos últimos 7 dias",g.done,"done");
  return `<section style="margin-bottom:22px"><div class="sec-title"><h2>Postagens</h2><span class="small muted">${g.late.length?`<span class="late-txt">${g.late.length} sem confirmação</span>`:"Tudo em dia"}</span></div>
    <div class="card list">${body||`<div class="empty">Nenhuma postagem pendente.</div>`}</div></section>`;
}
function postedModal(id){
  const p=D.posts[id];if(!p)return;
  openModal("Confirmar postagem",`<div><b>${esc(p.title)}</b><div class="small muted">${esc(cName(p.clientId))} · ${esc(p.format||"")}${p.postDate?" · previsto para "+longDay(p.postDate):""}</div></div>
    <label class="fl">Data em que foi publicado<input class="inp" type="date" name="pdate" value="${TODAY}"></label>
    <label class="fl">Link da publicação<span class="hint">Opcional. O cliente vê o botão "Ver publicação".</span><input class="inp" name="purl" placeholder="https://instagram.com/p/…" value="${esc(p.postedUrl||"")}"></label>`,
    `<div></div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Confirmar publicado</button></div>`,
    async f=>{const d=parse(val(f,"pdate")||TODAY);d.setHours(12);
      const ok=await put("posts",id,{...p,posted:true,postedAt:d.getTime(),postedUrl:val(f,"purl"),status:"postagem",updatedAt:Date.now()});
      if(!ok)return false;if(R.actions[id])await del("actions",id);toast("Postagem confirmada.")});
}
function overview(){
  const cs=clientsSorted();
  const head=`<div class="head"><div><h1>Painel</h1><p class="muted">${longDay(TODAY)} · ${cs.length} cliente${cs.length===1?"":"s"}</p></div>
    <div class="row"><button class="btn" data-act="new-task">Nova tarefa</button><button class="btn primary" data-act="new-post">Novo conteúdo</button></div></div>`;
  if(!cs.length)return head+emptyClients();
  const active=Object.values(D.posts).filter(p=>!p.posted&&D.clients[p.clientId]);
  const stats=`<div class="stats">${STATUSES.map(s=>`<div class="card stat" style="--sc:${s.c}"><div class="n">${active.filter(p=>p.status===s.k).length}</div><div class="l">${s.l}</div></div>`).join("")}</div>`;
  const cards=cs.map(([cid,c])=>{
    const ps=active.filter(p=>p.clientId===cid),tot=ps.length||1;
    const pa=pendingApprovals(cid).length;
    const next=Object.values(D.posts).filter(p=>p.clientId===cid&&p.postDate>=TODAY&&!p.posted).sort((a,b)=>a.postDate.localeCompare(b.postDate))[0];
    return `<div class="card ccard" style="--cc:${esc(c.color)}"><div class="t"><div><h3>${esc(c.name)}</h3><div class="small muted">${esc(c.segment||"")} ${c.instagram?"· "+esc(c.instagram):""}</div></div>
      ${pa?`<span class="chip st-aprovacao">${pa} p/ aprovar</span>`:""}</div>
      <div class="bar" aria-label="Conteúdos por etapa">${STATUSES.map(s=>{const n=ps.filter(p=>p.status===s.k).length;return n?`<span style="width:${n/tot*100}%;background:${s.c}" title="${s.l}: ${n}"></span>`:""}).join("")}</div>
      <div class="small muted">${ps.length} em andamento${next?` · próximo post ${short(next.postDate)}`:""}</div>
      <div class="row"><button class="btn" data-act="open-kanban" data-id="${cid}">Kanban</button><button class="btn ghost" data-act="preview" data-id="${cid}">Ver como cliente</button></div></div>`;
  }).join("");
  const legend=`<div class="legend">${STATUSES.map(s=>`<span><i style="background:${s.c}"></i>${s.l}</span>`).join("")}</div>`;
  // próximos 7 dias
  const end=ymd(addDays(new Date(),6)),items=[];
  for(const[id,p]of Object.entries(D.posts)){if(!D.clients[p.clientId])continue;
    if(p.postDate>=TODAY&&p.postDate<=end&&!p.posted)items.push({d:p.postDate,type:"post",id,p});
    if(p.recordDate>=TODAY&&p.recordDate<=end)items.push({d:p.recordDate,type:"grav",id,p});}
  for(const[id,t]of Object.entries(D.tasks)){if(D.clients[t.clientId]&&t.date>=TODAY&&t.date<=end&&!(D.taskdone[id]||{}).done)items.push({d:t.date,type:"task",id,t});}
  items.sort((a,b)=>a.d.localeCompare(b.d));
  const week=items.length?items.map(it=>{const dd=parse(it.d),cid=(it.p||it.t).clientId;
    const lab=it.type==="post"?"Publicação":it.type==="grav"?"Gravação":"Tarefa do cliente";
    return `<div class="li click" data-act="${it.type==="task"?"edit-task":"edit-post"}" data-id="${it.id}"><div class="date-badge"><b>${dd.getDate()}</b><span>${DIAS[dd.getDay()].slice(0,3)}</span></div>
      <div style="min-width:0"><div class="type ${it.type}">${lab}</div><div style="font-weight:600">${esc((it.p||it.t).title)}</div><div class="small muted row" style="gap:6px"><span class="cdot" style="--cc:${esc(cColor(cid))}"></span>${esc(cName(cid))}</div></div></div>`}).join("")
    :`<div class="empty">Nada marcado para os próximos 7 dias.</div>`;
  return head+stats+postingsCard()+`<div class="grid2"><section><div class="sec-title"><h2>Clientes</h2></div><div style="margin:-4px 0 12px">${legend}</div><div class="clients">${cards}</div></section>
    <section><div class="sec-title"><h2>Próximos 7 dias</h2></div><div class="card list">${week}</div></section></div>`;
}
function clientFilter(act,val){
  return `<select class="sel" data-change="${act}" aria-label="Filtrar por cliente"><option value="all">Todos os clientes</option>${clientsSorted().map(([id,c])=>`<option value="${id}" ${val===id?"selected":""}>${esc(c.name)}</option>`).join("")}</select>`;
}
function kanbanView(){
  const cs=clientsSorted();
  const head=`<div class="head"><div><h1>Kanban</h1><p class="muted">Arraste os cards entre as etapas.</p></div><div class="row">${clientFilter("kfilter",UI.kClient)}<button class="btn primary" data-act="new-post">Novo conteúdo</button></div></div>
  <div class="row" style="margin-bottom:14px;justify-content:space-between">${periodBar("k",UI.kMode,UI.kAnchor,true)}${UI.kMode!=="todos"?`<span class="small muted">Conteúdos com gravação ou publicação no período</span>`:""}</div>`;
  if(!cs.length)return head+emptyClients();
  const rng=UI.kMode==="todos"?null:periodRange(UI.kMode,UI.kAnchor);
  const inR=d=>d&&d>=rng[0]&&d<=rng[1];
  const posts=Object.entries(D.posts).filter(([,p])=>!p.posted&&D.clients[p.clientId]&&(UI.kClient==="all"||p.clientId===UI.kClient)&&(!rng||inR(p.postDate)||inR(p.recordDate)))
    .sort((a,b)=>(a[1].postDate||"9999").localeCompare(b[1].postDate||"9999"));
  const postedN=Object.values(D.posts).filter(p=>p.posted&&(UI.kClient==="all"||p.clientId===UI.kClient)).length;
  const cols=STATUSES.map(s=>{const list=posts.filter(([,p])=>p.status===s.k);
    return `<div class="col" style="--sc:${s.c}" data-drop="${s.k}"><div class="col-h"><b>${s.l}</b><span class="muted small tab">${list.length}</span></div>
    <div class="col-b">${list.map(([id,p])=>kcard(id,p)).join("")||`<div class="empty">Nenhum conteúdo aqui</div>`}
    <button class="add-in-col" data-act="new-post" data-status="${s.k}">+ Adicionar</button></div></div>`}).join("");
  return head+`<div class="kanban">${cols}</div>${postedN?`<p class="small muted">${postedN} conteúdo${postedN===1?"":"s"} já publicado${postedN===1?"":"s"} fora do quadro.</p>`:""}`;
}
function apBadge(id,p){
  if(p.status!==APV||p.posted)return "";
  const a=approvalOf(id);
  if(a&&a.decision==="ajuste")return `<span class="chip st-warn" title="${esc(a.comment||"")}">Cliente pediu ajuste</span>`;
  return `<span class="chip st-aprovacao">Aguardando cliente</span>`;
}
function clientChip(id){const a=FROMCLIENT[id];return a?`<span class="chip client" title="${esc(a.at?new Date(a.at).toLocaleString("pt-BR"):"")}">Cliente concluiu etapa</span>`:""}
function doneBtn(id,p,extra){
  const n=nextStatus(p.status);if(p.posted||!n)return "";
  if(!can(p.status===APV?"aprovar":"concluir"))return "";
  const lab=p.status===APV?"Aprovar para postar":"✓ Ação concluída";
  return `<button type="button" class="btn done-btn ${extra||""}" data-act="conclude" data-id="${id}" data-next="${esc(n.l)}" ${UI.readOnly?"disabled":""} title="Avança para: ${esc(n.l)}">${lab}</button>`;
}
/* períodos (mês / semana) */
function weekStart(d){const x=parse(d);x.setDate(x.getDate()-x.getDay());return x}
function periodRange(mode,anchor){
  if(mode==="semana"){const a=weekStart(anchor);return[ymd(a),ymd(addDays(a,6))]}
  const a=parse(anchor);return[ymd(new Date(a.getFullYear(),a.getMonth(),1)),ymd(new Date(a.getFullYear(),a.getMonth()+1,0))];
}
function periodLabel(mode,anchor){
  const[s,e]=periodRange(mode,anchor),a=parse(s),b=parse(e);
  if(mode==="semana"){const ms=x=>MESES[x.getMonth()].slice(0,3);return a.getMonth()===b.getMonth()?`${a.getDate()} a ${b.getDate()} de ${ms(b)}`:`${a.getDate()} ${ms(a)} a ${b.getDate()} ${ms(b)}`}
  return MESES[a.getMonth()]+" "+a.getFullYear();
}
function ymSelects(key,anchor){
  const a=parse(anchor),y0=new Date().getFullYear(),ys=[];for(let y=y0-1;y<=y0+3;y++)ys.push(y);if(!ys.includes(a.getFullYear()))ys.push(a.getFullYear());
  return `<select class="sel" data-change="ym-month" data-k="${key}" aria-label="Mês">${MESES.map((m,i)=>`<option value="${i}" ${i===a.getMonth()?"selected":""}>${m[0].toUpperCase()+m.slice(1)}</option>`).join("")}</select>
  <select class="sel" data-change="ym-year" data-k="${key}" aria-label="Ano">${ys.sort().map(y=>`<option ${y===a.getFullYear()?"selected":""}>${y}</option>`).join("")}</select>`;
}
function periodBar(key,mode,anchor,allowAll){
  const modes=(allowAll?[["todos","Todos"]]:[]).concat([["mes","Mês"],["semana","Semana"]]);
  return `<div class="period"><div class="seg" role="group" aria-label="Período">${modes.map(([k,l])=>`<button type="button" data-act="pmode" data-k="${key}" data-v="${k}" aria-pressed="${mode===k}">${l}</button>`).join("")}</div>
  ${mode!=="todos"?`<button class="btn ghost" data-act="pnav" data-k="${key}" data-v="-1" aria-label="Anterior">‹</button>${mode==="mes"?ymSelects(key,anchor):`<span class="lbl">${periodLabel(mode,anchor)}</span>`}<button class="btn ghost" data-act="pnav" data-k="${key}" data-v="1" aria-label="Próximo">›</button><button class="btn" data-act="pnav" data-k="${key}" data-v="0">Hoje</button>`:""}</div>`;
}
function kcard(id,p){
  return `<div class="kcard" draggable="true" data-drag="${id}" data-act="edit-post" data-id="${id}" style="--cc:${esc(cColor(p.clientId))}" tabindex="0">
    <div class="kc-top"><span class="cdot"></span><span>${esc(cName(p.clientId))}</span><span class="fmt">${esc(p.format||"")}</span></div>
    <div class="kc-title">${esc(p.title)}</div>
    <div class="kc-meta">${p.recordDate?`<span>Gravação ${short(p.recordDate)}</span>`:""}${p.postDate?`<span>Post ${short(p.postDate)}</span>`:""}${p.media&&p.media.length?`<span>${p.media.length} mídia${p.media.length===1?"":"s"}</span>`:""}</div>
    ${apBadge(id,p)}${clientChip(id)}${p.status==="postagem"?`<button class="btn small done-btn" data-act="mark-posted" data-id="${id}" style="align-self:flex-start">Confirmar postagem</button>`:""}</div>`;
}

/* ----- calendário (compartilhado) ----- */
function dayIndex(cid){
  const idx={},add=(d,it)=>{if(d)(idx[d]=idx[d]||[]).push(it)};
  for(const[id,p]of Object.entries(D.posts)){if(!D.clients[p.clientId]||(cid&&p.clientId!==cid))continue;add(p.recordDate,{type:"grav",id,p,cid:p.clientId});add(p.postDate,{type:"post",id,p,cid:p.clientId})}
  for(const[id,t]of Object.entries(D.tasks)){if(!D.clients[t.clientId]||(cid&&t.clientId!==cid))continue;add(t.date,{type:"task",id,t,cid:t.clientId})}
  const ord={grav:0,task:1,post:2};for(const k in idx)idx[k].sort((a,b)=>ord[a.type]-ord[b.type]);
  return idx;
}
function pillText(it){return it.type==="post"?"Post · "+it.p.title:it.type==="grav"?"Gravar · "+it.p.title:it.t.title}
function calendarGrid(idx,showClient){
  const wk=UI.calMode==="semana";let start,n,mo=null;
  if(wk){start=weekStart(UI.calAnchor);n=7}
  else{const m=parse(UI.calAnchor),y=m.getFullYear();mo=m.getMonth();const first=new Date(y,mo,1).getDay(),dim=new Date(y,mo+1,0).getDate();n=Math.ceil((first+dim)/7)*7;start=new Date(y,mo,1-first)}
  let h=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(w=>`<div class="wd">${w}</div>`).join("");
  for(let i=0;i<n;i++){const d=addDays(start,i),k=ymd(d),its=idx[k]||[],lim=wk?99:3;
    const cls=["day",mo!==null&&d.getMonth()!==mo?"out":"",k===TODAY?"today":"",k===UI.selDay?"sel":""].join(" ");
    h+=`<div class="${cls}" data-act="day" data-v="${k}" role="button" tabindex="0" aria-label="${longDay(k)}, ${its.length} itens"><span class="dn">${d.getDate()}</span>
      ${its.slice(0,lim).map(it=>`<span class="pill ${it.type} ${it.type==="task"&&(D.taskdone[it.id]||{}).done?"done":""}" style="${showClient?`--cc:${esc(cColor(it.cid))}`:""}">${esc(pillText(it))}</span>`).join("")}
      ${its.length>lim?`<span class="more">+${its.length-lim}</span>`:""}</div>`}
  return `<div class="cal ${wk?"week":""}">${h}</div>`;
}
function calBar(extra){
  return `<div class="calbar">${periodBar("cal",UI.calMode,UI.calAnchor,false)}${extra?`<div class="row">${extra}</div>`:""}</div>`;
}
function itemHtml(it,{admin,showClient,clientMode}){
  const done=it.type==="task"&&(D.taskdone[it.id]||{}).done;
  if(it.type==="task"){
    return `<div class="item"><input type="checkbox" class="chk" id="tk-${it.id}" data-act="toggle-task" data-id="${it.id}" ${done?"checked":""} ${(!clientMode&&!admin)||(clientMode&&!can("tarefas"))?"disabled":""} aria-label="Marcar tarefa como feita">
    <div class="body"><div class="type task">Tarefa</div><label for="tk-${it.id}" class="t" style="${done?"text-decoration:line-through;opacity:.6":""}">${esc(it.t.title)}</label>
    ${it.t.details?`<div class="small muted">${esc(it.t.details)}</div>`:""}${showClient?clientTag(it.cid):""}</div>
    ${admin?`<button class="btn ghost small" data-act="edit-task" data-id="${it.id}">Editar</button>`:""}</div>`;
  }
  const p=it.p;
  if(it.type==="grav"){
    return `<div class="item"><div class="body"><div class="type grav">Gravação</div><div class="t">${esc(p.title)}</div>
    <div class="small muted">${esc(p.format||"")} · publicação ${p.postDate?short(p.postDate):"a definir"}</div>
    ${p.clientAction?`<div class="todo"><b>${clientMode?"O que você precisa fazer":"O cliente precisa"}</b><div>${esc(p.clientAction)}</div></div>`:""}${showClient?clientTag(it.cid):""}</div>
    <div class="row" style="flex-direction:column;align-items:flex-end"><button class="btn ghost small" data-act="${admin?"edit-post":"view-post"}" data-id="${it.id}">${admin?"Editar":"Detalhes"}</button>${clientMode?doneBtn(it.id,p):""}</div></div>`;
  }
  return `<div class="item"><div class="body"><div class="type post">Publicação</div><div class="t">${esc(p.title)}</div>
    <div class="row small" style="gap:6px;margin-top:4px"><span class="muted">${esc(p.format||"")}</span>${p.posted?`<span class="chip st-ok">Publicado</span>`:`<span class="chip st-${p.status}">${ST[p.status]?ST[p.status].l:""}</span>`}${apBadge(it.id,p)}${admin?clientChip(it.id):""}</div>
    ${showClient?clientTag(it.cid):""}</div>
    <div class="row" style="flex-direction:column;align-items:flex-end"><button class="btn ghost small" data-act="${admin?"edit-post":"view-post"}" data-id="${it.id}">${admin?"Editar":"Detalhes"}</button>${clientMode?doneBtn(it.id,p):""}</div></div>`;
}
function clientTag(cid){return `<div class="small muted row" style="gap:6px;margin-top:4px"><span class="cdot" style="--cc:${esc(cColor(cid))}"></span>${esc(cName(cid))}</div>`}
function dayPanel(idx,opts){
  const its=idx[UI.selDay]||[];
  return `<div class="card"><div class="dayhead"><div><div class="small muted">Dia selecionado</div><h3>${longDay(UI.selDay)}</h3></div>
    ${opts.admin?`<div class="row"><button class="btn" data-act="new-task" data-date="${UI.selDay}">+ Tarefa</button><button class="btn primary" data-act="new-post" data-date="${UI.selDay}">+ Conteúdo</button></div>`:""}</div>
    <div>${its.map(it=>itemHtml(it,opts)).join("")||`<div class="empty">Nada marcado para este dia.</div>`}</div></div>`;
}
function agendaList(idx,opts){
  const[a,b]=periodRange(UI.calMode,UI.calAnchor),days=Object.keys(idx).filter(k=>k>=a&&k<=b).sort();
  const nm=UI.calMode==="semana"?"da semana ("+periodLabel("semana",UI.calAnchor)+")":"de "+MESES[parse(UI.calAnchor).getMonth()]+(parse(UI.calAnchor).getFullYear()!==new Date().getFullYear()?" de "+parse(UI.calAnchor).getFullYear():"");
  const title=`<div class="sec-title"><h2>Tudo ${nm}</h2><span class="small muted">${days.reduce((n,k)=>n+idx[k].length,0)} itens</span></div>`;
  if(!days.length)return `<div class="agenda">${title}<div class="card"><div class="empty">Nada marcado neste período.</div></div></div>`;
  return `<div class="agenda">${title}<div class="card">${days.map(k=>{const d=parse(k);return `<div class="agday"><div class="d">${d.getDate()} de ${MESES[d.getMonth()].slice(0,3)}<span>${DIAS[d.getDay()]}</span></div><div class="items">${idx[k].map(it=>itemHtml(it,opts)).join("")}</div></div>`}).join("")}</div></div>`;
}
function calendarPage(){
  const cs=clientsSorted();
  const head=`<div class="head"><div><h1>Calendário</h1><p class="muted">Gravações, publicações e tarefas de cada cliente.</p></div><div class="row">${clientFilter("cfilter",UI.calClient)}</div></div>`;
  if(!cs.length)return head+emptyClients();
  const idx=dayIndex(UI.calClient==="all"?null:UI.calClient),opts={admin:true,showClient:UI.calClient==="all",clientMode:false};
  const legend=`<div class="legend" style="padding:10px 14px;border-top:1px solid var(--line)"><span><i style="background:var(--grav)"></i>Gravação</span><span><i style="background:var(--tsk)"></i>Tarefa do cliente</span><span><i style="background:var(--accent)"></i>Publicação</span></div>`;
  return head+`<div class="calwrap"><div class="card">${calBar()}${calendarGrid(idx,opts.showClient)}${legend}</div>${dayPanel(idx,opts)}</div>`+agendaList(idx,opts);
}
/* ----- CRM ----- */
const BRL=v=>{try{return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}catch(e){return "R$ "+Math.round(v||0)}};
function clientFromLead(id,l){
  return {name:l.company||l.name,segment:l.segment||l.service||"",instagram:l.instagram||"",contact:[l.name,l.phone].filter(Boolean).join(" · "),
    color:COLORS[clientsSorted().length%COLORS.length],fee:parseMoney(l.value)>0?parseMoney(l.value):0,dueDay:10,notes:[l.notes,l.value?"Valor fechado: "+BRL(l.value)+"/mês":""].filter(Boolean).join("\n"),perms:{...ALLP},createdAt:Date.now(),fromLead:id};
}
/* grava o lead; se ficou Fechado e ainda não tem cliente, cria o cliente na mesma ação */
async function saveLead(id,data){
  let created=null;
  if(data.stage==="fechado"&&!(data.clientId&&D.clients[data.clientId])){
    const cid=newId();if(!(await put("clients",cid,clientFromLead(id,data))))return false;
    data={...data,clientId:cid};created=cid;
  }
  if(!(await put("leads",id,data)))return false;
  if(created)setTimeout(()=>wonModal(created),60);
  return true;
}
function wonModal(cid){
  openModal("Cliente fechado!",`<p style="margin:0"><b>${esc(cName(cid))}</b> já foi cadastrado em Clientes com os dados do lead, com todas as permissões liberadas.</p>
    <p class="muted" style="margin:0">Quer cadastrar agora o primeiro conteúdo e o roteiro?</p>`,
    `<button type="button" class="btn" data-act="go-client" data-id="${cid}">Ver cliente</button><div class="row"><button type="button" class="btn" data-act="close">Depois</button><button type="button" class="btn primary" data-act="first-post" data-id="${cid}">Criar conteúdo e roteiro</button></div>`,null);
}
/* sugestões de segmento: lista básica + os que já foram usados em leads e clientes */
const SEGMENTOS=["Alimentação","Restaurante / Bar","Moda e Acessórios","Beleza e Estética","Saúde / Clínica","Odontologia","Academia / Fitness","Pet","Imobiliária","Advocacia","Educação","Varejo / Loja","Automotivo","Serviços","Tecnologia","Eventos","Turismo / Hotelaria","Outro"];
function segmentOptions(){const s=new Set(SEGMENTOS);Object.values(D.leads||{}).concat(Object.values(D.clients||{})).forEach(x=>{if(x&&x.segment)s.add(x.segment)});return [...s]}
function leadsArr(){return Object.entries(D.leads||{})}
function followupsDue(){return leadsArr().filter(([,l])=>ACTIVE.includes(l.stage)&&l.nextFollowUp&&l.nextFollowUp<=TODAY)}
function waLink(ph){let d=String(ph||"").replace(/\D/g,"");if(!d)return "";if(d.length<=11)d="55"+d;return "https://wa.me/"+d}
function fuText(l){if(!l.nextFollowUp)return `<span class="muted">Sem follow-up</span>`;
  if(l.nextFollowUp<TODAY)return `<span class="late-txt">Atrasado · ${short(l.nextFollowUp)}</span>`;
  if(l.nextFollowUp===TODAY)return `<span class="today-txt">Hoje</span>`;return `<span>Follow-up ${short(l.nextFollowUp)}</span>`}
function lastHist(l){const h=(l.followups||[]);return h.length?h[h.length-1]:null}
function leadCard(id,l){
  const lh=lastHist(l);
  return `<div class="kcard" draggable="true" data-drag="lead:${id}" data-act="edit-lead" data-id="${id}" style="--cc:${LS[l.stage]?LS[l.stage].c:"var(--line)"}" tabindex="0">
    <div class="kc-top"><span>${esc(l.company||"Sem empresa")}</span>${l.origin?`<span class="fmt">${esc(l.origin)}</span>`:""}</div>
    <div class="kc-title">${esc(l.name)}</div>${l.segment?`<div class="small muted">${esc(l.segment)}</div>`:""}
    <div class="kc-meta">${l.value?`<span class="money">${BRL(l.value)}/mês</span>`:""}${ACTIVE.includes(l.stage)?fuText(l):l.stage==="perdido"&&l.lostReason?`<span>Motivo: ${esc(l.lostReason)}</span>`:""}</div>
    ${lh?`<div class="small muted" style="line-height:1.35">${esc(lh.channel)} · ${short(lh.date)}: ${esc((lh.text||"").slice(0,80))}</div>`:""}
    ${l.stage==="fechado"&&l.clientId&&D.clients[l.clientId]?`<span class="chip st-ok">Cliente ativo</span>`:""}</div>`;
}
function crmView(){
  const all=leadsArr(),q=(UI.lq||"").toLowerCase();
  const head=`<div class="head"><div><h1>CRM</h1><p class="muted">Leads, propostas e follow-ups. Só você vê esta área.</p></div>
    <div class="row"><input class="inp search" id="lsearch" data-input="lsearch" placeholder="Buscar lead, empresa ou segmento" value="${esc(UI.lq)}" aria-label="Buscar lead"><button class="btn primary" data-act="new-lead">Novo lead</button></div></div>`;
  if(!all.length)return head+`<div class="card pad" style="text-align:center;padding:40px 20px"><h2>Nenhum lead ainda</h2><p class="muted">Cadastre quem pediu orçamento ou demonstrou interesse e acompanhe cada conversa até fechar.</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary" data-act="new-lead">Novo lead</button>${demo?"":`<button class="btn" data-act="seed-leads">Carregar leads de exemplo</button>`}</div></div>`;
  const active=all.filter(([,l])=>ACTIVE.includes(l.stage));
  const late=active.filter(([,l])=>l.nextFollowUp&&l.nextFollowUp<TODAY),today=active.filter(([,l])=>l.nextFollowUp===TODAY);
  const ym=TODAY.slice(0,7),closedM=all.filter(([,l])=>l.stage==="fechado"&&l.closedAt&&ymd(new Date(l.closedAt)).startsWith(ym));
  const won=all.filter(([,l])=>l.stage==="fechado").length,lost=all.filter(([,l])=>l.stage==="perdido").length;
  const conv=won+lost?Math.round(won/(won+lost)*100):null;
  const tile=(n,l,c)=>`<div class="card stat" style="--sc:${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  const stats=`<div class="stats crm-stats">${tile(active.length,"Leads em andamento","var(--s2)")}${tile(late.length,"Follow-ups atrasados","var(--warn)")}${tile(today.length,"Follow-ups hoje","var(--accent)")}
    ${tile(BRL(active.reduce((a,[,l])=>a+Number(l.value||0),0)),"Em aberto por mês","var(--s3)")}${tile(closedM.length+` <span class="small muted">· ${BRL(closedM.reduce((a,[,l])=>a+Number(l.value||0),0))}</span>`,"Fechados neste mês","var(--ok)")}
    ${tile(conv===null?"—":conv+"%","Taxa de fechamento","var(--s4)")}</div>`;
  // follow-up agenda
  const end=ymd(addDays(new Date(),7));
  const soon=active.filter(([,l])=>l.nextFollowUp>TODAY&&l.nextFollowUp<=end).sort((a,b)=>a[1].nextFollowUp.localeCompare(b[1].nextFollowUp));
  const none=active.filter(([,l])=>!l.nextFollowUp);
  const fuRow=([id,l])=>{const lh=lastHist(l),wa=waLink(l.phone);return `<div class="li"><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><b>${esc(l.name)}</b><span class="small muted">${esc(l.company||"")}</span><span class="chip" style="color:${LS[l.stage].c}">${LS[l.stage].l}</span></div>
    <div class="small">${fuText(l)}${lh?` <span class="muted">· último: ${esc(lh.channel)} ${short(lh.date)}</span>`:""}</div></div>
    <div class="row">${wa?`<a class="btn ghost" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="btn" data-act="log-contact" data-id="${id}">Registrar contato</button></div></div>`};
  const grp=(cls,title,list)=>list.length?`<div class="fu-group ${cls}">${title} (${list.length})</div>${list.map(fuRow).join("")}`:"";
  const agenda=`<section><div class="sec-title"><h2>Follow-ups</h2>${none.length?`<span class="small muted">${none.length} lead${none.length===1?"":"s"} sem próximo contato marcado</span>`:""}</div>
    <div class="card list">${grp("late","Atrasados",late)}${grp("today","Hoje",today)}${grp("","Próximos 7 dias",soon)}${!late.length&&!today.length&&!soon.length?`<div class="empty">Nenhum follow-up marcado para os próximos dias.</div>`:""}</div></section>`;
  // pipeline
  const shown=all.filter(([,l])=>!q||(l.name||"").toLowerCase().includes(q)||(l.company||"").toLowerCase().includes(q)||(l.segment||"").toLowerCase().includes(q));
  const cols=LSTAGES.map(st=>{const list=shown.filter(([,l])=>l.stage===st.k).sort((a,b)=>(a[1].nextFollowUp||"9999").localeCompare(b[1].nextFollowUp||"9999"));
    const sum=list.reduce((a,[,l])=>a+Number(l.value||0),0);
    return `<div class="col" style="--sc:${st.c}" data-drop="lead:${st.k}"><div class="col-h"><b>${st.l}</b><span class="muted small tab">${list.length}${sum?" · "+BRL(sum):""}</span></div>
    <div class="col-b">${list.map(([id,l])=>leadCard(id,l)).join("")||`<div class="empty">Nenhum lead</div>`}${ACTIVE.includes(st.k)?`<button class="add-in-col" data-act="new-lead" data-stage="${st.k}">+ Adicionar</button>`:""}</div></div>`}).join("");
  return head+stats+agenda+`<div class="sec-title" style="margin-top:22px"><h2>Funil de vendas</h2><span class="small muted">Arraste os leads entre as etapas</span></div><div class="kanban crm">${cols}</div>`;
}
function clientsView(){
  const cs=clientsSorted();
  const head=`<div class="head"><div><h1>Clientes</h1><p class="muted">${cs.length} empresa${cs.length===1?"":"s"} atendida${cs.length===1?"":"s"}</p></div><button class="btn primary" data-act="new-client">Novo cliente</button></div>`;
  if(!cs.length)return head+emptyClients();
  return head+`<div class="card list">${cs.map(([id,c])=>{const n=Object.values(D.posts).filter(p=>p.clientId===id&&!p.posted).length;
    const us=usersOf(id),acc=us.length,blk=acc&&us.every(u=>u.blocked);
    return `<div class="li"><div class="pavatar" style="--cc:${esc(c.color)};width:40px;height:40px;font-size:16px;border-radius:10px">${esc(initials(c.name))}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:700">${esc(c.name)} ${blk?`<span class="chip st-warn">Acesso bloqueado</span>`:""}</div><div class="small muted">${esc([c.segment,c.instagram,c.contact].filter(Boolean).join(" · "))}</div>
    <div class="small muted">${n} conteúdo${n===1?"":"s"} em andamento · ${acc} pessoa${acc===1?"":"s"} com acesso · ${(()=>{const pm=permsOf(id),k=PERMS.filter(p=>pm[p.k]).length;return k===PERMS.length?"todas as permissões":k+" de "+PERMS.length+" permissões"})()}</div></div>
    <div class="row"><button class="btn ghost" data-act="preview" data-id="${id}">Ver como cliente</button>${acc?`<button class="btn ghost ${blk?"":"danger"}" data-act="block-company" data-id="${id}" data-v="${blk?"0":"1"}">${blk?"Liberar acesso":"Bloquear acesso"}</button>`:`<button class="btn ghost" data-act="go-access" data-id="${id}">Criar acesso</button>`}<button class="btn" data-act="edit-client" data-id="${id}">Editar</button></div></div>`}).join("")}</div>`;
}

/* ----- financeiro (só a administradora vê: coleção "fin" fica fora das regras do cliente) ----- */
const FINCAT={receita:["Mensalidade de cliente","Serviço avulso","Outros"],despesa:["Anúncios (tráfego pago)","Ferramentas e assinaturas","Equipe / freelancers","Impostos e taxas","Equipamentos","Outros"]};
const ADCAT="Anúncios (tráfego pago)";
const PLATS=["Meta Ads (Instagram/Facebook)","Google Ads","TikTok Ads","LinkedIn Ads","Outro"];
const BRL2=v=>{try{return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}catch(e){return "R$ "+Number(v||0).toFixed(2)}};
function ymAdd(ym,n){const[y,m]=ym.split("-").map(Number),d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+pad(d.getMonth()+1)}
function ymLabel(ym){const[y,m]=ym.split("-").map(Number);return MESES[m-1]+" de "+y}
function dueIn(ym,day){const[y,m]=ym.split("-").map(Number),last=new Date(y,m,0).getDate();return ym+"-"+pad(Math.min(Math.max(1,Number(day)||1),last))}
function parseMoney(s){s=String(s??"").trim().replace(/[R$\s]/g,"");if(!s)return NaN;if(s.includes(",")||/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return isFinite(n)?n:NaN}
function finArr(){return Object.entries(D.fin||{})}
function finLate(r){return !r.paid&&r.due&&r.due<TODAY}
function finSum(list){return list.reduce((a,[,r])=>a+Number(r.amount||0),0)}
/* clientes com mensalidade cadastrada que ainda não têm o lançamento do mês */
function feesMissing(ym){return clientsSorted().filter(([cid,c])=>Number(c.fee)>0&&!D.fin["m-"+cid+"-"+ym])}
function finDue(r){
  const paidTxt=r.kind==="receita"?"Recebido":"Pago";
  if(r.paid)return `<span class="st-ok" style="font-weight:600">${paidTxt}${r.paidDate?" "+short(r.paidDate):""}</span>`;
  if(!r.due)return `<span class="muted">Sem vencimento</span>`;
  if(r.due<TODAY)return `<span class="late-txt">Venceu ${short(r.due)}</span>`;
  if(r.due===TODAY)return `<span class="today-txt">Vence hoje</span>`;
  return `<span class="muted">Vence ${short(r.due)}</span>`;
}
function finRow([id,r]){
  const sub=[r.category,r.clientId&&D.clients[r.clientId]?cName(r.clientId):"",r.category===ADCAT?r.platform:""].filter(Boolean).join(" · ");
  const lbl=r.kind==="receita"?(r.paid?"Desmarcar recebido":"Marcar como recebido"):(r.paid?"Desmarcar pago":"Marcar como pago");
  return `<div class="li click fin-row ${r.paid?"paid":""}" data-act="edit-fin" data-id="${id}">
    <button type="button" class="fin-check ${r.paid?"on":""}" data-act="fin-pay" data-id="${id}" aria-pressed="${!!r.paid}" aria-label="${lbl}" title="${lbl}">✓</button>
    <div style="flex:1;min-width:0"><div style="font-weight:600">${esc(r.description||r.category)}</div><div class="small muted">${esc(sub)}</div></div>
    <div style="text-align:right;flex:none"><div class="money">${BRL2(r.amount)}</div><div class="small">${finDue(r)}</div></div></div>`;
}
/* barras horizontais de uma série: rótulo, barra proporcional ao maior valor e valor em texto */
function finBars(items,color,empty){
  items=items.filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  if(!items.length)return `<div class="empty">${empty}</div>`;
  const max=items[0][1],tot=items.reduce((a,x)=>a+x[1],0);
  return items.map(([l,v])=>`<div class="hbar" title="${esc(l)}: ${BRL2(v)} (${Math.round(v/tot*100)}%)"><span class="hl">${esc(l)}</span><span class="track"><span class="fill" style="width:${Math.max(2,v/max*100)}%;--fc:${color}"></span></span><span class="money">${BRL2(v)}</span></div>`).join("");
}
function groupBy(list,key){const m={};list.forEach(([,r])=>{const k=key(r);m[k]=(m[k]||0)+Number(r.amount||0)});return Object.entries(m)}
function finView(){
  const ym=UI.finMonth||TODAY.slice(0,7),all=finArr();
  const mon=all.filter(([,r])=>(r.due||"").startsWith(ym));
  const rec=mon.filter(([,r])=>r.kind==="receita"),des=mon.filter(([,r])=>r.kind==="despesa");
  const ads=des.filter(([,r])=>r.category===ADCAT);
  const paid=l=>l.filter(([,r])=>r.paid),open=l=>l.filter(([,r])=>!r.paid);
  const lateR=all.filter(([,r])=>r.kind==="receita"&&finLate(r)),lateP=all.filter(([,r])=>r.kind==="despesa"&&finLate(r));
  const res=finSum(rec)-finSum(des);
  const tile=(n,l,c,sub)=>`<div class="card stat" style="--sc:${c}"><div class="n">${n}</div><div class="l">${l}</div>${sub?`<div class="small muted">${sub}</div>`:""}</div>`;
  const head=`<div class="head"><div><h1>Financeiro</h1><p class="muted">O que está entrando, custos com anúncios, contas a pagar e a receber. Só você vê esta área.</p></div>
    <div class="row"><button class="btn" data-act="new-fin" data-v="despesa">+ Despesa / conta a pagar</button><button class="btn primary" data-act="new-fin" data-v="receita">+ Entrada / a receber</button></div></div>
    <div class="row" style="justify-content:space-between;margin-bottom:16px"><div class="period"><button class="btn ghost" data-act="fin-month" data-v="-1" aria-label="Mês anterior">‹</button><span class="lbl">${ymLabel(ym)}</span><button class="btn ghost" data-act="fin-month" data-v="1" aria-label="Próximo mês">›</button>${ym!==TODAY.slice(0,7)?`<button class="btn small" data-act="fin-month" data-v="0">Este mês</button>`:""}</div></div>`;
  const miss=feesMissing(ym);
  const banners=(miss.length?`<div class="banner"><span><b>${miss.length} mensalidade${miss.length===1?"":"s"}</b> de ${ymLabel(ym)} ainda não lançada${miss.length===1?"":"s"} (${BRL2(miss.reduce((a,[,c])=>a+Number(c.fee),0))}).</span><button class="btn primary" data-act="fin-fees">Lançar mensalidades</button></div>`:"")
    +(lateR.length||lateP.length?`<div class="banner"><span class="late-txt">Vencidas:</span><span>${lateR.length?`${lateR.length} a receber (${BRL2(finSum(lateR))})`:""}${lateR.length&&lateP.length?" · ":""}${lateP.length?`${lateP.length} a pagar (${BRL2(finSum(lateP))})`:""}</span></div>`:"");
  if(!all.length&&!miss.length)return head+`<div class="card pad" style="text-align:center;padding:40px 20px"><h2>Nenhum lançamento ainda</h2><p class="muted">Lance o que você tem a receber dos clientes e as despesas, como anúncios, ferramentas e freelas. Dica: em <b>Clientes → Editar</b>, cadastre a mensalidade e o dia de vencimento de cada um para lançar todas de uma vez.</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="new-fin" data-v="despesa">+ Despesa</button><button class="btn primary" data-act="new-fin" data-v="receita">+ Entrada</button></div></div>`;
  const stats=`<div class="stats crm-stats">
    ${tile(BRL2(finSum(paid(rec))),"Recebido","var(--ok)",`de ${BRL2(finSum(rec))} previstos`)}
    ${tile(BRL2(finSum(open(rec))),"A receber","var(--s2)",`${open(rec).length} conta${open(rec).length===1?"":"s"}`)}
    ${tile(BRL2(finSum(paid(des))),"Pago","var(--s4)",`de ${BRL2(finSum(des))} previstos`)}
    ${tile(BRL2(finSum(open(des))),"A pagar","var(--warn)",`${open(des).length} conta${open(des).length===1?"":"s"}`)}
    ${tile(BRL2(finSum(ads)),"Investido em anúncios","var(--s5)",finSum(rec)?`${Math.round(finSum(ads)/finSum(rec)*100)}% das entradas`:"")}
    ${tile(`<span style="color:${res<0?"var(--warn)":"inherit"}">${BRL2(res)}</span>`,"Resultado do mês","var(--accent)","entradas − saídas")}</div>`;
  const byDue=(a,b)=>(a[1].due||"9999").localeCompare(b[1].due||"9999");
  const listOf=(month,late)=>{const ids=new Set(month.map(x=>x[0]));return late.filter(x=>!ids.has(x[0])).sort(byDue).concat(month.slice().sort((a,b)=>(a[1].paid-b[1].paid)||byDue(a,b)))};
  const recL=listOf(rec,lateR),desL=listOf(des,lateP);
  const block=(title,list,kind,tot)=>`<section><div class="sec-title"><h2>${title}</h2><span class="small muted">${list.length?BRL2(tot)+" no mês":""}</span></div>
    <div class="card list">${list.map(finRow).join("")||`<div class="empty">Nada lançado em ${ymLabel(ym)}.</div>`}
    <button class="add-in-col" style="display:block;width:100%;box-sizing:border-box;border-top:1px solid var(--line);border-radius:0;padding:10px" data-act="new-fin" data-v="${kind}">+ ${kind==="receita"?"Nova entrada":"Nova despesa"}</button></div></section>`;
  /* histórico: 6 meses até o mês escolhido, entradas e saídas na mesma escala */
  const months=[...Array(6)].map((_,i)=>ymAdd(ym,i-5));
  const hist=months.map(m=>{const l=all.filter(([,r])=>(r.due||"").startsWith(m));return [m,finSum(l.filter(([,r])=>r.kind==="receita")),finSum(l.filter(([,r])=>r.kind==="despesa"))]});
  const hmax=Math.max(1,...hist.flatMap(h=>[h[1],h[2]]));
  const histHtml=`<section class="agenda"><div class="sec-title"><h2>Últimos 6 meses</h2><div class="legend"><span><i style="background:var(--accent)"></i>Entradas</span><span><i style="background:var(--s4)"></i>Saídas</span></div></div>
    <div class="card" style="overflow-x:auto"><table class="fhist"><thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Resultado</th><th style="width:34%"><span class="sr">Comparação</span></th></tr></thead><tbody>
    ${hist.map(([m,e,s])=>`<tr class="${m===ym?"cur":""}"><td>${ymLabel(m)}</td><td class="num money">${BRL2(e)}</td><td class="num money">${BRL2(s)}</td><td class="num money" style="${e-s<0?"color:var(--warn)":""}">${BRL2(e-s)}</td>
      <td><div class="fbars" title="Entradas ${BRL2(e)} · Saídas ${BRL2(s)}"><i style="width:${e/hmax*100}%;background:var(--accent)"></i><i style="width:${s/hmax*100}%;background:var(--s4)"></i></div></td></tr>`).join("")}</tbody></table></div></section>`;
  const side=`<div style="display:grid;gap:18px">
    <section><div class="sec-title"><h2>Custos com anúncios</h2><span class="small muted">${BRL2(finSum(ads))}</span></div>
      <div class="card"><div class="fu-group">Por plataforma</div>${finBars(groupBy(ads,r=>r.platform||"Sem plataforma"),"var(--s5)","Nenhum anúncio lançado neste mês.")}
      <div class="fu-group">Por cliente</div>${finBars(groupBy(ads,r=>r.clientId&&D.clients[r.clientId]?cName(r.clientId):"Sem cliente"),"var(--s5)","—")}</div></section>
    <section><div class="sec-title"><h2>Entradas por cliente</h2></div>
      <div class="card">${finBars(groupBy(rec,r=>r.clientId&&D.clients[r.clientId]?cName(r.clientId):"Sem cliente"),"var(--accent)","Nenhuma entrada lançada neste mês.")}</div></section>
    <section><div class="sec-title"><h2>Saídas por categoria</h2></div>
      <div class="card">${finBars(groupBy(des,r=>r.category||"Outros"),"var(--s4)","Nenhuma despesa lançada neste mês.")}</div></section></div>`;
  return head+banners+stats+`<div class="grid2"><div style="display:grid;gap:18px">${block("Contas a receber",recL,"receita",finSum(rec))}${block("Contas a pagar",desL,"despesa",finSum(des))}</div>${side}</div>`+histHtml;
}
function finCatOptions(kind,sel){return FINCAT[kind].map(c=>`<option ${c===sel?"selected":""}>${esc(c)}</option>`).join("")}
function finModal(id,preset){
  const r=id?D.fin[id]:{kind:preset.kind||"receita",category:"",description:"",clientId:"",platform:PLATS[0],amount:"",due:TODAY,paid:false,notes:""};
  if(!r)return;
  const cat=r.category||FINCAT[r.kind][0];
  openModal(id?(r.kind==="receita"?"Editar entrada":"Editar despesa"):(r.kind==="receita"?"Nova entrada / conta a receber":"Nova despesa / conta a pagar"),`
    <div class="f2"><label class="fl">Tipo<select class="sel" name="kind" data-change="fin-kind" style="width:100%"><option value="receita" ${r.kind==="receita"?"selected":""}>Entrada (a receber)</option><option value="despesa" ${r.kind==="despesa"?"selected":""}>Despesa (a pagar)</option></select></label>
    <label class="fl">Categoria<select class="sel" name="category" data-change="fin-cat" style="width:100%">${finCatOptions(r.kind,cat)}</select></label></div>
    <label class="fl">Descrição<input class="inp" name="description" value="${esc(r.description)}" placeholder="Ex.: Mensalidade de novembro, Campanha de Natal, Canva Pro"></label>
    <div class="f2"><label class="fl">Cliente<span class="hint">Opcional. Para saber quanto cada cliente traz e custa.</span><select class="sel" name="clientId" style="width:100%"><option value="">Nenhum</option>${clientOptions(r.clientId)}</select></label>
    <label class="fl" id="fin-plat" ${cat===ADCAT?"":"hidden"}>Plataforma do anúncio<span class="hint">Onde o anúncio rodou.</span><select class="sel" name="platform" style="width:100%">${PLATS.map(p=>`<option ${p===r.platform?"selected":""}>${p}</option>`).join("")}</select></label></div>
    <div class="f2"><label class="fl">Valor (R$)<input class="inp" name="amount" value="${r.amount===""?"":esc(String(r.amount).replace(".",","))}" inputmode="decimal" placeholder="0,00"></label>
    <label class="fl">Vencimento<input class="inp" type="date" name="due" value="${esc(r.due||"")}"></label></div>
    <label class="fl" id="fin-pay-f" ${r.kind==="receita"?"":"hidden"}>Link de pagamento ou chave PIX<span class="hint">Opcional. O cliente vê na fatura, em Pagamentos.</span><input class="inp" name="payLink" value="${esc(r.payLink||"")}" placeholder="https://… ou a chave PIX" autocomplete="off"></label>
    <label class="perm" style="border-radius:10px"><input type="checkbox" name="paid" ${r.paid?"checked":""}><div><b id="fin-paid-l">${r.kind==="receita"?"Já recebi":"Já paguei"}</b><span>Desmarcado, fica em aberto em "${r.kind==="receita"?"Contas a receber":"Contas a pagar"}".</span></div></label>
    ${id?"":`<label class="fl">Repetir todo mês<span class="hint">Cria um lançamento por mês, no mesmo dia (ex.: assinaturas, mensalidades).</span><select class="sel" name="repeat" style="width:100%"><option value="1">Não repetir</option>${[2,3,4,5,6,9,12].map(n=>`<option value="${n}">Por ${n} meses</option>`).join("")}</select></label>`}
    <label class="fl">Observações<span class="hint">Em entradas ligadas a um cliente, o cliente também vê este texto.</span><textarea class="inp" name="notes" style="min-height:60px">${esc(r.notes||"")}</textarea></label>`,
    `<div>${id?delBtn("del-fin",id):""}</div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar</button></div>`,
    async f=>{
      const amount=parseMoney(val(f,"amount"));if(!(amount>0)){toast("Informe um valor maior que zero.");return false}
      const due=val(f,"due");if(!due){toast("Informe a data de vencimento.");return false}
      const kind=val(f,"kind"),category=val(f,"category"),paidNow=!!val(f,"paid");
      const data={...(id?r:{createdAt:Date.now()}),kind,category,description:val(f,"description"),clientId:val(f,"clientId"),platform:category===ADCAT?val(f,"platform"):"",payLink:kind==="receita"?val(f,"payLink"):"",amount,due,paid:paidNow,paidDate:paidNow?(r.paid&&r.paidDate?r.paidDate:TODAY):"",notes:val(f,"notes")};
      if(id){if(!(await put("fin",id,data)))return false;toast("Lançamento salvo.");return}
      const n=Number(val(f,"repeat"))||1,day=Number(due.slice(8,10));
      for(let i=0;i<n;i++){const d=i?dueIn(ymAdd(due.slice(0,7),i),day):due;
        if(!(await put("fin",newId(),{...data,due:d,paid:i?false:data.paid,paidDate:i?"":data.paidDate})))return false}
      toast(n>1?`${n} lançamentos criados.`:"Lançamento salvo.");
    });
}
async function launchFees(ym){
  const miss=feesMissing(ym);let n=0;
  for(const[cid,c]of miss){if(await put("fin","m-"+cid+"-"+ym,{kind:"receita",category:"Mensalidade de cliente",description:"Mensalidade · "+c.name,clientId:cid,platform:"",amount:Number(c.fee),due:dueIn(ym,c.dueDay||10),paid:false,paidDate:"",notes:"",createdAt:Date.now()}))n++;else break}
  if(n)toast(`${n} mensalidade${n===1?"":"s"} lançada${n===1?"":"s"} em Contas a receber.`);
}

/* ----- acessos ----- */
function usersOf(cid){return Object.values(USERS).filter(u=>u.role==="client"&&u.client_id===cid)}
function userStatus(u){return u.blocked?`<span class="chip st-warn">Bloqueado</span>`:u.must_change_password?`<span class="chip st-aprovacao">Aguardando 1º acesso</span>`:`<span class="chip st-ok">Ativo</span>`}
function accessView(){
  const cs=clientsSorted();
  const head=`<div class="head"><div><h1>Acessos dos clientes</h1><p class="muted">Cada login vê apenas a empresa dele. Você cria o acesso, envia a senha provisória e o cliente troca no primeiro acesso.</p></div></div>`;
  if(!cs.length)return head+emptyClients();
  const opts=sel=>cs.map(([id,c])=>`<option value="${id}" ${sel===id?"selected":""}>${esc(c.name)}</option>`).join("");
  const accCid=UI.accClient&&D.clients[UI.accClient]?UI.accClient:cs[0][0];
  const us=Object.values(USERS).filter(u=>u.role==="client").sort((a,b)=>(cName(a.client_id)+a.email).localeCompare(cName(b.client_id)+b.email,"pt-BR"));
  const list=us.length?us.map(u=>`<div class="li" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-weight:700">${esc(u.name||u.email)} ${userStatus(u)}</div><div class="small muted">${esc(u.email)}</div>
    ${D.clients[u.client_id]?`<button class="btn ghost small" style="padding:2px 0;margin-top:2px" data-act="edit-client" data-id="${esc(u.client_id)}">Permissões: ${(()=>{const pm=permsOf(u.client_id),k=PERMS.filter(p=>pm[p.k]).length;return k===PERMS.length?"todas":k+" de "+PERMS.length})()} · editar</button>`:`<div class="small st-warn">Sem empresa: escolha uma ao lado.</div>`}</div>
    <div class="acc-actions"><select class="sel" data-change="user-client" data-id="${esc(u.id)}" aria-label="Empresa" style="width:auto">${D.clients[u.client_id]?"":`<option value="">Escolha…</option>`}${opts(u.client_id)}</select>
    <button class="btn" data-act="reset-pw" data-id="${esc(u.id)}">Resetar senha</button>
    <button class="btn ${u.blocked?"":"ghost danger"}" data-act="block-user" data-id="${esc(u.id)}" data-v="${u.blocked?"0":"1"}">${u.blocked?"Desbloquear":"Bloquear"}</button>
    <button class="btn ghost danger" data-act="remove-user" data-id="${esc(u.id)}">Excluir</button></div></div>`).join("")
    :`<div class="empty">Nenhum acesso criado ainda.</div>`;
  return head+`<div class="grid2"><section><div class="card list">${list}</div></section>
  <form class="card pad" id="acc-form" style="display:grid;gap:14px" novalidate><h3>Criar acesso</h3>
    <label class="fl">Empresa<select class="sel" name="clientId" data-change="acc-client" style="width:100%">${opts(accCid)}</select></label>
    <label class="fl">Nome da pessoa<input class="inp" name="name" placeholder="Ex.: Marta" autocomplete="off"></label>
    <label class="fl">E-mail de acesso<input class="inp" type="email" name="email" placeholder="cliente@empresa.com" autocomplete="off"></label>
    <div class="fl">Logo ou foto da empresa<span class="hint">Opcional. Aparece no menu e no topo da área do cliente. Se a empresa já tiver uma, a nova substitui.</span>
      <div class="logo-prev">${ACC_LOGO?`<div class="pavatar"><img src="${esc(ACC_LOGO_URL)}" alt="Prévia da logo"></div>`:avatarHtml(D.clients[accCid])}
        <label class="btn" for="acc-logo">${ACC_LOGO?"Trocar imagem":"Escolher imagem"}</label><input type="file" id="acc-logo" data-change="acc-logo" accept="${LOGOTYPES.join(",")}" style="position:absolute;width:1px;height:1px;opacity:0">
        ${ACC_LOGO?`<button type="button" class="btn ghost small" data-act="acc-logo-clear">Remover</button>`:""}</div>
      ${ACC_LOGO?`<div class="row"><span class="small muted" style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(ACC_LOGO.name)}</span><button type="button" class="btn small" data-act="acc-logo-save">Salvar só a logo</button></div>`:""}</div>
    <button class="btn primary" type="submit">Criar acesso e gerar senha</button>
    <p class="small muted" style="margin:0">O sistema gera uma senha provisória. Envie para o cliente: no primeiro acesso ele cria a própria senha. Se ele esquecer, use <b>Resetar senha</b>. Se não pagar, use <b>Bloquear</b>.</p>
  </form></div>`;
}
/* chamadas para a função segura do servidor (criar login, resetar, bloquear, excluir) */
async function adminCall(body){
  if(demo){toast("No modo demonstração não dá para criar logins.");return null}
  const {data,error}=await sb.functions.invoke("admin-users",{body});
  if(error){let m="Não foi possível concluir agora.";try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(e){}toast(m);scheduleRender();return null}
  if(data&&data.error){toast(data.error);scheduleRender();return null}
  await loadUsers();return data||{};
}
async function loadUsers(){
  if(demo||!isOwner)return;
  const {data,error}=await sb.from("profiles").select("*");
  if(!error){USERS=Object.fromEntries((data||[]).map(u=>[u.id,u]));scheduleRender()}
}
function siteUrl(){return location.origin+location.pathname.replace(/index\.html$/,"")}
function passwordModal(title,u,pw,isNew){
  const msg=`Olá${u.name?", "+u.name:""}! ${isNew?"Seu acesso à Avélis está pronto.":"Sua senha da Avélis foi redefinida."}\n\nLink: ${siteUrl()}\nE-mail: ${u.email}\nSenha provisória: ${pw}\n\nNo primeiro acesso você vai criar sua própria senha.`;
  openModal(title,`<div class="pwbox"><div class="small muted">Senha provisória de <b>${esc(u.email)}</b></div><span class="code">${esc(pw)}</span>
    <div class="small muted">Ela aparece só agora. Copie e envie ao cliente.</div></div>
    <div class="fl">Mensagem pronta para enviar<div class="msgbox">${esc(msg)}</div></div>`,
    `<div></div><div class="row"><button type="button" class="btn" data-act="copy" data-v="${esc(pw)}">Copiar senha</button><button type="button" class="btn primary" data-act="copy" data-v="${esc(msg)}">Copiar mensagem</button></div>`,null);
}
async function createAccess(f){
  const email=f.elements.email.value.trim().toLowerCase(),name=f.elements.name.value.trim(),clientId=f.elements.clientId.value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast("Informe um e-mail válido.");return}
  const btn=f.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Criando…";
  const logo=ACC_LOGO;
  const r=await adminCall({action:"create",email,name,clientId});
  btn.disabled=false;btn.textContent="Criar acesso e gerar senha";
  if(!r)return;
  if(logo&&await uploadLogo(clientId,logo))setAccLogo(null);
  f.reset();passwordModal("Acesso criado",{email,name},r.password,true);
}
/* logo escolhida no formulário de acesso (fica guardada mesmo se a tela redesenhar) */
let ACC_LOGO=null,ACC_LOGO_URL="";
function setAccLogo(file){if(ACC_LOGO_URL)URL.revokeObjectURL(ACC_LOGO_URL);ACC_LOGO=file||null;ACC_LOGO_URL=file?URL.createObjectURL(file):"";scheduleRender()}

/* ----- portal do cliente ----- */
function portalView(cid,preview){
  const c=D.clients[cid];CUR=permsOf(cid);
  const pa=pendingApprovals(cid);
  const myTasks=Object.entries(D.tasks).filter(([,t])=>t.clientId===cid);
  const openTasks=myTasks.filter(([id])=>!(D.taskdone[id]||{}).done).length;
  const inv=invoiceAlerts(cid);
  const tabs=[["agenda","Agenda",0,"verAgenda"],["aprovar","Para aprovar",pa.length,"aprovar"],["andamento","Andamento",0,"verAndamento"],["tarefas","Minhas tarefas",openTasks,"tarefas"],["faturas","Pagamentos",inv.length,"faturas"]].filter(t=>can(t[3]));
  if(tabs.length&&!tabs.some(t=>t[0]===UI.ctab))UI.ctab=tabs[0][0];
  let body="";
  const opts={admin:false,showClient:false,clientMode:true};
  if(!tabs.length)body=`<div class="card locked"><h2>Nada liberado por enquanto</h2><p class="muted">Sua social media ainda não liberou nenhuma área para você. Fale com ela para ter acesso.</p></div>`;
  else if(UI.ctab==="agenda"){const idx=dayIndex(cid);if(!can("tarefas"))for(const k in idx){idx[k]=idx[k].filter(it=>it.type!=="task");if(!idx[k].length)delete idx[k]}body=`<div class="calwrap"><div class="card">${calBar()}${calendarGrid(idx,false)}</div>${dayPanel(idx,opts)}</div>${agendaList(idx,opts)}`}
  else if(UI.ctab==="aprovar")body=approveTab(cid);
  else if(UI.ctab==="andamento")body=progressTab(cid);
  else if(UI.ctab==="faturas")body=paymentsTab(cid);
  else body=tasksTab(myTasks);
  const cur=tabs.find(t=>t[0]===UI.ctab);
  return `<div class="shell ${UI.menuOpen?"menu-open":""}">${mobileBar(c.name,tabs.reduce((a,t)=>a+(t[2]||0),0))}<aside class="side client" id="side-menu">
    <div class="welcome">Bem vindo!</div>
    <div class="cbrand">${avatarHtml(c)}<div style="min-width:0"><b>${esc(c.name)}</b>${c.instagram?`<span>${esc(c.instagram)}</span>`:""}</div></div>
    <nav class="nav" aria-label="Seções">${tabs.map(([k,l,n])=>`<button data-act="ctab" data-v="${k}" aria-current="${UI.ctab===k}">${l}${n?`<span class="count">${n}</span>`:""}</button>`).join("")}</nav>
    <div class="foot"><div class="row">${themeBtn("ghost small")}${preview?`<button class="btn ghost small" data-act="exit-preview">Voltar ao painel</button>`:demo?"":`<button class="btn ghost small" data-act="logout">Sair</button>`}</div></div>
  </aside><main class="main">
    ${preview?`<div class="banner"><span>Você está vendo a área de <b>${esc(c.name)}</b> como o cliente vê.</span><button class="btn" data-act="exit-preview">Voltar ao painel</button></div>`:""}
    ${demo&&!preview?`<div class="banner">Modo demonstração.</div>`:""}${can("faturas")&&inv.length&&UI.ctab!=="faturas"?invoiceBanner(inv):""}${UI.readOnly?`<div class="banner"><span>Seu acesso é somente leitura. Para aprovar, responda à sua social media pelo canal de sempre.</span></div>`:""}
    <div class="phead">${avatarHtml(c)}<div style="flex:1"><h1>${esc(cur?cur[1]:c.name)}</h1><div class="muted small">${esc([c.name,c.segment].filter(Boolean).join(" · "))}</div></div></div>
    ${body}</main></div>`;
}
/* ----- pagamentos do cliente: faturas = entradas do Financeiro ligadas à empresa ----- */
const AVISO_DIAS=5; /* quantos dias antes do vencimento o aviso aparece */
function daysUntil(s){const d=parse(s);return d?Math.round((d-parse(TODAY))/864e5):null}
function invoicesOf(cid){return finArr().filter(([,r])=>r.kind==="receita"&&r.clientId===cid)}
/* faturas em aberto vencidas ou que vencem nos próximos AVISO_DIAS dias */
function invoiceAlerts(cid){return invoicesOf(cid).filter(([,r])=>!r.paid&&r.due&&daysUntil(r.due)<=AVISO_DIAS).sort((a,b)=>a[1].due.localeCompare(b[1].due))}
function dueWords(r){const n=daysUntil(r.due);return n<0?`venceu em ${short(r.due)}`:n===0?"vence hoje":n===1?"vence amanhã":`vence em ${n} dias (${short(r.due)})`}
function invoiceBanner(inv){
  const late=inv.filter(([,r])=>daysUntil(r.due)<0),[,first]=inv[0];
  const txt=inv.length===1?`Sua fatura de <b>${BRL2(first.amount)}</b> ${dueWords(first)}.`:`Você tem <b>${inv.length} faturas</b> ${late.length?"vencidas ou ":""}perto do vencimento (${BRL2(inv.reduce((a,[,r])=>a+Number(r.amount||0),0))}).`;
  return `<div class="banner inv-alert ${late.length?"late":""}" role="alert"><span>⚠ ${txt}</span><button class="btn primary" data-act="ctab" data-v="faturas">Ver pagamentos</button></div>`;
}
function invStatus(r){
  if(r.paid)return `<span class="chip st-ok">Paga${r.paidDate?" em "+short(r.paidDate):""}</span>`;
  const n=daysUntil(r.due);
  if(n===null)return `<span class="chip st-desenvolvimento">Em aberto</span>`;
  if(n<0)return `<span class="chip st-warn">Vencida</span>`;
  if(n<=AVISO_DIAS)return `<span class="chip st-aprovacao">${n===0?"Vence hoje":n===1?"Vence amanhã":"Vence em "+n+" dias"}</span>`;
  return `<span class="chip st-desenvolvimento">A vencer</span>`;
}
function payHow(r){
  const p=(r.payLink||"").trim();if(!p||r.paid)return "";
  if(/^https?:\/\//i.test(p))return `<a class="btn primary" href="${esc(safeUrl(p))}" target="_blank" rel="noopener">Pagar agora</a>`;
  return `<div class="pix"><span class="small muted">Chave PIX</span><span class="code">${esc(p)}</span><button type="button" class="btn small" data-act="copy" data-v="${esc(p)}">Copiar chave</button></div>`;
}
function invCard([id,r]){
  const n=r.paid?null:daysUntil(r.due),hot=!r.paid&&n!==null&&n<=AVISO_DIAS;
  return `<div class="card inv ${hot?(n<0?"late":"soon"):""}"><div class="inv-top"><div style="min-width:0"><div style="font-weight:700">${esc(r.description||"Fatura")}</div>
    <div class="small muted">${r.paid?"Paga"+(r.paidDate?" em "+longDay(r.paidDate):""):"Vencimento: "+(r.due?longDay(r.due):"a definir")}</div></div>
    <div style="text-align:right;flex:none"><div class="inv-amt">${BRL2(r.amount)}</div>${invStatus(r)}</div></div>
    ${r.notes?`<div class="small" style="white-space:pre-wrap">${esc(r.notes)}</div>`:""}${payHow(r)}</div>`;
}
function paymentsTab(cid){
  const all=invoicesOf(cid),open=all.filter(([,r])=>!r.paid).sort((a,b)=>(a[1].due||"9999").localeCompare(b[1].due||"9999"));
  const paid=all.filter(([,r])=>r.paid).sort((a,b)=>(b[1].paidDate||b[1].due||"").localeCompare(a[1].paidDate||a[1].due||""));
  const late=open.filter(([,r])=>r.due&&r.due<TODAY),sum=l=>l.reduce((a,[,r])=>a+Number(r.amount||0),0);
  const yAgo=ymd(addDays(new Date(),-365)),paidY=paid.filter(([,r])=>(r.paidDate||r.due||"")>=yAgo);
  const inv=invoiceAlerts(cid);
  const tile=(n,l,c)=>`<div class="card stat" style="--sc:${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  return `${inv.length?invoiceBanner(inv).replace(/<button[^>]*>Ver pagamentos<\/button>/,""):""}
    <div class="stats">${tile(BRL2(sum(open)),`A vencer (${open.length})`,"var(--s6)")}${tile(BRL2(sum(late)),`Vencidas (${late.length})`,"var(--warn)")}${tile(BRL2(sum(paidY)),"Pago nos últimos 12 meses","var(--ok)")}</div>
    <div class="sec-title"><h2>Faturas a vencer</h2></div>
    <div class="inv-list">${open.map(invCard).join("")||`<div class="card"><div class="empty" style="padding:30px">Nenhuma fatura em aberto. Tudo em dia!</div></div>`}</div>
    <div class="agenda"><div class="sec-title"><h2>Faturas pagas</h2></div>
    ${paid.length?`<div class="card list">${paid.map(([,r])=>`<div class="li"><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(r.description||"Fatura")}</div><div class="small muted">Vencimento ${r.due?short(r.due):"—"}${r.paidDate?" · paga em "+short(r.paidDate):""}</div></div><div style="text-align:right"><div class="money">${BRL2(r.amount)}</div><span class="chip st-ok">Paga</span></div></div>`).join("")}</div>`:`<div class="card"><div class="empty" style="padding:30px">Nenhuma fatura paga ainda.</div></div>`}</div>`;
}
/* aviso em janela, uma vez por visita, quando há fatura vencida ou perto de vencer */
let INV_ALERTED=false;
function maybeInvoicePopup(cid){
  if(INV_ALERTED||$("#modal .back"))return;const inv=invoiceAlerts(cid);if(!inv.length){if(loaded.has("fin"))INV_ALERTED=true;return}
  INV_ALERTED=true;
  openModal("Aviso de pagamento",`<div class="inv-list">${inv.map(([,r])=>`<div class="card inv ${daysUntil(r.due)<0?"late":"soon"}"><div class="inv-top"><div style="min-width:0"><div style="font-weight:700">${esc(r.description||"Fatura")}</div><div class="small muted">Sua fatura ${dueWords(r)}.</div></div><div style="text-align:right;flex:none"><div class="inv-amt">${BRL2(r.amount)}</div>${invStatus(r)}</div></div>${payHow(r)}</div>`).join("")}</div>
    <p class="small muted" style="margin:0">Se você já pagou, desconsidere. A baixa aparece aqui assim que a sua social media confirmar o recebimento.</p>`,
    `<div></div><div class="row"><button type="button" class="btn" data-act="close">Fechar</button><button type="button" class="btn primary" data-act="inv-go">Ver pagamentos</button></div>`,null);
}
/* avatar da empresa: logo/foto enviada pela social media, ou as iniciais na cor do cliente */
function avatarHtml(c){
  const src=c.logoUrl||(c.logo?mediaSrc({id:c.logo}):"");
  return `<div class="pavatar" style="--cc:${esc(c.color||"#888")}">${c.logo||c.logoUrl?`<img ${src?`src="${esc(src)}"`:""} ${c.logo?`data-mid="${esc(c.logo)}"`:""} alt="Logo de ${esc(c.name)}">`:esc(initials(c.name))}</div>`;
}
/* envia a logo/foto para media/<empresa>/ e grava no cadastro do cliente (substitui a anterior) */
const LOGOTYPES=["image/png","image/jpeg","image/webp","image/gif"];
async function uploadLogo(cid,file){
  const c=D.clients[cid];if(!c||!file)return false;
  if(!LOGOTYPES.includes(file.type)){toast("Para a logo use uma imagem JPG, PNG ou WEBP.");return false}
  if(file.size>5*1024*1024){toast("A logo passa de 5 MB. Use uma imagem menor.");return false}
  if(demo)return put("clients",cid,{...R.clients[cid],logoUrl:URL.createObjectURL(file)});
  const ext=(file.name.split(".").pop()||"").toLowerCase().replace(/[^a-z0-9]/g,"")||"png";
  const path=cid+"/logo-"+newId()+"."+ext;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(error){toast("Não foi possível enviar a logo. Tente de novo.");return false}
  const old=R.clients[cid].logo;
  const ok=await put("clients",cid,{...R.clients[cid],logo:path,logoUrl:null});
  if(ok&&old)deleteAssets([old]);
  if(!ok)deleteAssets([path]);
  return ok;
}
function stepper(p){
  const s=ST[p.status],i=s?s.i:0,n=nextStatus(p.status);
  return `<div class="steps" style="--sc:${s?s.c:"var(--line)"}">${STATUSES.map((x,j)=>`<span class="${j<=i?"on":""}" title="${esc(x.l)}"></span>`).join("")}</div>
  <div class="stepinfo"><span>Etapa ${i+1} de ${STATUSES.length} · <b style="color:var(--ink)">${s?s.l:""}</b></span>${n?`<span>Próxima: ${n.l}</span>`:""}</div>`;
}
function approveTab(cid){
  const pa=pendingApprovals(cid);
  const done=Object.entries(D.posts).filter(([id,p])=>p.clientId===cid&&p.status==="postagem"&&!p.posted);
  const card=([id,p])=>{const a=approvalOf(id);return `<div class="card approve"><div class="row" style="justify-content:space-between"><div><div class="small muted">${esc(p.format||"")} · publicação ${p.postDate?longDay(p.postDate):"a definir"}</div><h3>${esc(p.title)}</h3></div>${apBadge(id,p)}</div>
    ${mediaGallery(p.media,true)}
    ${p.caption&&can("verLegenda")?`<div><div class="small muted" style="font-weight:600;margin-bottom:4px">Legenda</div><div class="caption">${esc(p.caption)}</div></div>`:""}
    ${p.brief&&can("verLegenda")?`<div class="small"><b>Sobre o conteúdo:</b> ${esc(p.brief)}</div>`:""}
    ${p.link?`<a href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener" class="btn" style="align-self:flex-start">Abrir prévia do conteúdo</a>`:""}
    ${a&&a.decision==="ajuste"?`<div class="small st-warn"><b>Seu pedido de ajuste:</b> ${esc(a.comment||"")}</div>`:""}
    <div class="row">${doneBtn(id,p)}${can("aprovar")?`<button class="btn" data-act="adjust" data-id="${id}" ${UI.readOnly?"disabled":""}>Pedir ajuste</button>`:`<span class="small muted">A aprovação deste conteúdo é feita pela social media.</span>`}</div></div>`};
  return `${pa.length?`<div class="cards one">${pa.map(card).join("")}</div>`:`<div class="card"><div class="empty" style="padding:30px">Nenhum conteúdo esperando sua aprovação.</div></div>`}
  ${done.length?`<div class="agenda"><div class="sec-title"><h2>Aprovados, aguardando publicação</h2></div><div class="card list">${done.map(([id,p])=>`<div class="li"><div style="flex:1"><div style="font-weight:600">${esc(p.title)}</div><div class="small muted">Publicação ${p.postDate?longDay(p.postDate):"a definir"}</div></div><span class="chip st-postagem">Postagem</span></div>`).join("")}</div></div>`:""}`;
}
function safeUrl(u){return /^https?:\/\//i.test(u||"")?u:"#"}
function progressTab(cid){
  const ps=Object.entries(D.posts).filter(([,p])=>p.clientId===cid).sort((a,b)=>(a[1].postDate||"9999").localeCompare(b[1].postDate||"9999"));
  const live=ps.filter(([,p])=>!p.posted),posted=ps.filter(([,p])=>p.posted);
  const row=([id,p])=>`<div class="li"><div style="flex:1;min-width:0"><div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><div style="font-weight:700">${esc(p.title)}</div><div class="small muted">${esc(p.format||"")}${p.recordDate?" · gravação "+short(p.recordDate):""}${p.postDate?" · publicação "+short(p.postDate):""}</div></div>
    <div class="row">${p.posted?`<span class="chip st-ok">Publicado</span>${p.postedUrl?`<a class="btn ghost" href="${esc(safeUrl(p.postedUrl))}" target="_blank" rel="noopener">Ver publicação</a>`:""}`:apBadge(id,p)}<button class="btn ghost" data-act="view-post" data-id="${id}">Detalhes</button>${doneBtn(id,p)}</div></div>${p.posted?"":stepper(p)}</div></div>`;
  return `${can("concluir")?`<p class="small muted" style="margin:0 0 10px">Terminou a sua parte em uma etapa? Clique em <b>Ação concluída</b> e o conteúdo segue para a próxima.</p>`:""}
  <div class="card list">${live.map(row).join("")||`<div class="empty" style="padding:30px">Nenhum conteúdo em andamento.</div>`}</div>
  ${posted.length?`<div class="agenda"><div class="sec-title"><h2>Já publicados</h2></div><div class="card list">${posted.map(row).join("")}</div></div>`:""}`;
}
function tasksTab(list){
  const sorted=list.sort((a,b)=>(a[1].date||"").localeCompare(b[1].date||""));
  const open=sorted.filter(([id])=>!(D.taskdone[id]||{}).done),done=sorted.filter(([id])=>(D.taskdone[id]||{}).done);
  const it=([id,t])=>itemHtml({type:"task",id,t,cid:t.clientId},{admin:false,showClient:false,clientMode:true}).replace('<div class="type task">Tarefa</div>',`<div class="type task">${t.date?longDay(t.date):"Sem data"}</div>`);
  return `<div class="card">${open.map(it).join("")||`<div class="empty" style="padding:30px">Nenhuma tarefa pendente.</div>`}</div>
  ${done.length?`<div class="agenda"><div class="sec-title"><h2>Concluídas</h2></div><div class="card">${done.map(it).join("")}</div></div>`:""}`;
}

/* ---------- modais ---------- */
let modalSubmit=null;
let modalCancel=null;
function openModal(title,body,footer,onSubmit,onCancel){
  modalCancel=onCancel||null;
  modalSubmit=onSubmit;
  $("#modal").innerHTML=`<div class="back" data-act="modal-back"><form class="dlg" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate>
  <div class="dlg-h"><h2>${esc(title)}</h2><button type="button" class="btn ghost" data-act="close" aria-label="Fechar">✕</button></div>
  <div class="dlg-b">${body}</div><div class="dlg-f">${footer}</div></form></div>`;
  const f=$("#modal form");
  f.addEventListener("submit",async e=>{e.preventDefault();if(modalSubmit){const ok=await modalSubmit(f);if(ok!==false){modalCancel=null;closeModal()}}});
  const first=f.querySelector("input,select,textarea");if(first)first.focus();
}
function closeModal(){const c=modalCancel;modalCancel=null;$("#modal").innerHTML="";modalSubmit=null;if(c)c()}
const val=(f,n)=>{const el=f.elements[n];return el?(el.type==="checkbox"?el.checked:el.value.trim()):""};
function clientOptions(sel){return clientsSorted().map(([id,c])=>`<option value="${id}" ${sel===id?"selected":""}>${esc(c.name)}</option>`).join("")}
function delBtn(act,id){return `<button type="button" class="btn ghost danger" data-act="${act}" data-id="${id}">Excluir</button>`}

/* ---------- fotos e vídeos ---------- */
const OKTYPES=["image/png","image/jpeg","image/webp","image/gif","video/mp4","video/webm"];
/* arquivos ficam num bucket privado; o navegador recebe links temporários (6 h) */
const SIGNED={};let signQ=new Set(),signT=null;
function mediaSrc(m){if(m.url)return m.url;const s=SIGNED[m.id];if(s&&s.exp>Date.now())return s.url;queueSign([m.id]);return ""}
function queueSign(ids){if(demo||!sb)return;ids.forEach(id=>{const s=SIGNED[id];if(id&&!(s&&s.exp>Date.now()+6e5))signQ.add(id)});if(signQ.size&&!signT)signT=setTimeout(flushSign,30)}
async function flushSign(){
  signT=null;const ids=[...signQ];signQ=new Set();if(!ids.length)return;
  for(let i=0;i<ids.length;i+=100){
    const {data,error}=await sb.storage.from(BUCKET).createSignedUrls(ids.slice(i,i+100),6*3600);if(error||!data)continue;
    data.forEach(d=>{if(d.signedUrl&&d.path)SIGNED[d.path]={url:d.signedUrl,exp:Date.now()+6*3600e3-6e5}});
  }
  document.querySelectorAll("[data-mid]").forEach(el=>{const s=SIGNED[el.dataset.mid];if(s&&!el.getAttribute("src")){el.src=s.url;if(el.dataset.act==="zoom")el.dataset.src=s.url}});
}
function signAllMedia(){queueSign(Object.values(R.posts).flatMap(p=>(p.media||[]).filter(m=>!m.url).map(m=>m.id)))}
function mediaItem(m,i,editable){
  const src=esc(mediaSrc(m)),sa=src?`src="${src}"`:"";
  return `<div class="mitem">${m.type==="video"?`<video ${sa} data-mid="${esc(m.id)}" controls preload="metadata" playsinline></video>`:`<img ${sa} data-mid="${esc(m.id)}" alt="${esc(m.name||"Foto")}" loading="lazy" data-act="zoom" data-src="${src}">`}
    ${m.type==="video"?`<span class="tag">Vídeo</span>`:""}${editable?`<button type="button" class="rm" data-act="media-rm" data-i="${i}" aria-label="Remover arquivo">✕</button>`:""}</div>`;
}
function mediaGallery(media,big){
  if(!media||!media.length||!can("verMidias"))return "";
  return `<div><div class="small muted" style="font-weight:600;margin-bottom:6px">Fotos e vídeos para aprovação (${media.length})</div><div class="media-grid ${big?"lg":""}">${media.map((m,i)=>mediaItem(m,i,false)).join("")}</div></div>`;
}
function renderMediaEdit(){
  const box=$("#media-list");if(!box)return;
  box.innerHTML=MEDIA.length?`<div class="media-grid">${MEDIA.map((m,i)=>mediaItem(m,i,true)).join("")}</div>`:`<div class="small muted">Nenhum arquivo ainda.</div>`;
}
async function addMediaFiles(files){
  const st=$("#media-status");
  for(const file of files){
    if(!OKTYPES.includes(file.type)){toast(`"${file.name}": use foto JPG, PNG ou WEBP, ou vídeo MP4/WEBM.`);continue}
    if(file.size>20*1024*1024){toast(`"${file.name}" passa de 20 MB. Comprima o arquivo e tente de novo.`);continue}
    const type=file.type.startsWith("video")?"video":"image";
    if(demo){const m={id:newId(),type,name:file.name,url:URL.createObjectURL(file)};MEDIA.push(m);MEDIA_NEW.push(m.id);renderMediaEdit();continue}
    if(st)st.textContent=`Enviando ${file.name}…`;
    const cf=document.querySelector('#modal select[name="clientId"]'),cid=(cf&&cf.value)||"geral";
    const ext=(file.name.split(".").pop()||"").toLowerCase().replace(/[^a-z0-9]/g,"")||(type==="video"?"mp4":"jpg");
    const path=cid+"/"+newId()+newId()+"."+ext;
    const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(error){toast(/size|large/i.test(error.message)?`"${file.name}" é grande demais (limite 20 MB).`:/mime|type/i.test(error.message)?`Formato de "${file.name}" não aceito.`:`Não foi possível enviar "${file.name}".`);continue}
    const m={id:path,type,name:file.name};MEDIA.push(m);MEDIA_NEW.push(m.id);renderMediaEdit();
  }
  if(st)st.textContent="";
}
async function deleteAssets(ids){if(demo||!sb)return;ids=ids.filter(Boolean);if(ids.length)try{await sb.storage.from(BUCKET).remove(ids)}catch(e){}}
/* se o conteúdo mudou de cliente, os arquivos vão para a pasta do novo cliente (o cliente só enxerga a pasta dele) */
async function moveMedia(media,cid){
  if(demo)return media;const out=[];
  for(const m of media){
    if(m.url||m.id.split("/")[0]===cid){out.push(m);continue}
    const np=cid+"/"+m.id.split("/").pop();
    const {error}=await sb.storage.from(BUCKET).move(m.id,np);
    out.push(error?m:{...m,id:np});
  }
  return out;
}
document.addEventListener("error",e=>{const el=e.target;if(el&&el.closest&&(el.tagName==="IMG"||el.tagName==="VIDEO")){const it=el.closest(".mitem");if(it)it.classList.add("broken")}},true);

function postModal(id,preset){
  if(!clientsSorted().length){toast("Cadastre um cliente primeiro.");UI.view="clientes";render();return}
  const p=id?D.posts[id]:{clientId:preset.clientId||(UI.kClient!=="all"?UI.kClient:(UI.calClient!=="all"?UI.calClient:clientsSorted()[0][0])),title:"",format:"Reels",status:preset.status||"desenvolvimento",recordDate:"",postDate:preset.date||"",clientAction:"",brief:"",caption:"",internal:"",link:"",posted:false};
  const a=id?approvalOf(id):null;
  MEDIA=(p.media||[]).map(m=>({...m}));MEDIA_NEW=[];MEDIA_DROP=[];
  const canUpload=demo||!!sb;
  const mediaField=`<div class="fl" style="gap:8px"><span>Fotos e vídeos para a Aprovação Final<span class="hint" style="display:block">O cliente vê, aprova ou pede ajuste quando o conteúdo chega em Aprovação Final. Fotos JPG/PNG/WEBP e vídeos MP4, até 20 MB cada.</span></span>
    <div class="media-box"><div id="media-list"></div>
    ${canUpload?`<div class="row"><label class="btn" for="media-in">+ Adicionar fotos ou vídeos</label><input type="file" id="media-in" multiple accept="${OKTYPES.join(",")}" style="position:absolute;width:1px;height:1px;opacity:0"><span id="media-status" class="small muted" role="status"></span></div>`:`<div class="small muted">Envio de arquivos indisponível nesta visualização. Use o campo de link abaixo.</div>`}</div></div>`;
  const fc=id?FROMCLIENT[id]:null;
  const apInfo=(fc?`<div class="card pad small" style="background:var(--bg)"><b>O cliente concluiu a etapa ${esc(ST[fc.from]?ST[fc.from].l:"anterior")}</b> em ${esc(new Date(fc.at).toLocaleString("pt-BR"))}. Ao salvar, a etapa escolhida abaixo passa a valer.</div>`:"")+
    (id&&a&&a.decision==="ajuste"?`<div class="card pad" style="display:grid;gap:8px;background:var(--bg)"><div class="row" style="justify-content:space-between"><b>Pedido de ajuste do cliente</b>${apBadge(id,p)}</div>
    <div class="small">${esc(a.comment||"")}</div>
    <div class="row"><button type="button" class="btn ghost" data-act="admin-clear" data-id="${id}">Marcar ajuste como resolvido</button></div></div>`:"");
  openModal(id?"Editar conteúdo":"Novo conteúdo",`
    <div class="f2"><label class="fl">Cliente<select class="sel" name="clientId" style="width:100%">${clientOptions(p.clientId)}</select></label>
    <label class="fl">Formato<select class="sel" name="format" style="width:100%">${FORMATS.map(f=>`<option ${p.format===f?"selected":""}>${f}</option>`).join("")}</select></label></div>
    <label class="fl">Título do conteúdo<input class="inp" name="title" required value="${esc(p.title)}" placeholder="Ex.: Bastidores da cozinha"></label>
    <label class="fl">Etapa<select class="sel" name="status" style="width:100%">${STATUSES.map(s=>`<option value="${s.k}" ${p.status===s.k?"selected":""}>${s.l}</option>`).join("")}</select></label>
    <div class="f2"><label class="fl">Data de gravação<input class="inp" type="date" name="recordDate" value="${esc(p.recordDate)}"></label>
    <label class="fl">Data de publicação<input class="inp" type="date" name="postDate" value="${esc(p.postDate)}"></label></div>
    <label class="fl">O que o cliente precisa fazer<span class="hint">Aparece no calendário do cliente no dia da gravação.</span><textarea class="inp" name="clientAction" placeholder="Ex.: Separar o produto e deixar o balcão arrumado">${esc(p.clientAction)}</textarea></label>
    <label class="fl">Roteiro / orientações<span class="hint">O cliente vê.</span><textarea class="inp" name="brief">${esc(p.brief)}</textarea></label>
    ${mediaField}
    <label class="fl">Legenda<textarea class="inp" name="caption">${esc(p.caption)}</textarea></label>
    <label class="fl">Link da prévia (Drive, Canva…)<input class="inp" name="link" value="${esc(p.link)}" placeholder="https://"></label>
    <label class="fl">Anotações internas<span class="hint">Não aparecem na área do cliente.</span><textarea class="inp" name="internal">${esc(p.internal)}</textarea></label>
    <label class="fl">Link da publicação<span class="hint">Depois de postado, cole o link do post.</span><input class="inp" name="postedUrl" value="${esc(p.postedUrl||"")}" placeholder="https://instagram.com/p/…"></label>
    <label class="row" style="font-weight:600;font-size:14px"><input type="checkbox" name="posted" ${p.posted?"checked":""} class="chk"> Já foi publicado (sai do kanban)</label>
    ${apInfo}`,
    `<div>${id?delBtn("del-post",id):""}</div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar</button></div>`,
    async f=>{
      const title=val(f,"title");if(!title){toast("Dê um título ao conteúdo.");return false}
      const data={clientId:val(f,"clientId"),title,format:val(f,"format"),status:val(f,"status"),recordDate:val(f,"recordDate"),postDate:val(f,"postDate"),
        clientAction:val(f,"clientAction"),brief:val(f,"brief"),caption:val(f,"caption"),link:val(f,"link"),internal:val(f,"internal"),posted:val(f,"posted"),postedUrl:val(f,"postedUrl"),postedAt:val(f,"posted")?((id&&p.postedAt)||Date.now()):null,
        media:MEDIA.map(m=>demo?{...m}:{id:m.id,type:m.type,name:m.name||""}),
        createdAt:(id&&p.createdAt)||Date.now(),updatedAt:Date.now()};
      data.media=await moveMedia(data.media,data.clientId);
      const pid=id||newId();
      const ok=await put("posts",pid,data);if(!ok)return false;
      const drop=MEDIA_DROP.slice();MEDIA_NEW=[];MEDIA_DROP=[];deleteAssets(drop);
      if(R.actions[pid])await del("actions",pid);
      if(id&&p.status!==APV&&data.status===APV&&approvalOf(id))await del("approvals",id);
      toast(id?"Conteúdo atualizado.":"Conteúdo criado.");
    },()=>{const n=MEDIA_NEW.slice();MEDIA_NEW=[];MEDIA_DROP=[];deleteAssets(n)});
  renderMediaEdit();
  const mi=$("#media-in");if(mi)mi.addEventListener("change",async()=>{const fs=[...mi.files];mi.value="";await addMediaFiles(fs)});
}
function taskModal(id,preset){
  if(!clientsSorted().length){toast("Cadastre um cliente primeiro.");return}
  const t=id?D.tasks[id]:{clientId:preset.clientId||(UI.calClient!=="all"?UI.calClient:clientsSorted()[0][0]),date:preset.date||TODAY,title:"",details:""};
  openModal(id?"Editar tarefa do cliente":"Nova tarefa do cliente",`
    <div class="f2"><label class="fl">Cliente<select class="sel" name="clientId" style="width:100%">${clientOptions(t.clientId)}</select></label>
    <label class="fl">Data<input class="inp" type="date" name="date" value="${esc(t.date)}"></label></div>
    <label class="fl">O que fazer<input class="inp" name="title" value="${esc(t.title)}" placeholder="Ex.: Enviar fotos da nova coleção"></label>
    <label class="fl">Detalhes<textarea class="inp" name="details">${esc(t.details)}</textarea></label>
    ${id&&(D.taskdone[id]||{}).done?`<div class="chip st-ok" style="justify-self:start">Cliente marcou como feita</div>`:""}`,
    `<div>${id?delBtn("del-task",id):""}</div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar</button></div>`,
    async f=>{const title=val(f,"title");if(!title){toast("Descreva a tarefa.");return false}
      const ok=await put("tasks",id||newId(),{clientId:val(f,"clientId"),date:val(f,"date"),title,details:val(f,"details"),createdAt:(id&&t.createdAt)||Date.now()});
      if(!ok)return false;toast("Tarefa salva.")});
}
function clientModal(id){
  const c=id?D.clients[id]:{name:"",segment:"",instagram:"",contact:"",color:COLORS[clientsSorted().length%COLORS.length],notes:""};
  const pm={...ALLP,...(c.perms||{})};
  openModal(id?"Editar cliente":"Novo cliente",`
    <label class="fl">Nome da empresa<input class="inp" name="name" value="${esc(c.name)}" placeholder="Ex.: Padaria Trigo Bom"></label>
    <div class="f2"><label class="fl">Segmento<input class="inp" name="segment" value="${esc(c.segment)}"></label>
    <label class="fl">Instagram<input class="inp" name="instagram" value="${esc(c.instagram)}" placeholder="@perfil"></label></div>
    <label class="fl">Contato<input class="inp" name="contact" value="${esc(c.contact)}" placeholder="Nome · telefone"></label>
    <div class="f2"><label class="fl">Mensalidade (R$)<span class="hint">Usada no Financeiro para lançar as mensalidades.</span><input class="inp" name="fee" value="${c.fee?esc(String(c.fee).replace(".",",")):""}" inputmode="decimal" placeholder="0,00"></label>
    <label class="fl">Dia do vencimento<span class="hint">Dia do mês em que o cliente paga.</span><input class="inp" name="dueDay" type="number" min="1" max="31" value="${esc(c.dueDay||"")}" placeholder="10"></label></div>
    <div class="fl">Logo ou foto da empresa<span class="hint">Aparece no menu e no topo da área do cliente.</span>
      <div class="logo-prev">${avatarHtml(c)}<input type="file" name="logo" accept="${LOGOTYPES.join(",")}" class="small"></div></div>
    <fieldset style="border:0;padding:0;margin:0"><legend class="small" style="font-weight:600;margin-bottom:6px">Cor do cliente</legend><div class="swatches">${COLORS.map((col,i)=>`<input type="radio" name="color" value="${col}" style="--sw:${col}" ${c.color===col?"checked":""} aria-label="Cor ${i+1}">`).join("")}</div></fieldset>
    <div class="fl" style="gap:8px"><div class="row" style="justify-content:space-between"><span>O que este cliente pode fazer na área dele</span>
      <div class="row"><button type="button" class="btn ghost small" data-act="perm-set" data-v="all">Marcar tudo</button><button type="button" class="btn ghost small" data-act="perm-set" data-v="view">Só visualizar</button></div></div>
      <div class="perms">${PERMS.map(p=>`<label class="perm"><input type="checkbox" name="perm_${p.k}" ${pm[p.k]!==false?"checked":""}><div><b>${p.l}</b><span>${p.d}</span></div></label>`).join("")}</div>
      <span class="hint" style="font-weight:400;color:var(--muted);font-size:12px">Vale para todas as pessoas com acesso a esta empresa. Dá para mudar quando quiser.</span></div>
    <label class="fl">Observações internas<textarea class="inp" name="notes">${esc(c.notes)}</textarea></label>`,
    `<div>${id?delBtn("del-client",id):""}</div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar</button></div>`,
    async f=>{const name=val(f,"name");if(!name){toast("Informe o nome da empresa.");return false}
      const color=(f.querySelector('input[name="color"]:checked')||{}).value||c.color;
      const perms=Object.fromEntries(PERMS.map(p=>[p.k,!!val(f,"perm_"+p.k)]));
      const cid=id||newId(),logo=f.elements.logo&&f.elements.logo.files[0];
      const feeRaw=val(f,"fee"),fee=feeRaw?parseMoney(feeRaw):0;if(!(fee>=0)){toast("Mensalidade inválida. Use só números, ex.: 1200,00");return false}
      const dd=Number(val(f,"dueDay"))||0;if(dd&&(dd<1||dd>31)){toast("O dia do vencimento vai de 1 a 31.");return false}
      const ok=await put("clients",cid,{...(id?c:{}),name,segment:val(f,"segment"),instagram:val(f,"instagram"),contact:val(f,"contact"),color,fee,dueDay:dd||"",notes:val(f,"notes"),perms,createdAt:(id&&c.createdAt)||Date.now()});
      if(!ok)return false;if(logo)await uploadLogo(cid,logo);toast("Cliente salvo.")});
}
function leadModal(id,preset){
  const l=id?D.leads[id]:{name:"",company:"",phone:"",email:"",instagram:"",origin:"Instagram",service:"",value:"",stage:preset.stage||"novo",nextFollowUp:ymd(addDays(new Date(),1)),notes:"",lostReason:"",followups:[]};
  const hist=(l.followups||[]).slice().reverse();
  const conv=id&&l.stage==="fechado"&&l.clientId&&D.clients[l.clientId]?`<div class="card pad" style="background:var(--bg);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="small"><b>Já é cliente:</b> ${esc(cName(l.clientId))}</span><div class="row"><button type="button" class="btn" data-act="go-client" data-id="${l.clientId}">Ver cliente</button><button type="button" class="btn primary" data-act="first-post" data-id="${l.clientId}">Criar conteúdo e roteiro</button></div></div>`
    :`<div class="small muted">Ao mover para <b>Fechado</b>, o cliente é cadastrado automaticamente em Clientes.</div>`;
  openModal(id?"Lead · "+(l.name||""):"Novo lead",`
    ${conv}
    <div class="f2"><label class="fl">Nome do contato<input class="inp" name="name" value="${esc(l.name)}" placeholder="Ex.: Renata Alves"></label>
    <label class="fl">Empresa<input class="inp" name="company" value="${esc(l.company)}"></label></div>
    <label class="fl">Segmento<span class="hint">Escolha da lista ou digite outro.</span><input class="inp" name="segment" list="seg-list" value="${esc(l.segment||"")}" placeholder="Ex.: Alimentação, Odontologia, Moda" autocomplete="off">
      <datalist id="seg-list">${segmentOptions().map(s=>`<option value="${esc(s)}"></option>`).join("")}</datalist></label>
    <div class="f2"><label class="fl">WhatsApp / telefone<input class="inp" name="phone" value="${esc(l.phone)}" placeholder="(11) 99999-9999" inputmode="tel"></label>
    <label class="fl">E-mail<input class="inp" name="email" value="${esc(l.email)}" type="email"></label></div>
    <div class="f2"><label class="fl">Instagram<input class="inp" name="instagram" value="${esc(l.instagram)}" placeholder="@perfil"></label>
    <label class="fl">Origem<select class="sel" name="origin" style="width:100%">${ORIGENS.map(o=>`<option ${l.origin===o?"selected":""}>${o}</option>`).join("")}</select></label></div>
    <div class="f2"><label class="fl">Serviço de interesse<input class="inp" name="service" value="${esc(l.service)}" placeholder="Ex.: Gestão de Instagram"></label>
    <label class="fl">Valor mensal (R$)<input class="inp" name="value" value="${esc(l.value)}" inputmode="decimal" placeholder="0"></label></div>
    <div class="f2"><label class="fl">Etapa<select class="sel" name="stage" style="width:100%">${LSTAGES.map(x=>`<option value="${x.k}" ${l.stage===x.k?"selected":""}>${x.l}</option>`).join("")}</select></label>
    <label class="fl">Próximo follow-up<input class="inp" type="date" name="nextFollowUp" value="${esc(l.nextFollowUp||"")}"></label></div>
    <label class="fl">Motivo da perda<span class="hint">Preencha se o lead não fechou.</span><input class="inp" name="lostReason" value="${esc(l.lostReason||"")}" placeholder="Ex.: Preço, sem verba agora, fechou com outra pessoa"></label>
    <label class="fl">Observações<textarea class="inp" name="notes">${esc(l.notes)}</textarea></label>
    ${id?`<div class="fl"><div class="row" style="justify-content:space-between"><span>Histórico de contatos (${hist.length})</span><button type="button" class="btn" data-act="log-contact" data-id="${id}">+ Registrar contato</button></div>
      <div class="hist">${hist.map(h=>`<div class="h"><b>${longDay(h.date)} · ${esc(h.channel)}</b>${esc(h.text)}</div>`).join("")||`<div class="small muted">Nenhum contato registrado.</div>`}</div></div>`:""}`,
    `<div>${id?delBtn("del-lead",id):""}</div><div class="row">${id&&waLink(l.phone)?`<a class="btn ghost" href="${esc(waLink(l.phone))}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar</button></div>`,
    async f=>{const name=val(f,"name");if(!name){toast("Informe o nome do contato.");return false}
      const stage=val(f,"stage"),value=Number(String(val(f,"value")).replace(/\./g,"").replace(",","."))||0;
      const data={...(id?l:{}),name,company:val(f,"company"),segment:val(f,"segment"),phone:val(f,"phone"),email:val(f,"email"),instagram:val(f,"instagram"),origin:val(f,"origin"),service:val(f,"service"),value,stage,
        nextFollowUp:ACTIVE.includes(stage)?val(f,"nextFollowUp"):"",lostReason:val(f,"lostReason"),notes:val(f,"notes"),followups:l.followups||[],createdAt:l.createdAt||Date.now(),updatedAt:Date.now()};
      if(stage==="fechado"&&!data.closedAt)data.closedAt=Date.now();
      if(stage!=="fechado")delete data.closedAt;
      const ok=await saveLead(id||newId(),data);if(!ok)return false;toast(id?"Lead atualizado.":"Lead cadastrado.")});
}
function contactModal(id){
  const l=D.leads[id];if(!l)return;
  openModal("Registrar contato · "+l.name,`
    <div class="f2"><label class="fl">Data<input class="inp" type="date" name="date" value="${TODAY}"></label>
    <label class="fl">Canal<select class="sel" name="channel" style="width:100%">${CANAIS.map(c=>`<option>${c}</option>`).join("")}</select></label></div>
    <label class="fl">O que foi conversado<textarea class="inp" name="text" placeholder="Ex.: Enviei a proposta, ela vai responder até sexta"></textarea></label>
    <div class="f2"><label class="fl">Próximo follow-up<input class="inp" type="date" name="next" value="${ymd(addDays(new Date(),3))}"></label>
    <label class="fl">Mover para etapa<select class="sel" name="stage" style="width:100%">${LSTAGES.map(x=>`<option value="${x.k}" ${l.stage===x.k?"selected":""}>${x.l}</option>`).join("")}</select></label></div>`,
    `<div></div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Salvar contato</button></div>`,
    async f=>{const text=val(f,"text");if(!text){toast("Escreva um resumo da conversa.");return false}
      const stage=val(f,"stage"),fl=(l.followups||[]).concat([{date:val(f,"date")||TODAY,channel:val(f,"channel"),text}]).slice(-100);
      const data={...l,followups:fl,stage,nextFollowUp:ACTIVE.includes(stage)?val(f,"next"):"",updatedAt:Date.now()};
      if(stage==="fechado"&&!data.closedAt)data.closedAt=Date.now();if(stage!=="fechado")delete data.closedAt;
      const ok=await saveLead(id,data);if(!ok)return false;toast("Contato registrado.")});
}
function viewPostModal(id){
  const p=D.posts[id];if(!p)return;const a=approvalOf(id);const canDecide=p.status===APV&&!p.posted;
  openModal(p.title,`
    <div class="row small muted">${esc(p.format||"")}${p.recordDate?" · gravação "+longDay(p.recordDate):""}${p.postDate?" · publicação "+longDay(p.postDate):""}</div>
    ${p.posted?`<span class="chip st-ok" style="justify-self:start">Publicado</span>`:stepper(p)}
    ${p.clientAction?`<div class="todo"><b>O que você precisa fazer</b><div>${esc(p.clientAction)}</div></div>`:""}
    ${p.brief&&can("verLegenda")?`<div><div class="small muted" style="font-weight:600">Roteiro / orientações</div><div style="white-space:pre-wrap">${esc(p.brief)}</div></div>`:""}
    ${mediaGallery(p.media,false)}
    ${p.caption&&can("verLegenda")?`<div><div class="small muted" style="font-weight:600;margin-bottom:4px">Legenda</div><div class="caption">${esc(p.caption)}</div></div>`:""}
    ${p.link?`<a class="btn" style="justify-self:start" href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener">Abrir prévia do conteúdo</a>`:""}
    ${canDecide?`<div class="row">${apBadge(id,p)}</div>${a&&a.decision==="ajuste"?`<div class="small st-warn"><b>Seu pedido:</b> ${esc(a.comment||"")}</div>`:""}`:""}`,
    `<div></div><div class="row">${canDecide&&can("aprovar")?`<button type="button" class="btn" data-act="adjust" data-id="${id}" ${UI.readOnly?"disabled":""}>Pedir ajuste</button>`:`<button type="button" class="btn" data-act="close">Fechar</button>`}${doneBtn(id,p)}</div>`,null);
}
function adjustModal(id){
  const p=D.posts[id];
  openModal("Pedir ajuste",`<div><b>${esc(p.title)}</b></div><label class="fl">O que precisa mudar?<textarea class="inp" name="comment" placeholder="Ex.: Trocar a música e corrigir o preço na legenda"></textarea></label>`,
    `<div></div><div class="row"><button type="button" class="btn" data-act="close">Cancelar</button><button class="btn primary">Enviar pedido</button></div>`,
    async f=>{const comment=val(f,"comment");if(!comment){toast("Escreva o que precisa mudar.");return false}
      const ok=await put("approvals",id,{decision:"ajuste",comment,by:(PROFILE&&PROFILE.email)||"",at:Date.now()});if(!ok)return false;toast("Pedido de ajuste enviado.")});
}

/* ---------- eventos ---------- */
const delArm={};
document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-act]");if(!t)return;
  const a=t.dataset.act,id=t.dataset.id,v=t.dataset.v;
  if(a==="modal-back"){if(e.target===t)closeModal();return}
  if(a==="toggle-task"){return toggleTask(t)}
  if(t.tagName==="DIV"&&a==="edit-post"&&e.target.closest("button,a,input"))return;
  switch(a){
    case "nav":UI.view=v;UI.menuOpen=false;render();window.scrollTo(0,0);break;
    case "open-kanban":UI.kClient=id;UI.view="kanban";render();break;
    case "preview":UI.preview=id;UI.ctab="agenda";UI.menuOpen=false;render();window.scrollTo(0,0);break;
    case "exit-preview":UI.preview=null;UI.menuOpen=false;render();break;
    case "ctab":UI.ctab=v;UI.menuOpen=false;render();window.scrollTo(0,0);break;
    case "new-post":postModal(null,{status:t.dataset.status,date:t.dataset.date});break;
    case "edit-post":if(D.posts[id])postModal(id,{});break;
    case "view-post":viewPostModal(id);break;
    case "new-task":taskModal(null,{date:t.dataset.date});break;
    case "edit-task":if(D.tasks[id])taskModal(id,{});break;
    case "new-client":clientModal(null);break;
    case "edit-client":clientModal(id);break;
    case "seed":t.disabled=true;await loadSeed();break;
    case "close":closeModal();break;
    case "perm-set":{const view=["verAgenda","verAndamento","verMidias","verLegenda"];document.querySelectorAll('#modal input[name^="perm_"]').forEach(cb=>{const k=cb.name.slice(5);cb.checked=v==="all"||view.includes(k)});break}
    case "new-lead":leadModal(null,{stage:t.dataset.stage});break;
    case "edit-lead":if(D.leads[id])leadModal(id,{});break;
    case "log-contact":closeModal();contactModal(id);break;
    case "seed-leads":{t.disabled=true;const sl=seed().leads;for(const[k,v]of Object.entries(sl)){if(!(await put("leads",k,v)))break}toast("Leads de exemplo carregados.");break}
    case "go-client":closeModal();UI.view="clientes";render();window.scrollTo(0,0);break;
    case "first-post":closeModal();postModal(null,{clientId:id,date:""});break;
    case "mark-posted":postedModal(id);break;
    case "media-rm":{const i=Number(t.dataset.i),m=MEDIA[i];if(!m)break;MEDIA.splice(i,1);
      if(MEDIA_NEW.includes(m.id)){MEDIA_NEW=MEDIA_NEW.filter(x=>x!==m.id);deleteAssets([m.id])}else MEDIA_DROP.push(m.id);renderMediaEdit();break}
    case "zoom":{if($("#zoom-layer"))break;const z=document.createElement("div");z.id="zoom-layer";z.className="back";z.style.cssText="position:fixed;inset:0;background:rgba(10,8,16,.85);display:grid;place-items:center;padding:16px;z-index:70;cursor:zoom-out";
      const im=document.createElement("img");im.className="media-big";im.src=t.dataset.src;im.alt="Foto ampliada";z.appendChild(im);z.addEventListener("click",ev=>{ev.stopPropagation();z.remove()});document.body.appendChild(z);break}
    case "day":UI.selDay=v;UI.calAnchor=v;render();break;
    case "pmode":{const k=t.dataset.k;if(k==="k")UI.kMode=v;else UI.calMode=v;render();break}
    case "pnav":{const k=t.dataset.k,mode=k==="k"?UI.kMode:UI.calMode,cur=k==="k"?UI.kAnchor:UI.calAnchor;let nx;
      if(v==="0")nx=TODAY;else if(mode==="semana")nx=ymd(addDays(parse(cur),7*Number(v)));else{const m=parse(cur);nx=ymd(new Date(m.getFullYear(),m.getMonth()+Number(v),1))}
      if(k==="k")UI.kAnchor=nx;else{UI.calAnchor=nx;if(v==="0"||mode==="semana")UI.selDay=v==="0"?TODAY:ymd(weekStart(nx))}render();break}
    case "conclude":{
      if(!t.classList.contains("armed")){document.querySelectorAll(".done-btn.armed").forEach(b=>{b.classList.remove("armed");b.innerHTML=b.dataset.orig});t.dataset.orig=t.innerHTML;t.classList.add("armed");t.textContent="Confirmar: ir para "+t.dataset.next;return}
      await conclude(id);break}
    case "adjust":adjustModal(id);break;
    case "admin-clear":{if(await del("approvals",id)){closeModal();toast("Ajuste marcado como resolvido.")}break}
    case "del-post":case "del-task":case "del-client":case "del-lead":case "del-fin":{
      if(!delArm[a+id]){delArm[a+id]=1;t.textContent=a==="del-client"?"Confirmar: apagar cliente":"Confirmar exclusão";return}
      delete delArm[a+id];
      if(a==="del-post"){const keep=(D.posts[id]&&D.posts[id].media||[]).map(m=>m.id);const n=MEDIA_NEW.slice();MEDIA_NEW=[];modalCancel=null;if(await del("posts",id)){deleteAssets(keep.concat(n));if(approvalOf(id))await del("approvals",id)}}
      else if(a==="del-task"){await del("tasks",id);if(D.taskdone[id])await del("taskdone",id)}
      else if(a==="del-lead"){await del("leads",id)}
      else if(a==="del-fin"){await del("fin",id)}
      else{await del("clients",id)}
      closeModal();toast("Excluído.");break}
    case "copy":try{await navigator.clipboard.writeText(v);toast("Copiado.")}catch(err){toast("Selecione o texto e copie manualmente.")}break;
    case "theme":toggleTheme();break;
    case "open-login":UI.loginOpen=true;$("#app").innerHTML="";render();{const em=document.querySelector('#login-form input[name="email"]');if(em)em.focus()}break;
    case "menu-toggle":setMenu(!UI.menuOpen);break;
    case "menu-close":setMenu(false);break;
    case "landing-more":{const s=$("#sobre");if(s)s.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});break}
    case "close-login":UI.loginOpen=false;$("#app").innerHTML="";render();break;
    case "inv-go":closeModal();UI.ctab="faturas";render();window.scrollTo(0,0);break;
    case "new-fin":finModal(null,{kind:v});break;
    case "edit-fin":if(D.fin[id])finModal(id,{});break;
    case "fin-pay":{const r=D.fin[id];if(!r)break;const p=!r.paid;await put("fin",id,{...R.fin[id],paid:p,paidDate:p?TODAY:""});toast(p?(r.kind==="receita"?"Marcado como recebido.":"Marcado como pago."):"Voltou para em aberto.");break}
    case "fin-month":{const cur=UI.finMonth||TODAY.slice(0,7);UI.finMonth=v==="0"?TODAY.slice(0,7):ymAdd(cur,Number(v));render();break}
    case "fin-fees":t.disabled=true;await launchFees(UI.finMonth||TODAY.slice(0,7));break;
    case "acc-logo-clear":setAccLogo(null);break;
    case "acc-logo-save":{const f=$("#acc-form");if(!f||!ACC_LOGO)break;const cid=f.elements.clientId.value;t.disabled=true;
      if(await uploadLogo(cid,ACC_LOGO)){setAccLogo(null);toast("Logo salva.")}else t.disabled=false;break}
    case "show-pw":{const pw=document.getElementById(t.getAttribute("aria-controls"));if(pw)pw.type=t.checked?"text":"password";return}
    case "logout":closeModal();await logout();break;
    case "my-pw":UI.menuOpen=false;AUTHV="mypw";$("#app").innerHTML="";render();break;
    case "pw-cancel":AUTHV=null;render();break;
    case "go-access":UI.accClient=id;UI.view="acessos";render();window.scrollTo(0,0);break;
    case "reset-pw":{const u=USERS[id];if(!u)break;
      if(!delArm["r"+id]){delArm["r"+id]=1;t.textContent="Confirmar reset";return}delete delArm["r"+id];
      t.disabled=true;const r=await adminCall({action:"reset",userId:id});t.disabled=false;
      if(r)passwordModal("Senha redefinida",u,r.password,false);break}
    case "block-user":{const u=USERS[id];if(!u)break;const b=v==="1";
      if(b&&!delArm["b"+id]){delArm["b"+id]=1;t.textContent="Confirmar bloqueio";return}delete delArm["b"+id];
      t.disabled=true;if(await adminCall({action:"block",userIds:[id],blocked:b}))toast(b?"Acesso bloqueado.":"Acesso liberado.");break}
    case "block-company":{const ids=usersOf(id).map(u=>u.id),b=v==="1";if(!ids.length)break;
      if(b&&!delArm["bc"+id]){delArm["bc"+id]=1;t.textContent="Confirmar bloqueio";return}delete delArm["bc"+id];
      t.disabled=true;if(await adminCall({action:"block",userIds:ids,blocked:b}))toast(b?`Acesso de ${cName(id)} bloqueado.`:`Acesso de ${cName(id)} liberado.`);break}
    case "remove-user":{if(!delArm["x"+id]){delArm["x"+id]=1;t.textContent="Confirmar exclusão";return}delete delArm["x"+id];
      t.disabled=true;if(await adminCall({action:"remove",userId:id}))toast("Acesso excluído.");break}
  }
});
async function conclude(id){
  const p=D.posts[id],n=p&&nextStatus(p.status);if(!n)return;
  const ok=await put("actions",id,{status:n.k,from:p.status,at:Date.now(),by:(PROFILE&&PROFILE.email)||""});
  if(!ok)return;
  if(p.status===APV&&approvalOf(id))await del("approvals",id);
  closeModal();toast("Feito! Agora está em "+n.l+".");
}
async function toggleTask(el){
  const id=el.dataset.id,done=el.checked;
  const ok=await put("taskdone",id,{done,by:(PROFILE&&PROFILE.email)||"",at:Date.now()});
  if(!ok)el.checked=!done;else toast(done?"Tarefa concluída.":"Tarefa reaberta.");
}
document.addEventListener("change",async e=>{
  const t=e.target.closest("[data-change]");if(!t)return;
  const c=t.dataset.change;
  if(c==="fin-kind"){const f=t.form,cs=f.elements.category;cs.innerHTML=finCatOptions(t.value);$("#fin-plat").hidden=cs.value!==ADCAT;$("#fin-pay-f").hidden=t.value!=="receita";const pl=$("#fin-paid-l");if(pl)pl.textContent=t.value==="receita"?"Já recebi":"Já paguei"}
  else if(c==="fin-cat"){$("#fin-plat").hidden=t.value!==ADCAT}
  else if(c==="acc-client"){UI.accClient=t.value;render()}
  else if(c==="acc-logo"){const file=t.files&&t.files[0];t.value="";if(!file)return;if(!LOGOTYPES.includes(file.type)){toast("Para a logo use uma imagem JPG, PNG ou WEBP.");return}setAccLogo(file)}
  else if(c==="kfilter"){UI.kClient=t.value;render()}
  else if(c==="cfilter"){UI.calClient=t.value;render()}
  else if(c==="ym-month"||c==="ym-year"){const k=t.dataset.k,cur=parse(k==="k"?UI.kAnchor:UI.calAnchor);
    const y=c==="ym-year"?Number(t.value):cur.getFullYear(),m=c==="ym-month"?Number(t.value):cur.getMonth(),nx=ymd(new Date(y,m,1));
    if(k==="k")UI.kAnchor=nx;else{UI.calAnchor=nx;UI.selDay=nx}render()}
  else if(c==="user-client"){if(t.value&&await adminCall({action:"update",userId:t.dataset.id,clientId:t.value}))toast("Empresa alterada.")}
});
/* formulários fora do modal: login, troca de senha e criar acesso */
document.addEventListener("submit",e=>{
  const f=e.target;
  if(f.id==="login-form"){e.preventDefault();doLogin(f)}
  else if(f.id==="pw-form"){e.preventDefault();doChangePw(f)}
  else if(f.id==="acc-form"){e.preventDefault();createAccess(f)}
});
document.addEventListener("input",e=>{
  const t=e.target;if(t.matches&&t.matches('[data-input="pw"]')){paintPwRules(t.value);return}
  if(!t.matches||!t.matches('[data-input="lsearch"]'))return;
  UI.lq=t.value;const pos=t.selectionStart;render();const n=$("#lsearch");if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(err){}}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#zoom-layer")){$("#zoom-layer").remove();return}
  if(e.key==="Escape"&&UI.menuOpen&&!$("#modal").innerHTML){setMenu(false);return}
  if(e.key==="Escape"&&$("#modal").innerHTML)closeModal();
  if((e.key==="Enter"||e.key===" ")&&e.target.matches('[data-act="day"],.kcard')){e.preventDefault();e.target.click()}
});
/* arrastar e soltar */
document.addEventListener("dragstart",e=>{const c=e.target.closest&&e.target.closest("[data-drag]");if(!c)return;e.dataTransfer.setData("text/plain",c.dataset.drag);e.dataTransfer.effectAllowed="move";c.classList.add("dragging")});
document.addEventListener("dragend",e=>{const c=e.target.closest&&e.target.closest("[data-drag]");if(c)c.classList.remove("dragging");document.querySelectorAll(".col.over").forEach(x=>x.classList.remove("over"))});
document.addEventListener("dragover",e=>{const col=e.target.closest&&e.target.closest("[data-drop]");if(!col)return;e.preventDefault();document.querySelectorAll(".col.over").forEach(x=>x!==col&&x.classList.remove("over"));col.classList.add("over")});
document.addEventListener("drop",async e=>{const col=e.target.closest&&e.target.closest("[data-drop]");if(!col)return;e.preventDefault();col.classList.remove("over");
  const raw=e.dataTransfer.getData("text/plain"),dst=col.dataset.drop;
  if(raw.startsWith("lead:")||dst.startsWith("lead:")){
    if(!(raw.startsWith("lead:")&&dst.startsWith("lead:")))return;
    const lid=raw.slice(5),stg=dst.slice(5),l=D.leads[lid];if(!l||l.stage===stg)return;
    const data={...l,stage:stg,updatedAt:Date.now()};if(!ACTIVE.includes(stg))data.nextFollowUp="";
    if(stg==="fechado"&&!data.closedAt)data.closedAt=Date.now();if(stg!=="fechado")delete data.closedAt;
    if(await saveLead(lid,data)&&stg!=="fechado")toast("Lead movido para "+LS[stg].l+".");return}
  const id=raw,p=D.posts[id],st=dst;if(!p||p.status===st)return;
  const ok=await put("posts",id,{...p,status:st,updatedAt:Date.now()});
  if(ok){if(R.actions[id])await del("actions",id);if(st===APV&&approvalOf(id))await del("approvals",id);toast("Movido para "+ST[st].l+".")}});

/* ---------- inicialização ---------- */
function startDemo(){
  demo=true;const s=seed();
  const art=(t,c1,c2)=>{try{const cv=document.createElement("canvas");cv.width=800;cv.height=1000;const g=cv.getContext("2d"),gr=g.createLinearGradient(0,0,800,1000);gr.addColorStop(0,c1);gr.addColorStop(1,c2);g.fillStyle=gr;g.fillRect(0,0,800,1000);g.fillStyle="rgba(255,255,255,.92)";g.font="bold 64px sans-serif";g.textAlign="center";t.split("|").forEach((l,i)=>g.fillText(l,400,460+i*80));g.font="28px sans-serif";g.fillText("Exemplo de mídia",400,900);return cv.toDataURL("image/jpeg",.8)}catch(e){return ""}};
  s.posts.p3.media=[{id:"dm1",type:"image",name:"Capa",url:art("Conheça|o Zé","#D98307","#7A2E0B")},{id:"dm2",type:"image",name:"Cena 2",url:art("3h da|manhã","#2F6FE0","#0B1F4D")}];
  s.posts.p6.media=[{id:"dm3",type:"image",name:"Capa",url:art("Seu sorriso|de volta","#0E9384","#073B3A")}];
  R.clients=s.clients;R.posts=s.posts;R.tasks=s.tasks;R.approvals=s.approvals;R.leads=s.leads;R.fin=s.fin;derive();booted=true;render();
}
/* aplica o perfil de quem entrou: bloqueado, troca de senha obrigatória, admin ou cliente */
function applyProfile(p){
  PROFILE=p;me=p?p.id:null;
  if(!p){AUTHV="blocked";return false}
  if(p.blocked){AUTHV="blocked";return false}
  if(p.must_change_password){AUTHV="changepw";return false}
  isOwner=p.role==="admin";CLIENT_ID=p.role==="client"?p.client_id:null;
  return true;
}
async function loadDocs(){
  const all=[];
  for(let from=0;;from+=1000){
    const {data,error}=await sb.from("docs").select("col,id,data").order("col").order("id").range(from,from+999);
    if(error){stale=true;break}
    all.push(...data);if(data.length<1000)break;
  }
  for(const k of COLS)R[k]={};
  all.forEach(r=>{if(R[r.col])R[r.col][r.id]=r.data});
  derive();COLS.forEach(c=>loaded.add(c));signAllMedia();
}
async function startSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){AUTHV="login";render();return}
  const {data:p,error}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
  if(error){AUTHV=null;booted=true;stale=true;render();return}
  if(!p){AUTHV=null;booted=true;PROFILE={email:session.user.email};CLIENT_ID=null;loaded.add("clients");render();return}
  if(!applyProfile(p)){render();return}
  AUTHV=null;
  await loadDocs();await loadUsers();
  booted=true;render();
  /* tempo real: mudanças nos dados e no próprio perfil (bloqueio vale na hora) */
  chans.forEach(c=>{try{sb.removeChannel(c)}catch(e){}});chans=[];
  chans.push(sb.channel("docs").on("postgres_changes",{event:"*",schema:"public",table:"docs"},ev=>{
    if(ev.eventType==="DELETE"){const o=ev.old||{};if(R[o.col]&&o.id){const c={...R[o.col]};delete c[o.id];R[o.col]=c}}
    else{const n=ev.new||{};if(R[n.col])R[n.col]={...R[n.col],[n.id]:n.data};if(n.col==="posts")signAllMedia()}
    derive();scheduleRender();
  }).subscribe());
  chans.push(sb.channel("profiles").on("postgres_changes",{event:"*",schema:"public",table:"profiles"},ev=>{
    const n=ev.new||{},o=ev.old||{};
    if(isOwner){if(ev.eventType==="DELETE")delete USERS[o.id];else if(n.id)USERS[n.id]=n;scheduleRender()}
    if(n.id&&n.id===me&&(n.blocked||n.client_id!==CLIENT_ID)){if(n.blocked){AUTHV="blocked";render()}else{CLIENT_ID=n.client_id;loadDocs().then(scheduleRender)}}
    if(ev.eventType==="DELETE"&&o.id===me)logout();
  }).subscribe());
}
async function init(){
  const cfg=window.CENTRAL_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseKey||!window.supabase)return startDemo();
  sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT"&&AUTHV!=="login"&&booted)logout()});
  render();
  await startSession();
}
init();
