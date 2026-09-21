export async function onRequestPost(context) {
    const request = context.request;
    const body = await request.json();
    
    // Hardcoded secrets
    const TELEGRAM_TOKEN = "8244831010:AAEJWK6ZiRRCEgKJd_GjaH7NFayvwIMb138";
    const ADMIN_CHAT_ID = 1230572764;
    
    // Basic secret key to prevent spam
    if (body.secret !== "KnifeBlackAlerts2026") {
        return new Response('Unauthorized', { status: 401 });
    }

    const msg = body.message;
    if (!msg) {
        return new Response('Bad Request', { status: 400 });
    }

    try {
        await fetch("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "Markdown" })
        });
        return new Response('OK');
    } catch (error) {
        return new Response('Error', { status: 500 });
    }
}
