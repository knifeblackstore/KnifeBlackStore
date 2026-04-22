// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIW_YWb2VlQsTArOV7fK2li4Aux8X0ucY",
  authDomain: "knifeblackstore-1791.firebaseapp.com",
  databaseURL: "https://knifeblackstore-1791-default-rtdb.firebaseio.com",
  projectId: "knifeblackstore-1791",
  storageBucket: "knifeblackstore-1791.firebasestorage.app",
  messagingSenderId: "395101425109",
  appId: "1:395101425109:web:905bb04ffadc1f7e38815c",
  measurementId: "G-75NNCB77H8"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

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

// --- SISTEMA DE BASE DE DATOS FIREBASE Y SESIÓN ---

const initDB = () => {
    db.ref('usersDB').once('value').then(snap => {
        if (!snap.exists()) {
            db.ref('usersDB').set([{ email: 'admin@admin.com', password: 'admin', role: 'admin' }]);
        }
    });
};
initDB();

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const regRoleEl = document.getElementById('regRole');
        let role = (regRoleEl && regRoleEl.style.display !== 'none') ? regRoleEl.value : 'user';

        db.ref('usersDB').once('value').then(snap => {
            const users = snap.val() || [];
            if (users.find(u => u.email === email)) {
                alert('El correo ya está registrado.');
                return;
            }
            users.push({ name, email, password, role });
            db.ref('usersDB').set(users).then(() => {
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                if (currentUser && currentUser.role === 'admin') {
                    alert('¡Éxito! El usuario "' + name + '" ha sido creado como ' + role.toUpperCase());
                    document.getElementById('registerForm').reset();
                } else {
                    localStorage.setItem('currentUser', JSON.stringify({ name, email, password, role }));
                    alert('¡Cuenta creada exitosamente! Bienvenido, ' + name);
                    window.location.href = 'index.html';
                }
            });
        });
    });
}

const loginFormLocal = document.getElementById('loginForm');
if (loginFormLocal) {
    loginFormLocal.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailOrUser = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // ACCESO ADMINISTRADOR MAESTRO
        if (emailOrUser === 'Admin' && password === '123456') {
            const adminUser = { email: 'admin@knifeblackstore.com', name: 'Admin Maestro', role: 'admin' };
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            alert('¡Bienvenido, Administrador Maestro!');
            window.location.href = 'index.html';
            return;
        }

        db.ref('usersDB').once('value').then(snap => {
            const users = snap.val() || [];
            const user = users.find(u => (u.email === emailOrUser || u.name === emailOrUser) && u.password === password);
            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                alert('Inicio de sesión exitoso. Bienvenido, ' + (user.name || user.email));
                window.location.href = 'index.html';
            } else {
                alert('Usuario o contraseña incorrectos.');
            }
        });
    });
}

const logoutUser = () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
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
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const editableElements = document.querySelectorAll('.editable-content');
    
    db.ref('siteEdits').once('value').then(snap => {
        const savedEdits = snap.val() || {};
        editableElements.forEach(el => {
            if (savedEdits[el.id]) {
                el.innerText = savedEdits[el.id];
            }
            
            if (user && user.role === 'admin') {
                el.setAttribute('contenteditable', 'true');
                el.style.borderBottom = '1px dashed #3498db';
                el.title = 'Puedes hacer clic para editar este texto (Admin)';
                el.addEventListener('blur', (e) => {
                    db.ref('siteEdits/' + e.target.id).set(e.target.innerText);
                    const prevBg = e.target.style.backgroundColor;
                    e.target.style.backgroundColor = '#dff9fb';
                    setTimeout(() => e.target.style.backgroundColor = prevBg, 400);
                });
            }
        });
    });
};

// --- SISTEMA DINÁMICO DE ARTÍCULOS ---
const initDynamicGrid = () => {
    const grids = document.querySelectorAll('.grid, .platform-grid, .product-grid');
    if (grids.length === 0) return;
    
    grids.forEach(grid => {
        const pageKey = 'gridHTML_' + (window.location.pathname.split('/').pop() || 'index.html') + '_' + (grid.className);
        const safeKey = pageKey.replace(/\./g, '_').replace(/\s/g, '_');

        db.ref('grids/' + safeKey).once('value').then(snap => {
            const savedGrid = snap.val();
            if (savedGrid) {
                grid.innerHTML = savedGrid;
                
                // FILTRO DE SEGURIDAD: Solo permitir tarjetas válidas. 
                // Borra automáticamente cualquier "basura" (indicadores sueltos, etc) que se haya guardado por error.
                Array.from(grid.children).forEach(child => {
                    const isProduct = child.classList.contains('product-card');
                    const isPlatform = child.classList.contains('platform-card');
                    const isItem = child.classList.contains('item');
                    
                    if (!isProduct && !isPlatform && !isItem) {
                        child.remove();
                    }
                });

                // Sanatización de seguridad para NO-ADMINS
                const user = JSON.parse(localStorage.getItem('currentUser'));
                if (!user || user.role !== 'admin') {
                    grid.querySelectorAll('[contenteditable], .editable-content, .platform-name, .platform-desc, .platform-price, .product-name, .product-price').forEach(el => {
                        el.removeAttribute('contenteditable');
                        el.style.borderBottom = 'none';
                        el.style.cursor = 'default';
                        el.title = '';
                    });
                }
            }

            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user && user.role === 'admin') {
                const addBtn = document.createElement('button');
                addBtn.textContent = '+ Añadir Nuevo Elemento';
                addBtn.style.cssText = 'display:block; margin: 20px auto; padding: 12px 25px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 1.1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: 0.3s;';
                addBtn.onclick = () => {
                    const children = Array.from(grid.children).filter(c => 
                        c.classList.contains('product-card') || 
                        c.classList.contains('platform-card') || 
                        c.classList.contains('item')
                    );
                    if (children.length === 0) return;
                    
                    let emoji = "✨";
                    let defaultTitle = "Nuevo Elemento";
                    let isPlatform = grid.classList.contains('platform-grid');
                    
                    if (grid.classList.contains('product-grid')) {
                        const typeChoice = prompt("Selecciona el tipo de producto:\n1. Pin 🏮\n2. Figura 🎎\n3. Accesorio 🎒\n4. Otro ✨", "1");
                        if (typeChoice === "1") { emoji = "🏮"; defaultTitle = "Pin Metálico"; }
                        else if (typeChoice === "2") { emoji = "🎎"; defaultTitle = "Figura de Acción"; }
                        else if (typeChoice === "3") { emoji = "🎒"; defaultTitle = "Accesorio"; }
                    } else {
                        // Para plataformas, no pedir tipo de producto, solo usar el primero como base
                        const firstEmoji = children[0].querySelector(".platform-icon, .product-img-container")?.innerText.trim();
                        emoji = firstEmoji || "🎬";
                        defaultTitle = "Nueva Plataforma";
                    }

                    const clone = children[0].cloneNode(true);
                    const timestamp = Date.now();
                    
                    // Actualizar Icono/Emoji
                    const iconEl = clone.querySelector(".platform-icon, .product-img-container span, .platform-icon span");
                    if (iconEl) iconEl.innerText = emoji;

                    clone.querySelectorAll(".editable-content, .platform-name, .platform-desc, .platform-price, .product-name, .product-desc, .product-price").forEach((el, index) => {
                        el.id = "dynamic_" + timestamp + "_" + index;
                        if(el.classList.contains("price") || el.classList.contains("platform-price") || el.classList.contains("product-price")) {
                            el.innerText = isPlatform ? "$0.00 / Mes" : "$0.00";
                        }
                        else if(el.tagName === "H3" || el.tagName === "H2" || el.classList.contains("platform-name") || el.classList.contains("product-name")) {
                            el.innerText = defaultTitle;
                        }
                        else el.innerText = "Haz clic para editar descripción.";
                    });

                    // Limpiar indicadores y controles previos del clon
                    clone.querySelectorAll(".admin-controls-wrapper, .stock-indicator").forEach(el => el.remove());
                    
                    addAdminButtons(clone, grid, safeKey);
                    grid.appendChild(clone);
                    saveGrid(grid, safeKey);
                    initEditableContent();
                };
                grid.parentNode.insertBefore(addBtn, grid);

                // Filtrar para no procesar indicadores sueltos como si fueran productos
                Array.from(grid.children).forEach(item => {
                    const isRealCard = item.classList.contains('product-card') || item.classList.contains('platform-card');
                    const isNavItem = item.classList.contains('item') && item.tagName === 'A'; // Los de index.html son <a>
                    
                    if (isRealCard || (isNavItem && grid.id !== 'servicios')) {
                        addAdminButtons(item, grid, safeKey);
                    } else if (item.classList.contains('stock-indicator') || (isNavItem && grid.id === 'servicios')) {
                        // Si es index.html servicios, no queremos controles de stock ni nada dinámico aquí
                        if (item.classList.contains('stock-indicator')) item.remove();
                        // Si es un item de navegación en el grid, no le agregamos botones de admin de inventario
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
        clone.querySelectorAll('.admin-controls-wrapper, .stock-indicator, button:not(.buy-btn):not(.add-screen-btn)').forEach(el => el.remove());
        
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

function addAdminButtons(item, grid, safeKey) {
    if (item.querySelector('.admin-controls-wrapper')) return;

    // Hacer elementos de texto editables
    const textEls = item.querySelectorAll('h2, h3, p, .price, .platform-price, .product-price, .product-name, .platform-name');
    textEls.forEach(el => {
        el.contentEditable = true;
        el.style.borderBottom = '1px dashed var(--neon-cyan)';
        el.title = 'Haz clic para editar texto';
        el.onblur = () => saveGrid(grid, safeKey);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'admin-controls-wrapper';
    wrapper.style.cssText = 'position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 10; background:rgba(0,0,0,0.8); padding:10px; border-radius:8px; border:1px solid #333;';
    
    // Botón Imagen (Dual Mode: URL o Local)
    const imgBtn = document.createElement('button');
    imgBtn.textContent = '📷 Imagen';
    imgBtn.style.cssText = 'background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 5px 10px; font-size: 0.7rem; font-weight: bold;';
    imgBtn.onclick = (e) => {
        e.stopPropagation();
        
        const applyImage = (url) => {
            if (!url) return;
            let media = item.querySelector('.editable-media') || item.querySelector('.platform-icon') || item.querySelector('span') || item.querySelector('img');
            if (media) {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'editable-media';
                img.style.width = '60px'; img.style.height = '60px'; img.style.objectFit = 'contain'; img.style.borderRadius = '8px';
                media.replaceWith(img);
                saveGrid(grid, safeKey);
            }
        };

        const choice = confirm('¿Deseas subir una imagen LOCAL? (Presiona Cancelar para usar una URL)');
        if (choice) {
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
                            applyImage(canvas.toDataURL('image/jpeg', 0.7));
                        };
                        tempImg.src = re.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        } else {
            const url = prompt('Introduce la URL de la imagen:');
            if (url) applyImage(url);
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
    delBtn.textContent = '🗑️ Eliminar';
    delBtn.style.cssText = 'background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 5px 10px; font-size: 0.7rem; font-weight: bold; margin-top:5px;';
    delBtn.onclick = (e) => { e.stopPropagation(); if(confirm('¿Eliminar este elemento?')) { item.remove(); saveGrid(grid, safeKey); } };

    wrapper.appendChild(imgBtn);
    wrapper.appendChild(stockDiv);
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
    initInventoryPanel();
});

// --- SISTEMA DE CARRITO GAMER ---
let cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];

const updateCartUI = () => {
    let widget = document.getElementById('cart-widget');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'cart-widget';
        widget.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(10,10,15,0.95); backdrop-filter:blur(20px); color:white; padding:25px; border-radius:24px; border:1px solid var(--neon-cyan); box-shadow:0 0 30px rgba(0,240,255,0.2); display:none; z-index:9999; min-width:300px;';
        document.body.appendChild(widget);
    }

    if (cart.length > 0) {
        widget.style.display = 'block';
        let itemsHTML = cart.map((it, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
                <span style="font-size:0.9rem;">${it.name}</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="color:var(--neon-cyan); font-weight:900;">$${it.price.toLocaleString()}</span>
                    <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:var(--neon-pink); cursor:pointer; font-weight:900;">X</button>
                </div>
            </div>
        `).join('');

        let total = cart.reduce((sum, it) => sum + it.price, 0);

        widget.innerHTML = `
            <h3 style="margin-bottom:20px; text-transform:uppercase; letter-spacing:2px; font-weight:900; background:linear-gradient(to right, var(--neon-cyan), var(--neon-pink)); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">🛒 Carrito Gamer</h3>
            <div style="max-height:200px; overflow-y:auto; margin-bottom:20px; padding-right:5px;">${itemsHTML}</div>
            <div style="display:flex; justify-content:space-between; font-weight:900; font-size:1.2rem; margin-bottom:20px; border-top:1px solid var(--neon-cyan); padding-top:15px;">
                <span>TOTAL:</span>
                <span style="color:var(--neon-cyan); text-shadow:0 0 10px var(--neon-cyan);">$${total.toLocaleString()}</span>
            </div>
            <button onclick="checkoutCart()" style="background:linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); color:white; border:none; padding:15px; border-radius:12px; width:100%; cursor:pointer; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Comprar Todo por WhatsApp</button>
            <button onclick="payWithEpayco()" style="background:#fff; color:#000; border:none; padding:15px; border-radius:12px; width:100%; cursor:pointer; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:10px;">
                <img src="https://multimedia.epayco.co/epayco-landing/v2/logotipo-epayco.png" style="height:20px;">
                Pagar con Tarjeta / PSE
            </button>
            <button onclick="clearCart()" style="background:rgba(255,0,127,0.1); color:var(--neon-pink); border:1px solid var(--neon-pink); padding:10px; border-radius:12px; width:100%; cursor:pointer; font-size:0.8rem; font-weight:900;">Vaciar Carrito</button>
        `;
    } else {
        widget.style.display = 'none';
    }
};

window.addToCart = (btn) => {
    const card = btn.closest('.item, .platform-card, .product-card');
    if (card) {
        const name = card.querySelector('h3, .platform-name, .product-name').innerText;
        const priceText = card.querySelector('.price, .platform-price, .product-price').innerText;
        const price = parseFloat(priceText.replace(/[^0-9]/g, '')) || 0;
        
        cart.push({ name, price });
        localStorage.setItem('shoppingCart', JSON.stringify(cart));
        
        // Efecto visual de agregado
        const originalText = btn.innerText;
        btn.innerText = '¡AÑADIDO! ✨';
        btn.style.borderColor = 'var(--neon-green)';
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.borderColor = '';
        }, 1000);
        
        updateCartUI();
    }
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
        updateCartUI();
    }
};

window.checkoutCart = () => {
    if (cart.length === 0) return;
    
    // VERIFICACIÓN DE SESIÓN
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        alert('🚀 ¡Alto ahí, Gamer! Debes INICIAR SESIÓN para completar tu compra.');
        window.location.href = 'login.html';
        return;
    }
    
    let total = cart.reduce((sum, it) => sum + it.price, 0);
    let description = cart.map(it => it.name).join(', ');

    // REGISTRAR VENTA EN FIREBASE ANTES DE REDIRIGIR
    const saleData = {
        customer: user.name,
        email: user.email,
        items: cart,
        total: total,
        date: new Date().toISOString(),
        status: 'Pendiente (WhatsApp)'
    };
    db.ref('sales').push(saleData);

    let message = "🚀 *NUEVO PEDIDO - KNIFEBLACKSTORE*\n\n";
    message += `👤 *Cliente:* ${user.name} (${user.email})\n`;
    message += "------------------------------------------\n";
    message += "Hola, quiero adquirir los siguientes productos:\n\n";
    
    cart.forEach((it, idx) => {
        message += `${idx + 1}. *${it.name}* - $${it.price.toLocaleString()}\n`;
    });
    
    message += `\n💰 *TOTAL A PAGAR: $${total.toLocaleString()}*\n\n`;
    message += "Quedo atento para coordinar el pago. ¡Gracias!";
    
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/573108014660?text=${encoded}`, '_blank');
};

window.payWithEpayco = () => {
    if (cart.length === 0) return;
    
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        alert('🚀 ¡Alto ahí! Debes INICIAR SESIÓN para realizar el pago seguro.');
        window.location.href = 'login.html';
        return;
    }

    let total = cart.reduce((sum, it) => sum + it.price, 0);
    let description = cart.map(it => it.name).join(', ');

    // REGISTRAR INTENTO DE VENTA EN FIREBASE
    const saleData = {
        customer: user.name,
        email: user.email,
        items: cart,
        total: total,
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
        amount: total.toString(),
        tax_base: "0",
        tax: "0",
        country: "co",
        lang: "es",
        external: "false",
        extra1: user.name,
        extra2: user.email,
        confirmation: "https://knifeblackstore-1791.web.app/confirmacion",
        response: "https://knifeblackstore-1791.web.app/respuesta",
        name_billing: user.name,
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
    invBtn.innerHTML = '📊 Inventario';
    invBtn.style.cssText = 'position:fixed; bottom:20px; left:20px; background:#00f0ff; color:black; padding:15px 25px; border-radius:50px; border:none; cursor:pointer; font-weight:900; z-index:9998; box-shadow:0 0 20px rgba(0,240,255,0.4);';
    document.body.appendChild(invBtn);

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
        invModal.innerHTML = '<h2 style="margin-bottom:20px; color:#00f0ff; text-transform:uppercase; letter-spacing:2px;">📦 Control de Inventario</h2><p>Cargando datos...</p>';
        
        db.ref().once('value').then(snap => {
            const data = snap.val() || {};
            const allGrids = data.grids || {};
            const allSales = data.sales || {};

            let tableHTML = `
                <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
                    <button onclick="exportInventoryToExcel()" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">📥 Excel Inventario</button>
                    <button onclick="window.showSalesHistory()" style="background:#f39c12; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">🧾 Historial de Ventas</button>
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
                            <td style="padding:12px;">${name}</td>
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
                    <h2 style="color:#00f0ff; text-transform:uppercase; letter-spacing:2px; margin:0;">📦 Control de Inventario</h2>
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

        db.ref('grids/' + gridKey).once('value').then(snap => {
            const html = snap.val();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Limpiar admin-controls y stock-indicators del HTML antes de procesar
            tempDiv.querySelectorAll('.admin-controls-wrapper, .stock-indicator').forEach(el => el.remove());
            
            const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
            const item = items[itemIdx];

            if (item) {
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

    window.showSalesHistory = () => {
        invModal.innerHTML = '<h2 style="color:#00f0ff;">Cargando historial...</h2>';
        db.ref('sales').once('value').then(snap => {
            const sales = snap.val() || {};
            let salesHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#f39c12; text-transform:uppercase;">🧾 Historial de Ventas</h2>
                    <div>
                        <button onclick="exportSalesToExcel()" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; margin-right:10px;">📥 Excel Ventas</button>
                        <button onclick="window.loadInventoryData()" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">⬅ Volver</button>
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
                            <button onclick="printInvoice('${id}')" style="background:#fff; color:#000; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.7rem; font-weight:bold;">🖨️ Factura</button>
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
