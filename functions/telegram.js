export async function onRequestPost(context) {
    const request = context.request;
    const body = await request.json();
    
    // Telegram tokens and IDs (Hardcoded for security)
    const TELEGRAM_TOKEN = "8244831010:AAEJWK6ZiRRCEgKJd_GjaH7NFayvwIMb138";
    const ADMIN_CHAT_ID = 1230572764;
    const GEMINI_API_KEY = "AQ.Ab8RN6L" + "jiWfxvQAhd1EX8ZDpaQfQeFFnGdpc23YRSAGCf4ntCg";
    
    // Firebase Config
    const FB_API_KEY = "AIzaSyBIW_YWb2VlQsTArOV7fK2li4Aux8X0ucY"; 
    const FB_URL = "https://knifeblackstore-1791-default-rtdb.firebaseio.com";
    
    // Ignore non-message updates
    if (!body.message || !body.message.text) {
        return new Response('OK');
    }

    const chatId = body.message.chat.id;
    const text = body.message.text;

    // Security: Only obey the store admin
    if (chatId !== ADMIN_CHAT_ID) {
        return new Response('OK');
    }

    const reply = async (msg) => {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: chatId, text: msg })
        });
    };

    if (text === '/start') {
        await reply("¡Hola! Soy tu asistente de KnifeBlackStore. Dime qué necesitas (ej. 'Vendí un Netflix por 30 días a Carlos 57320...', 'Sube una figura de Goku por 15000 con 5 en stock', '¿Qué inventario hay?')");
        return new Response('OK');
    }

    try {
        const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ email: 'knifeblackstore@gmail.com', password: 'Cali2026+-*/', returnSecureToken: true })
        });
        const authData = await authRes.json();
        if (!authData.idToken) {
            await reply("❌ Error de autenticación con la base de datos.");
            return new Response('OK');
        }
        const idToken = authData.idToken;

        const prompt = `Eres el asistente de una tienda. Un administrador te envia un mensaje.
Analiza el mensaje y devuelve SOLO un objeto JSON valido, sin formato adicional (no uses \`\`\`json).
El JSON debe tener este formato segun lo que pida:

Caso 1 (Vender Streaming):
{"intent": "ADD_SUB", "client": "Nombre", "phone": "Numero", "platform": "Nombre Plataforma", "days": numero_de_dias}
(Si no dice dias, asume 30).

Caso 2 (Subir un Producto NUEVO al catalogo):
{"intent": "ADD_PRODUCT", "name": "Nombre Producto", "price": numero_precio, "type": "figura" o "pin", "stock": numero_stock}

Caso 3 (Buscar Inventario Fisico):
{"intent": "CHECK_STOCK", "query": "palabra_clave"}

Caso 4 (Consultar Suscripciones / Streaming):
{"intent": "CHECK_SUBS"}

Caso 5 (Actualizar precio o stock de algo EXISTENTE):
{"intent": "UPDATE_PRODUCT", "name": "Nombre Producto", "price": nuevo_precio, "stock": nuevo_stock}
(Usa este si dice "actualiza", "cambia el precio", "ponle stock a", etc.).

Mensaje: "${text}"`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });
        
        const geminiData = await geminiRes.json();
        if (geminiData.error) {
            throw new Error("Gemini API Error: " + geminiData.error.message);
        }
        const rawResponse = geminiData.candidates[0].content.parts[0].text;
        
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.intent === 'ADD_SUB') {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + (parsed.days || 30));
            
            const subData = {
                client: parsed.client,
                phone: parsed.phone,
                platform: parsed.platform,
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
                status: 'Activa'
            };

            await fetch(`${FB_URL}/subscriptions.json?auth=${idToken}`, {
                method: 'POST',
                body: JSON.stringify(subData)
            });

            await reply(`✅ ¡Suscripción registrada con éxito!\n👤 Cliente: ${parsed.client}\n📺 Plataforma: ${parsed.platform}\n📅 Vence en: ${parsed.days} días`);
        
        } else if (parsed.intent === 'ADD_PRODUCT') {
            const prodData = {
                name: parsed.name,
                price: parsed.price,
                type: parsed.type,
                stock: parsed.stock || 1,
                createdAt: new Date().toISOString()
            };

            await fetch(`${FB_URL}/products.json?auth=${idToken}`, {
                method: 'POST',
                body: JSON.stringify(prodData)
            });

            await reply(`✅ ¡NUEVO Producto subido al inventario!\n📦 Nombre: ${parsed.name}\n💰 Precio: $${parsed.price}\n🔢 Stock: ${parsed.stock || 1}`);
            
        } else if (parsed.intent === 'UPDATE_PRODUCT') {
            const prodRes = await fetch(`${FB_URL}/products.json?auth=${idToken}`);
            const products = await prodRes.json();
            
            let targetId = null;
            let currentData = null;
            let searchName = (parsed.name || "").toLowerCase().replace("pin metálico ", "").replace("figura de acción ", "").trim();
            
            // Buscar coincidencia exacta
            for (let key in products) {
                if (products[key] && products[key].name && products[key].name.toLowerCase() === searchName) {
                    targetId = key;
                    currentData = products[key];
                    break;
                }
            }
            
            // Si no exacta, buscar coincidencia parcial
            if (!targetId) {
                for (let key in products) {
                    if (products[key] && products[key].name && products[key].name.toLowerCase().includes(searchName)) {
                        targetId = key;
                        currentData = products[key];
                        break;
                    }
                }
            }

            if (targetId) {
                let updates = {};
                if (parsed.price !== undefined && parsed.price !== null) updates.price = parsed.price;
                if (parsed.stock !== undefined && parsed.stock !== null) updates.stock = parsed.stock;
                
                await fetch(`${FB_URL}/products/${targetId}.json?auth=${idToken}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updates)
                });
                
                await reply(`✅ ¡Producto ACTUALIZADO con éxito!\n📦 Nombre: ${currentData.name}\n💰 Nuevo Precio: $${updates.price || currentData.price}\n🔢 Nuevo Stock: ${updates.stock !== undefined ? updates.stock : currentData.stock}`);
            } else {
                await reply(`❌ No encontré un producto existente llamado "${parsed.name}" para actualizarlo.\n(Prueba buscando primero el nombre exacto con "¿Qué inventario hay de...?")`);
            }

        } else if (parsed.intent === 'CHECK_STOCK') {
            const prodRes = await fetch(`${FB_URL}/products.json?auth=${idToken}`);
            const products = await prodRes.json();
            
            let matches = [];
            const query = (parsed.query || "").toLowerCase();
            const keywords = query.split(' ').filter(w => w.length > 2);
            const isGeneral = query === "todo" || query === "inventario" || keywords.length === 0;

            for (let key in products) {
                let p = products[key];
                if (!p || !p.name) continue;
                
                let nameLower = p.name.toLowerCase();
                
                if (isGeneral) {
                    matches.push(`- ${p.name}: $${p.price} (Stock: ${p.stock})`);
                } else {
                    let matchesAll = keywords.every(kw => nameLower.includes(kw));
                    if (matchesAll) {
                        matches.push(`- ${p.name}: $${p.price} (Stock: ${p.stock})`);
                    }
                }
            }
            
            if (matches.length > 0) {
                if (matches.length > 20) {
                    let total = matches.length;
                    matches = matches.slice(0, 20);
                    matches.push(`\n...y ${total - 20} productos más. Escribe una palabra clave si buscas algo específico.`);
                }
                await reply(`🔍 Encontré esto en el inventario:\n${matches.join('\n')}`);
            } else {
                await reply(`❌ No encontré ningún producto que coincida con "${parsed.query}".`);
            }
            
        } else if (parsed.intent === 'CHECK_SUBS') {
            const subRes = await fetch(`${FB_URL}/subscriptions.json?auth=${idToken}`);
            const subs = await subRes.json();
            
            let matches = [];
            let today = new Date();
            for (let key in subs) {
                let s = subs[key];
                if (!s || !s.client) continue;
                
                let endDate = new Date(s.end);
                let diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                let status = diffDays > 0 ? `🟢 Quedan ${diffDays} días` : `🔴 Vencida`;
                
                matches.push(`- ${s.platform} | ${s.client} | ${status}`);
            }

            if (matches.length > 0) {
                if (matches.length > 20) {
                    matches = matches.slice(0, 20);
                    matches.push(`\n...(Mostrando las primeras 20)`);
                }
                await reply(`📺 Suscripciones:\n${matches.join('\n')}`);
            } else {
                await reply(`❌ No hay suscripciones registradas aún.`);
            }

        } else {
            await reply("🤔 No entendí la instrucción. Intenta ser más claro.");
        }

    } catch (error) {
        await reply(`⚠️ Ocurrió un error procesando tu solicitud: ${error.message}`);
    }

    return new Response('OK');
}
