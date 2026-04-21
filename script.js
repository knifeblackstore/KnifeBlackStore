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
                    const children = grid.children;
                    if (children.length === 0) return;
                    const clone = children[0].cloneNode(true);
                    const timestamp = Date.now();
                    clone.querySelectorAll('.editable-content, .platform-name, .platform-desc, .platform-price').forEach((el, index) => {
                        el.id = 'dynamic_' + timestamp + '_' + index;
                        if(el.classList.contains('price') || el.classList.contains('platform-price')) el.innerText = '$0.00';
                        else if(el.tagName === 'H3' || el.tagName === 'H2') el.innerText = 'Nuevo Título';
                        else el.innerText = 'Haz clic para editar.';
                    });
                    clone.querySelectorAll('.admin-controls-wrapper').forEach(btn => btn.remove());
                    addAdminButtons(clone, grid);
                    grid.appendChild(clone);
                    saveGrid(grid, safeKey);
                    initEditableContent();
                };
                grid.parentNode.insertBefore(addBtn, grid);
                Array.from(grid.children).forEach(item => addAdminButtons(item, grid, safeKey));
            }
        });
    });

    window.saveGrid = (grid, safeKey) => {
        const clone = grid.cloneNode(true);
        // Eliminar botones y controles de admin
        clone.querySelectorAll('.admin-controls-wrapper').forEach(btn => btn.remove());
        // Quitar permisos de edición de TODOS los elementos
        clone.querySelectorAll('[contenteditable="true"], .editable-content').forEach(el => {
            el.removeAttribute('contenteditable');
            el.style.borderBottom = '';
            el.style.cursor = 'default';
            el.title = '';
        });
        db.ref('grids/' + safeKey).set(clone.innerHTML);
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
    updateStockIndicator(item);
}

function updateStockIndicator(item) {
    let indicator = item.querySelector('.stock-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'stock-indicator';
        indicator.style.cssText = 'font-size:0.8rem; margin-top:10px; font-weight:bold;';
        const target = item.querySelector('.platform-price') || item.querySelector('.price') || item;
        target.after(indicator);
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
        loadInventoryData();
    };

    overlay.onclick = () => {
        invModal.style.display = 'none';
        overlay.style.display = 'none';
    };

    const loadInventoryData = () => {
        invModal.innerHTML = '<h2 style="margin-bottom:20px; color:#00f0ff; text-transform:uppercase; letter-spacing:2px;">📦 Control de Inventario</h2><p>Cargando datos...</p>';
        
        db.ref('grids').once('value').then(snap => {
            const allGrids = snap.val() || {};
            let tableHTML = `
                <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:0.9rem;">
                    <thead>
                        <tr style="border-bottom:2px solid #333; text-align:left;">
                            <th style="padding:10px;">Producto</th>
                            <th style="padding:10px;">Categoría</th>
                            <th style="padding:10px;">Precio</th>
                            <th style="padding:10px;">Stock</th>
                            <th style="padding:10px;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let hasItems = false;
            for (let gridKey in allGrids) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = allGrids[gridKey];
                
                const items = tempDiv.querySelectorAll('.item, .product-card, .platform-card');
                items.forEach(item => {
                    hasItems = true;
                    const name = item.querySelector('h3, .product-name, .platform-name')?.innerText || 'Sin nombre';
                    const price = item.querySelector('.price, .product-price, .platform-price')?.innerText || '$0';
                    const stock = parseInt(item.getAttribute('data-stock')) || 0;
                    const cat = gridKey.split('_')[1] || 'General';

                    let statusColor = stock > 5 ? '#39ff14' : (stock > 0 ? '#ffae00' : '#ff007f');
                    let statusText = stock > 5 ? 'OK' : (stock > 0 ? 'Bajo' : 'AGOTADO');

                    tableHTML += `
                        <tr style="border-bottom:1px solid #222;">
                            <td style="padding:12px;">${name}</td>
                            <td style="padding:12px; opacity:0.6;">${cat}</td>
                            <td style="padding:12px; color:#00f0ff;">${price}</td>
                            <td style="padding:12px; font-weight:bold; color:${statusColor}">${stock}</td>
                            <td style="padding:12px;"><span style="background:${statusColor}22; color:${statusColor}; padding:3px 8px; border-radius:4px; font-size:0.7rem; border:1px solid ${statusColor}44;">${statusText}</span></td>
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
                <p style="margin-top:20px; font-size:0.8rem; opacity:0.5;">* Los cambios de stock se realizan directamente en cada producto dentro de la tienda.</p>
            `;
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