import {
  supabase, fetchQuestions, addStudentRecord, fetchRankings, addQuestion, uploadImage, updateQuestion, deleteQuestion,
  signInWithGoogle, signOut, getUser
} from './supabase.js';

// DOM Elements
const views = {
  gate: document.getElementById('view-student-gate'),
  quiz: document.getElementById('view-quiz'),
  result: document.getElementById('view-result'),
  ranking: document.getElementById('view-public-ranking'),
  admin: document.getElementById('view-admin'),
};

const navBtns = {
  home: document.getElementById('go-home-btn'),
  admin: document.getElementById('go-admin-btn'),
  ranking: document.getElementById('go-ranking-btn'),
  userInfo: document.getElementById('user-info'),
  logout: document.getElementById('logout-btn'),
};

// Application State
window.questionBankAll = []; // Todas
window.questionBank = []; // Filtradas p/ simulado ativo
window.editingQuestionId = null;

const SKILLS_CONTENT = {
  "Nível Júnior": [
    "Global Communication and Intercultural Exchange",
    "Identity and Self-Expression in English",
    "Language, Culture and Global Citizenship",
    "Reading for Detail and Comprehension",
    "Storytelling and Creative Writing",
    "Writing for Purpose and Audience",
    "Listening for Main Ideas and Inferred Meanings",
    "Listening in Multimodal and Digital Contexts",
    "English in the Digital Age: Memes, Trends and Technology",
    "Everyday Conversations and Real-World Dialogues",
    "Grammar in Context: Form, Meaning and Use",
    "Vocabulary Development through Global Themes",
    "Health, Well-Being, and Mindful Communication",
    "Applied Grammar"
  ],
  "Nível 1": [
    "Understanding and Creating Meaning through Texts",
    "Social Media and Digital Communication",
    "Media Literacy and Critical Reading",
    "Emotions and Human Interaction in Language Use",
    "Humor, Idioms, and Figurative Language",
    "Language for Global Issues: Environment, Health and Equity",
    "Cultural Narratives and Traditions in English-speaking Worlds",
    "Collaboration and Cooperative Communication",
    "Ethics, Respect, and Netiquette in Communication",
    "Innovation and Creativity through Language",
    "Reflecting on Language Learning and Personal Growth"
  ],
  "Nível 2": [
    "Speaking for Connection and Persuasion",
    "Standard English conventions",
    "Global Englishes and Linguistic Diversity",
    "Exploring Global Careers through English",
    "Analyzing Persuasive and Informational Texts"
  ],
  "Nível 3": [
    "Global Politics and Imigration",
    "Business English and Soft Skills",
    "Academic Reading and Argumentation",
    "Writing for Academic and Professional Contexts"
  ]
};

window.updateSkillsDatalist = (level) => {
  const dl = document.getElementById('skills-list');
  const showAll = document.getElementById('admin-q-skill-all')?.checked;
  if (!dl) return;
  dl.innerHTML = '';

  let validSkills = [];
  if (showAll || level === 'Nível 3' || level === 'Nível Livre') {
    // Nível 3, Livre, ou Toggle Ativado cobre todas as +30 skills
    validSkills = [
      ...SKILLS_CONTENT["Nível Júnior"], ...SKILLS_CONTENT["Nível 1"],
      ...SKILLS_CONTENT["Nível 2"], ...SKILLS_CONTENT["Nível 3"]
    ];
  } else if (level === 'Nível Júnior') {
    validSkills = [...SKILLS_CONTENT["Nível Júnior"]];
  } else if (level === 'Nível 1') {
    validSkills = [...SKILLS_CONTENT["Nível Júnior"], ...SKILLS_CONTENT["Nível 1"]];
  } else if (level === 'Nível 2') {
    validSkills = [...SKILLS_CONTENT["Nível Júnior"], ...SKILLS_CONTENT["Nível 1"], ...SKILLS_CONTENT["Nível 2"]];
  }

  validSkills.forEach(skill => {
    const opt = document.createElement('option');
    opt.value = skill;
    dl.appendChild(opt);
  });
};
let student = { name: '', grade: '', cpf: '' };
let currentUser = null;
let role = 'student'; // 'student', 'teacher', 'master'
let editingQuestionId = null;
let currentQIdx = 0;
let score = 0;

const MASTER_EMAIL = 'willians.souza@escola.pr.gov.br';

// UI Helpers
const hideAllViews = () => Object.values(views).forEach(v => {
  if (v) v.classList.add('hidden');
});
const showView = (view) => {
  hideAllViews();
  if (view) view.classList.remove('hidden');
};

const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

// Image Lightbox Logic
window.openImageModal = (src) => {
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('image-modal-img');
  if (modal && modalImg) {
    modalImg.src = src;
    show(modal);
  }
};
document.getElementById('image-modal')?.addEventListener('click', (e) => hide(e.currentTarget));

// Initialization
async function initApp() {
  // Inicializa a Datalist de Conteúdos/Skills dinamicamente com base no Nível
  const levelEl = document.getElementById('admin-q-level');
  const allSkillsEl = document.getElementById('admin-q-skill-all');
  if (levelEl) {
    levelEl.addEventListener('change', (e) => window.updateSkillsDatalist(e.target.value));
    if (allSkillsEl) {
      allSkillsEl.addEventListener('change', () => window.updateSkillsDatalist(levelEl.value));
    }
    window.updateSkillsDatalist(levelEl.value);
  }

  // Configuração dos eventos de Filtro
  document.querySelectorAll('.q-filter').forEach(cb => {
    cb.addEventListener('change', (e) => {
      // Quando desmarcar o "Somente no Simulado", limpa automaticamente todos os filtros para mostrar tudo
      if (e.target.getAttribute('data-type') === 'active' && !e.target.checked) {
        document.querySelectorAll('.q-filter').forEach(c => c.checked = false);
        if (document.getElementById('q-filter-source')) document.getElementById('q-filter-source').value = '';
        if (document.getElementById('q-filter-content')) document.getElementById('q-filter-content').value = '';
      }
      window.refreshQuestionBankList();
    });
  });
  document.getElementById('q-filter-source')?.addEventListener('input', window.refreshQuestionBankList);
  document.getElementById('q-filter-content')?.addEventListener('input', window.refreshQuestionBankList);
  document.getElementById('q-filter-clear-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.q-filter').forEach(cb => cb.checked = false);
    if (document.getElementById('q-filter-source')) document.getElementById('q-filter-source').value = '';
    if (document.getElementById('q-filter-content')) document.getElementById('q-filter-content').value = '';
    window.refreshQuestionBankList();
  });

  // Toggle para Mostrar/Ocultar Filtros e Resumo
  document.getElementById('toggle-filters-btn')?.addEventListener('click', (e) => {
    const wrapper = document.getElementById('admin-filters-summary-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('hidden');
      e.target.textContent = wrapper.classList.contains('hidden') ? 'Mostrar Filtros e Resumo' : 'Ocultar Filtros e Resumo';
    }
  });

  // Check if someone is logged in
  currentUser = await getUser();

  if (currentUser) {
    // ATENÇÃO: Se você fez login com outro e-mail (como seu Gmail pessoal), coloque ele aqui!
    if (currentUser.email === MASTER_EMAIL || currentUser.email === 'COLOQUE_AQUI_SEU_GMAIL_QUE_LOGOU') {
      role = 'master';
      if (document.getElementById('role-badge')) {
        document.getElementById('role-badge').textContent = 'Admin. Principal';
        document.getElementById('role-badge').className = 'badge badge-master';
      }
      show(document.getElementById('tab-questions')); // Master can edit bank
      show(document.getElementById('tab-teachers')); // Master can see teachers
    } else {
      role = 'teacher';
      if (document.getElementById('role-badge')) {
        document.getElementById('role-badge').textContent = 'Professor (Acesso Comum)';
        document.getElementById('role-badge').className = 'badge badge-teacher';
      }
    }

    // Update Topbar
    navBtns.userInfo.textContent = `👤 ${currentUser.email}`;
    show(navBtns.userInfo);
    navBtns.admin.textContent = 'Painel (Logado)';
  }

  // Load Quiz Questions
  const data = await fetchQuestions();
  if (data && data.length > 0) {
    questionBankAll = data;
  } else {
    questionBankAll = [];
  }

  // If they came with #admin in the URL, OR just returned from OAuth redirect (access_token in hash)
  const isOAuthCallback = location.hash.includes('access_token') || location.hash.includes('type=recovery');
  if (currentUser && (location.hash === '#admin' || isOAuthCallback)) {
    location.hash = '#admin';
    await loadAdminDashboard();
  }
}

// -----------------------------------------
// 1. STUDENT GATE FLOW
// -----------------------------------------
document.getElementById('student-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim().toLowerCase();
  const grade = document.getElementById('student-grade').value; // Isto capturará "Nível Júnior", etc.

  if (!name || !grade || !email) return alert('Por favor, preencha todos os campos!');

  if (!email.includes('@escola')) {
    return alert('Acesso Negado: É obrigatório utilizar o seu e-mail institucional (@escola...) para realizar o simulado.');
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.textContent;
  btn.textContent = 'Verificando autorização...';
  btn.disabled = true;

  try {
    // Checa no banco de dados se o e-mail já realizou o teste
    const allStudents = await fetchRankings();
    if (allStudents && allStudents.some(s => s.cpf === email)) {
      alert('Acesso Negado: Você já realizou este simulado! Só é permitida uma tentativa por aluno.');
      return;
    }

    // Usamos o campo 'cpf' do banco de dados para armazenar o email sem precisar alterar a estrutura lá no Supabase
    student = { name, grade, cpf: email };
    currentQIdx = 0;
    score = 0;

    // FILTRA as questões APENAS para o Nível que o estudante selecionou E que estejam ATIVAS na prova
    questionBank = questionBankAll.filter(q => (q.level === student.grade || !q.level) && Boolean(q.is_active));

    // EMBARALHA (Shuffle) as questões para evitar cola (Algoritmo Fisher-Yates)
    for (let i = questionBank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionBank[i], questionBank[j]] = [questionBank[j], questionBank[i]];
    }

    // Register in database immediately as starting
    await addStudentRecord({ name, grade, score: 0, cpf: email });

    const summaryEl = document.getElementById('quiz-student-name');
    if (summaryEl) summaryEl.textContent = name;

    if (questionBank.length === 0) {
      alert(`O banco de dados ainda não tem questões ativas cadastradas para esta categoria. Peça ao administrador para incluir questões!`);
      return;
    }
  } finally {
    btn.textContent = oldText;
    btn.disabled = false;
  }

  showView(views.quiz);
  renderQuestion();
});

document.getElementById('start-registration-btn')?.addEventListener('click', () => {
  document.getElementById('student-name')?.focus();
});

// -----------------------------------------
// 2. QUIZ FLOW
// -----------------------------------------
function renderQuestion() {
  const q = questionBank[currentQIdx];
  const counterEl = document.getElementById('quiz-counter');
  if (counterEl) counterEl.textContent = `Questão ${currentQIdx + 1} de ${questionBank.length}`;

  const progPercent = (currentQIdx / questionBank.length) * 100;
  const progFill = document.getElementById('quiz-progress');
  if (progFill) progFill.style.width = `${progPercent}%`;

  const titleEl = document.getElementById('q-title');
  if (titleEl) {
    if (q.source) {
      titleEl.innerHTML = `<span style="font-size: 0.85rem; font-weight: 500; color: var(--color-primary); display:block; margin-bottom: 0.8rem; background: #e0e7ff; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px dashed #a5b4fc; width: fit-content;">🏛️ Fonte: ${q.source}</span>${q.text}`;
    } else {
      titleEl.textContent = q.text;
    }
  }

  let imgContainer = document.getElementById('q-image-container');
  let imgEl = document.getElementById('q-image');
  if (q.image_url) {
    if (imgEl) {
      imgEl.src = q.image_url;
    } else {
      imgEl = document.createElement('img');
      imgEl.id = 'q-image';
      imgEl.style.maxHeight = '300px';
      imgEl.style.marginBottom = '1rem';
      imgEl.style.borderRadius = '8px';
      imgEl.style.cursor = 'zoom-in';
      imgEl.title = 'Clique para ampliar';
      if (titleEl) titleEl.parentNode.insertBefore(imgEl, titleEl.nextSibling);
      imgEl.src = q.image_url;
    }
    imgEl.onclick = () => window.openImageModal(q.image_url);
    if (imgContainer) show(imgContainer);
    show(imgEl);
  } else {
    if (imgContainer) hide(imgContainer);
    hide(imgEl);
  }

  const optContainer = document.getElementById('q-options');
  if (optContainer) {
    optContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const label = document.createElement('label');
      label.className = 'option-btn';
      const letter = ['A', 'B', 'C', 'D', 'E'][idx] || '-';
      label.innerHTML = `
        <div class="option-letter">${letter}</div>
        <div>
          <input type="radio" name="q-ans" value="${idx}" class="sr-only" />
          ${opt}
        </div>
      `;
      label.addEventListener('click', () => {
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        label.classList.add('selected');
        label.querySelector('input').checked = true;
      });
      optContainer.appendChild(label);
    });
  }
}

document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
  const selected = document.querySelector('input[name="q-ans"]:checked');
  if (!selected) return alert('Escolha uma opção antes de avançar.');

  const ansIdx = parseInt(selected.value);
  if (ansIdx === questionBank[currentQIdx].answer) {
    score++;
  }

  currentQIdx++;
  if (currentQIdx < questionBank.length) {
    renderQuestion();
  } else {
    finishQuiz();
  }
});

async function finishQuiz() {
  const progFill = document.getElementById('quiz-progress');
  if (progFill) progFill.style.width = `100%`;

  // Update final score in Supabase
  try {
    await supabase.from('students').upsert({ name: student.name, grade: student.grade, score: score, cpf: student.cpf });
  } catch (e) { console.error(e); }

  const scoreEl = document.getElementById('result-score-number');
  if (scoreEl) scoreEl.textContent = `${score} / ${questionBank.length}`;

  showView(views.result);
}

// -----------------------------------------
// 2.5. PUBLIC RANKING
// -----------------------------------------
document.getElementById('go-ranking-btn')?.addEventListener('click', async () => {
  showView(views.ranking);
  const tbody = document.getElementById('public-ranking-body');
  const title = document.getElementById('ranking-grade-title');
  if (title) title.textContent = `Categoria: ${student.grade}`;

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Carregando ranking oficial...</td></tr>';
    let data = await fetchRankings();
    if (data) {
      data = data.filter(d => d.grade === student.grade).slice(0, 5); // Pega apenas os 5 melhores
      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Nenhum resultado processado ainda.</td></tr>';
        return;
      }
      data.forEach((s, idx) => {
        const tr = document.createElement('tr');
        let medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '';
        tr.innerHTML = `
          <td style="font-weight:bold; font-size: 1.1rem; color: var(--color-primary);">${medal}${idx + 1}º</td>
          <td style="font-weight:600;">${s.name}</td>
          <td style="color:var(--color-success); font-weight:700;">${s.score} acertos</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
});

// -----------------------------------------
// 3. ADMIN / TEACHER INTEGRATION
// -----------------------------------------
navBtns.admin?.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Iniciando Login Seguro do Google para Professores/Coordenadores...\nAguarde!");
    await signInWithGoogle();
    // Se o login foi via popup (não redirect), o código continua aqui
    currentUser = await getUser();
    if (currentUser) {
      location.hash = '#admin';
      await loadAdminDashboard();
    }
  } else {
    location.hash = '#admin';
    await loadAdminDashboard();
  }
});

navBtns.logout?.addEventListener('click', async () => {
  if (confirm('Deseja sair da conta administrativa escolar?')) {
    await signOut();
    location.hash = '';
    location.reload();
  }
});

async function loadAdminDashboard() {
  if (!currentUser) return;

  if (document.getElementById('admin-welcome-title')) {
    document.getElementById('admin-welcome-title').textContent =
      role === 'master' ? 'Painel de Direção' : 'Painel do Docente';
  }
  if (document.getElementById('admin-welcome-desc')) {
    document.getElementById('admin-welcome-desc').textContent =
      role === 'master' ? 'Gestão total do simulado, questões e notas.' : 'Acompanhamento do simulado para as suas turmas exclusivas.';
  }

  showView(views.admin);
  show(navBtns.home);

  await refreshAdminTable();
  if (role === 'master') {
    refreshQuestionBankList();
    loadTeachersFromDB();
  }
}

// -----------------------------------------
// TABS NAVIGATION (ADMIN PANEL)
// -----------------------------------------
const adminTabButtons = {
  results: document.getElementById('tab-results'),
  questions: document.getElementById('tab-questions'),
  teachers: document.getElementById('tab-teachers'),
};
const adminTabPanels = {
  results: document.getElementById('admin-pnl-results'),
  questions: document.getElementById('admin-pnl-questions'),
  teachers: document.getElementById('admin-pnl-teachers'),
};

const handleTabClick = (tabName) => {
  // Atualiza as cores dos botões
  Object.values(adminTabButtons).forEach(btn => {
    btn?.classList.remove('btn-primary');
    btn?.classList.add('btn-secondary');
  });

  adminTabButtons[tabName]?.classList.remove('btn-secondary');
  adminTabButtons[tabName]?.classList.add('btn-primary');

  // Atualiza a visibilidade dos painéis
  Object.values(adminTabPanels).forEach(panel => panel?.classList.add('hidden'));
  adminTabPanels[tabName]?.classList.remove('hidden');
};

adminTabButtons.results?.addEventListener('click', () => handleTabClick('results'));
adminTabButtons.questions?.addEventListener('click', () => handleTabClick('questions'));
adminTabButtons.teachers?.addEventListener('click', () => handleTabClick('teachers'));

navBtns.home?.addEventListener('click', () => {
  location.hash = '';
  hide(navBtns.home);
  showView(views.gate);
});

// Admin Filter Logic
document.getElementById('admin-filter-grade')?.addEventListener('change', refreshAdminTable);

async function refreshAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Carregando dados da nuvem...</td></tr>';

  let data = await fetchRankings();
  const filter = document.getElementById('admin-filter-grade')?.value || 'all';

  if (data) {
    if (filter !== 'all') {
      data = data.filter(d => d.grade === filter);
    }

    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum aluno encontado para esta turma.</td></tr>';
      return;
    }

    data.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const d = s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Hoje';
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td style="font-weight:600;">${s.name}<br><span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:normal;">E-mail: ${s.cpf || 'Não informado'}</span></td>
        <td><span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${s.grade}</span></td>
        <td style="color:var(--color-success); font-weight:700;">${s.score} acertos</td>
        <td style="font-size:0.85rem; color:gray;">${d}</td>
        <td>
          <button class="btn btn-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="window.deleteStudentResult('${s.id}')">Apagar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

window.deleteStudentResult = async (id) => {
  if (confirm('Tem certeza absoluta que deseja apagar o resultado desse aluno da sua escola? A ação é irreversível.')) {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      alert('Resultado deletado permanentemente do banco!');
      refreshAdminTable();
    } catch (err) {
      alert('Erro ao apagar. ' + err.message);
    }
  }
};

// Master Admin: Add Question
document.getElementById('admin-save-q-btn')?.addEventListener('click', async () => {
  const level = document.getElementById('admin-q-level').value;
  const difficulty = document.getElementById('admin-q-diff').value;
  const theme = document.getElementById('admin-q-theme').value || 'Temas Globais';
  const source = document.getElementById('admin-q-source')?.value.trim() || '';
  const skills = document.getElementById('admin-q-skill')?.value.trim() || '';
  const text = document.getElementById('admin-q-text').value.trim();
  let imageUrl = document.getElementById('admin-q-image').value.trim();
  const fileInput = document.getElementById('admin-q-file');
  const opt0 = document.getElementById('admin-q-opt0').value.trim();
  const opt1 = document.getElementById('admin-q-opt1').value.trim();
  const opt2 = document.getElementById('admin-q-opt2').value.trim();
  const opt3 = document.getElementById('admin-q-opt3').value.trim();
  const opt4 = document.getElementById('admin-q-opt4').value.trim();
  const answer = parseInt(document.getElementById('admin-q-ans').value);

  if (!text || !opt0 || !opt1 || !opt2 || !opt3) return alert('Preencha pelo menos as opções de A até D e o enunciado! (Imagem e Opção E são opcionais)');

  const btn = document.getElementById('admin-save-q-btn');
  btn.textContent = 'Enviando ao servidor...';
  btn.disabled = true;

  try {
    // Se o usuário selecionou um arquivo de imagem local do PC dele, faremos o UPLOAD na nuvem
    if (fileInput && fileInput.files.length > 0) {
      btn.textContent = 'Subindo Imagem...';
      const fileObj = fileInput.files[0];
      imageUrl = await uploadImage(fileObj);
    }

    const _is_active = editingQuestionId ? (questionBankAll.find(x => x.id === editingQuestionId)?.is_active || false) : false;

    // Suportar variações de 4 ou 5 opções na UI Nativa
    let finalOptions = [opt0, opt1, opt2, opt3];
    if (opt4) finalOptions.push(opt4);

    const newQ = { level, difficulty, theme, source: source || null, skills: skills || null, is_active: _is_active, text, options: finalOptions, answer, image_url: imageUrl || null };

    if (editingQuestionId) {
      await updateQuestion(editingQuestionId, newQ);
      const idx = questionBankAll.findIndex(x => x.id === editingQuestionId);
      if (idx > -1) questionBankAll[idx] = { ...questionBankAll[idx], ...newQ };
      alert('Questão atualizada com sucesso!');
      editingQuestionId = null;
    } else {
      const savedRes = await addQuestion(newQ);
      if (savedRes && savedRes[0]) questionBankAll.push(savedRes[0]);
      alert('Nova questão enviada com sucesso!');
    }

    // Clean inputs
    document.getElementById('admin-q-text').value = '';
    document.getElementById('admin-q-image').value = '';
    document.getElementById('admin-q-file').value = '';
    document.getElementById('admin-q-opt0').value = '';
    document.getElementById('admin-q-opt1').value = '';
    document.getElementById('admin-q-opt2').value = '';
    document.getElementById('admin-q-opt3').value = '';
    document.getElementById('admin-q-opt4').value = '';
    document.getElementById('admin-save-q-btn').textContent = 'Adicionar à Base';

    alert('Nova questão salva no Banco com sucesso!');
    questionBank.push(newQ);
    refreshQuestionBankList();
  } catch (err) {
    alert('Erro ao enviar questão! ' + err.message);
  } finally {
    btn.textContent = 'Adicionar à Base';
    btn.disabled = false;
  }
});

// Admin Principal: Bulk Upload (JSON Array)
document.getElementById('admin-bulk-btn')?.addEventListener('click', async () => {
  const jsonStr = document.getElementById('admin-bulk-json').value.trim();
  if (!jsonStr) return alert('Cole um JSON com a lista de questões antes!');
  const btn = document.getElementById('admin-bulk-btn');

  try {
    const list = JSON.parse(jsonStr);
    if (!Array.isArray(list)) return alert('O JSON colado precisa ser um Array, ex: [ { ... }, { ... } ]');

    // Mostra Carregando
    btn.textContent = 'Enviando questoes... Aguarde!';
    btn.disabled = true;

    let enviosBemSucedidos = 0;

    // Zera flags de lote recente antigas
    questionBankAll.forEach(q => q._recentBatch = false);

    // Insere Uma a uma
    for (const rawQ of list) {
      // Normalizador de IA (Converte formato livre para as chaves exatas do banco)
      let qText = rawQ.text || rawQ.enunciado || '';
      if (rawQ.texto_base) qText = rawQ.texto_base + '\n\n' + qText;

      let qLevel = rawQ.level || rawQ.nivel || 'Nível Livre';
      let qImage = rawQ.image_url || rawQ.contexto_visual || rawQ.qImage || null;
      if (typeof qImage === 'string' && qImage.trim() === '') qImage = null; // AI recommendation fix
      let qDifficulty = rawQ.difficulty || rawQ.dificuldade || 'Média';
      let qTheme = rawQ.theme || rawQ.tema || 'Temas Globais';
      let qSource = rawQ.source || rawQ.fonte || rawQ.banca || rawQ.vestibular || rawQ.ano || null;
      let qSkills = rawQ.skills || rawQ.skill || rawQ.habilidade || rawQ.habilidade_especifica || rawQ.conteudo || rawQ.conteudos || rawQ.assunto || null;

      let qOptions = rawQ.options;
      if (!qOptions && rawQ.alternativas) {
        // Converte objeto {"A": "val", "B": "val"} para array indexado
        qOptions = Object.values(rawQ.alternativas);
      }

      let qAnswer = rawQ.answer;
      if (qAnswer === undefined && (rawQ.resposta_correta !== undefined || rawQ.gabarito !== undefined || rawQ.key !== undefined || rawQ.Key !== undefined)) {
        // Mapeia letras 'A', 'B' para indices numéricos 0, 1
        const txtAns = (rawQ.resposta_correta || rawQ.gabarito || rawQ.key || rawQ.Key).toString().trim().toUpperCase();
        const mapRes = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
        qAnswer = mapRes[txtAns];
      }

      if (qText && qOptions && qOptions.length > 1 && qAnswer !== undefined) {

        // Anti-Duplicate Strategy
        const snippet = qText.substring(0, 50).toLowerCase().trim();
        const isDuplicate = questionBankAll.some(existingQ =>
          existingQ.text && existingQ.text.toLowerCase().includes(snippet)
        );

        if (isDuplicate) {
          const addAnyway = confirm(`Foi detectada uma questão repetida (Aviso do Sistema):\n"${qText.substring(0, 80)}..."\n\nDeseja ignorar o alerta e adicionar essa questão no banco mesmo assim?`);
          if (!addAnyway) {
            console.warn('Questão repetida cancelada pelo Admin.');
            continue; // Pula essa inserção e vai para a proxima do JSON!
          }
        }

        const newQ = {
          level: qLevel,
          difficulty: qDifficulty,
          theme: qTheme,
          source: qSource,
          skills: qSkills,
          is_active: false,
          text: qText,
          options: qOptions,
          answer: Number(qAnswer),
          image_url: qImage
        };
        const savedRes = await addQuestion(newQ);
        if (savedRes && savedRes[0]) {
          const finalQ = savedRes[0];
          finalQ._recentBatch = true; // Flag transitória para o filtro
          questionBankAll.push(finalQ);
        }
        enviosBemSucedidos++;
      } else {
        console.warn('Questão pulada pois não tinha o formato mínimo esperado:', JSON.stringify(rawQ));
      }
    }

    document.getElementById('admin-bulk-json').value = '';
    alert(`Sucesso! Foram processadas ${enviosBemSucedidos} novas questões (ignorando Repetidas/Canceladas) pro Banco Geral.`);
    window.refreshQuestionBankList();
  } catch (e) {
    alert('Erro de Leitura no JSON! Verifique aspas ("") e vírgulas. \n\nErro Real: ' + e.message);
  } finally {
    // Restaura Botao
    btn.textContent = '⬇️ Processar JSON';
    btn.disabled = false;
  }
});

// Botão Perigoso: Deletar Banco Inteiro
document.getElementById('admin-nuke-btn')?.addEventListener('click', async () => {
  const confirmFirst = confirm("🚨 ALERTA VERMELHO 🚨\nVocê está prestes a apagar ABSOLUTAMENTE TODAS as questões da sua conta Supabase. Isso vai começar o Simulador do ZERO total.\n\nTem 100% de certeza que quer apagar todas as " + questionBankAll.length + " questões cadastradas?");
  if (!confirmFirst) return;

  const confirmDouble = confirm("Você tem MESMO certeza? Essa ação não tem luto nem volta. Todas sumirão para dar espaço a um novo arquivo. OK para pulverizar.");
  if (!confirmDouble) return;

  const btn = document.getElementById('admin-nuke-btn');
  btn.textContent = "Apagando a nuvem (Isto pode levar alguns segundos)...";
  btn.disabled = true;

  try {
    // Deleta 1 a 1 para evitar os bloqueios de segurança "Bulk Delete" automáticos do limite do Supabase
    for (const q of questionBankAll) {
      await deleteQuestion(q.id);
    }

    questionBankAll = []; // reseta local
    window.refreshQuestionBankList();
    alert('BANCO DE DADOS ZERADO DE FATO! As questões foram aniquiladas do lado do servidor.');
  } catch (e) {
    alert("Erro ao pulverizar uma das questões: " + e.message);
  } finally {
    btn.textContent = "💣 Zerar Banco";
    btn.disabled = false;
  }
});

window.filterFromSummary = (level, difficulty) => {
  // Limpar todos os filtros primeiro
  document.querySelectorAll('.q-filter').forEach(cb => cb.checked = false);
  if (document.getElementById('q-filter-source')) document.getElementById('q-filter-source').value = '';
  if (document.getElementById('q-filter-content')) document.getElementById('q-filter-content').value = '';

  // Ativar filtro "Somente no Simulado"
  const activeCb = document.querySelector('.q-filter[data-type="active"]');
  if (activeCb) activeCb.checked = true;

  // Ativar filtro de Nível
  const levelCb = document.querySelector(`.q-filter[data-type="level"][value="${level}"]`);
  if (levelCb) levelCb.checked = true;

  // Ativar filtro de Dificuldade (se clicado)
  if (difficulty) {
    const diffCb = document.querySelector(`.q-filter[data-type="difficulty"][value="${difficulty}"]`);
    if (diffCb) diffCb.checked = true;
  }

  window.refreshQuestionBankList();
  setTimeout(() => {
    document.getElementById('admin-q-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

window.refreshQuestionBankList = () => {
  const qList = document.getElementById('admin-q-list');
  if (!qList) return;
  qList.innerHTML = '';

  const totalCountEl = document.getElementById('bank-total-count');
  if (totalCountEl) totalCountEl.textContent = `(${questionBankAll.length} questões)`;

  const filterLevel = Array.from(document.querySelectorAll('.q-filter[data-type="level"]:checked')).map(el => el.value);
  const filterDiff = Array.from(document.querySelectorAll('.q-filter[data-type="difficulty"]:checked')).map(el => el.value);
  const filterTheme = Array.from(document.querySelectorAll('.q-filter[data-type="theme"]:checked')).map(el => el.value);
  const filterRecent = document.querySelector('.q-filter[data-type="recent"]')?.checked;
  const filterActive = document.querySelector('.q-filter[data-type="active"]')?.checked;
  const filterSource = document.getElementById('q-filter-source')?.value.toLowerCase().trim() || '';
  const filterContent = document.getElementById('q-filter-content')?.value.toLowerCase().trim() || '';

  const filteredBank = questionBankAll.filter(q => {
    if (filterRecent && !q._recentBatch) return false;
    if (filterActive && !q.is_active) return false;
    if (filterLevel.length > 0 && !filterLevel.includes(q.level)) return false;
    if (filterDiff.length > 0 && !filterDiff.includes(q.difficulty)) return false;
    if (filterTheme.length > 0 && !filterTheme.includes(q.theme)) return false;

    if (filterSource && (!q.source || !q.source.toLowerCase().includes(filterSource))) return false;
    if (filterContent && (!q.skills || !q.skills.toLowerCase().includes(filterContent))) return false;

    return true;
  });

  filteredBank.forEach((q, i) => {
    const d = document.createElement('div');
    d.style.cssText = "padding: 0.75rem; border: 1px dashed var(--color-border); border-radius:var(--radius-md); background: #f8fafc; margin-bottom: 0.5rem; transition: background 0.3s;";
    if (q.is_active) d.style.background = "#eff6ff"; // light blue if selected

    const isActiveChecked = q.is_active ? 'checked' : '';
    let badgeColor = '#64748b';
    if (q.difficulty === 'Fácil') badgeColor = 'var(--color-success)';
    if (q.difficulty === 'Difícil') badgeColor = 'var(--color-danger)';
    if (q.difficulty === 'Média') badgeColor = '#f59e0b';

    // Accordion UI
    d.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:start; cursor:pointer;" onclick="const e = document.getElementById('q-det-${q.id}'); if(e) e.classList.toggle('hidden');">
        <div style="flex:1;">
          <strong title="Número organizado sequencialmente" style="cursor:help; padding-bottom: 0.1rem; margin-right: 0.5rem; font-size: 1rem; color: var(--color-primary);">Questão ${String(questionBankAll.findIndex(x => x.id === q.id) + 1).padStart(2, '0')}</strong> 
          <span title="ID real no banco de dados" style="font-size: 0.7rem; color: var(--color-text-muted); margin-right: 0.5rem;">(ID BD: ${q.id})</span>
          <span style="font-size: 0.75rem; background: var(--color-bg); padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid var(--color-border);">${q.level || 'Nível Livre'}</span>
          <span style="font-size: 0.75rem; background: ${badgeColor}; color: white; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid transparent; margin-left: 0.25rem;">${q.difficulty || 'Média'}</span>
          <span style="font-size: 0.70rem; background: #f1f5f9; color: #334155; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px dashed #cbd5e1; margin-left: 0.25rem;">📌 ${q.theme || 'Temas Globais'}</span>
          ${q.source ? `<span style="font-size: 0.70rem; background: #fffbeb; color: #b45309; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #fde68a; margin-left: 0.25rem;">🏛️ ${q.source}</span>` : ''}
          ${q.skills ? `<span style="font-size: 0.70rem; background: #fdf4ff; color: #a21caf; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px dashed #f0abfc; margin-left: 0.25rem;">🧠 ${q.skills}</span>` : ''}
          <br/>
          <div style="font-size: 0.9rem; color: #475569; margin-top: 0.3rem;">
            ${(q.text || '').substring(0, 60)}... 
            <span style="color:var(--color-primary); font-size:0.8rem;">(Ver Detalhes)</span>
          </div>
        </div>
        
        <div style="display:flex; align-items:center;" onclick="event.stopPropagation()">
          <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; background: #fff; padding: 0.3rem 0.6rem; border: 1px solid var(--color-border); border-radius: 6px;">
            <input type="checkbox" onchange="window.toggleActiveState(${q.id}, this.checked)" ${isActiveChecked}>
            <span style="font-size: 0.8rem; font-weight: 600;">No Simulado?</span>
          </label>
        </div>
      </div>
      
      <div id="q-det-${q.id}" class="hidden" style="margin-top: 1.5rem; padding: 1.5rem; border-top: 1px dashed var(--color-border); background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); cursor: default;" onclick="event.stopPropagation()">
        
        <div style="text-align:center; margin-bottom: 1rem;"><span style="background:var(--color-bg); padding: 0.2rem 1rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--color-border); color: var(--color-text);">👀 VISÃO DO ALUNO</span></div>
        
        <h2 style="font-size: clamp(1.2rem, 1.5vw + 0.5rem, 1.8rem); line-height: 1.3; margin-bottom: 1rem; color: var(--color-text); white-space: pre-wrap;">${q.source ? `<span style="font-size: 0.85rem; font-weight: 500; color: var(--color-primary); display:block; margin-bottom: 0.8rem; background: #e0e7ff; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px dashed #a5b4fc; width: fit-content;">🏛️ Fonte: ${q.source}</span>` : ''}${q.text}</h2>
        
        ${q.image_url ? `
        <div style="margin-top: 1.5rem; margin-bottom: 1.5rem; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--color-border); max-width: 100%; text-align: center; background: white;">
             <img src="${q.image_url}" alt="Contexto da Pergunta" title="Clique para ampliar" style="max-height: 400px; width: auto; max-width: 100%; display: inline-block; padding: 0.5rem; cursor: zoom-in;" onclick="window.openImageModal('${q.image_url}')" />
        </div>` : ''}
        
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
          ${(q.options || []).map((opt, idx) => {
      if (!opt) return '';
      const isCorrect = q.answer === idx;
      const bg = isCorrect ? 'var(--color-success)' : 'transparent';
      const color = isCorrect ? 'white' : 'var(--color-text)';
      return `
              <div style="display: block; width: 100%; text-align: left; background: ${bg}; color: ${color}; border: 2px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-border)'}; border-radius: var(--radius-md); padding: clamp(0.6rem, 1vw, 1rem) clamp(1rem, 1.5vw, 1.5rem); font-size: clamp(1rem, 1.2vw + 0.2rem, 1.3rem); font-weight: 500;">
                ${['A', 'B', 'C', 'D', 'E'][idx] || 'X'}) ${opt}
              </div>
            `;
    }).join('')}
        </div>

        <div style="margin-top: 1rem; text-align: right;">
        <button class="btn btn-secondary" onclick="window.editQuestion(${q.id})" style="padding: 0.4rem 1rem; font-size: 0.8rem;">✏️ Editar</button>
        <button class="btn btn-danger" onclick="window.deleteQuestion(${q.id})" style="padding: 0.4rem 1rem; font-size: 0.8rem;">🗑️ Apagar</button>
      </div>
    `;
    qList.appendChild(d);
  });

  const sumDiv = document.getElementById('admin-q-summary');

  const activeQs = questionBankAll.filter(q => q.is_active);
  if (activeQs.length === 0) {
    sumDiv.classList.add('hidden');
    return;
  }

  sumDiv.classList.remove('hidden');

  const stats = {};
  activeQs.forEach(q => {
    let l = q.level || 'Geral';
    let d = q.difficulty || 'Média';

    if (!stats[l]) stats[l] = { total: 0, F: 0, M: 0, D: 0 };
    stats[l].total++;

    if (d === 'Fácil') stats[l].F++;
    if (d === 'Média') stats[l].M++;
    if (d === 'Difícil') stats[l].D++;
  });

  let html = `<h4 style="margin-bottom:0.8rem; color: #1e293b; font-size: 1rem;">📊 Resumo da Prova do Simulado (O que já está selecionado)</h4>`;
  html += `<div style="display:flex; flex-wrap:wrap; gap:1rem;">`;

  for (const [lvl, s] of Object.entries(stats)) {
    html += `
       <div style="background: white; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; flex: 1; min-width: 200px;">
         <strong onclick="window.filterFromSummary('${lvl}')" style="color:var(--color-primary); font-size: 1.1rem; cursor:pointer; text-decoration:underline;" title="Ver todas as selecionadas deste nível">${lvl}</strong> <span style="font-size: 0.9rem; color: #64748b;">(${s.total} Questões)</span><br/>
         <div style="display:flex; gap:0.5rem; font-size:0.85rem; margin-top:0.4rem;">
            ${s.F > 0 ? `<span onclick="window.filterFromSummary('${lvl}', 'Fácil')" style="background: #dcfce7; color: #166534; padding: 0.2rem 0.5rem; border-radius: 4px; cursor:pointer; display:inline-block;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="Ver questões Fáceis selecionadas">🎯 ${s.F} Fáceis</span>` : ''}
            ${s.M > 0 ? `<span onclick="window.filterFromSummary('${lvl}', 'Média')" style="background: #fef3c7; color: #b45309; padding: 0.2rem 0.5rem; border-radius: 4px; cursor:pointer; display:inline-block;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="Ver questões Médias selecionadas">⚖️ ${s.M} Médias</span>` : ''}
            ${s.D > 0 ? `<span onclick="window.filterFromSummary('${lvl}', 'Difícil')" style="background: #fee2e2; color: #991b1b; padding: 0.2rem 0.5rem; border-radius: 4px; cursor:pointer; display:inline-block;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="Ver questões Difíceis selecionadas">🌶️ ${s.D} Difíceis</span>` : ''}
         </div>
       </div>
     `;
  }
  html += `</div>`;

  if (typeof filteredBank !== 'undefined' && filteredBank.length !== questionBankAll.length) {
    html += `<div style="text-align:right; margin-top:1rem; font-weight:600; color:var(--color-accent); font-size: 0.85rem;">⚠️ Atenção: A lista de questões abaixo está filtrada. Mostrando ${filteredBank.length} de ${questionBankAll.length} questões do banco.</div>`;
  }

  sumDiv.innerHTML = html;
}

window.toggleActiveState = async (id, isChecked) => {
  try {
    await updateQuestion(id, { is_active: isChecked });
    const q = questionBankAll.find(x => x.id === id);
    if (q) q.is_active = isChecked;
    refreshQuestionBankList(); // update colors and states
  } catch (e) {
    alert('Erro ao ligar/desligar a questão da prova: ' + e.message);
  }
};

window.editQuestion = (id) => {
  const q = questionBankAll.find(x => x.id === id);
  if (!q) return;
  editingQuestionId = id;

  if (document.getElementById('admin-q-level')) {
    document.getElementById('admin-q-level').value = q.level || 'Nível Livre';
    window.updateSkillsDatalist(q.level || 'Nível Livre');
  }
  if (document.getElementById('admin-q-diff')) document.getElementById('admin-q-diff').value = q.difficulty || 'Média';
  if (document.getElementById('admin-q-theme')) document.getElementById('admin-q-theme').value = q.theme || 'Temas Globais';
  if (document.getElementById('admin-q-source')) document.getElementById('admin-q-source').value = q.source || '';
  if (document.getElementById('admin-q-skill')) document.getElementById('admin-q-skill').value = q.skills || '';

  document.getElementById('admin-q-text').value = q.text || '';
  document.getElementById('admin-q-image').value = q.image_url || '';
  document.getElementById('admin-q-file').value = '';
  document.getElementById('admin-q-opt0').value = q.options[0] || '';
  document.getElementById('admin-q-opt1').value = q.options[1] || '';
  document.getElementById('admin-q-opt2').value = q.options[2] || '';
  document.getElementById('admin-q-opt3').value = q.options[3] || '';
  document.getElementById('admin-q-opt4').value = q.options[4] || ''; // Support 5th E Option

  const ansEl = document.getElementById('admin-q-ans');
  ansEl.value = q.answer || 0;
  document.getElementById('admin-q-image').value = q.image_url || '';

  const btn = document.getElementById('admin-save-q-btn');
  btn.textContent = 'Salvar Alterações';
  document.getElementById('admin-pnl-questions').scrollIntoView({ behavior: 'smooth' });
};

window.deleteQuestion = async (id) => {
  if (confirm('Tem certeza absoluta que deseja EXCLUIR essa questão do banco da sua escola?')) {
    try {
      await deleteQuestion(id);
      questionBankAll = questionBankAll.filter(x => x.id !== id);
      refreshQuestionBankList();
      alert('Apagada permanentemente!');
    } catch (err) {
      alert('Erro ao apagar. ' + err.message);
    }
  }
};

// -----------------------------------------
// TEACHER MANAGEMENT (Admin Principal)
// -----------------------------------------
let authorizedTeachers = [];

async function loadTeachersFromDB() {
  try {
    const { data, error } = await supabase.from('teachers').select('*');
    if (error) throw error;
    authorizedTeachers = data ? data.map(t => t.email) : [];
    refreshTeachersList();
  } catch (err) {
    console.error('Erro ao carregar professores:', err);
  }
}

document.getElementById('add-teacher-btn')?.addEventListener('click', async () => {
  const email = document.getElementById('new-teacher-email').value.trim().toLowerCase();
  if (!email) return alert('Digite o e-mail do professor!');

  const btn = document.getElementById('add-teacher-btn');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    const { error } = await supabase.from('teachers').insert([{ email }]);
    if (error) throw error;

    authorizedTeachers.push(email);
    document.getElementById('new-teacher-email').value = '';
    refreshTeachersList();
    alert('Professor adicionado e salvo no Supabase com sucesso!');
  } catch (err) {
    alert('Erro ao adicionar professor: ' + err.message);
  } finally {
    btn.textContent = 'Autorizar Acesso';
    btn.disabled = false;
  }
});

function refreshTeachersList() {
  const list = document.getElementById('admin-teachers-list');
  if (!list) return;
  list.innerHTML = '';
  authorizedTeachers.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600; color:var(--color-text);">${t}</td>
      <td><span class="badge badge-teacher">Acesso Liberado</span></td>
      <td><button class="btn btn-danger" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="window.removeTeacher('${t}')">Remover</button></td>
    `;
    list.appendChild(tr);
  });
}

window.removeTeacher = async (email) => {
  if (confirm(`Tem certeza que deseja remover o acesso do professor ${email}?`)) {
    try {
      const { error } = await supabase.from('teachers').delete().eq('email', email);
      if (error) throw error;

      authorizedTeachers = authorizedTeachers.filter(t => t !== email);
      refreshTeachersList();
      alert('Acesso do professor removido com sucesso!');
    } catch (err) {
      alert('Erro ao remover professor: ' + err.message);
    }
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
