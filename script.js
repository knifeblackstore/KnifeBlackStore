

// Firebase Configuration
// Firebase inicializado dinámicamente vía Cloudflare Worker
const db = firebase.database();
// Inicializar EmailJS solo si la librería está cargada en la página
if (typeof emailjs !== 'undefined') {
    emailjs.init("K_qKROCgi6sp8_Nws");
}

// Inyectar Script de ePayco
const epaycoScript = document.createElement('script');
epaycoScript.src = 'https://checkout.epayco.co/checkout.js';
document.head.appendChild(epaycoScript);

// Gamer Cursor Effect
const cursorGlow = document.createElement('div');
cursorGlow.id = 'cursor-glow';
cursorGlow.style.cssText = 'position:fixed; width:200px; height:200px; background:radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%); border-radius:50%; pointer-events:none; z-index:9999; transform:translate(-50%, -50%); transition:0.1s ease-out; opacity:0;';
document.body.appendChild(cursorGlow);

document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
    cursorGlow.style.opacity = '1';
});

document.addEventListener('mouseleave', () => cursorGlow.style.opacity = '0');

// Menú móvil
const menuToggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const allLinks = document.querySelectorAll('a[href^="#"]');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        menu.classList.toggle('active');
    });
}

allLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        if(menu) menu.classList.remove('active');
        
        const targetId = link.getAttribute('href').replace('#', '');
        if (!targetId) return; // Si es solo "#", no hacer nada
        
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
            // Si la sección está oculta, mostrarla
            if (window.getComputedStyle(targetSection).display === 'none') {
                targetSection.style.display = 'block';
                targetSection.classList.add('fade-in');
            }
            // Desplazamiento suave con un pequeño delay para asegurar que el display:block se procesó
            setTimeout(() => {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        }
    });
});

// Verificar si hay un hash al cargar la página
window.addEventListener('load', () => {
    if (window.location.hash) {
        const targetSection = document.getElementById(window.location.hash.replace('#', ''));
        if (targetSection && window.getComputedStyle(targetSection).display === 'none') {
            targetSection.style.display = 'block';
            targetSection.classList.add('fade-in');
            setTimeout(() => {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }
});

// --- SISTEMA DE AUTENTICACIÓN OFICIAL DE FIREBASE ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => { return firebase.auth().signInWithEmailAndPassword(email, password); })
            .then((userCredential) => {
                const user = userCredential.user;
                const name = user.displayName || email.split('@')[0];
                
                // Verificar si es master admin o admin en la DB
                if (email.toLowerCase() === 'knifeblackstore@gmail.com') {
                    localStorage.setItem('currentUser', JSON.stringify({ email: email, role: 'admin', name: name }));
                    alert('Inicio de sesión exitoso. Bienvenido, ' + name);
                    window.location.href = 'index.html';
                } else {
                    db.ref('usersDB/' + user.uid).once('value').then(snap => {
                        const dbUser = snap.val();
                        const role = (dbUser && dbUser.role === 'admin') ? 'admin' : 'user';
                        localStorage.setItem('currentUser', JSON.stringify({ email: email, role: role, name: name }));
                        alert('Inicio de sesión exitoso. Bienvenido, ' + name);
                        window.location.href = 'index.html';
                    }).catch(() => {
                        // Fallback a user si no hay datos
                        localStorage.setItem('currentUser', JSON.stringify({ email: email, role: 'user', name: name }));
                        alert('Inicio de sesión exitoso. Bienvenido, ' + name);
                        window.location.href = 'index.html';
                    });
                }
            })
            .catch((error) => {
                alert('Error al iniciar sesión. Verifica tus datos o crea una cuenta nueva.\n(' + error.message + ')');
            });
    });
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const regRoleEl = document.getElementById('regRole');
        
        let desiredRole = 'user';
        if (regRoleEl && regRoleEl.style.display !== 'none') {
            desiredRole = regRoleEl.value;
        }

        const currentUserLocal = JSON.parse(localStorage.getItem('currentUser'));
        const isCurrentAdmin = currentUserLocal && currentUserLocal.role === 'admin';

        if (desiredRole === 'admin') {
            if (!isCurrentAdmin) {
                alert("No tienes permiso para crear administradores.");
                return;
            }
            // Crear admin sin cerrar la sesión actual usando app secundaria
            if (!firebase.apps.find(app => app.name === 'Secondary')) {
                firebase.initializeApp(firebaseConfig, 'Secondary');
            }
            const secondaryApp = firebase.app('Secondary');
            secondaryApp.auth().createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const newUser = userCredential.user;
                    newUser.updateProfile({ displayName: name });
                    // Guardar rol en DB usando la sesión del Admin Master (App principal)
                    db.ref('usersDB/' + newUser.uid).set({
                        email: email,
                        role: 'admin',
                        name: name
                    }).then(() => {
                        secondaryApp.auth().signOut();
                        alert('¡Administrador ' + name + ' creado exitosamente!');
                        document.getElementById('registerForm').reset();
                    });
                })
                .catch((error) => {
                    alert('Error al crear administrador: ' + error.message);
                });
        } else {
            // Registro de usuario normal
            firebase.auth().createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    user.updateProfile({ displayName: name });
                    
                    db.ref('usersDB/' + user.uid).set({
                        email: email,
                        role: 'user',
                        name: name
                    }).then(() => {
                        localStorage.setItem('currentUser', JSON.stringify({ email: email, role: 'user', name: name }));
                        alert('¡Cuenta creada exitosamente! Bienvenido, ' + name);
                        window.location.href = 'index.html';
                    });
                })
                .catch((error) => {
                    alert('Error al crear cuenta: ' + error.message);
                });
        }
    });
}

const logoutUser = () => {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }).catch(() => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
};

const applyTheme = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.role === 'admin') {
        document.body.classList.add('admin-theme');
    } else {
        document.body.classList.remove('admin-theme');
    }
};
applyTheme();

const updateNav = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const loginLinks = document.querySelectorAll('a[href="login.html"], a[href="login.html#register"]');
    const menuDiv = document.querySelector('.links.menu');
    
    if (loginLinks.length > 0) {
        loginLinks.forEach(link => {
            if (link.id !== 'admin-link') {
                link.removeAttribute('style');
                link.classList.add('btn-login-nav');
            }
        });
    }

    if (user) {
        if (loginLinks.length > 0) {
            loginLinks.forEach(link => {
                if (link.id !== 'admin-link') {
                    link.innerHTML = 'Salir <span style="font-size:0.7em; opacity:0.8;">(' + user.role + ')</span>';
                    link.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)'; 
                    link.style.boxShadow = '0 4px 15px rgba(231, 76, 60, 0.4)';
                    link.href = '#';
                    link.onclick = (e) => {
                        e.preventDefault();
                        logoutUser();
                    };
                }
            });
        }

        if (user.role === 'admin') {
            if (menuDiv && !document.getElementById('admin-link')) {
                const adminLink = document.createElement('a');
                adminLink.id = 'admin-link';
                adminLink.href = 'login.html#register';
                adminLink.textContent = 'Crear Usuarios';
                adminLink.style.color = '#00f0ff';
                adminLink.style.fontWeight = 'bold';
                menuDiv.appendChild(adminLink);
            }
            const regRole = document.getElementById('regRole');
            if (regRole) {
                regRole.style.display = 'block';
                const regTitle = document.getElementById('register-title');
                if(regTitle) regTitle.textContent = 'Crear Cuenta (Admin Panel)';
                const redirectText = document.getElementById('login-redirect-text');
                if(redirectText) redirectText.style.display = 'none';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    initEditableContent();
    
    // Auto-redirect if already logged in and visiting login page (except for Admin creating users)
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (window.location.pathname.includes('login.html') && user && window.location.hash !== '#register') {
        window.location.href = 'index.html';
        return;
    }

    if (window.location.pathname.includes('login.html') && window.location.hash === '#register') {
        const loginForm = document.getElementById('form-login');
        const registerForm = document.getElementById('form-register');
        if (loginForm && registerForm) {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    }
});

// --- SISTEMA DE EDICIÓN EN VIVO (SOLO ADMIN) ---
const initEditableContent = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const authUser = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser : null;
    const isAdmin = (user && (user.role === 'admin' || (user.email && user.email.toLowerCase() === 'knifeblackstore@gmail.com'))) ||
                    (authUser && authUser.email && authUser.email.toLowerCase() === 'knifeblackstore@gmail.com');
    
    const editableElements = document.querySelectorAll('.editable-content');
    
    if (typeof db !== 'undefined') {
        db.ref('siteEdits').on('value', snap => {
            const savedEdits = snap.val() || {};
            editableElements.forEach(el => {
                if (savedEdits[el.id] !== undefined) {
                    el.innerText = savedEdits[el.id];
                }
                
                if (isAdmin) {
                    el.setAttribute('contenteditable', 'true');
                    el.style.borderBottom = '2px dashed #f39c12';
                    el.title = 'Clic para editar este texto (Admin)';
                    el.onblur = (e) => {
                        db.ref('siteEdits/' + e.target.id).set(e.target.innerText.trim()).then(() => {
                            const prevBg = e.target.style.backgroundColor;
                            e.target.style.backgroundColor = 'rgba(57, 255, 20, 0.25)';
                            setTimeout(() => e.target.style.backgroundColor = prevBg, 500);
                        });
                    };
                }
            });

            const adminBtn = document.getElementById('btn-admin-edit-nosotros');
            if (adminBtn) {
                adminBtn.style.display = isAdmin ? 'flex' : 'none';
            }
        });
    }
};

window.openAdminNosotrosModal = () => {
    const modal = document.getElementById('admin-nosotros-modal');
    if (!modal) return;
    
    if (typeof db !== 'undefined') {
        db.ref('siteEdits').once('value').then(snap => {
            const data = snap.val() || {};
            const setVal = (id, fallbackElId) => {
                const input = document.getElementById('edit-' + id);
                if (input) {
                    input.value = data[id] || document.getElementById(fallbackElId)?.innerText?.trim() || '';
                }
            };
            setVal('nosotros-inicio-title', 'nosotros-inicio-title');
            setVal('nosotros-inicio-text', 'nosotros-inicio-text');
            setVal('nosotros-evolucion-title', 'nosotros-evolucion-title');
            setVal('nosotros-evolucion-text', 'nosotros-evolucion-text');
            setVal('nosotros-quote', 'nosotros-quote');
            setVal('nosotros-futuro-title', 'nosotros-futuro-title');
            setVal('nosotros-futuro-text', 'nosotros-futuro-text');
            modal.style.display = 'flex';
        });
    } else {
        modal.style.display = 'flex';
    }
};

window.closeAdminNosotrosModal = () => {
    const modal = document.getElementById('admin-nosotros-modal');
    if (modal) modal.style.display = 'none';
};

window.saveAdminNosotros = () => {
    if (typeof db === 'undefined') return;
    const btn = document.getElementById('btn-save-nosotros');
    if (btn) btn.innerText = 'Guardando...';

    const updates = {
        'nosotros-inicio-title': document.getElementById('edit-nosotros-inicio-title')?.value?.trim() || '',
        'nosotros-inicio-text': document.getElementById('edit-nosotros-inicio-text')?.value?.trim() || '',
        'nosotros-evolucion-title': document.getElementById('edit-nosotros-evolucion-title')?.value?.trim() || '',
        'nosotros-evolucion-text': document.getElementById('edit-nosotros-evolucion-text')?.value?.trim() || '',
        'nosotros-quote': document.getElementById('edit-nosotros-quote')?.value?.trim() || '',
        'nosotros-futuro-title': document.getElementById('edit-nosotros-futuro-title')?.value?.trim() || '',
        'nosotros-futuro-text': document.getElementById('edit-nosotros-futuro-text')?.value?.trim() || ''
    };

    db.ref('siteEdits').update(updates).then(() => {
        if (btn) btn.innerText = '¡Guardado! ✅';
        setTimeout(() => {
            if (btn) btn.innerText = '💾 Guardar Cambios en Nosotros';
            window.closeAdminNosotrosModal();
        }, 1000);
    }).catch(err => {
        alert('Error al guardar: ' + err.message);
        if (btn) btn.innerText = '💾 Guardar Cambios en Nosotros';
    });
};

// --- SISTEMA DINÁMICO DE ARTÍCULOS ---
const initDynamicGrid = () => {
    const grids = document.querySelectorAll('.grid, .platform-grid, .product-grid');
    if (grids.length === 0) return;

    grids.forEach(grid => {
        let rawPage = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];
        if (!rawPage) rawPage = 'index.html';
        let pageWithHtml = rawPage.includes('.') ? rawPage : (rawPage + '.html');
        let pageWithoutHtml = rawPage.replace(/\.html$/, '');

        let keyWithHtml = ('gridHTML_' + pageWithHtml + '_' + grid.className).replace(/[\.\s\?=]/g, '_');
        let keyWithoutHtml = ('gridHTML_' + pageWithoutHtml + '_' + grid.className).replace(/[\.\s\?=]/g, '_');

        // Buscar primero la versión que tenga datos en Firebase
        Promise.all([
            db.ref('grids/' + keyWithHtml).once('value'),
            db.ref('grids/' + keyWithoutHtml).once('value')
        ]).then(([snap1, snap2]) => {
            let savedGrid = snap1.val() || snap2.val();
            let activeKey = snap1.val() ? keyWithHtml : (snap2.val() ? keyWithoutHtml : keyWithHtml);
            const safeKey = activeKey;

            if (savedGrid) {
                grid.innerHTML = savedGrid;
                // Limpiar elementos basura (stock-indicators sueltos, etc.)
                Array.from(grid.children).forEach(child => {
                    if (!child.classList.contains('product-card') &&
                        !child.classList.contains('platform-card') &&
                        !child.classList.contains('item')) {
                        child.remove();
                    }
                });
            }

            const user = JSON.parse(localStorage.getItem('currentUser'));

            // --- MODO ADMIN ---
            if (user && (user.role === 'admin' || user.email === 'knifeblackstore@gmail.com')) {

                // Aplicar controles a TODAS las tarjetas del grid
                Array.from(grid.children).forEach(item => {
                    const isCard = item.classList.contains('product-card') ||
                                   item.classList.contains('platform-card') ||
                                   item.classList.contains('item');
                    // Excluir links de navegación del grid de servicios en index
                    const isNavLink = item.tagName === 'A' && grid.id === 'servicios';
                    if (isCard) {
                        addAdminButtons(item, grid, activeKey, isNavLink);
                    }
                });

                // Botón Añadir nuevo elemento
                // Evitar duplicados
                const existingAddBtn = grid.parentNode.querySelector('.admin-add-btn');
                if (existingAddBtn) existingAddBtn.remove();

                const addBtn = document.createElement('button');
                addBtn.className = 'admin-add-btn';
                addBtn.textContent = '+ AÑADIR NUEVO ELEMENTO';
                addBtn.style.cssText = 'display:block; margin: 20px auto; padding: 12px 25px; background: linear-gradient(45deg,#2ecc71,#27ae60); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 15px rgba(46,204,113,0.4); transition: 0.3s; z-index:100;';

                addBtn.onclick = () => {
                    const isPlatformGrid = grid.classList.contains('platform-grid');
                    const isProductGrid  = grid.classList.contains('product-grid');

                    // Obtener la primera tarjeta real para clonar
                    const templateCard = Array.from(grid.children).find(c =>
                        c.classList.contains('product-card') ||
                        c.classList.contains('platform-card') ||
                        c.classList.contains('item')
                    );

                    let newCard;
                    if (templateCard) {
                        newCard = templateCard.cloneNode(true);
                        // Limpiar controles previos del clon
                        newCard.querySelectorAll('.admin-controls-wrapper, .stock-indicator, .tag-popular').forEach(el => el.remove());
                        newCard.removeAttribute('data-stock');
                    } else {
                        // Crear tarjeta desde cero si no hay ninguna
                        newCard = document.createElement('article');
                        newCard.className = isPlatformGrid ? 'platform-card' : 'product-card';
                        newCard.innerHTML = isPlatformGrid
                            ? `<div class="platform-icon">🎮</div><h2 class="platform-name">Nueva Plataforma</h2><p class="platform-desc">Descripción de la plataforma.</p><div class="platform-price">$0.00 <span>/ Mes</span></div><button onclick="addToCart(this)" class="add-screen-btn">Añadir pantalla</button>`
                            : `<div class="product-img-container platform-icon"><span>✨</span></div><h2 class="product-name platform-name">Nuevo Producto</h2><p class="product-desc platform-desc">Descripción del producto.</p><div class="product-price platform-price">$0.00</div><button onclick="addToCart(this)" class="buy-btn">Comprar ahora</button>`;
                    }

                    const timestamp = Date.now();

                    // Reiniciar textos del clon
                    if (isPlatformGrid) {
                        const name = newCard.querySelector('.platform-name, h2');
                        const desc = newCard.querySelector('.platform-desc, p');
                        const price = newCard.querySelector('.platform-price');
                        if (name) name.innerText = 'Nueva Plataforma';
                        if (desc) desc.innerText = 'Haz clic para editar descripción.';
                        if (price) price.innerHTML = '$0.00 <span>/ Mes</span>';
                        const icon = newCard.querySelector('.platform-icon');
                        if (icon) icon.innerText = '🎮';
                    } else if (isProductGrid) {
                        const typeChoice = prompt('Selecciona el tipo:\n1. Pin 📌\n2. Figura 👾\n3. Accesorio 💍\n4. Otro ✨', '1');
                        let emoji = '✨', title = 'Nuevo Producto';
                        if (typeChoice === '1') { emoji = '📌'; title = 'Pin Metálico'; }
                        else if (typeChoice === '2') { emoji = '👾'; title = 'Figura de Acción'; }
                        else if (typeChoice === '3') { emoji = '💍'; title = 'Accesorio'; }
                        const iconEl = newCard.querySelector('.platform-icon span, .product-img-container span');
                        if (iconEl) iconEl.innerText = emoji;
                        const name = newCard.querySelector('.product-name, .platform-name, h2');
                        const desc = newCard.querySelector('.product-desc, .platform-desc, p');
                        const price = newCard.querySelector('.product-price, .platform-price');
                        if (name) name.innerText = title;
                        if (desc) desc.innerText = 'Haz clic para editar descripción.';
                        if (price) price.innerText = '$0.00';
                    } else {
                        newCard.querySelectorAll('h2, h3, p').forEach(el => { el.innerText = 'Nueva Pestaña'; });
                        if (newCard.tagName === 'A') {
                            newCard.href = `categoria.html?id=cat_${timestamp}`;
                        }
                    }

                    // Asignar IDs únicos
                    newCard.querySelectorAll('[id]').forEach((el, i) => {
                        el.id = 'dynamic_' + timestamp + '_' + i;
                    });

                    addAdminButtons(newCard, grid, safeKey);
                    grid.appendChild(newCard);
                    saveGrid(grid, safeKey);
                    initEditableContent();
                    newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };

                // Insertar el botón DESPUÉS del grid
                grid.parentNode.insertBefore(addBtn, grid.nextSibling);

            } else {
                // NO ADMIN: quitar cualquier atributo editable y asegurar indicadores de stock
                grid.querySelectorAll('[contenteditable]').forEach(el => {
                    el.removeAttribute('contenteditable');
                    el.style.borderBottom = '';
                    el.style.cursor = '';
                    el.title = '';
                });
                Array.from(grid.children).forEach(item => {
                    if (item.classList.contains('product-card') || item.classList.contains('platform-card')) {
                        updateStockIndicator(item);
                    }
                });
            }
        });
    });

    // Función para RESETEAR la página a su estado original (borra la base de datos de esta página)
    window.resetGridToDefault = () => {
        if (confirm("⚠️ ¿Estás seguro? Esto borrará todos los productos agregados en ESTA página y volverá al diseño original del archivo HTML.")) {
            const grids = document.querySelectorAll('.grid, .platform-grid, .product-grid');
            grids.forEach(grid => {
                const pageKey = 'gridHTML_' + (window.location.pathname.split('/').pop() || 'index.html') + '_' + (grid.className);
                const safeKey = pageKey.replace(/\./g, '_').replace(/\s/g, '_');
                db.ref('grids/' + safeKey).remove().then(() => {
                    location.reload();
                });
            });
        }
    };

    window.saveGrid = (grid, safeKey) => {
        const clone = grid.cloneNode(true);
        
        // LIMPIEZA ABSOLUTA: Eliminar todo lo que NO sea contenido puro del producto
        clone.querySelectorAll('.admin-controls-wrapper, .stock-indicator, button:not(.buy-btn):not(.add-screen-btn):not(.gallery-nav-btn)').forEach(el => el.remove());
        
        // Quitar permisos de edición y estilos de administrador de TODOS los elementos
        clone.querySelectorAll('*').forEach(el => {
            el.removeAttribute('contenteditable');
            if (el.style.borderBottom.includes('dashed')) el.style.borderBottom = '';
            if (el.title.includes('clic')) el.title = '';
            if (el.style.cursor === 'pointer' && !el.classList.contains('buy-btn')) el.style.cursor = '';
        });

        db.ref('grids/' + safeKey).set(clone.innerHTML).then(() => {
            console.log('Grid saved successfully: ' + safeKey);
        });
    };
};

function addAdminButtons(item, grid, safeKey, isNavLink = false) {
    const existingWrapper = item.querySelector('.admin-controls-wrapper');
    if (existingWrapper) existingWrapper.remove();

    // Hacer elementos de texto editables (y ahora también los iconos/emojis)
    const textEls = item.querySelectorAll('h2, h3, p, .price, .platform-price, .product-price, .product-name, .platform-name, .platform-icon, .product-img-container span, .item > span:first-child');
    textEls.forEach(el => {
        el.contentEditable = true;
        el.style.borderBottom = '1px dashed var(--neon-cyan)';
        el.title = 'Haz clic para editar texto o emoji';
        el.onblur = () => saveGrid(grid, safeKey);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'admin-controls-wrapper';
    wrapper.style.cssText = 'position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 10; background:rgba(0,0,0,0.8); padding:10px; border-radius:8px; border:1px solid #333;';
    
    // Botón Imágenes (Soporte Multi-Imagen / Galería)
    const imgBtn = document.createElement('button');
    imgBtn.textContent = '📷 IMÁGENES';
    imgBtn.style.cssText = 'background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 5px 10px; font-size: 0.7rem; font-weight: bold;';
    imgBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.openProductGalleryManager) {
            window.openProductGalleryManager(item, grid, safeKey);
        } else {
            alert('El gestor de galería no está cargado.');
        }
    };

    // Gestión de Stock
    const stockDiv = document.createElement('div');
    stockDiv.style.cssText = 'display:flex; align-items:center; gap:5px; color:white; font-size:0.7rem; margin-top:5px;';
    
    let stockVal = item.getAttribute('data-stock') || "10";
    item.setAttribute('data-stock', stockVal);
    
    const stockLabel = document.createElement('span');
    stockLabel.textContent = 'Stock: ' + stockVal;
    
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.style.cssText = 'background:#2ecc71; color:white; border:none; padding:2px 5px; cursor:pointer;';
    plusBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let current = parseInt(item.getAttribute('data-stock'));
        item.setAttribute('data-stock', current + 1);
        stockLabel.textContent = 'Stock: ' + (current + 1);
        updateStockIndicator(item);
        saveGrid(grid, safeKey);
    };

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.style.cssText = 'background:#e74c3c; color:white; border:none; padding:2px 5px; cursor:pointer;';
    minusBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let current = parseInt(item.getAttribute('data-stock'));
        if(current > 0) {
            item.setAttribute('data-stock', current - 1);
            stockLabel.textContent = 'Stock: ' + (current - 1);
            updateStockIndicator(item);
            saveGrid(grid, safeKey);
        }
    };

    stockDiv.appendChild(minusBtn);
    stockDiv.appendChild(stockLabel);
    stockDiv.appendChild(plusBtn);

    // Botón Eliminar
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️ ELIMINAR';
    delBtn.style.cssText = 'background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 5px 10px; font-size: 0.7rem; font-weight: bold; margin-top:5px;';
    delBtn.onclick = (e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        if(confirm('¿Eliminar este elemento?')) { 
            item.remove(); 
            saveGrid(grid, safeKey); 
        } 
    };

    if (!isNavLink) {
        wrapper.appendChild(imgBtn);
        wrapper.appendChild(stockDiv);
    }

    wrapper.appendChild(delBtn);
    
    if(window.getComputedStyle(item).position === 'static') item.style.position = 'relative';
    item.appendChild(wrapper);
    
    // Solo mostrar stock si es un producto o plataforma real, no un link de navegación
    if (item.classList.contains('product-card') || item.classList.contains('platform-card')) {
        updateStockIndicator(item);
    }
}

function updateStockIndicator(item) {
    let indicator = item.querySelector('.stock-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'stock-indicator';
        indicator.style.cssText = 'font-size:0.8rem; margin-top:10px; font-weight:bold; width:100%;';
        const target = item.querySelector('.platform-price') || item.querySelector('.price') || item.querySelector('.product-price');
        if (target && target.parentNode === item) {
            target.after(indicator);
        } else {
            item.appendChild(indicator);
        }
    }
    const stock = parseInt(item.getAttribute('data-stock')) || 0;
    indicator.textContent = stock > 0 ? `Stock disponible: ${stock}` : '¡AGOTADO!';
    indicator.style.color = stock > 5 ? '#39ff14' : (stock > 0 ? '#ffae00' : '#ff007f');
}

document.addEventListener('DOMContentLoaded', () => {
    initDynamicGrid();
    initEditableContent();
    updateCartUI();
    // initInventoryPanel(); // Disabled in favor of pos.html
});

// --- SISTEMA DE CARRITO GAMER (DRAWER MODERNO + COMPATIBILIDAD) ---
let cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];

window.openDrawerCart = () => {
    const drawer = document.getElementById('drawer-cart');
    const overlay = document.getElementById('drawer-cart-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

window.closeDrawerCart = () => {
    const drawer = document.getElementById('drawer-cart');
    const overlay = document.getElementById('drawer-cart-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
};

window.toggleDrawerCart = () => {
    const drawer = document.getElementById('drawer-cart');
    if (drawer && drawer.classList.contains('open')) {
        window.closeDrawerCart();
    } else {
        window.openDrawerCart();
    }
};

window.toggleWhatsAppMenu = () => {
    const menu = document.getElementById('wa-multichannel-modal');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};

window.closeWhatsAppMenu = () => {
    const menu = document.getElementById('wa-multichannel-modal');
    if (menu) menu.style.display = 'none';
};

const updateCartUI = () => {
    cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];
    
    // 1. Actualizar badges de conteo en la barra de navegación y barra inferior
    const count = cart.length;
    document.querySelectorAll('.bottom-nav-cart-badge, .nav-cart-badge').forEach(badge => {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    });

    // 2. Actualizar Drawer Cart si está presente en el DOM
    const drawerItems = document.getElementById('drawer-cart-items');
    const drawerEmpty = document.getElementById('drawer-cart-empty');
    const drawerSubtotal = document.getElementById('drawer-subtotal');
    const drawerDiscountRow = document.getElementById('drawer-discount-row');
    const drawerDiscount = document.getElementById('drawer-discount');
    const drawerTotal = document.getElementById('drawer-total');
    const drawerCheckoutBtn = document.getElementById('drawer-checkout-btn');

    if (drawerItems) {
        if (count === 0) {
            drawerItems.innerHTML = '';
            if (drawerEmpty) drawerEmpty.style.display = 'block';
            if (drawerSubtotal) drawerSubtotal.innerText = '$0';
            if (drawerDiscountRow) drawerDiscountRow.style.display = 'none';
            if (drawerTotal) drawerTotal.innerText = '$0';
            if (drawerCheckoutBtn) {
                drawerCheckoutBtn.disabled = true;
                drawerCheckoutBtn.style.opacity = '0.5';
                drawerCheckoutBtn.style.cursor = 'not-allowed';
            }
        } else {
            if (drawerEmpty) drawerEmpty.style.display = 'none';
            if (drawerCheckoutBtn) {
                drawerCheckoutBtn.disabled = false;
                drawerCheckoutBtn.style.opacity = '1';
                drawerCheckoutBtn.style.cursor = 'pointer';
            }

            let subtotal = cart.reduce((sum, it) => sum + (it.price || 0), 0);
            let total = subtotal;
            let descAmount = 0;

            if (window.currentDiscount) {
                descAmount = window.currentDiscount.type === 'percentage' 
                    ? total * (window.currentDiscount.amount / 100) 
                    : window.currentDiscount.amount;
                if (descAmount > total) descAmount = total;
                total -= descAmount;
                if (drawerDiscountRow) drawerDiscountRow.style.display = 'flex';
                if (drawerDiscount) drawerDiscount.innerText = `-$${descAmount.toLocaleString()}`;
            } else {
                if (drawerDiscountRow) drawerDiscountRow.style.display = 'none';
            }

            if (drawerSubtotal) drawerSubtotal.innerText = `$${subtotal.toLocaleString()}`;
            if (drawerTotal) drawerTotal.innerText = `$${total.toLocaleString()}`;

            drawerItems.innerHTML = cart.map((it, idx) => `
                <div class="drawer-cart-item">
                    <div class="drawer-item-info">
                        <div class="drawer-item-name">${it.name}</div>
                        <div class="drawer-item-price">$${(it.price || 0).toLocaleString()}</div>
                    </div>
                    <button class="drawer-item-del" onclick="removeFromCart(${idx})" title="Eliminar del carrito">✕</button>
                </div>
            `).join('');
        }
    }
};
window.updateCartUI = updateCartUI;

window.addToCart = (btn) => {
    const card = btn.closest('.item, .platform-card, .product-card');
    if (card) {
        const name = card.querySelector('h3, .platform-name, .product-name').innerText;
        const priceText = card.querySelector('.price, .platform-price, .product-price').innerText;
        const price = parseFloat(priceText.replace(/[^0-9]/g, '')) || 0;
        
        cart.push({ name, price });
        localStorage.setItem('shoppingCart', JSON.stringify(cart));
        
        updateCartUI();
        window.openDrawerCart();
    }
};

window.addCatalogToCart = (name, price, id) => {
    cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];
    const numPrice = parseFloat(price) || 0;
    cart.push({ name: name || 'Producto', price: numPrice, id: id || '' });
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    updateCartUI();
    window.openDrawerCart();
};

window.removeFromCart = (i) => {
    cart.splice(i, 1);
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    updateCartUI();
};

window.clearCart = () => {
    if(confirm('¿Deseas vaciar el carrito?')) {
        cart = [];
        localStorage.removeItem('shoppingCart');
        window.currentDiscount = null;
        updateCartUI();
    }
};

// ============================================================================
// GENERADOR OFICIAL DE FACTURA PDF (KNIFEBLACK STORE - NIT: 1088288308-0)
// ============================================================================
window.generateInvoicePDF = function(data) {
    if (!window.jspdf) {
        alert("La librería de generación PDF está cargando. Por favor presiona de nuevo en 2 segundos.");
        return null;
    }
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;

    // 1. Top Decorative Bar
    doc.setFillColor(15, 15, 22);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(0, 240, 255);
    doc.rect(0, 5, pageWidth, 1.5, 'F');

    // 2. Company Brand & Info (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 15, 22);
    doc.text('KNIFEBLACK STORE', margin, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 110);
    doc.text('Pines Metálicos, Figuras de Acción, Accesorios y Streaming', margin, 23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 60);
    doc.text('NIT: ' + (data.ownerNit || '1088288308-0'), margin, 29);
    doc.text('Teléfono / WhatsApp: ' + (data.ownerPhone || '3108014660'), margin, 34);
    doc.text('Email: ' + (data.ownerEmail || 'knifeblackstore@gmail.com'), margin, 39);
    doc.text('Ciudad: ' + (data.ownerCity || 'Pereira - Risaralda, Colombia'), margin, 44);
    doc.text('Régimen: No Responsable de IVA (Art. 499 E.T.)', margin, 49);

    // 3. Invoice Metadata Box (Right)
    const boxX = 130;
    const boxY = 12;
    const boxW = 66;
    const boxH = 39;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFillColor(15, 15, 22);
    doc.roundedRect(boxX, boxY, boxW, 10, 3, 3, 'F');
    doc.rect(boxX, boxY + 7, boxW, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('FACTURA DE VENTA', boxX + boxW / 2, boxY + 7, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(255, 0, 127);
    doc.text(data.invoiceNumber || 'N° KBS-0001', boxX + boxW / 2, boxY + 17, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 70);
    doc.text('Fecha: ' + (data.date || new Date().toLocaleDateString('es-CO')), boxX + 4, boxY + 24);
    doc.text('Hora: ' + (data.time || new Date().toLocaleTimeString('es-CO')), boxX + 4, boxY + 29);
    doc.text('Pago: ' + (data.paymentMethod || 'Efectivo / Transferencia'), boxX + 4, boxY + 34);

    // 4. Client Info Box
    const clientY = 56;
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, clientY, pageWidth - (margin * 2), 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 15, 22);
    doc.text('DATOS DEL CLIENTE / ADQUIRENTE', margin + 4, clientY + 6);

    doc.setDrawColor(0, 240, 255);
    doc.setLineWidth(0.5);
    doc.line(margin + 4, clientY + 8, margin + 65, clientY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 60);

    const col1X = margin + 4;
    const col2X = margin + 100;

    doc.text('Cliente: ' + (data.customerName || 'Consumidor Final'), col1X, clientY + 14);
    doc.text('Cédula / NIT: ' + (data.customerDoc || 'Consumidor Final'), col1X, clientY + 20);

    doc.text('Teléfono / Cel: ' + (data.customerPhone || 'N/A'), col2X, clientY + 14);
    doc.text('Dirección: ' + (data.customerAddress || 'Pereira / Envío Nacional'), col2X, clientY + 20);

    // 5. Items Table
    let tableY = 88;
    const colW = { num: 12, desc: 95, qty: 18, unit: 28, total: 29 };

    doc.setFillColor(20, 20, 30);
    doc.rect(margin, tableY, pageWidth - (margin * 2), 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    doc.text('#', curX + 3, tableY + 5.5);
    curX += colW.num;
    doc.text('DESCRIPCIÓN DEL ARTÍCULO', curX + 2, tableY + 5.5);
    curX += colW.desc;
    doc.text('CANT.', curX + colW.qty / 2, tableY + 5.5, { align: 'center' });
    curX += colW.qty;
    doc.text('PRECIO UNIT.', curX + colW.unit - 2, tableY + 5.5, { align: 'right' });
    curX += colW.unit;
    doc.text('SUBTOTAL', curX + colW.total - 2, tableY + 5.5, { align: 'right' });

    tableY += 8;

    const items = data.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    items.forEach((it, idx) => {
        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 249, isEven ? 255 : 252);
        doc.rect(margin, tableY, pageWidth - (margin * 2), 7.5, 'F');

        doc.setDrawColor(235, 238, 242);
        doc.setLineWidth(0.2);
        doc.line(margin, tableY + 7.5, pageWidth - margin, tableY + 7.5);

        doc.setTextColor(60, 60, 70);
        curX = margin;
        doc.text(String(idx + 1), curX + 3, tableY + 5);
        curX += colW.num;

        const itemName = it.name ? (it.name.length > 55 ? it.name.substring(0, 52) + '...' : it.name) : 'Producto';
        doc.text(itemName, curX + 2, tableY + 5);
        curX += colW.desc;

        doc.text(String(it.qty || 1), curX + colW.qty / 2, tableY + 5, { align: 'center' });
        curX += colW.qty;

        const unitPrice = '$' + (it.price || 0).toLocaleString('es-CO');
        doc.text(unitPrice, curX + colW.unit - 2, tableY + 5, { align: 'right' });
        curX += colW.unit;

        const lineTotal = '$' + ((it.price || 0) * (it.qty || 1)).toLocaleString('es-CO');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 25);
        doc.text(lineTotal, curX + colW.total - 2, tableY + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        tableY += 7.5;
    });

    // 6. Totals Box
    tableY += 4;
    const totW = 85;
    const totX = pageWidth - margin - totW;
    const totY = tableY;

    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.4);
    doc.roundedRect(totX, totY, totW, 35, 2, 2, 'FD');

    const subtotal = data.subtotal || 0;
    const discount = data.discount || 0;
    const total = data.total || (subtotal - discount);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 80);
    doc.text('Subtotal:', totX + 6, totY + 7);
    doc.text('$' + subtotal.toLocaleString('es-CO'), totX + totW - 6, totY + 7, { align: 'right' });

    doc.text('Descuento:', totX + 6, totY + 13);
    doc.setTextColor(231, 76, 60);
    doc.text('-$' + discount.toLocaleString('es-CO'), totX + totW - 6, totY + 13, { align: 'right' });

    doc.setTextColor(70, 70, 80);
    doc.text('IVA (0% - Régimen Simplificado):', totX + 6, totY + 19);
    doc.text('$0', totX + totW - 6, totY + 19, { align: 'right' });

    doc.setFillColor(15, 15, 22);
    doc.roundedRect(totX + 2, totY + 23, totW - 4, 10, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 240, 255);
    doc.text('TOTAL A PAGAR:', totX + 6, totY + 29.5);
    doc.text('$' + total.toLocaleString('es-CO') + ' COP', totX + totW - 6, totY + 29.5, { align: 'right' });

    // Warranty & Conditions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 30);
    doc.text('CONDICIONES & GARANTÍA:', margin + 2, totY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 100);
    doc.text('• Cambios de mercancía dentro de los 5 días posteriores a la compra.', margin + 2, totY + 12);
    doc.text('• Conservar esta factura para hacer efectiva cualquier garantía.', margin + 2, totY + 16);
    doc.text('• Servicio al cliente y soporte: 3108014660', margin + 2, totY + 20);

    // 7. Footer
    const footerY = pageHeight - 12;
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 120);
    doc.text('Documento equivalente de venta expedido conforme a las normas del Estatuto Tributario para personas naturales', pageWidth / 2, footerY, { align: 'center' });
    doc.text('no obligadas a expedir factura electrónica. KnifeBlackStore • NIT: 1088288308-0 • Tel: 3108014660', pageWidth / 2, footerY + 4, { align: 'center' });

    doc.setFillColor(0, 240, 255);
    doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');

    return doc;
};

// ============================================================================
// MODAL DE CHECKOUT DEL CLIENTE CON VALIDACIÓN OBLIGATORIA
// ============================================================================
window.openCustomerCheckoutModal = function(preferredPaymentMethod) {
    if (!cart || cart.length === 0) {
        alert("Tu carrito está vacío. Agrega tus figuras, pines o pantallas de streaming antes de comprar.");
        return;
    }

    if (typeof window.closeDrawerCart === 'function') window.closeDrawerCart();

    let modal = document.getElementById('kbs-customer-checkout-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'kbs-customer-checkout-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:15px; box-sizing:border-box;';
        modal.innerHTML = `
            <div style="background:radial-gradient(130% 130% at 20% 10%, rgba(255,255,255,0.06) 0%, rgba(18,18,28,0.98) 70%, rgba(10,10,18,1) 100%); border:1px solid rgba(0,240,255,0.4); border-radius:24px; max-width:520px; width:100%; max-height:92vh; overflow-y:auto; padding:22px; box-shadow:0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(0,240,255,0.25); color:#fff; font-family:'Inter', sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,240,255,0.25); padding-bottom:12px; margin-bottom:16px;">
                    <div>
                        <h2 style="margin:0; font-size:1.25rem; font-weight:900; color:#fff; display:flex; align-items:center; gap:8px;">
                            🧾 Datos para tu Factura de Venta
                        </h2>
                        <p style="margin:4px 0 0; font-size:0.75rem; color:#888;">Emisión oficial KnifeBlackStore • NIT: 1088288308-0</p>
                    </div>
                    <button onclick="window.closeCustomerCheckoutModal()" style="background:transparent; border:none; color:#aaa; font-size:1.4rem; cursor:pointer; padding:4px 8px; border-radius:8px;" title="Cerrar">✕</button>
                </div>

                <div id="kbs-checkout-alert" style="display:none; background:rgba(255,0,127,0.15); border:1px solid #ff007f; color:#ff80bf; padding:10px 14px; border-radius:12px; font-size:0.8rem; margin-bottom:14px; font-weight:600;">
                    ⚠️ Por favor completa todos los campos obligatorios para emitir tu factura y procesar tu pedido.
                </div>

                <!-- Resumen Compacto -->
                <div style="background:rgba(255,255,255,0.04); border-radius:14px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#aaa; margin-bottom:6px;">
                        <span>Productos seleccionados:</span>
                        <span id="kbs-modal-items-count" style="color:#00f0ff; font-weight:700;">0</span>
                    </div>
                    <div id="kbs-modal-items-preview" style="max-height:80px; overflow-y:auto; font-size:0.78rem; color:#ddd; margin-bottom:8px; line-height:1.4;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                        <span style="font-weight:700; font-size:0.9rem;">TOTAL A PAGAR:</span>
                        <span id="kbs-modal-total-display" style="color:#00f0ff; font-weight:900; font-size:1.15rem;">$0 COP</span>
                    </div>
                </div>

                <!-- Formulario Obligatorio -->
                <form id="kbs-customer-form" onsubmit="window.submitCustomerOrder(event)" style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                            👤 Nombre Completo *
                        </label>
                        <input type="text" id="kbs-cust-name" required placeholder="Ej: Santiago Morales" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.85rem; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='#333'">
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                                📧 Correo Electrónico *
                            </label>
                            <input type="email" id="kbs-cust-email" required placeholder="tu@correo.com" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.85rem; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='#333'">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                                📱 WhatsApp / Celular *
                            </label>
                            <input type="tel" id="kbs-cust-phone" required placeholder="Ej: 3108014660" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.85rem; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='#333'">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                                🪪 Cédula o NIT *
                            </label>
                            <input type="text" id="kbs-cust-doc" required placeholder="Ej: 1088288308" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.85rem; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='#333'">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                                💳 Forma de Pago *
                            </label>
                            <select id="kbs-cust-payment" style="width:100%; box-sizing:border-box; background:rgba(20,20,30,0.95); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.82rem; outline:none;">
                                <option value="WhatsApp / Transferencia (Nequi / Daviplata)">WhatsApp / Transferencia (Nequi / Daviplata)</option>
                                <option value="Wompi (Nequi, Bancolombia, Tarjeta)">Wompi (Nequi, Bancolombia, Tarjeta)</option>
                                <option value="ePayco (PSE, Tarjetas)">ePayco (PSE, Tarjetas)</option>
                                <option value="Efectivo Contra Entrega (Pereira)">Efectivo Contra Entrega (Pereira)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#00f0ff; margin-bottom:4px;">
                            📍 Dirección de Entrega y Ciudad *
                        </label>
                        <input type="text" id="kbs-cust-address" required placeholder="Ej: Cra 7 # 20-30, Pereira - Risaralda" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; padding:10px 12px; border-radius:10px; font-size:0.85rem; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#00f0ff'" onblur="this.style.borderColor='#333'">
                    </div>

                    <div style="font-size:0.72rem; color:#888; margin-top:2px; line-height:1.4;">
                        🔒 Tus datos están protegidos. Al confirmar se generará y descargará tu factura oficial en PDF, se enviará copia a tu correo y se abrirá WhatsApp para coordinar tu entrega.
                    </div>

                    <div style="display:flex; gap:10px; margin-top:6px;">
                        <button type="button" onclick="window.closeCustomerCheckoutModal()" style="flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:12px; font-weight:700; cursor:pointer; font-size:0.85rem;">
                            Cancelar
                        </button>
                        <button type="submit" id="kbs-btn-submit-order" style="flex:2; background:linear-gradient(135deg, #00f0ff 0%, #ff007f 100%); color:#000; border:none; padding:12px; border-radius:12px; font-weight:900; cursor:pointer; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 0 20px rgba(0,240,255,0.4);">
                            🚀 Confirmar y Facturar
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Prefill data
    const user = JSON.parse(localStorage.getItem('currentUser')) || {};
    const lastCust = JSON.parse(localStorage.getItem('knifeblack_last_cust')) || {};

    const nameInput = document.getElementById('kbs-cust-name');
    const emailInput = document.getElementById('kbs-cust-email');
    const phoneInput = document.getElementById('kbs-cust-phone');
    const docInput = document.getElementById('kbs-cust-doc');
    const addressInput = document.getElementById('kbs-cust-address');
    const paymentSelect = document.getElementById('kbs-cust-payment');

    if (nameInput) nameInput.value = user.name || lastCust.name || '';
    if (emailInput) emailInput.value = user.email || lastCust.email || '';
    if (phoneInput) phoneInput.value = user.phone || lastCust.phone || '';
    if (docInput) docInput.value = user.doc || user.cedula || lastCust.doc || '';
    if (addressInput) addressInput.value = user.address || lastCust.address || '';
    if (paymentSelect && preferredPaymentMethod) {
        for (let i = 0; i < paymentSelect.options.length; i++) {
            if (paymentSelect.options[i].value.toLowerCase().includes(preferredPaymentMethod.toLowerCase())) {
                paymentSelect.selectedIndex = i;
                break;
            }
        }
    }

    // Calcular montos y resumen
    let subtotal = cart.reduce((sum, it) => sum + (it.price || 0), 0);
    let total = subtotal;
    let descAmount = 0;
    if (window.currentDiscount) {
        descAmount = window.currentDiscount.type === 'percentage' 
            ? total * (window.currentDiscount.amount / 100) 
            : window.currentDiscount.amount;
        if (descAmount > total) descAmount = total;
        total -= descAmount;
    }

    const itemsCountEl = document.getElementById('kbs-modal-items-count');
    const itemsPreviewEl = document.getElementById('kbs-modal-items-preview');
    const totalDisplayEl = document.getElementById('kbs-modal-total-display');

    if (itemsCountEl) itemsCountEl.innerText = cart.length + ' producto(s)';
    if (itemsPreviewEl) {
        itemsPreviewEl.innerHTML = cart.map((it, idx) => `<div>• <b>${it.name}</b> - $${(it.price || 0).toLocaleString('es-CO')}</div>`).join('');
    }
    if (totalDisplayEl) totalDisplayEl.innerText = '$' + total.toLocaleString('es-CO') + ' COP';

    const alertEl = document.getElementById('kbs-checkout-alert');
    if (alertEl) alertEl.style.display = 'none';

    modal.style.display = 'flex';
};

window.closeCustomerCheckoutModal = function() {
    const modal = document.getElementById('kbs-customer-checkout-modal');
    if (modal) modal.style.display = 'none';
};

// ============================================================================
// ENVÍO DE PEDIDO Y GENERACIÓN MULTICANAL (PDF + EMAIL + WHATSAPP)
// ============================================================================
window.lastGeneratedInvoice = null;

window.submitCustomerOrder = async function(event) {
    if (event && event.preventDefault) event.preventDefault();

    const nameInput = document.getElementById('kbs-cust-name');
    const emailInput = document.getElementById('kbs-cust-email');
    const phoneInput = document.getElementById('kbs-cust-phone');
    const docInput = document.getElementById('kbs-cust-doc');
    const addressInput = document.getElementById('kbs-cust-address');
    const paymentSelect = document.getElementById('kbs-cust-payment');
    const alertEl = document.getElementById('kbs-checkout-alert');
    const submitBtn = document.getElementById('kbs-btn-submit-order');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const doc = docInput ? docInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const paymentMethod = paymentSelect ? paymentSelect.value : 'WhatsApp / Transferencia';

    // Validación estricta
    let missing = [];
    if (!name) missing.push(nameInput);
    if (!email || !email.includes('@')) missing.push(emailInput);
    if (!phone) missing.push(phoneInput);
    if (!doc) missing.push(docInput);
    if (!address) missing.push(addressInput);

    if (missing.length > 0) {
        if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        missing.forEach(input => {
            if (input) {
                input.style.borderColor = '#ff007f';
                input.style.boxShadow = '0 0 10px rgba(255,0,127,0.4)';
            }
        });
        if (missing[0]) missing[0].focus();
        return false;
    }

    localStorage.setItem('knifeblack_last_cust', JSON.stringify({ name, email, phone, doc, address }));

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ Emitiendo Factura y Pedido...';
        submitBtn.style.opacity = '0.7';
    }

    try {
        let subtotal = cart.reduce((sum, it) => sum + (it.price || 0), 0);
        let total = subtotal;
        let descAmount = 0;
        if (window.currentDiscount) {
            descAmount = window.currentDiscount.type === 'percentage' 
                ? total * (window.currentDiscount.amount / 100) 
                : window.currentDiscount.amount;
            if (descAmount > total) descAmount = total;
            total -= descAmount;
        }

        // Obtener consecutivo
        let nextSeq = 1001;
        try {
            const snap = await db.ref('sales').limitToLast(1).once('value');
            const lastVal = snap.val();
            if (lastVal) {
                const lastKey = Object.keys(lastVal)[0];
                const lastSale = lastVal[lastKey];
                if (lastSale && lastSale.invoiceNumber && lastSale.invoiceNumber.startsWith('KBS-')) {
                    const parsed = parseInt(lastSale.invoiceNumber.replace('KBS-', ''), 10);
                    if (!isNaN(parsed)) nextSeq = parsed + 1;
                }
            }
        } catch (e) {
            console.warn('Consecutivo secuencial fallback:', e);
            nextSeq = Math.floor(1000 + (Date.now() % 9000));
        }

        const invoiceNumber = 'KBS-' + String(nextSeq).padStart(4, '0');
        const now = new Date();

        const saleData = {
            invoiceNumber: invoiceNumber,
            customer: name,
            customerDoc: doc,
            customerPhone: phone,
            customerAddress: address,
            email: email,
            paymentMethod: paymentMethod,
            items: cart.map(i => ({ name: i.name, price: i.price, qty: 1 })),
            subtotal: subtotal,
            discountApplied: window.currentDiscount ? window.currentDiscount.code : null,
            discountAmount: descAmount,
            total: total,
            date: now.toISOString(),
            status: 'Pendiente (Online)',
            source: 'Web Store'
        };

        // 1. Guardar en Firebase
        await db.ref('sales').push(saleData);

        if (window.currentDiscount) {
            try { db.ref('discountCodes/' + window.currentDiscount.code).remove(); } catch(e){}
        }

        // 2. Preparar Factura Oficial
        const invoiceObj = {
            invoiceNumber: invoiceNumber,
            date: now.toLocaleDateString('es-CO'),
            time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
            paymentMethod: paymentMethod,
            customerName: name,
            customerDoc: doc,
            customerPhone: phone,
            customerAddress: address,
            customerEmail: email,
            items: cart.map(i => ({ name: i.name, price: i.price, qty: 1 })),
            subtotal: subtotal,
            discount: descAmount,
            total: total,
            ownerNit: '1088288308-0',
            ownerPhone: '3108014660',
            ownerEmail: 'knifeblackstore@gmail.com',
            ownerCity: 'Pereira - Risaralda, Colombia'
        };
        window.lastGeneratedInvoice = invoiceObj;

        // 3. Descarga Automática de Factura en PDF
        try {
            const pdfDoc = window.generateInvoicePDF(invoiceObj);
            if (pdfDoc) {
                pdfDoc.save('Factura_' + invoiceNumber + '.pdf');
            }
        } catch (pdfErr) {
            console.warn('Error descargando PDF automático:', pdfErr);
        }

        // 4. Envío por Correo Electrónico (EmailJS)
        if (typeof emailjs !== 'undefined' && email) {
            try {
                let itemsList = cart.map((it, idx) => (idx + 1) + '. ' + it.name + ' - $' + (it.price || 0).toLocaleString('es-CO') + ' COP').join('\n');
                let emailBody = '¡Hola ' + name + '! Muchas gracias por tu compra en KnifeBlackStore.\n\n'
                    + '==========================================\n'
                    + 'FACTURA DE VENTA: ' + invoiceNumber + '\n'
                    + 'Fecha: ' + invoiceObj.date + ' ' + invoiceObj.time + '\n'
                    + 'Cliente: ' + name + ' (C.C./NIT: ' + doc + ')\n'
                    + 'Dirección: ' + address + '\n'
                    + 'Teléfono: ' + phone + '\n'
                    + '==========================================\n\n'
                    + 'PRODUCTOS:\n' + itemsList + '\n\n'
                    + 'Subtotal: $' + subtotal.toLocaleString('es-CO') + ' COP\n'
                    + (descAmount > 0 ? ('Descuento: -$' + descAmount.toLocaleString('es-CO') + ' COP\n') : '')
                    + 'TOTAL A PAGAR: $' + total.toLocaleString('es-CO') + ' COP\n'
                    + 'Forma de Pago: ' + paymentMethod + '\n\n'
                    + 'Emisor: KnifeBlackStore • NIT: 1088288308-0\n'
                    + 'Tel/WhatsApp: 3108014660 • Pereira - Risaralda\n'
                    + 'Tu factura oficial en PDF se ha generado y descargado en tu dispositivo.';

                emailjs.send("service_5hy8csv", "template_lirlr2z", {
                    to_name: name,
                    to_email: email,
                    message: emailBody,
                    from_name: "KnifeBlackStore"
                }).then(() => console.log('Factura enviada por email')).catch(e => console.warn('EmailJS aviso:', e));
            } catch (emailErr) {
                console.warn('EmailJS error:', emailErr);
            }
        }

        // 5. Preparar Mensaje Estructurado de WhatsApp
        let waMsg = "🚀 *NUEVO PEDIDO & FACTURA - KNIFEBLACKSTORE*\n\n";
        waMsg += "📄 *Factura N°:* " + invoiceNumber + "\n";
        waMsg += "👤 *Cliente:* " + name + "\n";
        waMsg += "🪪 *Cédula/NIT:* " + doc + "\n";
        waMsg += "📱 *WhatsApp:* " + phone + "\n";
        waMsg += "📍 *Dirección:* " + address + "\n";
        waMsg += "💳 *Método de Pago:* " + paymentMethod + "\n";
        waMsg += "------------------------------------------\n";
        waMsg += "*PRODUCTOS FACTURADOS:*\n";
        cart.forEach((it, idx) => {
            waMsg += (idx + 1) + ". *" + it.name + "* - $" + (it.price || 0).toLocaleString('es-CO') + "\n";
        });
        if (descAmount > 0) {
            waMsg += "\n🎟️ *Descuento:* -$" + descAmount.toLocaleString('es-CO') + "\n";
        }
        waMsg += "\n💰 *TOTAL FACTURADO: $" + total.toLocaleString('es-CO') + " COP*\n\n";
        waMsg += "NIT Emisor: 1088288308-0 | Tel: 3108014660 | Pereira - Risaralda\n";
        waMsg += "¡Hola! Acabo de realizar el pedido en la tienda virtual y tengo la factura generada. Quedo atento a la coordinación. ¡Gracias!";

        const encodedWA = encodeURIComponent(waMsg);

        // 6. Limpiar Carrito
        localStorage.removeItem('shoppingCart');
        cart = [];
        window.currentDiscount = null;
        updateCartUI();

        // Cerrar modal de checkout
        window.closeCustomerCheckoutModal();

        // 7. Mostrar Modal de Éxito
        window.showCustomerOrderSuccessModal(invoiceObj, encodedWA);

        // Abrir WhatsApp en pestaña nueva
        setTimeout(() => {
            window.open('https://wa.me/573108014660?text=' + encodedWA, '_blank');
        }, 600);

    } catch (err) {
        console.error('Error procesando pedido:', err);
        alert('Ocurrió un inconveniente al procesar: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '🚀 Confirmar y Facturar';
            submitBtn.style.opacity = '1';
        }
    }
};

// Modal de éxito al cliente
window.showCustomerOrderSuccessModal = function(invoiceObj, encodedWA) {
    let successModal = document.getElementById('kbs-order-success-modal');
    if (!successModal) {
        successModal = document.createElement('div');
        successModal.id = 'kbs-order-success-modal';
        successModal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:15px; box-sizing:border-box;';
        document.body.appendChild(successModal);
    }

    successModal.innerHTML = `
        <div style="background:radial-gradient(130% 130% at 20% 10%, rgba(255,255,255,0.08) 0%, rgba(18,18,28,0.98) 70%, rgba(8,8,14,1) 100%); border:1px solid #39ff14; border-radius:24px; max-width:480px; width:100%; padding:26px; box-shadow:0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(57,255,20,0.25); color:#fff; text-align:center; font-family:'Inter', sans-serif;">
            <div style="font-size:3rem; margin-bottom:10px;">🎉</div>
            <h2 style="margin:0 0 6px; color:#39ff14; font-size:1.4rem; font-weight:900;">¡Pedido y Factura Generados!</h2>
            <div style="display:inline-block; background:rgba(0,240,255,0.15); border:1px solid #00f0ff; color:#00f0ff; padding:4px 14px; border-radius:20px; font-weight:800; font-size:0.9rem; margin-bottom:14px;">
                Factura N° ${invoiceObj.invoiceNumber}
            </div>

            <p style="font-size:0.85rem; color:#bbb; line-height:1.5; margin:0 0 16px;">
                Muchas gracias, <b>${invoiceObj.customerName}</b>. Tu factura oficial ha sido descargada automáticamente en PDF y enviada a tu correo <b>${invoiceObj.customerEmail}</b>.
            </p>

            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                <button onclick="window.downloadLastInvoicePDF()" style="background:#00f0ff; color:#000; border:none; padding:12px; border-radius:12px; font-weight:900; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                    📄 Volver a Descargar Factura PDF
                </button>
                <a href="https://wa.me/573108014660?text=${encodedWA}" target="_blank" style="background:#25D366; color:#fff; text-decoration:none; padding:12px; border-radius:12px; font-weight:900; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                    💬 Abrir Chat de WhatsApp de la Tienda
                </a>
            </div>

            <button onclick="document.getElementById('kbs-order-success-modal').style.display='none'" style="background:transparent; border:1px solid #444; color:#888; padding:8px 16px; border-radius:10px; cursor:pointer; font-size:0.8rem;">
                Cerrar y Seguir Navegando
            </button>
        </div>
    `;
    successModal.style.display = 'flex';
};

window.downloadLastInvoicePDF = function() {
    if (window.lastGeneratedInvoice) {
        const doc = window.generateInvoicePDF(window.lastGeneratedInvoice);
        if (doc) doc.save('Factura_' + (window.lastGeneratedInvoice.invoiceNumber || 'Venta') + '.pdf');
    } else {
        alert("No se encontró factura reciente.");
    }
};

// Reemplazar llamados antiguos de checkout por el nuevo modal
window.checkoutCart = function() {
    window.openCustomerCheckoutModal('WhatsApp / Transferencia');
};

window.checkoutWompi = function() {
    window.openCustomerCheckoutModal('Wompi (Nequi, Bancolombia, Tarjeta)');
};


window.payWithEpayco = () => {
    if (cart.length === 0) return;
    
    const user = JSON.parse(localStorage.getItem('currentUser'));
    

    let subtotal = cart.reduce((sum, it) => sum + it.price, 0);
    let total = subtotal;
    let descAmount = 0;
    
    if (window.currentDiscount) {
        descAmount = window.currentDiscount.type === 'percentage' 
            ? total * (window.currentDiscount.amount / 100) 
            : window.currentDiscount.amount;
        if (descAmount > total) descAmount = total;
        total -= descAmount;
    }

    let description = cart.map(it => it.name).join(', ');

    // REGISTRAR INTENTO DE VENTA EN FIREBASE
    const saleData = {
        customer: user ? user.name : 'Cliente Invitado',
        email: user ? user.email : 'invitado@tienda',
        items: cart,
        total: total,
        subtotal: subtotal,
        discountApplied: window.currentDiscount ? window.currentDiscount.code : null,
        discountAmount: descAmount,
        date: new Date().toISOString(),
        status: 'Iniciada (ePayco)'
    };
    db.ref('sales').push(saleData);

    var handler = ePayco.checkout.configure({
        key: '491d6a0b6e9941f241d3171195133c61', // LLAVE DE PRUEBAS
        test: true
    });

    var data = {
        name: "Compra en Knifeblackstore",
        description: description,
        currency: "cop",
        amount: Math.round(total).toString(),
        tax_base: "0",
        tax: "0",
        country: "co",
        lang: "es",
        external: "false",
        extra1: user ? user.name : 'Cliente Invitado',
        extra2: user ? user.email : 'invitado@tienda',
        confirmation: "https://knifeblackstore-1791.web.app/confirmacion",
        response: "https://knifeblackstore-1791.web.app/respuesta",
        name_billing: user ? user.name : 'Cliente Invitado',
        address_billing: "Dirección del cliente",
        type_doc_billing: "cc",
        mobile_billing: "3000000000",
        number_doc_billing: "123456789"
    };

    handler.open(data);
};

// --- PANEL DE INVENTARIO MAESTRO (SOLO ADMIN) ---
const initInventoryPanel = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') return;

    // Crear botón de acceso al panel
    const invBtn = document.createElement('button');
    invBtn.id = 'admin-inv-btn';
    invBtn.innerHTML = '📦 Inventario';
    invBtn.style.cssText = 'position:fixed; bottom:20px; left:20px; background:#00f0ff; color:black; padding:15px 25px; border-radius:50px; border:none; cursor:pointer; font-weight:900; z-index:9998; box-shadow:0 0 20px rgba(0,240,255,0.4);';
    document.body.appendChild(invBtn);

    // Badge de notificaciones
    const badge = document.createElement('span');
    badge.id = 'msg-badge';
    badge.style.cssText = 'position:absolute; top:-5px; right:-5px; background:#ff007f; color:white; border-radius:50%; width:24px; height:24px; display:none; align-items:center; justify-content:center; font-size:0.7rem; border:2px solid #0a0a0f;';
    invBtn.appendChild(badge);

    // Escuchar mensajes no leídos en tiempo real
    db.ref('contact_messages').on('value', snap => {
        const messages = snap.val() || {};
        let unreadCount = 0;
        for (let id in messages) {
            if (!messages[id].read) unreadCount++;
        }
        
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'flex';
            invBtn.style.boxShadow = '0 0 25px #ff007f';
        } else {
            badge.style.display = 'none';
            invBtn.style.boxShadow = '0 0 20px rgba(0,240,255,0.4)';
        }
    });

    const invModal = document.createElement('div');
    invModal.id = 'inventory-modal';
    invModal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:800px; max-height:80vh; background:#0a0a0f; border:2px solid #00f0ff; border-radius:24px; padding:40px; color:white; z-index:10000; display:none; overflow-y:auto; box-shadow:0 0 100px rgba(0,0,0,0.9);';
    document.body.appendChild(invModal);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:none; backdrop-filter:blur(5px);';
    document.body.appendChild(overlay);

    invBtn.onclick = () => {
        invModal.style.display = 'block';
        overlay.style.display = 'block';
        window.loadInventoryData();
    };

    overlay.onclick = () => {
        invModal.style.display = 'none';
        overlay.style.display = 'none';
    };

    window.loadInventoryData = () => {
        invModal.innerHTML = '<h2 style="margin-bottom:20px; color:#00f0ff; text-transform:uppercase; letter-spacing:2px;">📋 Control de Inventario</h2><p>Cargando datos...</p>';
        
        db.ref().once('value').then(snap => {
            const data = snap.val() || {};
            const allGrids = data.grids || {};
            const allSales = data.sales || {};

            let tableHTML = `
                <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
                    <button onclick="exportInventoryToExcel()" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">📊 Excel Inventario</button>
                    <button onclick="window.showSalesHistory()" style="background:#f39c12; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">📜 Historial de Ventas</button>
                    <button onclick="window.showMessagesHistory()" style="background:#00f0ff; color:black; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">💬 Mensajes Recibidos</button>
                    <button onclick="window.resetGridToDefault()" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">⚠️ Reiniciar Diseño (BORRAR BASURA)</button>
                </div>
                <table id="inventory-table" style="width:100%; border-collapse:collapse; margin-top:20px; font-size:0.9rem;">
                    <thead>
                        <tr style="border-bottom:2px solid #333; text-align:left;">
                            <th style="padding:10px;">Producto</th>
                            <th style="padding:10px;">Categoría</th>
                            <th style="padding:10px;">Precio</th>
                            <th style="padding:10px;">Stock</th>
                            <th style="padding:10px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let hasItems = false;
            for (let gridKey in allGrids) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = allGrids[gridKey];
                
                const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
                items.forEach((item, itemIdx) => {
                    hasItems = true;
                    const name = item.querySelector('h3, .product-name, .platform-name')?.innerText || 'Sin nombre';
                    const priceText = item.querySelector('.price, .product-price, .platform-price')?.innerText || '$0';
                    const stock = parseInt(item.getAttribute('data-stock')) || 0;
                    const cat = gridKey.split('_')[1] || 'General';

                    tableHTML += `
                        <tr style="border-bottom:1px solid #222;">
                            <td style="padding:12px;"><input type="text" value="${name}" id="name-${gridKey}-${itemIdx}" style="background:#111; color:white; border:1px solid #333; padding:5px; width:150px; border-radius:4px;"></td>
                            <td style="padding:12px; opacity:0.6;">${cat}</td>
                            <td style="padding:12px;"><input type="text" value="${priceText}" id="price-${gridKey}-${itemIdx}" style="background:#111; color:#00f0ff; border:1px solid #333; padding:5px; width:80px; border-radius:4px;"></td>
                            <td style="padding:12px;"><input type="number" value="${stock}" id="stock-${gridKey}-${itemIdx}" style="background:#111; color:#39ff14; border:1px solid #333; padding:5px; width:50px; border-radius:4px;"></td>
                            <td style="padding:12px;">
                                <button onclick="saveProductEdit('${gridKey}', ${itemIdx})" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Guardar</button>
                            </td>
                        </tr>
                    `;
                });
            }

            if (!hasItems) tableHTML += '<tr><td colspan="5" style="padding:20px; text-align:center;">No hay productos registrados.</td></tr>';
            
            tableHTML += '</tbody></table>';
            invModal.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#00f0ff; text-transform:uppercase; letter-spacing:2px; margin:0;">📋 Control de Inventario</h2>
                    <button onclick="document.getElementById('inventory-modal').style.display='none'; document.querySelector('#inventory-modal + div').style.display='none';" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:20px; border-radius:15px; border:1px solid #222;">
                    ${tableHTML}
                </div>
            `;
        });
    };

    window.saveProductEdit = (gridKey, itemIdx) => {
        const newPrice = document.getElementById(`price-${gridKey}-${itemIdx}`).value;
        const newStock = document.getElementById(`stock-${gridKey}-${itemIdx}`).value;
        const newName = document.getElementById(`name-${gridKey}-${itemIdx}`).value;

        db.ref('grids/' + gridKey).once('value').then(snap => {
            const html = snap.val();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Limpiar admin-controls y stock-indicators del HTML antes de procesar
            tempDiv.querySelectorAll('.admin-controls-wrapper, .stock-indicator').forEach(el => el.remove());
            
            const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
            const item = items[itemIdx];

            if (item) {
                const nameEl = item.querySelector('h2, h3, .product-name, .platform-name');
                if(nameEl && newName) nameEl.innerText = newName;
                
                const priceEl = item.querySelector('.price, .product-price, .platform-price');
                if(priceEl) priceEl.innerText = newPrice;
                item.setAttribute('data-stock', newStock);
                
                db.ref('grids/' + gridKey).set(tempDiv.innerHTML).then(() => {
                    alert('Producto actualizado con éxito. Recarga la página para ver los cambios en la tienda.');
                    window.loadInventoryData();
                });
            }
        });
    };

    window.exportInventoryToExcel = () => {
        let csv = 'Producto,Categoria,Precio,Stock\n';
        const rows = document.querySelectorAll('#inventory-table tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            const name = cols[0].innerText;
            const cat = cols[1].innerText;
            const price = cols[2].querySelector('input').value.replace(/,/g, '');
            const stock = cols[3].querySelector('input').value;
            csv += `"${name}","${cat}","${price}","${stock}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'inventario_knifeblackstore.csv');
        link.click();
    };

    window.showMessagesHistory = () => {
        invModal.innerHTML = '<h2 style="color:#00f0ff;">Cargando mensajes...</h2>';
        db.ref('contact_messages').once('value').then(snap => {
            const messages = snap.val() || {};
            let msgHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#00f0ff; text-transform:uppercase;">&#128172; Mensajes de Contacto</h2>
                    <button onclick="window.loadInventoryData()" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">⬅️ Volver</button>
                </div>
                <div style="display:grid; gap:15px;">
            `;

            let hasMsg = false;
            // Ordenar mensajes por fecha (más recientes primero)
            const sortedIds = Object.keys(messages).sort((a, b) => new Date(messages[b].date) - new Date(messages[a].date));

            sortedIds.forEach(id => {
                hasMsg = true;
                const m = messages[id];
                const date = new Date(m.date).toLocaleString();
                const isUnread = !m.read;
                
                msgHTML += `
                    <div style="background:${isUnread ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255,255,255,0.05)'}; padding:15px; border-radius:10px; border-left:4px solid ${isUnread ? '#ff007f' : '#00f0ff'};">
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:10px; opacity:0.7;">
                            <span>De: ${m.name} (${m.email}) ${isUnread ? '<b style="color:#ff007f; margin-left:10px;">¡NUEVO!</b>' : ''}</span>
                            <span>${date}</span>
                        </div>
                        <p style="margin:0; line-height:1.4;">${m.message}</p>
                    </div>
                `;

                // Marcar como leído
                if (isUnread) {
                    db.ref('contact_messages/' + id).update({ read: true });
                }
            });

            if (!hasMsg) msgHTML += '<p style="text-align:center; padding:20px; opacity:0.5;">No hay mensajes nuevos.</p>';
            msgHTML += '</div>';
            invModal.innerHTML = msgHTML;
        });
    };

    window.showSalesHistory = () => {
        invModal.innerHTML = '<h2 style="color:#00f0ff;">Cargando historial...</h2>';
        db.ref('sales').once('value').then(snap => {
            const sales = snap.val() || {};
            let salesHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#f39c12; text-transform:uppercase;">📜 Historial de Ventas</h2>
                    <div>
                        <button onclick="exportSalesToExcel()" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; margin-right:10px;">📊 Excel Ventas</button>
                        <button onclick="window.loadInventoryData()" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">⬅️ Volver</button>
                    </div>
                </div>
                <table id="sales-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead>
                        <tr style="border-bottom:2px solid #333; text-align:left;">
                            <th style="padding:10px;">Fecha</th>
                            <th style="padding:10px;">Cliente</th>
                            <th style="padding:10px;">Total</th>
                            <th style="padding:10px;">Estado</th>
                            <th style="padding:10px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (let id in sales) {
                const s = sales[id];
                const date = new Date(s.date).toLocaleString();
                salesHTML += `
                    <tr style="border-bottom:1px solid #222;">
                        <td style="padding:10px; opacity:0.7;">${date}</td>
                        <td style="padding:10px;">${s.customer}<br><span style="font-size:0.7rem; opacity:0.5;">${s.email}</span></td>
                        <td style="padding:10px; color:#39ff14; font-weight:bold;">$${s.total.toLocaleString()}</td>
                        <td style="padding:10px;"><span style="background:rgba(243,156,18,0.1); color:#f39c12; padding:3px 8px; border-radius:4px; font-size:0.7rem;">${s.status}</span></td>
                        <td style="padding:10px;">
                            <button onclick="printInvoice('${id}')" style="background:#fff; color:#000; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.7rem; font-weight:bold;">🧾 Factura</button>
                        </td>
                    </tr>
                `;
            }

            salesHTML += '</tbody></table>';
            invModal.innerHTML = salesHTML;
        });
    };

    window.exportSalesToExcel = () => {
        let csv = 'Fecha,Cliente,Email,Total,Estado\n';
        db.ref('sales').once('value').then(snap => {
            const sales = snap.val() || {};
            for (let id in sales) {
                const s = sales[id];
                csv += `"${new Date(s.date).toLocaleString()}","${s.customer}","${s.email}","${s.total}","${s.status}"\n`;
            }
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'ventas_knifeblackstore.csv');
            link.click();
        });
    };

    window.printInvoice = (id) => {
        db.ref('sales/' + id).once('value').then(snap => {
            const s = snap.val();
            const printWindow = window.open('', '_blank');
            const itemsHTML = s.items.map(it => `
                <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${it.name}</td>
                    <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$${it.price.toLocaleString()}</td>
                </tr>
            `).join('');

            printWindow.document.write(`
                <html>
                <head>
                    <title>Factura - ${id}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #333; }
                        .header { text-align: center; border-bottom: 2px solid #00f0ff; padding-bottom: 20px; }
                        .details { margin: 20px 0; }
                        table { width: 100%; border-collapse: collapse; }
                        .total { font-size: 1.5rem; font-weight: bold; text-align: right; margin-top: 20px; color: #00f0ff; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>KNIFEBLACKSTORE</h1>
                        <p>Factura de Venta No. ${id.substring(0,8).toUpperCase()}</p>
                    </div>
                    <div class="details">
                        <p><strong>Fecha:</strong> ${new Date(s.date).toLocaleString()}</p>
                        <p><strong>Cliente:</strong> ${s.customer}</p>
                        <p><strong>Email:</strong> ${s.email}</p>
                    </div>
                    <table>
                        <thead>
                            <tr style="background:#f9f9f9;">
                                <th style="padding:10px; text-align:left;">Producto</th>
                                <th style="padding:10px; text-align:right;">Precio</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                    <div class="total">TOTAL: $${s.total.toLocaleString()}</div>
                    <p style="text-align:center; margin-top:50px; font-size:0.8rem; color:#888;">Gracias por tu compra en Knifeblackstore.</p>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        });
    };
};

document.addEventListener('DOMContentLoaded', updateCartUI);

// --- UTILIDADES ---
window.toggleReadMore = (btn) => {
    const content = btn.previousElementSibling;
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        btn.textContent = 'Leer menos';
    } else {
        content.style.display = 'none';
        btn.textContent = 'Leer más';
    }
};
// --- GESTIÓN DE CONTACTO ---
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('formulario');
    if (contactForm) {
        contactForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerText : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Enviando...';
            }

            const name = document.getElementById('nombre').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('mensaje').value.trim();

            const msgData = {
                name,
                email,
                message,
                read: false,
                date: new Date().toISOString()
            };

            try {
                // 1. Guardar de forma primordial en Firebase (garantiza que NUNCA se pierda el mensaje)
                await db.ref('contact_messages').push(msgData);

                // 2. Intentar notificación por correo vía EmailJS de forma no bloqueante
                try {
                    if (typeof emailjs !== 'undefined') {
                        const templateParams = {
                            from_name: name,
                            from_email: email,
                            message: message,
                            to_email: 'knifeblackstore@gmail.com',
                            to_name: 'KnifeBlack Store'
                        };
                        await emailjs.send("service_5hy8csv", "template_lirlr2z", templateParams);
                    }
                } catch (emailErr) {
                    console.warn('Aviso: Notificación EmailJS no completada (la cuenta de correo requiere reconexión), pero el mensaje quedó guardado en tu panel de administración:', emailErr);
                }

                alert('🎉 ¡Mensaje recibido con éxito! Nos pondremos en contacto contigo pronto.');
                contactForm.reset();
            } catch (err) {
                console.error('Error al guardar mensaje en base de datos:', err);
                alert('❌ No se pudo registrar el mensaje. Por favor intenta de nuevo o escríbenos directamente a WhatsApp.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalBtnText;
                }
            }
        };
    }
});

// --- SISTEMA DE GALERÍA DE IMÁGENES MÚLTIPLES ---
window.prevGalleryImage = (event, btn) => {
    event.stopPropagation();
    event.preventDefault();
    const container = btn.closest('.product-gallery-container');
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('.product-gallery-image'));
    if (imgs.length <= 1) return;
    let activeIdx = imgs.findIndex(img => img.classList.contains('active') || img.style.display !== 'none');
    if (activeIdx === -1) activeIdx = 0;
    imgs[activeIdx].classList.remove('active');
    imgs[activeIdx].style.display = 'none';
    let nextIdx = (activeIdx - 1 + imgs.length) % imgs.length;
    imgs[nextIdx].classList.add('active');
    imgs[nextIdx].style.display = 'block';
};

window.nextGalleryImage = (event, btn) => {
    event.stopPropagation();
    event.preventDefault();
    const container = btn.closest('.product-gallery-container');
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('.product-gallery-image'));
    if (imgs.length <= 1) return;
    let activeIdx = imgs.findIndex(img => img.classList.contains('active') || img.style.display !== 'none');
    if (activeIdx === -1) activeIdx = 0;
    imgs[activeIdx].classList.remove('active');
    imgs[activeIdx].style.display = 'none';
    let nextIdx = (activeIdx + 1) % imgs.length;
    imgs[nextIdx].classList.add('active');
    imgs[nextIdx].style.display = 'block';
};

const getProductImages = (item) => {
    const galleryContainer = item.querySelector('.product-gallery-container');
    if (galleryContainer) {
        return Array.from(galleryContainer.querySelectorAll('.product-gallery-image')).map(img => img.src);
    }
    const singleImg = item.querySelector('.editable-media');
    if (singleImg && singleImg.tagName === 'IMG') return [singleImg.src];
    const legacyImg = item.querySelector('img');
    if (legacyImg && !legacyImg.closest('.admin-controls-wrapper')) return [legacyImg.src];
    
    const iconSpan = item.querySelector('.platform-icon span') || item.querySelector('.product-img-container span');
    if (iconSpan && iconSpan.innerText.trim()) return [iconSpan.innerText.trim()];
    
    return [];
};

const updateProductImageArea = (item, imageList) => {
    let targetContainer = item.querySelector('.product-gallery-container') || 
                          item.querySelector('.product-img-container') || 
                          item.querySelector('.platform-icon') || 
                          item.querySelector('.editable-media');
    
    if (!targetContainer) {
        const legacyImg = item.querySelector('img');
        if(legacyImg && !legacyImg.closest('.admin-controls-wrapper')) targetContainer = legacyImg;
    }
    
    if (!targetContainer) {
        targetContainer = document.createElement('div');
        targetContainer.className = 'product-img-container platform-icon';
        item.prepend(targetContainer);
    }

    const originalClasses = targetContainer.className;

    if (imageList.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = originalClasses + ' editable-media';
        if (!placeholder.className.includes('product-img-container')) placeholder.classList.add('product-img-container');
        placeholder.innerHTML = '<span>🛒</span>';
        targetContainer.replaceWith(placeholder);
    } else if (imageList.length === 1) {
        const imgUrlOrEmoji = imageList[0];
        if (imgUrlOrEmoji.startsWith('http') || imgUrlOrEmoji.startsWith('data:image')) {
            const img = document.createElement('img');
            img.src = imgUrlOrEmoji;
            img.className = originalClasses + ' editable-media';
            img.style.cssText = 'width:120px; height:120px; object-fit:contain; border-radius:8px; margin: 0 auto 20px; filter: drop-shadow(0 0 15px rgba(255,255,255,0.2));';
            targetContainer.replaceWith(img);
        } else {
            const div = document.createElement('div');
            div.className = originalClasses + ' editable-media';
            if (!div.className.includes('product-img-container') && !div.className.includes('platform-icon')) div.classList.add('product-img-container');
            div.innerHTML = `<span>${imgUrlOrEmoji}</span>`;
            targetContainer.replaceWith(div);
        }
    } else {
        const gallery = document.createElement('div');
        gallery.className = originalClasses + ' product-gallery-container';
        gallery.style.cssText = 'position:relative; width:100%; aspect-ratio:1; overflow:hidden; border-radius:12px; margin-bottom:15px;';
        
        imageList.forEach((src, i) => {
            const img = document.createElement('img');
            img.src = src;
            img.className = 'product-gallery-image' + (i===0 ? ' active' : '');
            img.style.cssText = `position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity:${i===0?1:0}; transition:opacity 0.3s;`;
            gallery.appendChild(img);
        });
        
        const nav = document.createElement('div');
        nav.className = 'gallery-nav';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'gallery-nav-btn prev';
        prevBtn.innerHTML = '❮';
        prevBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); cycleGallery(gallery, -1); };
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'gallery-nav-btn next';
        nextBtn.innerHTML = '❯';
        nextBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); cycleGallery(gallery, 1); };
        
        nav.appendChild(prevBtn);
        nav.appendChild(nextBtn);
        gallery.appendChild(nav);
        
        targetContainer.replaceWith(gallery);
    }
};

window.openProductGalleryManager = (item, grid, safeKey) => {
    let images = getProductImages(item);
    
    let overlay = document.getElementById('gallery-manager-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gallery-manager-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(5px); z-index:20000; display:flex; align-items:center; justify-content:center;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    const renderManager = () => {
        overlay.innerHTML = `
            <div style="background:#0a0a0f; border:2px solid var(--neon-cyan); border-radius:24px; padding:30px; width:90%; max-width:500px; color:white; box-shadow:0 0 30px rgba(0,240,255,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; text-transform:uppercase; letter-spacing:1px; color:#00f0ff;">📷 IMÁGENES</h3>
                    <button id="close-gallery-manager" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div id="gallery-manager-list" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; max-height:200px; overflow-y:auto; margin-bottom:20px; background:rgba(255,255,255,0.02); padding:15px; border-radius:12px; border:1px solid #222;">
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                    <button id="gallery-add-local" style="background:#3498db; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;">📤 Subir Imagen Local</button>
                    <button id="gallery-add-url" style="background:#9b59b6; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;">🔗 Agregar desde URL</button>
                    <button id="gallery-add-emoji" style="background:#f1c40f; color:black; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer;">📌 Añadir Emoji/Icono</button>
                </div>
                <button id="gallery-manager-save" style="background:linear-gradient(45deg, #2ecc71, #27ae60); color:white; border:none; padding:12px; border-radius:8px; width:100%; font-weight:bold; cursor:pointer; font-size:1rem; text-transform:uppercase;">Aplicar y Guardar</button>
            </div>
        `;

        const listContainer = overlay.querySelector('#gallery-manager-list');
        if (images.length === 0) {
            listContainer.innerHTML = '<div style="grid-column: span 4; text-align:center; opacity:0.5; font-size:0.9rem;">Sin imágenes o iconos.</div>';
        } else {
            images.forEach((imgUrl, idx) => {
                const isImg = imgUrl.startsWith('http') || imgUrl.startsWith('data:image');
                const card = document.createElement('div');
                card.style.cssText = 'position:relative; width:100%; aspect-ratio:1; background:#111; border-radius:8px; border:1px solid #333; display:flex; align-items:center; justify-content:center; overflow:hidden;';
                
                if (isImg) {
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.style.cssText = 'width:100%; height:100%; object-fit:contain;';
                    card.appendChild(img);
                } else {
                    const span = document.createElement('span');
                    span.innerText = imgUrl;
                    span.style.cssText = 'font-size:2rem;';
                    card.appendChild(span);
                }

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '&times;';
                delBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:rgba(231,76,60,0.8); color:white; border:none; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; padding:0;';
                delBtn.onclick = () => {
                    images.splice(idx, 1);
                    renderManager();
                };
                card.appendChild(delBtn);
                listContainer.appendChild(card);
            });
        }

        overlay.querySelector('#close-gallery-manager').onclick = () => {
            overlay.style.display = 'none';
        };

        overlay.querySelector('#gallery-add-local').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (ev) => {
                const file = ev.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const tempImg = new Image();
                        tempImg.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 400;
                            let width = tempImg.width;
                            let height = tempImg.height;
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(tempImg, 0, 0, width, height);
                            images.push(canvas.toDataURL('image/jpeg', 0.7));
                            renderManager();
                        };
                        tempImg.src = re.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        };

        overlay.querySelector('#gallery-add-url').onclick = () => {
            const url = prompt('Introduce la URL de la imagen:');
            if (url) {
                images.push(url);
                renderManager();
            }
        };

        overlay.querySelector('#gallery-add-emoji').onclick = () => {
            const emoji = prompt('Introduce un emoji o icono (ej. 💍, 📌, 👾):');
            if (emoji) {
                images.push(emoji);
                renderManager();
            }
        };

        overlay.querySelector('#gallery-manager-save').onclick = () => {
            updateProductImageArea(item, images);
            overlay.style.display = 'none';
            if (window.saveGrid && grid && safeKey) {
                window.saveGrid(grid, safeKey);
            }
        };
    };

    renderManager();
};


// --- SISTEMA DE DETALLES TIPO MERCADO LIBRE ---
let currentProductDetailsId = null;

function createProductDetailsModal() {
    let modal = document.getElementById('product-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-details-modal';
        modal.innerHTML = `
            <div class="details-container">
                <button class="details-close" onclick="closeProductDetails()">×</button>
                <div class="details-left">
                    <div class="details-gallery" id="details-main-img-container">
                        <img src="" id="details-main-img">
                    </div>
                    <div class="details-gallery-nav" id="details-thumbs"></div>
                </div>
                <div class="details-info">
                    <h1 class="details-title" id="details-title">Título</h1>
                    <div class="details-price" id="details-price">$0.00</div>
                    <p class="details-desc" id="details-desc">Descripción</p>
                    <button class="details-buy-btn" id="details-buy-btn">Agregar al Carrito</button>
                    
                    <div class="reviews-section">
                        <h3 class="reviews-title">Reseñas de Clientes</h3>
                        <div id="reviews-list"></div>
                        <form class="review-form" id="review-form">
                            <select id="review-stars" required>
                                <option value="5">⭐⭐⭐⭐⭐ Excelente</option>
                                <option value="4">⭐⭐⭐⭐ Muy Bueno</option>
                                <option value="3">⭐⭐⭐ Bueno</option>
                                <option value="2">⭐⭐ Regular</option>
                                <option value="1">⭐ Malo</option>
                            </select>
                            <textarea id="review-text" rows="3" placeholder="Escribe tu opinión aquí..." required></textarea>
                            <button type="submit">Enviar Reseña</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProductDetails();
        });

        document.getElementById('review-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (!user) {
                alert('Debes iniciar sesión para dejar una reseña.');
                window.location.href = 'login.html';
                return;
            }
            if (!currentProductDetailsId) return;

            const stars = document.getElementById('review-stars').value;
            const text = document.getElementById('review-text').value;
            
            const newReview = {
                author: user.name || user.email,
                stars: parseInt(stars),
                text: text,
                date: new Date().toISOString()
            };

            db.ref('reviews/' + currentProductDetailsId).push(newReview).then(() => {
                document.getElementById('review-form').reset();
                loadReviews(currentProductDetailsId);
            }).catch(err => {
                alert('Error al guardar la reseña. Inténtalo de nuevo.');
                console.error(err);
            });
        });
    }
    return modal;
}

function openProductDetails(card) {
    const titleEl = card.querySelector('.product-name, .platform-name, h2, h3');
    if (!titleEl) return;
    
    let itemId = titleEl.id;
    if (!itemId) {
        itemId = 'prod_' + titleEl.innerText.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        titleEl.id = itemId;
    }
    currentProductDetailsId = itemId;

    const modal = createProductDetailsModal();
    const title = titleEl.innerText;
    const desc = card.querySelector('.product-desc, .platform-desc, p:not(.price)')?.innerText || 'Sin descripción';
    const price = card.querySelector('.product-price, .platform-price, .price')?.innerHTML || '$0.00';
    
    document.getElementById('details-title').innerText = title;
    document.getElementById('details-desc').innerText = desc;
    document.getElementById('details-price').innerHTML = price;

    const buyBtn = document.getElementById('details-buy-btn');
    buyBtn.onclick = () => {
        const originalBtn = card.querySelector('.buy-btn, .add-screen-btn');
        if (originalBtn) originalBtn.click();
        closeProductDetails();
    };

    const images = getProductImages(card);
    const mainImg = document.getElementById('details-main-img');
    const thumbsContainer = document.getElementById('details-thumbs');
    thumbsContainer.innerHTML = '';

    if (images.length > 0) {
        mainImg.src = images[0];
        if (images.length > 1) {
            images.forEach((src, idx) => {
                const thumb = document.createElement('img');
                thumb.src = src;
                thumb.className = 'details-gallery-thumb' + (idx === 0 ? ' active' : '');
                thumb.onclick = () => {
                    mainImg.src = src;
                    document.querySelectorAll('.details-gallery-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                };
                thumbsContainer.appendChild(thumb);
            });
        }
    } else {
        const icon = card.querySelector('.platform-icon span, .product-img-container span')?.innerText || '✨';
        document.getElementById('details-main-img-container').innerHTML = `<div style="font-size: 8rem; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">${icon}</div>`;
    }

    loadReviews(itemId);
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductDetails() {
    const modal = document.getElementById('product-details-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentProductDetailsId = null;
    }
}

function loadReviews(itemId) {
    const list = document.getElementById('reviews-list');
    list.innerHTML = '<p style="color:#888;">Cargando reseñas...</p>';
    
    db.ref('reviews/' + itemId).once('value').then(snap => {
        const reviews = snap.val();
        list.innerHTML = '';
        if (reviews) {
            Object.values(reviews).reverse().forEach(rev => {
                const stars = '⭐'.repeat(rev.stars);
                list.innerHTML += `
                    <div class="review-card">
                        <div class="review-header">
                            <span class="review-author">${rev.author}</span>
                            <span class="review-stars">${stars}</span>
                        </div>
                        <div class="review-text">${rev.text}</div>
                    </div>
                `;
            });
        } else {
            list.innerHTML = '<p style="color:#888; font-style:italic;">Aún no hay reseñas. ¡Sé el primero en opinar!</p>';
        }
    }).catch(err => {
        list.innerHTML = '<p style="color:#e74c3c;">No se pudieron cargar las reseñas.</p>';
        console.error(err);
    });
}


// CSS Global de Corrección y Accesibilidad para Admin
const adminStyles = document.createElement('style');
adminStyles.innerHTML = `
    /* Evitar que los pseudo-elementos ::before (overlays) bloqueen los clics al texto */
    .item::before, .product-card::before, .platform-card::before {
        pointer-events: none !important;
    }
    /* Asegurar que el texto editable esté siempre por encima de cualquier fondo o decoración */
    [contenteditable="true"], .admin-controls-wrapper {
        position: relative !important;
        z-index: 20 !important;
    }
`;
document.head.appendChild(adminStyles);

// Cerrar modal si se hace clic fuera del contenido
document.addEventListener('click', (e) => {
    if (e.target.closest('.admin-controls-wrapper') || e.target.closest('.buy-btn, .add-screen-btn')) return;
    
    // Si el usuario es admin, NO abrir el modal al hacer clic en la tarjeta (para no interferir con la edición)
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && user.role === 'admin') {
        // Solo evitar la navegación si hace clic EXACTAMENTE en un texto/icono editable DENTRO de un enlace.
        // Si hace clic en el fondo de la tarjeta enlace, permitimos que navegue.
        // Si la tarjeta NO es un enlace (ej: div en plataformas), no hace preventDefault para no bloquear el foco en Safari/Móviles.
        if (e.target.closest('a') && e.target.isContentEditable) {
            e.preventDefault();
        }
        return;
    }

    const card = e.target.closest('.product-card, .platform-card');
    if (card) {
        if (e.target.isContentEditable) return;
        openProductDetails(card);
    }
});


// --- SISTEMA DE CUPONES DE DESCUENTO ---

window.currentDiscount = null;

window.applyDiscountCode = () => {
    const codeInput = document.getElementById('cart-discount-code');
    if (!codeInput) return;
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        alert('Por favor ingresa un código de cupón.');
        return;
    }
    
    db.ref('discountCodes/' + code).once('value').then(snap => {
        const discount = snap.val();
        if (discount && discount.active !== false) {
            window.currentDiscount = { code: code, ...discount };
            alert(`¡Cupón ${code} aplicado exitosamente!`);
            updateCartUI();
        } else {
            alert('Código de cupón inválido o expirado.');
            codeInput.value = '';
        }
    }).catch(err => {
        console.error(err);
        alert('Error al verificar el cupón.');
    });
};

window.removeDiscountCode = () => {
    window.currentDiscount = null;
    updateCartUI();
};

// Soporte para aplicar cupón con tecla Enter
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.id === 'cart-discount-code') {
        e.preventDefault();
        window.applyDiscountCode();
    }
});

const initDiscountPanel = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') return;

    // Crear botón de acceso al panel de cupones (al lado del inventario)
    const discountBtn = document.createElement('button');
    discountBtn.id = 'admin-discount-btn';
    discountBtn.innerHTML = '🎟️ Cupones';
    discountBtn.style.cssText = 'position:fixed; bottom:80px; left:20px; background:#ff007f; color:white; padding:15px 25px; border-radius:50px; border:none; cursor:pointer; font-weight:900; z-index:9998; box-shadow:0 0 20px rgba(255,0,127,0.4);';
    document.body.appendChild(discountBtn);

    // Crear Modal de Cupones
    const modal = document.createElement('div');
    modal.id = 'discount-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:none; justify-content:center; align-items:center; backdrop-filter:blur(10px);';
    
    modal.innerHTML = `
        <div style="background:#111; padding:30px; border-radius:20px; border:1px solid var(--neon-pink); width:90%; max-width:600px; max-height:80vh; overflow-y:auto; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:10px;">
                <h2 style="color:var(--neon-pink); margin:0;">🎟️ Gestor de Cupones</h2>
                <button id="close-discount-modal" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:10px; margin-bottom:20px;">
                <h3 style="margin-top:0;">Crear Nuevo Cupón</h3>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="new-coupon-code" placeholder="CÓDIGO (Ej: OFERTA20)" style="flex:1; padding:10px; border-radius:5px; border:1px solid #444; background:#222; color:white; text-transform:uppercase;">
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <select id="new-coupon-type" style="padding:10px; border-radius:5px; border:1px solid #444; background:#222; color:white;">
                        <option value="percentage">Porcentaje (%)</option>
                        <option value="fixed">Monto Fijo ($)</option>
                    </select>
                    <input type="number" id="new-coupon-amount" placeholder="Valor (Ej: 20)" style="flex:1; padding:10px; border-radius:5px; border:1px solid #444; background:#222; color:white;">
                </div>
                <button id="save-new-coupon" style="background:var(--neon-pink); color:white; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer; width:100%;">Guardar Cupón</button>
            </div>

            <h3 style="margin-bottom:10px;">Cupones Activos</h3>
            <div id="discount-list" style="display:flex; flex-direction:column; gap:10px;">
                <!-- Lista de cupones se cargará aquí -->
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    discountBtn.onclick = () => {
        modal.style.display = 'flex';
        loadCoupons();
    };

    document.getElementById('close-discount-modal').onclick = () => {
        modal.style.display = 'none';
    };

    document.getElementById('save-new-coupon').onclick = () => {
        const codeInput = document.getElementById('new-coupon-code');
        const typeSelect = document.getElementById('new-coupon-type');
        const amountInput = document.getElementById('new-coupon-amount');
        
        const code = codeInput.value.trim().toUpperCase();
        const type = typeSelect.value;
        const amount = parseFloat(amountInput.value);
        
        if (!code || isNaN(amount) || amount <= 0) {
            alert('Por favor completa todos los campos correctamente.');
            return;
        }

        db.ref('discountCodes/' + code).set({
            type: type,
            amount: amount,
            active: true
        }).then(() => {
            alert('¡Cupón creado exitosamente!');
            codeInput.value = '';
            amountInput.value = '';
            loadCoupons();
        }).catch(err => {
            console.error(err);
            alert('Error al guardar el cupón.');
        });
    };

    const loadCoupons = () => {
        const listDiv = document.getElementById('discount-list');
        listDiv.innerHTML = '<p>Cargando cupones...</p>';
        
        db.ref('discountCodes').once('value').then(snap => {
            const data = snap.val();
            if (!data) {
                listDiv.innerHTML = '<p style="color:#888;">No hay cupones creados.</p>';
                return;
            }
            
            listDiv.innerHTML = '';
            Object.keys(data).forEach(code => {
                const coupon = data[code];
                const item = document.createElement('div');
                item.style.cssText = 'background:rgba(255,255,255,0.02); border:1px solid #333; border-radius:8px; padding:15px; display:flex; justify-content:space-between; align-items:center;';
                
                const valText = coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount.toLocaleString()}`;
                
                item.innerHTML = `
                    <div>
                        <strong style="color:var(--neon-pink); font-size:1.1rem;">${code}</strong>
                        <span style="color:#aaa; font-size:0.9rem; margin-left:10px;">Descuento: ${valText}</span>
                    </div>
                    <button class="del-coupon-btn" data-code="${code}" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Eliminar</button>
                `;
                listDiv.appendChild(item);
            });

            document.querySelectorAll('.del-coupon-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const codeToDelete = e.target.getAttribute('data-code');
                    if (confirm(`¿Estás seguro de eliminar el cupón ${codeToDelete}?`)) {
                        db.ref('discountCodes/' + codeToDelete).remove().then(() => {
                            loadCoupons();
                        });
                    }
                };
            });
        });
    };
};

const initPOSPanel = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') return;

    const posBtn = document.createElement('button');
    posBtn.id = 'admin-pos-btn';
    posBtn.innerHTML = '🖥️ POS';
    posBtn.style.cssText = 'position:fixed; bottom:140px; left:20px; background:#a29bfe; color:black; padding:15px 25px; border-radius:50px; border:none; cursor:pointer; font-weight:900; z-index:9998; box-shadow:0 0 20px rgba(162,155,254,0.4); text-decoration:none;';
    
    posBtn.onclick = () => {
        window.location.href = 'pos.html';
    };
    
    document.body.appendChild(posBtn);
};

document.addEventListener('DOMContentLoaded', () => {
    initDiscountPanel();
    initPOSPanel();
});


// ============================================================================
// TIENDAS AMIGAS (Aliados)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('tiendas-amigas-section');
    const container = document.getElementById('tiendas-amigas-container');
    
    if (section && container) {
        db.ref('partner_stores').once('value').then(snap => {
            const data = snap.val();
            if (data) {
                const stores = Object.values(data);
                if (stores.length > 0) {
                    section.style.display = 'block';
                    container.innerHTML = '';
                    stores.forEach(store => {
                        container.innerHTML += `
                            <a href="${store.url}" target="_blank" style="display:flex; align-items:center; gap:12px; background:rgba(0,240,255,0.05); border:1px solid rgba(0,240,255,0.2); padding:10px 20px; border-radius:50px; text-decoration:none; color:#fff; font-weight:bold; transition:0.3s; box-shadow:0 0 10px rgba(0,0,0,0.5);" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='var(--neon-cyan)';" onmouseout="this.style.transform='none'; this.style.borderColor='rgba(0,240,255,0.2)';">
                                <img src="${store.image}" alt="${store.name}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                                <span>${store.name}</span>
                            </a>
                        `;
                    });
                }
            }
        });
    }
});


// Populate footer stats
document.addEventListener('DOMContentLoaded', () => {
    db.ref('products').once('value').then(snap => {
        const data = snap.val();
        if (data) {
            const products = Object.values(data);
            const total = products.length;
            const inStock = products.filter(p => p.stock > 0).length;
            
            const totalEls = document.querySelectorAll('#stat-total');
            const availEls = document.querySelectorAll('#stat-avail');
            
            totalEls.forEach(el => el.innerText = total);
            availEls.forEach(el => el.innerText = inStock);
        }
    });
});


// ============================================================================
// PWA INSTALLATION LOGIC
// ============================================================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Create an "Install App" button dynamically in the nav or hero if it doesn't exist
    let installBtn = document.getElementById('btn-install-pwa');
    
    if (!installBtn) {
        installBtn = document.createElement('button');
        installBtn.id = 'btn-install-pwa';
        installBtn.innerHTML = '📲 Instalar App';
        installBtn.style.cssText = 'background: #39ff14; color: #000; border: none; padding: 8px 15px; border-radius: 50px; font-weight: bold; cursor: pointer; margin-left: 10px; font-size: 0.9rem; box-shadow: 0 0 10px rgba(57,255,20,0.5); transition: 0.3s;';
        
        installBtn.onmouseover = () => installBtn.style.transform = 'scale(1.05)';
        installBtn.onmouseout = () => installBtn.style.transform = 'scale(1)';
        
        // Find a place to append it (like the right side of the nav)
        const navRightSide = document.querySelector('.nav div[style*="margin-left:auto"]');
        if (navRightSide) {
            navRightSide.insertBefore(installBtn, navRightSide.firstChild);
        }
    }
    
    installBtn.style.display = 'inline-block';

    installBtn.addEventListener('click', async () => {
        // Hide the app provided install promotion
        installBtn.style.display = 'none';
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
    });
});

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    const installBtn = document.getElementById('btn-install-pwa');
    if(installBtn) installBtn.style.display = 'none';
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});


// Interactive Bubble Particle Effect on Hover
window.initBubbleHoverEffect = () => {
    let lastBubbleTime = 0;
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastBubbleTime < 50) return;
        
        const target = e.target.closest('.bubble-card, .item, .dyn-card, .pos-product-card, .sub-dashboard, .fin-dashboard, .bubble-pill, .nav-btn, .catalog-quick-btn, .partner-pill-card');
        if (!target) return;

        lastBubbleTime = now;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const bubble = document.createElement('span');
        bubble.className = 'bubble-particle';
        const size = Math.floor(Math.random() * 14) + 8;
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        bubble.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px');

        target.appendChild(bubble);
        setTimeout(() => bubble.remove(), 900);
    });
};
document.addEventListener('DOMContentLoaded', window.initBubbleHoverEffect);
