const rawQ = {
  "id": "01",
  "nivel": "Nível 3",
  "dificuldade": "Média",
  "conteudo": "Language for Global Issues: Environment, Health and Equity",
  "enunciado": "Read the image carefully. What is emphasized in the image about local volunteering?",
  "imagem_contexto": "- Volunteers with boxes and trash bags",
  "alternativas": {
    "A": "The image emphasizes incentives, such as gifts and financial benefits, for engaging in local volunteering.",
    "B": "The image highlights the professional skills and paid positions volunteers gain through local activities.",
    "C": "The image illustrates the aspect of local volunteering that focuses on environmental protection efforts.",
    "D": "The image underscores the opportunity for personal enjoyment and positive social experiences in local volunteering.",
    "E": "The image portrays the challenges and difficulties volunteers face while performing community service."
  },
  "gabarito": "D"
};

let qText = rawQ.text || rawQ.enunciado || '';
if (rawQ.texto_base) qText = rawQ.texto_base + '\n\n' + qText;
let qLevel = rawQ.level || rawQ.nivel || 'Nível Livre';
let qImage = rawQ.image_url || rawQ.contexto_visual || rawQ.qImage || null;
if (typeof qImage === 'string' && qImage.trim() === '') qImage = null; // AI recommendation fix
let qDifficulty = rawQ.difficulty || rawQ.dificuldade || 'Média';
let qTheme = rawQ.theme || rawQ.tema || 'Temas Globais';
let qSource = rawQ.source || rawQ.fonte || rawQ.banca || rawQ.vestibular || rawQ.ano || null;
let qSkills = rawQ.skills || rawQ.skill || rawQ.habilidade || rawQ.conteudo || rawQ.conteudos || null;

let qOptions = rawQ.options;
if (!qOptions && rawQ.alternativas) {
  qOptions = Object.values(rawQ.alternativas);
}

let qAnswer = rawQ.answer;
if (qAnswer === undefined && (rawQ.resposta_correta !== undefined || rawQ.gabarito !== undefined)) {
  const txtAns = (rawQ.resposta_correta || rawQ.gabarito).toString().trim().toUpperCase();
  const mapRes = { 'A':0, 'B':1, 'C':2, 'D':3, 'E':4 };
  qAnswer = mapRes[txtAns];
}

console.log("qText:", !!qText);
console.log("qOptions (isArray):", Array.isArray(qOptions));
console.log("qOptions (length):", qOptions ? qOptions.length : 0);
console.log("qAnswer:", qAnswer, "is undefined:", qAnswer === undefined);
console.log("FINAL CONDITION:", (qText && qOptions && qOptions.length > 1 && qAnswer !== undefined));
