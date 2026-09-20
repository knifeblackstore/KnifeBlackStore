export async function onRequestPost(context) {
    const request = context.request;
    const body = await request.json();
    
    // Telegram tokens and IDs (Hardcoded for security)
    const TELEGRAM_TOKEN = "8244831010:AAEJWK6ZiRRCEgKJd_GjaH7NFayvwIMb138";
    const ADMIN_CHAT_ID = 1230572764;
    const GEMINI_API_KEY = "AIzaSyCpleY2slAp7d9rvDIDDsIRcN2OA2pFyvs";
    
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

        const prompt = `Eres el asistente de una tienda. Un administrador te envía un mensaje.
Analiza el mensaje y devuelve SOLO un objeto JSON válido, sin ningún otro texto ni bloques de código (no uses \`\`\`json).
El JSON debe tener este formato según lo que pida:

Caso 1 (Vender Streaming):
{"intent": "ADD_SUB", "client": "Nombre", "phone": "Numero", "platform": "Nombre Plataforma", "days": numero_de_dias}
(Si no dice días, asume 30).

Caso 2 (Subir Producto Físico):
{"intent": "ADD_PRODUCT", "name": "Nombre Producto", "price": numero_precio, "type": "figura" o "pin", "stock": numero_stock}
(Si no dice stock, asume 1. Si no dice tipo, asume "figura").

Caso 3 (Buscar Inventario):
{"intent": "CHECK_STOCK", "query": "palabra_clave"}

Mensaje del administrador: "${text}"`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });
        
        const geminiData = await geminiRes.json();
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
                stock: parsed.stock,
                createdAt: new Date().toISOString()
            };

            await fetch(`${FB_URL}/products.json?auth=${idToken}`, {
                method: 'POST',
                body: JSON.stringify(prodData)
            });

            await reply(`✅ ¡Producto subido al inventario!\n📦 Nombre: ${parsed.name}\n💰 Precio: $${parsed.price}\n🔢 Stock: ${parsed.stock}`);
            
        } else if (parsed.intent === 'CHECK_STOCK') {
            const prodRes = await fetch(`${FB_URL}/products.json?auth=${idToken}`);
            const products = await prodRes.json();
            
            let matches = [];
            for (let key in products) {
                let p = products[key];
                if (p.name && p.name.toLowerCase().includes((parsed.query || "").toLowerCase())) {
                    matches.push(`- ${p.name}: $${p.price} (Stock: ${p.stock})`);
                }
            }
            
            if (matches.length > 0) {
                await reply(`🔍 Encontré esto en el inventario:\n${matches.join('\n')}`);
            } else {
                await reply(`❌ No encontré ningún producto que coincida con "${parsed.query}".`);
            }
            
        } else {
            await reply("🤔 No entendí la instrucción. Intenta ser más claro.");
        }

    } catch (error) {
        await reply(`⚠️ Ocurrió un error procesando tu solicitud: ${error.message}`);
    }

    return new Response('OK');
}
