import { supabaseClient } from '../supabaseClient.js';

const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

export function mostrarPanel() {
  if (loginView) loginView.style.display = 'none';
  if (panelView) panelView.style.display = 'block';
}

export function mostrarLogin() {
  if (loginView) loginView.style.display = 'block';
  if (panelView) panelView.style.display = 'none';
  limpiarErrorLogin();
}

export function mostrarErrorLogin(mensaje) {
  if (!loginError) return;
  loginError.innerText = mensaje;
  loginError.className = 'admin-msg error';
  loginError.style.display = 'block';
}

export function limpiarErrorLogin() {
  if (!loginError) return;
  loginError.innerText = '';
  loginError.style.display = 'none';
}

export function getLoginCredentials() {
  return {
    email: loginEmail ? loginEmail.value.trim() : '',
    password: loginPassword ? loginPassword.value : ''
  };
}

export async function iniciarSesion(email, password) {
  return await supabaseClient.auth.signInWithPassword({ email, password });
}

export async function cerrarSesion() {
  return await supabaseClient.auth.signOut();
}

export async function revisarSesionActiva() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (session && !error) {
    return session;
  }
  return null;
}
