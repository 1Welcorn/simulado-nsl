// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Auth (Google OAuth) ---
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/'
    }
  });
  if (error) {
    console.error('Erro no login do Google:', error.message);
    alert('Erro ao tentar fazer login: ' + error.message + '\n\n(Verifique se ativou o provedor Google e adicionou sua URL da Vercel nas Redirect URLs do Supabase!)');
  }
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Erro ao sair:', error.message);
};

export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.message !== 'Auth session missing!' && error.status !== 401) console.error('Erro ao obter usuário:', error.message);
  return user;
};

// Example helper functions
export const fetchQuestions = async () => {
  const { data, error } = await supabase.from('questions').select('*').order('id', { ascending: true });
  if (error) console.error('Error fetching questions:', error);
  return data;
};

export async function addQuestion(qObj) {
  const { data, error } = await supabase.from('questions').insert([qObj]).select();
  if (error) {
    console.error('Erro ao adicionar questao:', error);
    throw error;
  }
  return data;
}

export async function updateQuestion(id, qObj) {
  const { data, error } = await supabase.from('questions').update(qObj).eq('id', id).select();
  if (error) {
    console.error('Erro ao editar questao:', error);
    throw error;
  }
  return data;
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) {
    console.error('Erro ao deletar questao:', error);
    throw error;
  }
}

export async function uploadImage(fileObj) {
  const fileExt = fileObj.name.split('.').pop();
  const filePath = `${Math.random()}.${fileExt}`;

  // Envia para o storage (bucket)
  const { error: uploadError } = await supabase.storage
    .from('simulado-images')
    .upload(filePath, fileObj);

  if (uploadError) {
    throw uploadError;
  }

  // Resgata o link público da internet
  const { data } = supabase.storage
    .from('simulado-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
export const fetchRankings = async () => {
  // Primero ordenamos por desclassificado (false < true) e depois por nota descendente
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('disqualified', { ascending: true })
    .order('score', { ascending: false });
  if (error) console.error('Error fetching rankings:', error);
  return data;
};

export async function addStudentRecord({ name, grade, score, cpf }) {
  const { data, error } = await supabase.from('students').insert([{ name, grade, score, cpf, disqualified: false }]);
  if (error) console.error('Erro ao adicionar aluno:', error);
  return data;
}

export async function disqualifyStudent(id, reason, teacherEmail) {
  const { data, error } = await supabase
    .from('students')
    .update({ 
      disqualified: true, 
      disqualification_reason: reason,
      disqualified_by: teacherEmail 
    })
    .eq('id', id);
  if (error) {
    console.error('Erro ao desclassificar aluno:', error);
    throw error;
  }
  return data;
}
