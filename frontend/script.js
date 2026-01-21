let currentSection = 'dashboard';
let currentData = {
    formateurs: [],
    promotions: [],
    etudiants: [],
    espaces: [],
    directeurs: []
};

function showSection(section) {
    console.log('=== SHOW SECTION ===');
    console.log('Section:', section);
    
    const allSections = document.querySelectorAll('[id^="section-"]');
    console.log('Total sections:', allSections.length);
    
    allSections.forEach(el => {
        el.classList.add('hidden');
        console.log('Hide:', el.id);
    });
    
    const targetSection = document.getElementById(`section-${section}`);
    console.log('Target section:', targetSection);
    
    if (!targetSection) {
        console.error('Section not found:', `section-${section}`);
        alert('ERREUR: Section ' + section + ' introuvable!');
        return;
    }
    
    targetSection.classList.remove('hidden');
    console.log('Section visible:', section);
    
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`[data-section="${section}"]`).forEach(el => {
        el.classList.add('active');
        console.log('Activated nav:', el);
    });
    
    currentSection = section;
    
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'formateurs':
            console.log('Loading formateurs...');
            loadFormateurs();
            break;
        case 'promotions':
            console.log('Loading promotions...');
            loadPromotions();
            break;
        case 'etudiants':
            console.log('Loading etudiants...');
            loadEtudiants();
            break;
        case 'espaces':
            console.log('Loading espaces...');
            loadEspaces();
            break;
        case 'directeurs':
            console.log('Loading directeurs...');
            loadDirecteurs();
            break;
        default:
            console.warn('Unknown section:', section);
    }
}

async function loadDashboard() {
    try {
        const headers = getAuthHeaders();
        
        const [formateurs, promotions, etudiants, espaces] = await Promise.all([
            fetch(`${API_BASE}/formateurs`, { headers }).then(r => {
                if (!r.ok) throw new Error('Erreur formateurs');
                return r.json();
            }).catch(e => []),
            fetch(`${API_BASE}/promotions`, { headers }).then(r => {
                if (!r.ok) throw new Error('Erreur promotions');
                return r.json();
            }).catch(e => []),
            fetch(`${API_BASE}/etudiants`, { headers }).then(r => {
                if (!r.ok) throw new Error('Erreur étudiants');
                return r.json();
            }).catch(e => []),
            fetch(`${API_BASE}/espaces`, { headers }).then(r => {
                if (!r.ok) throw new Error('Erreur espaces');
                return r.json();
            }).catch(e => [])
        ]);
        
        document.getElementById('stat-formateurs').textContent = formateurs.length;
        document.getElementById('stat-promotions').textContent = promotions.length;
        document.getElementById('stat-etudiants').textContent = etudiants.length;
        document.getElementById('stat-espaces').textContent = espaces.length;
    } catch (error) {
        console.error('Erreur dashboard:', error);
        showNotification('Erreur lors du chargement des statistiques', 'error');
    }
}

async function loadFormateurs() {
    try {
        const response = await fetch(`${API_BASE}/formateurs`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        currentData.formateurs = await response.json();
        renderFormateurs(currentData.formateurs);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderFormateurs(formateurs) {
    const tbody = document.getElementById('formateurs-list');
    
    if (formateurs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Aucun formateur trouvé</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = formateurs.map(f => `
        <tr>
            <td>${f.nom_complet}</td>
            <td>${f.email}</td>
            <td>${f.telephone || '-'}</td>
            <td>${f.specialite || '-'}</td>
            <td>
                ${f.compte_active 
                    ? '<span class="badge badge-success">Activé</span>' 
                    : '<span class="badge badge-warning">Inactif</span>'}
            </td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-icon" onclick="editFormateur('${f.id}')" title="Modifier">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                ${!f.compte_active ? `
                    <button class="btn btn-warning btn-icon" onclick="relanceCompte('${f.id}', 'formateur')" title="Relancer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-icon" onclick="deleteFormateur('${f.id}')" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function openFormateurModal(id = null) {
    const formateur = id ? currentData.formateurs.find(f => f.id === id) : null;
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${formateur ? 'Modifier le formateur' : 'Nouveau formateur'}</h2>
            </div>
            <div class="modal-body">
                <form id="formateur-form" onsubmit="saveFormateur(event, ${formateur ? `'${id}'` : 'null'})">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="nom_complet">Nom complet *</label>
                            <input type="text" id="nom_complet" required value="${formateur?.nom_complet || ''}">
                        </div>
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" required value="${formateur?.email || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="telephone">Téléphone</label>
                            <input type="tel" id="telephone" value="${formateur?.telephone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="specialite">Spécialité</label>
                            <input type="text" id="specialite" value="${formateur?.specialite || ''}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">
                            ${formateur ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveFormateur(event, id = null) {
    event.preventDefault();
    
    const data = {
        nom_complet: document.getElementById('nom_complet').value,
        email: document.getElementById('email').value,
        telephone: document.getElementById('telephone').value || null,
        specialite: document.getElementById('specialite').value || null
    };
    
    try {
        const url = id ? `${API_BASE}/formateurs/${id}` : `${API_BASE}/formateurs`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la sauvegarde');
        }
        
        const result = await response.json();
        
        if (!id && result.mot_de_passe_clair) {
            showCredentialsModal(result.email, result.mot_de_passe_clair);
        } else {
            closeModal();
            showNotification(id ? 'Formateur modifié avec succès' : 'Formateur créé avec succès', 'success');
        }
        
        await loadFormateurs();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showCredentialsModal(email, password) {
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>✅ Formateur créé avec succès</h2>
            </div>
            <div class="modal-body">
                <div class="credentials-box">
                    <p><strong>Transmettez ces identifiants au formateur :</strong></p>
                    <div class="credential-item">
                        <label>Email</label>
                        <span id="cred-email">${email}</span>
                    </div>
                    <div class="credential-item">
                        <label>Mot de passe</label>
                        <span id="cred-password">${password}</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-large" onclick="copyCredentials('${email}', '${password}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span id="copy-btn-text">Copier les identifiants</span>
                </button>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function copyCredentials(email, password) {
    const text = `Email: ${email}\nMot de passe: ${password}`;
    
    try {
        await navigator.clipboard.writeText(text);
        
        const btn = document.getElementById('copy-btn-text');
        const btnParent = btn.parentElement;
        
        btn.innerHTML = '✓ Copié !';
        btnParent.classList.add('btn-success');
        btnParent.classList.remove('btn-primary');
        
        showNotification('Identifiants copiés dans le presse-papier !', 'success');
        
        setTimeout(() => {
            btn.innerHTML = 'Copier les identifiants';
            btnParent.classList.remove('btn-success');
            btnParent.classList.add('btn-primary');
        }, 3000);
    } catch (err) {
        showNotification('Erreur lors de la copie', 'error');
    }
}

async function deleteFormateur(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce formateur ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/formateurs/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Erreur lors de la suppression');
        
        showNotification('Formateur supprimé avec succès', 'success');
        await loadFormateurs();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function editFormateur(id) {
    openFormateurModal(id);
}

async function loadPromotions() {
    try {
        const response = await fetch(`${API_BASE}/promotions`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        currentData.promotions = await response.json();
        renderPromotions(currentData.promotions);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderPromotions(promotions) {
    const tbody = document.getElementById('promotions-list');
    
    if (promotions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>Aucune promotion trouvée</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = promotions.map(p => `
        <tr>
            <td>${p.nom}</td>
            <td>${p.annee_debut}</td>
            <td>${p.annee_fin}</td>
            <td>${p.nombre_etudiants}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-icon" onclick="editPromotion('${p.id}')" title="Modifier">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="btn btn-danger btn-icon" onclick="deletePromotion('${p.id}')" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPromotionModal(id = null) {
    const promotion = id ? currentData.promotions.find(p => p.id === id) : null;
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${promotion ? 'Modifier la promotion' : 'Nouvelle promotion'}</h2>
            </div>
            <div class="modal-body">
                <form id="promotion-form" onsubmit="savePromotion(event, ${promotion ? `'${id}'` : 'null'})">
                    <div class="form-group">
                        <label for="nom">Nom de la promotion *</label>
                        <input type="text" id="nom" required value="${promotion?.nom || ''}" placeholder="Licence 3 Informatique">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="annee_debut">Année de début *</label>
                            <input type="number" id="annee_debut" required value="${promotion?.annee_debut || new Date().getFullYear()}" min="2000" max="2100">
                        </div>
                        <div class="form-group">
                            <label for="annee_fin">Année de fin *</label>
                            <input type="number" id="annee_fin" required value="${promotion?.annee_fin || new Date().getFullYear() + 1}" min="2000" max="2100">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description">${promotion?.description || ''}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">
                            ${promotion ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function savePromotion(event, id = null) {
    event.preventDefault();
    
    const data = {
        nom: document.getElementById('nom').value,
        annee_debut: parseInt(document.getElementById('annee_debut').value),
        annee_fin: parseInt(document.getElementById('annee_fin').value),
        description: document.getElementById('description').value || null
    };
    
    try {
        const url = id ? `${API_BASE}/promotions/${id}` : `${API_BASE}/promotions`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la sauvegarde');
        }
        
        closeModal();
        showNotification(id ? 'Promotion modifiée avec succès' : 'Promotion créée avec succès', 'success');
        await loadPromotions();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deletePromotion(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/promotions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la suppression');
        }
        
        showNotification('Promotion supprimée avec succès', 'success');
        await loadPromotions();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function editPromotion(id) {
    openPromotionModal(id);
}

async function loadEtudiants() {
    try {
        const response = await fetch(`${API_BASE}/etudiants`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        currentData.etudiants = await response.json();
        renderEtudiants(currentData.etudiants);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderEtudiants(etudiants) {
    const tbody = document.getElementById('etudiants-list');
    
    if (etudiants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Aucun étudiant trouvé</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = etudiants.map(e => `
        <tr>
            <td>${e.nom_complet}</td>
            <td>${e.email}</td>
            <td>${e.matricule}</td>
            <td>${e.promotion_nom || '-'}</td>
            <td>
                ${e.compte_active 
                    ? '<span class="badge badge-success">Activé</span>' 
                    : '<span class="badge badge-warning">Inactif</span>'}
            </td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-icon" onclick="editEtudiant('${e.id}')" title="Modifier">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                ${!e.compte_active ? `
                    <button class="btn btn-warning btn-icon" onclick="relanceCompte('${e.id}', 'etudiant')" title="Relancer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-icon" onclick="deleteEtudiant('${e.id}')" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

async function openEtudiantModal(id = null) {
    const etudiant = id ? currentData.etudiants.find(e => e.id === id) : null;
    
    if (currentData.promotions.length === 0) {
        await loadPromotions();
    }
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${etudiant ? 'Modifier l\'étudiant' : 'Nouvel étudiant'}</h2>
            </div>
            <div class="modal-body">
                <form id="etudiant-form" onsubmit="saveEtudiant(event, ${etudiant ? `'${id}'` : 'null'})">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="nom_complet">Nom complet *</label>
                            <input type="text" id="nom_complet" required value="${etudiant?.nom_complet || ''}">
                        </div>
                        <div class="form-group">
                            <label for="matricule">Matricule *</label>
                            <input type="text" id="matricule" required value="${etudiant?.matricule || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" required value="${etudiant?.email || ''}">
                        </div>
                        <div class="form-group">
                            <label for="telephone">Téléphone</label>
                            <input type="tel" id="telephone" value="${etudiant?.telephone || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="promotion_id">Promotion *</label>
                        <select id="promotion_id" required>
                            <option value="">Sélectionner une promotion</option>
                            ${currentData.promotions.map(p => `
                                <option value="${p.id}" ${etudiant?.promotion_id === p.id ? 'selected' : ''}>
                                    ${p.nom}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">
                            ${etudiant ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveEtudiant(event, id = null) {
    event.preventDefault();
    
    const data = {
        nom_complet: document.getElementById('nom_complet').value,
        matricule: document.getElementById('matricule').value,
        email: document.getElementById('email').value,
        telephone: document.getElementById('telephone').value || null,
        promotion_id: document.getElementById('promotion_id').value
    };
    
    try {
        const url = id ? `${API_BASE}/etudiants/${id}` : `${API_BASE}/etudiants`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la sauvegarde');
        }
        
        const result = await response.json();
        
        if (!id && result.mot_de_passe_clair) {
            showCredentialsModal(result.email, result.mot_de_passe_clair);
        } else {
            closeModal();
            showNotification(id ? 'Étudiant modifié avec succès' : 'Étudiant créé avec succès', 'success');
        }
        
        await loadEtudiants();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteEtudiant(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet étudiant ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/etudiants/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Erreur lors de la suppression');
        
        showNotification('Étudiant supprimé avec succès', 'success');
        await loadEtudiants();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function editEtudiant(id) {
    openEtudiantModal(id);
}

async function relanceCompte(id, type) {
    if (!confirm('Voulez-vous régénérer les identifiants de ce compte ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/users/${id}/relance`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la relance');
        }
        
        const result = await response.json();
        showCredentialsModal(result.email, result.nouveau_mot_de_passe);
        
        if (type === 'formateur') {
            await loadFormateurs();
        } else {
            await loadEtudiants();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadEspaces() {
    try {
        const response = await fetch(`${API_BASE}/espaces`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        currentData.espaces = await response.json();
        renderEspaces(currentData.espaces);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderEspaces(espaces) {
    const tbody = document.getElementById('espaces-list');
    
    if (espaces.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Aucun espace pédagogique trouvé</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = espaces.map(e => `
        <tr>
            <td>${e.nom_matiere}</td>
            <td>${e.code_matiere}</td>
            <td>${e.coefficient}</td>
            <td>${e.formateurs?.length || 0}</td>
            <td>${e.etudiants?.length || 0}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary" onclick="viewEspace('${e.id}')" title="Gérer">
                    Gérer
                </button>
                <button class="btn btn-secondary btn-icon" onclick="editEspace('${e.id}')" title="Modifier">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                
                <button class="btn btn-danger btn-icon" onclick="deleteEspace('${e.id}')" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function openEspaceModal(id = null) {
    const espace = id ? currentData.espaces.find(e => e.id === id) : null;
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${espace ? 'Modifier l\'espace' : 'Nouvel espace pédagogique'}</h2>
            </div>
            <div class="modal-body">
                <form id="espace-form" onsubmit="saveEspace(event, ${espace ? `'${id}'` : 'null'})">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="nom_matiere">Nom de la matière *</label>
                            <input type="text" id="nom_matiere" required value="${espace?.nom_matiere || ''}" placeholder="Mathématiques">
                        </div>
                        <div class="form-group">
                            <label for="code_matiere">Code matière *</label>
                            <input type="text" id="code_matiere" required value="${espace?.code_matiere || ''}" placeholder="MAT101">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="coefficient">Coefficient *</label>
                            <input type="number" id="coefficient" required value="${espace?.coefficient || 1}" min="1" max="10">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description">${espace?.description || ''}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">
                            ${espace ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveEspace(event, id = null) {
    event.preventDefault();
    
    const data = {
        nom_matiere: document.getElementById('nom_matiere').value,
        code_matiere: document.getElementById('code_matiere').value,
        coefficient: parseInt(document.getElementById('coefficient').value),
        description: document.getElementById('description').value || null
    };
    
    try {
        const url = id ? `${API_BASE}/espaces/${id}` : `${API_BASE}/espaces`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la sauvegarde');
        }
        
        closeModal();
        showNotification(id ? 'Espace modifié avec succès' : 'Espace créé avec succès', 'success');
        await loadEspaces();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function viewEspace(id) {
    const espace = currentData.espaces.find(e => e.id === id);
    if (!espace) return;
    
    if (currentData.formateurs.length === 0) await loadFormateurs();
    if (currentData.promotions.length === 0) await loadPromotions();
    if (currentData.etudiants.length === 0) await loadEtudiants();
    
    const modalContent = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>${espace.nom_matiere} (${espace.code_matiere})</h2>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Formateurs assignés</h3>
                    ${espace.formateurs.length > 0 ? `
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${espace.formateurs.map(f => `<span class="badge badge-info">${f.nom_complet}</span>`).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">Aucun formateur assigné</p>'}
                    <button class="btn btn-secondary" style="margin-top: 12px;" onclick="assignFormateur('${id}')">
                        Ajouter un formateur
                    </button>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Promotions assignées</h3>
                    ${espace.promotions.length > 0 ? `
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${espace.promotions.map(p => `<span class="badge badge-success">${p.nom}</span>`).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">Aucune promotion assignée</p>'}
                    <button class="btn btn-secondary" style="margin-top: 12px;" onclick="assignPromotion('${id}')">
                        Ajouter une promotion
                    </button>
                </div>
                
                <div>
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Étudiants (${espace.etudiants?.length || 0})</h3>
                    ${espace.etudiants?.length > 0 ? `
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
                            ${espace.etudiants.map(e => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
                                    <span>${e.nom_complet}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">Aucun étudiant</p>'}
                </div>


            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function assignFormateur(espaceId) {
    if (currentData.formateurs.length === 0) await loadFormateurs();
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Ajouter un formateur</h2>
            </div>
            <div class="modal-body">
                <form onsubmit="saveFormateurToEspace(event, '${espaceId}')">
                    <div class="form-group">
                        <label for="formateur_id">Sélectionner un formateur</label>
                        <select id="formateur_id" required>
                            <option value="">Choisir...</option>
                            ${currentData.formateurs.map(f => `
                                <option value="${f.id}">${f.nom_complet}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="viewEspace('${espaceId}')">Retour</button>
                        <button type="submit" class="btn btn-primary">Ajouter</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveFormateurToEspace(event, espaceId) {
    event.preventDefault();
    
    const formateurId = document.getElementById('formateur_id').value;
    
    try {
        const response = await fetch(`${API_BASE}/espaces/${espaceId}/formateur`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ formateur_id: formateurId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de l\'ajout');
        }
        
        showNotification('Formateur ajouté avec succès', 'success');
        await loadEspaces();
        viewEspace(espaceId);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function assignPromotion(espaceId) {
    if (currentData.promotions.length === 0) await loadPromotions();
    
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Ajouter une promotion</h2>
            </div>
            <div class="modal-body">
                <form onsubmit="savePromotionToEspace(event, '${espaceId}')">
                    <div class="form-group">
                        <label for="promotion_id">Sélectionner une promotion</label>
                        <select id="promotion_id" required>
                            <option value="">Choisir...</option>
                            ${currentData.promotions.map(p => `
                                <option value="${p.id}">${p.nom}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="viewEspace('${espaceId}')">Retour</button>
                        <button type="submit" class="btn btn-primary">Ajouter</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function savePromotionToEspace(event, espaceId) {
    event.preventDefault();
    
    const promotionId = document.getElementById('promotion_id').value;
    
    try {
        const response = await fetch(`${API_BASE}/espaces/${espaceId}/promotion`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ promotion_id: promotionId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de l\'ajout');
        }
        
        showNotification('Promotion ajoutée avec succès', 'success');
        await loadEspaces();
        viewEspace(espaceId);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}


async function deleteEspace(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet espace pédagogique ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/espaces/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Erreur lors de la suppression');
        
        showNotification('Espace supprimé avec succès', 'success');
        await loadEspaces();
        await loadDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function editEspace(id) {
    openEspaceModal(id);
}

async function loadDirecteurs() {
    try {
        const response = await fetch(`${API_BASE}/directeurs`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        currentData.directeurs = await response.json();
        renderDirecteurs(currentData.directeurs);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderDirecteurs(directeurs) {
    const tbody = document.getElementById('directeurs-list');
    
    if (directeurs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><p>Aucun directeur trouvé</p></td></tr>';
        return;
    }
    
    const currentUserId = getCurrentUser().user_id;
    
    tbody.innerHTML = directeurs.map(d => `
        <tr>
            <td>${d.nom_complet}</td>
            <td>${d.email}</td>
            <td class="actions-cell">
                ${d.id !== currentUserId ? `
                    <button class="btn btn-danger btn-icon" onclick="deleteDirecteur('${d.id}')" title="Supprimer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                ` : '<span class="badge badge-info">Vous</span>'}
            </td>
        </tr>
    `).join('');
}

function openDirecteurModal() {
    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Nouveau directeur</h2>
            </div>
            <div class="modal-body">
                <form id="directeur-form" onsubmit="saveDirecteur(event)">
                    <div class="form-group">
                        <label for="nom_complet">Nom complet *</label>
                        <input type="text" id="nom_complet" required placeholder="Jean Dupont">
                    </div>
                    <div class="form-group">
                        <label for="email">Email *</label>
                        <input type="email" id="email" required placeholder="jean.dupont@ecole.com">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">Créer</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveDirecteur(event) {
    event.preventDefault();
    
    const data = {
        nom_complet: document.getElementById('nom_complet').value,
        email: document.getElementById('email').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/directeurs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la création');
        }
        
        const result = await response.json();
        showCredentialsModal(result.email, result.mot_de_passe_clair);
        
        await loadDirecteurs();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteDirecteur(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce directeur ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/directeurs/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la suppression');
        }
        
        showNotification('Directeur supprimé avec succès', 'success');
        await loadDirecteurs();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function filterTable(tableId, searchValue) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    const search = searchValue.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function showModal(content) {
    const modal = document.getElementById('modal');
    modal.innerHTML = content;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    modal.innerHTML = '';
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}
