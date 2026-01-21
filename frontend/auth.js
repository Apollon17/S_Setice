const API_BASE = 'http://localhost:8000/api';

function showNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
}

async function loginDirecteur(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Connexion...';
    
    try {
        const response = await fetch(`${API_BASE}/auth/login-directeur`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, mot_de_passe: password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Identifiants incorrects');
        }
        
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user_type', data.user_type);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('nom_complet', data.nom_complet);
        
        showNotification('Connexion réussie ! Redirection...', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Se connecter';
    }
}

async function loginUser(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Connexion...';
    
    try {
        const response = await fetch(`${API_BASE}/auth/login-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, mot_de_passe: password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Identifiants incorrects');
        }
        
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user_type', data.user_type);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('nom_complet', data.nom_complet);
        
        showNotification('Connexion réussie ! Redirection...', 'success');
        
        setTimeout(() => {
            if (data.user_type === 'formateur') {
                window.location.href = 'dashboard-formateur.html';
            } else {
                window.location.href = 'dashboard-etudiant.html';
            }
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Se connecter';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function checkAuth(allowedTypes = []) {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('user_type');
    
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(userType)) {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

function getCurrentUser() {
    return {
        user_type: localStorage.getItem('user_type'),
        user_id: localStorage.getItem('user_id'),
        nom_complet: localStorage.getItem('nom_complet')
    };
}
