/* aplica o tema salvo antes de desenhar a tela (evita piscar) */
try{if(localStorage.getItem("cc-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}
