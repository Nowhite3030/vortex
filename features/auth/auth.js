const AUTH_KEY = "vortex_current_user_v1";
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const currentUserName = document.getElementById("currentUserName");
const currentUserRole = document.getElementById("currentUserRole");

function getCurrentUser(){ try{return JSON.parse(sessionStorage.getItem(AUTH_KEY));}catch{return null;} }
function isAdmin(){ const user=getCurrentUser(); return user?.role === "admin"; }
function requireLogin(){
  const user=getCurrentUser();
  if(user){
    loginView.classList.add("hidden"); appView.classList.remove("hidden");
    currentUserName.textContent = user.displayName;
    currentUserRole.textContent = window.ROLE_LABELS[user.role] || user.role;
    document.body.dataset.role = user.role;
    return true;
  }
  loginView.classList.remove("hidden"); appView.classList.add("hidden"); return false;
}
function login(username,password){
  const found = window.APP_USERS.find(u => u.username === username && u.password === password);
  if(!found) return false;
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({username:found.username, displayName:found.displayName, role:found.role}));
  return true;
}
loginForm.addEventListener("submit", e => {
  e.preventDefault();
  if(login(loginUsername.value.trim(), loginPassword.value)){
    loginError.textContent = ""; loginPassword.value = ""; requireLogin(); window.dispatchEvent(new Event("auth:changed"));
  } else loginError.textContent = "帳號或密碼錯誤";
});
logoutBtn.addEventListener("click", () => { sessionStorage.removeItem(AUTH_KEY); requireLogin(); });
window.Auth = { getCurrentUser, isAdmin, requireLogin };
