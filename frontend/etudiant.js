let etudiantData = {
    espaces: [],
    travaux: [],
    notes: null
};

function showEtudiantSection(section) {
    console.log('=== SHOW ETUDIANT SECTION ===');
    console.log('Section:', section);
    
    document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
    const targetSection = document.getElementById(`section-${section}`);
    
    if (!targetSection) {
        console.error('Section not found:', `section-${section}`);
        alert('ERREUR: Section ' + section + ' introuvable!');
        return;
    }
    
    targetSection.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`[data-section="${section}"]`).forEach(el => el.classList.add('active'));
    
    switch(section) {
        case 'espaces':
            loadEtudiantEspaces();
            break;
        case 'travaux':
            loadEtudiantTravaux();
            break;
        case 'notes':
            loadEtudiantNotes();
            break;
    }
}

async function loadEtudiantEspaces() {
    try {
        const response = await fetch(`${API_BASE}/espaces`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        etudiantData.espaces = await response.json();
        renderEtudiantEspaces(etudiantData.espaces);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderEtudiantEspaces(espaces) {
    const container = document.getElementById('espaces-list');
    
    if (espaces.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun espace pédagogique</p></div>';
        return;
    }
    
    container.innerHTML = espaces.map(e => `
        <div class="card">
            <h3 style="margin-bottom: 8px;">${e.nom_matiere}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">${e.code_matiere} - Coefficient ${e.coefficient}</p>
            ${e.description ? `<p style="font-size: 14px; margin-bottom: 16px;">${e.description}</p>` : ''}
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${e.formateurs?.map(f => `<span class="badge badge-info">${f.nom_complet}</span>`).join('') || ''}
            </div>
        </div>
    `).join('');
}

async function loadEtudiantTravaux() {
    try {
        const user = getCurrentUser();
        const response = await fetch(`${API_BASE}/travaux/etudiant/${user.user_id}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        etudiantData.travaux = await response.json();
        
        const travauxAvecLivraisons = await Promise.all(
            etudiantData.travaux.map(async (travail) => {
                const livraisonsResp = await fetch(`${API_BASE}/travaux/${travail.id}/livraisons`, { headers: getAuthHeaders() });
                if (livraisonsResp.ok) {
                    const livraisons = await livraisonsResp.json();
                    const maLivraison = livraisons.find(l => l.etudiant_id === user.user_id);
                    return { ...travail, ma_livraison: maLivraison };
                }
                return travail;
            })
        );
        
        etudiantData.travaux = travauxAvecLivraisons;
        renderEtudiantTravaux(etudiantData.travaux);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderEtudiantTravaux(travaux) {
    const tbody = document.getElementById('travaux-list');
    
    if (travaux.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Aucun travail assigné</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = travaux.map(t => {
        const dateLimite = new Date(t.date_fin);
        const maintenant = new Date();
        const depassee = dateLimite < maintenant && !t.ma_livraison;
        
        return `
            <tr>
                <td>${t.titre}</td>
                <td>${t.espace_nom || '-'}</td>
                <td><span class="badge badge-info">${t.type_travail}</span></td>
                <td ${depassee ? 'style="color: var(--danger);"' : ''}>
                    ${dateLimite.toLocaleDateString('fr-FR')}
                    ${depassee ? ' ⚠️' : ''}
                </td>
                <td>${getTravailStatut(t)}</td>
                <td class="actions-cell">
                    ${!t.ma_livraison ? `
                        <button class="btn btn-primary" onclick="openSoumissionModal('${t.id}')">
                            Soumettre
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="viewMaLivraison('${t.id}')">
                            Voir ma soumission
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function getTravailStatut(travail) {
    if (travail.ma_livraison) {
        if (travail.statut === 'evalue') {
            return '<span class="badge badge-success">Évalué</span>';
        }
        return '<span class="badge badge-info">Soumis</span>';
    }
    const dateLimite = new Date(travail.date_fin);
    if (dateLimite < new Date()) {
        return '<span class="badge badge-danger">Dépassé</span>';
    }
    return '<span class="badge badge-warning">À faire</span>';
}

async function openSoumissionModal(travailId) {
    const travail = etudiantData.travaux.find(t => t.id === travailId);
    if (!travail) return;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Soumettre : ${travail.titre}</h2>
            </div>
            <div class="modal-body">
                <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin-bottom: 8px;"><strong>Espace:</strong> ${travail.espace_nom}</p>
                    <p style="margin-bottom: 8px;"><strong>Formateur:</strong> ${travail.formateur_nom}</p>
                    <p style="margin-bottom: 8px;"><strong>Date limite:</strong> ${new Date(travail.date_fin).toLocaleString('fr-FR')}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Consignes</h3>
                    <div style="background: white; padding: 12px; border: 1px solid var(--border); border-radius: 8px; white-space: pre-wrap;">
                        ${travail.consignes}
                    </div>
                </div>
                
                ${travail.fichiers_urls?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px;">Documents du formateur</h3>
                        ${travail.fichiers_urls.map(url => `
                            <a href="${url}" target="_blank" class="btn btn-secondary" style="margin-right: 8px; margin-bottom: 8px;">
                                📎 Télécharger
                            </a>
                        `).join('')}
                    </div>
                ` : ''}
                
                <form id="soumission-form" onsubmit="submitLivraison(event, '${travailId}')">
                    <div class="form-group">
                        <label for="contenu">Votre réponse</label>
                        <textarea id="contenu" rows="6" placeholder="Écrivez votre réponse ici..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Fichiers à joindre</label>
                        <div class="upload-zone" id="upload-drop-zone" onclick="document.getElementById('file-input').click()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p>Cliquez pour sélectionner des fichiers</p>
                            <input type="file" id="file-input" multiple hidden onchange="handleFilesEtudiant(event)">
                        </div>
                        <div class="uploaded-files" id="uploaded-files"></div>
                    </div>
                    
                    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                        <strong>⚠️ Attention :</strong> Une fois soumis, vous ne pourrez plus modifier votre travail.
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">Soumettre le travail</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

let uploadedFilesEtudiant = [];

async function handleFilesEtudiant(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const uploadedFilesDiv = document.getElementById('uploaded-files');
    
    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            
            if (!response.ok) throw new Error('Erreur upload');
            
            const result = await response.json();
            uploadedFilesEtudiant.push(result.url);
            
            uploadedFilesDiv.innerHTML += `
                <div class="uploaded-file">
                    <span class="file-icon">📎</span>
                    <span class="file-name">${file.name}</span>
                    <button type="button" class="btn-icon btn-danger" onclick="removeFileEtudiant('${result.url}', this.parentElement)">×</button>
                </div>
            `;
        } catch (error) {
            console.error(error); // Ajout pour debug
            showNotification(`Erreur upload ${file.name}`, 'error');
        }
    }
    
    event.target.value = '';
}

function removeFileEtudiant(url, element) {
    uploadedFilesEtudiant = uploadedFilesEtudiant.filter(u => u !== url);
    element.remove();
}

async function submitLivraison(event, travailId) {
    event.preventDefault();
    
    const contenu = document.getElementById('contenu').value;
    
    if (!contenu && uploadedFilesEtudiant.length === 0) {
        showNotification('Veuillez fournir une réponse ou joindre des fichiers', 'error');
        return;
    }
    
    if (!confirm('Êtes-vous sûr de vouloir soumettre ce travail ? Vous ne pourrez plus le modifier.')) {
        return;
    }
    
    const data = {
        contenu: contenu || null,
        fichiers_urls: uploadedFilesEtudiant,
        liens: []
    };
    
    try {
        const response = await fetch(`${API_BASE}/travaux/${travailId}/livraisons`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la soumission');
        }
        
        uploadedFilesEtudiant = [];
        closeModal();
        showNotification('Travail soumis avec succès', 'success');
        await loadEtudiantTravaux();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function viewMaLivraison(travailId) {
    const travail = etudiantData.travaux.find(t => t.id === travailId);
    if (!travail || !travail.ma_livraison) return;
    
    const livraison = travail.ma_livraison;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Ma soumission : ${travail.titre}</h2>
            </div>
            <div class="modal-body">
                <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin-bottom: 8px;"><strong>Date de soumission:</strong> ${new Date(livraison.date_soumission).toLocaleString('fr-FR')}</p>
                    <p><strong>Statut:</strong> ${getTravailStatut(travail)}</p>
                </div>
                
                ${livraison.contenu ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px;">Ma réponse</h3>
                        <div style="background: white; padding: 12px; border: 1px solid var(--border); border-radius: 8px; white-space: pre-wrap;">
                            ${livraison.contenu}
                        </div>
                    </div>
                ` : ''}
                
                ${livraison.fichiers_urls?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px;">Fichiers joints</h3>
                        ${livraison.fichiers_urls.map(url => `
                            <a href="${url}" target="_blank" class="btn btn-secondary" style="margin-right: 8px; margin-bottom: 8px;">
                                📎 Télécharger
                            </a>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${travail.statut === 'evalue' ? `
                    <div style="background: #f0fdf4; border: 1px solid var(--success); padding: 16px; border-radius: 8px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--success);">✓ Travail évalué</h3>
                        <p style="color: var(--text-secondary);">Consultez la section "Mes notes" pour voir votre évaluation détaillée.</p>
                    </div>
                ` : `
                    <div style="background: #e0f2fe; border: 1px solid var(--primary); padding: 16px; border-radius: 8px;">
                        <p style="color: var(--text-primary);">⏳ En attente d'évaluation par le formateur</p>
                    </div>
                `}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function loadEtudiantNotes() {
    try {
        const user = getCurrentUser();
        const response = await fetch(`${API_BASE}/notes/etudiant/${user.user_id}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        etudiantData.notes = await response.json();
        renderEtudiantNotes(etudiantData.notes);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderEtudiantNotes(notes) {
    const container = document.getElementById('notes-container');
    
    if (!notes || notes.notes_par_matiere.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucune note disponible</p></div>';
        return;
    }
    
    const moyenneColor = notes.moyenne_generale >= 10 ? 'var(--success)' : 'var(--danger)';
    
    container.innerHTML = `
        <div class="card" style="background: linear-gradient(135deg, ${notes.moyenne_generale >= 10 ? '#10b981' : '#ef4444'} 0%, ${notes.moyenne_generale >= 10 ? '#059669' : '#dc2626'} 100%); color: white; margin-bottom: 24px;">
            <div style="text-align: center;">
                <h2 style="font-size: 48px; font-weight: 700; margin-bottom: 8px; color: white;">
                    ${notes.moyenne_generale.toFixed(2)} / 20
                </h2>
                <p style="font-size: 18px; opacity: 0.9;">Moyenne générale</p>
            </div>
        </div>
        
        <div class="stats-grid">
            ${notes.notes_par_matiere.map(matiere => {
                const color = matiere.moyenne >= 10 ? 'var(--success)' : 'var(--danger)';
                return `
                    <div class="card">
                        <h3 style="margin-bottom: 8px; font-size: 18px;">${matiere.matiere}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 16px;">Coefficient ${matiere.coefficient}</p>
                        <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px;">
                            <span style="font-size: 32px; font-weight: 700; color: ${color};">
                                ${matiere.moyenne.toFixed(2)}
                            </span>
                            <span style="color: var(--text-secondary);">/ 20</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary);">
                            ${matiere.notes.length} note${matiere.notes.length > 1 ? 's' : ''} : 
                            ${matiere.notes.map(n => n.toFixed(1)).join(', ')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
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
    uploadedFilesEtudiant = [];
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}
