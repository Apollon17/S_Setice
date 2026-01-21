let formateurData = {
    espaces: [],
    travaux: [],
    livraisons: []
};

function showFormateurSection(section) {
    console.log('=== SHOW FORMATEUR SECTION ===');
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
            loadFormateurEspaces();
            break;
        case 'travaux':
            loadFormateurTravaux();
            break;
        case 'evaluations':
            loadLivraisonsAEvaluer();
            break;
    }
}

async function loadFormateurEspaces() {
    try {
        const response = await fetch(`${API_BASE}/espaces`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        formateurData.espaces = await response.json();
        renderFormateurEspaces(formateurData.espaces);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderFormateurEspaces(espaces) {
    const container = document.getElementById('espaces-list');
    
    if (espaces.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun espace pédagogique assigné</p></div>';
        return;
    }
    
    container.innerHTML = espaces.map(e => `
        <div class="card">
            <h3 style="margin-bottom: 8px;">${e.nom_matiere}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">${e.code_matiere} - Coefficient ${e.coefficient}</p>
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <span class="badge badge-info">${e.etudiants?.length || 0} étudiants</span>
            </div>
            <button class="btn btn-primary" onclick="openTravailModal('${e.id}')">
                Créer un travail
            </button>
        </div>
    `).join('');
}

async function loadFormateurTravaux() {
    try {
        const travauxPromises = formateurData.espaces.map(async (espace) => {
            const response = await fetch(`${API_BASE}/travaux/espace/${espace.id}`, { headers: getAuthHeaders() });
            if (response.ok) {
                return await response.json();
            }
            return [];
        });
        
        const travauxArrays = await Promise.all(travauxPromises);
        formateurData.travaux = travauxArrays.flat();
        
        renderFormateurTravaux(formateurData.travaux);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderFormateurTravaux(travaux) {
    const tbody = document.getElementById('travaux-list');
    
    if (travaux.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Aucun travail créé</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = travaux.map(t => `
        <tr>
            <td>${t.titre}</td>
            <td>${t.espace_nom || '-'}</td>
            <td><span class="badge badge-info">${t.type_travail}</span></td>
            <td>${new Date(t.date_fin).toLocaleDateString('fr-FR')}</td>
            <td>${getStatutBadge(t.statut)}</td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-icon" onclick="viewTravail('${t.id}')" title="Voir détails">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="btn btn-danger btn-icon" onclick="deleteTravail('${t.id}')" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function getStatutBadge(statut) {
    const badges = {
        'en_attente': '<span class="badge badge-warning">En attente</span>',
        'livre': '<span class="badge badge-info">Livré</span>',
        'evalue': '<span class="badge badge-success">Évalué</span>'
    };
    return badges[statut] || '<span class="badge badge-secondary">' + statut + '</span>';
}

async function openTravailModal(espaceId = null) {
    if (formateurData.espaces.length === 0) {
        await loadFormateurEspaces();
    }
    
    const selectedEspace = espaceId ? formateurData.espaces.find(e => e.id === espaceId) : null;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Créer un travail</h2>
            </div>
            <div class="modal-body">
                <form id="travail-form" onsubmit="saveTravail(event)">
                    <div class="form-group">
                        <label for="titre">Titre du travail *</label>
                        <input type="text" id="titre" required placeholder="Devoir Chapitre 3">
                    </div>
                    
                    <div class="form-group">
                        <label for="espace_id">Espace pédagogique *</label>
                        <select id="espace_id" required onchange="loadEtudiantsForTravail(this.value)">
                            <option value="">Sélectionner un espace</option>
                            ${formateurData.espaces.map(e => `
                                <option value="${e.id}" ${espaceId === e.id ? 'selected' : ''}>
                                    ${e.nom_matiere} (${e.code_matiere})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Type de travail *</label>
                        <div class="radio-group">
                            <div class="radio-item">
                                <input type="radio" id="type_individuel" name="type_travail" value="individuel" checked onchange="updateEtudiantSelection()">
                                <label for="type_individuel" class="radio-label">Individuel</label>
                            </div>
                            <div class="radio-item">
                                <input type="radio" id="type_collectif" name="type_travail" value="collectif" onchange="updateEtudiantSelection()">
                                <label for="type_collectif" class="radio-label">Collectif</label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" id="etudiants-container" style="display: none;">
                        <label>Étudiants assignés *</label>
                        <div id="etudiants-selection"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="consignes">Consignes *</label>
                        <textarea id="consignes" required rows="4" placeholder="Décrivez les consignes du travail..."></textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="date_debut">Date de début *</label>
                            <input type="datetime-local" id="date_debut" required>
                        </div>
                        <div class="form-group">
                            <label for="date_fin">Date de fin *</label>
                            <input type="datetime-local" id="date_fin" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Fichiers joints</label>
                        <div class="upload-zone" id="upload-drop-zone" onclick="document.getElementById('file-input').click()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p>Cliquez pour sélectionner des fichiers</p>
                            <input type="file" id="file-input" multiple hidden onchange="handleFileSelection(event)">
                        </div>
                        <div class="uploaded-files" id="uploaded-files"></div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">Créer le travail</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
    
    if (espaceId) {
        loadEtudiantsForTravail(espaceId);
    }
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    document.getElementById('date_debut').value = tomorrow.toISOString().slice(0, 16);
    document.getElementById('date_fin').value = nextWeek.toISOString().slice(0, 16);
}

let uploadedFileUrls = [];

async function handleFileSelection(event) {
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
            uploadedFileUrls.push(result.url);
            
            uploadedFilesDiv.innerHTML += `
                <div class="uploaded-file">
                    <span class="file-icon">📎</span>
                    <span class="file-name">${file.name}</span>
                    <button type="button" class="btn-icon btn-danger" onclick="removeUploadedFile('${result.url}', this.parentElement)">×</button>
                </div>
            `;
        } catch (error) {
            showNotification(`Erreur upload ${file.name}`, 'error');
        }
    }
}

function removeUploadedFile(url, element) {
    uploadedFileUrls = uploadedFileUrls.filter(u => u !== url);
    element.remove();
}

async function loadEtudiantsForTravail(espaceId) {
    const espace = formateurData.espaces.find(e => e.id === espaceId);
    if (!espace || !espace.etudiants) return;
    
    const container = document.getElementById('etudiants-container');
    const selection = document.getElementById('etudiants-selection');
    
    container.style.display = 'block';
    
    const typeIndividuel = document.getElementById('type_individuel').checked;
    
    if (typeIndividuel) {
        selection.innerHTML = `
            <select id="etudiant_individuel" required>
                <option value="">Sélectionner un étudiant</option>
                ${espace.etudiants.map(e => `
                    <option value="${e.id}">${e.nom_complet}</option>
                `).join('')}
            </select>
        `;
    } else {
        selection.innerHTML = `
            <div class="checkbox-group">
                ${espace.etudiants.map(e => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="etudiant_${e.id}" value="${e.id}">
                        <label for="etudiant_${e.id}">${e.nom_complet}</label>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function updateEtudiantSelection() {
    const espaceId = document.getElementById('espace_id').value;
    if (espaceId) {
        loadEtudiantsForTravail(espaceId);
    }
}

async function saveTravail(event) {
    event.preventDefault();
    
    const espaceId = document.getElementById('espace_id').value;
    const typeIndividuel = document.getElementById('type_individuel').checked;
    
    let etudiantsAssignes = [];
    if (typeIndividuel) {
        const etudiantId = document.getElementById('etudiant_individuel').value;
        if (!etudiantId) {
            showNotification('Veuillez sélectionner un étudiant', 'error');
            return;
        }
        etudiantsAssignes = [etudiantId];
    } else {
        const checkboxes = document.querySelectorAll('#etudiants-selection input[type="checkbox"]:checked');
        etudiantsAssignes = Array.from(checkboxes).map(cb => cb.value);
        
        if (etudiantsAssignes.length < 2) {
            showNotification('Un travail collectif nécessite au moins 2 étudiants', 'error');
            return;
        }
    }
    
    const data = {
        titre: document.getElementById('titre').value,
        consignes: document.getElementById('consignes').value,
        type_travail: typeIndividuel ? 'individuel' : 'collectif',
        espace_id: espaceId,
        date_debut: new Date(document.getElementById('date_debut').value).toISOString(),
        date_fin: new Date(document.getElementById('date_fin').value).toISOString(),
        fichiers_urls: uploadedFileUrls,
        liens: [],
        etudiants_assignes: etudiantsAssignes
    };
    
    try {
        const response = await fetch(`${API_BASE}/travaux`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de la création');
        }
        
        uploadedFileUrls = [];
        closeModal();
        showNotification('Travail créé avec succès', 'success');
        await loadFormateurTravaux();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function viewTravail(id) {
    const travail = formateurData.travaux.find(t => t.id === id);
    if (!travail) return;
    
    const response = await fetch(`${API_BASE}/travaux/${id}/livraisons`, { headers: getAuthHeaders() });
    const livraisons = response.ok ? await response.json() : [];
    
    const modalContent = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>${travail.titre}</h2>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 8px;"><strong>Espace:</strong> ${travail.espace_nom}</p>
                    <p style="margin-bottom: 8px;"><strong>Type:</strong> ${travail.type_travail}</p>
                    <p style="margin-bottom: 8px;"><strong>Période:</strong> ${new Date(travail.date_debut).toLocaleDateString('fr-FR')} - ${new Date(travail.date_fin).toLocaleDateString('fr-FR')}</p>
                    <p style="margin-bottom: 8px;"><strong>Statut:</strong> ${getStatutBadge(travail.statut)}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Consignes</h3>
                    <p style="background: var(--background); padding: 12px; border-radius: 8px;">${travail.consignes}</p>
                </div>
                
                ${travail.fichiers_urls?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px;">Fichiers joints</h3>
                        ${travail.fichiers_urls.map(url => `
                            <a href="${url}" target="_blank" class="btn btn-secondary" style="margin-right: 8px; margin-bottom: 8px;">
                                📎 Télécharger
                            </a>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div>
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Étudiants assignés (${travail.etudiants_assignes?.length || 0})</h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                        ${travail.etudiants_assignes?.map(e => `<span class="badge badge-info">${e.nom_complet}</span>`).join('') || ''}
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px;">Livraisons (${livraisons.length}/${travail.etudiants_assignes?.length || 0})</h3>
                    ${livraisons.length > 0 ? `
                        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                            ${livraisons.map(l => `
                                <div style="padding: 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                    <span>${l.etudiant_nom}</span>
                                    <span style="font-size: 12px; color: var(--text-secondary);">${new Date(l.date_soumission).toLocaleString('fr-FR')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">Aucune livraison</p>'}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function deleteTravail(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce travail ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/travaux/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Erreur lors de la suppression');
        
        showNotification('Travail supprimé avec succès', 'success');
        await loadFormateurTravaux();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadLivraisonsAEvaluer() {
    try {
        const travauxLivres = formateurData.travaux.filter(t => t.statut === 'livre');
        
        const livraisonsPromises = travauxLivres.map(async (travail) => {
            const response = await fetch(`${API_BASE}/travaux/${travail.id}/livraisons`, { headers: getAuthHeaders() });
            if (response.ok) {
                const livraisons = await response.json();
                return livraisons.map(l => ({ ...l, travail_titre: travail.titre }));
            }
            return [];
        });
        
        const livraisonsArrays = await Promise.all(livraisonsPromises);
        formateurData.livraisons = livraisonsArrays.flat();
        
        renderLivraisons(formateurData.livraisons);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function renderLivraisons(livraisons) {
    const tbody = document.getElementById('livraisons-list');
    
    if (livraisons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><p>Aucune livraison à évaluer</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = livraisons.map(l => `
        <tr>
            <td>${l.travail_titre || '-'}</td>
            <td>${l.etudiant_nom || '-'}</td>
            <td>${new Date(l.date_soumission).toLocaleString('fr-FR')}</td>
            <td class="actions-cell">
                <button class="btn btn-primary" onclick="openEvaluationModal('${l.id}')">
                    Évaluer
                </button>
            </td>
        </tr>
    `).join('');
}

async function openEvaluationModal(livraisonId) {
    const livraison = formateurData.livraisons.find(l => l.id === livraisonId);
    if (!livraison) return;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Évaluer ${livraison.etudiant_nom}</h2>
            </div>
            <div class="modal-body">
                <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin-bottom: 8px;"><strong>Travail:</strong> ${livraison.travail_titre}</p>
                    <p><strong>Date de soumission:</strong> ${new Date(livraison.date_soumission).toLocaleString('fr-FR')}</p>
                </div>
                
                ${livraison.contenu ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px;">Réponse de l'étudiant</h3>
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
                
                <form id="evaluation-form" onsubmit="saveEvaluation(event, '${livraisonId}')">
                    <div class="form-group">
                        <label for="note">Note sur 20 *</label>
                        <input type="number" id="note" required min="0" max="20" step="0.5" placeholder="15.5">
                    </div>
                    
                    <div class="form-group">
                        <label for="commentaire">Commentaire</label>
                        <textarea id="commentaire" rows="4" placeholder="Observations et remarques..."></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">Valider l'évaluation</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    showModal(modalContent);
}

async function saveEvaluation(event, livraisonId) {
    event.preventDefault();
    
    const data = {
        livraison_id: livraisonId,
        note: parseFloat(document.getElementById('note').value),
        commentaire: document.getElementById('commentaire').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/evaluations`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur lors de l\'évaluation');
        }
        
        closeModal();
        showNotification('Évaluation enregistrée avec succès', 'success');
        await loadLivraisonsAEvaluer();
        await loadFormateurTravaux();
    } catch (error) {
        showNotification(error.message, 'error');
    }
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
    uploadedFileUrls = [];
}

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}
